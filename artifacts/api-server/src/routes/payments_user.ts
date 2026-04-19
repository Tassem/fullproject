import { Router } from "express";
import { db } from "@workspace/db";
import { paymentRequestsTable, plansTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// POST /api/payments/request — submit payment proof
router.post("/request", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const body = req.body as Record<string, any>;
  // Accept both camelCase and snake_case field names (UpgradeModal sends snake_case)
  const resolvedType         = body.type || "plan_upgrade";
  const resolvedPlanId       = body.planId      ?? body.plan_id      ?? null;
  const resolvedPointsAmount = body.pointsAmount ?? body.points_amount ?? null;
  const resolvedPaymentMethod = body.paymentMethod ?? body.payment_method ?? "";
  const resolvedProofDetails  = body.proofDetails ?? body.proof_details ?? body.proof_id ?? body.notes ?? "";

  if (!resolvedPaymentMethod || !resolvedProofDetails) {
    return res.status(400).json({ error: "payment_method and proof_details are required" });
  }

  const [inserted] = await db.insert(paymentRequestsTable).values({
    userId: user.id,
    type: resolvedType,
    planId: resolvedPlanId,
    pointsAmount: resolvedPointsAmount,
    paymentMethod: resolvedPaymentMethod,
    proofDetails: resolvedProofDetails,
    status: "pending",
  }).returning();

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
      pointsAmount: paymentRequestsTable.pointsAmount,
      paymentMethod: paymentRequestsTable.paymentMethod,
      proofDetails: paymentRequestsTable.proofDetails,
      status: paymentRequestsTable.status,
      adminNotes: paymentRequestsTable.adminNotes,
      createdAt: paymentRequestsTable.createdAt,
      planName: plansTable.name,
    })
    .from(paymentRequestsTable)
    .leftJoin(plansTable, eq(paymentRequestsTable.planId, plansTable.id))
    .where(eq(paymentRequestsTable.userId, user.id))
    .orderBy(desc(paymentRequestsTable.createdAt));

  return res.json(requests);
});

export default router;
