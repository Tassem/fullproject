import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, plansTable, generatedImagesTable, articlesTable, sitesTable, systemSettingsTable, templatesTable } from "@workspace/db";
import { eq, count, isNull, and } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";

const router = Router();

// ─── Helper: map plansTable row → frontend snake_case format ─────────────────
function formatPlan(p: typeof plansTable.$inferSelect) {
  return {
    id: p.id,
    name: p.slug,
    display_name: p.name,
    description: "",
    price_monthly: p.priceMonthly,
    price_yearly: p.priceYearly,
    max_sites: p.maxSites,
    max_articles_per_month: p.articlesPerMonth,
    cards_per_day: p.cardsPerDay,
    max_templates: p.maxTemplates,
    credits: p.credits,
    is_active: p.isActive,
    sort_order: p.sortOrder,
    has_blog_automation: p.hasBlogAutomation,
    has_image_generator: p.hasImageGenerator,
    api_access: p.apiAccess,
    created_at: p.createdAt,
  };
}

// ─── Helper: map usersTable row → frontend format ────────────────────────────
function formatUser(u: typeof usersTable.$inferSelect, extras: { articles_used: number; sites_used: number }) {
  return {
    id: u.id,
    username: u.name,
    email: u.email,
    role: u.isAdmin ? "admin" : "user",
    plan: u.plan,
    points_balance: u.credits ?? 0,
    articles_used: extras.articles_used,
    sites_used: extras.sites_used,
    subscription_status: u.plan === "free" ? null : "active",
    created_at: u.createdAt,
    is_admin: u.isAdmin,
  };
}

// GET /admin/stats
router.get("/stats", requireAdmin, async (_req, res) => {
  const [usersRow] = await db.select({ count: count() }).from(usersTable);
  const [imagesRow] = await db.select({ count: count() }).from(generatedImagesTable);
  const [articlesRow] = await db.select({ count: count() }).from(articlesTable);
  const [sitesRow] = await db.select({ count: count() }).from(sitesTable);
  const [proUsersRow] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.plan, "pro"));
  const [freeUsersRow] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.plan, "free"));
  const [publishedRow] = await db.select({ count: count() }).from(articlesTable).where(eq(articlesTable.article_status, "published"));

  return res.json({
    totalUsers: Number(usersRow.count),
    totalImages: Number(imagesRow.count),
    todayImages: 0,
    totalArticles: Number(articlesRow.count),
    totalSites: Number(sitesRow.count),
    proUsers: Number(proUsersRow.count),
    freeUsers: Number(freeUsersRow.count),
    publishedArticles: Number(publishedRow.count),
  });
});

// GET /admin/usage — overview stats for BlogAdmin OverviewTab
router.get("/usage", requireAdmin, async (_req, res) => {
  const [usersRow] = await db.select({ count: count() }).from(usersTable);
  const plans = await db.select().from(plansTable).where(eq(plansTable.isActive, true));

  return res.json({
    total_users: Number(usersRow.count),
    pending_payments: 0,
    plan_breakdown: plans.map((p) => ({
      plan: p.slug,
      count: 0,
    })),
  });
});

// GET /admin/users — list all users
router.get("/users", requireAdmin, async (_req, res) => {
  const users = await db.select().from(usersTable);
  const formatted = await Promise.all(users.map(async (u) => {
    const [articlesRow] = await db.select({ count: count() }).from(articlesTable)
      .where(eq(articlesTable.site_id, u.id)); // approximate
    const [sitesRow] = await db.select({ count: count() }).from(sitesTable).where(eq(sitesTable.user_id, u.id));
    return formatUser(u, {
      articles_used: Number(articlesRow?.count ?? 0),
      sites_used: Number(sitesRow?.count ?? 0),
    });
  }));
  return res.json({ users: formatted });
});

// PATCH /admin/users/:id
router.patch("/users/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { plan, isAdmin, credits } = req.body;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) return res.status(404).json({ error: "User not found" });

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (plan !== undefined) updates.plan = plan;
  if (isAdmin !== undefined) updates.isAdmin = isAdmin;
  if (credits !== undefined) updates.credits = credits;

  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  return res.json(formatUser(updated, { articles_used: 0, sites_used: 0 }));
});

// POST /admin/users/:id/grant-points — add credits to a user
router.post("/users/:id/grant-points", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { amount } = req.body;
  if (!amount || isNaN(Number(amount))) return res.status(400).json({ error: "amount is required" });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) return res.status(404).json({ error: "User not found" });

  const newCredits = (user.credits ?? 0) + Number(amount);
  const [updated] = await db.update(usersTable).set({ credits: newCredits }).where(eq(usersTable.id, id)).returning();
  return res.json(formatUser(updated, { articles_used: 0, sites_used: 0 }));
});

// POST /admin/users/:id/change-plan — change user plan
router.post("/users/:id/change-plan", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { plan_name } = req.body;
  if (!plan_name) return res.status(400).json({ error: "plan_name is required" });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) return res.status(404).json({ error: "User not found" });

  const [updated] = await db.update(usersTable).set({ plan: plan_name }).where(eq(usersTable.id, id)).returning();
  return res.json(formatUser(updated, { articles_used: 0, sites_used: 0 }));
});

// DELETE /admin/users/:id
router.delete("/users/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) return res.status(404).json({ error: "User not found" });
  await db.delete(usersTable).where(eq(usersTable.id, id));
  return res.json({ success: true });
});

// GET /admin/plans
router.get("/plans", requireAdmin, async (_req, res) => {
  const plans = await db.select().from(plansTable).orderBy(plansTable.sortOrder);
  return res.json({ plans: plans.map(formatPlan) });
});

// POST /admin/plans
router.post("/plans", requireAdmin, async (req, res) => {
  const {
    name, display_name, description, price_monthly, price_yearly,
    max_sites, max_articles_per_month, cards_per_day, max_templates,
    credits, is_active, sort_order,
  } = req.body;

  if (!name) return res.status(400).json({ error: "name (slug) is required" });

  const [plan] = await db.insert(plansTable).values({
    name: display_name || name,
    slug: name,
    priceMonthly: price_monthly || 0,
    priceYearly: price_yearly || 0,
    cardsPerDay: cards_per_day || 5,
    maxTemplates: max_templates || 3,
    maxSavedDesigns: 5,
    maxSites: max_sites || 1,
    articlesPerMonth: max_articles_per_month || 0,
    hasTelegramBot: false,
    hasBlogAutomation: (max_articles_per_month || 0) > 0,
    hasImageGenerator: true,
    apiAccess: false,
    telegramBot: false,
    overlayUpload: false,
    customWatermark: false,
    credits: credits || 10,
    isActive: is_active !== false,
    sortOrder: sort_order || 0,
  }).returning();

  return res.status(201).json(formatPlan(plan));
});

// PUT /admin/plans/:id
router.put("/plans/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string);
  const [existing] = await db.select().from(plansTable).where(eq(plansTable.id, id)).limit(1);
  if (!existing) return res.status(404).json({ error: "Plan not found" });

  const body = req.body;
  const updates: Partial<typeof plansTable.$inferInsert> = {};
  if (body.display_name !== undefined) updates.name = body.display_name;
  if (body.price_monthly !== undefined) updates.priceMonthly = body.price_monthly;
  if (body.price_yearly !== undefined) updates.priceYearly = body.price_yearly;
  if (body.max_sites !== undefined) updates.maxSites = body.max_sites;
  if (body.max_articles_per_month !== undefined) updates.articlesPerMonth = body.max_articles_per_month;
  if (body.cards_per_day !== undefined) updates.cardsPerDay = body.cards_per_day;
  if (body.max_templates !== undefined) updates.maxTemplates = body.max_templates;
  if (body.max_saved_designs !== undefined) updates.maxSavedDesigns = body.max_saved_designs;
  if (body.has_blog_automation !== undefined) updates.hasBlogAutomation = body.has_blog_automation;
  if (body.has_image_generator !== undefined) updates.hasImageGenerator = body.has_image_generator;
  if (body.api_access !== undefined) updates.apiAccess = body.api_access;
  if (body.telegram_bot !== undefined) updates.telegramBot = body.telegram_bot;
  if (body.overlay_upload !== undefined) updates.overlayUpload = body.overlay_upload;
  if (body.custom_watermark !== undefined) updates.customWatermark = body.custom_watermark;
  if (body.credits !== undefined) updates.credits = body.credits;
  if (body.is_active !== undefined) updates.isActive = body.is_active;
  if (body.sort_order !== undefined) updates.sortOrder = body.sort_order;

  const [updated] = await db.update(plansTable).set(updates).where(eq(plansTable.id, id)).returning();
  return res.json(formatPlan(updated));
});

// DELETE /admin/plans/:id
router.delete("/plans/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string);
  const [existing] = await db.select().from(plansTable).where(eq(plansTable.id, id)).limit(1);
  if (!existing) return res.status(404).json({ error: "Plan not found" });
  await db.delete(plansTable).where(eq(plansTable.id, id));
  return res.json({ success: true });
});

// GET /admin/settings
router.get("/settings", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(systemSettingsTable);
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value ?? "";
  }
  return res.json({ settings });
});

// PUT /admin/settings
router.put("/settings", requireAdmin, async (req, res) => {
  const body = req.body as Record<string, string>;
  for (const [key, value] of Object.entries(body)) {
    const [existing] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, key)).limit(1);
    if (existing) {
      await db.update(systemSettingsTable).set({ value: String(value) }).where(eq(systemSettingsTable.key, key));
    } else {
      await db.insert(systemSettingsTable).values({ key, value: String(value) });
    }
  }
  const rows = await db.select().from(systemSettingsTable);
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value ?? "";
  }
  return res.json({ settings });
});

// POST /admin/test-ai — test AI provider connection
router.post("/test-ai", requireAdmin, async (req, res) => {
  const { provider, api_key, base_url, model } = req.body as {
    provider: string; api_key: string; base_url?: string; model?: string;
  };
  if (!api_key) return res.status(400).json({ ok: false, error: "API key is required" });

  try {
    let endpoint = "";
    let headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${api_key}`,
    };
    let body: Record<string, unknown> = {
      model: model || "openai/gpt-4o-mini",
      messages: [{ role: "user", content: "Say OK" }],
      max_tokens: 5,
    };

    if (provider === "openrouter") {
      endpoint = "https://openrouter.ai/api/v1/chat/completions";
      headers["HTTP-Referer"] = "https://newscard.pro";
    } else if (provider === "openai") {
      endpoint = "https://api.openai.com/v1/chat/completions";
      body.model = model || "gpt-4o-mini";
    } else if (provider === "anthropic") {
      endpoint = "https://api.anthropic.com/v1/messages";
      headers = {
        "Content-Type": "application/json",
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
      };
      body = { model: model || "claude-3-haiku-20240307", max_tokens: 5, messages: [{ role: "user", content: "Say OK" }] };
    } else if (provider === "custom" && base_url) {
      endpoint = base_url.replace(/\/$/, "") + "/chat/completions";
    } else {
      return res.status(400).json({ ok: false, error: "Unknown provider or missing base_url" });
    }

    const resp = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
    if (resp.ok) {
      return res.json({ ok: true, message: "✅ Connection successful" });
    } else {
      const txt = await resp.text();
      return res.json({ ok: false, error: `HTTP ${resp.status}: ${txt.slice(0, 200)}` });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.json({ ok: false, error: msg });
  }
});

// GET /admin/images
router.get("/images", requireAdmin, async (_req, res) => {
  const images = await db.select({
    id: generatedImagesTable.id,
    userId: generatedImagesTable.userId,
    title: generatedImagesTable.title,
    imageUrl: generatedImagesTable.imageUrl,
    aspectRatio: generatedImagesTable.aspectRatio,
    bannerColor: generatedImagesTable.bannerColor,
    createdAt: generatedImagesTable.createdAt,
  }).from(generatedImagesTable)
    .orderBy(generatedImagesTable.createdAt)
    .limit(120);
  return res.json({ images });
});

// ─── Template Approval Endpoints ──────────────────────────────────────────────

// GET /admin/pending-templates — templates awaiting approval (isApproved IS NULL)
router.get("/pending-templates", requireAdmin, async (_req, res) => {
  const pending = await db.select().from(templatesTable)
    .where(and(isNull(templatesTable.isApproved), eq(templatesTable.isSystem, true)));
  return res.json(pending.map(t => ({
    ...t,
    canvasLayout: t.canvasLayout ? JSON.parse(t.canvasLayout) : null,
  })));
});

// POST /admin/templates/:id/approve — approve a pending template
router.post("/templates/:id/approve", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string);
  const [updated] = await db.update(templatesTable)
    .set({ isApproved: true, updatedAt: new Date() })
    .where(eq(templatesTable.id, id))
    .returning();
  if (!updated) return res.status(404).json({ error: "Template not found" });
  return res.json({ success: true, id });
});

// POST /admin/templates/:id/reject — reject a pending template
router.post("/templates/:id/reject", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string);
  const [updated] = await db.update(templatesTable)
    .set({ isApproved: false, updatedAt: new Date() })
    .where(eq(templatesTable.id, id))
    .returning();
  if (!updated) return res.status(404).json({ error: "Template not found" });
  return res.json({ success: true, id });
});

// DELETE /admin/templates/:id — admin hard-delete any template
router.delete("/templates/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string);
  await db.delete(templatesTable).where(eq(templatesTable.id, id));
  return res.json({ success: true });
});

// POST /admin/ai-generate-template — Generate canvas layout via AI
router.post("/ai-generate-template", requireAdmin, async (req, res) => {
  const { description, imageBase64, imageMimeType } = req.body as {
    description?: string;
    imageBase64?: string;
    imageMimeType?: string;
  };

  // ── Read AI provider settings from DB ──
  const settRows = await db.select().from(systemSettingsTable);
  const sett: Record<string, string> = {};
  for (const r of settRows) sett[r.key] = r.value;

  const genProvider = sett["ai_provider_template_gen"] ?? "replit_openai";
  const genModel    = sett["ai_model_template_gen"]   ?? "";

  // ── Resolve endpoint, headers, and model based on provider ──
  let endpoint = "";
  let reqHeaders: Record<string, string> = { "Content-Type": "application/json" };
  let model = genModel;

  if (genProvider === "replit_openai") {
    const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    const apiKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    if (!baseUrl || !apiKey) return res.status(503).json({ error: "Replit AI integration not configured. Go to AI Roles settings to configure." });
    endpoint = `${baseUrl}/chat/completions`;
    reqHeaders["Authorization"] = `Bearer ${apiKey}`;
    model = model || "gpt-5.2";
  } else if (genProvider === "openrouter") {
    const key = sett["openrouter_api_key_1"] ?? "";
    if (!key) return res.status(503).json({ error: "OpenRouter API Key 1 not set. Go to 🔀 OpenRouter settings." });
    endpoint = "https://openrouter.ai/api/v1/chat/completions";
    reqHeaders["Authorization"] = `Bearer ${key}`;
    reqHeaders["HTTP-Referer"]  = "https://newscard.pro";
    model = model || "openai/gpt-4o";
  } else if (genProvider === "openai") {
    const key = sett["openai_api_key"] ?? "";
    if (!key) return res.status(503).json({ error: "OpenAI API key not set. Go to OpenAI settings." });
    endpoint = "https://api.openai.com/v1/chat/completions";
    reqHeaders["Authorization"] = `Bearer ${key}`;
    model = model || "gpt-4o";
  } else {
    // Custom providers: custom, custom_2, custom_3
    const slot   = genProvider === "custom" ? 1 : genProvider === "custom_2" ? 2 : 3;
    const prefix = slot === 1 ? "custom_1" : `custom_${slot}`;
    const key    = sett[`${prefix}_key`]      ?? "";
    const base   = sett[`${prefix}_base_url`] ?? "";
    if (!base) return res.status(503).json({ error: `Custom AI provider ${slot} base URL not set. Go to 🔧 Custom AI settings.` });
    endpoint = `${base.replace(/\/$/, "")}/chat/completions`;
    if (key) reqHeaders["Authorization"] = `Bearer ${key}`;
    model = model || sett[`${prefix}_model_main`] || "llama3";
  }

  if (!endpoint) return res.status(503).json({ error: "AI provider not configured." });

  const systemPrompt = `You are a professional news card template designer. Generate a canvas layout JSON for a 540×540px news card template.

Canvas element types and their key properties:
- bg: background layer (fill: hex color, gradient: CSS gradient string, src: image URL)
- photo: main photo slot placeholder (positioned where journalist's photo or news image will be placed)
- text: text element (content: string, fontSize: number, color: hex, fontFamily: "Inter"|"Cairo"|"Georgia", fontWeight: "400"|"700"|"800"|"900", textAlign: "left"|"center"|"right")
- badge: pill/chip badge (content: string, bgColor: hex, color: hex, fontSize: number, borderRadius: number)
- rect: filled rectangle (fill: hex, gradient: CSS gradient, borderRadius: number, borderWidth: number, borderColor: hex)
- circle: filled circle (fill: hex, borderWidth: number, borderColor: hex)
- logo: small logo placeholder box
- social: social media bar placeholder

Every element MUST have: { id: string, type: string, x: number, y: number, w: number, h: number, zIndex: number }

Design rules:
1. Canvas is exactly 540×540px. x/y origin is top-left corner.
2. ALWAYS include a "bg" element covering full canvas (x:0, y:0, w:540, h:540, zIndex:0)
3. ALWAYS include a "photo" element for the main image area
4. ALWAYS include at least 2 "text" elements: one small label/category (fontSize 11-13) and one bold headline (fontSize 18-28)
5. zIndex: bg=0, photo=1, shapes=2, overlays=3, text=4, badges=5
6. All coordinates must be within 0-540 range
7. Create modern, professional, visually striking layouts
8. Use cohesive color palettes

Return ONLY a valid JSON object, no markdown, no explanation:
{ "width": 540, "height": 540, "elements": [...] }`;

  const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

  if (imageBase64 && imageMimeType) {
    userContent.push({
      type: "image_url",
      image_url: { url: `data:${imageMimeType};base64,${imageBase64}` },
    });
  }

  userContent.push({
    type: "text",
    text: description && description.trim()
      ? description.trim()
      : "Create a modern, creative news card template with a bold headline area, clear photo space, and professional color scheme.",
  });

  // Some providers don't support response_format — only set it for OpenAI-compatible ones
  const supportsJsonMode = ["replit_openai", "openai"].includes(genProvider);

  try {
    const aiRes = await fetch(endpoint, {
      method: "POST",
      headers: reqHeaders,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userContent },
        ],
        max_completion_tokens: 4096,
        ...(supportsJsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      return res.status(502).json({ error: `AI API error ${aiRes.status}: ${text.slice(0, 300)}` });
    }

    const data = await aiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return res.status(502).json({ error: "Empty response from AI" });

    let layout: unknown;
    try { layout = JSON.parse(content); } catch {
      return res.status(502).json({ error: "AI returned invalid JSON" });
    }

    return res.json({ layout });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }
});

// GET /admin/payments — stub (no payment table yet)
router.get("/payments", requireAdmin, async (_req, res) => {
  return res.json({ requests: [] });
});

// POST /admin/payments/:id/approve — stub
router.post("/payments/:id/approve", requireAdmin, async (_req, res) => {
  return res.json({ success: true });
});

// POST /admin/payments/:id/deny — stub
router.post("/payments/:id/deny", requireAdmin, async (_req, res) => {
  return res.json({ success: true });
});

export default router;
