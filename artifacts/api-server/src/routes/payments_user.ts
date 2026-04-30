import { Router } from "express";
import { db } from "@workspace/db";
import { paymentRequestsTable, plansTable, usersTable, planAddonsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// POST /api/payments/request — submit payment proof
router.post("/request", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const body = req.body as Record<string, any>;
  // Accept both camelCase and snake_case field names (UpgradeModal sends snake_case)
  const resolvedType          = body.type || "plan_upgrade";
  const resolvedPlanId        = body.planId      ?? body.plan_id      ?? null;
  const resolvedAddonId       = body.addonId     ?? body.addon_id     ?? null;
  const resolvedPointsAmount  = body.pointsAmount ?? body.points_amount ?? null;
  const resolvedPaymentMethod = body.paymentMethod ?? body.payment_method ?? "";
  const resolvedProofDetails  = body.proofDetails ?? body.proof_details ?? body.proof_id ?? body.notes ?? "";

  if (!resolvedPaymentMethod || !resolvedProofDetails) {
    return res.status(400).json({ error: "payment_method and proof_details are required" });
  }

  // ── Duplicate guard: block if user already has a pending request for the same target ──
  const [existing] = await db
    .select({ id: paymentRequestsTable.id })
    .from(paymentRequestsTable)
    .where(and(
      eq(paymentRequestsTable.userId, user.id),
      eq(paymentRequestsTable.status, "pending"),
      eq(paymentRequestsTable.type, resolvedType),
      resolvedType === "plan_upgrade" && resolvedPlanId ? eq(paymentRequestsTable.planId, Number(resolvedPlanId)) : undefined,
      resolvedType === "addon_purchase" && resolvedAddonId ? eq(paymentRequestsTable.addonId as any, Number(resolvedAddonId)) : undefined,
      resolvedType === "points_purchase" ? eq(paymentRequestsTable.type, "points_purchase") : undefined,
    ))
    .limit(1);

  if (existing) {
    return res.status(409).json({
      error: "duplicate_pending",
      message: "You already have a pending payment request for this. Please wait for admin review.",
      existingId: existing.id,
    });
  }

  const [inserted] = await db.insert(paymentRequestsTable).values({
    userId: user.id,
    type: resolvedType,
    planId: resolvedPlanId,
    addonId: resolvedAddonId,
    pointsAmount: resolvedPointsAmount,
    paymentMethod: resolvedPaymentMethod,
    proofDetails: resolvedProofDetails,
    status: "pending",
  } as any).returning();

  return res.status(201).json(inserted);
});

// GET /api/payments/my-requests
router.get("/my-requests", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;

  const requests = await db
    .select({
      id: paymentRequestsTable.id,
      type: paymentRequestsTable.type,
      planId: paymentRequestsTable.planId,
      addonId: paymentRequestsTable.addonId,
      pointsAmount: paymentRequestsTable.pointsAmount,
      paymentMethod: paymentRequestsTable.paymentMethod,
      proofDetails: paymentRequestsTable.proofDetails,
      status: paymentRequestsTable.status,
      adminNotes: paymentRequestsTable.adminNotes,
      createdAt: paymentRequestsTable.createdAt,
      planName: plansTable.name,
      addonName: planAddonsTable.name,
      addonPrice: planAddonsTable.price,
    })
    .from(paymentRequestsTable)
    .leftJoin(plansTable, eq(paymentRequestsTable.planId, plansTable.id))
    .leftJoin(planAddonsTable, eq(paymentRequestsTable.addonId as any, planAddonsTable.id))
    .where(eq(paymentRequestsTable.userId, user.id))
    .orderBy(desc(paymentRequestsTable.createdAt));

  return res.json(requests);
});

export default router;
