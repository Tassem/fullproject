import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { usersTable, plansTable, creditTransactionsTable, passwordResetTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, signRefreshToken, verifyRefreshToken, requireAuth } from "../lib/auth";
import { getSignupBonus } from "../lib/costService";
import { OAuth2Client } from "google-auth-library";
import { sendPasswordResetEmail, sendPasswordResetConfirmation } from "../lib/email";
import { getSetting } from "../lib/settings";
import rateLimit from "express-rate-limit";

const router = Router();

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-={}|;':",./<>?]).{8,}$/;
function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters";
  if (!PASSWORD_REGEX.test(pw)) return "Password must include uppercase, lowercase, number, and special character";
  return null;
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});

function formatUser(user: typeof usersTable.$inferSelect, plan: typeof plansTable.$inferSelect | null) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    plan: user.plan,
    apiKey: user.apiKey,
    botCode: user.botCode,
    isAdmin: user.isAdmin,
    emailVerified: user.emailVerified,
    authProvider: user.authProvider ?? (user.googleId ? "google" : "email"),
    avatarUrl: user.avatarUrl,
    phone: user.phone,
    credits: {
      monthly: user.monthly_credits ?? 0,
      purchased: user.purchased_credits ?? 0,
      total: (user.monthly_credits ?? 0) + (user.purchased_credits ?? 0),
      reset_date: user.credits_reset_date,
      daily_usage: user.daily_usage_count ?? 0,
    },
    monthly_credits: user.monthly_credits ?? 0,
    purchased_credits: user.purchased_credits ?? 0,
    total_credits: (user.monthly_credits ?? 0) + (user.purchased_credits ?? 0),

    planDetails: plan ? {
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
    } : null,
    createdAt: user.createdAt,
  };
}

async function getPlan(slug: string) {
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.slug, slug)).limit(1);
  return plan || null;
}

router.post("/register", authLimiter, async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required" });
  }

  const [existingEmail] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existingEmail) return res.status(409).json({ error: "Email already registered" });

  const [existingName] = await db.select().from(usersTable).where(eq(usersTable.name, name)).limit(1);
  if (existingName) return res.status(409).json({ error: "Name already taken" });

  const pwError = validatePassword(password);
  if (pwError) return res.status(400).json({ error: pwError });

  const passwordHash = await bcrypt.hash(password, 10);
  const apiKey = "key_" + randomUUID().replace(/-/g, "");
  const botCode = "NB-" + randomUUID().slice(0, 6).toUpperCase();

  const freePlan = await getPlan("free");
  const monthlyCredits = freePlan?.monthly_credits ?? 10;
  const signupBonus = await getSignupBonus();

  const [user] = await db.insert(usersTable).values({
    name,
    email,
    passwordHash,
    phone,
    plan: "free",
    monthly_credits: monthlyCredits,
    purchased_credits: signupBonus,
    credits_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    apiKey,
    botCode,
  }).returning();

  await db.insert(creditTransactionsTable).values([
    {
      userId: user.id,
      type: "earn",
      amount: monthlyCredits,
      description: `باقة ترحيبية — ${freePlan?.name || "Free"}`,
      service: "system",
    },
    {
      userId: user.id,
      type: "earn",
      amount: signupBonus,
      description: "مكافأة التسجيل — حساب جديد",
      service: "system",
    }
  ]);

  const plan = await getPlan(user.plan);
  const token = signToken({ userId: user.id, isAdmin: user.isAdmin });
  const refreshToken = signRefreshToken({ userId: user.id });

  return res.status(201).json({ token, refreshToken, user: formatUser(user, plan) });
});

router.post("/login", authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user || !user.passwordHash) return res.status(401).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const plan = await getPlan(user.plan);
  const token = signToken({ userId: user.id, isAdmin: user.isAdmin });
  const refreshToken = signRefreshToken({ userId: user.id });

  return res.json({ token, refreshToken, user: formatUser(user, plan) });
});

router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: "Google credential is required" });
    }

    const GOOGLE_CLIENT_ID = await getSetting("google_client_id") || process.env.GOOGLE_CLIENT_ID || "";
    if (!GOOGLE_CLIENT_ID) {
      return res.status(500).json({ error: "Google OAuth is not configured. Set the Client ID in Admin Settings." });
    }

    let payload;
    try {
      const ticket = await new OAuth2Client(GOOGLE_CLIENT_ID).verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (error) {
      console.error("Google token verification failed:", error);
      return res.status(401).json({ error: "Invalid Google token" });
    }

    if (!payload?.email) {
      return res.status(400).json({ error: "Invalid Google token payload" });
    }

    const { sub: googleId, email, name, picture } = payload;

    let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);

    if (user) {
      if (!user.googleId) {
        [user] = await db.update(usersTable).set({
          googleId,
          authProvider: user.passwordHash ? "both" : "google",
          emailVerified: true,
          avatarUrl: picture || user.avatarUrl,
          updatedAt: new Date(),
        }).where(eq(usersTable.id, user.id)).returning();
      }
    } else {
      const apiKey = "key_" + randomUUID().replace(/-/g, "");
      const botCode = "NB-" + randomUUID().slice(0, 6).toUpperCase();
      const freePlan = await getPlan("free");
      const monthlyCredits = freePlan?.monthly_credits ?? 10;
      const signupBonus = await getSignupBonus();

      [user] = await db.insert(usersTable).values({
        name: name || email.split("@")[0],
        email: email.toLowerCase(),
        googleId,
        authProvider: "google",
        emailVerified: true,
        avatarUrl: picture,
        passwordHash: null,
        plan: "free",
        monthly_credits: monthlyCredits,
        purchased_credits: signupBonus,
        credits_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        apiKey,
        botCode,
      }).returning();

      await db.insert(creditTransactionsTable).values([
        {
          userId: user.id,
          type: "earn",
          amount: monthlyCredits,
          description: `Welcome bonus — ${freePlan?.name || "Free"}`,
          service: "system",
        },
        {
          userId: user.id,
          type: "earn",
          amount: signupBonus,
          description: "Signup bonus — new account",
          service: "system",
        },
      ]);
    }

    const plan = await getPlan(user.plan);
    const token = signToken({ userId: user.id, isAdmin: user.isAdmin });
    const refreshToken = signRefreshToken({ userId: user.id });
    return res.json({ token, refreshToken, user: formatUser(user, plan) });
  } catch (error) {
    console.error("Google OAuth error:", error);
    res.status(500).json({ error: "Google authentication failed" });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken: rt } = req.body;
    if (!rt) return res.status(400).json({ error: "Refresh token is required" });

    const payload = verifyRefreshToken(rt);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);
    if (!user) return res.status(401).json({ error: "User not found" });

    const plan = await getPlan(user.plan);
    const newToken = signToken({ userId: user.id, isAdmin: user.isAdmin });
    const newRefreshToken = signRefreshToken({ userId: user.id });

    return res.json({ token: newToken, refreshToken: newRefreshToken, user: formatUser(user, plan) });
  } catch {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

router.post("/forgot-password", authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);

    if (!user) {
      return res.json({ message: "If an account exists with this email, you will receive a password reset link." });
    }

    if ((!user.authProvider || user.authProvider === "google") && !user.passwordHash) {
      // Return same generic message to avoid leaking that this is a Google-only account
      return res.json({ message: "If an account exists with this email, you will receive a password reset link." });
    }

    const resetToken = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db.update(passwordResetTokensTable)
      .set({ used: true })
      .where(eq(passwordResetTokensTable.userId, user.id));

    await db.insert(passwordResetTokensTable).values({
      userId: user.id,
      token: resetToken,
      expiresAt,
      used: false,
    });

    try {
      await sendPasswordResetEmail(user.email, user.name, resetToken);
    } catch (emailError) {
      console.error("Failed to send password reset email:", emailError);
      return res.status(500).json({ error: "Failed to send reset email. Please try again later." });
    }

    res.json({ message: "If an account exists with this email, you will receive a password reset link." });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "An error occurred. Please try again." });
  }
});

router.post("/reset-password", authLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: "Token and new password are required" });
    }
    const pwError = validatePassword(newPassword);
    if (pwError) return res.status(400).json({ error: pwError });

    const [resetRecord] = await db.select().from(passwordResetTokensTable)
      .where(eq(passwordResetTokensTable.token, token)).limit(1);

    if (!resetRecord) {
      return res.status(400).json({ error: "Invalid or expired reset link" });
    }
    if (new Date() > new Date(resetRecord.expiresAt)) {
      return res.status(400).json({ error: "Reset link has expired. Please request a new one." });
    }
    if (resetRecord.used) {
      return res.status(400).json({ error: "This reset link has already been used" });
    }

    const [user] = await db.select().from(usersTable)
      .where(eq(usersTable.id, resetRecord.userId)).limit(1);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await db.update(usersTable).set({
      passwordHash,
      authProvider: user.googleId ? "both" : "email",
      updatedAt: new Date(),
    }).where(eq(usersTable.id, user.id));

    await db.update(passwordResetTokensTable)
      .set({ used: true })
      .where(eq(passwordResetTokensTable.id, resetRecord.id));

    try {
      await sendPasswordResetConfirmation(user.email, user.name);
    } catch (emailError) {
      console.error("Failed to send confirmation email:", emailError);
    }

    res.json({ message: "Password has been reset successfully. You can now login with your new password." });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "An error occurred. Please try again." });
  }
});

router.get("/verify-reset-token/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const [resetRecord] = await db.select().from(passwordResetTokensTable)
      .where(eq(passwordResetTokensTable.token, token)).limit(1);

    if (!resetRecord) {
      return res.status(400).json({ valid: false, error: "Invalid reset link" });
    }
    if (new Date() > new Date(resetRecord.expiresAt)) {
      return res.status(400).json({ valid: false, error: "Reset link has expired" });
    }
    if (resetRecord.used) {
      return res.status(400).json({ valid: false, error: "This reset link has already been used" });
    }

    res.json({ valid: true });
  } catch (error) {
    console.error("Verify token error:", error);
    res.status(500).json({ valid: false, error: "An error occurred" });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const plan = await getPlan(user.plan);
  return res.json(formatUser(user, plan));
});

router.put("/me", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });

  await db.update(usersTable).set({ name }).where(eq(usersTable.id, user.id));
  const plan = await getPlan(user.plan);
  const [updatedUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
  return res.json(formatUser(updatedUser, plan));
});

export default router;
