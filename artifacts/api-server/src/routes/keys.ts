import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { requireAuth } from "../lib/auth";

const router = Router();

// POST /keys/regenerate → operationId: regenerateApiKey
router.post("/regenerate", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const apiKey = "key_" + randomBytes(24).toString("hex");
  await db.update(usersTable).set({ apiKey }).where(eq(usersTable.id, user.id));
  return res.json({ apiKey });
});

export default router;
