import { Router } from "express";
import { db } from "@workspace/db";
import { subscriptionsTable, plansTable, pointsWalletTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// GET /api/billing/status
router.get("/status", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;

  const [planRow] = await db.select().from(plansTable).where(eq(plansTable.slug, user.plan)).limit(1);

  const [wallet] = await db.select().from(pointsWalletTable).where(eq(pointsWalletTable.userId, user.id)).limit(1);
  const pointsBalance = wallet?.balance ?? 0;

  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, user.id)).limit(1);

  const plan = planRow ?? {
    id: 0, name: "Free", slug: "free", priceMonthly: 0, priceYearly: 0,
    cardsPerDay: 5, maxTemplates: 3, maxSavedDesigns: 5, maxSites: 1,
    articlesPerMonth: 0, hasTelegramBot: false, hasBlogAutomation: false,
    hasImageGenerator: true, apiAccess: false, telegramBot: false,
    overlayUpload: false, customWatermark: false, credits: 0,
    isActive: true, sortOrder: 0, createdAt: new Date(),
  };

  const articlesUsed = sub?.articlesUsedThisPeriod ?? user.articlesThisMonth ?? 0;
  const articlesMax = plan.articlesPerMonth ?? 0;
  const sitesUsed = sub?.sitesUsed ?? 0;
  const sitesMax = plan.maxSites ?? 1;

  const pct = (used: number, max: number) => (max === 0 ? 0 : Math.round((used / max) * 100));

  return res.json({
    plan: {
      id: plan.id,
      name: plan.slug,
      displayName: plan.name,
      priceMonthly: plan.priceMonthly,
      priceYearly: plan.priceYearly,
      cardsPerDay: plan.cardsPerDay,
      maxSites: sitesMax,
      articlesPerMonth: articlesMax,
      hasTelegramBot: plan.hasTelegramBot,
      hasBlogAutomation: plan.hasBlogAutomation,
      hasImageGenerator: plan.hasImageGenerator,
      apiAccess: plan.apiAccess,
      overlayUpload: plan.overlayUpload,
      customWatermark: plan.customWatermark,
    },
    subscription: sub ? {
      id: sub.id,
      status: sub.status,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    } : null,
    usage: {
      articles: {
        used: articlesUsed,
        max: articlesMax,
        unlimited: articlesMax === 0,
        percentage: articlesMax === 0 ? 0 : pct(articlesUsed, articlesMax),
      },
      sites: {
        used: sitesUsed,
        max: sitesMax,
        unlimited: sitesMax >= 999,
        percentage: sitesMax >= 999 ? 0 : pct(sitesUsed, sitesMax),
      },
      cards: {
        used: user.imagesToday ?? 0,
        max: plan.cardsPerDay,
        unlimited: plan.cardsPerDay >= 999,
        percentage: plan.cardsPerDay >= 999 ? 0 : pct(user.imagesToday ?? 0, plan.cardsPerDay),
      },
      credits: {
        balance: user.credits ?? 0,
        points: pointsBalance,
      },
    },
  });
});

// GET /api/billing/plans
router.get("/plans", async (_req, res) => {
  const plans = await db.select().from(plansTable).where(eq(plansTable.isActive, true));
  return res.json({ plans });
});

export default router;
