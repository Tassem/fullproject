import { Router } from "express";
import { db } from "@workspace/db";
import {
  planAddonsTable, userAddonsTable, usersTable,
  paymentRequestsTable, creditTransactionsTable, plansTable,
} from "@workspace/db";
import { eq, and, desc, isNull, or, gt } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { getActiveUserAddons, getEffectiveLimits, invalidateEffectiveLimitsCache } from "../lib/planGuard";

const router = Router();

// ── GET /api/addons ── available addons for users to browse ──────────────────
router.get("/", async (_req, res) => {
  const addons = await db
    .select()
    .from(planAddonsTable)
    .where(eq(planAddonsTable.is_active, true))
    .orderBy(planAddonsTable.id);
  return res.json({ addons });
});

// ── GET /api/addons/mine ── user's active addons ──────────────────────────────
router.get("/mine", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;

  const rows = await db
    .select({
      id: userAddonsTable.id,
      addonId: userAddonsTable.addonId,
      purchasedAt: userAddonsTable.purchasedAt,
      expiresAt: userAddonsTable.expiresAt,
      isActive: userAddonsTable.isActive,
      name: planAddonsTable.name,
      slug: planAddonsTable.slug,
      type: planAddonsTable.type,
      credits_amount: planAddonsTable.credits_amount,
      feature_key: planAddonsTable.feature_key,
      limit_key: planAddonsTable.limit_key,
      limit_value: planAddonsTable.limit_value,
      price: planAddonsTable.price,
      is_recurring: planAddonsTable.is_recurring,
    })
    .from(userAddonsTable)
    .innerJoin(planAddonsTable, eq(userAddonsTable.addonId, planAddonsTable.id))
    .where(
      and(
        eq(userAddonsTable.userId, user.id),
        eq(userAddonsTable.isActive, true)
      )
    )
    .orderBy(desc(userAddonsTable.purchasedAt));

  return res.json({ addons: rows });
});

// ── POST /api/addons/purchase ── submit addon payment request ─────────────────
router.post("/purchase", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const { addonId, paymentMethod, proofDetails } = req.body as {
    addonId: number;
    paymentMethod: string;
    proofDetails: string;
  };

  if (!addonId || !paymentMethod || !proofDetails) {
    return res.status(400).json({ error: "addonId, paymentMethod, and proofDetails are required" });
  }

  const [addon] = await db
    .select()
    .from(planAddonsTable)
    .where(and(eq(planAddonsTable.id, addonId), eq(planAddonsTable.is_active, true)))
    .limit(1);

  if (!addon) return res.status(404).json({ error: "Addon not found" });

  // Duplicate guard: block if user already has a pending request for this addon
  const [existing] = await db
    .select({ id: paymentRequestsTable.id })
    .from(paymentRequestsTable)
    .where(
      and(
        eq(paymentRequestsTable.userId, user.id),
        eq(paymentRequestsTable.addonId as any, addonId),
        eq(paymentRequestsTable.status, "pending")
      )
    )
    .limit(1);

  if (existing) {
    return res.status(409).json({
      error: "duplicate_pending",
      message: "You already have a pending payment request for this addon.",
    });
  }

  // Also check if user already has this addon active (non-recurring)
  if (!addon.is_recurring) {
    const [activeAddon] = await db
      .select({ id: userAddonsTable.id })
      .from(userAddonsTable)
      .where(
        and(
          eq(userAddonsTable.userId, user.id),
          eq(userAddonsTable.addonId, addonId),
          eq(userAddonsTable.isActive, true)
        )
      )
      .limit(1);

    if (activeAddon) {
      return res.status(409).json({ error: "already_active", message: "You already have this addon active." });
    }
  }

  const [inserted] = await db
    .insert(paymentRequestsTable)
    .values({
      userId: user.id,
      type: "addon_purchase",
      addonId,
      planId: null,
      pointsAmount: null,
      paymentMethod,
      proofDetails,
      status: "pending",
    } as any)
    .returning();

  return res.status(201).json(inserted);
});

// ── DELETE /api/addons/mine/:userAddonId ── cancel a recurring addon ──────────
router.delete("/mine/:userAddonId", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const userAddonId = parseInt(req.params.userAddonId, 10);

  const [row] = await db
    .select()
    .from(userAddonsTable)
    .where(
      and(
        eq(userAddonsTable.id, userAddonId),
        eq(userAddonsTable.userId, user.id),
        eq(userAddonsTable.isActive, true)
      )
    )
    .limit(1);

  if (!row) return res.status(404).json({ error: "Active addon not found" });

  await db
    .update(userAddonsTable)
    .set({ isActive: false })
    .where(eq(userAddonsTable.id, userAddonId));

  invalidateEffectiveLimitsCache(user.id);
  return res.json({ success: true });
});

// ── GET /api/addons/effective-plan ── full effective plan for the current user ──
router.get("/effective-plan", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;

  const [planRow] = await db
    .select()
    .from(plansTable)
    .where(eq(plansTable.slug, user.plan))
    .limit(1);

  const now = new Date();
  const activeAddons = await db
    .select({
      id: userAddonsTable.id,
      addonId: userAddonsTable.addonId,
      name: planAddonsTable.name,
      slug: planAddonsTable.slug,
      type: planAddonsTable.type,
      feature_key: planAddonsTable.feature_key,
      limit_key: planAddonsTable.limit_key,
      limit_value: planAddonsTable.limit_value,
      expiresAt: userAddonsTable.expiresAt,
      purchasedAt: userAddonsTable.purchasedAt,
      is_recurring: planAddonsTable.is_recurring,
    })
    .from(userAddonsTable)
    .innerJoin(planAddonsTable, eq(userAddonsTable.addonId, planAddonsTable.id))
    .where(
      and(
        eq(userAddonsTable.userId, user.id),
        eq(userAddonsTable.isActive, true),
        eq(planAddonsTable.is_active, true),
        or(isNull(userAddonsTable.expiresAt), gt(userAddonsTable.expiresAt, now))
      )
    );

  const effective = await getEffectiveLimits(user.id);

  return res.json({
    plan: user.plan,
    effective: effective
      ? {
          max_sites: effective.max_sites,
          max_templates: effective.max_templates,
          max_saved_designs: effective.max_saved_designs,
          rate_limit_daily: effective.rate_limit_daily,
          ...effective.features,
        }
      : null,
    active_addons: activeAddons.map((a) => ({
      id: a.id,
      name: a.name,
      slug: a.slug,
      type: a.type,
      feature_key: a.feature_key,
      limit_key: a.limit_key,
      limit_value: a.limit_value,
      is_recurring: a.is_recurring,
      purchased_at: a.purchasedAt,
      expires_at: a.expiresAt,
    })),
    plan_details: planRow
      ? {
          name: planRow.name,
          max_sites: planRow.max_sites,
          max_templates: planRow.max_templates,
          max_saved_designs: planRow.max_saved_designs,
          rate_limit_daily: planRow.rate_limit_daily,
          has_telegram_bot: planRow.has_telegram_bot,
          has_blog_automation: planRow.has_blog_automation,
          has_image_generator: planRow.has_image_generator,
          has_api_access: planRow.has_api_access,
          has_overlay_upload: planRow.has_overlay_upload,
          has_custom_watermark: planRow.has_custom_watermark,
          has_ai_image_generation: planRow.has_ai_image_generation,
        }
      : null,
  });
});

export default router;
