import { Router } from "express";
import { db } from "@workspace/db";
import { generatedImagesTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// GET /history → operationId: listHistory
router.get("/", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const limit = parseInt(String(req.query.limit || "20"));
  const offset = parseInt(String(req.query.offset || "0"));

  const images = await db.select().from(generatedImagesTable)
    .where(eq(generatedImagesTable.userId, user.id))
    .orderBy(desc(generatedImagesTable.createdAt))
    .limit(limit)
    .offset(offset);

  const all = await db.select({ id: generatedImagesTable.id }).from(generatedImagesTable).where(eq(generatedImagesTable.userId, user.id));

  return res.json({ images, total: all.length });
});

export default router;
