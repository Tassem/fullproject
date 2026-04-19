// @ts-nocheck
import { Router } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

export const DEFAULT_BLOG_SETTINGS = [
  // ── WordPress ──────────────────────────────────────────────────────────────
  { key: "wp_url", value: "", description: "WordPress site URL (global fallback)" },
  { key: "wp_username", value: "", description: "WordPress username (global fallback)" },
  { key: "wp_password", value: "", description: "WordPress app password (global fallback)" },
  { key: "auto_publish", value: "false", description: "Auto-publish to WordPress (false = draft)" },

  // ── RSS / Pipeline ─────────────────────────────────────────────────────────
  { key: "rss_feed_url", value: "", description: "RSS feed URL to monitor (global fallback)" },
  { key: "rss_poll_hours", value: "4", description: "Hours between RSS checks" },
  { key: "pipeline_enabled", value: "true", description: "Master switch for the pipeline" },
  { key: "article_length_min", value: "600", description: "Minimum article word count" },
  { key: "article_length_max", value: "700", description: "Maximum article word count" },

  // ── AI Provider Selection ──────────────────────────────────────────────────
  { key: "ai_provider_main", value: "openrouter", description: "AI provider for main brain / blog manager" },
  { key: "ai_provider_sub", value: "openrouter", description: "AI provider for sub-agents (title, desc, links)" },
  { key: "ai_provider_writer", value: "openrouter", description: "AI provider for article writer" },
  { key: "ai_provider_image_analysis", value: "gemini", description: "AI provider for image analysis (gemini, openai, custom)" },

  // ── OpenRouter ─────────────────────────────────────────────────────────────
  { key: "openrouter_api_key_1", value: "", description: "OpenRouter API Key (Main Brain / Blog Manager)" },
  { key: "openrouter_api_key_2", value: "", description: "OpenRouter API Key (Sub-agents + Writer)" },
  { key: "openrouter_model_main", value: "anthropic/claude-3.5-sonnet", description: "OpenRouter model for Blog Manager" },
  { key: "openrouter_model_sub", value: "google/gemini-flash-1.5", description: "OpenRouter model for sub-agents" },
  { key: "openrouter_model_writer", value: "openai/gpt-4o", description: "OpenRouter model for Article Writer" },

  // ── OpenAI (direct) ────────────────────────────────────────────────────────
  { key: "openai_api_key", value: "", description: "OpenAI API Key (direct)" },
  { key: "openai_model_main", value: "gpt-4o", description: "OpenAI model for Blog Manager" },
  { key: "openai_model_sub", value: "gpt-4o-mini", description: "OpenAI model for sub-agents" },
  { key: "openai_model_writer", value: "gpt-4o", description: "OpenAI model for Article Writer" },
  { key: "openai_model_image_analysis", value: "gpt-4o", description: "OpenAI model for image analysis" },

  // ── Custom Provider 1 ───────────────────────────────────────────────────────
  { key: "custom_ai_name", value: "", description: "Custom provider display name (e.g. Ollama, LM Studio)" },
  { key: "custom_ai_base_url", value: "", description: "Custom provider base URL (OpenAI-compatible)" },
  { key: "custom_ai_key", value: "", description: "Custom provider API key (leave empty if not needed)" },
  { key: "custom_ai_model_main", value: "", description: "Custom provider model for Blog Manager" },
  { key: "custom_ai_model_sub", value: "", description: "Custom provider model for sub-agents" },
  { key: "custom_ai_model_writer", value: "", description: "Custom provider model for Article Writer" },
  { key: "custom_ai_model_image_analysis", value: "", description: "Custom provider model for image analysis" },

  // ── Custom Provider 2 ───────────────────────────────────────────────────────
  { key: "custom_ai_2_name", value: "", description: "Custom provider 2 display name" },
  { key: "custom_ai_2_base_url", value: "", description: "Custom provider 2 base URL" },
  { key: "custom_ai_2_key", value: "", description: "Custom provider 2 API key" },
  { key: "custom_ai_2_model_main", value: "", description: "Custom provider 2 model (main)" },
  { key: "custom_ai_2_model_sub", value: "", description: "Custom provider 2 model (sub)" },
  { key: "custom_ai_2_model_writer", value: "", description: "Custom provider 2 model (writer)" },

  // ── Custom Provider 3 ───────────────────────────────────────────────────────
  { key: "custom_ai_3_name", value: "", description: "Custom provider 3 display name" },
  { key: "custom_ai_3_base_url", value: "", description: "Custom provider 3 base URL" },
  { key: "custom_ai_3_key", value: "", description: "Custom provider 3 API key" },
  { key: "custom_ai_3_model_main", value: "", description: "Custom provider 3 model (main)" },
  { key: "custom_ai_3_model_sub", value: "", description: "Custom provider 3 model (sub)" },
  { key: "custom_ai_3_model_writer", value: "", description: "Custom provider 3 model (writer)" },

  // ── Perplexity (keyword research) ─────────────────────────────────────────
  { key: "perplexity_api_key", value: "", description: "Perplexity API Key (for keyword research)" },

  // ── Tavily (external links) ───────────────────────────────────────────────
  { key: "tavily_api_key", value: "", description: "Tavily API Key (for external link search)" },

  // ── Gemini (image analysis) ───────────────────────────────────────────────
  { key: "gemini_api_key", value: "", description: "Google Gemini API Key (for image analysis)" },

  // ── kie.ai (image generation) ──────────────────────────────────────────────
  { key: "kieai_api_key", value: "", description: "kie.ai API Key (image generation)" },
  { key: "use_kieai", value: "false", description: "Enable kie.ai image generation (true/false)" },
  { key: "kieai_model", value: "flux-dev", description: "kie.ai image model (flux-dev, flux-schnell, etc.)" },
  { key: "kieai_aspect_ratio", value: "16:9", description: "Generated image aspect ratio" },

  // ── Image Generation (OpenAI-compatible) ──────────────────────────────────
  { key: "image_gen_provider", value: "openai", description: "Image generation provider (openai, custom_1, custom_2, custom_3)" },
  { key: "image_gen_model", value: "dall-e-3", description: "Image generation model name" },
  { key: "image_gen_size", value: "1792x1024", description: "Generated image size (e.g. 1792x1024)" },
];

// GET /api/blog-settings — list all blog pipeline settings
router.get("/", requireAuth, async (req, res) => {
  const blogKeys = new Set(DEFAULT_BLOG_SETTINGS.map(s => s.key));
  let rows = await db.select().from(settingsTable).orderBy(settingsTable.key);

  // Filter to only blog-relevant settings
  const blogRows = rows.filter(r => blogKeys.has(r.key));

  if (blogRows.length === 0) {
    // Seed defaults
    await db.insert(settingsTable).values(DEFAULT_BLOG_SETTINGS).onConflictDoNothing();
    rows = await db.select().from(settingsTable).orderBy(settingsTable.key);
    return res.json(rows.filter(r => blogKeys.has(r.key)));
  }

  // Seed any missing keys
  const existingKeys = new Set(blogRows.map(r => r.key));
  const missing = DEFAULT_BLOG_SETTINGS.filter(s => !existingKeys.has(s.key));
  if (missing.length > 0) {
    await db.insert(settingsTable).values(missing).onConflictDoNothing();
    const updated = await db.select().from(settingsTable).orderBy(settingsTable.key);
    return res.json(updated.filter(r => blogKeys.has(r.key)));
  }

  return res.json(blogRows);
});

// PUT /api/blog-settings — update one or many settings
router.put("/", requireAuth, async (req, res) => {
  const { settings } = req.body as { settings?: { key: string; value: string }[] };
  if (!Array.isArray(settings)) return res.status(400).json({ error: "settings must be an array" });

  const updated = [];
  for (const { key, value } of settings) {
    const [row] = await db
      .insert(settingsTable)
      .values({ key, value, updated_at: new Date() })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value, updated_at: new Date() } })
      .returning();
    if (row) updated.push(row);
  }

  return res.json(updated);
});

export default router;
