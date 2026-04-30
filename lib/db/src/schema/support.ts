import { pgTable, serial, integer, text, timestamp, varchar, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const supportTicketsTable = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  subject: varchar("subject", { length: 255 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("open"), // open, in_progress, closed
  priority: varchar("priority", { length: 20 }).notNull().default("medium"), // low, medium, high, urgent
  category: varchar("category", { length: 50 }).notNull().default("general"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const ticketMessagesTable = pgTable("ticket_messages", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => supportTicketsTable.id),
  senderId: integer("sender_id").notNull().references(() => usersTable.id),
  message: text("message").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  attachments: text("attachments"), 
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
