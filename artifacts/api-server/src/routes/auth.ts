import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { usersTable, plansTable } from "@workspace/db";
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
    imagesToday: user.imagesToday,
    credits: user.credits,
    articlesThisMonth: user.articlesThisMonth,
    emailVerified: user.emailVerified,
    phone: user.phone,
    planDetails: plan ? {
      cardsPerDay: plan.cardsPerDay,
      maxTemplates: plan.maxTemplates,
      maxSavedDesigns: plan.maxSavedDesigns,
      maxSites: plan.maxSites,
      articlesPerMonth: plan.articlesPerMonth,
      hasTelegramBot: plan.hasTelegramBot,
      hasBlogAutomation: plan.hasBlogAutomation,
      hasImageGenerator: plan.hasImageGenerator,
      apiAccess: plan.apiAccess,
      telegramBot: plan.telegramBot,
      overlayUpload: plan.overlayUpload,
      customWatermark: plan.customWatermark,
      credits: plan.credits,
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

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing) return res.status(409).json({ error: "Email already registered" });

  const passwordHash = await bcrypt.hash(password, 10);
  const apiKey = randomUUID().replace(/-/g, "");
  const botCode = Math.random().toString(36).substring(2, 10).toUpperCase();

  const [user] = await db.insert(usersTable).values({
    name,
    email,
    passwordHash,
    phone,
    plan: "free",
    credits: 10,
    apiKey,
    botCode,
  }).returning();

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

  // Reset daily counters if needed
  const now = new Date();
  const lastReset = user.imagesLastReset ? new Date(user.imagesLastReset) : null;
  if (lastReset && (now.getDate() !== lastReset.getDate() || now.getMonth() !== lastReset.getMonth())) {
    await db.update(usersTable).set({ imagesToday: 0, imagesLastReset: now }).where(eq(usersTable.id, user.id));
    user.imagesToday = 0;
  }

  const plan = await getPlan(user.plan);
  return res.json(formatUser(user, plan));
});

export default router;
