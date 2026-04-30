import { pgTable, serial, text, integer, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const plansTable = pgTable("plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  description: text("description"),

  monthly_credits: integer("monthly_credits").notNull().default(0),

  max_sites: integer("max_sites").notNull().default(1),
  max_templates: integer("max_templates").notNull().default(5),
  max_saved_designs: integer("max_saved_designs").notNull().default(10),

  has_blog_automation: boolean("has_blog_automation").notNull().default(false),
  has_image_generator: boolean("has_image_generator").notNull().default(true),
  has_telegram_bot: boolean("has_telegram_bot").notNull().default(false),
  has_api_access: boolean("has_api_access").notNull().default(false),
  has_overlay_upload: boolean("has_overlay_upload").notNull().default(false),
  has_custom_watermark: boolean("has_custom_watermark").notNull().default(false),
  has_priority_processing: boolean("has_priority_processing").notNull().default(false),
  has_priority_support: boolean("has_priority_support").notNull().default(false),
  has_ai_image_generation: boolean("has_ai_image_generation").notNull().default(false),

  rate_limit_daily: integer("rate_limit_daily").notNull().default(50),
  rate_limit_hourly: integer("rate_limit_hourly").notNull().default(20),

  price_monthly: integer("price_monthly").notNull().default(0),
  price_yearly: integer("price_yearly").notNull().default(0),

  plan_mode: varchar("plan_mode", { length: 20 }).notNull().default("platform"),

  sort_order: integer("sort_order").notNull().default(0),
  is_active: boolean("is_active").notNull().default(true),
  is_free: boolean("is_free").notNull().default(false),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPlanSchema = createInsertSchema(plansTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type Plan = typeof plansTable.$inferSelect;
