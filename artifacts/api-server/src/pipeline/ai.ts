// @ts-nocheck
type Message = { role: "user" | "assistant" | "system"; content: string };

interface OpenAICompatResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

// ── Generic OpenAI-compatible caller (works for OpenAI, custom providers, OpenRouter) ──
export async function callOpenAICompat(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  temperature = 0.7,
  extraHeaders?: Record<string, string>
): Promise<string> {
  const messages: Message[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: userMessage });

  const cleanBaseUrl = baseUrl.replace(/\/$/, "");
  const url = cleanBaseUrl.includes("/chat/completions") ? cleanBaseUrl : `${cleanBaseUrl}/chat/completions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(extraHeaders ?? {}),
    },
    body: JSON.stringify({ model, messages, temperature, stream: false }),
    signal: AbortSignal.timeout(300000),
  });

  const text = await res.text();
  if (!res.ok) {
    let msg = `AI provider HTTP ${res.status} (${url})`;
    try {
      const err = JSON.parse(text) as OpenAICompatResponse;
      msg = err?.error?.message ?? msg;
    } catch { /* use default msg */ }
    throw new Error(msg);
  }

  const data = extractJson<OpenAICompatResponse>(text);
  const content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.delta?.content;
  if (!content && !data.error) throw new Error("AI provider returned empty response");
  if (data.error) throw new Error(typeof data.error === 'string' ? data.error : (data.error.message ?? "Unknown AI error"));
  return content.trim();
}

// ── OpenAI-compatible Vision caller (for image analysis) ─────────────────────
export async function callOpenAIVision(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  imageUrl?: string,
  temperature = 0.7,
  extraHeaders?: Record<string, string>
): Promise<string> {
  const cleanBaseUrl = baseUrl.replace(/\/$/, "");
  const url = cleanBaseUrl.includes("/chat/completions") ? cleanBaseUrl : `${cleanBaseUrl}/chat/completions`;

  const content: any[] = [{ type: "text", text: prompt }];
  if (imageUrl) {
    content.push({ type: "image_url", image_url: { url: imageUrl } });
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(extraHeaders ?? {}),
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      temperature,
      stream: false
    }),
    signal: AbortSignal.timeout(300000),
  });

  const text = await res.text();
  if (!res.ok) {
    let msg = `Vision provider HTTP ${res.status} (${url})`;
    try {
      const err = JSON.parse(text) as OpenAICompatResponse;
      msg = err?.error?.message ?? msg;
    } catch { /* use default msg */ }
    throw new Error(msg);
  }

  const data = extractJson<OpenAICompatResponse>(text);
  const responseText = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.delta?.content;
  if (!responseText && !data.error) throw new Error("Vision provider returned empty response");
  if (data.error) throw new Error(typeof data.error === 'string' ? data.error : (data.error.message ?? "Unknown Vision error"));
  return responseText.trim();
}

// ── OpenRouter ───────────────────────────────────────────────────────────────
export async function callOpenRouter(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  temperature = 0.7
): Promise<string> {
  return callOpenAICompat(
    "https://openrouter.ai/api/v1",
    apiKey,
    model,
    systemPrompt,
    userMessage,
    temperature,
    { "HTTP-Referer": "https://ai-blogging-system.replit.app" }
  );
}

// ── OpenAI direct ────────────────────────────────────────────────────────────
export async function callOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  temperature = 0.7
): Promise<string> {
  return callOpenAICompat(
    "https://api.openai.com/v1",
    apiKey,
    model,
    systemPrompt,
    userMessage,
    temperature
  );
}

// ── Perplexity ───────────────────────────────────────────────────────────────
interface PerplexityResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

export async function callPerplexity(
  apiKey: string,
  query: string
): Promise<string> {
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [{ role: "user", content: query }],
      stream: false
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as PerplexityResponse;
    throw new Error(err?.error?.message ?? `Perplexity HTTP ${res.status}`);
  }

  const data = (await res.json()) as PerplexityResponse;
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Perplexity returned empty response");
  return content.trim();
}

// ── Tavily ───────────────────────────────────────────────────────────────────
interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
}

interface TavilyResponse {
  results?: TavilyResult[];
  detail?: string;
}

export async function callTavily(
  apiKey: string,
  query: string,
  maxResults = 5
): Promise<TavilyResult[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, query, max_results: maxResults }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as TavilyResponse;
    throw new Error(err?.detail ?? `Tavily HTTP ${res.status}`);
  }

  const data = (await res.json()) as TavilyResponse;
  return data?.results ?? [];
}

// ── Gemini ───────────────────────────────────────────────────────────────────
interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string; status?: string };
}

// Try gemini-2.0-flash first, fallback to gemini-1.5-flash
export async function callGemini(
  apiKey: string,
  prompt: string,
  imageUrl?: string
): Promise<string> {
  type Part = { text: string } | { inline_data: { mime_type: string; data: string } };
  const parts: Part[] = [];

  if (imageUrl) {
    try {
      const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
      if (imgRes.ok) {
        const buf = await imgRes.arrayBuffer();
        const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
        const b64 = Buffer.from(buf).toString("base64");
        parts.push({ inline_data: { mime_type: contentType.split(";")[0], data: b64 } });
      }
    } catch {
      // fallback: skip image
    }
  }

  parts.push({ text: prompt });

  const tryModel = async (model: string): Promise<string> => {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { maxOutputTokens: 5 } }),
        signal: AbortSignal.timeout(90000),
      }
    );

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as GeminiResponse;
      const msg = err?.error?.message ?? `Gemini HTTP ${res.status}`;
      if (err?.error?.status === "RESOURCE_EXHAUSTED" || msg.includes("quota")) {
        throw new Error("Gemini quota exceeded — upgrade plan or use alternative");
      }
      throw new Error(msg);
    }

    const data = (await res.json()) as GeminiResponse;
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) throw new Error("Gemini returned empty response");
    return content.trim();
  };

  // Try flash first, then fallback
  try {
    return await tryModel("gemini-2.0-flash");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("quota")) throw err; // Don't retry quota errors
    // Fallback to 1.5-flash
    return await tryModel("gemini-1.5-flash");
  }
}

// ── OpenAI DALL-E Image Generation ───────────────────────────────────────────
export async function generateImageOpenAI(
  baseUrl: string,
  apiKey: string,
  model = "dall-e-3",
  prompt: string,
  size = "1792x1024"
): Promise<string> {
  const isOpenRouter = baseUrl.includes("openrouter.ai");
  
  // OpenRouter image models often use /chat/completions instead of /images/generations
  if (isOpenRouter) {
    const cleanBaseUrl = baseUrl.replace(/\/$/, "");
    const url = cleanBaseUrl.includes("/chat/completions") ? cleanBaseUrl : `${cleanBaseUrl}/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://ai-blogging-system.replit.app",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        modalities: ["image"], // Required for image models on OpenRouter
      }),
      signal: AbortSignal.timeout(120000),
    });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMsg = data?.error?.message || "Unknown error";
        const errorCode = data?.error?.code || "no_code";
        console.error(`[OpenRouter Debug] Request Prompt: "${prompt.slice(0, 100)}..."`);
        console.error(`[OpenRouter Debug] Full Error:`, JSON.stringify(data, null, 2));
        throw new Error(`OpenRouter (${errorCode}): ${errorMsg}`);
      }
    
    // Check for images array (OpenRouter standard for image models)
    const imgObj = data?.choices?.[0]?.message?.images?.[0];
    const imgUrlFromImages = imgObj?.image_url?.url || imgObj?.url;
    if (imgUrlFromImages) return imgUrlFromImages;

    const content = data?.choices?.[0]?.message?.content || "";
    // Extract URL from markdown or raw text
    // Refined regex to handle signed URLs with query params and different extensions
    const urlMatch = content.match(/https?:\/\/[^\s"']+\.(?:png|jpg|jpeg|webp|gif|bmp|avif)(?:\?[^\s"']*)?/i);
    if (!urlMatch) {
      // Secondary fallback: any http/https URL that looks like a CDN link or has image markers
      const genericUrlMatch = content.match(/https?:\/\/[^\s"']+(?:img|image|storage|blob|cdn)[^\s"']+/i);
      if (genericUrlMatch) return genericUrlMatch[0];
      
      if (content.includes("http")) {
         const simpleMatch = content.match(/https?:\/\/[^\s"']+/);
         if (simpleMatch) return simpleMatch[0];
      }
      console.error(`[OpenRouter Debug] No URL found in 200 OK response.`);
      console.error(`[OpenRouter Debug] Full JSON Body:`, JSON.stringify(data, null, 2));
      throw new Error(`OpenRouter returned text but no image URL found. Response: ${content.slice(0, 200)}...`);
    }
    return urlMatch[0];
  }

  // Standard OpenAI-compatible /images/generations
  const url = baseUrl.replace(/\/$/, "") + "/images/generations";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, prompt: prompt.slice(0, 4000), n: 1, size }),
    signal: AbortSignal.timeout(120000),
  });
  const data = (await res.json().catch(() => ({}))) as { data?: { url?: string }[]; error?: { message?: string } };
  if (!res.ok) throw new Error(data?.error?.message ?? `Image generation HTTP ${res.status}`);
  const imgUrl = data?.data?.[0]?.url;
  if (!imgUrl) throw new Error("Image generation returned no URL");
  return imgUrl;
}


interface KieAIImageResponse {
  code?: number;
  msg?: string;
  data?: { taskId?: string; task_id?: string };
}

interface KieAIImageTaskResponse {
  code?: number;
  msg?: string;
  data?: {
    status?: string;
    works?: { url?: string; coverUrl?: string }[];
    images?: { url?: string }[];
    imageUrls?: string[];
  };
}

export async function generateImageKieAI(
  apiKey: string,
  prompt: string,
  aspectRatio = "16:9",
  model = "flux-dev"
): Promise<{ taskId: string }> {
  // kie.ai image generation endpoint (new jobs API)
  const res = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      callBackUrl: "https://noop.example.com/webhook",
      input: {
        prompt,
        aspect_ratio: aspectRatio,
        output_format: "png"
      }
    }),
    signal: AbortSignal.timeout(30000),
  });

  const data = (await res.json().catch(() => ({}))) as KieAIImageResponse;

  if (!res.ok || (data?.code !== undefined && data.code !== 200)) {
    throw new Error(data?.msg ?? `kie.ai generate failed (code ${data?.code}, HTTP ${res.status})`);
  }

  const taskId = data?.data?.taskId ?? data?.data?.task_id ?? "";
  if (!taskId) throw new Error("kie.ai did not return a task ID");
  return { taskId };
}

export async function pollKieAITask(
  apiKey: string,
  taskId: string,
  maxWaitMs = 125000
): Promise<string> {
  const deadline = Date.now() + maxWaitMs;
  let attempts = 0;
  while (Date.now() < deadline) {
    attempts++;
    await new Promise((r) => setTimeout(r, 5000));

    const res = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
      method: "GET",
      headers: { 
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      signal: AbortSignal.timeout(15000),
    });

    const data = (await res.json().catch(() => ({}))) as any;
    const state = (data?.data?.state || data?.data?.status || "").toLowerCase();
    
    console.log(`[Kie.ai Debug] Poll #${attempts} Task ${taskId} State: ${state}`);
    if (attempts === 1 || state === "completed" || state === "success" || state === "done" || state === "succeed" || state === "fail" || state === "failed" || state === "error") {
      console.log(`[Kie.ai Debug] Full Response Data:`, JSON.stringify(data, null, 2));
    }

    if (state === "completed" || state === "success" || state === "done" || state === "succeed") {
      const rawData = data?.data || {};
      
      let parsedResult: any = {};
      try {
        if (typeof rawData.resultJson === "string" && rawData.resultJson.trim().startsWith("{")) {
          parsedResult = JSON.parse(rawData.resultJson);
        } else if (typeof rawData.resultJson === "object" && rawData.resultJson !== null) {
          parsedResult = rawData.resultJson;
        }
      } catch (e) {
        console.error("[Kie.ai Debug] Failed to parse resultJson", e);
      }

      const fromResultOut = parsedResult?.output ? (typeof parsedResult.output === "string" ? [parsedResult.output] : (parsedResult.output.image_url ? [parsedResult.output.image_url] : [])) : [];
      const fromResultImage = parsedResult?.image_url ? [parsedResult.image_url] : [];
      const fromResultUrls = parsedResult?.imageUrls || [];
      const fromResultResultUrls = parsedResult?.resultUrls || [];
      const fromResultWorks = parsedResult?.works?.map((w: any) => w.url || w.coverUrl).filter(Boolean) || [];
      const fromResultImages = parsedResult?.images?.map((w: any) => w.url).filter(Boolean) || [];

      const fromOutput = (typeof rawData.output === "string" && rawData.output.startsWith("http")) 
          ? [rawData.output] 
          : (rawData.output?.image_url ? [rawData.output.image_url] : []);
      const fromWorks = rawData.works?.map((w: any) => w.url ?? w.coverUrl).filter(Boolean) ?? [];
      const fromImages = rawData.images?.map((i: any) => i.url).filter(Boolean) ?? [];
      const fromUrls = rawData.imageUrls ?? [];
      
      const urls = [...fromResultOut, ...fromResultImage, ...fromResultUrls, ...fromResultResultUrls, ...fromResultWorks, ...fromResultImages, ...fromOutput, ...fromWorks, ...fromImages, ...fromUrls];
      const url = urls[0];
      
      if (!url) {
        console.error("[Kie.ai Debug] Task completed but no URL found. Data:", JSON.stringify(data, null, 2));
        throw new Error("kie.ai task completed but no image URL returned");
      }
      return url as string;
    }

    if (state === "failed" || state === "error" || state === "fail") {
      console.error(`[Kie.ai Debug] Task Failed Data:`, JSON.stringify(data, null, 2));
      throw new Error(`kie.ai image generation failed: ${data?.msg ?? data?.data?.failMsg ?? "unknown error"}`);
    }
  }

  throw new Error("kie.ai image generation timed out after 2 minutes");
}

// ── JSON extractor ────────────────────────────────────────────────────────────
export function extractJson<T>(text: string): T {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenceMatch ? fenceMatch[1].trim() : text.trim();

  // Special handling for streaming artifacts (SSE)
  if (raw.includes("data:")) {
    const lines = raw.split("\n").filter(l => l.trim().startsWith("data:"));
    for (const line of lines) {
      const jsonStr = line.replace(/^data:\s*/, "").trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed) return parsed as T;
      } catch { /* try next */ }
    }
  }

  const start = raw.search(/[{[]/);
  const end = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
  if (start === -1 || end === -1) throw new Error("No JSON found in AI response");
  
  const jsonStr = raw.slice(start, end + 1);
  try {
    return JSON.parse(jsonStr) as T;
  } catch (err) {
    // Robust fallback for loosely formatted JSON (common with some AI models)
    // Attempt to fix unquoted keys or single quotes
    try {
      const fixed = jsonStr
        .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":') // Quote unquoted keys
        .replace(/:\s*'([^']*)'/g, ': "$1"') // Replace single quoted values
        .replace(/,\s*([}\]])/g, '$1') // Remove trailing commas
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, " "); // Remove control characters
      return JSON.parse(fixed) as T;
    } catch (err2) {
       // Final attempt: if it's a simple string wrapped in something that looks like JSON
       const stringMatch = jsonStr.match(/"(?:image[-_]?prompt|prompt)"\s*:\s*"([\s\S]*)"\s*\}?/i);
       if (stringMatch) return { image_prompt: stringMatch[1].trim() } as any;
       
       throw new Error(`Invalid JSON format: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

// ── Nanobanana Image Generation (Custom Provider) ───────────────────────────
export async function generateImageNanobanana(
  baseUrl: string,
  apiKey: string,
  prompt: string,
  width = 1024,
  height = 1024
): Promise<{ jobId: string }> {
  const url = baseUrl.replace(/\/$/, "") + "/generate";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      width,
      height,
      count: 1
    }),
    signal: AbortSignal.timeout(30000),
  });

  const data = (await res.json().catch(() => ({}))) as { jobId?: string; error?: string };
  if (!res.ok) throw new Error(data?.error ?? `Nanobanana generate failed (HTTP ${res.status})`);

  if (!data?.jobId) throw new Error("Nanobanana did not return a job ID");
  return { jobId: data.jobId };
}

export async function pollNanobananaTask(
  baseUrl: string,
  apiKey: string,
  jobId: string,
  maxWaitMs = 180000
): Promise<string> {
  const deadline = Date.now() + maxWaitMs;
  const pollUrl = baseUrl.replace(/\/$/, "") + `/jobs/${jobId}`;
  
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));

    const res = await fetch(pollUrl, {
      method: "GET",
      headers: { 
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      signal: AbortSignal.timeout(15000),
    });

    const data = (await res.json().catch(() => ({}))) as { status: string; images: string[]; error?: string };
    const state = (data?.status || "").toLowerCase();
    
    if (state === "done" || state === "success" || state === "completed") {
      if (data.images && data.images.length > 0) {
        // The provider returns relative paths like /api/nanobanana/results/xxx.png
        // We need to convert it to a full URL
        const imgPath = data.images[0];
        const providerBase = baseUrl.split("/api/")[0];
        return providerBase + imgPath;
      }
      throw new Error("Nanobanana job completed but no images found");
    }

    if (state === "failed" || state === "error") {
      throw new Error(data.error ?? "Nanobanana job failed");
    }
  }

  throw new Error(`Nanobanana polling timed out after ${maxWaitMs/1000}s`);
}
