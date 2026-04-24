import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth } from "../lib/auth";
import { assertFeature, rejectGuard } from "../lib/planGuard";
import { usersTable } from "@workspace/db";

const router = Router();

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".png";
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only images are allowed"));
  },
});

router.post("/upload", requireAuth, upload.single("photo"), async (req: any, res: any) => {
  const user = req.user as typeof usersTable.$inferSelect;

  // ── Plan enforcement: has_overlay_upload ─────────────────────────────────
  const guard = await assertFeature(user.id, "has_overlay_upload");
  if (!guard.ok) return rejectGuard(res, guard);

  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const previewUrl = `/api/photo/file/${req.file.filename}`;
  return res.json({ previewUrl, filename: req.file.filename });
});

router.get("/file/:filename", (req: any, res: any) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(uploadsDir, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });
  res.sendFile(filePath);
});

export default router;
