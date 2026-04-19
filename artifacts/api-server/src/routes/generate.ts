import { Router } from "express";
import { db } from "@workspace/db";
import { generatedImagesTable, templatesTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { renderCard } from "../lib/cardRenderer";
import path from "path";
import fs from "fs";

const router = Router();

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ── POST /generate — render a real card image and return its URL ────────────
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

  // Resolve template colors / slug / canvasLayout
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

  // Read background image from uploads if provided
  let bgBuffer: Buffer | null = null;
  if (backgroundPhotoFilename) {
    const bgPath = path.join(uploadsDir, path.basename(backgroundPhotoFilename));
    if (fs.existsSync(bgPath)) {
      bgBuffer = fs.readFileSync(bgPath);
    }
  }

  // Render the card (uses canvas layout if present, else built-in template)
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
    return res.status(500).json({ error: "Failed to render card" });
  }

  // Save rendered PNG to uploads dir and return a URL
  const outFilename = `card-${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
  const outPath = path.join(uploadsDir, outFilename);
  fs.writeFileSync(outPath, pngBuffer);
  const imageUrl = `/api/photo/file/${outFilename}`;

  // Save to DB
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

  await db.update(usersTable)
    .set({ imagesToday: (user.imagesToday ?? 0) + 1 })
    .where(eq(usersTable.id, user.id));

  return res.status(201).json({ ...image, imageUrl, imageFullUrl: imageUrl });
});

// ── GET /generate/history ────────────────────────────────────────────────────
router.get("/history", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const page  = parseInt(String(req.query.page  || "1"));
  const limit = parseInt(String(req.query.limit || "20"));
  const offset = (page - 1) * limit;

  const items = await db.select().from(generatedImagesTable)
    .where(eq(generatedImagesTable.userId, user.id))
    .orderBy(desc(generatedImagesTable.createdAt))
    .limit(limit)
    .offset(offset);

  const allRows = await db.select({ id: generatedImagesTable.id })
    .from(generatedImagesTable)
    .where(eq(generatedImagesTable.userId, user.id));

  return res.json({ items, total: allRows.length, page, limit });
});

export default router;
