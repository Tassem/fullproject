import { pgTable, serial, integer, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { templatesTable } from "./templates";

export const generatedImagesTable = pgTable("generated_images", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  templateId: integer("template_id").references(() => templatesTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  label: text("label"),
  imageUrl: text("image_url").notNull(),
  aspectRatio: varchar("aspect_ratio", { length: 20 }).default("16:9"),
  bannerColor: varchar("banner_color", { length: 20 }).default("#1a1a2e"),
  textColor: varchar("text_color", { length: 20 }).default("#ffffff"),
  font: varchar("font", { length: 100 }).default("Inter"),
  backgroundSource: varchar("background_source", { length: 20 }).default("uploaded"),
  aiPrompt: text("ai_prompt"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertGeneratedImageSchema = createInsertSchema(generatedImagesTable).omit({ id: true, createdAt: true });
export type InsertGeneratedImage = z.infer<typeof insertGeneratedImageSchema>;
export type GeneratedImage = typeof generatedImagesTable.$inferSelect;
