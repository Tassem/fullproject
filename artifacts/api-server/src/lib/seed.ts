import { db, planAddonsTable, systemSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export async function ensureSystemAddons() {
  try {
    const addons = [
      {
        name: "AI Image Generation",
        slug: "ai_image_generation",
        type: "feature",
        feature_key: "has_ai_image_generation",
        price: 39,
        is_recurring: true,
      },
      {
        name: "100 Credits Pack",
        slug: "credits-100",
        type: "credits",
        credits_amount: 100,
        price: 10,
        is_recurring: false,
      }
    ];

    for (const addon of addons) {
      const [existing] = await db.select().from(planAddonsTable).where(eq(planAddonsTable.slug, addon.slug)).limit(1);
      if (!existing) {
        await db.insert(planAddonsTable).values(addon);
        logger.info({ slug: addon.slug }, "Inserted missing system addon");
      } else {
        // Update if exists to ensure data consistency
        await db.update(planAddonsTable).set(addon).where(eq(planAddonsTable.slug, addon.slug));
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed to ensure system addons");
  }
}

export async function ensureDefaultSettings() {
  try {
  const defaults = [
    { key: "card_generation_base_cost", value: "1" },
    { key: "ai_image_cost_per_generation", value: "2" },
    { key: "points_burn_per_article", value: "5" },
    { key: "signup_bonus_credits", value: "30" },
    { key: "frontend_url", value: process.env.FRONTEND_URL || "http://localhost" },
    { key: "site_name", value: "MediaFlow" },
  ];

    for (const { key, value } of defaults) {
      const [existing] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, key)).limit(1);
      if (!existing) {
        await db.insert(systemSettingsTable).values({ key, value });
        logger.info({ key, value }, "Seeded default system setting");
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed to ensure default settings");
  }
}
