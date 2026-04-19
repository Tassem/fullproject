import { pgTable, serial, integer, text, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sitesTable } from "./sites";

export const agentPromptsTable = pgTable("agent_prompts", {
  id: serial("id").primaryKey(),
  site_id: integer("site_id").references(() => sitesTable.id, { onDelete: "cascade" }),
  agent_key: varchar("agent_key", { length: 100 }).notNull(), // content_writer | seo_optimizer | image_gen
  agent_name: text("agent_name"),
  system_message: text("system_message"),
  description: text("description"),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAgentPromptSchema = createInsertSchema(agentPromptsTable).omit({ id: true, created_at: true, updated_at: true });
export type InsertAgentPrompt = z.infer<typeof insertAgentPromptSchema>;
export type AgentPrompt = typeof agentPromptsTable.$inferSelect;
