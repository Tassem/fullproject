import { Router } from "express";
import { db } from "@workspace/db";
import { generatedImagesTable, templatesTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { deductCredits, restoreCredits } from "../lib/credits";
import { getSetting, getSettingNumber } from "../lib/settings";

import { renderCard } from "../lib/cardRenderer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const router = Router();

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ── POST /generate — render a card image and return its URL ──────────────────
router.post("/", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const {
    title,
    subtitle,
    label,
    aspectRatio = "16:9",
    templateId,
    bannerColor: bodyBannerColor = "#0f2557",
    textColor: bodyTextColor = "#ffffff",
    font = "Cairo",
    backgroundPhotoFilename,
  } = req.body;

  if (!title) return res.status(400).json({ error: "Title is required" });

  // ── Deduct credits BEFORE rendering ─────────────────────────────────────────
  const baseCardCost = await getSettingNumber("card_generation_base_cost", 1);
  const result = await deductCredits(
    user.id,
    baseCardCost,
    "image_generator",
    "has_image_generator",
    `بطاقة: ${String(title).slice(0, 60)}`
  );

  if (!result.ok) {
    return res.status(result.code === "rate_limit" ? 429 : result.code === "feature_disabled" ? 403 : 402)
      .json({ error: result.error });
  }

  // Resolve template
  let resolvedBannerColor = bodyBannerColor;
  let resolvedTextColor   = bodyTextColor;
  let resolvedFont        = font;
  let resolvedTemplateId: number | null = null;
  let templateSlug        = "classic-blue";
  let resolvedCanvasLayout: string | null = null;

  if (templateId) {
    const id = parseInt(String(templateId), 10);
    if (!isNaN(id)) {
      const [tmpl] = await db.select().from(templatesTable).where(eq(templatesTable.id, id)).limit(1);
      if (tmpl) {
        resolvedBannerColor   = tmpl.bannerColor  || bodyBannerColor;
        resolvedTextColor     = tmpl.textColor    || bodyTextColor;
        resolvedFont          = tmpl.font         || font;
        resolvedTemplateId    = tmpl.id;
        resolvedCanvasLayout  = tmpl.canvasLayout || null;
        templateSlug          = tmpl.slug || tmpl.name?.toLowerCase().replace(/\s+/g, "-") || templateSlug;
      }
    }
  }

  // Read background image
  let bgBuffer: Buffer | null = null;
  if (backgroundPhotoFilename) {
    const raw = String(backgroundPhotoFilename);
    if (raw.includes("..") || raw.includes("\0") || raw.includes("/") || raw.includes("\\")) {
      return res.status(400).json({ error: "Invalid background filename" });
    }
    const bgPath = path.join(uploadsDir, path.basename(raw));
    if (fs.existsSync(bgPath)) bgBuffer = fs.readFileSync(bgPath);
  }

  // Render
  let pngBuffer: Buffer;
  try {
    pngBuffer = await renderCard({
      title,
      label: label ?? null,
      ratio: aspectRatio,
      templateSlug,
      canvasLayout: resolvedCanvasLayout,
      uploadsDir,
      bannerColor: resolvedBannerColor,
      textColor: resolvedTextColor,
      backgroundImageBuffer: bgBuffer,
    });
  } catch (err) {
    console.error("Card render error:", err);
    await restoreCredits(user.id, baseCardCost, "image_generator", "فشل الرندر");
    return res.status(500).json({ error: "Failed to render card" });
  }

  const outFilename = `card-${Date.now()}-${crypto.randomUUID()}.png`;
  fs.writeFileSync(path.join(uploadsDir, outFilename), pngBuffer);
  const imageUrl = `/api/photo/file/${outFilename}`;

  const [image] = await db.insert(generatedImagesTable).values({
    userId: user.id,
    templateId: resolvedTemplateId,
    title,
    subtitle: subtitle ?? null,
    label: label ?? null,
    imageUrl,
    aspectRatio,
    bannerColor: resolvedBannerColor,
    textColor: resolvedTextColor,
    font: resolvedFont,
  }).returning();

  return res.status(201).json({
    ...image,
    imageUrl,
    imageFullUrl: imageUrl,
    creditsUsed: result.creditsUsed,
    creditsRemaining: result.total,
  });
});

// ── POST /generate/from-builder — render from canvas layout JSON ──────────────
router.post("/from-builder", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user as typeof usersTable.$inferSelect;
    const { elements, canvasWidth, canvasHeight, title, backgroundSource, aiPrompt } = req.body as {
      elements: any[];
      canvasWidth: number;
      canvasHeight: number;
      title?: string;
      backgroundSource?: "uploaded" | "ai_generated" | "template_default";
      aiPrompt?: string;
    };

    if (!elements || !Array.isArray(elements)) {
      return res.status(400).json({ error: "elements array is required" });
    }

    const aiCostPerGen = await getSettingNumber("ai_image_cost_per_generation", 2);
    const baseCardCost = await getSettingNumber("card_generation_base_cost", 1);
    
    // Fix: Use getSetting instead of direct query to undefined settingsTable
    const aiEnabledStr = await getSetting("ai_image_generation_enabled", "true");
    const aiEnabled = aiEnabledStr === "true";

    // Count elements that use AI images (from nanobanana results)
    const aiLayersCount = elements.filter(el => el.src && el.src.includes("/api/nanobanana/results/")).length;
    
    if (aiLayersCount > 0 && !aiEnabled) {
      return res.status(403).json({ 
        error: "AI image generation is currently disabled", 
        code: "AI_DISABLED" 
      });
    }

    const creditCost = baseCardCost + (aiLayersCount * aiCostPerGen);

    // Deduct credits before rendering
    const result = await deductCredits(
      user.id,
      creditCost,
      "image_generator",
      "has_image_generator",
      aiLayersCount > 0
        ? `Builder card with ${aiLayersCount} AI layer(s): ${title?.slice(0, 50) || "untitled"}`
        : `Builder card: ${title?.slice(0, 60) || "untitled"}`
    );

    if (!result.ok) {
      return res.status(result.code === "rate_limit" ? 429 : result.code === "feature_disabled" ? 403 : 402)
        .json({ error: result.error });
    }

    const { renderFromCanvasLayout } = await import("../lib/cardRenderer");

    const layout = {
      width:    canvasWidth  || 540,
      height:   canvasHeight || 540,
      elements,
    };
    const exportW = (canvasWidth  || 540) * 2;
    const exportH = (canvasHeight || 540) * 2;

    const pngBuffer = await renderFromCanvasLayout(layout, title || null, null, exportW, exportH, uploadsDir);

    const outFilename = `card-${Date.now()}-${crypto.randomUUID()}.png`;
    fs.writeFileSync(path.join(uploadsDir, outFilename), pngBuffer);
    const imageUrl = `/api/photo/file/${outFilename}`;

    const derivedTitle = title ||
      elements.find((e: any) => e.type === "text" && e.content)?.content?.slice(0, 120) ||
      "Builder Card";

    const [image] = await db.insert(generatedImagesTable).values({
      userId: user.id,
      templateId: null,
      title:    derivedTitle,
      subtitle: null,
      label:    null,
      imageUrl,
      aspectRatio: `${canvasWidth}x${canvasHeight}`,
      bannerColor: "#000000",
      textColor:   "#ffffff",
      font:        "Cairo",
      backgroundSource: backgroundSource || "uploaded",
      aiPrompt: aiPrompt || null,
    }).returning();

    return res.status(201).json({
      ...image,
      imageUrl,
      creditsUsed: result.creditsUsed,
      creditsRemaining: result.total,
    });
  } catch (err) {
    console.error("[generate] Builder render error:", err);
    // Note: We don't restore credits here because they might not have been deducted yet or we don't know the amount safely
    return res.status(500).json({ 
      error: "Server render failed", 
      code: "RENDER_ERROR" 
    });
  }
});

// ── GET /generate/history ─────────────────────────────────────────────────────
router.get("/history", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const page  = parseInt(String(req.query.page  || "1"));
  const limit = parseInt(String(req.query.limit || "20"));
  const offset = (page - 1) * limit;

  const items = await db.select().from(generatedImagesTable)
    .where(eq(generatedImagesTable.userId, user.id))
    .orderBy(desc(generatedImagesTable.createdAt))
    .limit(limit).offset(offset);

  const allRows = await db.select({ id: generatedImagesTable.id })
    .from(generatedImagesTable)
    .where(eq(generatedImagesTable.userId, user.id));

  return res.json({ items, total: allRows.length, page, limit });
});

export default router;
