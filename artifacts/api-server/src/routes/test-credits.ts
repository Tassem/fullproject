import { Router } from "express";
import { db, usersTable, creditTransactionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { deductCredits, restoreCredits } from "../lib/credits";

const router = Router();

/**
 * Diagnostic route to test credit logic safely.
 * Only accessible by admins for security.
 */
router.post("/run-suite", requireAuth, async (req, res) => {
  const admin = (req as any).user;
  if (!admin.isAdmin) return res.status(403).json({ error: "Admin only" });

  const results: any[] = [];
  
  try {
    // 1. Create a temporary test user
    const testEmail = `test-${Date.now()}@example.com`;
    const [testUser] = await db.insert(usersTable).values({
      name: "Test User",
      email: testEmail,
      passwordHash: "xxx",
      plan: "free",
      monthly_credits: 10,
      purchased_credits: 5,
    }).returning();

    results.push({ step: "setup", message: "Created test user", monthly: 10, purchased: 5 });

    // Test 1: Simple deduction (takes from monthly)
    const d1 = await deductCredits(testUser.id, 3, "image_generator", "has_image_generator", "Test 1: Simple");
    results.push({ step: "deduct_3", ok: d1.ok, monthly: d1.ok ? d1.monthlyRemaining : null, purchased: d1.ok ? d1.purchasedRemaining : null });

    // Test 2: Split deduction (takes rest of monthly + some purchased)
    const d2 = await deductCredits(testUser.id, 10, "image_generator", "has_image_generator", "Test 2: Split");
    results.push({ step: "deduct_10", ok: d2.ok, monthly: d2.ok ? d2.monthlyRemaining : null, purchased: d2.ok ? d2.purchasedRemaining : null });

    // Test 3: Restore logic (should restore to purchased if monthly is full, but here monthly is empty)
    // Current state: Monthly 0, Purchased 2 (Initial 5 - 3 = 2)
    // Let's restore 5. Should go to monthly.
    await restoreCredits(testUser.id, 5, "image_generator", "Test Restore");
    const [u3] = await db.select().from(usersTable).where(eq(usersTable.id, testUser.id)).limit(1);
    results.push({ step: "restore_5", monthly: u3.monthly_credits, purchased: u3.purchased_credits });

    // Test 4: Restore Overflow (Monthly is 5/10. Restore 10. 5 should go to monthly, 5 to purchased)
    await restoreCredits(testUser.id, 10, "image_generator", "Test Overflow");
    const [u4] = await db.select().from(usersTable).where(eq(usersTable.id, testUser.id)).limit(1);
    results.push({ step: "restore_10_overflow", monthly: u4.monthly_credits, purchased: u4.purchased_credits });

    // Cleanup
    await db.delete(creditTransactionsTable).where(eq(creditTransactionsTable.userId, testUser.id));
    await db.delete(usersTable).where(eq(usersTable.id, testUser.id));

    return res.json({ success: true, results });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
