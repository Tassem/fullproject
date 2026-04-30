import { pgTable, serial, integer, text, boolean, timestamp, varchar, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userProviderKeysTable = pgTable("user_provider_keys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 50 }).notNull().default("openrouter"),
  encryptedKey: text("encrypted_key").notNull(),
  keyIv: text("key_iv").notNull(),
  keyTag: text("key_tag").notNull(),
  keyHint: varchar("key_hint", { length: 20 }),
  isValid: boolean("is_valid").notNull().default(true),
  lastValidatedAt: timestamp("last_validated_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  unique().on(t.userId, t.provider),
]);

export type UserProviderKey = typeof userProviderKeysTable.$inferSelect;
export type InsertUserProviderKey = typeof userProviderKeysTable.$inferInsert;
