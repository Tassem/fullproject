import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, plansTable, planAddonsTable, userAddonsTable, settingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { checkAiImagePermission, deductAiImageCredits, refundAiImageCredits } from "../lib/aiImagePermissions";
import { buildPromptFromTitle, buildPromptFromImageAnalysis, buildPromptFromCustomPrompt } from "../lib/promptDirector";
import path from "path";
import fs from "fs";
import crypto from "crypto";

import { generateImage } from "../lib/imageProviderRouter";

const router = Router();

const RESULTS_DIR = path.join(process.cwd(), "data", "nanobanana-results");
if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

const NANO_RESULTS_SERVE = "/api/nanobanana/results/";

function detectExt(buf: Buffer): string {
  if (buf[0] === 0x89 && buf[1] === 0x50) return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "jpg";
  return "png";
}

async function generateImageViaRouter(prompt: string, aspectRatio: string, userId?: number): Promise<string> {
  const result = await generateImage(prompt, { ratio: aspectRatio, count: 1, userId });
  
  if (!result.success) {
    throw new Error(result.error || "Generation failed");
  }

  const buf = result.images[0];
  const ext = detectExt(buf);
  const filename = `aibg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  fs.writeFileSync(path.join(RESULTS_DIR, filename), buf);
  return `${NANO_RESULTS_SERVE}${filename}`;
}


import { logGenerationAttempt, logGenerationSuccess, logGenerationFailure } from "../lib/logger";

router.post("/generate", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { mode, titleText, imageUrl, customPrompt, aspectRatio = "16:9", style = "photorealistic" } = req.body;
  
  if (!["title", "image", "prompt"].includes(mode)) {
    return res.status(400).json({ error: "Invalid mode" });
  }

  logGenerationAttempt({
    userId: user.id,
    mode,
    headline: titleText || customPrompt || "image-mode"
  });

  const perm = await checkAiImagePermission(user.id);
  if (!perm.allowed) {
    return res.status(perm.errorType === "insufficient_credits" ? 402 : 403).json({
      success: false,
      errorType: perm.errorType,
      message: perm.reason || "Not allowed",
      creditsDeducted: 0,
      retryable: false
    });
  }

  let prompt: string;
  let usedFallback = false;
  let generationMethod: string = mode;

  try {
    if (mode === "prompt") {
      const resPrompt = await buildPromptFromCustomPrompt(customPrompt, false, style, user.id);
      prompt = resPrompt.finalPrompt;
    } else if (mode === "image") {
      try {
        const resImg = await buildPromptFromImageAnalysis(imageUrl, style, user.id);
        prompt = resImg.finalPrompt;
        generationMethod = "image_analysis";
      } catch (err) {
        if (!titleText || titleText.length < 3) throw err;
        prompt = (await buildPromptFromTitle(titleText, style, user.id)).finalPrompt;
        generationMethod = "headline_fallback";
      }
    } else {
      const resTitle = await buildPromptFromTitle(titleText, style, user.id);
      prompt = resTitle.finalPrompt;
      generationMethod = "headline";
    }

    // GENERATION WITH RETRY
    let finalImageUrl: string | null = null;
    let lastErr: any = null;
    const maxAttempts = 3;

    let finalAttempt = 1;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      finalAttempt = attempt;
      try {
        console.log(`🔄 Generation attempt ${attempt}/${maxAttempts}`);
        finalImageUrl = await generateImageViaRouter(prompt, aspectRatio, user.id);
        if (finalImageUrl) break;
      } catch (err: any) {
        lastErr = err;
        if (err.message && err.message.includes("refused prompt")) {
          console.log("NanoBanana refused prompt, simplifying...");
          // Simplify: take first 5 comma-separated parts
          const parts = prompt.split(",").map(p => p.trim());
          prompt = parts.slice(0, 5).join(", ") + ", professional photography, high quality";
          // If already simplified, try a very basic fallback
          if (attempt === 2) {
            prompt = "professional news media background, editorial lighting, clean composition";
          }
          continue;
        }
        
        if (attempt < maxAttempts) {
          const waitTime = Math.pow(2, attempt) * 1000;
          await new Promise(r => setTimeout(r, waitTime));
        }
      }
    }

    if (!finalImageUrl) throw lastErr || new Error("Failed after retries");

    // Deduct credits AFTER successful generation
    const deduct = await deductAiImageCredits(user.id, "web", prompt);
    if (!deduct.success) {
      return res.status(402).json({
        success: false,
        errorType: "insufficient_credits",
        message: deduct.error,
        creditsDeducted: 0,
        retryable: false
      });
    }

    logGenerationSuccess({
      userId: user.id,
      method: generationMethod,
      attempts: finalAttempt,
      creditsUsed: deduct.creditsDeducted,
      finalPrompt: prompt
    });

    return res.json({ 
       success: true, 
       imageUrl: finalImageUrl, 
       usedPrompt: prompt,
       mode,
       generationMethod,
       creditsDeducted: deduct.creditsDeducted,
       message: usedFallback ? "Could not analyze image. Generated from headline instead." : undefined
    });
  } catch (err: any) {
    console.error("AI generation failed:", err.message);
    
    let errorType = "unknown";
    let userMsg = "Something went wrong. Please try again. No credits were deducted.";
    
    if (err.code === "BYOK_KEY_MISSING" || err.message?.includes("BYOK_KEY_MISSING")) {
      return res.status(422).json({
        success: false,
        errorType: "byok_key_missing",
        message: "يرجى إضافة مفتاح OpenRouter الخاص بك في صفحة الاشتراك للمتابعة."
      });
    }

    if (err.message) {
      const msgLower = err.message.toLowerCase();
      if (msgLower.includes("aborted") || msgLower.includes("timeout")) {
        errorType = "timeout";
        userMsg = "Generation is taking too long. The service may be busy. Please try again. No credits were deducted.";
      } else if (msgLower.includes("refused prompt") || msgLower.includes("uploaded image contains content")) {
        errorType = "prompt_rejected";
        userMsg = err.message.includes("The uploaded image") ? err.message : "This description could not be processed. Try rephrasing or use a different style. No credits were deducted.";
      } else if (msgLower.includes("no images returned") || msgLower.includes("veoaifree")) {
        errorType = "service_unavailable";
        userMsg = "The image generation service is currently unavailable. Please try again in a few minutes. No credits were deducted.";
      }
    }
    
    logGenerationFailure({
      userId: user.id,
      error: err.message,
      attempts: 3,
      creditsRefunded: 0
    });

    return res.status(500).json({ 
      success: false,
      errorType,
      message: userMsg,
      creditsDeducted: 0,
      retryable: true
    });
  }
});

// Deprecated routes pointing to the new unified generator
router.post("/generate-prompt", requireAuth, async (req, res) => {
   return res.status(400).json({ error: "Use POST /api/ai-background/generate instead." });
});

router.post("/generate-image", requireAuth, async (req, res) => {
   return res.status(400).json({ error: "Use POST /api/ai-background/generate instead." });
});

export default router;
