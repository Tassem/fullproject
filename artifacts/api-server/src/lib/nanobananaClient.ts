
import { db } from "@workspace/db";
import { systemSettingsTable } from "@workspace/db";

const DEFAULT_VEOAI_PAGE = "https://veoaifree.com/nano-banana-ulimited-ai-image-generator/";
const DEFAULT_VEOAI_AJAX = "https://veoaifree.com/wp-admin/admin-ajax.php";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

let cachedNonce: { value: string; fetchedAt: number } | null = null;
let activeRequests = 0;

interface NanobananaConfig {
  pageUrl: string;
  ajaxUrl: string;
  timeoutMs: number;
  nonceCacheMin: number;
  maxConcurrent: number;
  queueEnabled: boolean;
  retryCount: number;
  enabled: boolean;
}

let configCache: { value: NanobananaConfig; fetchedAt: number } | null = null;

async function getNanobananaConfig(): Promise<NanobananaConfig> {
  if (configCache && Date.now() - configCache.fetchedAt < 60_000) {
    return configCache.value;
  }

  const rows = await db.select().from(systemSettingsTable);
  const sett: Record<string, string> = {};
  for (const r of rows) sett[r.key] = r.value ?? "";

  const config: NanobananaConfig = {
    pageUrl: sett["nanobanana_page_url"] || DEFAULT_VEOAI_PAGE,
    ajaxUrl: sett["nanobanana_ajax_url"] || DEFAULT_VEOAI_AJAX,
    timeoutMs: parseInt(sett["nanobanana_timeout_ms"] || "180000", 10),
    nonceCacheMin: parseInt(sett["nanobanana_nonce_cache_min"] || "30", 10),
    maxConcurrent: parseInt(sett["nanobanana_max_concurrent"] || "1", 10),
    queueEnabled: sett["nanobanana_queue_enabled"] !== "false",
    retryCount: parseInt(sett["nanobanana_retry_count"] || "1", 10),
    enabled: sett["nanobanana_enabled"] !== "false",
  };

  configCache = { value: config, fetchedAt: Date.now() };
  return config;
}

async function getVeoaiNonce(force = false): Promise<string> {
  const config = await getNanobananaConfig();
  if (!force && cachedNonce && Date.now() - cachedNonce.fetchedAt < config.nonceCacheMin * 60_000) {
    return cachedNonce.value;
  }
  const resp = await fetch(config.pageUrl, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!resp.ok) throw new Error(`veoaifree page ${resp.status}`);
  const html = await resp.text();
  const m = html.match(/"nonce"\s*:\s*"([a-z0-9]+)"/i);
  if (!m) throw new Error("veoaifree: nonce not found");
  cachedNonce = { value: m[1], fetchedAt: Date.now() };
  return m[1];
}

function dataUriToBuffer(uri: string): Buffer {
  const m = uri.match(/^data:[^;]+;base64,(.+)$/);
  if (!m) throw new Error("Invalid data URI");
  return Buffer.from(m[1], "base64");
}

export async function testNanobananaConnection(): Promise<{
  success: boolean;
  latencyMs: number;
  nonceFound: boolean;
  error?: string;
}> {
  const start = Date.now();
  try {
    const nonce = await getVeoaiNonce(true);
    return {
      success: true,
      latencyMs: Date.now() - start,
      nonceFound: !!nonce,
    };
  } catch (err: any) {
    return {
      success: false,
      latencyMs: Date.now() - start,
      nonceFound: false,
      error: err.message,
    };
  }
}

export function clearNanobananaCache(): void {
  cachedNonce = null;
  configCache = null;
}

/**
 * Unofficial Nano Banana Client with Queue System
 */
export async function generateNanobananaImage(
  prompt: string,
  options: {
    ratio?: string;
    count?: number;
    expandPrompt?: boolean;
  } = {}
): Promise<{
  success: boolean;
  images: Buffer[];
  error?: string;
}> {
  const config = await getNanobananaConfig();
  if (!config.enabled) {
    return { success: false, images: [], error: "Nanobanana is currently disabled in settings." };
  }

  // Simple Queue System
  if (config.queueEnabled && activeRequests >= config.maxConcurrent) {
    const queueStart = Date.now();
    const queueTimeout = 300_000; // 5 minutes max wait
    
    while (activeRequests >= config.maxConcurrent) {
      if (Date.now() - queueStart > queueTimeout) {
        return { success: false, images: [], error: "Queue timeout: Too many concurrent requests." };
      }
      await new Promise(r => setTimeout(r, 500)); // Poll every 500ms
    }
  }

  activeRequests++;

  try {
    const { ratio = "IMAGE_ASPECT_RATIO_LANDSCAPE", count = 1, expandPrompt = true } = options;
    
    let effectivePrompt = prompt;
    if (expandPrompt) {
      const trimmed = prompt.trim();
      if (!(trimmed.length >= 25 && trimmed.split(/\s+/).length >= 4)) {
        effectivePrompt = `${trimmed}, high quality, photorealistic, detailed, sharp focus, professional lighting`;
      }
    }

    for (let attempt = 0; attempt < config.retryCount; attempt++) {
      try {
        const nonce = await getVeoaiNonce(attempt > 0);
        const body = new URLSearchParams({
          action: "veo_video_generator",
          nonce,
          promptText: effectivePrompt,
          totalImages: String(count),
          ratio,
          actionType: "whisk_final_image",
          dataCode: "", dataText: "", dataFlow: "", dataCode2: "", dataText2: "",
        });

        const resp = await fetch(config.ajaxUrl, {
          method: "POST",
          headers: {
            "User-Agent": UA,
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
            Referer: config.pageUrl,
            Origin: new URL(config.pageUrl).origin,
            Accept: "application/json, text/javascript, */*; q=0.01",
          },
          body: body.toString(),
          signal: AbortSignal.timeout(config.timeoutMs),
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
          return { success: false, images: [], error: `Nano Banana refused prompt: ${reason}` };
        }

        const uris: string[] = Array.isArray(parsed.data_uris) ? parsed.data_uris 
          : (Array.isArray(parsed.data_uri) ? parsed.data_uri 
          : (parsed.data_uri ? [parsed.data_uri] : []));
          
        if (uris.length === 0) throw new Error("veoaifree: no images in response");
        
        return {
          success: true,
          images: uris.map(dataUriToBuffer)
        };
      } catch (err: any) {
        if (attempt < config.retryCount - 1) {
          console.log(`Nanobanana attempt ${attempt + 1} failed, retrying...`, err.message);
          continue;
        }
        throw err;
      }
    }
    throw new Error("veoaifree: exhausted retries");
  } catch (err: any) {
    return { success: false, images: [], error: err.message };
  } finally {
    activeRequests--;
  }
}
