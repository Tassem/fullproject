import { Request, Response, NextFunction } from "express";
import { getEffectiveLimits, assertSiteLimit } from "./planGuard";
import { PlanFeatures, PlanSlug } from "@workspace/db"; 

/**
 * Centralized map defining the minimum plan required for each feature.
 */
const FEATURE_REQUIRED_PLAN: Partial<Record<keyof PlanFeatures, PlanSlug>> = {
  has_blog_automation: "pro",
  has_image_generator: "free",
  has_telegram_bot: "business",
  has_api_access: "business",
  has_ai_image_generation: "pro",
  has_overlay_upload: "pro",
  has_custom_watermark: "pro",
  has_priority_processing: "pro",
  has_priority_support: "pro",
};

/**
 * Middleware to enforce a specific boolean plan feature.
 * Admin users bypass all checks.
 */
export function requireFeature(feature: keyof PlanFeatures) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // Admins bypass all feature gating
    if (user.isAdmin) return next();

    const limits = await getEffectiveLimits(user.id);
    
    // Pure Type-safe check
    if (!limits || !limits.features[feature]) {
      const requiredPlan = FEATURE_REQUIRED_PLAN[feature] || "pro";
      
      return res.status(403).json({
        error: "FEATURE_DISABLED",
        feature,
        message: "هذه الميزة غير متاحة في خطتك الحالية. يرجى الترقية للوصول إليها.",
        requiredPlan,
        currentPlan: user.plan,
        upgradeUrl: "/billing"
      });
    }

    return next();
  };
}

/**
 * Middleware to enforce site creation limits.
 */
export async function requireSiteLimit(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  if (user.isAdmin) return next();

  const guard = await assertSiteLimit(user.id);
  if (!guard.ok) {
    return res.status(guard.status).json({
      ...guard.body,
      upgradeUrl: "/billing"
    });
  }

  return next();
}
