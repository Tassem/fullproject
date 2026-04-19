import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const sitesTable = pgTable("sites", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  wp_url: text("wp_url"),
  wp_username: text("wp_username"),
  wp_password: text("wp_password"),
  rss_feed_url: text("rss_feed_url"),
  rss_poll_hours: integer("rss_poll_hours").notNull().default(6),
  auto_publish: boolean("auto_publish").notNull().default(false),
  is_active: boolean("is_active").notNull().default(true),
  global_instructions: text("global_instructions"),
  css_selector_content: text("css_selector_content").default(".single-content"),
  css_selector_image: text("css_selector_image").default(".wp-site-blocks .post-thumbnail img"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSiteSchema = createInsertSchema(sitesTable).omit({ id: true, created_at: true, updated_at: true });
export type InsertSite = z.infer<typeof insertSiteSchema>;
export type Site = typeof sitesTable.$inferSelect;
