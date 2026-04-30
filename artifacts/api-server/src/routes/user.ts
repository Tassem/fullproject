import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

/**
 * POST /api/user/change-password
 * Securely change the current user's password.
 */
router.post("/change-password", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Both current and new passwords are required" });
  }

  // 1. Verify length
  if (newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters long" });
  }

  // 2. Fetch fresh user data (to get current hash)
  const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
  if (!dbUser || !dbUser.passwordHash) {
    return res.status(500).json({ error: "User password hash not found" });
  }

  // 3. Compare with current password
  const isValid = await bcrypt.compare(currentPassword, dbUser.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }

  // 4. Hash and Save
  const salt = await bcrypt.genSalt(10);
  const newHash = await bcrypt.hash(newPassword, salt);

  await db.update(usersTable)
    .set({ passwordHash: newHash })
    .where(eq(usersTable.id, user.id));

  return res.json({ message: "Password changed successfully" });
});

/**
 * PUT /api/auth/me (Internal helper mapped to /api/user/update-profile)
 * Update profile name.
 */
router.put("/update-profile", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const { name } = req.body;

  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: "Valid name is required" });
  }

  await db.update(usersTable)
    .set({ name: name.trim() })
    .where(eq(usersTable.id, user.id));

  return res.json({ message: "Profile updated successfully" });
});

export default router;
