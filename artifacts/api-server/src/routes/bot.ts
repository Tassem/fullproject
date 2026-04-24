import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable, systemSettingsTable, plansTable,
  templatesTable, generatedImagesTable,
} from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { renderCard } from "../lib/cardRenderer";
import fs from "fs";
import path from "path";

const router = Router();

// ── In-memory pending-card sessions ─────────────────────────────────────────
// chatId → pending card data (waiting for user to send photo or /skip)
interface PendingCard {
  title: string;
  label?: string;
  ratio: string;
  bannerColor: string;
  textColor: string;
  font: string;
  templateId: number | null;
  templateName: string;
  canvasLayout: string | null;    // raw JSON from DB, used by canvas renderer
  userId: number;
  userBotCode: string;
  expiresAt: number; // epoch ms — auto-expire after 5 minutes
}

const pendingSessions = new Map<number, PendingCard>();

// Clean up expired sessions every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [chatId, session] of pendingSessions.entries()) {
    if (session.expiresAt < now) pendingSessions.delete(chatId);
  }
}, 2 * 60 * 1000);

// ── Built-in templates (mirrors generate.tsx TEMPLATES array exactly) ────────
const BUILTIN_TEMPLATES: Record<string, { bannerColor: string; textColor: string; font: string }> = {
  "classic-blue":  { bannerColor: "#0f2557", textColor: "#ffffff",  font: "Cairo" },
  "breaking-red":  { bannerColor: "#7f1d1d", textColor: "#ffffff",  font: "Cairo" },
  "modern-black":  { bannerColor: "#0a0a0a", textColor: "#f5f5f5",  font: "Cairo" },
  "emerald":       { bannerColor: "#064e3b", textColor: "#ffffff",  font: "Cairo" },
  "royal-purple":  { bannerColor: "#3b0764", textColor: "#ffffff",  font: "Cairo" },
  "gold":          { bannerColor: "#78350f", textColor: "#fef3c7",  font: "Cairo" },
  "midnight":      { bannerColor: "#1e1b4b", textColor: "#e0e7ff",  font: "Cairo" },
  "slate-fade":    { bannerColor: "#020617", textColor: "#ffffff",  font: "Cairo" },
  "white-quote":   { bannerColor: "#ffffff", textColor: "#111111",  font: "Cairo" },
  "purple-wave":   { bannerColor: "#7c3aed", textColor: "#ffffff",  font: "Cairo" },
  "crimson":       { bannerColor: "#dc2626", textColor: "#ffffff",  font: "Cairo" },
};

// Alias map for template names/numbers as shown in bot.tsx
const TEMPLATE_ALIASES: Record<string, string> = {
  // by number
  "1": "classic-blue",   "2": "breaking-red",  "3": "modern-black",
  "4": "emerald",        "5": "royal-purple",   "6": "gold",
  "7": "midnight",       "8": "slate-fade",     "9": "white-quote",
  "10": "purple-wave",   "11": "crimson",
  // by short name (case-insensitive handled during lookup)
  "classic":   "classic-blue",
  "breaking":  "breaking-red",
  "modern":    "modern-black",
  "royal":     "royal-purple",
  "gradient":  "slate-fade",
  "white":     "white-quote",
  "wave":      "purple-wave",
};

// Resolve template slug from user's input string
function resolveBuiltinSlug(input: string): string | null {
  const low = input.toLowerCase().trim();
  if (BUILTIN_TEMPLATES[low]) return low;
  if (TEMPLATE_ALIASES[low]) return TEMPLATE_ALIASES[low];
  return null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getTelegramToken(): Promise<string | null> {
  const env = process.env.TELEGRAM_BOT_TOKEN;
  if (env) return env;
  const [row] = await db
    .select()
    .from(systemSettingsTable)
    .where(eq(systemSettingsTable.key, "telegram_bot_token"))
    .limit(1);
  return row?.value ?? null;
}

async function verifyToken(token: string): Promise<{ ok: boolean; username?: string }> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const d = await r.json() as { ok: boolean; result?: { username?: string } };
    return d.ok ? { ok: true, username: d.result?.username } : { ok: false };
  } catch { return { ok: false }; }
}

async function sendTelegramMessage(
  token: string,
  chatId: string | number,
  text: string,
  parseMode: "HTML" | "Markdown" = "HTML",
) {
  return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
  });
}

async function sendTelegramPhoto(
  token: string,
  chatId: string | number,
  photoUrl: string,
  caption?: string,
) {
  return fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      photo: photoUrl,
      caption: caption ?? "",
      parse_mode: "HTML",
    }),
  });
}

// Image generation using placehold.co — works with Telegram sendPhoto
function generateCardUrl(
  title: string,
  bannerColor: string,
  textColor: string,
  ratio: string,
): string {
  // Dimensions per ratio (mirrors ASPECT_RATIOS in generate.tsx)
  const dims: Record<string, { w: number; h: number }> = {
    "1:1":  { w: 1080, h: 1080 },
    "16:9": { w: 1280, h: 720  },
    "4:5":  { w: 1080, h: 1350 },
    "9:16": { w: 750,  h: 1334 },
  };
  const { w, h } = dims[ratio] ?? dims["16:9"];
  const encoded = encodeURIComponent(title.slice(0, 80).replace(/\n/g, " "));
  const bg = bannerColor.replace(/^#/, "");
  const fg = textColor.replace(/^#/, "");
  return `https://placehold.co/${w}x${h}/${bg}/${fg}/png?text=${encoded}&font=montserrat`;
}

// Lookup template colors: user saved templates → system/admin templates → built-in
async function resolveTemplate(
  userId: number,
  templateInput: string,
): Promise<{ bannerColor: string; textColor: string; font: string; templateId: number | null; resolvedName: string; canvasLayout: string | null; ratio: string | null }> {
  const defaults = { bannerColor: "#0f2557", textColor: "#ffffff", font: "Cairo" };

  // 1. User's saved templates (by exact name, case-insensitive)
  // Helper to format a DB template record into return value
  const fromDbTmpl = (t: typeof templatesTable.$inferSelect) => ({
    bannerColor:  t.bannerColor  || defaults.bannerColor,
    textColor:    t.textColor    || defaults.textColor,
    font:         t.font         || defaults.font,
    templateId:   t.id,
    resolvedName: t.name         || templateInput,
    canvasLayout: t.canvasLayout || null,
    ratio:        t.aspectRatio  || null,
  });

  // 1a. Lookup by numeric ID (e.g., "2" → template id=2)
  const numId = parseInt(templateInput.trim(), 10);
  if (!isNaN(numId)) {
    // First check user's templates, then any system template
    const [byId] = await db
      .select()
      .from(templatesTable)
      .where(eq(templatesTable.id, numId))
      .limit(1);
    if (byId) return fromDbTmpl(byId);
  }

  // 1b. User's saved templates (by exact name, case-insensitive)
  const [userTmpl] = await db
    .select()
    .from(templatesTable)
    .where(eq(templatesTable.userId, userId))
    .orderBy(desc(templatesTable.updatedAt))
    .limit(100)
    .then(rows => rows.filter(r =>
      r.name?.toLowerCase() === templateInput.toLowerCase(),
    ));

  if (userTmpl) return fromDbTmpl(userTmpl);

  // 2. System/admin templates (by name, case-insensitive)
  const [sysTmpl] = await db
    .select()
    .from(templatesTable)
    .where(sql`LOWER(${templatesTable.name}) = LOWER(${templateInput})`)
    .limit(1);

  if (sysTmpl) return fromDbTmpl(sysTmpl);

  // 3. Built-in templates
  const slug = resolveBuiltinSlug(templateInput);
  if (slug && BUILTIN_TEMPLATES[slug]) {
    const t = BUILTIN_TEMPLATES[slug];
    return {
      ...t,
      templateId: null,
      resolvedName: slug,
      canvasLayout: null,
      ratio: null,
    };
  }

  // Fallback: defaults
  return { ...defaults, templateId: null, resolvedName: "classic-blue", canvasLayout: null, ratio: null };
}

// Parse the structured message format described in bot.tsx:
// template: breaking
// title: Trump Announces New Tariffs
// account: NB-XXXX
// ratio: 16:9   (optional)
// label: CNN    (optional)
function parseCardMessage(text: string): {
  template?: string;
  title?: string;
  account?: string;
  ratio?: string;
  label?: string;
} | null {
  // Must have at least "title:" line
  if (!text.includes("title:")) return null;

  const result: Record<string, string> = {};
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx < 1) continue;
    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const val = line.slice(colonIdx + 1).trim();
    if (key && val) result[key] = val;
  }

  if (!result["title"]) return null;
  return result as { template?: string; title?: string; account?: string; ratio?: string; label?: string };
}

function formatAccountMessage(
  user: typeof usersTable.$inferSelect,
  plan: typeof plansTable.$inferSelect | null,
): string {
  const planName = plan?.name ?? user.plan;
  const dailyUsed = user.daily_usage_count ?? 0;
  const dailyLimit = plan?.rate_limit_daily ?? 50;
  const dailyLeft = Math.max(0, dailyLimit - dailyUsed);
  const monthly = user.monthly_credits ?? 0;
  const purchased = user.purchased_credits ?? 0;
  const totalCredits = monthly + purchased;

  return `👤 <b>Account Information</b>

📛 Name: ${user.name}
📧 Email: ${user.email}
🔑 Bot Code: <code>${user.botCode}</code>

📦 <b>Plan:</b> ${planName}
📊 Today's usage: ${dailyUsed}/${dailyLimit} (${dailyLeft} remaining)
💎 Credits: ${totalCredits} (monthly: ${monthly} + purchased: ${purchased})
${plan?.has_blog_automation ? "✅ Blog Automation: Active\n" : ""}${plan?.has_telegram_bot ? "✅ Telegram Bot: Active" : ""}

Use /help for available commands.`;
}

// ── GET /bot/status ───────────────────────────────────────────────────────────

router.get("/status", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const token = await getTelegramToken();
  if (!token) return res.json({ connected: false, username: null, botCode: user.botCode, token: null });
  const info = await verifyToken(token);
  return res.json({ connected: info.ok, username: info.username ?? null, botCode: user.botCode, token });
});

// ── POST /bot/webhook — Telegram sends updates here ──────────────────────────

router.post("/webhook", async (req, res) => {
  // Always respond immediately so Telegram doesn't retry
  res.json({ ok: true });

  const update = req.body as {
    message?: {
      message_id: number;
      from?: { id: number; first_name?: string; username?: string };
      chat: { id: number; type: string };
      text?: string;
      caption?: string;
      photo?: Array<{ file_id: string; width: number; height: number }>;
    };
  };

  const msg = update.message;
  if (!msg || !msg.from) return;

  const chatId = msg.chat.id;
  const text = (msg.text ?? msg.caption ?? "").trim();
  const token = await getTelegramToken();
  if (!token) return;

  const sendMsg = (t: string) => sendTelegramMessage(token, chatId, t);

  // ── /start ────────────────────────────────────────────────────────────────

  if (text === "/start") {
    await sendMsg(`👋 <b>Welcome to NewsCard Bot!</b>

Send your <b>Bot Secret Code</b> (found in your account settings) to link your account.

Your code looks like: <code>NB-XXXX</code>

After linking, send a card request in this format:

<code>template: breaking
title: Your news headline
account: NB-XXXX</code>

Use /help for all commands.`);
    return;
  }

  // ── /help ─────────────────────────────────────────────────────────────────

  if (text === "/help") {
    await sendMsg(`📋 <b>Available Commands</b>

/start — Welcome & account linking
/templates — List available templates
/status — Your account & card usage
/cards — Cards remaining today
/credits — Check your credits
/skip — Skip background image (generate card now)
/help — Show this message

📝 <b>Card Message Format:</b>
<code>template: breaking
title: Your news headline here
account: NB-XXXX
ratio: 16:9
label: CNN</code>

Then send a background image, or type /skip to generate without one.

<b>Optional fields:</b>
• ratio: 1:1 | 16:9 | 4:5 | 9:16 (default: 1:1)
• label: Source name (e.g. CNN)`);
    return;
  }

  // ── Look up user by telegramChatId (linked account) ───────────────────────

  const [linkedUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.telegramChatId, String(chatId)))
    .limit(1);

  // ── /templates ────────────────────────────────────────────────────────────

  if (text === "/templates") {
    const lines: string[] = [];

    // 1. User's saved templates (if linked)
    if (linkedUser) {
      const userTemplates = await db
        .select()
        .from(templatesTable)
        .where(eq(templatesTable.userId, linkedUser.id))
        .orderBy(desc(templatesTable.updatedAt))
        .limit(20);

      if (userTemplates.length > 0) {
        lines.push(`💾 <b>Your Saved Templates (${userTemplates.length})</b>`);
        for (const t of userTemplates) {
          lines.push(`• <code>${t.name}</code>${t.id ? ` [ID: ${t.id}]` : ""}`);
        }
        lines.push("");
      }
    }

    // 2. API / Admin templates (system templates)
    const apiTemplates = await db
      .select()
      .from(templatesTable)
      .where(sql`${templatesTable.userId} IS NULL AND ${templatesTable.isSystem} = true`)
      .orderBy(desc(templatesTable.updatedAt))
      .limit(20);

    if (apiTemplates.length > 0) {
      lines.push(`🔧 <b>API Templates (${apiTemplates.length})</b>`);
      for (const t of apiTemplates) {
        lines.push(`• <code>${t.name}</code> [ID: ${t.id}]`);
      }
      lines.push("");
    }

    // 3. Built-in templates
    lines.push(`🎨 <b>Built-in Templates</b>
1 • <code>classic-blue</code> — Classic
2 • <code>breaking-red</code> — Breaking
3 • <code>modern-black</code> — Modern
4 • <code>emerald</code> — Emerald
5 • <code>royal-purple</code> — Royal
6 • <code>gold</code> — Gold
7 • <code>midnight</code> — Midnight
8 • <code>slate-fade</code> — Gradient
9 • <code>white-quote</code> — White
10 • <code>purple-wave</code> — Wave
11 • <code>crimson</code> — Crimson`);

    lines.push(`\nUse the name or ID in the <code>template:</code> field.`);
    if (!linkedUser) {
      lines.push(`\n💡 Link your account to see your saved templates.`);
    }

    await sendMsg(lines.join("\n"));
    return;
  }

  // ── Handle pending sessions: /skip or photo ────────────────────────────────

  const pending = pendingSessions.get(chatId);

  if (pending) {
    // /skip — generate without background
    if (text === "/skip") {
      pendingSessions.delete(chatId);
      await generateAndSend(token, chatId, pending, null, sendMsg);
      return;
    }

    // Photo received — generate with photo URL from Telegram
    if (msg.photo && msg.photo.length > 0) {
      pendingSessions.delete(chatId);
      // Get the largest photo's file_id; it will be downloaded and composited into the card
      const bestPhoto = msg.photo[msg.photo.length - 1];
      await generateAndSend(token, chatId, pending, bestPhoto.file_id, sendMsg);
      return;
    }

    // Any other text while waiting — remind user
    if (!text.includes("title:")) {
      await sendMsg(`⏳ Waiting for a background image for your card.

Send a photo or use /skip to generate without background.

To cancel, send a new card message.`);
      return;
    }
    // If they sent a new card message, fall through to parse it (cancel old session)
    pendingSessions.delete(chatId);
  }

  // ── Structured card message: must have "title:" line ─────────────────────

  const parsed = parseCardMessage(text);

  if (parsed?.title) {
    // Identify the user: try account: field first, then linked account, then linking code
    let targetUser: typeof usersTable.$inferSelect | null = linkedUser ?? null;

    if (parsed.account) {
      const accountCode = parsed.account.trim().toUpperCase();
      const [byCode] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.botCode, accountCode))
        .limit(1);
      if (byCode) targetUser = byCode;
    }

    if (!targetUser) {
      await sendMsg(`❌ Account not found.\n\nPlease link your account first by sending your Bot Secret Code, or include <code>account: NB-XXXX</code> in your message.`);
      return;
    }

    const [plan] = await db
      .select()
      .from(plansTable)
      .where(eq(plansTable.slug, targetUser.plan))
      .limit(1);

    // ── Plan enforcement: has_telegram_bot ──────────────────────────────────
    if (plan && !plan.has_telegram_bot) {
      await sendMsg(`🚫 <b>Telegram Bot Not Available</b>\n\nYour current plan (${plan.name}) does not include Telegram Bot access.\n\nPlease upgrade your plan at the platform to use this feature.`);
      return;
    }

    // Check daily rate limit
    const dailyLimit = plan?.rate_limit_daily ?? 50;
    const dailyUsed = targetUser.daily_usage_count ?? 0;
    if (dailyLimit > 0 && dailyUsed >= dailyLimit) {
      await sendMsg(`⚠️ <b>Daily Limit Reached</b>\n\nYou've used all ${dailyLimit} operations today.\nLimit resets at midnight.\n\nUpgrade your plan for a higher limit.`);
      return;
    }

    const templateInput = parsed.template?.trim() ?? "classic-blue";
    const ratio = parsed.ratio?.trim() ?? "1:1";
    const label = parsed.label?.trim() ?? null;

    const resolved = await resolveTemplate(targetUser.id, templateInput);

    // Store pending session — wait for photo or /skip
    const session: PendingCard = {
      title: parsed.title.trim(),
      label,
      ratio: resolved.ratio || ratio,  // use template's aspect ratio if defined
      bannerColor: resolved.bannerColor,
      textColor: resolved.textColor,
      font: resolved.font,
      templateId: resolved.templateId,
      templateName: resolved.resolvedName,
      canvasLayout: resolved.canvasLayout,
      userId: targetUser.id,
      userBotCode: targetUser.botCode ?? "",
      expiresAt: Date.now() + 5 * 60 * 1000,
    };
    pendingSessions.set(chatId, session);

    await sendMsg(`✅ <b>Card ready to generate!</b>

📰 Title: ${session.title.slice(0, 60)}${session.title.length > 60 ? "..." : ""}
🎨 Template: <code>${session.templateName}</code>
📐 Ratio: ${ratio}
${label ? `🏷 Label: ${label}\n` : ""}
Now send a <b>background image</b>, or type /skip to generate without one.`);
    return;
  }

  // ── Commands for linked users ──────────────────────────────────────────────

  if (linkedUser) {
    const [plan] = await db
      .select()
      .from(plansTable)
      .where(eq(plansTable.slug, linkedUser.plan))
      .limit(1);

    if (text === "/status") {
      await sendMsg(formatAccountMessage(linkedUser, plan ?? null));
      return;
    }

    if (text === "/cards") {
      const dailyLimit = plan?.rate_limit_daily ?? 50;
      const dailyUsed = linkedUser.daily_usage_count ?? 0;
      const left = Math.max(0, dailyLimit - dailyUsed);
      await sendMsg(`📊 <b>Today's Usage</b>\n\nUsed: ${dailyUsed}/${dailyLimit}\nRemaining: <b>${left}</b>`);
      return;
    }

    if (text === "/credits") {
      const monthly = linkedUser.monthly_credits ?? 0;
      const purchased = linkedUser.purchased_credits ?? 0;
      await sendMsg(`💎 <b>Credits Balance</b>\n\nMonthly: ${monthly}\nPurchased: ${purchased}\nTotal: <b>${monthly + purchased}</b>`);
      return;
    }

    // Unknown command
    await sendMsg(`❓ Unknown command. Use /help to see available commands.

📝 To create a card, send:
<code>template: breaking
title: Your news headline
account: ${linkedUser.botCode}</code>`);
    return;
  }

  // ── Not linked — try botCode linking ──────────────────────────────────────

  if (text && !text.startsWith("/") && !text.includes("title:")) {
    const cleaned = text.trim().toUpperCase();
    const [foundUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.botCode, cleaned))
      .limit(1);

    if (foundUser) {
      // Link the account
      await db
        .update(usersTable)
        .set({ telegramChatId: String(chatId) })
        .where(eq(usersTable.id, foundUser.id));

      const [plan] = await db
        .select()
        .from(plansTable)
        .where(eq(plansTable.slug, foundUser.plan))
        .limit(1);

      await sendMsg(`✅ <b>Account Linked Successfully!</b>\n\n` + formatAccountMessage(foundUser, plan ?? null) + `\n\n📝 To create a card, send:\n<code>template: breaking\ntitle: Your news headline\naccount: ${foundUser.botCode}</code>`);
      return;
    }
  }

  // Default: not linked
  await sendMsg(`❌ Please link your account first.

Send your <b>Bot Secret Code</b> (found in your account settings on the platform).

Use /start for instructions.`);
});

// ── Download Telegram file as Buffer ─────────────────────────────────────────

async function downloadTelegramFile(token: string, fileId: string): Promise<Buffer | null> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    const data = await r.json() as { ok: boolean; result?: { file_path?: string } };
    if (!data.ok || !data.result?.file_path) return null;
    const fileResp = await fetch(`https://api.telegram.org/file/bot${token}/${data.result.file_path}`);
    if (!fileResp.ok) return null;
    const arrayBuf = await fileResp.arrayBuffer();
    return Buffer.from(arrayBuf);
  } catch {
    return null;
  }
}

// ── Send PNG buffer as photo to Telegram (multipart) ─────────────────────────

async function sendTelegramPhotoBuffer(
  token: string,
  chatId: string | number,
  pngBuffer: Buffer,
  caption: string,
): Promise<{ ok: boolean; description?: string }> {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", caption);
  form.append("parse_mode", "HTML");
  form.append("photo", new Blob([pngBuffer], { type: "image/png" }), "card.png");
  const r = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    body: form,
  });
  return r.json() as Promise<{ ok: boolean; description?: string }>;
}

// ── Generate card and send to Telegram ───────────────────────────────────────

async function generateAndSend(
  token: string,
  chatId: number,
  session: PendingCard,
  photoFileId: string | null,
  sendMsg: (t: string) => Promise<Response>,
) {
  await sendMsg(`⏳ Generating your card...\n\n<i>"${session.title.slice(0, 50)}${session.title.length > 50 ? "..." : ""}"</i>`);

  // Download background photo from Telegram if provided
  let bgBuffer: Buffer | null = null;
  if (photoFileId) {
    bgBuffer = await downloadTelegramFile(token, photoFileId);
    console.log(`[BOT] Photo download: ${bgBuffer ? bgBuffer.length + " bytes" : "FAILED"}`);
  }

  const hasCanvasLayout = !!(session.canvasLayout && session.canvasLayout.trim().length > 5);
  console.log(`[BOT] Rendering card: slug="${session.templateName}" ratio=${session.ratio} canvasLayout=${hasCanvasLayout} hasBg=${!!bgBuffer}`);

  // Render the card as a real PNG using the template design
  let pngBuffer: Buffer;
  try {
    const uploadsDir = path.join(process.cwd(), "uploads");
    pngBuffer = await renderCard({
      title: session.title,
      label: session.label ?? null,
      ratio: session.ratio,
      templateSlug: session.templateName,
      canvasLayout: session.canvasLayout || null,
      uploadsDir,
      bannerColor: session.bannerColor,
      textColor: session.textColor,
      backgroundImageBuffer: bgBuffer,
    });
    console.log(`[BOT] Card rendered: ${pngBuffer.length} bytes (${hasCanvasLayout ? "canvas-layout" : "built-in"} renderer)`);
  } catch (err) {
    console.error("[BOT] Card render error:", err);
    await sendMsg("❌ Failed to generate card image. Please try again.");
    return;
  }

  // Save to DB
  const placeholderUrl = generateCardUrl(session.title, session.bannerColor, session.textColor, session.ratio);
  let savedId: number;
  try {
    const [current] = await db.select().from(usersTable).where(eq(usersTable.id, session.userId)).limit(1);
    const [saved] = await db
      .insert(generatedImagesTable)
      .values({
        userId: session.userId,
        templateId: session.templateId,
        title: session.title,
        subtitle: null,
        label: session.label ?? null,
        imageUrl: placeholderUrl,
        aspectRatio: session.ratio,
        bannerColor: session.bannerColor,
        textColor: session.textColor,
        font: session.font,
      })
      .returning();
    savedId = saved.id;
    await db
      .update(usersTable)
      .set({ daily_usage_count: (current.daily_usage_count ?? 0) + 1 })
      .where(eq(usersTable.id, session.userId));
  } catch (err) {
    console.error("Bot card save error:", err);
    await sendMsg("❌ Failed to save card. Please try again.");
    return;
  }

  const [freshUser] = await db.select().from(usersTable).where(eq(usersTable.id, session.userId)).limit(1);
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.slug, freshUser.plan)).limit(1);
  const dailyLimit = plan?.rate_limit_daily ?? 50;
  const dailyUsed = freshUser.daily_usage_count ?? 0;
  const remaining = Math.max(0, dailyLimit - dailyUsed);
  const totalCredits = (freshUser.monthly_credits ?? 0) + (freshUser.purchased_credits ?? 0);

  const caption = `🎴 <b>${session.title.slice(0, 60)}${session.title.length > 60 ? "..." : ""}</b>${session.label ? `\n🏷 ${session.label}` : ""}

🎨 Template: <code>${session.templateName}</code>
📐 Ratio: ${session.ratio}
📊 Operations remaining today: <b>${remaining}/${dailyLimit}</b>
💎 Credits remaining: <b>${totalCredits}</b>
🆔 Card ID: #${savedId}`;

  // Save PNG locally for debugging (inspect via /api/bot/debug-card/:chatId)
  try {
    fs.writeFileSync(`/tmp/last-card-${chatId}.png`, pngBuffer);
    console.log(`[BOT] Saved card PNG: /tmp/last-card-${chatId}.png (${pngBuffer.length} bytes)`);
  } catch { /* ignore */ }

  // Send the real PNG image as a file to Telegram
  const photoData = await sendTelegramPhotoBuffer(token, chatId, pngBuffer, caption);
  console.log(`[BOT] sendPhoto result: ok=${photoData.ok} desc=${photoData.description ?? ""}`);

  if (!photoData.ok) {
    console.error("sendPhoto failed:", photoData.description);
    await sendMsg(`🎴 <b>Card Generated!</b>

${session.title}
${session.label ? `🏷 ${session.label}\n` : ""}
📊 Cards remaining today: ${remaining}/${cardsDay}
🆔 Card ID: #${savedId}

⚠️ Image delivery failed: ${photoData.description ?? "unknown"}`);
  }
}

// ── GET /bot/test-card — visual debug: serve a test card PNG ─────────────────

router.get("/test-card", async (req: any, res: any) => {
  try {
    const templateInput = String(req.query.template || "classic-blue");
    const ratio = String(req.query.ratio || "1:1");
    const title = String(req.query.title || "خبر عاجل: اختبار التصميم الجديد");
    const label = String(req.query.label || "CNN");

    // Try DB lookup (by ID or name), then fall back to built-ins
    let canvasLayout: string | null = null;
    let resolvedRatio = ratio;
    let templateSlug = templateInput;

    const numId = parseInt(templateInput.trim(), 10);
    if (!isNaN(numId)) {
      const [dbTmpl] = await db.select().from(templatesTable).where(eq(templatesTable.id, numId)).limit(1);
      if (dbTmpl) {
        canvasLayout = dbTmpl.canvasLayout || null;
        resolvedRatio = dbTmpl.aspectRatio || ratio;
        templateSlug = dbTmpl.name || templateInput;
        console.log(`[TEST-CARD] Template #${numId} found: "${templateSlug}" canvasLayout=${!!canvasLayout} ratio=${resolvedRatio}`);
      }
    } else {
      const [dbTmpl] = await db.select().from(templatesTable)
        .where(sql`LOWER(${templatesTable.name}) = LOWER(${templateInput})`).limit(1);
      if (dbTmpl) {
        canvasLayout = dbTmpl.canvasLayout || null;
        resolvedRatio = dbTmpl.aspectRatio || ratio;
        templateSlug = dbTmpl.name || templateInput;
        console.log(`[TEST-CARD] Template "${dbTmpl.name}" found: canvasLayout=${!!canvasLayout}`);
      }
    }

    const uploadsDir = path.join(process.cwd(), "uploads");

    // Optional background photo for testing: ?bg=filename.jpg
    let bgBuffer: Buffer | null = null;
    const bgParam = String(req.query.bg || "");
    if (bgParam) {
      const bgPath = path.join(uploadsDir, path.basename(bgParam));
      if (fs.existsSync(bgPath)) {
        bgBuffer = fs.readFileSync(bgPath);
        console.log(`[TEST-CARD] Background photo loaded: ${bgParam} (${bgBuffer.length} bytes)`);
      } else {
        console.log(`[TEST-CARD] Background photo NOT found: ${bgPath}`);
      }
    }

    const pngBuffer = await renderCard({
      title,
      label,
      ratio: resolvedRatio,
      templateSlug,
      canvasLayout,
      uploadsDir,
      backgroundImageBuffer: bgBuffer,
    });

    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "no-cache");
    res.send(pngBuffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// ── GET /bot/debug-card/:chatId — serve last generated card for a chatId ──────

router.get("/debug-card/:chatId", (req: any, res: any) => {
  const p = `/tmp/last-card-${req.params.chatId}.png`;
  if (!fs.existsSync(p)) return res.status(404).json({ error: "No card found for this chatId" });
  res.set("Content-Type", "image/png");
  res.sendFile(p);
});

// ── POST /bot/setup-webhook ───────────────────────────────────────────────────

router.post("/setup-webhook", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  if (!user.isAdmin) return res.status(403).json({ error: "Admin only" });

  const { webhookUrl } = req.body as { webhookUrl?: string };
  const token = await getTelegramToken();
  if (!token) return res.status(400).json({ error: "No bot token configured" });

  const url =
    webhookUrl ||
    `${
      process.env.REPLIT_DEV_DOMAIN
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : req.protocol + "://" + req.get("host")
    }/api/bot/webhook`;

  const r = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data = await r.json() as { ok: boolean; description?: string };

  if (!data.ok) return res.status(400).json({ error: data.description ?? "Failed to set webhook" });
  return res.json({ success: true, webhookUrl: url });
});

// ── GET /bot/webhook-info ─────────────────────────────────────────────────────

router.get("/webhook-info", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  if (!user.isAdmin) return res.status(403).json({ error: "Admin only" });

  const token = await getTelegramToken();
  if (!token) return res.json({ configured: false });

  const r = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const data = await r.json() as { ok: boolean; result?: { url?: string; pending_update_count?: number } };
  return res.json({ configured: true, webhook: data.result });
});

export default router;
