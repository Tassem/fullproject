import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import sharp from "sharp";
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
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

router.post("/upload", requireAuth, upload.single("photo"), async (req: any, res: any) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  // Re-encode via Sharp to strip any embedded non-image payloads
  try {
    const filePath = path.join(uploadsDir, req.file.filename);
    const sanitized = await sharp(filePath).png().toBuffer();
    fs.writeFileSync(filePath, sanitized);
  } catch {
    // If sharp fails, the file is not a valid image — delete and reject
    fs.unlink(path.join(uploadsDir, req.file.filename), () => {});
    return res.status(400).json({ error: "Uploaded file is not a valid image" });
  }

  const previewUrl = `/api/photo/file/${req.file.filename}`;
  return res.json({ previewUrl, filename: req.file.filename });
});

router.get("/file/:filename", requireAuth, (req: any, res: any) => {
  const raw = req.params.filename;
  if (!raw || raw.includes("..") || raw.includes("\0") || raw.includes("/") || raw.includes("\\")) {
    return res.status(400).json({ error: "Invalid filename" });
  }
  const filename = path.basename(raw);
  const filePath = path.join(uploadsDir, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });
  res.sendFile(filePath);
});

export default router;
