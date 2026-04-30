/**
 * Shared types for plan features across Frontend and Backend.
 */

export interface PlanFeatures {
  monthly_credits: number;
  max_sites: number;
  max_templates: number;
  max_saved_designs: number;
  has_blog_automation: boolean;
  has_image_generator: boolean;
  has_telegram_bot: boolean;
  has_api_access: boolean;
  has_ai_image_generation: boolean;
  has_overlay_upload: boolean;
  has_custom_watermark: boolean;
  has_priority_processing: boolean;
  has_priority_support: boolean;
  rate_limit_daily: number;
  rate_limit_hourly: number;
}

export type PlanSlug = "free" | "pro" | "business";

export interface PlanGuardErrorBody {
  error: "FEATURE_DISABLED" | "PLAN_LIMIT_EXCEEDED";
  feature: keyof PlanFeatures;
  message: string;
  requiredPlan?: PlanSlug;
  currentPlan?: PlanSlug;
  upgradeUrl: string;
}
