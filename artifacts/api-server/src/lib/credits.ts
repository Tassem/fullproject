/**
 * Central credit management library.
 *
 * Rules:
 *  1. Check plan feature gate (has_image_generator, has_blog_automation, etc.)
 *  2. Check daily rate limit (rate_limit_daily) — reset lazily on first request of day
 *  3. Reset monthly credits lazily (compare credits_reset_date vs now)
 *  4. Deduct: monthly_credits first → purchased_credits second
 *  5. On failure → refund via restoreCredits()
 */

import { db } from "@workspace/db";
import { usersTable, plansTable, creditTransactionsTable } from "@workspace/db";
import { eq, and, gte, sql } from "drizzle-orm";
import { getEffectiveLimits } from "./planGuard";

export type ServiceType = "image_generator" | "blog_automation";

export type DeductResult =
  | { ok: true; creditsUsed: number; monthlyRemaining: number; purchasedRemaining: number; total: number }
  | { ok: false; error: string; code: "feature_disabled" | "rate_limit" | "insufficient_credits" | "plan_not_found" };

/** Fetch plan by slug */
async function getPlan(planSlug: string) {
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.slug, planSlug)).limit(1);
  return plan ?? null;
}

/** Lazily reset daily usage counter if the date has changed */
async function checkAndResetDaily(userId: number, currentDate: string | null) {
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  if (currentDate !== today) {
    await db
      .update(usersTable)
      .set({ daily_usage_count: 0, daily_usage_date: today })
      .where(eq(usersTable.id, userId));
    return 0;
  }
  return null; // No reset needed
}

/** Lazily reset monthly credits if credits_reset_date has passed */
async function checkAndResetMonthly(
  user: typeof usersTable.$inferSelect,
  plan: typeof plansTable.$inferSelect
) {
  const now = new Date();
  const resetDate = user.credits_reset_date ? new Date(user.credits_reset_date) : null;

  if (!resetDate || now >= resetDate) {
    const nextReset = new Date(now);
    nextReset.setMonth(nextReset.getMonth() + 1);

    const newMonthly = plan.monthly_credits;
    await db.transaction(async (tx) => {
      await tx
        .update(usersTable)
        .set({
          monthly_credits: newMonthly,
          credits_reset_date: nextReset,
          daily_usage_count: 0,
          daily_usage_date: now.toISOString().slice(0, 10),
        })
        .where(eq(usersTable.id, user.id));

      await tx.insert(creditTransactionsTable).values({
        userId: user.id,
        type: "earn",
        amount: newMonthly,
        description: `تجديد شهري — باقة ${plan.name}`,
        service: "system",
      });
    });

    return true; // Was reset
  }

  return false;
}

/**
 * Main deduction function — call before every billable operation.
 */
export async function deductCredits(
  userId: number,
  cost: number,
  service: ServiceType,
  featureFlag: keyof typeof plansTable.$inferSelect,
  description: string
): Promise<DeductResult> {
  // 1. Load fresh user
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return { ok: false, error: "User not found", code: "insufficient_credits" };

  // 2. Load plan
  const plan = await getPlan(user.plan);
  if (!plan) return { ok: false, error: "Plan not found", code: "plan_not_found" };

  // 3. Check feature gate
  const effective = await getEffectiveLimits(userId);
  if (!effective || !effective.features[featureFlag as string]) {
    return {
      ok: false,
      error: `هذه الخدمة غير متاحة في باقتك الحالية (${plan.name}). يرجى الترقية.`,
      code: "feature_disabled",
    };
  }

  // 4. Lazy resets
  await checkAndResetDaily(user.id, user.daily_usage_date);
  const wasMonthlyReset = await checkAndResetMonthly(user, plan);

  // 5. Reload user if reset happened
  let freshUser = user;
  if (wasMonthlyReset) {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (u) freshUser = u;
  }

  // 6. Check daily rate limit
  if ((freshUser.daily_usage_count ?? 0) >= plan.rate_limit_daily) {
    return {
      ok: false,
      error: `وصلت للحد اليومي (${plan.rate_limit_daily} عملية/يوم). يتجدد الحد غداً.`,
      code: "rate_limit",
    };
  }

  // 7–8. Atomic balance check + deduction inside a single transaction with row lock
  try {
    const result = await db.transaction(async (tx) => {
      // SELECT ... FOR UPDATE to lock the row and prevent race conditions
      const [locked] = await tx
        .select({
          monthly_credits: usersTable.monthly_credits,
          purchased_credits: usersTable.purchased_credits,
        })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .for("update")
        .limit(1);

      if (!locked) throw new Error("User not found");

      const monthly = locked.monthly_credits ?? 0;
      const purchased = locked.purchased_credits ?? 0;

      if (cost > 0 && monthly + purchased < cost) {
        throw new Error(`رصيدك غير كافٍ. مطلوب: ${cost} | متاح: ${monthly + purchased}.`);
      }

      const deductFromMonthly = Math.min(monthly, cost);
      const deductFromPurchased = Math.max(0, cost - deductFromMonthly);

      await tx.update(usersTable)
        .set({
          monthly_credits: sql`${usersTable.monthly_credits} - ${deductFromMonthly}`,
          purchased_credits: sql`${usersTable.purchased_credits} - ${deductFromPurchased}`,
          daily_usage_count: sql`${usersTable.daily_usage_count} + 1`,
        })
        .where(eq(usersTable.id, userId));

      await tx.insert(creditTransactionsTable).values({
        userId,
        type: "spend",
        amount: -cost,
        description,
        service,
      });

      return {
        ok: true as const,
        creditsUsed: cost,
        monthlyRemaining: monthly - deductFromMonthly,
        purchasedRemaining: purchased - deductFromPurchased,
        total: (monthly + purchased) - cost,
      };
    });

    return result;
  } catch (err: any) {
    const msg = err.message || "Deduction failed";
    if (msg.includes("رصيدك غير كافٍ")) {
      return { ok: false, error: msg, code: "insufficient_credits" };
    }
    return { ok: false, error: msg, code: "insufficient_credits" };
  }
}

/**
 * Refund credits after a failed operation.
 */
export async function restoreCredits(
  userId: number,
  cost: number,
  service: ServiceType,
  reason: string
): Promise<void> {
  if (cost <= 0) return;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return;

  const plan = await getPlan(user.plan);
  const maxMonthly = plan?.monthly_credits ?? 10;
  
  const currentMonthly = user.monthly_credits ?? 0;
  const canRestoreToMonthly = Math.max(0, maxMonthly - currentMonthly);
  
  const restoreToMonthly = Math.min(cost, canRestoreToMonthly);
  const restoreToPurchased = Math.max(0, cost - restoreToMonthly);

  await db.transaction(async (tx) => {
    if (restoreToMonthly > 0) {
      await tx.update(usersTable)
        .set({ monthly_credits: sql`${usersTable.monthly_credits} + ${restoreToMonthly}` })
        .where(eq(usersTable.id, userId));
    }
    
    if (restoreToPurchased > 0) {
      await tx.update(usersTable)
        .set({ purchased_credits: sql`${usersTable.purchased_credits} + ${restoreToPurchased}` })
        .where(eq(usersTable.id, userId));
    }

    await tx.insert(creditTransactionsTable).values({
      userId,
      type: "earn",
      amount: cost,
      description: `استرداد تلقائي (${service}) — ${reason}`,
      service: "system",
    });
  });
}

/**
 * Get user's current credit balance (after lazy resets).
 */
export async function getCreditBalance(userId: number) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return { monthly: 0, purchased: 0, total: 0 };
  return {
    monthly: user.monthly_credits ?? 0,
    purchased: user.purchased_credits ?? 0,
    total: (user.monthly_credits ?? 0) + (user.purchased_credits ?? 0),
  };
}
