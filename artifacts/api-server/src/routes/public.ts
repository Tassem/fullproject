import { Router } from "express";
import { db } from "@workspace/db";
import { systemSettingsTable, plansTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const router = Router();

const PUBLIC_KEYS = [
  "site_name", "landing_enabled", "landing_title", "landing_subtitle", "landing_hero_badge",
  "registration_enabled", "channel_discord_url", "channel_discord_enabled",
  "channel_whatsapp_number", "channel_whatsapp_enabled",
  "channel_telegram_url", "channel_telegram_enabled",
  "channel_email", "channel_email_enabled",
  "payment_paypal_email", "payment_paypal_link",
  "payment_bank_name", "payment_bank_holder", "payment_bank_iban", "payment_bank_swift",
  "points_price_per_unit", "points_min_purchase",
];

// GET /api/public/site-info — no auth needed
router.get("/site-info", async (_req, res) => {
  const rows = await db.select().from(systemSettingsTable).where(inArray(systemSettingsTable.key, PUBLIC_KEYS));
  const settings: Record<string, string> = {};
  for (const row of rows) settings[row.key] = row.value || "";

  const plans = await db.select().from(plansTable).where(eq(plansTable.isActive, true));

  return res.json({ settings, plans });
});

export default router;
