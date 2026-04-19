import { Router } from "express";
import { db } from "@workspace/db";
import { generatedImagesTable, articlesTable, sitesTable, pipelineLogsTable, usersTable, templatesTable } from "@workspace/db";
import { eq, and, gte, count, desc, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// GET /stats → operationId: getStats (news-card-pro dashboard)
router.get("/", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;

  const [totalImagesRow] = await db.select({ count: count() }).from(generatedImagesTable).where(eq(generatedImagesTable.userId, user.id));
  const [totalTemplatesRow] = await db.select({ count: count() }).from(templatesTable).where(eq(templatesTable.userId, user.id));

  return res.json({
    totalImages: Number(totalImagesRow.count),
    imagesToday: user.imagesToday,
    totalTemplates: Number(totalTemplatesRow.count),
    plan: user.plan,
    dailyLimit: 20,
  });
});

// GET /stats/overview → operationId: getStatsOverview (blog automation dashboard)
router.get("/overview", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;

  const userSites = await db.select({ id: sitesTable.id }).from(sitesTable).where(eq(sitesTable.user_id, user.id));
  const siteIds = userSites.map(s => s.id);

  if (siteIds.length === 0) {
    return res.json({ total_articles: 0, done: 0, failed: 0, pending: 0, processing: 0, published_today: 0, success_rate: 0 });
  }

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const allArticles = await db.select({ article_status: articlesTable.article_status, created_at: articlesTable.created_at })
    .from(articlesTable).where(inArray(articlesTable.site_id, siteIds));

  const total = allArticles.length;
  const done = allArticles.filter(a => a.article_status === "published").length;
  const failed = allArticles.filter(a => a.article_status === "failed").length;
  const pending = allArticles.filter(a => a.article_status === "draft").length;
  const processing = allArticles.filter(a => a.article_status === "processing").length;
  const publishedToday = allArticles.filter(a => a.article_status === "published" && new Date(a.created_at) >= startOfDay).length;
  const successRate = total > 0 ? Math.round((done / total) * 100) / 100 : 0;

  return res.json({ total_articles: total, done, failed, pending, processing, published_today: publishedToday, success_rate: successRate });
});

// GET /stats/pipeline → operationId: getPipelineStats
router.get("/pipeline", requireAuth, async (req, res) => {
  const logs = await db.select().from(pipelineLogsTable).orderBy(desc(pipelineLogsTable.created_at)).limit(500);

  const stages: Record<string, { success: number; failure: number; durations: number[] }> = {};
  for (const log of logs) {
    if (!stages[log.stage]) stages[log.stage] = { success: 0, failure: 0, durations: [] };
    if (log.status === "success") stages[log.stage].success++;
    if (log.status === "error" || log.status === "failed") stages[log.stage].failure++;
    if (log.duration_ms) stages[log.stage].durations.push(log.duration_ms);
  }

  const stageStats = Object.entries(stages).map(([stage, s]) => ({
    stage,
    success_count: s.success,
    failure_count: s.failure,
    avg_duration_ms: s.durations.length > 0 ? Math.round(s.durations.reduce((a, b) => a + b, 0) / s.durations.length) : 0,
  }));

  const allDurations = logs.filter(l => l.duration_ms).map(l => l.duration_ms as number);
  const avgDuration = allDurations.length > 0 ? Math.round(allDurations.reduce((a, b) => a + b, 0) / allDurations.length) : 0;

  return res.json({ avg_duration_ms: avgDuration, stages: stageStats });
});

// GET /stats/recent-activity → operationId: getRecentActivity
router.get("/recent-activity", requireAuth, async (req, res) => {
  const recentLogs = await db.select().from(pipelineLogsTable)
    .orderBy(desc(pipelineLogsTable.created_at))
    .limit(20);

  return res.json(recentLogs.map(log => ({
    id: log.id,
    article_id: log.article_id ?? null,
    article_title: null,
    stage: log.stage,
    status: log.status,
    message: log.message ?? null,
    created_at: log.created_at,
  })));
});

// Legacy dashboard endpoint (backwards compat)
router.get("/dashboard", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalImagesRow] = await db.select({ count: count() }).from(generatedImagesTable).where(eq(generatedImagesTable.userId, user.id));
  const [imagesMonthRow] = await db.select({ count: count() }).from(generatedImagesTable).where(and(eq(generatedImagesTable.userId, user.id), gte(generatedImagesTable.createdAt, startOfMonth)));
  const userSites = await db.select({ id: sitesTable.id }).from(sitesTable).where(eq(sitesTable.user_id, user.id));

  return res.json({
    imagesToday: user.imagesToday,
    imagesThisMonth: Number(imagesMonthRow.count),
    totalSites: userSites.length,
    creditsBalance: user.credits,
    cardsToday: user.imagesToday,
    cardsLimit: 20,
    totalImages: Number(totalImagesRow.count),
  });
});

export default router;
