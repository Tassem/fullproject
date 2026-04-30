/**
 * Provider Key Resolver — central decision point for all AI API calls.
 *
 * Determines whether to use the platform API key or a user's BYOK key
 * based on the user's plan mode, key presence, and validity.
 */

import { db } from "@workspace/db";
import { userProviderKeysTable, plansTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { decryptKey } from "./userKeyManager";

export type KeySource = "platform" | "user_byok";

export interface ResolvedKey {
  key: string;
  source: KeySource;
  provider: string;
}

export class BYOKKeyMissingError extends Error {
  public readonly code = "BYOK_KEY_MISSING" as const;
  constructor(message?: string) {
    super(message || "يرجى إضافة مفتاح OpenRouter الخاص بك في الإعدادات لاستخدام ميزات الذكاء الاصطناعي.");
    this.name = "BYOKKeyMissingError";
  }
}

export class BYOKKeyInvalidError extends Error {
  public readonly code = "BYOK_KEY_INVALID" as const;
  constructor(message?: string) {
    super(message || "مفتاح OpenRouter الخاص بك غير صالح أو منتهي الصلاحية. يرجى تحديثه في الإعدادات.");
    this.name = "BYOKKeyInvalidError";
  }
}

/**
 * Get the user's plan mode from the database.
 */
export async function getUserPlanMode(userId: number): Promise<"platform" | "byok"> {
  const [user] = await db.select({ plan: usersTable.plan }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return "platform";

  const [plan] = await db.select({ plan_mode: plansTable.plan_mode }).from(plansTable).where(eq(plansTable.slug, user.plan)).limit(1);
  return (plan?.plan_mode === "byok" ? "byok" : "platform");
}

/**
 * Resolve which API key to use for an AI call.
 *
 * - Platform mode: returns the platform key from settings (caller provides it).
 * - BYOK mode: decrypts and returns the user's stored key.
 *   - Throws BYOKKeyMissingError if no key is stored.
 *   - Throws BYOKKeyInvalidError if the stored key is marked invalid.
 *
 * IMPORTANT: For BYOK users, this function NEVER falls back to the platform key.
 */
export async function resolveProviderKey(
  userId: number,
  provider: string,
  platformKey: string,
  planMode: "platform" | "byok"
): Promise<ResolvedKey> {
  if (planMode === "platform") {
    return { key: platformKey, source: "platform", provider };
  }

  // BYOK mode — fetch user's stored key
  const [userKey] = await db
    .select()
    .from(userProviderKeysTable)
    .where(
      and(
        eq(userProviderKeysTable.userId, userId),
        eq(userProviderKeysTable.provider, provider)
      )
    )
    .limit(1);

  if (!userKey) {
    throw new BYOKKeyMissingError();
  }

  if (!userKey.isValid) {
    throw new BYOKKeyInvalidError();
  }

  try {
    const decrypted = decryptKey(userKey.encryptedKey, userKey.keyIv, userKey.keyTag);
    return { key: decrypted, source: "user_byok", provider };
  } catch {
    throw new BYOKKeyInvalidError("فشل فك تشفير المفتاح. يرجى إعادة إدخال مفتاح OpenRouter الخاص بك.");
  }
}
