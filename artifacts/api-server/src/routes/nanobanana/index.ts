import type { Request, Response } from "express";
import { Router } from "express";
import path from "path";
import fs from "fs";
import { requireAuth } from "../../lib/auth";

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
}

const jobs = new Map<string, NanoJob>();

const RESULTS_DIR = path.join(process.cwd(), "data", "nanobanana-results");
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

function makeId() {
  return `nano-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── veoaifree.com (Google Nano Banana / Whisk) — no cookies, public nonce ────
const VEOAI_PAGE = "https://veoaifree.com/nano-banana-ulimited-ai-image-generator/";
const VEOAI_AJAX = "https://veoaifree.com/wp-admin/admin-ajax.php";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

let cachedNonce: { value: string; fetchedAt: number } | null = null;

async function getVeoaiNonce(force = false): Promise<string> {
  if (!force && cachedNonce && Date.now() - cachedNonce.fetchedAt < 30 * 60_000) {
    return cachedNonce.value;
  }
  const resp = await fetch(VEOAI_PAGE, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!resp.ok) throw new Error(`veoaifree page ${resp.status}`);
  const html = await resp.text();
  const m = html.match(/"nonce"\s*:\s*"([a-z0-9]+)"/i);
  if (!m) throw new Error("veoaifree: nonce not found in page");
  cachedNonce = { value: m[1], fetchedAt: Date.now() };
  return m[1];
}

function ratioFromSize(w: number, h: number): string {
  if (Math.abs(w - h) < 50) return "IMAGE_ASPECT_RATIO_SQUARE";
  return w > h ? "IMAGE_ASPECT_RATIO_LANDSCAPE" : "IMAGE_ASPECT_RATIO_PORTRAIT";
}

function dataUriToBuffer(uri: string): Buffer {
  const m = uri.match(/^data:[^;]+;base64,(.+)$/);
  if (!m) throw new Error("Invalid data URI");
  return Buffer.from(m[1], "base64");
}

function expandShortPrompt(p: string): string {
  const trimmed = p.trim();
  if (trimmed.length >= 25 && trimmed.split(/\s+/).length >= 4) return trimmed;
  return `${trimmed}, high quality, photorealistic, detailed, sharp focus, professional lighting`;
}

async function generateWithVeoai(
  prompt: string,
  width: number,
  height: number,
  count: number
): Promise<Buffer[]> {
  const ratio = ratioFromSize(width, height);
  const effectivePrompt = expandShortPrompt(prompt);
  for (let attempt = 0; attempt < 2; attempt++) {
    const nonce = await getVeoaiNonce(attempt > 0);
    const body = new URLSearchParams({
      action: "veo_video_generator",
      nonce,
      promptText: effectivePrompt,
      totalImages: String(count),
      ratio,
      actionType: "whisk_final_image",
      dataCode: "",
      dataText: "",
      dataFlow: "",
      dataCode2: "",
      dataText2: "",
    });
    const resp = await fetch(VEOAI_AJAX, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        Referer: VEOAI_PAGE,
        Origin: "https://veoaifree.com",
        Accept: "application/json, text/javascript, */*; q=0.01",
      },
      body: body.toString(),
      signal: AbortSignal.timeout(180_000),
    });
    if (!resp.ok) throw new Error(`veoaifree HTTP ${resp.status}`);
    const text = (await resp.text()).trim();
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`veoaifree: non-JSON response: ${text.slice(0, 200)}`);
    }
    const success = parsed.success === true || parsed.success === "true";
    if (!success) {
      const reason = parsed.error || parsed.message || (typeof parsed.data === "string" ? parsed.data : parsed.data?.message || parsed.data?.error) || text.slice(0, 200);
      if (attempt === 0 && /nonce|invalid|forbidden|csrf/i.test(reason)) {
        cachedNonce = null;
        continue;
      }
      throw new Error(`Nano Banana refused this prompt: ${reason}`);
    }
    const uris: string[] = Array.isArray(parsed.data_uris) ? parsed.data_uris : (Array.isArray(parsed.data_uri) ? parsed.data_uri : (parsed.data_uri ? [parsed.data_uri] : []));
    if (uris.length === 0) throw new Error("veoaifree: no images in response");
    return uris.map(dataUriToBuffer);
  }
  throw new Error("veoaifree: exhausted retries");
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
    const buffers = await generateWithVeoai(job.prompt, job.width, job.height, job.count);
    job.images = buffers.map((b, i) => saveBuffer(b, job.id, i));
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

router.post("/generate", async (req: Request, res: Response) => {
  const { prompt, width = 1024, height = 1024, count = 1, seed } = req.body;
  if (!prompt) return res.status(400).json({ error: "prompt is required" });
  const job: NanoJob = {
    id: makeId(),
    prompt: prompt.trim(),
    status: "pending",
    createdAt: Date.now(),
    images: [],
    width, height, count,
    seed: seed || Math.floor(Math.random() * 1000000),
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

// ─── OpenAI Compatible Endpoint ──────────────────────────────────────────────
router.get("/v1/models", (req: Request, res: Response) => {
  res.json({
    object: "list",
    data: [
      {
        id: "nano-banana",
        object: "model",
        created: 1776960000,
        owned_by: "nanobanana",
        permission: [],
        root: "nano-banana",
        parent: null,
      }
    ]
  });
});

router.post("/v1/images/generations", async (req: Request, res: Response) => {
  const { prompt, n = 1, size = "1024x1024", model } = req.body;
  if (!prompt) return res.status(400).json({ error: "prompt is required" });

  let [width, height] = [1024, 1024];
  if (typeof size === "string" && size.includes("x")) {
    const parts = size.split("x");
    width = parseInt(parts[0]) || 1024;
    height = parseInt(parts[1]) || 1024;
  }

  const job: NanoJob = {
    id: makeId(),
    prompt: prompt.trim(),
    status: "pending",
    createdAt: Date.now(),
    images: [],
    width, height, count: n,
    seed: Math.floor(Math.random() * 1000000),
  };
  
  jobs.set(job.id, job);

  try {
    const buffers = await generateWithVeoai(job.prompt, job.width, job.height, job.count);
    const imageUrls = buffers.map((b, i) => saveBuffer(b, job.id, i));
    
    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const fullUrls = imageUrls.map(path => `${protocol}://${host}${path}`);

    return res.json({
      created: Math.floor(Date.now() / 1000),
      data: fullUrls.map(url => ({ url, revised_prompt: job.prompt }))
    });
  } catch (err: any) {
    return res.status(500).json({
      error: {
        message: err.message,
        type: "invalid_request_error",
        code: "generation_failed"
      }
    });
  }
});

export default router;
