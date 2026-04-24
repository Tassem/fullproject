import { pgTable, serial, text, integer, boolean, timestamp, varchar, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash"),
  phone: text("phone"),
  plan: varchar("plan", { length: 50 }).notNull().default("free"),

  monthly_credits: integer("monthly_credits").notNull().default(0),
  purchased_credits: integer("purchased_credits").notNull().default(0),
  credits_reset_date: timestamp("credits_reset_date"),

  daily_usage_count: integer("daily_usage_count").notNull().default(0),
  daily_usage_date: date("daily_usage_date"),

  apiKey: text("api_key"),
  botCode: text("bot_code"),
  telegramChatId: text("telegram_chat_id"),
  isAdmin: boolean("is_admin").notNull().default(false),
  emailVerified: boolean("email_verified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
