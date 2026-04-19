// @ts-nocheck
import { Router } from "express";
import { db, articlesTable, settingsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { runPipeline, getPipelineRunning } from "../pipeline/index.js";

const router = Router();

router.post("/run", requireAuth, async (req, res) => {
  try {
    const result = await runPipeline();
    return res.json(result);
  } catch (err: any) {
    console.error("[pipeline/run]", err);
    return res.status(500).json({ message: err?.message ?? "Pipeline failed to start", queued: 0 });
  }
});

router.get("/status", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const userId = user.id;

  const [pendingResult, processingResult, pipelineEnabledSetting] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(articlesTable)
      .where(sql`${articlesTable.user_id} = ${userId} AND ${articlesTable.content_status} = 'pending'`),
    db
      .select({ count: sql<number>`count(*)` })
      .from(articlesTable)
      .where(sql`${articlesTable.user_id} = ${userId} AND ${articlesTable.content_status} IN ('scraping', 'analyzing', 'seo', 'imaging', 'writing', 'publishing', 'generating')`),
    db
      .select({ value: settingsTable.value })
      .from(settingsTable)
      .where(eq(settingsTable.key, "pipeline_enabled"))
      .limit(1),
  ]);

  const enabled = (pipelineEnabledSetting[0]?.value ?? "true").toLowerCase() !== "false";
  const processingCount = Number(processingResult[0]?.count ?? 0);
  const running = getPipelineRunning() || processingCount > 0;

  return res.json({
    enabled,
    running,
    pending_count: Number(pendingResult[0]?.count ?? 0),
    processing_count: processingCount,
    last_rss_check: null,
    next_rss_check: null,
  });
});

export default router;
