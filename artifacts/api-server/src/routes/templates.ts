import { Router } from "express";
import { db } from "@workspace/db";
import { templatesTable, usersTable } from "@workspace/db";
import { eq, and, or } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { assertTemplateLimit, rejectGuard, assertFeature } from "../lib/planGuard";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const items = await db.select().from(templatesTable).where(
    or(eq(templatesTable.userId, user.id), eq(templatesTable.isSystem, true))
  );
  return res.json(items.map(t => ({
    ...t,
    canvasLayout: t.canvasLayout ? JSON.parse(t.canvasLayout) : null,
  })));
});

router.post("/", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const { name, bannerColor, textColor, font, category, aspectRatio, isPublic, canvasLayout, watermark } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });

  // ── Plan enforcement: max_templates ──────────────────────────────────────
  const guard = await assertTemplateLimit(user.id);
  if (!guard.ok) return rejectGuard(res, guard);

  // ── Watermark enforcement: strip silently if user lacks has_custom_watermark
  let resolvedWatermark: string | null = null;
  if (watermark) {
    const wmGuard = await assertFeature(user.id, "has_custom_watermark");
    resolvedWatermark = wmGuard.ok ? (watermark || null) : null;
  }

  const [template] = await db.insert(templatesTable).values({
    userId: user.id,
    name,
    bannerColor: bannerColor || "#1a1a2e",
    textColor: textColor || "#ffffff",
    font: font || "Inter",
    category: category || "general",
    aspectRatio: aspectRatio || "1:1",
    isPublic: isPublic || false,
    canvasLayout: canvasLayout ? JSON.stringify(canvasLayout) : null,
    watermark: resolvedWatermark,
  }).returning();

  return res.status(201).json({
    ...template,
    canvasLayout: template.canvasLayout ? JSON.parse(template.canvasLayout) : null,
  });
});

router.get("/:id", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const id = parseInt(req.params.id as string);
  const [template] = await db.select().from(templatesTable).where(
    and(eq(templatesTable.id, id), or(eq(templatesTable.userId, user.id), eq(templatesTable.isPublic, true)))
  ).limit(1);
  if (!template) return res.status(404).json({ error: "Template not found" });
  return res.json({
    ...template,
    canvasLayout: template.canvasLayout ? JSON.parse(template.canvasLayout) : null,
  });
});

router.put("/:id", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const id = parseInt(req.params.id as string);
  const { name, bannerColor, textColor, font, category, isPublic, canvasLayout, watermark } = req.body;

  const [existing] = await db.select().from(templatesTable).where(and(eq(templatesTable.id, id), eq(templatesTable.userId, user.id))).limit(1);
  if (!existing) return res.status(404).json({ error: "Template not found" });

  // ── Watermark enforcement: strip silently if user lacks has_custom_watermark
  let resolvedWatermark: string | null | undefined = undefined;
  if (watermark !== undefined) {
    if (watermark) {
      const wmGuard = await assertFeature(user.id, "has_custom_watermark");
      resolvedWatermark = wmGuard.ok ? watermark : null;
    } else {
      resolvedWatermark = null;
    }
  }

  const [updated] = await db.update(templatesTable).set({
    name: name ?? existing.name,
    bannerColor: bannerColor ?? existing.bannerColor,
    textColor: textColor ?? existing.textColor,
    font: font ?? existing.font,
    category: category ?? existing.category,
    isPublic: isPublic ?? existing.isPublic,
    canvasLayout: canvasLayout !== undefined ? JSON.stringify(canvasLayout) : existing.canvasLayout,
    watermark: resolvedWatermark !== undefined ? resolvedWatermark : existing.watermark,
    updatedAt: new Date(),
  }).where(eq(templatesTable.id, id)).returning();

  return res.json({
    ...updated,
    canvasLayout: updated.canvasLayout ? JSON.parse(updated.canvasLayout) : null,
  });
});

router.delete("/:id", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const id = parseInt(req.params.id as string);
  const [existing] = await db.select().from(templatesTable).where(and(eq(templatesTable.id, id), eq(templatesTable.userId, user.id))).limit(1);
  if (!existing) return res.status(404).json({ error: "Template not found" });
  await db.delete(templatesTable).where(eq(templatesTable.id, id));
  return res.status(204).send();
});

export default router;
