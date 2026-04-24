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
import { renderCard } from "../lib/cardRenderer";
import path from "path";
import fs from "fs";
import https from "https";
import http from "http";

const router = Router();

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

async function downloadRemoteImage(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const protocol = url.startsWith("https") ? https : http;
    const tmpFile = path.join(uploadsDir, `remote-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);
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
  const { title, subtitle, label, templateId, photoUrl, aspectRatio = "1:1" } = req.body as {
    title?: string; subtitle?: string; label?: string;
    templateId?: number; photoUrl?: string; aspectRatio?: string;
  };

  if (!title?.trim()) return res.status(400).json({ error: "title is required" });

  // Deduct credits first (cost = 1)
  const result = await deductCredits(
    user.id, 1, "image_generator", "has_image_generator",
    `[API v1] بطاقة: ${title.trim().slice(0, 60)}`
  );
  if (!result.ok) {
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

  // Download remote photo
  let bgBuffer: Buffer | null = null;
  let tmpPhotoPath: string | null = null;
  if (photoUrl) {
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
    await restoreCredits(user.id, 1, "image_generator", "فشل رندر API v1");
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
    creditsUsed: result.creditsUsed,
    creditsRemaining: result.total,
  });
});

export default router;
