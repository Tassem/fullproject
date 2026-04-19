import { Router } from "express";
import { db } from "@workspace/db";
import { templatesTable } from "@workspace/db";
import { eq, isNull, and, or } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";

const router = Router();

// GET /system-templates — public, returns only APPROVED system templates
router.get("/", async (_req, res) => {
  const templates = await db.select().from(templatesTable).where(
    and(
      isNull(templatesTable.userId),
      or(
        eq(templatesTable.isApproved, true),
        // Backward compat: old templates without isApproved (null) AND isSystem=true
        // are treated as approved IF they were created before the approval system
        // We use isSystem flag to distinguish: if isSystem=false, they're pending user submissions
      )
    )
  );
  // Filter: only truly approved OR legacy system templates (isApproved null + isSystem true)
  const visible = templates.filter(t =>
    t.isApproved === true || (t.isApproved === null && t.isSystem === true && new Date(t.createdAt) < new Date("2026-04-19T04:00:00Z"))
  );
  return res.json(visible.map(t => ({
    ...t,
    canvasLayout: t.canvasLayout ? JSON.parse(t.canvasLayout) : null,
  })));
});

// Admin sub-router for /admin/system-templates
export const adminSystemTemplatesRouter = Router();

// GET /admin/system-templates — ALL system templates (pending + approved + rejected)
adminSystemTemplatesRouter.get("/", requireAdmin, async (_req, res) => {
  const templates = await db.select().from(templatesTable).where(isNull(templatesTable.userId));
  return res.json(templates.map(t => ({
    ...t,
    canvasLayout: t.canvasLayout ? JSON.parse(t.canvasLayout) : null,
  })));
});

// GET /admin/system-templates/:id — single template
adminSystemTemplatesRouter.get("/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string);
  const [template] = await db.select().from(templatesTable).where(eq(templatesTable.id, id)).limit(1);
  if (!template) return res.status(404).json({ error: "Not found" });
  return res.json({ ...template, canvasLayout: template.canvasLayout ? JSON.parse(template.canvasLayout) : null });
});

// POST /admin/system-templates — publish template (goes to pending review)
adminSystemTemplatesRouter.post("/", requireAdmin, async (req, res) => {
  const {
    name, category,
    bannerColor, banner_color,
    bannerGradient, banner_gradient,
    textColor, text_color,
    labelColor, label_color,
    font,
    aspectRatio, aspect_ratio,
    isActive,
    canvasLayout,
    watermark,
  } = req.body;

  if (!name) return res.status(400).json({ error: "name is required" });

  const [template] = await db.insert(templatesTable).values({
    name,
    category: category || "general",
    bannerColor: bannerColor || banner_color || "#1a1a2e",
    textColor: textColor || text_color || "#ffffff",
    font: font || "Inter",
    aspectRatio: aspectRatio || aspect_ratio || "1:1",
    isPublic: true,
    isSystem: true,
    isApproved: null, // Pending review by default
    canvasLayout: canvasLayout ? JSON.stringify(canvasLayout) : null,
    watermark: watermark ? (typeof watermark === "string" ? watermark : JSON.stringify(watermark)) : null,
  }).returning();

  return res.status(201).json({
    ...template,
    canvasLayout: template.canvasLayout ? JSON.parse(template.canvasLayout) : null,
  });
});

// POST /admin/system-templates/ai-generate — AI generation (keep as-is)
adminSystemTemplatesRouter.post("/ai-generate", requireAdmin, async (req, res) => {
  return res.json({ template: null, usedAI: false });
});

adminSystemTemplatesRouter.put("/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string);

  const [existing] = await db.select().from(templatesTable).where(eq(templatesTable.id, id)).limit(1);
  if (!existing) return res.status(404).json({ error: "Template not found" });

  const updates: Partial<typeof templatesTable.$inferInsert> = {};
  if (req.body.name !== undefined) updates.name = req.body.name;
  if (req.body.category !== undefined) updates.category = req.body.category;
  if (req.body.bannerColor !== undefined) updates.bannerColor = req.body.bannerColor;
  if (req.body.banner_color !== undefined) updates.bannerColor = req.body.banner_color;
  if (req.body.textColor !== undefined) updates.textColor = req.body.textColor;
  if (req.body.text_color !== undefined) updates.textColor = req.body.text_color;
  if (req.body.font !== undefined) updates.font = req.body.font;
  if (req.body.aspectRatio !== undefined) updates.aspectRatio = req.body.aspectRatio;
  if (req.body.aspect_ratio !== undefined) updates.aspectRatio = req.body.aspect_ratio;
  if (req.body.isApproved !== undefined) updates.isApproved = req.body.isApproved;
  if (req.body.canvasLayout !== undefined) {
    updates.canvasLayout = req.body.canvasLayout ? JSON.stringify(req.body.canvasLayout) : null;
  }
  if (req.body.watermark !== undefined) {
    const wm = req.body.watermark;
    updates.watermark = wm ? (typeof wm === "string" ? wm : JSON.stringify(wm)) : null;
  }

  const [updated] = await db.update(templatesTable).set(updates).where(eq(templatesTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Template not found" });

  return res.json({
    ...updated,
    canvasLayout: updated.canvasLayout ? JSON.parse(updated.canvasLayout) : null,
  });
});

adminSystemTemplatesRouter.delete("/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string);
  await db.delete(templatesTable).where(eq(templatesTable.id, id));
  return res.json({ success: true });
});

export default router;
