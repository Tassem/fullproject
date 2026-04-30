import { db, usersTable, creditTransactionsTable, systemSettingsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { getEffectiveLimits } from "./planGuard";
import type { KeySource } from "./providerKeyResolver";

/**
 * Checks if a user has sufficient credits and the right plan features to generate an AI image.
 */
export async function checkAiImagePermission(userId: number): Promise<{
  allowed: boolean;
  reason?: string;
  errorType?: "insufficient_credits" | "feature_disabled" | "plan_limit";
}> {
  // 1. Check Feature Access
  const limits = await getEffectiveLimits(userId);
  if (!limits || !limits.features.has_ai_image_generation) {
    return {
      allowed: false,
      reason: "ميزة توليد الصور بالذكاء الاصطناعي غير مفعلة في خطتك الحالية.",
      errorType: "feature_disabled"
    };
  }

  // 2. Check Credits
  const [user] = await db.select({
    total_credits: sql<number>`COALESCE(${usersTable.monthly_credits}, 0) + COALESCE(${usersTable.purchased_credits}, 0)`
  }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);

  const [settings] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "ai_image_cost_per_generation")).limit(1);
  const costPerGen = parseInt(settings?.value || "2", 10);

  if (!user || user.total_credits < costPerGen) {
    return {
      allowed: false,
      reason: `رصيدك غير كافٍ. تكلفة التوليد هي ${costPerGen} نقطة.`,
      errorType: "insufficient_credits"
    };
  }

  return { allowed: true };
}

/**
 * Deducts credits for a successful AI image generation.
 */
export async function deductAiImageCredits(
  userId: number,
  service: "web" | "api" | "bot" | "telegram" = "web",
  promptSnippet?: string,
  count: number = 1,
  providerKeySource: KeySource = "platform"
): Promise<{ success: boolean; creditsDeducted: number; transactionId: string; error?: string }> {
  try {
    const [settings] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "ai_image_cost_per_generation")).limit(1);
    const costPerGen = parseInt(settings?.value || "2", 10);
    const totalCost = costPerGen * count;

    return await db.transaction(async (tx) => {
      // SELECT ... FOR UPDATE to lock the row and prevent race conditions
      const [user] = await tx.select().from(usersTable).where(eq(usersTable.id, userId)).for("update").limit(1);
      if (!user) return { success: false, creditsDeducted: 0, transactionId: "", error: "User not found" };

      const monthly = user.monthly_credits ?? 0;
      const purchased = user.purchased_credits ?? 0;
      const total = monthly + purchased;

      if (total < totalCost) return { success: false, creditsDeducted: 0, transactionId: "", error: "Insufficient credits" };

      let newMonthly = monthly;
      let newPurchased = purchased;

      if (monthly >= totalCost) {
        newMonthly -= totalCost;
      } else {
        const remaining = totalCost - monthly;
        newMonthly = 0;
        newPurchased -= remaining;
      }

      await tx.update(usersTable).set({
        monthly_credits: newMonthly,
        purchased_credits: newPurchased,
        updatedAt: new Date()
      }).where(eq(usersTable.id, userId));

      const [inserted] = await tx.insert(creditTransactionsTable).values({
        userId,
        type: "image_generator",
        amount: -totalCost,
        description: `توليد ${count} صورة AI: ${promptSnippet?.slice(0, 50) || "بدون عنوان"}...`,
        service,
        providerKeySource,
      }).returning({ id: creditTransactionsTable.id });

      return { success: true, creditsDeducted: totalCost, transactionId: String(inserted.id) };
    });
  } catch (err: any) {
    return { success: false, creditsDeducted: 0, transactionId: "", error: err.message };
  }
}

/**
 * Refunds credits for a failed AI image generation.
 */
export async function refundAiImageCredits(
  userId: number,
  transactionId: string | number
): Promise<{ success: boolean; error?: string }> {
  try {
    const txId = typeof transactionId === "string" ? parseInt(transactionId, 10) : transactionId;
    if (isNaN(txId)) return { success: false, error: "Invalid transaction ID" };

    return await db.transaction(async (tx) => {
      const [transaction] = await tx.select()
        .from(creditTransactionsTable)
        .where(eq(creditTransactionsTable.id, txId))
        .limit(1);

      if (!transaction || transaction.userId !== userId) {
        return { success: false, error: "Transaction not found or unauthorized" };
      }

      if (transaction.amount >= 0) {
        return { success: false, error: "Transaction is not a deduction" };
      }

      const refundAmount = Math.abs(transaction.amount);
      const [user] = await tx.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      if (!user) return { success: false, error: "User not found" };

      await tx.update(usersTable).set({
        purchased_credits: (user.purchased_credits ?? 0) + refundAmount,
        updatedAt: new Date()
      }).where(eq(usersTable.id, userId));

      await tx.insert(creditTransactionsTable).values({
        userId,
        type: "refund",
        amount: refundAmount,
        description: `استرجاع رصيد (فشل التوليد) - ID: ${txId}`,
        service: transaction.service
      });

      return { success: true };
    });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
