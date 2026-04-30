// @ts-nocheck
import { eq } from "drizzle-orm";
import { db, articlesTable, agentPromptsTable, pipelineLogsTable, sitesTable, usersTable, creditTransactionsTable, systemSettingsTable } from "@workspace/db";
import type { Article } from "@workspace/db";
import { getBlogArticleCost } from "../lib/costService";
import { parse } from "node-html-parser";
import { getEffectiveLimits } from "../lib/planGuard.js";
import {
  callOpenAICompat,
  callOpenRouter,
  callOpenAI,
  callPerplexity,
  callTavily,
  callGemini,
  callOpenAIVision,
  generateImageKieAI,
  generateImageOpenAI,
  generateImageNanobanana,
  pollNanobananaTask,
  pollKieAITask,
  extractJson,
} from "./ai.js";
import {
  wpGetPosts,
  wpUploadImage,
  wpCreatePost,
  wpUpdateRankMath,
} from "./wordpress.js";
import { consumeArticleCredit } from "../middlewares/limits.js";


type Settings = Record<string, string>;
type AgentMap = Record<string, { system_message: string; is_active: boolean }>;

function cleanWpTitle(raw: string): string {
  let t = raw.replace(/<[^>]+>/g, "").trim();
  const firstLine = t.split("\n")[0].trim();
  if (firstLine.length > 10) t = firstLine;
  if (t.length > 80) t = t.slice(0, 77) + "…";
  return t;
}

function buildDescFallback(article: Article): string {
  const pk = article.primary_keyword ?? "";
  const title = article.meta_title ?? article.competitor_title ?? "";
  const sec = (article.secondary_keywords ?? "").split(",").filter(Boolean).slice(0, 2);
  const secPart = sec.length > 0 ? ` Explore ${sec.join(" and ")} with` : " Get";
  if (pk) {
    return `Discover everything about ${pk} in this comprehensive guide.${secPart} actionable strategies, expert tips, and real-world insights to boost your results.`.slice(0, 160);
  }
  return `${title}. Get actionable strategies, expert tips, and real-world insights in this comprehensive guide.`.slice(0, 160);
}

// ── AI Provider resolution ────────────────────────────────────────────────────
type ProviderRole = "main" | "sub" | "writer";

function resolveAiCaller(
  settings: Settings,
  role: ProviderRole
): (systemPrompt: string, userMessage: string, temperature?: number) => Promise<string> {
  const provider = settings[`ai_provider_${role}`] ?? "openrouter";

  if (provider === "openai") {
    const key = settings.openai_api_key ?? "";
    const model = settings[`openai_model_${role}`] ?? (role === "writer" ? "gpt-4o" : "gpt-4o-mini");
    if (!key) throw new Error(`OpenAI API key not configured for ${role} role`);
    return (sys, user, temp) => callOpenAI(key, model, sys, user, temp);
  }

  if (provider === "custom" || provider === "custom_1" || provider === "custom_2" || provider === "custom_3") {
    // Resolve the slot number — "custom" is an alias for "custom_1"
    const slot = provider === "custom" || provider === "custom_1" ? "" : `_${provider.split("_")[1]}`; // "" | "_2" | "_3"
    const prefix = slot === "" ? "custom_ai" : `custom_ai${slot}`;
    const baseUrl = settings[`${prefix}_base_url`] ?? "";
    const key = settings[`${prefix}_key`] ?? "";
    const model = settings[`${prefix}_model_${role}`] ?? "";
    const name = settings[`${prefix}_name`] ?? `Custom${slot || ""}`;
    if (!baseUrl) throw new Error(`${name}: Base URL not configured for ${role} role`);
    if (!model) throw new Error(`${name}: Model not configured for ${role} role`);
    return (sys, user, temp) => callOpenAICompat(baseUrl, key, model, sys, user, temp);
  }

  // Default: OpenRouter
  const keyMap: Record<ProviderRole, string> = {
    main: settings.openrouter_api_key_1 ?? "",
    sub: settings.openrouter_api_key_2 ?? "",
    writer: settings.openrouter_api_key_1 ?? "",
  };
  const modelMap: Record<ProviderRole, string> = {
    main: settings.openrouter_model_main ?? "anthropic/claude-3.5-sonnet",
    sub: settings.openrouter_model_sub ?? "google/gemini-flash-1.5",
    writer: settings.openrouter_model_writer ?? "openai/gpt-4o",
  };
  const key = keyMap[role];
  const model = modelMap[role];
  if (!key) throw new Error(`OpenRouter API key not configured for ${role} role`);
  return (sys, user, temp) => callOpenRouter(key, model, sys, user, temp);
}

function resolveAiAnalysisCaller(
  settings: Settings
): (prompt: string, imageUrl?: string) => Promise<string> {
  const provider = settings.ai_provider_image_analysis ?? "gemini";

  if (provider === "gemini") {
    const key = settings.gemini_api_key ?? "";
    if (!key) throw new Error("Gemini API key not configured for image analysis");
    return (prompt, img) => callGemini(key, prompt, img);
  }

  if (provider === "openai") {
    const model = settings.openai_model_image_analysis ?? "gpt-4o";
    if (!key) throw new Error("OpenAI API key not configured for image analysis");
    return (prompt, img) => callOpenAIVision("https://api.openai.com/v1", key, model, prompt, img);
  }

  if (provider === "openrouter") {
    const key = settings.openrouter_api_key_1 ?? settings.openrouter_api_key_2 ?? "";
    const model = settings.openrouter_model_image_analysis ?? "openai/gpt-4o";
    if (!key) throw new Error("OpenRouter API key not configured for image analysis");
    return (prompt, img) => callOpenAIVision("https://openrouter.ai/api/v1", key, model, prompt, img, 0.7, {
      "HTTP-Referer": "https://ai-blogging-system.replit.app"
    });
  }

  if (provider.startsWith("custom")) {
    const slot = provider === "custom" || provider === "custom_1" ? "" : `_${provider.split("_")[1]}`;
    const prefix = slot === "" ? "custom_ai" : `custom_ai${slot}`;
    const baseUrl = settings[`${prefix}_base_url`] ?? "";
    const key = settings[`${prefix}_key`] ?? "";
    const model = settings[`${prefix}_model_image_analysis`] ?? settings[`${prefix}_model_sub`] ?? "";
    if (!baseUrl) throw new Error(`Custom AI ${slot || "1"}: Base URL not configured for image analysis`);
    return (prompt, img) => callOpenAIVision(baseUrl, key, model, prompt, img);
  }

  // Fallback to Gemini if configured, else throw
  const gKey = settings.gemini_api_key;
  if (gKey) return (prompt, img) => callGemini(gKey, prompt, img);
  throw new Error("No image analysis provider configured correctly");
}

// ── Stage helpers ─────────────────────────────────────────────────────────────

async function logStage(
  articleId: number,
  stage: string,
  status: "success" | "failed" | "skipped",
  message?: string,
  durationMs?: number,
  outputData?: unknown
) {
  await db.insert(pipelineLogsTable).values({
    article_id: articleId,
    stage,
    status,
    message: message?.slice(0, 2000),
    output_data: outputData as never,
    duration_ms: durationMs ?? null,
  }).catch(() => {});
}

async function updateArticle(id: number, fields: Partial<typeof articlesTable.$inferInsert>) {
  await db
    .update(articlesTable)
    .set({ ...fields, updated_at: new Date() })
    .where(eq(articlesTable.id, id));
}

async function runStage<T>(
  name: string,
  articleId: number,
  fn: () => Promise<T>,
  onSuccess: (result: T) => Promise<void>
): Promise<boolean> {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    await onSuccess(result);
    await logStage(articleId, name, "success", `Completed in ${duration}ms`, duration);
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const duration = Date.now() - start;
    await logStage(articleId, name, "failed", msg, duration);
    await updateArticle(articleId, {
      content_status: "failed",
      error_message: `[${name}] ${msg}`.slice(0, 1000),
    });
    return false;
  }
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

export async function processArticle(
  articleId: number,
  settings: Settings,
  agents: AgentMap
): Promise<void> {
  const [article] = await db.select().from(articlesTable).where(eq(articlesTable.id, articleId));
  if (!article) return;

  // ── NEW: Quota & Points Enforcement ──
  // Check if user has already paid for this article (e.g. if it was previously failed but credit was already taken)
  // For simplicity, we check and consume only if it's currently in 'pending' content_status
  if (article.content_status === "pending") {
    const consumption = await consumeArticleCredit(article.user_id, article.id);
    if (!consumption.success) {
      await updateArticle(articleId, {
        content_status: "failed",
        error_message: consumption.error || "Quota exceeded",
      });
      await logStage(articleId, "quota_check", "failed", consumption.error);
      return;
    }
    console.log(`[pipeline] article=${articleId} consumed via ${consumption.consumedType}`);
    await logStage(articleId, "quota_check", "success", `Consumed via ${consumption.consumedType}`);
  }


  const [site] = article.site_id
    ? await db.select().from(sitesTable).where(eq(sitesTable.id, article.site_id))
    : [null];

  const wpUrl = site?.wp_url ?? settings.wp_url ?? "";
  const wpUser = site?.wp_username ?? settings.wp_username ?? "";
  const wpPass = site?.wp_password ?? settings.wp_password ?? "";
  const autoPublish = site?.auto_publish ?? settings.auto_publish === "true";

  const perplexityKey = settings.perplexity_api_key ?? "";
  const tavilyKey = settings.tavily_api_key ?? "";
  const geminiKey = settings.gemini_api_key ?? "";
  const kieaiKey = settings.kieai_api_key ?? "";
  const kieaiModel = settings.kieai_model ?? "flux-dev";
  const kieaiAspect = settings.kieai_aspect_ratio ?? "16:9";

  // AI callers resolved per role
  let callMain: (sys: string, user: string, temp?: number) => Promise<string>;
  let callSub: (sys: string, user: string, temp?: number) => Promise<string>;
  let callWriter: (sys: string, user: string, temp?: number) => Promise<string>;

  try {
    callMain = resolveAiCaller(settings, "main");
    callSub = resolveAiCaller(settings, "sub");
    callWriter = resolveAiCaller(settings, "writer");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateArticle(articleId, { content_status: "failed", error_message: msg });
    await logStage(articleId, "init", "failed", `AI provider config error: ${msg}`);
    return;
  }

  const globalInstructions = (site?.global_instructions ?? "").trim();
  const isArabicSite = globalInstructions.toLowerCase().includes("arabic") || globalInstructions.includes("عربي");
  const isFrenchSite = globalInstructions.toLowerCase().includes("french") || globalInstructions.toLowerCase().includes("français");

  const skipTextStages = article.content_status === "completed" && article.article_status === "published" && article.image_status === "pending";

  function getAgent(key: string) {
    const base = agents[key]?.system_message ?? "";
    if (base) {
      console.log(`[agents] article=${articleId} agent="${key}" — LOADED custom system message (${base.length} chars)`);
    } else {
      console.log(`[agents] article=${articleId} agent="${key}" — NO custom prompt found, using ${globalInstructions ? "global instructions only" : "defaults"}`);
    }
    if (!globalInstructions) return base;
    return `IMPORTANT GLOBAL INSTRUCTIONS (apply to ALL your outputs):\n${globalInstructions}\n\n---\n\n${base}`;
  }

  // ── Stage 1: SCRAPE ─────────────────────────────────────────────────────────
  await updateArticle(articleId, { content_status: "scraping" });

  const scraped = await runStage("scrape", articleId, async () => {
    const res = await fetch(article.rss_link, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BlogBot/1.0)" },
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${article.rss_link}`);
    const html = await res.text();
    const root = parse(html);

    const contentSel = site?.css_selector_content ?? ".single-content .post-content article";
    const imageSel = site?.css_selector_image ?? ".wp-site-blocks .post-thumbnail img";

    const contentEl = root.querySelector(contentSel) ?? root.querySelector("article") ?? root.querySelector(".post-content") ?? root.querySelector("main");
    const fullContent = contentEl?.innerText?.trim() ?? root.querySelector("body")?.innerText?.slice(0, 8000) ?? "";

    const ogImage = root.querySelector('meta[property="og:image"]')?.getAttribute("content")
      ?? root.querySelector('meta[name="og:image"]')?.getAttribute("content");

    function isValidImageUrl(url: string | null | undefined): url is string {
      if (!url || url.startsWith("data:")) return false;
      const lower = url.toLowerCase();
      if (lower.endsWith(".svg")) return false;
      if (lower.includes("youtube.com/embed") || lower.includes("youtu.be") || lower.includes("vimeo.com")) return false;
      if (/logo|icon|lockup|brand|avatar|sprite|badge|placeholder|blank\./i.test(lower)) return false;
      return true;
    }

    let imageUrl: string | null = null;

    if (isValidImageUrl(ogImage)) {
      imageUrl = ogImage;
    } else {
      const customImgEl = root.querySelector(imageSel);
      const customSrc = customImgEl?.getAttribute("src") ?? customImgEl?.getAttribute("data-src");
      if (isValidImageUrl(customSrc)) {
        imageUrl = customSrc;
      } else {
        const articleEl = root.querySelector("article") ?? root.querySelector(".post-content") ?? root;
        const imgs = articleEl.querySelectorAll("img");
        for (const img of imgs) {
          const src = img.getAttribute("src") ?? img.getAttribute("data-src");
          if (isValidImageUrl(src)) { imageUrl = src; break; }
        }
        if (!imageUrl) {
          for (const img of imgs) {
            const srcset = img.getAttribute("srcset");
            if (srcset) {
              const first = srcset.split(",")[0]?.trim().split(/\s+/)[0];
              if (isValidImageUrl(first)) { imageUrl = first; break; }
            }
          }
        }
      }
    }

    if (imageUrl && imageUrl.startsWith("/")) {
      try {
        const base = new URL(article.rss_link);
        imageUrl = `${base.protocol}//${base.host}${imageUrl}`;
      } catch { /* ignore */ }
    }

    return { fullContent, imageUrl: imageUrl ?? article.competitor_image_url ?? null };
  }, async ({ fullContent, imageUrl }) => {
    await updateArticle(articleId, {
      competitor_full_content: fullContent.slice(0, 20000),
      competitor_image_url: imageUrl ?? article.competitor_image_url,
    });
  });

  if (!scraped) return;

  const fresh = (await db.select().from(articlesTable).where(eq(articlesTable.id, articleId)))[0] as Article;

  // ── Stage 2: COMPETITOR ANALYSIS ────────────────────────────────────────────
  await updateArticle(articleId, { content_status: "analyzing" });

  const agentActive = agents["competitor_analysis"]?.is_active !== false;
  const analysisOk = skipTextStages ? true : await runStage("competitor_analysis", articleId, async () => {
    if (!agentActive) return "skipped";
    const sysPrompt = getAgent("competitor_analysis");
    const prompt = `Competitor Article URL: ${fresh.rss_link}
Title: ${fresh.competitor_title ?? ""}
Description: ${fresh.competitor_description ?? ""}
Full Content (excerpt):
${(fresh.competitor_full_content ?? "").slice(0, 4000)}

Analyze this competitor article. Return JSON: { "content_gaps": string, "content_structure": string, "key_topics": string[] }`;
    return callSub(sysPrompt, prompt);
  }, async (result) => {
    if (result === "skipped") return;
    try {
      const json = extractJson<{ content_gaps?: string; content_structure?: string }>(result);
      await updateArticle(articleId, {
        content_gaps: json.content_gaps?.slice(0, 2000),
        content_structure: json.content_structure?.slice(0, 2000),
      });
    } catch {
      await updateArticle(articleId, { content_gaps: result.slice(0, 2000) });
    }
  });
  if (!analysisOk) return;

  // ── Stage 3: KEYWORD RESEARCH ────────────────────────────────────────────────
  const kwOk = skipTextStages ? true : await runStage("keyword_research", articleId, async () => {
    if (!agents["keyword_research"]?.is_active) return "skipped";
    if (!perplexityKey) throw new Error("Perplexity API key not configured");
    const sysPrompt = getAgent("keyword_research");
    const jsonInstruction = `\n\nCRITICAL: You MUST respond with ONLY valid JSON, no markdown fences, no prose.\nThe "primary_keyword" MUST be a SHORT SEO keyword phrase of 2-5 words MAXIMUM (e.g. "Claude AI ban" NOT the full article title).\n{ "primary_keyword": "2-5 word keyword", "secondary_keywords": ["kw1","kw2",...], "keyword_strategy": "brief explanation" }`;
    const query = sysPrompt
      ? `${sysPrompt}${jsonInstruction}\n\nTopic: ${fresh.competitor_title ?? fresh.rss_link}`
      : `Research SEO keywords for this topic.${jsonInstruction}\nTopic: ${fresh.competitor_title ?? fresh.rss_link}`;
    return callPerplexity(perplexityKey, query);
  }, async (result) => {
    if (result === "skipped") return;

    const KW_STOP = new Set(["the","a","an","in","on","at","to","for","of","and","or","is","are","was","were","has","have","how","why","what","when","where","who","this","that","from","with","its","their","your","my","our"]);

    // Strip parenthetical content and clean a keyword/title for SEO
    const stripParens = (s: string) => s.replace(/\s*\([^)]*\)/g, "").replace(/[|:;,!?@#$%^&*'"'"]/g, " ").replace(/\s+/g, " ").trim();

    // Helper to derive 2-3 word keyword from a title
    const keywordFromTitle = (title: string | null | undefined): string | null => {
      if (!title) return null;
      const cleaned = stripParens(title);
      const seg = cleaned.split(/\s+[|:—]\s+/)[0].trim();
      const source = seg.split(/\s+/).length >= 3 ? seg : cleaned;
      const words = source.split(/\s+/).filter(w => !KW_STOP.has(w.toLowerCase()) && w.replace(/[^\w]/g,"").length > 2);
      return words.slice(0, 3).join(" ").toLowerCase().slice(0, 60) || null;
    };

    // Helper to validate & clean AI-returned keyword
    const cleanKeyword = (raw: string | undefined | null): string | null => {
      if (!raw) return null;
      // Strip parens, quotes, punctuation
      let kw = stripParens(raw).replace(/["""'']/g, "").trim().toLowerCase();
      if (!kw) return null;
      // Remove garbage AI refusal patterns
      const badStarts = ["i'm unable","i cannot","i can't","please provide","as an ai","here is","here's","okay","i need","i'm sorry"];
      if (badStarts.some(b => kw.startsWith(b))) return null;
      const words = kw.split(/\s+/).filter(Boolean);
      if (words.length === 0) return null;
      // Too long → extract meaningful words, max 3
      if (words.length > 4 || kw.length > 60) {
        const meaningful = words.filter(w => !KW_STOP.has(w) && w.replace(/[^\w]/g,"").length > 2).slice(0, 3);
        return (meaningful.length >= 2 ? meaningful : words.slice(0, 3)).join(" ").slice(0, 60);
      }
      return words.slice(0, 3).join(" ").slice(0, 60);
    };

    try {
      const json = extractJson<Record<string, unknown>>(result);
      // Flexible field mapping — AI may use different field names
      const rawPrimary = (json.primary_keyword ?? json.keyword ?? json.main_keyword ?? json.focus_keyword ?? json.primaryKeyword) as string | undefined;
      const rawSecondary = (json.secondary_keywords ?? json.keywords ?? json.related_keywords ?? json.secondaryKeywords ?? json.secondary) as string[] | string | undefined;
      const rawStrategy = (json.keyword_strategy ?? json.strategy ?? json.explanation ?? json.analysis) as string | undefined;

      console.log(`[kw_research] article=${articleId} JSON fields: ${Object.keys(json).join(",")}, rawPrimary="${rawPrimary}"`);

      const secondaryArr = Array.isArray(rawSecondary)
        ? rawSecondary.map(k => cleanKeyword(String(k))).filter(Boolean).slice(0, 10) as string[]
        : typeof rawSecondary === "string"
        ? rawSecondary.split(",").map(k => cleanKeyword(k.trim())).filter(Boolean).slice(0, 10) as string[]
        : [];
      let primaryKw = cleanKeyword(rawPrimary) ?? keywordFromTitle(fresh.competitor_title);
      if (primaryKw && primaryKw.split(/\s+/).length === 1 && fresh.competitor_title) {
        const titleWords = keywordFromTitle(fresh.competitor_title);
        if (titleWords && !titleWords.toLowerCase().includes(primaryKw.toLowerCase())) {
          primaryKw = `${primaryKw} ${titleWords.split(/\s+/).slice(0, 2).join(" ")}`.trim().slice(0, 60);
        } else if (titleWords) {
          primaryKw = titleWords;
        }
      }
      if (!primaryKw) {
        primaryKw = keywordFromTitle(fresh.competitor_title);
      }
      console.log(`[kw_research] article=${articleId} final primary="${primaryKw}", secondary=[${secondaryArr.join(',')}]`);
      await updateArticle(articleId, {
        primary_keyword: primaryKw,
        secondary_keywords: secondaryArr.join(", ").slice(0, 1000) || null,
        keyword_strategy: typeof rawStrategy === "string" ? rawStrategy.slice(0, 2000) : null,
      });
    } catch (parseErr) {
      console.log(`[kw_research] article=${articleId} JSON parse FAILED: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
      console.log(`[kw_research] article=${articleId} raw (first 300): ${result.slice(0, 300)}`);
      const fallbackKw = keywordFromTitle(fresh.competitor_title);
      await updateArticle(articleId, {
        keyword_strategy: result.slice(0, 2000),
        primary_keyword: fallbackKw,
      });
    }
  });
  if (!kwOk) return;

  const fresh2 = (await db.select().from(articlesTable).where(eq(articlesTable.id, articleId)))[0] as Article;

  // ── Stage 4: TITLE GENERATION ────────────────────────────────────────────────
  await updateArticle(articleId, { content_status: "seo" });

  const titleOk = skipTextStages ? true : await runStage("title_gen", articleId, async () => {
    if (!agents["title_generator"]?.is_active) return "skipped";
    const sysPrompt = getAgent("title_generator");
    const pk = fresh2.primary_keyword ?? "";
    const prompt = `Generate a click-worthy blog title and URL slug.
Topic: ${fresh2.competitor_title ?? fresh2.rss_link}
Primary Keyword: ${pk}
Secondary Keywords: ${fresh2.secondary_keywords ?? ""}

SLUG RULES:
- The slug MUST contain the primary keyword "${pk}" as-is (keep Arabic/non-Latin characters)
- Separate words with hyphens
- Keep it short (3-6 words)
${globalInstructions ? `\nIMPORTANT STYLE INSTRUCTIONS: ${globalInstructions}` : ""}

You MUST respond with ONLY valid JSON, no markdown fences, no prose:
{ "meta_title": string, "permalink_slug": string }`;
    return callSub(sysPrompt, prompt);
  }, async (result) => {
    if (result === "skipped") return;
    const pk = fresh2.primary_keyword ?? "";
    const hasArabic = /[\u0600-\u06FF]/.test(pk);
    const pkSlug = hasArabic
      ? pk.replace(/\s+/g, "-").replace(/[^\u0600-\u06FF\w-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "")
      : pk.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const saveTitleAndSlug = async (title: string, slug: string) => {
      const cleanSlug = hasArabic
        ? slug.replace(/\s+/g, "-").replace(/[^\u0600-\u06FF\w-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 200)
        : slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 200);
      const finalSlug = cleanSlug && (hasArabic ? cleanSlug.match(/[\u0600-\u06FF]/) : true) ? cleanSlug : pkSlug;
      console.log(`[title_gen] article=${articleId} title="${title}", slug="${finalSlug}"`);
      await updateArticle(articleId, { meta_title: title.slice(0, 200), permalink_slug: finalSlug });
    };

    try {
      const json = extractJson<{ 
        meta_title?: string; 
        improved_Title?: string; 
        rewritten_title?: string;
        title?: string;
        permalink_slug?: string;
        slug?: string;
      }>(result);
      const aiTitle = json.meta_title || json.improved_Title || json.rewritten_title || json.title;
      const aiSlug = json.permalink_slug || json.slug || pkSlug;
      if (aiTitle && aiTitle.length > 5) {
        await saveTitleAndSlug(aiTitle, aiSlug);
        let title = aiTitle;
        if (pk && !title.toLowerCase().includes(pk.toLowerCase())) {
          title = `${pk}: ${title}`;
        }
        await saveTitleAndSlug(title, json.permalink_slug ?? pkSlug);
        return;
      }
    } catch {
    }
    console.log(`[title_gen] article=${articleId} AI failed — using competitor title`);
    const fallbackTitle = fresh2.competitor_title || pk || "Untitled";
    await saveTitleAndSlug(fallbackTitle, pkSlug || "article");
  });
  if (!titleOk) return;

  // Re-read after title_gen to get the latest meta_title
  const fresh2b = (await db.select().from(articlesTable).where(eq(articlesTable.id, articleId)))[0] as Article;

  // ── Stage 5: DESCRIPTION GENERATION ─────────────────────────────────────────
  const descOk = skipTextStages ? true : await runStage("description_gen", articleId, async () => {
    if (!agents["description_generator"]?.is_active) return "skipped";
    const sysPrompt = getAgent("description_generator");
    const pkForDesc = fresh2b.primary_keyword ?? "";
    const titleForDesc = fresh2b.meta_title ?? fresh2b.competitor_title ?? "";
    const prompt = `Write a meta description between 140-160 characters for this article.
Title: ${titleForDesc}
Primary Keyword (MUST include this exact phrase in the description): "${pkForDesc}"

CRITICAL: The meta description MUST contain the phrase "${pkForDesc}" naturally.
Without it, the SEO score will fail.

You MUST respond with ONLY valid JSON, no markdown fences, no prose:
{ "meta_description": string }`;
    return callSub(sysPrompt, prompt);
  }, async (result) => {
    if (result === "skipped") return;
    try {
      const json = extractJson<{ meta_description?: string; description?: string }>(result);
      const desc = json.meta_description ?? json.description;
      if (desc && desc.length > 10) {
        console.log(`[description_gen] article=${articleId} desc="${desc.slice(0, 60)}..."`);
        await updateArticle(articleId, { meta_description: desc.slice(0, 300) });
      } else {
        console.log(`[description_gen] article=${articleId} WARN: AI returned no usable description, generating fallback`);
        await updateArticle(articleId, { meta_description: buildDescFallback(fresh2b) });
      }
    } catch (e) {
      console.log(`[description_gen] article=${articleId} JSON parse failed: ${String(e).slice(0, 100)}, generating fallback`);
      await updateArticle(articleId, { meta_description: buildDescFallback(fresh2b) });
    }
  });
  if (!descOk) return;

  // ── Stage 6: INTERNAL LINKING ─────────────────────────────────────────────────
  const intOk = skipTextStages ? true : await runStage("internal_links", articleId, async () => {
    if (!agents["internal_linking"]?.is_active) return "skipped";
    if (!wpUrl || !wpUser || !wpPass) return "skipped";
    const posts = await wpGetPosts(wpUrl, wpUser, wpPass, 100);
    if (posts.length === 0) {
      console.log(`[internal_links] article=${articleId} no existing WP posts — skipping`);
      return "skipped";
    }
    const sysPrompt = getAgent("internal_linking");
    const prompt = `Choose 3-5 internal links from this list that are most relevant to the article.
Article Title: ${fresh2b.meta_title ?? fresh2.competitor_title ?? ""}
Primary Keyword: ${fresh2b.primary_keyword ?? ""}

Available posts:
${posts.slice(0, 50).map((p) => `- ${cleanWpTitle(p.title.rendered)}: ${p.link}`).join("\n")}

Return ONLY JSON: { "links": [{ "text": string, "url": string }] }`;
    return callSub(sysPrompt, prompt);
  }, async (result) => {
    if (result === "skipped") return;
    try {
      const json = extractJson<{ links?: { text: string; url: string }[] }>(result);
      const links = json.links ?? [];
      if (links.length > 0) {
        console.log(`[internal_links] article=${articleId} found ${links.length} links`);
        await updateArticle(articleId, { internal_links: links as never });
      } else {
        console.log(`[internal_links] article=${articleId} AI returned empty — using WP posts directly`);
        const posts2 = await wpGetPosts(wpUrl!, wpUser!, wpPass!, 5);
        const fallbackLinks = posts2
          .filter(p => p.link && p.title?.rendered)
          .slice(0, 3)
          .map(p => ({ text: cleanWpTitle(p.title.rendered), url: p.link }));
        if (fallbackLinks.length > 0) {
          console.log(`[internal_links] article=${articleId} fallback: ${fallbackLinks.length} links`);
          await updateArticle(articleId, { internal_links: fallbackLinks as never });
        }
      }
    } catch {
      console.log(`[internal_links] article=${articleId} JSON parse failed — using WP posts directly`);
      try {
        const posts2 = await wpGetPosts(wpUrl!, wpUser!, wpPass!, 5);
        const fallbackLinks = posts2
          .filter(p => p.link && p.title?.rendered)
          .slice(0, 3)
          .map(p => ({ text: cleanWpTitle(p.title.rendered), url: p.link }));
        if (fallbackLinks.length > 0) {
          await updateArticle(articleId, { internal_links: fallbackLinks as never });
        }
      } catch {
        // truly non-fatal
      }
    }
  });
  if (!intOk) return;

  // ── Stage 7: EXTERNAL LINKING ─────────────────────────────────────────────────
  const extOk = skipTextStages ? true : await runStage("external_links", articleId, async () => {
    if (!agents["external_linking"]?.is_active) return "skipped";
    if (!tavilyKey) return "skipped";
    const query = `${fresh2.primary_keyword ?? fresh2.competitor_title ?? "blog topic"} authoritative sources 2024 2025`;
    const results = await callTavily(tavilyKey, query, 5);
    const sysPrompt = getAgent("external_linking");
    const prompt = `Choose 3-5 authoritative external links for the article.
Article Title: ${fresh2.meta_title ?? fresh2.competitor_title ?? ""}

Search results:
${results.map((r) => `- ${r.title}: ${r.url}`).join("\n")}

Return ONLY JSON: { "links": [{ "text": string, "url": string }] }`;
    return callSub(sysPrompt, prompt);
  }, async (result) => {
    if (result === "skipped") return;
    try {
      const json = extractJson<{ links?: { text: string; url: string }[] }>(result);
      const links = json.links ?? [];
      if (links.length > 0) {
        console.log(`[external_links] article=${articleId} found ${links.length} links from AI`);
        await updateArticle(articleId, { external_links: links as never });
      } else {
        console.log(`[external_links] article=${articleId} AI returned empty — using Tavily results directly`);
        const query2 = `${fresh2.primary_keyword ?? fresh2.competitor_title ?? "blog topic"} authoritative sources`;
        const results2 = await callTavily(tavilyKey!, query2, 3);
        const fallbackLinks = results2
          .filter(r => r.url && r.title)
          .slice(0, 3)
          .map(r => ({ text: r.title, url: r.url }));
        await updateArticle(articleId, { external_links: fallbackLinks as never });
        console.log(`[external_links] article=${articleId} fallback: ${fallbackLinks.length} links`);
      }
    } catch {
      console.log(`[external_links] article=${articleId} JSON parse failed — using Tavily results directly`);
      try {
        const query2 = `${fresh2.primary_keyword ?? fresh2.competitor_title ?? "blog topic"} authoritative sources`;
        const results2 = await callTavily(tavilyKey!, query2, 3);
        const fallbackLinks = results2
          .filter(r => r.url && r.title)
          .slice(0, 3)
          .map(r => ({ text: r.title, url: r.url }));
        await updateArticle(articleId, { external_links: fallbackLinks as never });
      } catch {
        // truly non-fatal
      }
    }
  });
  if (!extOk) return;

  const fresh3 = (await db.select().from(articlesTable).where(eq(articlesTable.id, articleId)))[0] as Article;

  // ── Stage 8: IMAGE ANALYSIS ───────────────────────────────────────────────────
  const imgUrl = fresh3.competitor_image_url;
  let imagePrompt: string | null = null;

  try {
    const start = Date.now();
    if (agents["image_analysis"]?.is_active !== false) {
      const sysPrompt = getAgent("image_analysis");
      const prompt = sysPrompt
        ? `${sysPrompt}\n\nArticle Title: ${fresh3.meta_title ?? fresh3.competitor_title ?? ""}\nPrimary Keyword: ${fresh3.primary_keyword ?? ""}`
        : `Generate a detailed image creation prompt in English (strictly no other languages) for an article titled "${fresh3.meta_title ?? fresh3.competitor_title ?? ""}". Ensure the prompt describes a high-quality, professional image. AVOID any sensitive, controversial, or illegal topics (no drugs, no violence, no adult content) to ensure the prompt passes AI safety filters. Return ONLY JSON: { "image_prompt": string }`;
      
      let result = "";
      let providerName = settings.ai_provider_image_analysis ?? "Gemini";
      
      try {
        const analyzer = resolveAiAnalysisCaller(settings);
        result = await analyzer(prompt, imgUrl ?? undefined);
        console.log(`[image_analysis] article=${articleId} raw result: "${result.slice(0, 500)}..."`);
      } catch (err) {
        console.log(`[image_analysis] Primary analyzer failed (${String(err).slice(0, 100)}). Falling back to Sub AI (content only).`);
        result = await callSub(sysPrompt || "You are an expert AI image prompt generator.", prompt);
        providerName = "Fallback (Sub AI)";
      }

      try {
        const json = extractJson<any>(result);
        imagePrompt = json.image_prompt ?? json.Image_prompt ?? json.prompt ?? json.imagePrompt ?? json.Prompt ?? (typeof json === "string" ? json : null);
      } catch {
        // Fallback: use regex to find common field patterns even if JSON is broken
        // Stop at '}' or end of string, avoiding early termination at commas
        const promptMatch = result.match(/(?:image[-_]?prompt|prompt)["']?\s*[:=]\s*(?:\|\|\s*)?["']?([\s\S]*?)(?:\s*["']?\s*\}|$)/i);
        if (promptMatch) {
          imagePrompt = promptMatch[1].trim();
        } else {
          imagePrompt = result.replace(/[{}]/g, "").trim();
        }
      }

      // Cleanup final prompt from JSON artifacts, markers, or prefixes
      if (imagePrompt && typeof imagePrompt === "object") {
        const flatten = (obj: any): string => {
          return Object.entries(obj)
            .map(([key, val]) => {
              if (typeof val === "object" && val !== null) return flatten(val);
              return `${key}: ${val}`;
            })
            .join(". ");
        };
        imagePrompt = flatten(imagePrompt);
      }
      
      if (imagePrompt && typeof imagePrompt === "string") {
        imagePrompt = imagePrompt
          .replace(/^[\s\\]+/, "") // remove leading whitespace, backslashes
          .replace(/^["'|]+|["'|]+$/g, "") // remove surrounding quotes/pipes/wrappers
          .replace(/^(?:image[-_]?prompt|prompt)\s*[:=]\s*/i, "") // remove prefixes
          .replace(/^[\s\\]+/, "") // cleanup again after prefix removal
          .replace(/[\u0600-\u06FF]/g, "") // remove any stray Arabic characters
          .trim()
          .slice(0, 1048);
      }

      if (!imagePrompt) {
        imagePrompt = result.slice(0, 500).replace(/[{}]/g, "").trim();
      }

      await updateArticle(articleId, { image_prompt: imagePrompt ?? undefined });
      await logStage(articleId, "image_analysis", "success", `Completed in ${Date.now() - start}ms via ${providerName}`, Date.now() - start);
    } else {
      imagePrompt = `Professional blog hero image for article: "${fresh3.meta_title ?? fresh3.competitor_title ?? ""}". Primary subject: ${fresh3.primary_keyword ?? ""}. Photorealistic, high-quality, editorial style.`;
      await updateArticle(articleId, { image_prompt: imagePrompt });
      await logStage(articleId, "image_analysis", "skipped", "Agent disabled — using fallback image prompt");
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    imagePrompt = `Professional blog hero image for article: "${fresh3.meta_title ?? fresh3.competitor_title ?? ""}". Primary subject: ${fresh3.primary_keyword ?? ""}. Photorealistic, high-quality, editorial style.`;
    await updateArticle(articleId, { image_prompt: imagePrompt });
    await logStage(articleId, "image_analysis", "failed", `Image Analysis failed (${msg.slice(0, 100)}) — using fallback image prompt`);
  }

  // ── Stage 9: IMAGE GENERATION (non-fatal) ────────────────────────────────────
  const effective = await getEffectiveLimits(article.user_id);
  const userHasAiImageAddon = !!effective?.features?.has_ai_image_generation;
  
  let imgGenProvider = settings.image_gen_provider ?? (settings.use_kieai === "true" ? "kieai" : "none");
  
  // Force nanobanana if user has addon but no provider selected (or if user wants automatic AI image)
  if (userHasAiImageAddon && imgGenProvider === "none") {
    imgGenProvider = "nanobanana";
  }

  let generatedImageUrl: string | null = null;
  const imgGenStart = Date.now();

  // Resolve settings prefix and display name
  let settingsPrefix = "";
  if (imgGenProvider === "nanobanana") {
    const slot = settings.image_gen_custom_slot || "1";
    settingsPrefix = (slot === "1" || slot === "") ? "custom_ai" : `custom_ai_${slot}`;
  } else if (imgGenProvider.startsWith("custom")) {
    const slot = (imgGenProvider === "custom" || imgGenProvider === "custom_1") ? "" : `_${imgGenProvider.split("_")[1]}`;
    settingsPrefix = slot === "" ? "custom_ai" : `custom_ai${slot}`;
  }

  const providerName = settingsPrefix ? (settings[`${settingsPrefix}_name`] || "") : "";
  const providerDisplayName = imgGenProvider === "kieai" 
    ? "kie.ai" 
    : imgGenProvider === "openai" 
      ? "OpenAI" 
      : (providerName || imgGenProvider);

  // Auto-detect if we should use Nanobanana polling logic
  const providerBaseUrl = settingsPrefix ? (settings[`${settingsPrefix}_base_url`] ?? "") : "";
  const isNanobanana = (imgGenProvider === "nanobanana" || providerName.toLowerCase().includes("nanobanana"))
                        && !providerBaseUrl.toLowerCase().includes("/v1/images/generations");

  try {
    if (!imagePrompt || imgGenProvider === "none") {
      await updateArticle(articleId, { image_status: "skipped", use_original_image: true });
      await logStage(articleId, "image_generation", "success", `Skipped — no provider selected`, 0);

    } else if (imgGenProvider === "kieai") {
      if (!kieaiKey) throw new Error("kie.ai API key not configured");
      const { taskId } = await generateImageKieAI(kieaiKey, imagePrompt, kieaiAspect, kieaiModel);
      await updateArticle(articleId, { kieai_task_id: taskId, image_status: "generating" });
      const url = await pollKieAITask(kieaiKey, taskId);
      generatedImageUrl = url;
      await updateArticle(articleId, { generated_image_url: url, image_status: "generated" });
      const dur = Date.now() - imgGenStart;
      await logStage(articleId, "image_generation", "success", `kie.ai completed in ${dur}ms`, dur);

    } else if (isNanobanana) {
      // Nanobanana provider (uses Polling)
      const baseUrl = settingsPrefix ? (settings[`${settingsPrefix}_base_url`] ?? "") : "";
      const apiKey = settingsPrefix ? (settings[`${settingsPrefix}_key`] ?? "") : "";
      
      if (!baseUrl) throw new Error(`${providerDisplayName}: Base URL not configured`);
      
      const scrubbedPrompt = (imagePrompt ?? "")
        .replace(/\b(?:drug|smuggle|illegal|cocaine|heroin|cannabis|marijuana|violence|killing|death|blood)\b/gi, "safety-sanitized-scene")
        .replace(/[^\x00-\x7F]/g, "") // Remove non-ASCII characters
        .trim();
        
      const { jobId } = await generateImageNanobanana(baseUrl, apiKey, scrubbedPrompt);
      await updateArticle(articleId, { image_status: "generating" });
      const url = await pollNanobananaTask(baseUrl, apiKey, jobId);
      generatedImageUrl = url;
      await updateArticle(articleId, { generated_image_url: url, image_status: "generated" });
      const dur = Date.now() - imgGenStart;
      await logStage(articleId, "image_generation", "success", `${providerDisplayName} completed in ${dur}ms`, dur);

    } else {
      // Custom / OpenAI-compatible image generation (DALL-E style)
      let baseUrl = "https://api.openai.com/v1";
      let apiKey = settings.openai_api_key ?? "";
      let model = settings.image_gen_model ?? (imgGenProvider === "openai" ? "dall-e-3" : "");

      if (imgGenProvider === "openrouter") {
        baseUrl = "https://openrouter.ai/api/v1";
        apiKey = settings.openrouter_api_key_1 || settings.openrouter_api_key_2 || "";
      } else if (settingsPrefix) {
        baseUrl = settings[`${settingsPrefix}_base_url`] ?? "";
        apiKey = settings[`${settingsPrefix}_key`] ?? "";
      }

      if (imgGenProvider.startsWith("custom") && !baseUrl) {
        throw new Error(`Custom AI: Base URL not configured for image generation`);
      }
      if (!apiKey) {
        throw new Error(`${providerDisplayName}: API key not configured for image generation`);
      }
      
      console.log(`[image_generation] article=${articleId} final sanitized prompt: "${imagePrompt.slice(0, 500)}..."`);
      const url = await generateImageOpenAI(baseUrl, apiKey, model, imagePrompt);
      generatedImageUrl = url;
      await updateArticle(articleId, { generated_image_url: url, image_status: "generated" });
      const dur = Date.now() - imgGenStart;
      await logStage(articleId, "image_generation", "success", `${providerDisplayName} completed in ${dur}ms`, dur);
    }
  } catch (imgGenErr: unknown) {
    const msg = imgGenErr instanceof Error ? imgGenErr.message : String(imgGenErr);
    await updateArticle(articleId, { image_status: "skipped", use_original_image: true });
    await logStage(articleId, "image_generation", "failed", `${providerDisplayName} failed (${msg.slice(0, 150)}) — continuing with competitor image`, Date.now() - imgGenStart);
  }

  // ── Stage 10: IMAGE UPLOAD ────────────────────────────────────────────────────
  let wpImageId: number | null = null;
  const finalImageUrl = generatedImageUrl ?? imgUrl;

  try {
    if (finalImageUrl && wpUrl && wpUser && wpPass) {
      const fresh3b = (await db.select().from(articlesTable).where(eq(articlesTable.id, articleId)))[0] as Article;
      const filename = `${fresh3b.permalink_slug ?? `article-${articleId}`}-${Date.now()}.jpg`;
      try {
        const imageAlt = fresh3.primary_keyword
          ? `${fresh3.primary_keyword} - ${fresh3.meta_title ?? fresh3.competitor_title ?? ""}`
          : fresh3.meta_title ?? fresh3.competitor_title ?? "";
        const media = await wpUploadImage(wpUrl, wpUser, wpPass, finalImageUrl, filename, imageAlt);
        wpImageId = media.id;
        await updateArticle(articleId, {
          wp_image_id: media.id,
          final_image_url: media.source_url,
          image_status: "uploaded",
        });
        await logStage(articleId, "image_upload", "success", `Uploaded image (ID: ${media.id})`);
      } catch (uploadErr) {
        const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
        await logStage(articleId, "image_upload", "failed", `Upload failed: ${msg.slice(0, 200)} — continuing without featured image`);
      }
    } else {
      await logStage(articleId, "image_upload", "skipped", "No image URL or WP credentials — skipping featured image");
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await logStage(articleId, "image_upload", "failed", `Image upload error: ${msg.slice(0, 200)} — continuing`);
  }

  // ── Stage 11: ARTICLE WRITE ───────────────────────────────────────────────────
  await updateArticle(articleId, { content_status: "writing" });
  const fresh4 = (await db.select().from(articlesTable).where(eq(articlesTable.id, articleId)))[0] as Article;
  const minLen = parseInt(settings.article_length_min ?? "600");
  const maxLen = parseInt(settings.article_length_max ?? "700");

  const internalLinksJson = JSON.stringify(fresh4.internal_links ?? []);
  const externalLinksJson = JSON.stringify(fresh4.external_links ?? []);

  // Detect AI refusal / garbage text
  const ARTICLE_GARBAGE_STARTS = [
    "i'm unable","i am unable","i cannot","i can't","i apologize","as an ai",
    "i'm sorry","i am sorry","sorry, but","unfortunately","i would need",
    "to write this","to create this","please provide","i need more","i'll need",
    "okay, i need","of course! to","sure! to write",
  ];
  const isGarbageArticle = (html: string): boolean => {
    const text = html.replace(/<[^>]+>/g, " ").trim().toLowerCase();
    if (text.split(/\s+/).length < 100) return true; // Under 100 words = garbage
    return ARTICLE_GARBAGE_STARTS.some(p => text.startsWith(p));
  };

  const topic = fresh4.meta_title ?? fresh4.competitor_title ?? fresh4.rss_link ?? "this topic";
  const primaryKw = fresh4.primary_keyword ?? topic.split(/\s+/).slice(0, 4).join(" ");
  const articleOk = skipTextStages ? true : await runStage("article_write", articleId, async () => {
    if (!agents["article_writer"]?.is_active) return "skipped";
    const sysPrompt = getAgent("article_writer");
    const prompt = `Write a complete, detailed, SEO-optimized blog article in HTML format about the following topic.

TOPIC: ${topic}
PRIMARY KEYWORD: "${primaryKw}"
SECONDARY KEYWORDS: ${fresh4.secondary_keywords ?? ""}
META TITLE: ${fresh4.meta_title ?? fresh4.competitor_title ?? topic}
META DESCRIPTION: ${fresh4.meta_description ?? ""}
CONTENT STRUCTURE: ${fresh4.content_structure ?? "Use standard blog structure: introduction, main sections with H2/H3 headings, conclusion"}
CONTENT GAPS TO ADDRESS: ${fresh4.content_gaps ?? ""}
KEYWORD STRATEGY: ${fresh4.keyword_strategy ?? ""}

INTERNAL LINKS (MANDATORY — embed ALL of these in the article body):
${internalLinksJson}
Format each as: <a href="URL">descriptive anchor text</a>
Place them where they naturally support the topic. You MUST use every single internal link.

EXTERNAL LINKS (MANDATORY — embed ALL of these in the article body):
${externalLinksJson}
Format each as: <a href="URL" target="_blank" rel="noopener">descriptive anchor text</a>
Place them where they support facts, statistics, or claims. You MUST use every single external link.

COMPETITOR REFERENCE (do NOT copy — improve upon it):
${(fresh4.competitor_full_content ?? "").slice(0, 3000)}

STRICT REQUIREMENTS:
1. Write ${minLen}-${maxLen} words of actual article content — NO exceptions. Count your words before finishing. If below ${minLen}, expand your analysis sections.
2. KEYWORD PLACEMENT (Rank Math SEO requires ALL of these):
   - Use the EXACT primary keyword "${primaryKw}" in the <h1> title
   - Use the EXACT primary keyword "${primaryKw}" in AT LEAST 2 different <h2> subheadings
   - Use the EXACT primary keyword "${primaryKw}" in the FIRST paragraph
   - Use the primary keyword naturally throughout (aim for 1-2% keyword density)
3. Use proper HTML: <h1>, <h2>, <h3>, <p>, <ul>/<li> tags
4. NO preamble, NO "Here is your article", NO meta-commentary — output ONLY the HTML article body starting with <h1>
5. Do NOT wrap the output in markdown code fences (\`\`\`html or \`\`\`). Output raw HTML directly.
6. Do NOT refuse or ask for more information — write the article based on what is provided
7. MANDATORY LINKS: You MUST embed ALL internal links AND ALL external links listed above as clickable <a> tags in the article. Missing links = SEO failure. External links MUST have target="_blank" rel="noopener".`;
    return callWriter(sysPrompt, prompt, 0.8);
  }, async (result) => {
    if (result === "skipped") return;
    let cleaned = result
      .replace(/^```html\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .replace(/```[\w]*\n?/g, "")
      .trim();
    if (isGarbageArticle(cleaned)) {
      throw new Error(`Article writer returned insufficient content (likely AI refusal). Check AI provider settings or article data quality.`);
    }
    let wordCount = cleaned.replace(/<[^>]+>/g, " ").trim().split(/\s+/).length;
    if (wordCount < minLen) {
      console.log(`[article_write] article=${articleId} first attempt only ${wordCount} words — requesting expansion`);
      const expandPrompt = `The article below is only ${wordCount} words. It MUST be at least ${minLen} words.
Expand it by adding more detail, examples, analysis, and depth to EVERY section. Add at least 1-2 new subsections.
Keep the same HTML structure and keyword usage. Output the COMPLETE expanded article in HTML — do NOT summarize or truncate.
Do NOT wrap in markdown code fences.

${cleaned}`;
      const expanded = await callWriter("You are an expert content expander. You take articles and make them more comprehensive and detailed while maintaining SEO quality.", expandPrompt, 0.8);
      cleaned = expanded
        .replace(/^```html\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .replace(/```[\w]*\n?/g, "")
        .trim();
      wordCount = cleaned.replace(/<[^>]+>/g, " ").trim().split(/\s+/).length;
      console.log(`[article_write] article=${articleId} after expansion: ${wordCount} words`);
    }
    // ── Post-processing: inject TOC, ensure links are present ──
    const tocTitle = isArabicSite ? "جدول المحتويات" : isFrenchSite ? "Table des matières" : "Table of Contents";
    const furtherReadingTitle = isArabicSite ? "مراجع إضافية" : isFrenchSite ? "Lectures complémentaires" : "Further Reading";

    // 1. Generate Table of Contents from H2 headings
    const headings: { id: string; text: string }[] = [];
    let tocIndex = 0;
    cleaned = cleaned.replace(/<h2([^>]*)>(.*?)<\/h2>/gi, (_match, attrs, text) => {
      const plainText = text.replace(/<[^>]+>/g, "").trim();
      const id = `section-${++tocIndex}`;
      headings.push({ id, text: plainText });
      if (attrs.includes("id=")) return `<h2${attrs}>${text}</h2>`;
      return `<h2 id="${id}"${attrs}>${text}</h2>`;
    });

    if (headings.length >= 2) {
      const tocHtml = `<div class="wp-block-rank-math-toc-block" id="rank-math-toc"><nav><h2>${tocTitle}</h2><ul>${headings.map(h => `<li><a href="#${h.id}">${h.text}</a></li>`).join("")}</ul></nav></div>`;
      const h1End = cleaned.indexOf("</h1>");
      if (h1End !== -1) {
        const afterH1 = cleaned.indexOf("</p>", h1End);
        const insertAt = afterH1 !== -1 ? afterH1 + 4 : h1End + 5;
        cleaned = cleaned.slice(0, insertAt) + "\n" + tocHtml + "\n" + cleaned.slice(insertAt);
        console.log(`[article_write] article=${articleId} injected TOC with ${headings.length} headings`);
      }
    }

    // 2. Inject missing external links at the end if AI didn't embed them
    const extLinks = fresh4.external_links as { text: string; url: string }[] | null;
    if (extLinks && extLinks.length > 0) {
      const missingExt = extLinks.filter(l => !cleaned.includes(l.url));
      if (missingExt.length > 0) {
        const linksSection = `\n<h2 id="section-resources">${furtherReadingTitle}</h2>\n<ul>${missingExt.map(l => `<li><a href="${l.url}" target="_blank" rel="noopener">${l.text}</a></li>`).join("\n")}</ul>`;
        const closingIdx = cleaned.lastIndexOf("</");
        cleaned = cleaned.slice(0, closingIdx) + linksSection + "\n" + cleaned.slice(closingIdx);
        console.log(`[article_write] article=${articleId} injected ${missingExt.length} missing external links`);
      }
    }

    // 3. Inject missing internal links in the body if AI didn't embed them
    const intLinks = fresh4.internal_links as { text: string; url: string }[] | null;
    if (intLinks && intLinks.length > 0) {
      const missingInt = intLinks.filter(l => !cleaned.includes(l.url));
      if (missingInt.length > 0) {
        const paragraphs = cleaned.match(/<\/p>/g) || [];
        if (paragraphs.length > 2) {
          let injected = 0;
          for (const link of missingInt) {
            const targetIdx = Math.min(2 + injected * 2, paragraphs.length - 1);
            let pCount = 0;
            let insertPos = 0;
            for (let i = 0; i < cleaned.length; i++) {
              if (cleaned.slice(i, i + 4) === "</p>") {
                pCount++;
                if (pCount === targetIdx) {
                  insertPos = i + 4;
                  break;
                }
              }
            }
            if (insertPos > 0) {
              const linkHtml = `\n<p>For more insights, check out <a href="${link.url}">${link.text}</a>.</p>`;
              cleaned = cleaned.slice(0, insertPos) + linkHtml + cleaned.slice(insertPos);
              injected++;
            }
          }
          if (injected > 0) {
            console.log(`[article_write] article=${articleId} injected ${injected} missing internal links`);
          }
        }
      }
    }

    await updateArticle(articleId, { article_html: cleaned });
  });
  if (!articleOk) return;

  // ── Stage 12: WORDPRESS PUBLISH ───────────────────────────────────────────────
  let fresh5 = (await db.select().from(articlesTable).where(eq(articlesTable.id, articleId)))[0] as Article;
  const publishOk = skipTextStages ? true : await runStage("wp_publish", articleId, async () => {
    if (!wpUrl || !wpUser || !wpPass) throw new Error("WordPress credentials not configured");
    if (!fresh5.article_html) throw new Error("No article HTML to publish");

    let publishHtml = fresh5.article_html;
    const pk = fresh5.primary_keyword ?? "";
    const imgUrl = fresh5.final_image_url ?? fresh5.competitor_image_url ?? "";
    if (imgUrl && pk) {
      const imgTag = `<figure class="wp-block-image"><img src="${imgUrl}" alt="${pk}" /><figcaption>${pk}</figcaption></figure>`;
      const h1End = publishHtml.indexOf("</h1>");
      if (h1End !== -1) {
        const insertAt = h1End + 5;
        publishHtml = publishHtml.slice(0, insertAt) + "\n" + imgTag + "\n" + publishHtml.slice(insertAt);
      } else {
        publishHtml = imgTag + "\n" + publishHtml;
      }
    }

    const slug = fresh5.permalink_slug ?? `article-${articleId}`;
    console.log(`[wp_publish] article=${articleId} slug="${slug}"`);

    const post = await wpCreatePost(wpUrl, wpUser, wpPass, {
      title: fresh5.meta_title ?? fresh5.competitor_title ?? "New Article",
      content: publishHtml,
      slug,
      status: autoPublish ? "publish" : "draft",
      featured_media: wpImageId ?? undefined,
      categories: fresh5.wp_category_id ? [fresh5.wp_category_id] : undefined,
    });

    return post;
  }, async (result) => {
    if (typeof result === "object" && result !== null && "id" in result) {
      const post = result as { id: number; link: string };
      await updateArticle(articleId, {
        wp_post_id: post.id,
        wp_post_url: post.link,
        article_status: "published",
      });
      // Deduct points per published article (read from system settings)
      const fresh = (await db.select().from(articlesTable).where(eq(articlesTable.id, articleId)))[0] as Article;
      if (fresh?.user_id) {
        const articleCost = await getBlogArticleCost();
        if (articleCost > 0) {
          const [usr] = await db.select().from(usersTable).where(eq(usersTable.id, fresh.user_id)).limit(1);
          if (usr) {
            // Deduct from monthly first, then purchased
            const monthly = usr.monthly_credits ?? 0;
            const purchased = usr.purchased_credits ?? 0;
            let newMonthly = monthly;
            let newPurchased = purchased;
            let toDeduct = articleCost;
            if (newMonthly >= toDeduct) { newMonthly -= toDeduct; }
            else { toDeduct -= newMonthly; newMonthly = 0; newPurchased = Math.max(0, newPurchased - toDeduct); }
            
            await db.transaction(async (tx) => {
              await tx.update(usersTable).set({ monthly_credits: newMonthly, purchased_credits: newPurchased }).where(eq(usersTable.id, fresh.user_id));
              await tx.insert(creditTransactionsTable).values({
                userId: fresh.user_id,
                type: "spend",
                amount: -articleCost,
                description: `Article published to WordPress`,
                service: "blog_automation",
              });
            });
          }
        }
      }
    }
  });
  if (!publishOk) return;

  // ── Stage 13: RANK MATH SEO ───────────────────────────────────────────────────
  const fresh6 = (await db.select().from(articlesTable).where(eq(articlesTable.id, articleId)))[0] as Article;
  const rankMathOk = skipTextStages ? true : await runStage("rank_math", articleId, async () => {
    if (!fresh6.wp_post_id || !wpUrl || !wpUser || !wpPass) return "skipped";

    // Produces a clean 2-3 word Rank Math focus keyword
    const sanitizeFocusKeyword = (raw: string | null | undefined): string => {
      if (!raw) return "";
      let kw = raw.trim();
      // Strip parenthetical acronyms / explanations: "Optimization (GEO)" → "Optimization"
      kw = kw.replace(/\s*\([^)]*\)/g, "");
      // Strip all punctuation except hyphens (keep compound words like "well-being")
      kw = kw.replace(/[|:;,!?@#$%^&*'"'"]/g, " ");
      // Strip HTML entities
      kw = kw.replace(/&#?\w+;/g, " ");
      // Collapse whitespace
      kw = kw.replace(/\s+/g, " ").trim().toLowerCase();
      // Take first 3 words only
      const words = kw.split(" ").filter(Boolean);
      return words.slice(0, 3).join(" ");
    };

    const cleanedPrimary = sanitizeFocusKeyword(fresh6.primary_keyword);
    const secondaryKws = fresh6.secondary_keywords ?? undefined;
    // Build combined focus keyword string for logging (primary + secondary)
    const allFocusKws = [cleanedPrimary, ...(secondaryKws ? secondaryKws.split(",").map(k => sanitizeFocusKeyword(k)).filter(Boolean) : [])].join(", ");
    console.log(`[rank_math] article=${articleId} focus_keyword="${allFocusKws}"`);

    const ogLocale = isArabicSite ? "ar_AR" : isFrenchSite ? "fr_FR" : "en_US";
    const result = await wpUpdateRankMath(
      wpUrl, wpUser, wpPass,
      fresh6.wp_post_id,
      fresh6.meta_title ?? fresh6.competitor_title ?? "",
      fresh6.meta_description ?? "",
      cleanedPrimary,
      secondaryKws,
      fresh6.final_image_url ?? fresh6.competitor_image_url ?? undefined,
      ogLocale
    );
    if (!result.success) throw new Error(`Rank Math update failed: ${result.error}`);
    return `ok — focus_keyword: "${allFocusKws}"`;
  }, async () => {});

  // ── Stage 14: STATUS UPDATE ───────────────────────────────────────────────────
  await updateArticle(articleId, {
    content_status: "completed",
    error_message: null,
  });

  await logStage(articleId, "status_update", "success", "Pipeline completed successfully");
}

export async function loadAgentsForSite(siteId: number | null): Promise<AgentMap> {
  if (siteId === null) return {};
  const rows = await db
    .select()
    .from(agentPromptsTable)
    .where(eq(agentPromptsTable.site_id, siteId));

  const map: AgentMap = {};
  for (const row of rows) {
    map[row.agent_key] = { system_message: row.system_message, is_active: row.is_active };
  }
  return map;
}
