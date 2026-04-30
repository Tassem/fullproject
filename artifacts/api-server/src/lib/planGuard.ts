/**
 * planGuard — Centralized plan enforcement layer.
 *
 * Use these helpers BEFORE any operation that is gated by the user's plan.
 * They all return a typed Result so callers can send a consistent HTTP 403/422.
 *
 * Consistent error envelope:
 *   { code: "PLAN_LIMIT_EXCEEDED" | "FEATURE_DISABLED", feature, message }
 */

import { db } from "@workspace/db";
import {
  usersTable, plansTable, sitesTable, templatesTable, savedDesignsTable,
  planAddonsTable, userAddonsTable,
} from "@workspace/db";
import { eq, and, count, isNull, or, gt } from "drizzle-orm";

// ── In-memory cache for effective limits (TTL: 60 s) ─────────────────────────
const CACHE_TTL_MS = 60_000;
const effectiveCache = new Map<number, { data: EffectiveLimits; ts: number }>();

/** Invalidate a user's cached effective limits immediately (call after addon changes). */
export function invalidateEffectiveLimitsCache(userId: number) {
  effectiveCache.delete(userId);
}

// ── Result types ──────────────────────────────────────────────────────────────

export type PlanGuardError = {
  ok: false;
  status: 403 | 422;
  body: {
    code: "PLAN_LIMIT_EXCEEDED" | "FEATURE_DISABLED";
    feature: string;
    message: string;
  };
};

export type PlanGuardOk = { ok: true };
export type PlanGuardResult = PlanGuardOk | PlanGuardError;

// ── Internal helpers ──────────────────────────────────────────────────────────

async function loadUserAndPlan(userId: number) {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!user) return null;

  const [plan] = await db
    .select()
    .from(plansTable)
    .where(eq(plansTable.slug, user.plan))
    .limit(1);

  return { user, plan: plan ?? null };
}

/**
 * Load all currently active non-expired addons for a user.
 * Expiration: isActive=true AND (expiresAt IS NULL OR expiresAt > NOW()).
 */
export async function getActiveUserAddons(userId: number) {
  const now = new Date();
  return db
    .select({
      type: planAddonsTable.type,
      feature_key: planAddonsTable.feature_key,
      limit_key: planAddonsTable.limit_key,
      limit_value: planAddonsTable.limit_value,
      userAddonId: userAddonsTable.id,
      expiresAt: userAddonsTable.expiresAt,
    })
    .from(userAddonsTable)
    .innerJoin(planAddonsTable, eq(userAddonsTable.addonId, planAddonsTable.id))
    .where(
      and(
        eq(userAddonsTable.userId, userId),
        eq(userAddonsTable.isActive, true),
        eq(planAddonsTable.is_active, true),
        or(isNull(userAddonsTable.expiresAt), gt(userAddonsTable.expiresAt, now))
      )
    );
}

import { PlanFeatures } from "@workspace/db";

export type EffectiveLimits = {
  max_sites: number | null;
  max_templates: number | null;
  max_saved_designs: number | null;
  rate_limit_daily: number | null;
  /** boolean features: ON via plan OR an active feature addon */
  features: Partial<PlanFeatures>;
  /** 'platform' = standard plan, 'byok' = user provides own API key */
  plan_mode: "platform" | "byok";
};

/**
 * Compute effective limits = plan values + active addon overrides.
 * Cached per-user for 60 seconds. Invalidate via invalidateEffectiveLimitsCache().
 */
export async function getEffectiveLimits(userId: number): Promise<EffectiveLimits | null> {
  const cached = effectiveCache.get(userId);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;

  const data = await loadUserAndPlan(userId);
  if (!data) return null;

  const { plan } = data;
  const addons = await getActiveUserAddons(userId);

  let max_sites: number | null = plan?.max_sites ?? null;
  let max_templates: number | null = plan?.max_templates ?? null;
  let max_saved_designs: number | null = plan?.max_saved_designs ?? null;
  let rate_limit_daily: number | null = plan?.rate_limit_daily ?? null;
  const features: Partial<PlanFeatures> = {};

  if (plan) {
    // Boolean features
    const booleanFlags = [
      "has_telegram_bot", "has_blog_automation", "has_image_generator",
      "has_api_access", "has_overlay_upload", "has_custom_watermark",
      "has_ai_image_generation", "has_priority_processing", "has_priority_support",
    ] as const;

    for (const f of booleanFlags) {
      features[f] = !!plan[f];
    }

    // Number features
    features.monthly_credits = plan.monthly_credits;
    features.max_sites = plan.max_sites;
    features.max_templates = plan.max_templates;
    features.max_saved_designs = plan.max_saved_designs;
    features.rate_limit_daily = plan.rate_limit_daily;
  }

  for (const addon of addons) {
    if (addon.type === "feature" && addon.feature_key) {
      // Explicitly set the feature to true if granted by an active addon
      (features as any)[addon.feature_key] = true;
    } else if (addon.type === "limit" && addon.limit_key && addon.limit_value) {
      switch (addon.limit_key) {
        case "max_sites":
          max_sites = max_sites === null ? addon.limit_value : max_sites + addon.limit_value; break;
        case "max_templates":
          max_templates = max_templates === null ? addon.limit_value : max_templates + addon.limit_value; break;
        case "max_saved_designs":
          max_saved_designs = max_saved_designs === null ? addon.limit_value : max_saved_designs + addon.limit_value; break;
        case "rate_limit_daily":
          rate_limit_daily = rate_limit_daily === null ? addon.limit_value : rate_limit_daily + addon.limit_value; break;
      }
    }
  }

  const plan_mode = (plan?.plan_mode === "byok" ? "byok" : "platform") as "platform" | "byok";
  const result: EffectiveLimits = { max_sites, max_templates, max_saved_designs, rate_limit_daily, features, plan_mode };
  effectiveCache.set(userId, { data: result, ts: Date.now() });
  return result;
}

function disabled(feature: string, planName: string): PlanGuardError {
  return {
    ok: false,
    status: 403,
    body: {
      code: "FEATURE_DISABLED",
      feature,
      message: `هذه الخاصية غير متاحة في باقتك الحالية (${planName}). يرجى الترقية.`,
    },
  };
}

function limitExceeded(
  feature: string,
  current: number,
  max: number
): PlanGuardError {
  return {
    ok: false,
    status: 422,
    body: {
      code: "PLAN_LIMIT_EXCEEDED",
      feature,
      message: `لقد وصلت للحد الأقصى المسموح به (${current}/${max}). يرجى الترقية لإضافة المزيد.`,
    },
  };
}

// ── Public Guards ─────────────────────────────────────────────────────────────

/**
 * Assert a boolean plan feature — also checks active feature addons.
 * e.g. assertFeature(userId, "has_ai_image_generation") → true if plan OR addon grants it.
 */
export async function assertFeature(
  userId: number,
  feature: string
): Promise<PlanGuardResult> {
  const limits = await getEffectiveLimits(userId);
  if (!limits) return { ok: false, status: 403, body: { code: "FEATURE_DISABLED", feature, message: "User not found" } };

  if (!limits.features[feature]) {
    const data = await loadUserAndPlan(userId);
    return disabled(feature, data?.plan?.name ?? "الباقة الحالية");
  }
  return { ok: true };
}

/**
 * Assert that the user has not exceeded effective max_sites (plan + limit addons).
 */
export async function assertSiteLimit(userId: number): Promise<PlanGuardResult> {
  const limits = await getEffectiveLimits(userId);
  if (!limits) return { ok: false, status: 403, body: { code: "PLAN_LIMIT_EXCEEDED", feature: "max_sites", message: "User not found" } };

  const maxSites = limits.max_sites;
  if (maxSites === null) return { ok: true };

  const [row] = await db
    .select({ total: count() })
    .from(sitesTable)
    .where(eq(sitesTable.user_id, userId));

  const current = Number(row?.total ?? 0);
  if (current >= maxSites) {
    return {
      ok: false,
      status: 422,
      body: {
        code: "PLAN_LIMIT_EXCEEDED",
        feature: "max_sites",
        message:
          maxSites === 0
            ? `باقتك الحالية لا تسمح بإضافة مواقع. يرجى الترقية.`
            : `لقد وصلت للحد الأقصى لعدد المواقع (${current}/${maxSites}). يرجى الترقية أو شراء إضافة لزيادة الحد.`,
      },
    };
  }
  return { ok: true };
}

/**
 * Assert that the user has not exceeded effective max_templates (plan + limit addons).
 */
export async function assertTemplateLimit(userId: number): Promise<PlanGuardResult> {
  const limits = await getEffectiveLimits(userId);
  if (!limits) return { ok: false, status: 403, body: { code: "PLAN_LIMIT_EXCEEDED", feature: "max_templates", message: "User not found" } };

  const maxTemplates = limits.max_templates;
  if (maxTemplates === null) return { ok: true };

  const [row] = await db
    .select({ total: count() })
    .from(templatesTable)
    .where(and(eq(templatesTable.userId, userId), eq(templatesTable.isSystem, false)));

  const current = Number(row?.total ?? 0);
  if (current >= maxTemplates) return limitExceeded("max_templates", current, maxTemplates);
  return { ok: true };
}

/**
 * Assert that the user has not exceeded effective max_saved_designs (plan + limit addons).
 */
export async function assertSavedDesignLimit(userId: number): Promise<PlanGuardResult> {
  const limits = await getEffectiveLimits(userId);
  if (!limits) return { ok: false, status: 403, body: { code: "PLAN_LIMIT_EXCEEDED", feature: "max_saved_designs", message: "User not found" } };

  const maxDesigns = limits.max_saved_designs;
  if (maxDesigns === null) return { ok: true };

  const [row] = await db
    .select({ total: count() })
    .from(savedDesignsTable)
    .where(eq(savedDesignsTable.user_id, userId));

  const current = Number(row?.total ?? 0);
  if (current >= maxDesigns) {
    return {
      ok: false,
      status: 422,
      body: {
        code: "PLAN_LIMIT_EXCEEDED",
        feature: "max_saved_designs",
        message: `لقد وصلت للحد الأقصى للتصاميم المحفوظة (${current}/${maxDesigns}). يرجى الترقية أو حذف تصاميم قديمة.`,
      },
    };
  }
  return { ok: true };
}

// ── TODO: Priority flags ───────────────────────────────────────────────────────

// TODO: has_priority_processing
// حالياً هذا الحقل علامة عرض فقط (display flag)
// عند إضافة Queue رسمية (Bull/Redis) يجب:
// - إضافة priority parameter عند إضافة job للـ queue
// - المستخدمون بـ has_priority_processing = true يحصلون على priority أعلى
// - الأولوية المقترحة: priority=1 للـ Pro/Business, priority=10 للباقات الأدنى

// TODO: has_priority_support
// حالياً هذا الحقل علامة عرض فقط
// عند ربط نظام دعم (Intercom/Crisp/Freshdesk):
// - ضع tag أو attribute على المستخدم يدل على أولوية الدعم
// - أو وجّهه لقناة دعم مختلفة

// ── Convenience: send the error response from a PlanGuardError ────────────────
/**
 * Usage:  const g = await assertSiteLimit(user.id);
 *         if (!g.ok) return rejectGuard(res, g);
 */
export function rejectGuard(res: any, guard: PlanGuardError): void {
  res.status(guard.status).json(guard.body);
}
