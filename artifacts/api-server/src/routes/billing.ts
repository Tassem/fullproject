import { Router } from "express";
import { db } from "@workspace/db";
import { subscriptionsTable, plansTable, usersTable, userProviderKeysTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { getEffectiveLimits } from "../lib/planGuard";

const router = Router();

router.get("/status", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;

  const [planRow] = await db.select().from(plansTable).where(eq(plansTable.slug, user.plan)).limit(1);
  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, user.id)).limit(1);

  const plan = planRow ?? null;
  const sitesUsed = sub?.sitesUsed ?? 0;

  // Use getEffectiveLimits — the single source of truth for plan + addon overrides
  const effective = await getEffectiveLimits(user.id);
  const effectiveMaxSites = effective?.max_sites ?? plan?.max_sites ?? 1;
  const effectiveRateLimit = effective?.rate_limit_daily ?? plan?.rate_limit_daily ?? 50;

  const pct = (used: number, max: number) => (max === 0 ? 0 : Math.round((used / max) * 100));

  const [keyRecord] = await db
    .select({ id: userProviderKeysTable.id })
    .from(userProviderKeysTable)
    .where(and(eq(userProviderKeysTable.userId, user.id), eq(userProviderKeysTable.provider, "openrouter")))
    .limit(1);

  return res.json({
    plan: plan ? {
      id: plan.id,
      name: plan.slug,
      displayName: plan.name,
      price_monthly: plan.price_monthly,
      price_yearly: plan.price_yearly,
      monthly_credits: plan.monthly_credits,
      // raw plan limits
      max_sites: plan.max_sites,
      has_telegram_bot: plan.has_telegram_bot,
      has_blog_automation: plan.has_blog_automation,
      has_image_generator: plan.has_image_generator,
      has_api_access: plan.has_api_access,
      has_overlay_upload: plan.has_overlay_upload,
      has_custom_watermark: plan.has_custom_watermark,
      has_ai_image_generation: plan.has_ai_image_generation,
      rate_limit_daily: plan.rate_limit_daily,
      plan_mode: plan.plan_mode ?? "platform",
    } : null,
    has_openrouter_key: !!keyRecord,
    // effective = plan + addons merged — use this for UI display and enforcement
    effective: {
      max_sites: effectiveMaxSites,
      max_templates: effective?.max_templates ?? plan?.max_templates ?? null,
      max_saved_designs: effective?.max_saved_designs ?? plan?.max_saved_designs ?? null,
      rate_limit_daily: effectiveRateLimit,
      has_ai_image_generation: !!effective?.features?.has_ai_image_generation || !!plan?.has_ai_image_generation,
      ...(effective?.features ?? {}),
    },
    subscription: sub ? {
      id: sub.id,
      status: sub.status,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    } : null,
    usage: {
      credits: {
        monthly: user.monthly_credits ?? 0,
        purchased: user.purchased_credits ?? 0,
        total: (user.monthly_credits ?? 0) + (user.purchased_credits ?? 0),
        reset_date: user.credits_reset_date,
        daily_usage: user.daily_usage_count ?? 0,
        daily_limit: effectiveRateLimit,
      },
      sites: {
        used: sitesUsed,
        max: effectiveMaxSites,
        percentage: effectiveMaxSites > 0 ? pct(sitesUsed, effectiveMaxSites) : 0,
      },
    },
  });
});

router.get("/plans", async (_req, res) => {
  const plans = await db.select().from(plansTable).where(eq(plansTable.is_active, true));
  return res.json({ plans });
});

export default router;
