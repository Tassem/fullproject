import { pgTable, serial, integer, text, boolean, timestamp, jsonb, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sitesTable } from "./sites";
import { usersTable } from "./users";
import { rssFeedsTable } from "./rss_feeds";

export const articlesTable = pgTable("articles", {
  id: serial("id").primaryKey(),

  user_id: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  site_id: integer("site_id").references(() => sitesTable.id, { onDelete: "cascade" }),
  rss_feed_id: integer("rss_feed_id").references(() => rssFeedsTable.id, { onDelete: "set null" }),
  wp_category_id: integer("wp_category_id"),

  rss_link: text("rss_link"),
  competitor_title: text("competitor_title"),
  competitor_description: text("competitor_description"),
  competitor_full_content: text("competitor_full_content"),
  competitor_image_url: text("competitor_image_url"),
  competitor_categories: text("competitor_categories"),

  meta_title: text("meta_title"),
  permalink_slug: text("permalink_slug"),
  meta_description: text("meta_description"),
  primary_keyword: text("primary_keyword"),
  secondary_keywords: text("secondary_keywords"),
  keyword_strategy: text("keyword_strategy"),
  content_gaps: text("content_gaps"),
  content_structure: text("content_structure"),

  internal_links: jsonb("internal_links").default([]),
  external_links: jsonb("external_links").default([]),

  image_prompt: text("image_prompt"),
  use_original_image: boolean("use_original_image").default(true),
  generated_image_url: text("generated_image_url"),
  final_image_url: text("final_image_url"),
  kieai_task_id: text("kieai_task_id"),

  article_body: text("article_body"),
  article_html: text("article_html"),

  wp_post_id: integer("wp_post_id"),
  wp_image_id: integer("wp_image_id"),
  wp_post_url: text("wp_post_url"),

  content_status: varchar("content_status", { length: 50 }).default("pending").notNull(),
  image_status: varchar("image_status", { length: 50 }).default("pending").notNull(),
  article_status: varchar("article_status", { length: 50 }).default("pending").notNull(),

  error_message: text("error_message"),
  retry_count: integer("retry_count").notNull().default(0),

  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const insertArticleSchema = createInsertSchema(articlesTable).omit({ id: true, created_at: true, updated_at: true });
export const selectArticleSchema = createSelectSchema(articlesTable);
export type InsertArticle = z.infer<typeof insertArticleSchema>;
export type Article = typeof articlesTable.$inferSelect;
