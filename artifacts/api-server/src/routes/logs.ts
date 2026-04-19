import { Router } from "express";
import { db } from "@workspace/db";
import { pipelineLogsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  const page = parseInt(String(_req.query.page || "1"));
  const limit = parseInt(String(_req.query.limit || "50"));
  const articleId = _req.query.article_id ? parseInt(String(_req.query.article_id)) : undefined;
  const offset = (page - 1) * limit;

  let query = db.select().from(pipelineLogsTable).$dynamic();
  if (articleId) query = query.where(eq(pipelineLogsTable.article_id, articleId));

  const logs = await query.orderBy(desc(pipelineLogsTable.created_at)).limit(limit).offset(offset);
  const all = await db.select().from(pipelineLogsTable);

  return res.json({ logs, total: all.length });
});

export default router;
