import { pgTable, serial, integer, timestamp, text, boolean, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const planAddonsTable = pgTable("plan_addons", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  type: varchar("type", { length: 20 }).notNull(),

  credits_amount: integer("credits_amount").default(0),

  feature_key: varchar("feature_key", { length: 50 }),

  limit_key: varchar("limit_key", { length: 50 }),
  limit_value: integer("limit_value"),

  price: integer("price").notNull().default(0),
  is_recurring: boolean("is_recurring").notNull().default(false),

  is_active: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userAddonsTable = pgTable("user_addons", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  addonId: integer("addon_id").notNull().references(() => planAddonsTable.id, { onDelete: "cascade" }),
  purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
});

export type PlanAddon = typeof planAddonsTable.$inferSelect;
export type UserAddon = typeof userAddonsTable.$inferSelect;
