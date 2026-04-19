import { Router } from "express";
import { db } from "@workspace/db";
import { systemSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

async function getSetting(key: string): Promise<string> {
  const [row] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, key));
  return row?.value ?? "";
}

async function testOpenRouter(apiKey: string, model?: string): Promise<{ ok: boolean; message: string; latency?: number }> {
  if (!apiKey) return { ok: false, message: "API key not configured" };
  const start = Date.now();
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://newscard.pro",
      },
      body: JSON.stringify({
        model: model || "openai/gpt-4o-mini",
        messages: [{ role: "user", content: "Reply with just: OK" }],
        max_tokens: 5,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const latency = Date.now() - start;
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string; code?: number } };
      const errMsg = err?.error?.message ?? `HTTP ${res.status}`;
      if (errMsg.toLowerCase().includes("no endpoints found"))
        return { ok: false, message: `Model "${model}" has no active providers — try "openai/gpt-4o-mini" or check openrouter.ai/models`, latency };
      if (res.status === 401) return { ok: false, message: "Invalid API key (401 Unauthorized)", latency };
      if (res.status === 402) return { ok: false, message: "Insufficient credits — top up your OpenRouter balance", latency };
      return { ok: false, message: errMsg.slice(0, 150), latency };
    }
    const data = await res.json() as { choices?: { message?: { content?: string } }[] };
    const reply = data?.choices?.[0]?.message?.content ?? "";
    return { ok: true, message: `Connected ✅ model replied: "${reply.trim()}"`, latency };
  } catch (err: unknown) {
    return { ok: false, message: err instanceof Error ? err.message : "Connection failed" };
  }
}

async function testOpenAI(apiKey: string, model?: string): Promise<{ ok: boolean; message: string; latency?: number }> {
  if (!apiKey) return { ok: false, message: "API key not configured" };
  const start = Date.now();
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model || "gpt-4o-mini",
        messages: [{ role: "user", content: "Reply with just: OK" }],
        max_tokens: 5,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const latency = Date.now() - start;
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
      const errMsg = err?.error?.message ?? `HTTP ${res.status}`;
      if (res.status === 401) return { ok: false, message: "Invalid API key (401 Unauthorized)", latency };
      if (res.status === 429) return { ok: false, message: "Rate limit exceeded or quota reached", latency };
      return { ok: false, message: errMsg.slice(0, 150), latency };
    }
    const data = await res.json() as { choices?: { message?: { content?: string } }[] };
    const reply = data?.choices?.[0]?.message?.content ?? "";
    return { ok: true, message: `Connected ✅ model replied: "${reply.trim()}"`, latency };
  } catch (err: unknown) {
    return { ok: false, message: err instanceof Error ? err.message : "Connection failed" };
  }
}

async function testCustomAI(baseUrl: string, apiKey: string, model?: string): Promise<{ ok: boolean; message: string; latency?: number }> {
  if (!baseUrl) return { ok: false, message: "Custom Base URL not configured" };
  const start = Date.now();
  try {
    const url = baseUrl.replace(/\/$/, "") + "/chat/completions";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: model || "default-model", messages: [{ role: "user", content: "Reply with just: OK" }] }),
      signal: AbortSignal.timeout(60000),
    });
    const latency = Date.now() - start;
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
      return { ok: false, message: err?.error?.message ?? `HTTP ${res.status}`, latency };
    }
    const data = await res.json() as { choices?: { message?: { content?: string } }[] };
    const reply = data?.choices?.[0]?.message?.content ?? "";
    return { ok: true, message: `Connected ✅ model replied: "${reply.trim()}"`, latency };
  } catch (err: unknown) {
    return { ok: false, message: err instanceof Error ? err.message : "Connection failed" };
  }
}

async function testPerplexity(apiKey: string): Promise<{ ok: boolean; message: string; latency?: number }> {
  if (!apiKey) return { ok: false, message: "API key not configured" };
  const start = Date.now();
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "sonar", messages: [{ role: "user", content: "Say OK" }], max_tokens: 5 }),
      signal: AbortSignal.timeout(15000),
    });
    const latency = Date.now() - start;
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
      return { ok: false, message: err?.error?.message ?? `HTTP ${res.status}`, latency };
    }
    const data = await res.json() as { choices?: { message?: { content?: string } }[] };
    const reply = data?.choices?.[0]?.message?.content ?? "";
    return { ok: true, message: `Connected ✅ replied: "${reply.trim().slice(0, 40)}"`, latency };
  } catch (err: unknown) {
    return { ok: false, message: err instanceof Error ? err.message : "Connection failed" };
  }
}

async function testTavily(apiKey: string): Promise<{ ok: boolean; message: string; latency?: number }> {
  if (!apiKey) return { ok: false, message: "API key not configured" };
  const start = Date.now();
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, query: "test", max_results: 1 }),
      signal: AbortSignal.timeout(15000),
    });
    const latency = Date.now() - start;
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { detail?: string; message?: string };
      return { ok: false, message: err?.detail ?? err?.message ?? `HTTP ${res.status}`, latency };
    }
    const data = await res.json() as { results?: unknown[] };
    return { ok: true, message: `Connected ✅ returned ${data?.results?.length ?? 0} result(s)`, latency };
  } catch (err: unknown) {
    return { ok: false, message: err instanceof Error ? err.message : "Connection failed" };
  }
}

async function testGemini(apiKey: string): Promise<{ ok: boolean; message: string; latency?: number }> {
  if (!apiKey) return { ok: false, message: "API key not configured" };
  const start = Date.now();
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: "Say OK" }] }], generationConfig: { maxOutputTokens: 5 } }),
        signal: AbortSignal.timeout(15000),
      }
    );
    const latency = Date.now() - start;
    if (!res.ok) {
      const errData = await res.json().catch(() => ({})) as { error?: { message?: string; status?: string } };
      const errMsg = errData?.error?.message ?? `HTTP ${res.status}`;
      const status = errData?.error?.status ?? "";
      if (status === "RESOURCE_EXHAUSTED" || errMsg.toLowerCase().includes("quota"))
        return { ok: true, message: "API key valid — quota exceeded (upgrade plan or wait)", latency };
      if (res.status === 400 && errMsg.toLowerCase().includes("api key"))
        return { ok: false, message: "Invalid API key", latency };
      return { ok: false, message: errMsg.slice(0, 120), latency };
    }
    const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return { ok: true, message: `Connected ✅ replied: "${reply.trim().slice(0, 40)}"`, latency };
  } catch (err: unknown) {
    return { ok: false, message: err instanceof Error ? err.message : "Connection failed" };
  }
}

async function testKieAI(apiKey: string): Promise<{ ok: boolean; message: string; latency?: number }> {
  if (!apiKey) return { ok: false, message: "API key not configured" };
  const start = Date.now();
  try {
    const res = await fetch("https://api.kie.ai/api/v1/generate", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(12000),
    });
    const latency = Date.now() - start;
    const data = await res.json().catch(() => ({})) as { code?: number; msg?: string };
    const code = data?.code;
    const msg = data?.msg ?? "";
    if (res.status === 401 || code === 401) return { ok: false, message: "Invalid API key (Unauthorized)", latency };
    if (code === 422 || (msg && (msg.toLowerCase().includes("model") || msg.toLowerCase().includes("cannot be null"))))
      return { ok: true, message: "Connected ✅ API key valid", latency };
    if (code === 200 || res.ok) return { ok: true, message: "Connected ✅ API key valid", latency };
    return { ok: false, message: msg || `Unexpected response (code: ${code ?? res.status})`, latency };
  } catch (err: unknown) {
    return { ok: false, message: err instanceof Error ? err.message : "Connection failed" };
  }
}

async function testWordPress(wpUrl: string, wpUsername: string, wpPassword: string): Promise<{ ok: boolean; message: string; latency?: number }> {
  if (!wpUrl || !wpUsername || !wpPassword) return { ok: false, message: "WordPress credentials not configured" };
  const start = Date.now();
  try {
    const base = wpUrl.replace(/\/$/, "");
    const token = Buffer.from(`${wpUsername}:${wpPassword}`).toString("base64");
    const res = await fetch(`${base}/wp-json/wp/v2/users/me`, {
      headers: { "Authorization": `Basic ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    const latency = Date.now() - start;
    if (!res.ok) {
      if (res.status === 401) return { ok: false, message: "Invalid credentials (401 Unauthorized)", latency };
      if (res.status === 404) return { ok: false, message: "WordPress REST API not found — check URL", latency };
      return { ok: false, message: `HTTP ${res.status}`, latency };
    }
    const data = await res.json() as { name?: string; slug?: string };
    return { ok: true, message: `Connected ✅ as "${data?.name ?? data?.slug ?? "user"}"`, latency };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Connection failed";
    if (msg.includes("fetch failed") || msg.includes("ECONNREFUSED"))
      return { ok: false, message: "Cannot reach WordPress — check the URL" };
    return { ok: false, message: msg };
  }
}

// GET /api/test/:service  (requires auth)
router.get("/:service", requireAuth, async (req, res): Promise<void> => {
  const { service } = req.params;
  try {
    let result: { ok: boolean; message: string; latency?: number };

    switch (service) {
      case "openrouter_1": {
        const key = await getSetting("openrouter_api_key_1");
        const model = await getSetting("openrouter_model_main");
        result = await testOpenRouter(key, model);
        break;
      }
      case "openrouter_2": {
        const key = await getSetting("openrouter_api_key_2");
        const model = await getSetting("openrouter_model_sub");
        result = await testOpenRouter(key, model);
        break;
      }
      case "openai": {
        const key = await getSetting("openai_api_key");
        const model = await getSetting("openai_model_main");
        result = await testOpenAI(key, model);
        break;
      }
      case "custom_ai":
      case "custom_ai_1": {
        const url = await getSetting("custom_ai_base_url");
        const key = await getSetting("custom_ai_key");
        const model = await getSetting("custom_ai_model_main");
        result = await testCustomAI(url, key, model);
        break;
      }
      case "custom_ai_2": {
        const url = await getSetting("custom_ai_2_base_url");
        const key = await getSetting("custom_ai_2_key");
        const model = await getSetting("custom_ai_2_model_main");
        result = await testCustomAI(url, key, model);
        break;
      }
      case "custom_ai_3": {
        const url = await getSetting("custom_ai_3_base_url");
        const key = await getSetting("custom_ai_3_key");
        const model = await getSetting("custom_ai_3_model_main");
        result = await testCustomAI(url, key, model);
        break;
      }
      case "perplexity": {
        const key = await getSetting("perplexity_api_key");
        result = await testPerplexity(key);
        break;
      }
      case "tavily": {
        const key = await getSetting("tavily_api_key");
        result = await testTavily(key);
        break;
      }
      case "gemini": {
        const key = await getSetting("gemini_api_key");
        result = await testGemini(key);
        break;
      }
      case "kieai": {
        const key = await getSetting("kieai_api_key");
        result = await testKieAI(key);
        break;
      }
      case "wordpress": {
        const url = await getSetting("wp_url");
        const user = await getSetting("wp_username");
        const pass = await getSetting("wp_password");
        result = await testWordPress(url, user, pass);
        break;
      }
      default:
        res.status(400).json({ ok: false, message: `Unknown service: ${service}` });
        return;
    }

    res.json(result);
  } catch (err) {
    (req as any).log?.error?.(err, `Test failed for service: ${service}`);
    res.status(500).json({ ok: false, message: "Internal error during test" });
  }
});

export default router;
