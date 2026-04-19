// @ts-nocheck
import { Router } from "express";
import { db, rssFeedsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// GET /api/rss — list RSS feeds for current user
router.get("/", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const feeds = await db.select().from(rssFeedsTable).where(eq(rssFeedsTable.user_id, user.id));
  return res.json(feeds);
});

// GET /api/rss/site/:siteId — feeds for a specific site
router.get("/site/:siteId", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const siteId = parseInt(req.params.siteId);
  if (isNaN(siteId)) return res.status(400).json({ error: "Invalid siteId" });

  const feeds = await db.select().from(rssFeedsTable)
    .where(and(eq(rssFeedsTable.user_id, user.id), eq(rssFeedsTable.site_id, siteId)));
  return res.json(feeds);
});

// POST /api/rss — create a new RSS feed
router.post("/", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const b = req.body as Record<string, any>;
  const siteId = b.siteId ?? b.site_id;
  const rssUrl = b.rssUrl ?? b.rss_url;

  if (!siteId || !rssUrl) return res.status(400).json({ error: "siteId and rssUrl are required" });

  const [feed] = await db.insert(rssFeedsTable).values({
    user_id: user.id,
    site_id: parseInt(siteId),
    rss_url: rssUrl,
    label: b.label ?? null,
    wp_category_id: b.wpCategoryId ?? b.wp_category_id ?? null,
    wp_category_name: b.wpCategoryName ?? b.wp_category_name ?? null,
    poll_hours: b.pollHours ?? b.poll_hours ?? 4,
    poll_minutes: b.pollMinutes ?? b.poll_minutes ?? 0,
    max_articles: b.maxArticles ?? b.max_articles ?? 0,
    is_active: true,
  }).returning();

  return res.status(201).json(feed);
});

// PUT /api/rss/:id — update a feed
router.put("/:id", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const b = req.body as Record<string, any>;
  const patch: Record<string, any> = { updated_at: new Date() };
  if (b.rssUrl !== undefined || b.rss_url !== undefined) patch.rss_url = b.rssUrl ?? b.rss_url;
  if (b.label !== undefined) patch.label = b.label;
  if (b.wpCategoryId !== undefined || b.wp_category_id !== undefined) patch.wp_category_id = b.wpCategoryId ?? b.wp_category_id;
  if (b.wpCategoryName !== undefined || b.wp_category_name !== undefined) patch.wp_category_name = b.wpCategoryName ?? b.wp_category_name;
  if (b.pollHours !== undefined || b.poll_hours !== undefined) patch.poll_hours = b.pollHours ?? b.poll_hours;
  if (b.pollMinutes !== undefined || b.poll_minutes !== undefined) patch.poll_minutes = b.pollMinutes ?? b.poll_minutes;
  if (b.maxArticles !== undefined || b.max_articles !== undefined) patch.max_articles = b.maxArticles ?? b.max_articles;
  if (b.isActive !== undefined || b.is_active !== undefined) patch.is_active = b.isActive ?? b.is_active;

  const [updated] = await db.update(rssFeedsTable)
    .set(patch)
    .where(and(eq(rssFeedsTable.id, id), eq(rssFeedsTable.user_id, user.id)))
    .returning();

  if (!updated) return res.status(404).json({ error: "Feed not found" });
  return res.json(updated);
});

// DELETE /api/rss/:id
router.delete("/:id", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  await db.delete(rssFeedsTable).where(and(eq(rssFeedsTable.id, id), eq(rssFeedsTable.user_id, user.id)));
  return res.json({ success: true });
});

// PATCH /api/rss/:id/toggle — toggle active status
router.patch("/:id/toggle", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const id = parseInt(req.params.id);
  const [current] = await db.select().from(rssFeedsTable).where(and(eq(rssFeedsTable.id, id), eq(rssFeedsTable.user_id, user.id))).limit(1);
  if (!current) return res.status(404).json({ error: "Feed not found" });

  const [updated] = await db.update(rssFeedsTable)
    .set({ is_active: !current.is_active, updated_at: new Date() })
    .where(eq(rssFeedsTable.id, id)).returning();
  return res.json(updated);
});

export default router;
