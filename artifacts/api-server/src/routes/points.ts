import { Router } from "express";
import { db } from "@workspace/db";
import { creditTransactionsTable, usersTable, systemSettingsTable, plansTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

async function getSetting(key: string, fallback: string): Promise<string> {
  const [row] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, key)).limit(1);
  return row?.value ?? fallback;
}

router.get("/", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.slug, user.plan)).limit(1);

  const transactions = await db.select().from(creditTransactionsTable)
    .where(eq(creditTransactionsTable.userId, user.id))
    .orderBy(desc(creditTransactionsTable.createdAt))
    .limit(100);

  const burnPerCard    = parseInt(await getSetting("points_burn_per_card",    "1"));
  const burnPerArticle = parseInt(await getSetting("points_burn_per_article", "5"));

  return res.json({
    monthly_credits: user.monthly_credits ?? 0,
    purchased_credits: user.purchased_credits ?? 0,
    balance: (user.monthly_credits ?? 0) + (user.purchased_credits ?? 0),
    reset_date: user.credits_reset_date,
    daily_usage: user.daily_usage_count ?? 0,
    daily_limit: plan?.rate_limit_daily ?? 50,
    transactions,
    rates: { card: burnPerCard, article: burnPerArticle },
    plan_monthly_allocation: plan?.monthly_credits ?? 0,
  });
});

export default router;
