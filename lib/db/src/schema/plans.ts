import { pgTable, serial, text, integer, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const plansTable = pgTable("plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  priceMonthly: integer("price_monthly").notNull().default(0),
  priceYearly: integer("price_yearly").notNull().default(0),
  cardsPerDay: integer("cards_per_day").notNull().default(5),
  maxTemplates: integer("max_templates").notNull().default(3),
  maxSavedDesigns: integer("max_saved_designs").notNull().default(5),
  maxSites: integer("max_sites").notNull().default(1),
  articlesPerMonth: integer("articles_per_month").notNull().default(0),
  hasTelegramBot: boolean("has_telegram_bot").notNull().default(false),
  hasBlogAutomation: boolean("has_blog_automation").notNull().default(false),
  hasImageGenerator: boolean("has_image_generator").notNull().default(true),
  apiAccess: boolean("api_access").notNull().default(false),
  telegramBot: boolean("telegram_bot").notNull().default(false),
  overlayUpload: boolean("overlay_upload").notNull().default(false),
  customWatermark: boolean("custom_watermark").notNull().default(false),
  credits: integer("credits").notNull().default(10),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPlanSchema = createInsertSchema(plansTable).omit({ id: true, createdAt: true });
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type Plan = typeof plansTable.$inferSelect;
