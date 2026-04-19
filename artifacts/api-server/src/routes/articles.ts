// @ts-nocheck
import { Router } from "express";
import { db, articlesTable, sitesTable, usersTable } from "@workspace/db";
import { eq, desc, and, isNotNull, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { wpUpdateRankMath } from "../pipeline/wordpress.js";
import { runPipeline } from "../pipeline/index.js";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────
const GARBAGE_PREFIXES = [
  "okay","i need","please provide","i'll need","i don't have","to complete",
  "i'm unable","i am unable","i cannot","i can't","i apologize","as an ai",
  "i'm sorry","i am sorry","sorry, but","unfortunately","i would need",
  "to write this","to create this","i'd be happy","of course! here",
  "sure! here","certainly! here","here's the","here is the",
];
function isGarbageText(text: string | null | undefined): boolean {
  if (!text) return true;
  const lower = text.trim().toLowerCase();
  if (lower.length < 20) return true;
  return GARBAGE_PREFIXES.some(p => lower.startsWith(p));
}
function getRankMathTitle(article: any): string {
  if (!isGarbageText(article.meta_title)) return article.meta_title ?? article.competitor_title ?? "";
  return article.competitor_title ?? "";
}
function decodeHtmlEntities(str: string): string {
  return str.replace(/&#124;/g,"|").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#039;/g,"'");
}
const STOP_WORDS = new Set(["the","a","an","in","on","at","to","for","of","and","or","is","are","was","were","has","have","how","why","what","when","where","who","this","that","from","with","its","their","your","my","our","i","we","you"]);
function sanitizeKeyword(raw: string | null | undefined): string {
  if (!raw) return "";
  let kw = raw.trim().replace(/\s*\([^)]*\)/g,"").replace(/[|:;,!?@#$%^&*'"'"]/g," ").replace(/&#?\w+;/g," ").replace(/\s+/g," ").trim().toLowerCase();
  const words = kw.split(" ").filter(Boolean);
  if (words.length <= 3) return words.join(" ");
  const meaningful = words.filter(w => !STOP_WORDS.has(w) && w.replace(/[^\w]/g,"").length > 2).slice(0,3);
  return (meaningful.length >= 2 ? meaningful : words.slice(0,3)).join(" ").slice(0,60);
}
function extractKeywordFromTitle(title: string): string {
  const decoded = decodeHtmlEntities(title);
  const segment = decoded.split(/\s+[|:—]\s+/)[0].trim();
  const segmentWords = segment.split(/\s+/).filter(Boolean);
  const source = segmentWords.length >= 3 ? segment : decoded;
  const words = source.split(/\s+/).filter(Boolean);
  const meaningful = words.filter(w => !STOP_WORDS.has(w.toLowerCase()) && w.replace(/[^\w]/g,"").length > 2).slice(0,4);
  const result = meaningful.length >= 2 ? meaningful : words.slice(0,4);
  return result.join(" ").slice(0,60).trim();
}
function getRankMathKeyword(article: any): string {
  const pk = article.primary_keyword;
  if (pk && pk.trim().length > 2 && !isGarbageText(pk)) return sanitizeKeyword(pk);
  const title = article.meta_title ?? article.competitor_title;
  if (title) return extractKeywordFromTitle(title);
  return "";
}

// ── List articles ─────────────────────────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const page = parseInt(String(req.query.page || "1"));
  const limit = parseInt(String(req.query.limit || "20"));
  const offset = (page - 1) * limit;
  const statusFilter = req.query.status as string | undefined;
  const siteId = req.query.site_id ? parseInt(String(req.query.site_id)) : undefined;

  let whereClause: any = eq(articlesTable.user_id, user.id);
  if (siteId) {
    whereClause = and(eq(articlesTable.user_id, user.id), eq(articlesTable.site_id, siteId));
  }
  if (statusFilter) {
    whereClause = and(whereClause, sql`(${articlesTable.content_status} = ${statusFilter} OR ${articlesTable.article_status} = ${statusFilter} OR ${articlesTable.image_status} = ${statusFilter})`);
  }

  const [articles, countResult] = await Promise.all([
    db.select().from(articlesTable).where(whereClause).orderBy(desc(articlesTable.created_at)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(articlesTable).where(whereClause),
  ]);

  return res.json({ articles, total: Number(countResult[0]?.count ?? 0), page, limit });
});

// ── Get single article ────────────────────────────────────────────────────────
router.get("/:id", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const id = parseInt(req.params.id);
  const [article] = await db.select().from(articlesTable).where(and(eq(articlesTable.id, id), eq(articlesTable.user_id, user.id))).limit(1);
  if (!article) return res.status(404).json({ error: "Article not found" });
  return res.json(article);
});

// ── Create article manually ───────────────────────────────────────────────────
router.post("/", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const { rss_link, site_id } = req.body as { rss_link: string; site_id?: number };
  if (!rss_link) return res.status(400).json({ error: "rss_link is required" });

  const [existing] = await db.select().from(articlesTable).where(eq(articlesTable.rss_link, rss_link)).limit(1);
  if (existing) return res.status(409).json({ error: "Article with this RSS link already exists" });

  // Verify user owns the site if provided
  let siteIdToUse: number | null = null;
  if (site_id) {
    const [site] = await db.select().from(sitesTable).where(and(eq(sitesTable.id, site_id), eq(sitesTable.user_id, user.id))).limit(1);
    if (site) siteIdToUse = site.id;
  }

  const [article] = await db.insert(articlesTable).values({
    user_id: user.id,
    site_id: siteIdToUse,
    rss_link,
    content_status: "pending",
    image_status: "pending",
    article_status: "pending",
  }).returning();

  return res.status(201).json(article);
});

// ── Delete article ────────────────────────────────────────────────────────────
router.delete("/:id", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const id = parseInt(req.params.id);
  const [deleted] = await db.delete(articlesTable).where(and(eq(articlesTable.id, id), eq(articlesTable.user_id, user.id))).returning();
  if (!deleted) return res.status(404).json({ error: "Article not found" });
  return res.sendStatus(204);
});

// ── Retry article ─────────────────────────────────────────────────────────────
router.post("/:id/retry", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const id = parseInt(req.params.id);

  const [article] = await db.select().from(articlesTable).where(and(eq(articlesTable.id, id), eq(articlesTable.user_id, user.id))).limit(1);
  if (!article) return res.status(404).json({ error: "Article not found" });

  const [updated] = await db.update(articlesTable).set({
    content_status: "pending",
    image_status: "pending",
    article_status: "pending",
    error_message: null,
    meta_title: null,
    meta_description: null,
    permalink_slug: null,
    primary_keyword: null,
    secondary_keywords: null,
    keyword_strategy: null,
    content_gaps: null,
    content_structure: null,
    image_prompt: null,
    internal_links: null,
    external_links: null,
    article_html: null,
    generated_image_url: null,
    final_image_url: null,
    kieai_task_id: null,
    wp_post_id: null,
    wp_image_id: null,
    wp_post_url: null,
    retry_count: (article.retry_count ?? 0) + 1,
    updated_at: new Date(),
  }).where(and(eq(articlesTable.id, id), eq(articlesTable.user_id, user.id))).returning();

  // Trigger pipeline in background
  runPipeline().catch(err => console.error("[retry] pipeline trigger failed:", err));

  return res.json(updated);
});

// ── Re-apply Rank Math to a single article ────────────────────────────────────
router.post("/:id/rank-math", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid article id" });

  const [article] = await db.select().from(articlesTable).where(and(eq(articlesTable.id, id), eq(articlesTable.user_id, user.id))).limit(1);
  if (!article) return res.status(404).json({ error: "Article not found" });
  if (!article.wp_post_id) return res.status(400).json({ error: "Article not published to WordPress yet" });

  const [site] = await db.select().from(sitesTable).where(and(eq(sitesTable.id, article.site_id!), eq(sitesTable.user_id, user.id))).limit(1);
  if (!site) return res.status(400).json({ error: "Site not found" });
  if (!site.wp_url || !site.wp_username || !site.wp_password) return res.status(400).json({ error: "WordPress credentials not configured" });

  const focusKw = getRankMathKeyword(article);
  const ogImage = article.final_image_url ?? article.competitor_image_url ?? undefined;
  const result = await wpUpdateRankMath(
    site.wp_url, site.wp_username, site.wp_password,
    article.wp_post_id,
    getRankMathTitle(article),
    isGarbageText(article.meta_description) ? "" : (article.meta_description ?? ""),
    focusKw,
    article.secondary_keywords ?? undefined,
    ogImage
  );

  if (!result.success) return res.status(502).json({ error: result.error });

  const allFocusKws = [focusKw, ...(article.secondary_keywords ? article.secondary_keywords.split(",").map(k => sanitizeKeyword(k.trim())).filter(Boolean) : [])].join(", ");
  return res.json({ ok: true, post_id: article.wp_post_id, focus_keyword: allFocusKws });
});

// ── Bulk re-apply Rank Math to all published articles for a site ──────────────
router.post("/sites/:siteId/rank-math/bulk", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const siteId = parseInt(req.params.siteId);
  if (isNaN(siteId)) return res.status(400).json({ error: "Invalid site id" });

  const [site] = await db.select().from(sitesTable).where(and(eq(sitesTable.id, siteId), eq(sitesTable.user_id, user.id))).limit(1);
  if (!site) return res.status(404).json({ error: "Site not found" });
  if (!site.wp_url || !site.wp_username || !site.wp_password) return res.status(400).json({ error: "WordPress credentials not configured" });

  const articles = await db.select().from(articlesTable).where(and(eq(articlesTable.site_id, siteId), eq(articlesTable.user_id, user.id), isNotNull(articlesTable.wp_post_id)));

  res.json({ queued: articles.length, message: `Updating Rank Math for ${articles.length} articles in background` });

  (async () => {
    let ok = 0; let fail = 0;
    for (const article of articles) {
      if (!article.wp_post_id) continue;
      try {
        const r = await wpUpdateRankMath(
          site.wp_url!, site.wp_username!, site.wp_password!,
          article.wp_post_id,
          getRankMathTitle(article),
          isGarbageText(article.meta_description) ? "" : (article.meta_description ?? ""),
          getRankMathKeyword(article),
          article.secondary_keywords ?? undefined,
          article.final_image_url ?? article.competitor_image_url ?? undefined
        );
        if (r.success) ok++; else { fail++; console.error(`[rank-math] post ${article.wp_post_id} failed:`, r.error); }
      } catch (e) { fail++; console.error(`[rank-math] post ${article.wp_post_id} error:`, e); }
      await new Promise(r => setTimeout(r, 300));
    }
    console.log(`[rank-math bulk] site=${siteId} ok=${ok} fail=${fail}`);
  })().catch(console.error);
});

export default router;
