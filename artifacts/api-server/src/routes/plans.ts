import { Router } from "express";
import { db } from "@workspace/db";
import { plansTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/", async (_req, res) => {
  const plans = await db.select().from(plansTable).where(eq(plansTable.isActive, true)).orderBy(plansTable.sortOrder);
  return res.json(plans);
});

router.get("/subscription", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.slug, user.plan)).limit(1);
  return res.json({
    currentPlan: user.plan,
    limits: plan ? {
      cardsPerDay: plan.cardsPerDay,
      maxTemplates: plan.maxTemplates,
      maxSavedDesigns: plan.maxSavedDesigns,
      maxSites: plan.maxSites,
      articlesPerMonth: plan.articlesPerMonth,
      hasTelegramBot: plan.hasTelegramBot,
      hasBlogAutomation: plan.hasBlogAutomation,
      hasImageGenerator: plan.hasImageGenerator,
      apiAccess: plan.apiAccess,
      telegramBot: plan.telegramBot,
      overlayUpload: plan.overlayUpload,
      customWatermark: plan.customWatermark,
      credits: plan.credits,
    } : null,
    usage: {
      imagesToday: user.imagesToday,
      articlesThisMonth: user.articlesThisMonth,
      creditsBalance: user.credits,
    },
  });
});

export default router;
