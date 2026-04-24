import { Router } from "express";
import { db } from "@workspace/db";
import { plansTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/", async (_req, res) => {
  const plans = await db.select().from(plansTable)
    .where(eq(plansTable.is_active, true))
    .orderBy(plansTable.sort_order);
  return res.json(plans);
});

router.get("/subscription", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.slug, user.plan)).limit(1);
  return res.json({
    currentPlan: user.plan,
    limits: plan ? {
      monthly_credits: plan.monthly_credits,
      max_sites: plan.max_sites,
      max_templates: plan.max_templates,
      max_saved_designs: plan.max_saved_designs,
      has_blog_automation: plan.has_blog_automation,
      has_image_generator: plan.has_image_generator,
      has_telegram_bot: plan.has_telegram_bot,
      has_api_access: plan.has_api_access,
      has_overlay_upload: plan.has_overlay_upload,
      has_custom_watermark: plan.has_custom_watermark,
      has_priority_processing: plan.has_priority_processing,
      has_priority_support: plan.has_priority_support,
      rate_limit_daily: plan.rate_limit_daily,
      price_monthly: plan.price_monthly,
      price_yearly: plan.price_yearly,
    } : null,
    credits: {
      monthly: user.monthly_credits ?? 0,
      purchased: user.purchased_credits ?? 0,
      total: (user.monthly_credits ?? 0) + (user.purchased_credits ?? 0),
      reset_date: user.credits_reset_date,
      daily_usage: user.daily_usage_count ?? 0,
      daily_limit: plan?.rate_limit_daily ?? 50,
    },
  });
});

export default router;
