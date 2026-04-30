/**
 * User Provider Keys — CRUD for user-managed API keys (BYOK).
 *
 * Routes:
 *   POST   /api/user/openrouter-key   — add or update key
 *   GET    /api/user/openrouter-key   — get key status (masked)
 *   DELETE /api/user/openrouter-key   — remove key
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { userProviderKeysTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import {
  encryptKey,
  decryptKey,
  validateKeyFormat,
  testKeyWithProvider,
  maskKey,
  makeKeyHint,
} from "../lib/userKeyManager";
import rateLimit from "express-rate-limit";
import { z } from "zod";

const router = Router();

const PROVIDER = "openrouter";

// Rate limit key validation to prevent brute-force testing
const keyValidationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many key validation attempts. Please try again later." },
});

const addKeySchema = z.object({
  key: z.string().min(10).max(500),
});

/**
 * POST /api/user/openrouter-key — Add or update the user's OpenRouter API key.
 */
router.post("/openrouter-key", keyValidationLimiter, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;

  // Validate input
  const parsed = addKeySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request. Please provide a valid API key." });
  }

  const plainKey = parsed.data.key.trim();

  // 1. Format validation
  const formatCheck = validateKeyFormat(plainKey);
  if (!formatCheck.valid) {
    return res.status(400).json({ error: formatCheck.error });
  }

  // 2. Live validation against OpenRouter
  const liveCheck = await testKeyWithProvider(plainKey, PROVIDER);
  if (!liveCheck.valid) {
    return res.status(422).json({ error: liveCheck.error || "API key validation failed." });
  }

  // 3. Encrypt and store
  const { encrypted, iv, tag } = encryptKey(plainKey);
  const hint = makeKeyHint(plainKey);

  // Upsert: insert or update
  const [existing] = await db
    .select({ id: userProviderKeysTable.id })
    .from(userProviderKeysTable)
    .where(
      and(
        eq(userProviderKeysTable.userId, user.id),
        eq(userProviderKeysTable.provider, PROVIDER)
      )
    )
    .limit(1);

  if (existing) {
    await db
      .update(userProviderKeysTable)
      .set({
        encryptedKey: encrypted,
        keyIv: iv,
        keyTag: tag,
        keyHint: hint,
        isValid: true,
        lastValidatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userProviderKeysTable.id, existing.id));
  } else {
    await db.insert(userProviderKeysTable).values({
      userId: user.id,
      provider: PROVIDER,
      encryptedKey: encrypted,
      keyIv: iv,
      keyTag: tag,
      keyHint: hint,
      isValid: true,
      lastValidatedAt: new Date(),
    });
  }

  return res.json({
    success: true,
    message: "تم حفظ مفتاح OpenRouter بنجاح.",
    hint: `sk-or-...${hint}`,
    isValid: true,
  });
});

/**
 * GET /api/user/openrouter-key — Get key status (never returns full key).
 */
router.get("/openrouter-key", async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;

  const [keyRecord] = await db
    .select({
      keyHint: userProviderKeysTable.keyHint,
      isValid: userProviderKeysTable.isValid,
      lastValidatedAt: userProviderKeysTable.lastValidatedAt,
      createdAt: userProviderKeysTable.createdAt,
      updatedAt: userProviderKeysTable.updatedAt,
    })
    .from(userProviderKeysTable)
    .where(
      and(
        eq(userProviderKeysTable.userId, user.id),
        eq(userProviderKeysTable.provider, PROVIDER)
      )
    )
    .limit(1);

  if (!keyRecord) {
    return res.json({
      hasKey: false,
      hint: null,
      isValid: false,
      lastValidated: null,
    });
  }

  return res.json({
    hasKey: true,
    hint: `sk-or-...${keyRecord.keyHint || "****"}`,
    isValid: keyRecord.isValid,
    lastValidated: keyRecord.lastValidatedAt,
  });
});

/**
 * DELETE /api/user/openrouter-key — Remove the user's OpenRouter key.
 */
router.delete("/openrouter-key", async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;

  const result = await db
    .delete(userProviderKeysTable)
    .where(
      and(
        eq(userProviderKeysTable.userId, user.id),
        eq(userProviderKeysTable.provider, PROVIDER)
      )
    );

  return res.json({
    success: true,
    message: "تم حذف مفتاح OpenRouter. لن تعمل ميزات الذكاء الاصطناعي حتى تضيف مفتاحاً جديداً.",
  });
});

export default router;
