import { Router } from "express";
import { db } from "@workspace/db";
import { creditTransactionsTable, usersTable, plansTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.slug, user.plan)).limit(1);

  const history = await db.select().from(creditTransactionsTable)
    .where(eq(creditTransactionsTable.userId, user.id))
    .orderBy(desc(creditTransactionsTable.createdAt))
    .limit(50);

  return res.json({
    monthly_credits: user.monthly_credits ?? 0,
    purchased_credits: user.purchased_credits ?? 0,
    total: (user.monthly_credits ?? 0) + (user.purchased_credits ?? 0),
    reset_date: user.credits_reset_date,
    daily_usage: user.daily_usage_count ?? 0,
    daily_limit: plan?.rate_limit_daily ?? 50,
    history,
  });
});

export default router;
