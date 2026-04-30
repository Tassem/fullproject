/**
 * Public API v1 — designed for external integrations (n8n, Zapier, Make, etc.)
 * Authentication: X-API-Key header or Authorization: Bearer key_xxx
 * Plan requirement: has_api_access = true (Pro / Business)
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { generatedImagesTable, templatesTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireApiKey } from "../lib/auth";
import { deductCredits, restoreCredits } from "../lib/credits";
import { checkAiImagePermission, deductAiImageCredits, refundAiImageCredits } from "../lib/aiImagePermissions";
import { buildPromptFromCustomPrompt } from "../lib/promptDirector";
import { renderCard } from "./../lib/cardRenderer";
import { getCardBaseCost } from "./../lib/costService";
import path from "path";
import fs from "fs";
import https from "https";
import http from "http";
import crypto from "crypto";
import { URL } from "url";
import dns from "dns/promises";

const router = Router();

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const BLOCKED_IP_PATTERNS = [
  /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
  /^169\.254\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^::1$/, /^fc/, /^fd/, /^fe80/,
];

async function isPrivateUrl(urlStr: string): Promise<boolean> {
  try {
    const parsed = new URL(urlStr);
    if (!["http:", "https:"].includes(parsed.protocol)) return true;
    if (parsed.hostname === "localhost") return true;
    const addresses = await dns.resolve4(parsed.hostname);
    return addresses.some(addr =>
      BLOCKED_IP_PATTERNS.some(pattern => pattern.test(addr))
    );
  } catch {
    return true;
  }
}

async function downloadRemoteImage(url: string): Promise<string | null> {
  if (await isPrivateUrl(url)) {
    console.warn(`[SSRF] Blocked request to private/internal URL`);
    return null;
  }
  return new Promise((resolve) => {
    const protocol = url.startsWith("https") ? https : http;
    const tmpFile = path.join(uploadsDir, `remote-${Date.now()}-${crypto.randomUUID()}.jpg`);
    const file = fs.createWriteStream(tmpFile);
    protocol.get(url, (res) => {
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(tmpFile); });
    }).on("error", () => { fs.unlink(tmpFile, () => {}); resolve(null); });
  });
}

// ── GET /api/v1/templates ─────────────────────────────────────────────────────
router.get("/templates", requireApiKey, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const rows = await db
    .select({ id: templatesTable.id, name: templatesTable.name, slug: templatesTable.slug })
    .from(templatesTable)
    .where(eq(templatesTable.userId, user.id))
    .orderBy(desc(templatesTable.updatedAt));
  return res.json({ templates: rows });
});

// ── POST /api/v1/generate-card ────────────────────────────────────────────────
/**
 * Body:
 *   title        {string}  required
 *   subtitle     {string}  optional
 *   label        {string}  optional — badge (e.g. "عاجل")
 *   templateId   {number}  optional — from GET /api/v1/templates
 *   photoUrl     {string}  optional — remote image URL
 *   aspectRatio  {string}  optional — "1:1" | "16:9" | "4:5" (default "1:1")
 */
router.post("/generate-card", requireApiKey, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const { title, subtitle, label, templateId, photoUrl, aspectRatio = "1:1", aiPrompt, aiStyle = "photorealistic" } = req.body as {
    title?: string; subtitle?: string; label?: string;
    templateId?: number; photoUrl?: string; aspectRatio?: string;
    aiPrompt?: string; aiStyle?: string;
  };

  if (!title?.trim()) return res.status(400).json({ error: "title is required" });

  let aiCreditsDeducted = 0;
  let aiTxId = "";
  
  // Verify permissions and deduct credits
  if (aiPrompt) {
    const perm = await checkAiImagePermission(user.id);
    if (!perm.allowed) {
      return res.status(perm.errorType === "insufficient_credits" ? 402 : 403).json({
        error: perm.reason || "AI Image Generation not allowed"
      });
    }
    const aiResult = await deductAiImageCredits(user.id, "api", aiPrompt);
    if (!aiResult.success) {
      return res.status(402).json({ error: aiResult.error });
    }
    aiCreditsDeducted = aiResult.creditsDeducted;
    aiTxId = aiResult.transactionId;
  }

  // Deduct base card generation credits
  const baseCost = await getCardBaseCost();
  const result = await deductCredits(
    user.id, baseCost, "image_generator", "has_image_generator",
    `[API v1] بطاقة: ${title.trim().slice(0, 60)}`
  );
  if (!result.ok) {
    if (aiPrompt && aiTxId) await refundAiImageCredits(user.id, aiTxId);
    return res.status(result.code === "rate_limit" ? 429 : result.code === "feature_disabled" ? 403 : 402)
      .json({ error: result.error });
  }

  // Resolve template
  let resolvedBannerColor = "#0f2557";
  let resolvedTextColor   = "#ffffff";
  let resolvedFont        = "Cairo";
  let resolvedTemplateId: number | null = null;
  let templateSlug        = "classic-blue";
  let resolvedCanvasLayout: string | null = null;

  const tmplId = templateId ? Number(templateId) : null;
  if (tmplId) {
    const [tmpl] = await db.select().from(templatesTable).where(eq(templatesTable.id, tmplId)).limit(1);
    if (tmpl) {
      resolvedBannerColor  = tmpl.bannerColor  || resolvedBannerColor;
      resolvedTextColor    = tmpl.textColor    || resolvedTextColor;
      resolvedFont         = tmpl.font         || resolvedFont;
      resolvedTemplateId   = tmpl.id;
      resolvedCanvasLayout = tmpl.canvasLayout || null;
      templateSlug         = tmpl.slug || tmpl.name?.toLowerCase().replace(/\s+/g, "-") || templateSlug;
    }
  } else {
    const [first] = await db.select().from(templatesTable)
      .where(eq(templatesTable.userId, user.id)).orderBy(desc(templatesTable.updatedAt)).limit(1);
    if (first) {
      resolvedBannerColor  = first.bannerColor  || resolvedBannerColor;
      resolvedTextColor    = first.textColor    || resolvedTextColor;
      resolvedFont         = first.font         || resolvedFont;
      resolvedTemplateId   = first.id;
      resolvedCanvasLayout = first.canvasLayout || null;
      templateSlug         = first.slug || first.name?.toLowerCase().replace(/\s+/g, "-") || templateSlug;
    }
  }

  // Download remote photo or generate AI background
  let bgBuffer: Buffer | null = null;
  let tmpPhotoPath: string | null = null;
  
  if (aiPrompt) {
    try {
      const resPrompt = await buildPromptFromCustomPrompt(aiPrompt, false, aiStyle);
      const prompt = resPrompt.finalPrompt;
      
      const port = process.env.PORT || 3001;
      const nanoRes = await fetch(`http://127.0.0.1:${port}/api/nanobanana/v1/images/generations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, n: 1, size: aspectRatio === "16:9" ? "1920x1080" : aspectRatio === "9:16" ? "1080x1920" : "1024x1024" })
      });
      if (!nanoRes.ok) throw new Error("AI generation service error");
      const nanoData = await nanoRes.json() as any;
      if (nanoData.data && nanoData.data[0] && nanoData.data[0].url) {
         tmpPhotoPath = await downloadRemoteImage(nanoData.data[0].url);
         if (tmpPhotoPath && fs.existsSync(tmpPhotoPath)) bgBuffer = fs.readFileSync(tmpPhotoPath);
      } else {
         throw new Error("No image generated by AI");
      }
    } catch (err: any) {
      console.error("[v1] AI generation error:", err);
      await restoreCredits(user.id, baseCost, "image_generator", "فشل رندر API v1 (AI Error)");
      if (aiTxId) await refundAiImageCredits(user.id, aiTxId);
      return res.status(500).json({ error: "AI generation failed: " + err.message });
    }
  } else if (photoUrl) {
    tmpPhotoPath = await downloadRemoteImage(photoUrl);
    if (tmpPhotoPath && fs.existsSync(tmpPhotoPath)) bgBuffer = fs.readFileSync(tmpPhotoPath);
  }

  // Render
  let pngBuffer: Buffer;
  try {
    pngBuffer = await renderCard({
      title: title.trim(), label: label ?? null, ratio: aspectRatio,
      templateSlug, canvasLayout: resolvedCanvasLayout, uploadsDir,
      bannerColor: resolvedBannerColor, textColor: resolvedTextColor,
      backgroundImageBuffer: bgBuffer,
    });
  } catch (err) {
    console.error("[v1] render error:", err);
    await restoreCredits(user.id, baseCost, "image_generator", "فشل رندر API v1");
    if (aiPrompt && aiTxId) await refundAiImageCredits(user.id, aiTxId);
    return res.status(500).json({ error: "Failed to render card" });
  } finally {
    if (tmpPhotoPath) fs.unlink(tmpPhotoPath, () => {});
  }

  const outFilename = `card-${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
  fs.writeFileSync(path.join(uploadsDir, outFilename), pngBuffer);
  const imageUrl = `/api/photo/file/${outFilename}`;

  await db.insert(generatedImagesTable).values({
    userId: user.id, templateId: resolvedTemplateId,
    title: title.trim(), subtitle: subtitle ?? null, label: label ?? null,
    imageUrl, aspectRatio, bannerColor: resolvedBannerColor,
    textColor: resolvedTextColor, font: resolvedFont,
  });

  const host = `${req.protocol}://${req.get("host")}`;
  return res.status(201).json({
    success: true,
    imageUrl,
    imageFullUrl: `${host}${imageUrl}`,
    creditsUsed: result.creditsUsed + aiCreditsDeducted,
    creditsRemaining: result.total,
  });
});

export default router;
