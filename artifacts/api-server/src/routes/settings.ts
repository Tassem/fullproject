import { Router } from "express";
import { db } from "@workspace/db";
import { systemSettingsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin, requireAuth } from "../lib/auth";

const router = Router();

router.get("/public", async (_req, res) => {
  const settings = await db.select().from(systemSettingsTable);
  const map = Object.fromEntries(settings.map(s => [s.key, s.value]));
  return res.json({
    site_name: map["site_name"] || "MediaFlow",
    site_logo: map["site_logo"] || null,
    googleClientId: map["google_client_id"] || null,
  });
});

router.get("/", requireAdmin, async (_req, res) => {
  const settings = await db.select().from(systemSettingsTable);
  return res.json(settings);
});

router.put("/", requireAdmin, async (req, res) => {
  const { settings } = req.body;
  if (!Array.isArray(settings)) return res.status(400).json({ error: "settings must be an array" });

  const updated = [];
  for (const { key, value } of settings) {
    const [existing] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, key)).limit(1);
    if (existing) {
      const [u] = await db.update(systemSettingsTable).set({ value, updatedAt: new Date() }).where(eq(systemSettingsTable.key, key)).returning();
      updated.push(u);
    } else {
      const [u] = await db.insert(systemSettingsTable).values({ key, value }).returning();
      updated.push(u);
    }
  }

  return res.json(updated);
});

// ── /api/settings/telegram ────────────────────────────────────────────────────

async function verifyTelegramToken(token: string): Promise<{ ok: boolean; username?: string; error?: string }> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await r.json() as { ok: boolean; result?: { username?: string }; description?: string };
    if (data.ok) return { ok: true, username: data.result?.username };
    return { ok: false, error: data.description ?? "Invalid token" };
  } catch {
    return { ok: false, error: "Network error verifying token" };
  }
}

// GET /api/settings/telegram
router.get("/telegram", requireAuth, async (_req, res) => {
  const envToken = process.env.TELEGRAM_BOT_TOKEN;
  const [dbRow] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "telegram_bot_token")).limit(1);
  const dbToken = dbRow?.value ?? null;

  const activeToken = envToken || dbToken;
  const tokenSource: "env" | "db" | "none" = envToken ? "env" : dbToken ? "db" : "none";

  if (!activeToken) {
    return res.json({ connected: false, hasToken: false, botUsername: null, tokenSource: "none", tokenMasked: null });
  }

  const info = await verifyTelegramToken(activeToken);
  const masked = activeToken.length > 10 ? `${activeToken.slice(0, 6)}...${activeToken.slice(-4)}` : "****";

  return res.json({
    connected: info.ok,
    hasToken: true,
    botUsername: info.ok ? (info.username ?? null) : null,
    tokenSource,
    tokenMasked: masked,
  });
});

// PUT /api/settings/telegram — admin only
router.put("/telegram", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  if (!user.isAdmin) return res.status(403).json({ error: "Admin only" });

  const { token } = req.body as { token?: string };
  if (!token?.trim()) return res.status(400).json({ error: "Token is required" });

  // Always save the token — just report verification status, never block saving
  const info = await verifyTelegramToken(token.trim());

  const [existing] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "telegram_bot_token")).limit(1);
  if (existing) {
    await db.update(systemSettingsTable).set({ value: token.trim() }).where(eq(systemSettingsTable.key, "telegram_bot_token"));
  } else {
    await db.insert(systemSettingsTable).values({ key: "telegram_bot_token", value: token.trim() });
  }

  return res.json({ success: true, connected: info.ok, botUsername: info.ok ? info.username : null, warning: info.ok ? undefined : info.error });
});

// DELETE /api/settings/telegram — admin only
router.delete("/telegram", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  if (!user.isAdmin) return res.status(403).json({ error: "Admin only" });

  await db.delete(systemSettingsTable).where(eq(systemSettingsTable.key, "telegram_bot_token"));
  return res.json({ success: true });
});

export default router;
