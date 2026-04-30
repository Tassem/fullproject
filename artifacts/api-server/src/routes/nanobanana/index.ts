import type { Request, Response } from "express";
import { Router } from "express";
import path from "path";
import fs from "fs";
import { requireAuth } from "../../lib/auth";

import { generateNanobananaImage } from "../../lib/nanobananaClient";
import { checkAiImagePermission, deductAiImageCredits } from "../../lib/aiImagePermissions";

const router = Router();

interface NanoJob {
  id: string;
  prompt: string;
  status: "pending" | "running" | "done" | "failed";
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  images: string[];
  error?: string;
  width: number;
  height: number;
  count: number;
  seed: number;
  userId: number;
  creditsDeducted?: number;
}

const jobs = new Map<string, NanoJob>();

const RESULTS_DIR = path.join(process.cwd(), "data", "nanobanana-results");
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

function makeId() {
  return `nano-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ratioFromSize(w: number, h: number): string {
  if (Math.abs(w - h) < 50) return "IMAGE_ASPECT_RATIO_SQUARE";
  return w > h ? "IMAGE_ASPECT_RATIO_LANDSCAPE" : "IMAGE_ASPECT_RATIO_PORTRAIT";
}

function detectExt(buf: Buffer): string {
  if (buf.length > 4 && buf[0] === 0x89 && buf[1] === 0x50) return "png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return "jpg";
  if (buf.length > 12 && buf.slice(0, 4).toString() === "RIFF") return "webp";
  return "png";
}

function saveBuffer(buf: Buffer, jobId: string, idx: number): string {
  const ext = detectExt(buf);
  const filename = `result-${jobId}-${idx}.${ext}`;
  fs.writeFileSync(path.join(RESULTS_DIR, filename), buf);
  return `/api/nanobanana/results/${filename}`;
}

async function runJob(job: NanoJob) {
  job.status = "running";
  job.startedAt = Date.now();
  jobs.set(job.id, job);
  try {
    const ratio = ratioFromSize(job.width, job.height);
    const result = await generateNanobananaImage(job.prompt, { ratio, count: job.count });
    if (!result.success) throw new Error(result.error || "Generation failed");
    
    job.images = result.images.map((b, i) => saveBuffer(b, job.id, i));
    
    // Deduct credits after success
    const deduct = await deductAiImageCredits(job.userId, "api", job.prompt, job.count);
    if (deduct.success) {
      job.creditsDeducted = deduct.creditsDeducted;
    } else {
      console.error(`[Nanobanana] Credit deduction failed for user ${job.userId}:`, deduct.error);
    }
    
    job.status = "done";
  } catch (err: any) {
    job.status = "failed";
    job.error = err.message;
  } finally {
    job.finishedAt = Date.now();
    jobs.set(job.id, job);
  }
}

router.get("/", (req: Request, res: Response) => {
  res.json({ ok: true, message: "Nanobanana router is active" });
});

router.post("/generate", requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?.id) return res.status(401).json({ error: "Unauthorized" });

  const { prompt, width = 1024, height = 1024, count = 1, seed } = req.body;
  if (!prompt) return res.status(400).json({ error: "prompt is required" });

  // Check permission before creating job
  const perm = await checkAiImagePermission(user.id);
  if (!perm.allowed) {
    return res.status(perm.errorType === "insufficient_credits" ? 402 : 403).json({
      error: perm.errorType,
      message: perm.reason
    });
  }

  const job: NanoJob = {
    id: makeId(),
    prompt: prompt.trim(),
    status: "pending",
    createdAt: Date.now(),
    images: [],
    width, height, count,
    seed: seed || Math.floor(Math.random() * 1000000),
    userId: user.id,
  };
  jobs.set(job.id, job);
  runJob(job);
  return res.status(202).json({ jobId: job.id, status: "pending" });
});

router.get("/jobs/:id", (req: Request, res: Response) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  return res.json({
    jobId: job.id,
    status: job.status,
    images: job.images,
    error: job.error,
    creditsDeducted: job.creditsDeducted
  });
});

router.get("/results/:filename", (req: Request, res: Response) => {
  const filename = path.basename(req.params.filename);
  const filepath = path.join(RESULTS_DIR, filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: "File not found" });
  res.sendFile(filepath);
});

router.get("/test-status", (req: Request, res: Response) => {
  res.json({ ok: true, message: "Nanobanana router is active and reachable" });
});

// OpenAI Compatible Endpoints
router.get("/v1/models", (req: Request, res: Response) => {
  res.json({
    object: "list",
    data: [{ id: "nano-banana", object: "model", created: 1776960000, owned_by: "nanobanana" }]
  });
});

router.post("/v1/images/generations", requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?.id) return res.status(401).json({ error: "Unauthorized" });

  const { prompt, n = 1, size = "1024x1024" } = req.body;
  if (!prompt) return res.status(400).json({ error: "prompt is required" });

  // Check permission before generation
  const perm = await checkAiImagePermission(user.id);
  if (!perm.allowed) {
    return res.status(perm.errorType === "insufficient_credits" ? 402 : 403).json({
      error: perm.errorType,
      message: perm.reason
    });
  }

  let [width, height] = [1024, 1024];
  if (typeof size === "string" && size.includes("x")) {
    const parts = size.split("x");
    width = parseInt(parts[0]) || 1024;
    height = parseInt(parts[1]) || 1024;
  }

  const ratio = ratioFromSize(width, height);
  
  try {
    const result = await generateNanobananaImage(prompt, { ratio, count: n });

    if (!result.success) {
      return res.status(500).json({ error: { message: result.error, type: "invalid_request_error" } });
    }

    // Deduct credits after success
    const deduct = await deductAiImageCredits(user.id, "api", prompt, n);
    if (!deduct.success) {
      return res.status(402).json({
        error: "INSUFFICIENT_CREDITS",
        message: "رصيدك غير كافٍ"
      });
    }

    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const fullUrls = result.images.map((b, i) => `${protocol}://${host}${saveBuffer(b, makeId(), i)}`);

    return res.json({
      created: Math.floor(Date.now() / 1000),
      data: fullUrls.map(url => ({ url, revised_prompt: prompt })),
      creditsDeducted: deduct.creditsDeducted
    });
  } catch (err: any) {
    return res.status(500).json({
      error: {
        message: err.message,
        type: "server_error"
      }
    });
  }
});

export default router;
