import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { usersTable, plansTable, creditTransactionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, requireAuth } from "../lib/auth";

const router = Router();

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
    phone: user.phone,
    credits: {
      monthly: user.monthly_credits ?? 0,
      purchased: user.purchased_credits ?? 0,
      total: (user.monthly_credits ?? 0) + (user.purchased_credits ?? 0),
      reset_date: user.credits_reset_date,
      daily_usage: user.daily_usage_count ?? 0,
    },
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

router.post("/register", async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required" });
  }

  const [existingEmail] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existingEmail) return res.status(409).json({ error: "Email already registered" });

  const [existingName] = await db.select().from(usersTable).where(eq(usersTable.name, name)).limit(1);
  if (existingName) return res.status(409).json({ error: "Name already taken" });

  const passwordHash = await bcrypt.hash(password, 10);
  const apiKey = "key_" + randomUUID().replace(/-/g, "");
  const botCode = "NB-" + Math.random().toString(36).substring(2, 8).toUpperCase();

  // New users start on free plan with 30 purchased credits (welcome bonus)
  const [user] = await db.insert(usersTable).values({
    name,
    email,
    passwordHash,
    phone,
    plan: "free",
    purchased_credits: 30,
    apiKey,
    botCode,
  }).returning();

  await db.insert(creditTransactionsTable).values({
    userId: user.id,
    type: "earn",
    amount: 30,
    description: "مكافأة الترحيب — حساب جديد",
    service: "system",
  });

  const plan = await getPlan(user.plan);
  const token = signToken({ userId: user.id, isAdmin: user.isAdmin });

  return res.status(201).json({ token, user: formatUser(user, plan) });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user || !user.passwordHash) return res.status(401).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const plan = await getPlan(user.plan);
  const token = signToken({ userId: user.id, isAdmin: user.isAdmin });

  return res.json({ token, user: formatUser(user, plan) });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const plan = await getPlan(user.plan);
  return res.json(formatUser(user, plan));
});

export default router;
