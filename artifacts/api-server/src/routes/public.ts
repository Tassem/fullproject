import { Router } from "express";
import { db } from "@workspace/db";
import { systemSettingsTable, plansTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const router = Router();

const PUBLIC_KEYS = [
  // Site Identity
  "site_name", "site_tagline", "site_logo_emoji",
  // Landing Control
  "landing_enabled", "registration_enabled",
  // Hero Section
  "landing_hero_badge", "landing_title", "landing_subtitle",
  "landing_hero_primary_btn", "landing_hero_secondary_btn",
  // Stats Bar
  "landing_stats_users", "landing_stats_articles",
  "landing_stats_sites", "landing_stats_uptime",
  "landing_stats_users_label", "landing_stats_articles_label",
  "landing_stats_sites_label", "landing_stats_uptime_label",
  // Features Section
  "landing_features_title", "landing_features_subtitle",
  // How It Works Section
  "landing_how_title", "landing_how_subtitle",
  "landing_how_step1_title", "landing_how_step1_desc",
  "landing_how_step2_title", "landing_how_step2_desc",
  "landing_how_step3_title", "landing_how_step3_desc",
  // Pricing Section
  "landing_pricing_title", "landing_pricing_subtitle",
  // FAQ Section
  "landing_faq_title", "landing_faq_subtitle",
  "landing_faq_1_q", "landing_faq_1_a",
  "landing_faq_2_q", "landing_faq_2_a",
  "landing_faq_3_q", "landing_faq_3_a",
  "landing_faq_4_q", "landing_faq_4_a",
  "landing_faq_5_q", "landing_faq_5_a",
  "landing_faq_6_q", "landing_faq_6_a",
  // Testimonials Section
  "landing_testimonials_title", "landing_testimonials_subtitle",
  "landing_testimonial_1_name", "landing_testimonial_1_role", "landing_testimonial_1_text",
  "landing_testimonial_2_name", "landing_testimonial_2_role", "landing_testimonial_2_text",
  "landing_testimonial_3_name", "landing_testimonial_3_role", "landing_testimonial_3_text",
  // CTA Section
  "landing_cta_title", "landing_cta_subtitle", "landing_cta_btn",
  // Footer
  "landing_footer_copyright",
  // Contact Channels
  "channel_discord_url", "channel_discord_enabled",
  "channel_whatsapp_number", "channel_whatsapp_enabled",
  "channel_telegram_url", "channel_telegram_enabled",
  "channel_email", "channel_email_enabled",
  // Payment Info
  "payment_paypal_email", "payment_paypal_link",
  "payment_bank_name", "payment_bank_holder", "payment_bank_iban", "payment_bank_swift",
  // Points
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
