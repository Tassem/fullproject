import { Router } from "express";
import { db } from "@workspace/db";
import { plansTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.slug, user.plan)).limit(1);
  const allPlans = await db.select().from(plansTable).where(eq(plansTable.isActive, true)).orderBy(plansTable.sortOrder);

  return res.json({
    currentPlan: user.plan,
    usage: {
      cardsToday: user.imagesToday ?? 0,
      cardsLimit: plan?.cardsPerDay ?? 5,
      articlesThisMonth: user.articlesThisMonth ?? 0,
      articlesLimit: plan?.articlesPerMonth ?? 0,
      sitesUsed: 0,
      sitesLimit: plan?.maxSites ?? 1,
      templates: 0,
      templatesLimit: plan?.maxTemplates ?? 3,
      savedDesigns: 0,
      savedDesignsLimit: plan?.maxSavedDesigns ?? 5,
      apiAccess: plan?.apiAccess ?? false,
      telegramBot: plan?.telegramBot ?? false,
      overlayUpload: plan?.overlayUpload ?? false,
      customWatermark: plan?.customWatermark ?? false,
      hasBlogAutomation: plan?.hasBlogAutomation ?? false,
      hasImageGenerator: plan?.hasImageGenerator ?? true,
      creditsBalance: user.credits ?? 0,
    },
    plans: allPlans,
  });
});

export default router;
