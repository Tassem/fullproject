import { db } from "@workspace/db";
import { systemSettingsTable } from "@workspace/db";
import { generateNanobananaImage } from "./nanobananaClient.js";

export interface ImageGenerationResult {
  success: boolean;
  images: Buffer[];
  provider: string;
  error?: string;
}

export async function generateImage(
  prompt: string,
  options: {
    ratio?: string;
    count?: number;
    userId?: number;
  } = {}
): Promise<ImageGenerationResult> {
  const rows = await db.select().from(systemSettingsTable);
  const sett: Record<string, string> = {};
  for (const r of rows) sett[r.key] = r.value ?? "";

  const provider = sett["ai_image_provider"] || "nanobanana";
  const { count = 1, ratio = "1:1" } = options;

  if (provider === "disabled") {
    return { success: false, images: [], provider, error: "Image generation is disabled in settings." };
  }

  if (provider === "openai") {
    const apiKey = sett["openai_api_key"];
    if (!apiKey) return { success: false, images: [], provider, error: "OpenAI API key is missing." };

    const model = sett["openai_image_model"] || "dall-e-3";
    const size = sett["openai_image_size"] || "1024x1024";

    try {
      const resp = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt,
          n: count,
          size,
          response_format: "b64_json",
        }),
      });

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `OpenAI HTTP ${resp.status}`);
      }

      const data = await resp.json();
      const images = data.data.map((item: any) => Buffer.from(item.b64_json, "base64"));

      return { success: true, images, provider };
    } catch (err: any) {
      // Fallback logic if enabled
      if (sett["ai_image_fallback_enabled"] === "true") {
        console.warn("OpenAI failed, falling back to Nanobanana...", err.message);
        return await callNanobanana(prompt, ratio, count);
      }
      return { success: false, images: [], provider, error: `OpenAI error: ${err.message}` };
    }
  }

  // Default: nanobanana
  return await callNanobanana(prompt, ratio, count);
}

async function callNanobanana(prompt: string, ratio: string, count: number): Promise<ImageGenerationResult> {
  // Map standard ratios to Nanobanana aspects if needed
  // 1:1 -> IMAGE_ASPECT_RATIO_SQUARE
  // 16:9 -> IMAGE_ASPECT_RATIO_LANDSCAPE
  // 9:16 -> IMAGE_ASPECT_RATIO_PORTRAIT
  let nbRatio = "IMAGE_ASPECT_RATIO_LANDSCAPE";
  if (ratio === "1:1" || ratio === "SQUARE") nbRatio = "IMAGE_ASPECT_RATIO_SQUARE";
  else if (ratio === "9:16" || ratio === "PORTRAIT") nbRatio = "IMAGE_ASPECT_RATIO_PORTRAIT";

  const res = await generateNanobananaImage(prompt, { ratio: nbRatio, count });
  return {
    success: res.success,
    images: res.images,
    provider: "nanobanana",
    error: res.error,
  };
}
