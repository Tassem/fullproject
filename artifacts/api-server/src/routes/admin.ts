import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, plansTable, generatedImagesTable, articlesTable, sitesTable, systemSettingsTable, templatesTable, creditTransactionsTable, paymentRequestsTable, planAddonsTable, userAddonsTable } from "@workspace/db";
import { eq, count, isNull, and, desc, sql } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";
import { invalidateEffectiveLimitsCache } from "../lib/planGuard";
import { invalidateSettingsCache } from "../lib/settings";
import { testNanobananaConnection, clearNanobananaCache } from "../lib/nanobananaClient";
import { db as workspaceDb } from "@workspace/db"; // Alias if needed, but we already have db

const router = Router();

function formatPlan(p: typeof plansTable.$inferSelect) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    monthly_credits: p.monthly_credits,
    max_sites: p.max_sites,
    max_templates: p.max_templates,
    max_saved_designs: p.max_saved_designs,
    has_blog_automation: p.has_blog_automation,
    has_image_generator: p.has_image_generator,
    has_ai_image_generation: p.has_ai_image_generation,
    has_telegram_bot: p.has_telegram_bot,
    has_api_access: p.has_api_access,
    has_overlay_upload: p.has_overlay_upload,
    has_custom_watermark: p.has_custom_watermark,
    has_priority_processing: p.has_priority_processing,
    has_priority_support: p.has_priority_support,
    rate_limit_daily: p.rate_limit_daily,
    rate_limit_hourly: p.rate_limit_hourly,
    price_monthly: p.price_monthly,
    price_yearly: p.price_yearly,
    sort_order: p.sort_order,
    is_active: p.is_active,
    is_free: p.is_free,
    created_at: p.createdAt,
  };
}

function formatUser(u: typeof usersTable.$inferSelect, extras: { articles_used: number; sites_used: number }) {
  return {
    id: u.id,
    username: u.name,
    email: u.email,
    role: u.isAdmin ? "admin" : "user",
    plan: u.plan,
    monthly_credits: u.monthly_credits ?? 0,
    purchased_credits: u.purchased_credits ?? 0,
    total_credits: (u.monthly_credits ?? 0) + (u.purchased_credits ?? 0),
    daily_usage: u.daily_usage_count ?? 0,
    articles_used: extras.articles_used,
    sites_used: extras.sites_used,
    subscription_status: u.plan === "free" ? null : "active",
    created_at: u.createdAt,
    is_admin: u.isAdmin,
    api_key: u.apiKey,
    bot_code: u.botCode,
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

// GET /admin/usage
router.get("/usage", requireAdmin, async (_req, res) => {
  const [usersRow] = await db.select({ count: count() }).from(usersTable);
  const plans = await db.select().from(plansTable).where(eq(plansTable.is_active, true));
  return res.json({
    total_users: Number(usersRow.count),
    pending_payments: await db.select({ count: count() }).from(paymentRequestsTable).where(eq(paymentRequestsTable.status, "pending")).then(r => Number(r[0]?.count ?? 0)),
    plan_breakdown: plans.map((p) => ({ plan: p.slug, count: 0 })),
  });
});

// GET /admin/users
router.get("/users", requireAdmin, async (_req, res) => {
  const users = await db.select().from(usersTable);
  const formatted = await Promise.all(users.map(async (u) => {
    const [articlesRow] = await db.select({ count: count() }).from(articlesTable)
      .where(eq(articlesTable.user_id, u.id));
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
  const { plan, isAdmin } = req.body;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) return res.status(404).json({ error: "User not found" });

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (plan !== undefined) updates.plan = plan;
  if (isAdmin !== undefined) updates.isAdmin = isAdmin;

  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();

  // Auto-void any pending plan_upgrade requests when plan is manually changed
  if (plan !== undefined) {
    invalidateEffectiveLimitsCache(id);
    await db.update(paymentRequestsTable).set({
      status: "cancelled",
      adminNotes: "Voided automatically — plan was updated manually by admin.",
      updatedAt: new Date(),
    }).where(and(
      eq(paymentRequestsTable.userId, id),
      eq(paymentRequestsTable.status, "pending"),
      eq(paymentRequestsTable.type, "plan_upgrade"),
    ));
  }

  return res.json(formatUser(updated, { articles_used: 0, sites_used: 0 }));
});

// POST /admin/users/:id/grant-points
router.post("/users/:id/grant-points", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { amount, description, type } = req.body;
  if (!amount || isNaN(Number(amount))) return res.status(400).json({ error: "amount is required" });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) return res.status(404).json({ error: "User not found" });

  const delta = Number(amount);
  const newPurchased = Math.max(0, (user.purchased_credits ?? 0) + delta);

  const [updated] = await db.update(usersTable)
    .set({ purchased_credits: newPurchased })
    .where(eq(usersTable.id, id)).returning();

  await db.insert(creditTransactionsTable).values({
    userId: id,
    type: delta > 0 ? (type || "earn") : "spend",
    amount: delta,
    description: description || (delta > 0 ? "منح الأدمن" : "خصم الأدمن"),
    service: "admin",
  });

  return res.json(formatUser(updated, { articles_used: 0, sites_used: 0 }));
});

// POST /admin/users/:id/change-plan
router.post("/users/:id/change-plan", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { plan_name, grant_credits } = req.body;
  if (!plan_name) return res.status(400).json({ error: "plan_name is required" });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) return res.status(404).json({ error: "User not found" });

  const [plan] = await db.select().from(plansTable).where(eq(plansTable.slug, plan_name)).limit(1);
  const planMonthlyCredits = plan?.monthly_credits ?? 0;

  const setUpdates: Partial<typeof usersTable.$inferInsert> = {
    plan: plan_name,
    credits_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  };

  if (grant_credits !== false && planMonthlyCredits > 0) {
    setUpdates.monthly_credits = planMonthlyCredits;
  }

  const [updated] = await db.update(usersTable).set(setUpdates).where(eq(usersTable.id, id)).returning();
  invalidateEffectiveLimitsCache(id);

  if (grant_credits !== false && planMonthlyCredits > 0) {
    await db.insert(creditTransactionsTable).values({
      userId: id,
      type: "earn",
      amount: planMonthlyCredits,
      description: `تفعيل باقة: ${plan?.name ?? plan_name} (${planMonthlyCredits} نقطة شهرية)`,
      service: "subscription",
    });
  }

  return res.json(formatUser(updated, { articles_used: 0, sites_used: 0 }));
});

// DELETE /admin/users/:id
router.delete("/users/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string);
  await db.delete(usersTable).where(eq(usersTable.id, id));
  return res.json({ success: true });
});

// GET /admin/plans
router.get("/plans", requireAdmin, async (_req, res) => {
  const plans = await db.select().from(plansTable).orderBy(plansTable.sort_order);
  return res.json({ plans: plans.map(formatPlan) });
});

// POST /admin/plans
router.post("/plans", requireAdmin, async (req, res) => {
  const body = req.body;
  if (!body.slug) return res.status(400).json({ error: "slug is required" });

  const [plan] = await db.insert(plansTable).values({
    name: body.name || body.slug,
    slug: body.slug,
    description: body.description,
    monthly_credits: body.monthly_credits ?? 0,
    max_sites: body.max_sites ?? 1,
    max_templates: body.max_templates ?? 5,
    max_saved_designs: body.max_saved_designs ?? 10,
    has_blog_automation: body.has_blog_automation ?? false,
    has_image_generator: body.has_image_generator ?? true,
    has_ai_image_generation: body.has_ai_image_generation ?? false,
    has_telegram_bot: body.has_telegram_bot ?? false,
    has_api_access: body.has_api_access ?? false,
    has_overlay_upload: body.has_overlay_upload ?? false,
    has_custom_watermark: body.has_custom_watermark ?? false,
    has_priority_processing: body.has_priority_processing ?? false,
    has_priority_support: body.has_priority_support ?? false,
    rate_limit_daily: body.rate_limit_daily ?? 50,
    rate_limit_hourly: body.rate_limit_hourly ?? 20,
    price_monthly: body.price_monthly ?? 0,
    price_yearly: body.price_yearly ?? 0,
    sort_order: body.sort_order ?? 0,
    is_active: body.is_active !== false,
    is_free: body.is_free ?? false,
  }).returning();

  return res.status(201).json(formatPlan(plan));
});

// PUT /admin/plans/:id
router.put("/plans/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string);
  const [existing] = await db.select().from(plansTable).where(eq(plansTable.id, id)).limit(1);
  if (!existing) return res.status(404).json({ error: "Plan not found" });

  const body = req.body;
  const updates: Partial<typeof plansTable.$inferInsert> = { updatedAt: new Date() };
  const fields = [
    "name","description","monthly_credits","max_sites","max_templates","max_saved_designs",
    "has_blog_automation","has_image_generator","has_ai_image_generation","has_telegram_bot","has_api_access",
    "has_overlay_upload","has_custom_watermark","has_priority_processing","has_priority_support",
    "rate_limit_daily","rate_limit_hourly","price_monthly","price_yearly","sort_order","is_active","is_free",
  ] as const;

  for (const f of fields) {
    if (body[f] !== undefined) (updates as any)[f] = body[f];
  }

  const [updated] = await db.update(plansTable).set(updates).where(eq(plansTable.id, id)).returning();
  return res.json(formatPlan(updated));
});

// DELETE /admin/plans/:id
router.delete("/plans/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string);
  await db.delete(plansTable).where(eq(plansTable.id, id));
  return res.json({ success: true });
});

// GET /admin/settings
router.get("/settings", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(systemSettingsTable);
  const settings: Record<string, string> = {};
  for (const row of rows) settings[row.key] = row.value ?? "";
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
  invalidateSettingsCache();
  const rows = await db.select().from(systemSettingsTable);
  const settings: Record<string, string> = {};
  for (const row of rows) settings[row.key] = row.value ?? "";
  return res.json({ settings });
});

// POST /admin/test-ai
router.post("/test-ai", requireAdmin, async (req, res) => {
  const { provider, api_key, base_url, model, use_stored_key } = req.body as {
    provider: string; api_key?: string; base_url?: string; model?: string; use_stored_key?: boolean;
  };

  let resolvedKey = api_key ?? "";

  // Allow using stored keys from system settings instead of raw keys
  if (use_stored_key || !resolvedKey) {
    const settRows = await db.select().from(systemSettingsTable);
    const sett: Record<string, string> = {};
    for (const r of settRows) sett[r.key] = r.value ?? "";

    if (provider === "openrouter") resolvedKey = sett["openrouter_api_key_1"] ?? "";
    else if (provider === "openai") resolvedKey = sett["openai_api_key"] ?? "";
    else if (provider === "custom") resolvedKey = sett["custom_ai_key"] ?? "";
  }

  if (!resolvedKey) return res.status(400).json({ ok: false, error: "API key is required (provide one or use stored key)" });

  try {
    let endpoint = "";
    let headers: Record<string, string> = { "Content-Type": "application/json", "Authorization": `Bearer ${resolvedKey}` };
    let body: Record<string, unknown> = { model: model || "openai/gpt-4o-mini", messages: [{ role: "user", content: "Say OK" }], max_tokens: 5 };

    if (provider === "openrouter") { endpoint = "https://openrouter.ai/api/v1/chat/completions"; headers["HTTP-Referer"] = "https://newscard.pro"; }
    else if (provider === "openai") { endpoint = "https://api.openai.com/v1/chat/completions"; body.model = model || "gpt-4o-mini"; }
    else if (provider === "anthropic") {
      endpoint = "https://api.anthropic.com/v1/messages";
      headers = { "Content-Type": "application/json", "x-api-key": resolvedKey, "anthropic-version": "2023-06-01" };
      body = { model: model || "claude-3-haiku-20240307", max_tokens: 5, messages: [{ role: "user", content: "Say OK" }] };
    } else if (provider === "custom" && base_url) {
      endpoint = base_url.replace(/\/$/, "") + "/chat/completions";
    } else { return res.status(400).json({ ok: false, error: "Unknown provider" }); }

    const resp = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
    if (resp.ok) return res.json({ ok: true, message: "Connection successful" });
    const txt = await resp.text();
    // Mask any API keys that might appear in error response
    const sanitizedTxt = txt.replace(/sk-[a-zA-Z0-9]{10,}/g, "sk-****").replace(/key_[a-zA-Z0-9]{10,}/g, "key_****");
    return res.json({ ok: false, error: `HTTP ${resp.status}: ${sanitizedTxt.slice(0, 200)}` });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const sanitizedMsg = msg.replace(/sk-[a-zA-Z0-9]{10,}/g, "sk-****").replace(/key_[a-zA-Z0-9]{10,}/g, "key_****");
    return res.json({ ok: false, error: sanitizedMsg });
  }
});

// GET /admin/images
router.get("/images", requireAdmin, async (_req, res) => {
  const images = await db.select({
    id: generatedImagesTable.id, userId: generatedImagesTable.userId,
    title: generatedImagesTable.title, imageUrl: generatedImagesTable.imageUrl,
    aspectRatio: generatedImagesTable.aspectRatio, bannerColor: generatedImagesTable.bannerColor,
    createdAt: generatedImagesTable.createdAt,
  }).from(generatedImagesTable).orderBy(generatedImagesTable.createdAt).limit(120);
  return res.json({ images });
});

// Template approval
router.get("/pending-templates", requireAdmin, async (_req, res) => {
  const pending = await db.select().from(templatesTable)
    .where(and(isNull(templatesTable.isApproved), eq(templatesTable.isSystem, true)));
  return res.json(pending.map(t => ({ ...t, canvasLayout: t.canvasLayout ? JSON.parse(t.canvasLayout) : null })));
});

router.post("/templates/:id/approve", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string);
  const [updated] = await db.update(templatesTable).set({ isApproved: true, updatedAt: new Date() }).where(eq(templatesTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Template not found" });
  return res.json({ success: true, id });
});

router.post("/templates/:id/reject", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string);
  const [updated] = await db.update(templatesTable).set({ isApproved: false, updatedAt: new Date() }).where(eq(templatesTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Template not found" });
  return res.json({ success: true, id });
});

router.delete("/templates/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string);
  await db.delete(templatesTable).where(eq(templatesTable.id, id));
  return res.json({ success: true });
});

// POST /admin/ai-generate-template
router.post("/ai-generate-template", requireAdmin, async (req, res) => {
  const { description, imageBase64, imageMimeType } = req.body as { description?: string; imageBase64?: string; imageMimeType?: string };
  const settRows = await db.select().from(systemSettingsTable);
  const sett: Record<string, string> = {};
  for (const r of settRows) sett[r.key] = r.value;

  const genProvider = sett["ai_provider_template_gen"] ?? "replit_openai";
  const genModel    = sett["ai_model_template_gen"]   ?? "";

  let endpoint = "";
  let reqHeaders: Record<string, string> = { "Content-Type": "application/json" };
  let model = genModel;

  if (genProvider === "replit_openai") {
    const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    const apiKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    if (!baseUrl || !apiKey) return res.status(503).json({ error: "Replit AI integration not configured." });
    endpoint = `${baseUrl}/chat/completions`;
    reqHeaders["Authorization"] = `Bearer ${apiKey}`;
    model = model || "gpt-5.2";
  } else if (genProvider === "openrouter") {
    const key = sett["openrouter_api_key_1"] ?? "";
    if (!key) return res.status(503).json({ error: "OpenRouter API Key not set." });
    endpoint = "https://openrouter.ai/api/v1/chat/completions";
    reqHeaders["Authorization"] = `Bearer ${key}`;
    reqHeaders["HTTP-Referer"] = "https://newscard.pro";
    model = model || "openai/gpt-4o";
  } else if (genProvider === "openai") {
    const key = sett["openai_api_key"] ?? "";
    if (!key) return res.status(503).json({ error: "OpenAI API key not set." });
    endpoint = "https://api.openai.com/v1/chat/completions";
    reqHeaders["Authorization"] = `Bearer ${key}`;
    model = model || "gpt-4o";
  } else {
    const slot = genProvider === "custom" ? 1 : genProvider === "custom_2" ? 2 : 3;
    const prefix = slot === 1 ? "custom_1" : `custom_${slot}`;
    const key  = sett[`${prefix}_key`] ?? "";
    const base = sett[`${prefix}_base_url`] ?? "";
    if (!base) return res.status(503).json({ error: `Custom AI base URL not set.` });
    endpoint = `${base.replace(/\/$/, "")}/chat/completions`;
    if (key) reqHeaders["Authorization"] = `Bearer ${key}`;
    model = model || sett[`${prefix}_model_main`] || "llama3";
  }

  if (!endpoint) return res.status(503).json({ error: "AI provider not configured." });

  const systemPrompt = `You are a professional news card template designer. Generate a canvas layout JSON for a 540×540px news card template.
Canvas element types: bg, photo, text, badge, rect, circle, logo, social.
Every element MUST have: { id, type, x, y, w, h, zIndex }
Return ONLY valid JSON: { "width": 540, "height": 540, "elements": [...] }`;

  const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
  if (imageBase64 && imageMimeType) userContent.push({ type: "image_url", image_url: { url: `data:${imageMimeType};base64,${imageBase64}` } });
  userContent.push({ type: "text", text: description?.trim() || "Create a modern news card template." });

  const supportsJsonMode = ["replit_openai", "openai"].includes(genProvider);
  try {
    const aiRes = await fetch(endpoint, {
      method: "POST", headers: reqHeaders,
      body: JSON.stringify({ model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userContent }], max_completion_tokens: 4096, ...(supportsJsonMode ? { response_format: { type: "json_object" } } : {}) }),
    });
    if (!aiRes.ok) { const text = await aiRes.text(); return res.status(502).json({ error: `AI API error ${aiRes.status}: ${text.slice(0, 300)}` }); }
    const data = await aiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return res.status(502).json({ error: "Empty response from AI" });
    let layout: unknown;
    try { layout = JSON.parse(content); } catch { return res.status(502).json({ error: "AI returned invalid JSON" }); }
    return res.json({ layout });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── GET /admin/payments ──────────────────────────────────────────────────────
router.get("/payments", requireAdmin, async (req, res) => {
  try {
    const { status } = req.query as { status?: string };
    const rows = await db
      .select({
        id:            paymentRequestsTable.id,
        userId:        paymentRequestsTable.userId,
        type:          paymentRequestsTable.type,
        planId:        paymentRequestsTable.planId,
        addonId:       paymentRequestsTable.addonId,
        pointsAmount:  paymentRequestsTable.pointsAmount,
        paymentMethod: paymentRequestsTable.paymentMethod,
        proofDetails:  paymentRequestsTable.proofDetails,
        status:        paymentRequestsTable.status,
        adminNotes:    paymentRequestsTable.adminNotes,
        createdAt:     paymentRequestsTable.createdAt,
        updatedAt:     paymentRequestsTable.updatedAt,
        userName:      usersTable.name,
        userEmail:     usersTable.email,
        userPlan:      usersTable.plan,
        planName:      plansTable.name,
        planSlug:      plansTable.slug,
        addonName:     planAddonsTable.name,
        addonSlug:     planAddonsTable.slug,
        addonPrice:    planAddonsTable.price,
        addonType:     planAddonsTable.type,
      })
      .from(paymentRequestsTable)
      .leftJoin(usersTable, eq(paymentRequestsTable.userId, usersTable.id))
      .leftJoin(plansTable, eq(paymentRequestsTable.planId, plansTable.id))
      .leftJoin(planAddonsTable, eq(paymentRequestsTable.addonId as any, planAddonsTable.id))
      .where(status ? eq(paymentRequestsTable.status, status) : undefined)
      .orderBy(desc(paymentRequestsTable.createdAt));
    return res.json({ requests: rows });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── GET /admin/addons ── list all addons with subscriber count ────────────────
router.get("/addons", requireAdmin, async (_req, res) => {
  const addons = await db.select().from(planAddonsTable).orderBy(planAddonsTable.id);
  const counts = await db
    .select({ addonId: userAddonsTable.addonId, cnt: count() })
    .from(userAddonsTable)
    .where(eq(userAddonsTable.isActive, true))
    .groupBy(userAddonsTable.addonId);
  const cntMap = Object.fromEntries(counts.map(c => [c.addonId, Number(c.cnt)]));
  return res.json({ addons: addons.map(a => ({ ...a, subscriber_count: cntMap[a.id] ?? 0 })) });
});

// ── POST /admin/addons ── create addon ────────────────────────────────────────
router.post("/addons", requireAdmin, async (req, res) => {
  const body = req.body as any;
  const [row] = await db.insert(planAddonsTable).values({
    name: body.name,
    slug: body.slug,
    type: body.type,
    credits_amount: body.credits_amount ?? 0,
    feature_key: body.feature_key ?? null,
    limit_key: body.limit_key ?? null,
    limit_value: body.limit_value ?? null,
    price: body.price ?? 0,
    is_recurring: body.is_recurring ?? false,
    is_active: body.is_active ?? true,
  }).returning();
  return res.status(201).json(row);
});

// ── PUT /admin/addons/:id ── update addon ─────────────────────────────────────
router.put("/addons/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const body = req.body as any;
  const updates: Record<string, any> = {};
  if (body.name !== undefined)          updates.name = body.name;
  if (body.slug !== undefined)          updates.slug = body.slug;
  if (body.type !== undefined)          updates.type = body.type;
  if (body.credits_amount !== undefined) updates.credits_amount = body.credits_amount;
  if (body.feature_key !== undefined)   updates.feature_key = body.feature_key;
  if (body.limit_key !== undefined)     updates.limit_key = body.limit_key;
  if (body.limit_value !== undefined)   updates.limit_value = body.limit_value;
  if (body.price !== undefined)         updates.price = body.price;
  if (body.is_recurring !== undefined)  updates.is_recurring = body.is_recurring;
  if (body.is_active !== undefined)     updates.is_active = body.is_active;
  const [row] = await db.update(planAddonsTable).set(updates).where(eq(planAddonsTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "Addon not found" });
  return res.json(row);
});

// ── DELETE /admin/addons/:id ── deactivate addon ──────────────────────────────
router.delete("/addons/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const [row] = await db.update(planAddonsTable).set({ is_active: false }).where(eq(planAddonsTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "Addon not found" });
  return res.json({ success: true, addon: row });
});

// ── GET /admin/addons/:id/subscribers ── who has this addon ───────────────────
router.get("/addons/:id/subscribers", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const rows = await db
    .select({
      userAddonId: userAddonsTable.id,
      userId: userAddonsTable.userId,
      purchasedAt: userAddonsTable.purchasedAt,
      expiresAt: userAddonsTable.expiresAt,
      isActive: userAddonsTable.isActive,
      userName: usersTable.name,
      userEmail: usersTable.email,
      userPlan: usersTable.plan,
    })
    .from(userAddonsTable)
    .innerJoin(usersTable, eq(userAddonsTable.userId, usersTable.id))
    .where(eq(userAddonsTable.addonId, id))
    .orderBy(desc(userAddonsTable.purchasedAt));
  return res.json({ subscribers: rows });
});

// ── POST /admin/users/:userId/addons ── grant addon to user ──────────────────
router.post("/users/:userId/addons", requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const { addonId, expiresAt } = req.body as { addonId: number; expiresAt?: string };
  if (!addonId) return res.status(400).json({ error: "addonId is required" });

  const [addon] = await db.select().from(planAddonsTable).where(eq(planAddonsTable.id, addonId)).limit(1);
  if (!addon) return res.status(404).json({ error: "Addon not found" });

  // Deactivate any existing instance first
  await db.update(userAddonsTable).set({ isActive: false })
    .where(and(eq(userAddonsTable.userId, userId), eq(userAddonsTable.addonId, addonId)));

  const [row] = await db.insert(userAddonsTable).values({
    userId,
    addonId,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    isActive: true,
  }).returning();

  // Apply credits immediately for credit-type addons
  if (addon.type === "credits" && addon.credits_amount && addon.credits_amount > 0) {
    const [user] = await db.select({ purchased_credits: usersTable.purchased_credits }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (user) {
      await db.update(usersTable).set({ purchased_credits: (user.purchased_credits ?? 0) + addon.credits_amount }).where(eq(usersTable.id, userId));
      await db.insert(creditTransactionsTable).values({
        userId, type: "image_generator", delta: addon.credits_amount,
        note: `Addon granted: ${addon.name}`,
      } as any);
    }
  }

  invalidateEffectiveLimitsCache(userId);
  return res.status(201).json(row);
});

// ── DELETE /admin/users/:userId/addons/:addonId ── revoke addon ───────────────
router.delete("/users/:userId/addons/:addonId", requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const addonId = parseInt(req.params.addonId, 10);

  await db.update(userAddonsTable).set({ isActive: false })
    .where(and(eq(userAddonsTable.userId, userId), eq(userAddonsTable.addonId, addonId), eq(userAddonsTable.isActive, true)));

  invalidateEffectiveLimitsCache(userId);
  return res.json({ success: true });
});

// ── POST /admin/payments/:id/approve ────────────────────────────────────────
router.post("/payments/:id/approve", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { adminNotes } = req.body as { adminNotes?: string };

    const [request] = await db
      .select().from(paymentRequestsTable)
      .where(eq(paymentRequestsTable.id, id))
      .limit(1);
    if (!request) return res.status(404).json({ error: "Payment request not found" });
    if (request.status !== "pending") return res.status(400).json({ error: "Request is not pending" });

    if (request.type === "plan_upgrade" && request.planId) {
      const [plan] = await db
        .select().from(plansTable)
        .where(eq(plansTable.id, request.planId))
        .limit(1);
      if (plan) {
        await db.update(usersTable).set({
          plan: plan.slug,
          monthly_credits: plan.monthly_credits,
        }).where(eq(usersTable.id, request.userId));
        invalidateEffectiveLimitsCache(request.userId);
      }
    } else if (request.type === "points_purchase" && request.pointsAmount) {
      const [user] = await db
        .select({ purchased_credits: usersTable.purchased_credits })
        .from(usersTable)
        .where(eq(usersTable.id, request.userId))
        .limit(1);
      if (user) {
        await db.update(usersTable).set({
          purchased_credits: (user.purchased_credits ?? 0) + request.pointsAmount,
        }).where(eq(usersTable.id, request.userId));
      }
    } else if (request.type === "addon_purchase" && (request as any).addonId) {
      const addonId = (request as any).addonId as number;
      const [addon] = await db.select().from(planAddonsTable).where(eq(planAddonsTable.id, addonId)).limit(1);
      if (addon) {
        // Deactivate any prior instance
        await db.update(userAddonsTable).set({ isActive: false })
          .where(and(eq(userAddonsTable.userId, request.userId), eq(userAddonsTable.addonId, addonId)));

        // Insert active addon
        await db.insert(userAddonsTable).values({
          userId: request.userId,
          addonId,
          expiresAt: addon.is_recurring ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
          isActive: true,
        });

        // Apply effect immediately for credits type
        if (addon.type === "credits" && addon.credits_amount && addon.credits_amount > 0) {
          const [user] = await db.select({ purchased_credits: usersTable.purchased_credits }).from(usersTable).where(eq(usersTable.id, request.userId)).limit(1);
          if (user) {
            await db.update(usersTable).set({ purchased_credits: (user.purchased_credits ?? 0) + addon.credits_amount }).where(eq(usersTable.id, request.userId));
            await db.insert(creditTransactionsTable).values({
              userId: request.userId, type: "image_generator", delta: addon.credits_amount,
              note: `Addon purchased: ${addon.name}`,
            } as any);
          }
        }

        invalidateEffectiveLimitsCache(request.userId);
      }
    }

    const [updated] = await db.update(paymentRequestsTable).set({
      status: "approved",
      adminNotes: adminNotes ?? null,
      updatedAt: new Date(),
    }).where(eq(paymentRequestsTable.id, id)).returning();

    return res.json({ success: true, request: updated });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── POST /admin/payments/:id/deny ────────────────────────────────────────────
router.post("/payments/:id/deny", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { adminNotes } = req.body as { adminNotes?: string };

    const [request] = await db
      .select().from(paymentRequestsTable)
      .where(eq(paymentRequestsTable.id, id))
      .limit(1);
    if (!request) return res.status(404).json({ error: "Payment request not found" });

    const [updated] = await db.update(paymentRequestsTable).set({
      status: "rejected",
      adminNotes: adminNotes ?? null,
      updatedAt: new Date(),
    }).where(eq(paymentRequestsTable.id, id)).returning();

    return res.json({ success: true, request: updated });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── Nanobanana Management ───────────────────────────────────────────────────

router.get("/nanobanana/status", requireAdmin, async (_req, res) => {
  try {
    const settRows = await db.select().from(systemSettingsTable);
    const sett: Record<string, string> = {};
    for (const r of settRows) sett[r.key] = r.value ?? "";

    // We can't easily get activeRequests/queueLength from here without exporting them,
    // but we can return the current config from DB.
    return res.json({
      enabled: sett["nanobanana_enabled"] !== "false",
      config: {
        pageUrl: sett["nanobanana_page_url"] || "https://veoaifree.com/...",
        ajaxUrl: sett["nanobanana_ajax_url"] || "https://veoaifree.com/wp-admin/...",
        timeoutMs: parseInt(sett["nanobanana_timeout_ms"] || "180000", 10),
        nonceCacheMin: parseInt(sett["nanobanana_nonce_cache_min"] || "30", 10),
        maxConcurrent: parseInt(sett["nanobanana_max_concurrent"] || "1", 10),
        queueEnabled: sett["nanobanana_queue_enabled"] !== "false",
        retryCount: parseInt(sett["nanobanana_retry_count"] || "1", 10),
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/nanobanana/test", requireAdmin, async (_req, res) => {
  const result = await testNanobananaConnection();
  return res.json({
    ...result,
    testedAt: new Date().toISOString()
  });
});

router.post("/nanobanana/clear-cache", requireAdmin, async (_req, res) => {
  clearNanobananaCache();
  return res.json({ success: true });
});

router.post("/openai/test", requireAdmin, async (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey) return res.status(400).json({ success: false, error: "API Key is required" });
  try {
    const r = await fetch("https://api.openai.com/v1/models", {
      headers: { "Authorization": `Bearer ${apiKey}` }
    });
    if (r.ok) return res.json({ success: true });
    const d = await r.json();
    return res.status(400).json({ success: false, error: d.error?.message || "Invalid Key" });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
