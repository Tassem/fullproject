import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { sitesTable } from "./sites";
import { usersTable } from "./users";

export const rssFeedsTable = pgTable("rss_feeds", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  site_id: integer("site_id").notNull().references(() => sitesTable.id, { onDelete: "cascade" }),
  rss_url: text("rss_url").notNull(),
  label: text("label"),
  wp_category_id: integer("wp_category_id"),
  wp_category_name: text("wp_category_name"),
  poll_hours: integer("poll_hours").default(4).notNull(),
  poll_minutes: integer("poll_minutes").default(0).notNull(),
  max_articles: integer("max_articles").default(0).notNull(),
  is_active: boolean("is_active").default(true).notNull(),
  last_polled_at: timestamp("last_polled_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export type RssFeed = typeof rssFeedsTable.$inferSelect;
export type InsertRssFeed = typeof rssFeedsTable.$inferInsert;
