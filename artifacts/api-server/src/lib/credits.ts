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
import { eq } from "drizzle-orm";

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
async function checkAndResetDaily(user: typeof usersTable.$inferSelect) {
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  if (user.daily_usage_date !== today) {
    await db
      .update(usersTable)
      .set({ daily_usage_count: 0, daily_usage_date: today })
      .where(eq(usersTable.id, user.id));
    return 0;
  }
  return user.daily_usage_count ?? 0;
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
    await db
      .update(usersTable)
      .set({
        monthly_credits: newMonthly,
        credits_reset_date: nextReset,
        daily_usage_count: 0,
        daily_usage_date: now.toISOString().slice(0, 10),
      })
      .where(eq(usersTable.id, user.id));

    await db.insert(creditTransactionsTable).values({
      userId: user.id,
      type: "earn",
      amount: newMonthly,
      description: `تجديد شهري — باقة ${plan.name}`,
      service: "system",
    });

    return { monthly: newMonthly, purchased: user.purchased_credits ?? 0 };
  }

  return { monthly: user.monthly_credits ?? 0, purchased: user.purchased_credits ?? 0 };
}

/**
 * Main deduction function — call before every billable operation.
 *
 * @param userId        The user's DB id
 * @param cost          Credit cost (e.g. 1 for card, 5 for article)
 * @param service       "image_generator" | "blog_automation"
 * @param featureFlag   Which plan boolean to check (e.g. "has_image_generator")
 * @param description   Log description stored in credit_transactions
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
  if (!(plan[featureFlag] as boolean)) {
    return {
      ok: false,
      error: `هذه الخدمة غير متاحة في باقتك الحالية (${plan.name}). يرجى الترقية.`,
      code: "feature_disabled",
    };
  }

  // 4. Reset daily counter if needed
  const currentDailyUsage = await checkAndResetDaily(user);

  // 5. Check daily rate limit
  if (currentDailyUsage >= plan.rate_limit_daily) {
    return {
      ok: false,
      error: `وصلت للحد اليومي (${plan.rate_limit_daily} عملية/يوم). يتجدد الحد غداً.`,
      code: "rate_limit",
    };
  }

  // 6. Refresh user after possible daily reset
  const [freshUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);

  // 7. Lazily reset monthly credits
  const { monthly, purchased } = await checkAndResetMonthly(freshUser, plan);

  // 8. Check if total balance covers cost
  if (cost > 0 && monthly + purchased < cost) {
    return {
      ok: false,
      error: `رصيدك غير كافٍ. مطلوب: ${cost} | متاح: ${monthly + purchased} (شهري: ${monthly} + مشترى: ${purchased}).`,
      code: "insufficient_credits",
    };
  }

  // 9. Deduct — monthly first, then purchased
  let deductFromMonthly = 0;
  let deductFromPurchased = 0;

  if (cost > 0) {
    deductFromMonthly = Math.min(monthly, cost);
    deductFromPurchased = cost - deductFromMonthly;

    const updates: Partial<typeof usersTable.$inferInsert> = {
      daily_usage_count: currentDailyUsage + 1,
    };
    if (deductFromMonthly > 0) updates.monthly_credits = monthly - deductFromMonthly;
    if (deductFromPurchased > 0) updates.purchased_credits = purchased - deductFromPurchased;

    await db.update(usersTable).set(updates).where(eq(usersTable.id, userId));

    await db.insert(creditTransactionsTable).values({
      userId,
      type: "spend",
      amount: -cost,
      description,
      service,
    });
  } else {
    // Free operation — still track daily usage
    await db
      .update(usersTable)
      .set({ daily_usage_count: currentDailyUsage + 1 })
      .where(eq(usersTable.id, userId));
  }

  return {
    ok: true,
    creditsUsed: cost,
    monthlyRemaining: (monthly - deductFromMonthly),
    purchasedRemaining: (purchased - deductFromPurchased),
    total: (monthly - deductFromMonthly) + (purchased - deductFromPurchased),
  };
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

  await db
    .update(usersTable)
    .set({ monthly_credits: (user.monthly_credits ?? 0) + cost })
    .where(eq(usersTable.id, userId));

  await db.insert(creditTransactionsTable).values({
    userId,
    type: "earn",
    amount: cost,
    description: `استرداد تلقائي — ${reason}`,
    service,
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
