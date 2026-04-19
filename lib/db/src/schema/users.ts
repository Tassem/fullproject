import { pgTable, serial, text, integer, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash"),
  phone: text("phone"),
  plan: varchar("plan", { length: 50 }).notNull().default("free"),
  credits: integer("credits").notNull().default(0),
  apiKey: text("api_key"),
  botCode: text("bot_code"),
  telegramChatId: text("telegram_chat_id"),
  isAdmin: boolean("is_admin").notNull().default(false),
  emailVerified: boolean("email_verified").notNull().default(false),
  imagesToday: integer("images_today").notNull().default(0),
  imagesLastReset: timestamp("images_last_reset").defaultNow(),
  articlesThisMonth: integer("articles_this_month").notNull().default(0),
  articlesLastReset: timestamp("articles_last_reset").defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
