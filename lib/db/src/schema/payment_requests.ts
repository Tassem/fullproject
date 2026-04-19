import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { plansTable } from "./plans";

export const paymentRequestsTable = pgTable("payment_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  planId: integer("plan_id").references(() => plansTable.id, { onDelete: "set null" }),
  pointsAmount: integer("points_amount"),
  paymentMethod: text("payment_method").notNull(),
  proofDetails: text("proof_details").notNull(),
  status: text("status").default("pending").notNull(),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PaymentRequest = typeof paymentRequestsTable.$inferSelect;
export type InsertPaymentRequest = typeof paymentRequestsTable.$inferInsert;
