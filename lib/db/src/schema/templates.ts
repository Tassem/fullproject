import { pgTable, serial, integer, text, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const templatesTable = pgTable("templates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 100 }),
  bannerColor: text("banner_color").default("#1a1a2e"),
  textColor: text("text_color").default("#ffffff"),
  font: varchar("font", { length: 100 }).default("Inter"),
  category: varchar("category", { length: 50 }).default("general"),
  aspectRatio: varchar("aspect_ratio", { length: 20 }).default("16:9"),
  canvasLayout: text("canvas_layout"),
  watermark: text("watermark"),
  isPublic: boolean("is_public").notNull().default(false),
  isSystem: boolean("is_system").notNull().default(false),
  // null = pending review, true = approved (visible in gallery), false = rejected
  isApproved: boolean("is_approved"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTemplateSchema = createInsertSchema(templatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type Template = typeof templatesTable.$inferSelect;
