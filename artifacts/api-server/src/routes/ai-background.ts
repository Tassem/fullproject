import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, plansTable, planAddonsTable, userAddonsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import path from "path";
import fs from "fs";

const router = Router();

const RESULTS_DIR = path.join(process.cwd(), "data", "nanobanana-results");
if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

const NANO_RESULTS_SERVE = "/api/nanobanana/results/";

async function hasAiImageGeneration(userId: number): Promise<boolean> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return false;

  const [plan] = await db.select().from(plansTable).where(eq(plansTable.slug, user.plan)).limit(1);
  if (plan?.has_ai_image_generation) return true;

  const [addon] = await db
    .select({ id: planAddonsTable.id })
    .from(userAddonsTable)
    .innerJoin(planAddonsTable, eq(userAddonsTable.addonId, planAddonsTable.id))
    .where(
      and(
        eq(userAddonsTable.userId, userId),
        eq(userAddonsTable.isActive, true),
        eq(planAddonsTable.feature_key, "has_ai_image_generation")
      )
    )
    .limit(1);

  return !!addon;
}

async function generatePromptFromTitle(
  title: string,
  label?: string,
  style = "photorealistic"
): Promise<{ prompt: string; negativePrompt: string }> {
  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  if (!baseUrl || !apiKey) {
    return {
      prompt: `Professional news background, ${style}, cinematic lighting, high quality, no text`,
      negativePrompt: "text, words, letters, watermark, logo, blurry, low quality",
    };
  }

  const system = `You are a creative director for a news media company.
Given a news headline in Arabic and an optional category/label, generate an English image prompt for a professional news card background.

Rules:
1. The image must be ${style} or high-quality illustration
2. Do NOT include any text, words, or letters in the image
3. Leave space/areas suitable for text overlay (keep areas clean and uncluttered)
4. Match the mood and topic of the headline
5. Use professional lighting and composition
6. The image should work as a news card background (subtle, not too busy)
7. Output ONLY valid JSON with keys: prompt, negative_prompt`;

  const userMsg = `Headline: ${title}${label ? `\nCategory: ${label}` : ""}\nStyle preference: ${style}`;

  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_completion_tokens: 300,
        messages: [
          { role: "system", content: system },
          { role: "user",   content: userMsg },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });

    const data = await resp.json() as any;
    const raw = data?.choices?.[0]?.message?.content ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        prompt: parsed.prompt || parsed.image_prompt || raw,
        negativePrompt: parsed.negative_prompt || "text, words, letters, watermark, blurry, low quality",
      };
    }
    return {
      prompt: raw || `Professional news background, ${style} photography, cinematic lighting`,
      negativePrompt: "text, words, letters, watermark, logo, blurry, low quality",
    };
  } catch {
    return {
      prompt: `Professional news background image, ${style}, cinematic lighting, high quality, suitable for text overlay`,
      negativePrompt: "text, words, letters, watermark, logo, blurry, low quality, distorted",
    };
  }
}

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
  if (!m) throw new Error("veoaifree: nonce not found");
  cachedNonce = { value: m[1], fetchedAt: Date.now() };
  return m[1];
}

function ratioFromAspect(aspect: string): string {
  if (aspect === "1:1") return "IMAGE_ASPECT_RATIO_SQUARE";
  if (aspect === "9:16") return "IMAGE_ASPECT_RATIO_PORTRAIT";
  return "IMAGE_ASPECT_RATIO_LANDSCAPE";
}

function dataUriToBuffer(uri: string): Buffer {
  const m = uri.match(/^data:[^;]+;base64,(.+)$/);
  if (!m) throw new Error("Invalid data URI");
  return Buffer.from(m[1], "base64");
}

function detectExt(buf: Buffer): string {
  if (buf[0] === 0x89 && buf[1] === 0x50) return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "jpg";
  return "png";
}

async function generateImageViaVeoai(prompt: string, aspectRatio: string): Promise<string> {
  const ratio = ratioFromAspect(aspectRatio);
  for (let attempt = 0; attempt < 2; attempt++) {
    const nonce = await getVeoaiNonce(attempt > 0);
    const body = new URLSearchParams({
      action: "veo_video_generator",
      nonce,
      promptText: prompt,
      totalImages: "1",
      ratio,
      actionType: "whisk_final_image",
      dataCode: "", dataText: "", dataFlow: "", dataCode2: "", dataText2: "",
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
    try { parsed = JSON.parse(text); } catch { throw new Error(`veoaifree non-JSON: ${text.slice(0, 200)}`); }
    const success = parsed.success === true || parsed.success === "true";
    if (!success) {
      const reason = parsed.error || parsed.message || JSON.stringify(parsed).slice(0, 200);
      if (attempt === 0 && /nonce|invalid|forbidden|csrf/i.test(reason)) {
        cachedNonce = null;
        continue;
      }
      throw new Error(`Nano Banana refused prompt: ${reason}`);
    }
    const uris: string[] = Array.isArray(parsed.data_uris) ? parsed.data_uris
      : Array.isArray(parsed.data_uri) ? parsed.data_uri
      : parsed.data_uri ? [parsed.data_uri] : [];
    if (uris.length === 0) throw new Error("veoaifree: no images returned");
    const buf = dataUriToBuffer(uris[0]);
    const ext = detectExt(buf);
    const filename = `aibg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    fs.writeFileSync(path.join(RESULTS_DIR, filename), buf);
    return `${NANO_RESULTS_SERVE}${filename}`;
  }
  throw new Error("veoaifree: exhausted retries");
}

router.post("/generate-prompt", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { title, label, style = "photorealistic" } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });

  const allowed = await hasAiImageGeneration(user.id);
  if (!allowed) {
    return res.status(403).json({
      error: "AI Image Generation not available in your plan",
      code: "FEATURE_DISABLED",
      feature: "has_ai_image_generation",
    });
  }

  const result = await generatePromptFromTitle(title, label, style);
  return res.json(result);
});

router.post("/generate-image", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { title, label, aspectRatio = "16:9", style = "photorealistic", customPrompt } = req.body;
  if (!title && !customPrompt) return res.status(400).json({ error: "title or customPrompt is required" });

  const allowed = await hasAiImageGeneration(user.id);
  if (!allowed) {
    return res.status(403).json({
      error: "AI Image Generation not available in your plan",
      code: "FEATURE_DISABLED",
      feature: "has_ai_image_generation",
    });
  }

  let prompt: string;
  let negativePrompt: string;

  if (customPrompt) {
    prompt = customPrompt;
    negativePrompt = "text, words, letters, watermark, blurry, low quality";
  } else {
    const result = await generatePromptFromTitle(title, label, style);
    prompt = result.prompt;
    negativePrompt = result.negativePrompt;
  }

  try {
    const imageUrl = await generateImageViaVeoai(prompt, aspectRatio);
    return res.json({ imageUrl, prompt, negativePrompt });
  } catch (err: any) {
    console.error("AI background generation failed:", err.message);
    return res.status(500).json({ error: err.message || "Image generation failed" });
  }
});

export default router;
