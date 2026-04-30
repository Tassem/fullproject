import { Router } from "express";
import { db } from "@workspace/db";
import { systemSettingsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";
import { getAllPointCosts } from "../lib/costService";
import { sendTestEmail } from "../lib/email";

const router = Router();

router.get("/public", async (_req, res) => {
  const settings = await db.select().from(systemSettingsTable);
  const map = Object.fromEntries(settings.map(s => [s.key, s.value]));
  return res.json({
    site_name: map["site_name"] || "MediaFlow",
    site_logo: map["site_logo"] || null,
    googleClientId: map["google_client_id"] || null,
    aiCostPerGen: parseInt(map["ai_image_cost_per_generation"] || "2", 10),
    card_generation_base_cost: parseInt(map["card_generation_base_cost"] || "1", 10),
    aiServiceStatus: map["ai_image_service_status"] || "operational",
    aiServiceMessage: map["ai_image_service_status_message"] || "Image generation service is currently unavailable.",
  });
});

// GET /api/settings/point-costs
// Returns all point costs for frontend consumption
router.get("/point-costs", async (req, res) => {
  try {
    const costs = await getAllPointCosts();
    res.json({ success: true, data: costs });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch costs" });
  }
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
router.get("/telegram", requireAdmin, async (_req, res) => {
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
router.put("/telegram", requireAdmin, async (req, res) => {
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
router.delete("/telegram", requireAdmin, async (_req, res) => {

  await db.delete(systemSettingsTable).where(eq(systemSettingsTable.key, "telegram_bot_token"));
  return res.json({ success: true });
});

// ── /api/settings/google ────────────────────────────────────────────────────

// GET /api/settings/google
router.get("/google", requireAdmin, async (_req, res) => {
  const [dbRow] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "google_client_id")).limit(1);
  const dbValue = dbRow?.value ?? null;
  const envValue = process.env.GOOGLE_CLIENT_ID || null;
  const activeValue = envValue || dbValue;
  const source: "env" | "db" | "none" = envValue ? "env" : dbValue ? "db" : "none";

  return res.json({
    hasClientId: !!activeValue,
    clientIdMasked: activeValue ? (activeValue.length > 20 ? `${activeValue.slice(0, 10)}...${activeValue.slice(-10)}` : "****") : null,
    source,
  });
});

// PUT /api/settings/google — admin only
router.put("/google", requireAdmin, async (req, res) => {
  const { clientId } = req.body as { clientId?: string };
  if (!clientId?.trim()) return res.status(400).json({ error: "Client ID is required" });

  const [existing] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "google_client_id")).limit(1);
  if (existing) {
    await db.update(systemSettingsTable).set({ value: clientId.trim(), updatedAt: new Date() }).where(eq(systemSettingsTable.key, "google_client_id"));
  } else {
    await db.insert(systemSettingsTable).values({ key: "google_client_id", value: clientId.trim() });
  }

  const masked = clientId.trim().length > 20 ? `${clientId.trim().slice(0, 10)}...${clientId.trim().slice(-10)}` : "****";
  return res.json({ success: true, hasClientId: true, clientIdMasked: masked, source: "db" });
});

// DELETE /api/settings/google — admin only
router.delete("/google", requireAdmin, async (_req, res) => {

  await db.delete(systemSettingsTable).where(eq(systemSettingsTable.key, "google_client_id"));
  return res.json({ success: true });
});

// ── /api/settings/smtp ──────────────────────────────────────────────────────

const SMTP_KEYS = ["smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_from_email", "smtp_from_name"] as const;

// GET /api/settings/smtp
router.get("/smtp", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(systemSettingsTable);
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value ?? "";

  const host = map["smtp_host"] || process.env.SMTP_HOST || "";
  const port = parseInt(map["smtp_port"] || process.env.SMTP_PORT || "587", 10);
  const user = map["smtp_user"] || process.env.SMTP_USER || "";
  const pass = map["smtp_password"] || process.env.SMTP_PASS || "";
  const from = map["smtp_from_email"] || process.env.FROM_EMAIL || "";

  return res.json({
    hasCredentials: !!(host && user),
    host,
    port,
    user: user || null,
    passMasked: pass ? "********" : null,
    from: from || null,
  });
});

// PUT /api/settings/smtp — admin only
router.put("/smtp", requireAdmin, async (req, res) => {
  const { host, port, user: smtpUser, pass, from } = req.body as { host?: string; port?: string; user?: string; pass?: string; from?: string };

  const entries: { key: string; value: string }[] = [];
  if (host !== undefined) entries.push({ key: "smtp_host", value: host });
  if (port !== undefined) entries.push({ key: "smtp_port", value: port });
  if (smtpUser !== undefined) entries.push({ key: "smtp_user", value: smtpUser });
  if (pass !== undefined && pass !== "") entries.push({ key: "smtp_password", value: pass });
  if (from !== undefined) entries.push({ key: "smtp_from_email", value: from });

  for (const { key, value } of entries) {
    const [existing] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, key)).limit(1);
    if (existing) {
      await db.update(systemSettingsTable).set({ value, updatedAt: new Date() }).where(eq(systemSettingsTable.key, key));
    } else {
      await db.insert(systemSettingsTable).values({ key, value });
    }
  }

  return res.json({ success: true, hasCredentials: !!(host && smtpUser) });
});

// DELETE /api/settings/smtp — admin only
router.delete("/smtp", requireAdmin, async (_req, res) => {

  for (const key of SMTP_KEYS) {
    await db.delete(systemSettingsTable).where(eq(systemSettingsTable.key, key));
  }
  return res.json({ success: true });
});

// POST /api/settings/smtp/test — admin only
router.post("/smtp/test", requireAdmin, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const { to } = req.body as { to?: string };
  try {
    await sendTestEmail(to || user.email, user.name);
    return res.json({ success: true, message: "Test email sent" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to send test email" });
  }
});

export default router;
