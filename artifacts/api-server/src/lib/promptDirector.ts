import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";

export async function getAiConfig() {
  const rows = await db.select().from(settingsTable);
  const sett: Record<string, string> = {};
  for (const r of rows) sett[r.key] = r.value;

  const genProvider = sett["ai_provider_template_gen"] || "custom_ai";

  let baseUrl = "";
  let apiKey = "";
  let modelText = "gpt-4o-mini";
  let modelVision = "gpt-4o";

  if (genProvider === "replit_openai") {
    baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "";
    apiKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "";
    modelText = sett["ai_model_template_gen"] || "gpt-4o-mini";
    modelVision = "gpt-4o"; 
  } else if (genProvider === "openrouter") {
    apiKey = sett["openrouter_api_key_1"] || "";
    baseUrl = "https://openrouter.ai/api/v1";
    modelText = sett["openrouter_model_main"] || "openai/gpt-4o-mini";
    modelVision = sett["openrouter_model_main"] || "openai/gpt-4o"; 
  } else if (genProvider === "custom_ai") {
    baseUrl = sett["custom_ai_base_url"] || "";
    apiKey = sett["custom_ai_key"] || "";
    modelText = sett["custom_ai_model_main"] || "gpt-4o-mini";
    modelVision = sett["custom_ai_model_image_analysis"] || "gpt-4o";
  } else if (genProvider === "custom_ai_2") {
    baseUrl = sett["custom_ai_2_base_url"] || "";
    apiKey = sett["custom_ai_2_key"] || "";
    modelText = sett["custom_ai_2_model_main"] || "gpt-4o-mini";
    modelVision = sett["custom_ai_2_model_image_analysis"] || "gpt-4o";
  }

  if (!baseUrl || !apiKey) {
    if (sett["custom_ai_key"]) {
      baseUrl = sett["custom_ai_base_url"] || "";
      apiKey = sett["custom_ai_key"] || "";
      modelText = sett["custom_ai_model_main"] || "gpt-4o-mini";
      modelVision = sett["custom_ai_model_image_analysis"] || "gpt-4o";
    } else if (sett["openrouter_api_key_1"]) {
      apiKey = sett["openrouter_api_key_1"] || "";
      baseUrl = "https://openrouter.ai/api/v1";
      modelText = sett["openrouter_model_main"] || "openai/gpt-4o-mini";
      modelVision = sett["openrouter_model_main"] || "openai/gpt-4o";
    }
  }

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  };
  if (baseUrl.includes("openrouter.ai")) {
    headers["HTTP-Referer"] = "https://newscard.pro";
  }

  return { baseUrl, apiKey, modelText, modelVision, headers };
}

export interface PromptDirectorResult {
  profile: string;
  finalPrompt: string;
  negativePrompt: string;
  category: string;
}

export function sanitizePrompt(prompt: string): string {
  let p = prompt.toLowerCase();
  
  // 1. Remove/Replace forbidden words (more aggressive)
  const forbidden = [
    { regex: /\b(person|persons|people|human|man|woman|child|children|minor|minors|boy|girl|crowd|face|faces|identities|identity)\b/g, replace: "" },
    { regex: /\b(eye|eyes|hand|hands|body|body parts|finger|fingers|skin)\b/g, replace: "" },
    { regex: /\b(text|sign|logo|brand|word|letter|letters|writing|alphabet|number|numbers|signature|watermark)\b/g, replace: "" },
    { regex: /\b(murder|kill|killing|killer|death|dead|die|suicide|blood|bloody|wound|wounded|injury|injured|hurt|accident|crash|fire|explosion|smoke)\b/g, replace: "dramatic scene" },
    { regex: /\b(weapon|gun|knife|rifle|pistol|bomb|violence|attack|assault|war|battle|fighting)\b/g, replace: "tense atmosphere" },
    { regex: /\bflag|flags\b/g, replace: "banners" },
    { regex: /\bpolice|cop|cops|soldier|soldiers|military\b/g, replace: "security" },
    { regex: /\b(real|identifiable|famous|celebrity|athlete name|politician name)\b/g, replace: "" },
  ];

  for (const f of forbidden) {
    p = p.replace(f.regex, f.replace);
  }

  // 2. Clean up extra spaces/commas (very important for Nano Banana)
  p = p.replace(/,+/g, ",")             // multiple commas
       .replace(/\s+/g, " ")            // multiple spaces
       .replace(/,\s*,/g, ",")          // empty comma segments
       .replace(/^\s*,/g, "")           // leading comma
       .replace(/,\s*$/g, "")           // trailing comma
       .trim();

  // 3. Add safe professional suffix
  const suffix = "professional news background, cinematic lighting, high quality, 8k, detailed environment";
  if (!p.includes("news background")) {
    p += p ? ", " + suffix : suffix;
  }

  return p;
}

export async function getDirectorSettings() {
  const rows = await db.select().from(settingsTable);
  const sett: Record<string, string> = {};
  for (const r of rows) sett[r.key] = r.value;

  return {
    enabled: sett["prompt_director_enabled"] === "true",
    profile: sett["default_visual_profile"] || "neutral",
    depth: sett["prompt_depth"] || "balanced",
    instructions: sett["custom_prompt_instructions"] || `When generating Moroccan news-related images:
- prefer realistic Moroccan environments
- use authentic Moroccan law enforcement uniforms when relevant
- prefer Moroccan architecture, roads, and urban/rural landscapes
- avoid generic Western police imagery
- use North African visual context
- keep results professional, realistic, suitable for news media`,
    negativePrompt: sett["default_negative_prompt"] || "text, watermark, low quality, distorted faces, extra fingers, cartoon style, western police uniform, generic stock photo look",
  };
}

function buildSystemPrompt(settings: any): string {
  let sys = "You are an expert news media art director and prompt engineer.\n";
  if (settings.enabled && settings.profile !== "neutral") {
    sys += `Regional Context Profile: ${settings.profile}\n`;
    sys += `Instructions: ${settings.instructions}\n`;
  }
  sys += `
Rules:
- Transform the user's input into a highly detailed, professional English image generation prompt.
- Detail level: ${settings.depth}.
- Focus on: composition, lighting, colors, mood, environment.
- Do NOT mention: people, faces, violence, weapons, nudity, logos, brands, text, watermarks.
- IMPORTANT: If the headline contains real names of people (e.g. celebrities, athletes, politicians), replace them with general descriptions (e.g. "a professional athlete", "a businessman", "a public figure").
- Output ONLY the prompt, nothing else, max 100 words.`;
  return sys;
}

function extractJson(content: string): any {
  // Strip reasoning tags first
  let cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  // Try to find the first '{' and last '}'
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.substring(start, end + 1);
  }
  return JSON.parse(cleaned);
}

export async function buildPromptFromTitle(
  titleText: string,
  style = "photorealistic"
): Promise<PromptDirectorResult> {
  const settings = await getDirectorSettings();
  const aiConf = await getAiConfig();

  if (!aiConf.baseUrl || !aiConf.apiKey) throw new Error("AI credentials not configured.");

  const systemPrompt = `You are an expert at creating visual image generation prompts for Arabic news content.

TASK:
1. Deeply understand the Arabic headline
2. Extract VISUAL elements: places, actions, emotions, atmosphere
3. Create a detailed English prompt for Flux/DALL-E that captures the VISUAL ESSENCE

RULES:
- Focus on VISUAL storytelling, NOT text
- Use photorealistic, cinematic descriptions
- Include: lighting, composition, mood, color palette
- NEVER mention real person names (use "professional athlete", "public figure", etc.)
- NEVER include text, logos, or watermarks
- Output ONLY valid JSON

OUTPUT FORMAT (strict JSON):
{
  "main_prompt": "detailed visual description",
  "negative_prompt": "avoid list",
  "style": "photorealistic",
  "category": "sports/politics/economy/technology/accident/general"
}`;

  const resp = await fetch(`${aiConf.baseUrl}/chat/completions`, {
    method: "POST",
    headers: aiConf.headers,
    body: JSON.stringify({
      model: aiConf.modelText,
      max_tokens: 600,
      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `Arabic News Headline: "${titleText}"\n\nGenerate as valid JSON.` 
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.6
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!resp.ok) {
    console.error("❌ AI analysis API failed:", resp.status, resp.statusText);
    return {
      finalPrompt: sanitizePrompt(`${titleText}, professional news photography, high quality, 4K, editorial style`),
      negativePrompt: `${settings.negativePrompt}, blurry, low quality, text, watermark`,
      category: "general",
      profile: settings.profile,
    };
  }

  const data = await resp.json() as any;
  const content = data?.choices?.[0]?.message?.content ?? "{}";
  
  let result;
  try {
    result = extractJson(content);
  } catch (parseError) {
    console.error('❌ AI returned invalid JSON:', content.substring(0, 200));
    return {
      finalPrompt: sanitizePrompt(`${titleText}, professional news photography, high quality, 4K, editorial style`),
      negativePrompt: `${settings.negativePrompt}, blurry, low quality, text, watermark`,
      category: "general",
      profile: settings.profile,
    };
  }

  const categoryEnrichment: Record<string, string> = {
    "sports": "dynamic sports photography, action shot, stadium atmosphere, athletic movement",
    "politics": "formal government setting, diplomatic environment, professional lighting, authoritative composition",
    "economy": "modern business district, corporate environment, financial imagery, professional atmosphere",
    "technology": "innovation hub, modern tech lab, futuristic elements, clean design",
    "accident": "emergency response scene, first responders, serious documentary style, urban environment",
    "general": "professional photojournalism, editorial style, balanced composition"
  };

  const category = result.category || "general";
  const enrichment = categoryEnrichment[category] || categoryEnrichment.general;
  const mainPrompt = result.main_prompt || titleText;
  
  const finalPrompt = sanitizePrompt(`${mainPrompt}, ${enrichment}, high quality, 4K, professional photography`);
  const finalNegative = `${result.negative_prompt || ""}, ${settings.negativePrompt}, blurry, distorted, low quality, amateur, text, watermark, signature, logo, real person names, identifiable faces`;

  return {
    finalPrompt,
    negativePrompt: finalNegative,
    category,
    profile: settings.profile,
  };
}

export async function buildPromptFromImageAnalysis(
  imageUrl: string,
  style = "photorealistic"
): Promise<PromptDirectorResult> {
  let base64 = imageUrl;
  try {
    if (imageUrl.startsWith("data:image")) {
      base64 = imageUrl;
    } else {
      const urlToFetch = imageUrl.startsWith("/") ? `http://localhost:${process.env.PORT || 5000}${imageUrl}` : imageUrl;
      const imgRes = await fetch(urlToFetch);
      if (!imgRes.ok) throw new Error("Could not fetch image");
      const buf = await imgRes.arrayBuffer();
      const b64 = Buffer.from(buf).toString("base64");
      const mime = imgRes.headers.get("content-type") || "image/png";
      base64 = `data:${mime};base64,${b64}`;
    }
  } catch (err) {
    throw new Error("Invalid or inaccessible image URL.");
  }

  const settings = await getDirectorSettings();
  const aiConf = await getAiConfig();

  if (!aiConf.baseUrl || !aiConf.apiKey) throw new Error("AI credentials not configured.");
  
  const systemPrompt = `You are a visual art director for a news agency.
Analyze the provided image and describe its BACKGROUND ENVIRONMENT and VISUAL STYLE for regeneration.

CRITICAL RULES:
1. Focus on the SETTING (e.g., stadium, courtroom, street, office, laboratory).
2. Describe lighting, colors, and composition.
3. DO NOT mention people, faces, or bodies. If there are people, describe the environment they are in instead.
4. DO NOT mention text, logos, or brands.
5. Use news-media vocabulary: "professional broadcast setting", "editorial photography", "cinematic news atmosphere".
6. The goal is to generate a background that has the same SUBJECT MATTER (e.g., sports, law, health) as the original.

OUTPUT (strict JSON):
{
  "scene_description": "overall scene and setting",
  "visual_style": "photographic style and technique",
  "composition": "framing and layout",
  "lighting": "lighting conditions and quality",
  "color_palette": "dominant colors and tones",
  "mood": "emotional atmosphere",
  "objects": "key visual elements (no people identification)"
}`;

  const resp = await fetch(`${aiConf.baseUrl}/chat/completions`, {
    method: "POST",
    headers: aiConf.headers,
    body: JSON.stringify({
      model: aiConf.modelVision,
      max_tokens: 500,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: "Analyze this image for regeneration. Focus on STYLE and ATMOSPHERE, not identities." 
            },
            { 
              type: "image_url", 
              image_url: { 
                url: base64,
                detail: "high"
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.6
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!resp.ok) throw new Error("AI analysis failed. Try Custom Prompt mode.");
  const data = await resp.json() as any;
  const content = data?.choices?.[0]?.message?.content ?? "{}";
  const analysis = extractJson(content);
  
  const promptParts = [
    analysis.scene_description,
    analysis.visual_style,
    analysis.composition,
    analysis.lighting,
    `color palette: ${analysis.color_palette}`,
    `${analysis.mood} atmosphere`,
    "professional photography, high quality, 4K"
  ];
  
  const finalPrompt = sanitizePrompt(promptParts.filter(Boolean).join(", "));
  const finalNegative = `identifiable people, real faces, text, logos, watermarks, low quality, blurry, distorted, ${settings.negativePrompt}`;

  return {
    finalPrompt,
    negativePrompt: finalNegative,
    category: "vision",
    profile: settings.profile,
  };
}

export async function buildPromptFromCustomPrompt(
  customPrompt: string,
  enhance = false,
  style = "photorealistic"
): Promise<PromptDirectorResult> {
  const settings = await getDirectorSettings();
  
  if (!enhance) {
    return {
      finalPrompt: sanitizePrompt(customPrompt),
      negativePrompt: settings.negativePrompt,
      category: "custom",
      profile: "neutral",
    };
  }

  const aiConf = await getAiConfig();
  if (!aiConf.baseUrl || !aiConf.apiKey) throw new Error("AI credentials not configured.");

  const sys = buildSystemPrompt(settings);
  const userMsg = `Enhance this prompt: ${customPrompt}\nStyle: ${style}`;

  const resp = await fetch(`${aiConf.baseUrl}/chat/completions`, {
    method: "POST",
    headers: aiConf.headers,
    body: JSON.stringify({
      model: aiConf.modelText,
      max_tokens: 300,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: userMsg }
      ],
    }),
    signal: AbortSignal.timeout(40000),
  });

  if (!resp.ok) throw new Error("AI analysis failed.");
  const data = await resp.json() as any;
  const raw = data?.choices?.[0]?.message?.content?.trim() ?? "";

  return {
    finalPrompt: sanitizePrompt(raw + `, ${style}, professional, clean, news media style`),
    negativePrompt: settings.negativePrompt,
    category: "custom-enhanced",
    profile: settings.profile,
  };
}
