import { Router } from "express";
import { db } from "@workspace/db";
import { plansTable, usersTable, sitesTable, templatesTable, savedDesignsTable, userProviderKeysTable } from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.slug, user.plan)).limit(1);
  const allPlans = await db.select().from(plansTable).where(eq(plansTable.is_active, true)).orderBy(plansTable.sort_order);

  // Count real-time usage for limits
  const [sitesRow] = await db
    .select({ total: count() })
    .from(sitesTable)
    .where(eq(sitesTable.user_id, user.id));

  const [templatesRow] = await db
    .select({ total: count() })
    .from(templatesTable)
    .where(and(eq(templatesTable.userId, user.id), eq(templatesTable.isSystem, false)));

  const [designsRow] = await db
    .select({ total: count() })
    .from(savedDesignsTable)
    .where(eq(savedDesignsTable.user_id, user.id));

  const sitesUsed     = Number(sitesRow?.total ?? 0);
  const templatesUsed = Number(templatesRow?.total ?? 0);
  const designsUsed   = Number(designsRow?.total ?? 0);

  const monthlyCreditsUsed = plan
    ? Math.max(0, (plan.monthly_credits ?? 0) - (user.monthly_credits ?? 0))
    : 0;

  const [keyRecord] = await db
    .select({ id: userProviderKeysTable.id })
    .from(userProviderKeysTable)
    .where(and(eq(userProviderKeysTable.userId, user.id), eq(userProviderKeysTable.provider, "openrouter")))
    .limit(1);

  return res.json({
    currentPlan: user.plan,
    plan: plan ?? null,
    plan_mode: plan?.plan_mode ?? "platform",
    has_openrouter_key: !!keyRecord,
    usage: {
      // Sites
      sites_used:    sitesUsed,
      sites_limit:   plan?.max_sites ?? 0,
      // Templates
      templates_used:   templatesUsed,
      templates_limit:  plan?.max_templates ?? 3,
      // Saved Designs (DB-backed)
      saved_designs_used:  designsUsed,
      saved_designs_limit: plan?.max_saved_designs ?? 5,
      // Credits
      daily_usage:  user.daily_usage_count ?? 0,
      daily_limit:  plan?.rate_limit_daily ?? 50,
      // Legacy fields kept for backward compat
      monthly_credits:  user.monthly_credits ?? 0,
      purchased_credits: user.purchased_credits ?? 0,
      total_credits: (user.monthly_credits ?? 0) + (user.purchased_credits ?? 0),
      credits_reset_date: user.credits_reset_date,
      monthly_allocation: plan?.monthly_credits ?? 0,
    },
    credits: {
      monthly:    user.monthly_credits ?? 0,
      purchased:  user.purchased_credits ?? 0,
      total:      (user.monthly_credits ?? 0) + (user.purchased_credits ?? 0),
      reset_date: user.credits_reset_date,
      monthly_used: monthlyCreditsUsed,
    },
    features: {
      has_api_access:          plan?.has_api_access ?? false,
      has_telegram_bot:        plan?.has_telegram_bot ?? false,
      has_overlay_upload:      plan?.has_overlay_upload ?? false,
      has_custom_watermark:    plan?.has_custom_watermark ?? false,
      has_blog_automation:     plan?.has_blog_automation ?? false,
      has_image_generator:     plan?.has_image_generator ?? true,
      has_priority_processing: plan?.has_priority_processing ?? false,
      has_priority_support:    plan?.has_priority_support ?? false,
    },
    plans: allPlans,
  });
});

export default router;
