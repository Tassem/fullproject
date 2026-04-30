import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/health", async (_req, res) => {
  const uptime = process.uptime();
  let dbOk = false;
  try {
    await db.execute(sql`SELECT 1`);
    dbOk = true;
  } catch { /* db unreachable */ }

  const status = dbOk ? "healthy" : "degraded";
  res.status(dbOk ? 200 : 503).json({
    status,
    uptime: Math.round(uptime),
    database: dbOk ? "connected" : "unreachable",
    timestamp: new Date().toISOString(),
  });
});

export default router;
