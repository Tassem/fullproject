/**
 * Saved Designs — DB-backed storage for user card designs.
 *
 * Routes:
 *   GET    /api/saved-designs        → list all designs for auth user
 *   POST   /api/saved-designs        → save new design (plan limit checked)
 *   PUT    /api/saved-designs/:id    → update existing design
 *   DELETE /api/saved-designs/:id    → delete design
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { savedDesignsTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { assertSavedDesignLimit, rejectGuard } from "../lib/planGuard";

const router = Router();

// ── GET / — list all designs ──────────────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const rows = await db
    .select()
    .from(savedDesignsTable)
    .where(eq(savedDesignsTable.user_id, user.id))
    .orderBy(desc(savedDesignsTable.updated_at));

  return res.json({
    designs: rows.map(r => ({
      id: r.id,
      name: r.name,
      design_data: JSON.parse(r.design_data),
      thumbnail_url: r.thumbnail_url,
      created_at: r.created_at,
      updated_at: r.updated_at,
    })),
    total: rows.length,
  });
});

// ── POST / — create new design ────────────────────────────────────────────────
router.post("/", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const { name, settings, design_data, thumbnail_url } = req.body as {
    name?: string;
    settings?: object;
    design_data?: object;
    thumbnail_url?: string;
  };

  if (!name?.trim()) return res.status(400).json({ error: "name is required" });

  const data = design_data ?? settings;
  if (!data) return res.status(400).json({ error: "design_data is required" });

  // ── Plan enforcement ──────────────────────────────────────────────────────
  const guard = await assertSavedDesignLimit(user.id);
  if (!guard.ok) return rejectGuard(res, guard);

  const [row] = await db
    .insert(savedDesignsTable)
    .values({
      user_id: user.id,
      name: name.trim(),
      design_data: JSON.stringify(data),
      thumbnail_url: thumbnail_url ?? null,
    })
    .returning();

  return res.status(201).json({
    id: row.id,
    name: row.name,
    design_data: JSON.parse(row.design_data),
    thumbnail_url: row.thumbnail_url,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
});

// ── PUT /:id — update existing design ────────────────────────────────────────
router.put("/:id", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const { name, settings, design_data, thumbnail_url } = req.body as {
    name?: string;
    settings?: object;
    design_data?: object;
    thumbnail_url?: string;
  };

  const [existing] = await db
    .select()
    .from(savedDesignsTable)
    .where(and(eq(savedDesignsTable.id, id), eq(savedDesignsTable.user_id, user.id)))
    .limit(1);
  if (!existing) return res.status(404).json({ error: "Design not found" });

  const data = design_data ?? settings;
  const [updated] = await db
    .update(savedDesignsTable)
    .set({
      name: name?.trim() ?? existing.name,
      design_data: data ? JSON.stringify(data) : existing.design_data,
      thumbnail_url: thumbnail_url !== undefined ? thumbnail_url : existing.thumbnail_url,
      updated_at: new Date(),
    })
    .where(eq(savedDesignsTable.id, id))
    .returning();

  return res.json({
    id: updated.id,
    name: updated.name,
    design_data: JSON.parse(updated.design_data),
    thumbnail_url: updated.thumbnail_url,
    created_at: updated.created_at,
    updated_at: updated.updated_at,
  });
});

// ── DELETE /:id — delete design ───────────────────────────────────────────────
router.delete("/:id", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const [existing] = await db
    .select()
    .from(savedDesignsTable)
    .where(and(eq(savedDesignsTable.id, id), eq(savedDesignsTable.user_id, user.id)))
    .limit(1);
  if (!existing) return res.status(404).json({ error: "Design not found" });

  await db.delete(savedDesignsTable).where(eq(savedDesignsTable.id, id));
  return res.status(204).send();
});

export default router;
