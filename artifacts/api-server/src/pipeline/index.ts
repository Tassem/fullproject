// @ts-nocheck
import { eq, sql, inArray } from "drizzle-orm";
import { db, articlesTable, settingsTable, sitesTable, rssFeedsTable } from "@workspace/db";
import { fetchRssFeed } from "./rss.js";
import { processArticle, loadAgentsForSite } from "./runner.js";

let isRunning = false;

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(settingsTable);
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.value ?? "";
  }
  return map;
}

export async function runPipeline(): Promise<{ queued: number; message: string }> {
  const settings = await getSettings();

  if (settings.pipeline_enabled === "false") {
    return { queued: 0, message: "Pipeline is disabled. Enable it in Settings." };
  }

  // ── Step 1: Fetch RSS for all active sites ────────────────────────────────
  const sites = await db.select().from(sitesTable).where(eq(sitesTable.is_active, true));

  let newArticleCount = 0;
  const newArticleIds: number[] = [];

  for (const site of sites) {
    // Fetch active rss_feeds for this site
    const rssFeeds = await db
      .select()
      .from(rssFeedsTable)
      .where(eq(rssFeedsTable.site_id, site.id));

    // Also fall back to legacy rss_feed_url on the site itself (for backwards compat)
    const feedsToProcess = rssFeeds.length > 0
      ? rssFeeds.filter((f) => f.is_active)
      : site.rss_feed_url
      ? [{ id: null as null, rss_url: site.rss_feed_url, wp_category_id: null as null }]
      : [];

    for (const feed of feedsToProcess) {
      try {
        const maxArticles = (feed as { max_articles?: number }).max_articles ?? 0;
        const pollHours = (feed as { poll_hours?: number }).poll_hours ?? 4;
        const pollMinutes = (feed as { poll_minutes?: number }).poll_minutes ?? 0;
        const totalMinutes = pollHours * 60 + pollMinutes;
        const intervalLabel = totalMinutes >= 60
          ? `${Math.floor(totalMinutes / 60)}h${totalMinutes % 60 > 0 ? `${totalMinutes % 60}m` : ""}`
          : `${totalMinutes}m`;

        if (totalMinutes > 0 && feed.id) {
          const recentCount = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(articlesTable)
            .where(
              sql`${articlesTable.rss_feed_id} = ${feed.id}
                  AND ${articlesTable.created_at} > NOW() - INTERVAL '${sql.raw(String(totalMinutes))} minutes'`
            );
          const recent = recentCount[0]?.count ?? 0;
          if (maxArticles > 0 && recent >= maxArticles) {
            console.log(`[rss] Feed ${feed.rss_url} — already ${recent} articles in last ${intervalLabel} (max=${maxArticles}), skipping`);
            continue;
          }
        }

        let items = await fetchRssFeed(feed.rss_url);

        if (maxArticles > 0) {
          let remaining = maxArticles;
          if (feed.id && totalMinutes > 0) {
            const recentCount = await db
              .select({ count: sql<number>`count(*)::int` })
              .from(articlesTable)
              .where(
                sql`${articlesTable.rss_feed_id} = ${feed.id}
                    AND ${articlesTable.created_at} > NOW() - INTERVAL '${sql.raw(String(totalMinutes))} minutes'`
              );
            remaining = Math.max(0, maxArticles - (recentCount[0]?.count ?? 0));
          }
          if (remaining <= 0) {
            console.log(`[rss] Feed ${feed.rss_url} — quota exhausted for this period, skipping`);
            continue;
          }
          items = items.slice(0, remaining);
          console.log(`[rss] Feed ${feed.rss_url} — taking ${items.length} of ${maxArticles} max (${remaining} remaining in ${intervalLabel} window)`);
        }

        for (const item of items) {
          if (!item.link) continue;
          try {
            const [inserted] = await db
              .insert(articlesTable)
              .values({
                site_id: site.id,
                rss_feed_id: feed.id ?? null,
                wp_category_id: feed.wp_category_id ?? null,
                rss_link: item.link,
                competitor_title: item.title?.slice(0, 500),
                competitor_description: item.description?.slice(0, 1000),
                competitor_image_url: item.imageUrl ?? null,
                content_status: "pending",
                image_status: "pending",
                article_status: "pending",
              })
              .onConflictDoNothing()
              .returning({ id: articlesTable.id });

            if (inserted?.id) {
              newArticleIds.push(inserted.id);
              newArticleCount++;
            }
          } catch {
            // duplicate or error — skip
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "RSS fetch failed";
        console.error(`RSS fetch failed for site ${site.name} feed ${feed.rss_url}: ${msg}`);
      }
    }
  }

  // ── Step 2: Also pick up any previously failed/pending articles ───────────
  const pendingArticles = await db
    .select({ id: articlesTable.id, site_id: articlesTable.site_id })
    .from(articlesTable)
    .where(
      sql`${articlesTable.content_status} IN ('pending', 'failed') AND ${articlesTable.article_status} = 'pending'`
    )
    .limit(20);

  const existingPendingIds = pendingArticles.map((a) => a.id).filter((id) => !newArticleIds.includes(id));
  const allToProcess = [...newArticleIds, ...existingPendingIds];

  const totalQueued = allToProcess.length;

  if (totalQueued === 0) {
    return {
      queued: 0,
      message: `No articles to process. ${newArticleCount > 0 ? `${newArticleCount} duplicates skipped (already in DB).` : "RSS feeds returned no new items."}`,
    };
  }

  // ── Step 3: Process articles in background (non-blocking) ─────────────────
  if (!isRunning) {
    isRunning = true;

    // Get full article info for site mapping
    const articlesInfo = await db
      .select({ id: articlesTable.id, site_id: articlesTable.site_id })
      .from(articlesTable)
      .where(inArray(articlesTable.id, allToProcess));

    const siteIds = [...new Set(articlesInfo.map((a) => a.site_id))];

    // Preload agents per site
    const agentsBySite: Record<string, Record<string, { system_message: string; is_active: boolean }>> = {};
    for (const siteId of siteIds) {
      const key = String(siteId ?? "null");
      if (!agentsBySite[key]) {
        agentsBySite[key] = await loadAgentsForSite(siteId);
      }
    }

    setImmediate(async () => {
      try {
        for (const { id, site_id } of articlesInfo) {
          try {
            const agents = agentsBySite[String(site_id ?? "null")] ?? {};
            await processArticle(id, settings, agents);
          } catch (err) {
            console.error(`Pipeline error for article ${id}:`, err instanceof Error ? err.message : err);
          }
        }
      } finally {
        isRunning = false;
      }
    });
  }

  return {
    queued: totalQueued,
    message: `Pipeline started. ${newArticleCount} new article(s) from RSS + ${existingPendingIds.length} previously pending. Processing ${totalQueued} total.`,
  };
}

export function getPipelineRunning(): boolean {
  return isRunning;
}
