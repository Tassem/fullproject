import { pgTable, serial, integer, text, timestamp, jsonb, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { articlesTable } from "./articles";

export const pipelineLogsTable = pgTable("pipeline_logs", {
  id: serial("id").primaryKey(),
  article_id: integer("article_id").references(() => articlesTable.id, { onDelete: "cascade" }),
  stage: varchar("stage", { length: 100 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  message: text("message"),
  duration_ms: integer("duration_ms"),
  output_data: jsonb("output_data"),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const insertPipelineLogSchema = createInsertSchema(pipelineLogsTable).omit({ id: true, created_at: true });
export type InsertPipelineLog = z.infer<typeof insertPipelineLogSchema>;
export type PipelineLog = typeof pipelineLogsTable.$inferSelect;
