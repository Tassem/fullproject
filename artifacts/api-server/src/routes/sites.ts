import { Router } from "express";
import { db } from "@workspace/db";
import { sitesTable, articlesTable, agentPromptsTable, usersTable, rssFeedsTable } from "@workspace/db";
import { eq, and, count, isNotNull } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

function feedToSnake(f: typeof rssFeedsTable.$inferSelect) {
  return {
    id: f.id,
    site_id: f.site_id,
    user_id: f.user_id,
    rss_url: f.rss_url,
    label: f.label,
    wp_category_id: f.wp_category_id,
    wp_category_name: f.wp_category_name,
    poll_hours: f.poll_hours,
    poll_minutes: f.poll_minutes,
    max_articles: f.max_articles,
    is_active: f.is_active,
    last_polled_at: f.last_polled_at,
    created_at: f.created_at,
    updated_at: f.updated_at,
  };
}

const router = Router();

// ── DEFAULT AGENT PROMPTS (full set from original) ────────────────────────────
const DEFAULT_PROMPTS: Record<string, { agent_name: string; description: string; system_message: string }> = {
  blog_manager: {
    agent_name: "Blog Manager",
    description: "Main orchestrator that coordinates SEO Agent and Image Agent sequentially",
    system_message: `You are a blog Manager orchestrating a sequential blogging analysis pipeline.

CRITICAL: You MUST execute these steps ONE AT A TIME in this EXACT order and Wait for each step to complete before starting the next:

## SEQUENTIAL EXECUTION (MANDATORY):

**STEP 1: run SEO Manager FIRST**
**STEP 2: run Image Agent SECOND**
**STEP 3: Store OUTPUT from SEO Manager to WordPress Data

## IMPORTANT RULES:
- Call Agents SEQUENTIALLY.
- Each Agent must complete before next starts.
- Do NOT call multiple agents at the same time.
- Return final consolidated JSON with all outputs.

## OUTPUT FORMAT (JSON):
{
  "improved_Title": "[Step 1 output]",
  "permalink_slug": "[Step 1 output]",
  "improved_description": "[Step 2 output]",
  "primary_keyword": "[Step 4 output]",
  "secondaryKeywords": "",
  "keyword_strategy": "[Step 4 output]",
  "Image_Prompt": "Prompt",
  "Internal_links": ["Internal_url_1", "Internal_url_2", "Internal_url_3"],
  "External_links": ["External_url_1", "External_url_2", "External_url_3"]
}`,
  },
  seo_manager: {
    agent_name: "SEO Manager",
    description: "SEO orchestrator that runs analysis, keyword research, title, description, and linking agents",
    system_message: `You are an SEO Manager orchestrating a sequential blog analysis pipeline.

CRITICAL: You MUST execute these steps ONE AT A TIME in this EXACT order. Wait for each step to complete before starting the next.

## SEQUENTIAL EXECUTION (MANDATORY):
**STEP 1: run Competitor_Article_analysis FIRST**
**STEP 2: run keyword Research_Agent SECOND**
**STEP 3: run Title_Generator THIRD**
**STEP 4: run description_Generator FOURTH**
**STEP 5: run Internal Linking Agent FIFTH**
**STEP 6: run External Linking Agent SIXTH**

## IMPORTANT RULES:
- Call agents SEQUENTIALLY - each must complete before next starts
- Do NOT call multiple agents at the same time

## OUTPUT:
{
  "improved_Title": "[Step 1 output]",
  "permalink_slug": "[Step 1 output]",
  "optimized_meta_description": "[Step 2 output]",
  "content_gaps": "[Step 3 output]",
  "content_structure": "[Step 3 output]",
  "primary_keyword": "[Step 4 output]",
  "secondaryKeywords": "",
  "keyword_strategy": "[Step 4 output]",
  "Internal_links": "Internal_url_1,Internal_url_2,Internal_url_3",
  "External_links": "External_url_1,External_url_2,External_url_3"
}`,
  },
  competitor_analysis: {
    agent_name: "Competitor Analysis",
    description: "Analyzes competitor article for SEO strengths, weaknesses, and opportunities",
    system_message: `## ROLE
You are a world-class SEO content strategist. Your job is to Analyze the given competitor article and provide a detailed breakdown of its SEO strengths, weaknesses, and opportunities.

## STRICT RULES
- Generate ONLY ONE final output
- DO NOT repeat the analysis
- DO NOT create multiple versions
- DO NOT add explanations before or after
- STOP immediately after completing the output

## ANALYSIS CRITERIA

Evaluate the article and group insights into ONLY these 3 categories:

1. Keyword Analysis
- Identify primary keyword
- Extract 3 secondary keywords
- Evaluate keyword placement (title, headers, intro, body)
- Detect keyword strengths and missed opportunities

2. Content Structure
- Analyze logical flow and readability
- Evaluate header hierarchy (H1, H2, H3)
- Check use of formatting (lists, bullet points, bold text)
- Assess introduction hook and clarity
- Review CTA presence and effectiveness
- Evaluate overall content depth and organization

3. Content Gap
- Identify missing topics or weak coverage
- Detect opportunities to improve or expand
- Highlight unique angles used by competitor
- Extract key subtopics covered
- Identify internal linking opportunities
- Summarize competitor strengths to leverage

## OUTPUT FORMAT:
{
  "Competitortitle": "",
  "keywordAnalysis": "",
  "contentStructure": "",
  "contentGap": ""
}`,
  },
  keyword_research: {
    agent_name: "Keyword Research",
    description: "Researches and selects the best keywords using Perplexity search data",
    system_message: `## ROLE
You are a world-class SEO keyword strategist.

## TASK
Your task is to use Perplexity to Analyze the 'keywordAnalysis' from 'Competitor_Article_analysis' and generate a keyword strategy including:
- 1 primary keyword
- 2 secondary keywords
- keyword Strategy

## ANALYSIS CRITERIA
Evaluate keywords using Perplexity tool based on:
1. Search Volume - Monthly search volume and demand
2. Keyword Difficulty - Competition level (1-100)
3. Search Intent - Informational, Commercial, Transactional, Navigational
4. Relevance - How closely related to the main topic
5. User Intent Alignment - Does it match target audience needs?
6. Long-tail Potential - Specificity and conversion potential
7. Trend Direction - Growing, stable, or declining

## PRIMARY KEYWORD RULES
- Highest search volume with reasonable difficulty
- Best matches core topic intent
- Has strong commercial or informational value
- Don't make the PRIMARY KEYWORD too long

## OUTPUT FORMAT:
{
  "topic": "",
  "primaryKeyword": "",
  "secondaryKeywords": "",
  "keywordStrategy": ""
}`,
  },
  title_generator: {
    agent_name: "Title Generator",
    description: "Generates SEO-optimized title and permalink slug (max 60 chars)",
    system_message: `### ROLE
You are an expert SEO copywriter specializing in Rank Math-optimized headlines.

### TASK
Generate ONE optimized SEO title and ONE permalink slug.

### TITLE RULES (Rank Math checks ALL of these)
- MUST contain the EXACT primary keyword provided
- MUST contain a NUMBER (e.g. 5, 7, 10, 2025)
- MUST contain a POWER WORD (ultimate/essential/proven/شامل/أفضل/أقوى/حصري)
- MUST contain a SENTIMENT WORD — positive or negative (amazing/critical/مذهل/خطير/رائع/صادم)
- Title language MUST match the keyword language — NO mixing
- Max 60 characters

### SLUG RULES
- Use the primary keyword AS-IS in the slug (keep Arabic/non-Latin characters)
- Hyphen-separated, 3-6 words
- No stop words

## OUTPUT FORMAT (STRICT):
{
  "meta_title": "",
  "permalink_slug": ""
}`,
  },
  description_generator: {
    agent_name: "Description Generator",
    description: "Creates high-converting meta descriptions (max 147 chars)",
    system_message: `## ROLE
You are an expert SEO copywriter specialized in writing high-converting meta descriptions.

## TASK
Analyze the given 'competitor description' for SEO effectiveness, identify weaknesses, and rewrite it to achieve higher click-through rates and better search visibility.

## RULES
1. Always use the exact 'primaryKeyword' naturally in the Improved_Description
2. Keep length of description 147 characters
3. Make it clear, engaging, and benefit-driven
4. Improve upon the competitor (clearer value, better hook)
5. Add a soft CTA (e.g., Discover, Learn, Get, Try)
6. Avoid keyword stuffing
7. No quotes, no emojis, no clickbait
8. Make it readable and natural (human tone)

## OUTPUT FORMAT (STRICT):
{
  "Improved_Description": ""
}`,
  },
  internal_linking: {
    agent_name: "Internal Linking",
    description: "Finds 3 relevant internal links from WordPress using category-based retrieval",
    system_message: `## ROLE
You are an Internal Link Fetching Agent for a blog.

## TASK
Based on the User Message and the provided "improved_title", use the WordPress tool to:
1. Identify 3 of the most relevant categories
2. Retrieve 3 published posts inside those categories
3. OUTPUT only 1 url per category.

These links will be used by another AI agent during article writing for internal linking.

## REQUIREMENTS
- Use the WordPress tool to access categories and posts
- Work only with published posts
- Focus on category-based retrieval first, then post relevance
- Return ONLY the top 3 most relevant posts

## RULES
- Do NOT generate keywords or perform SEO analysis
- Do NOT write or modify content
- Do NOT include drafts, private posts, or irrelevant pages

## OUTPUT FORMAT:
{
  "internal_links": [
    {"Internal_url_1": "", "category": ""},
    {"Internal_url_2": "", "category": ""},
    {"Internal_url_3": "", "category": ""}
  ]
}`,
  },
  external_linking: {
    agent_name: "External Linking",
    description: "Finds 3 authoritative external links using Tavily search",
    system_message: `## ROLE
You are an External Authority Link Agent.

## TASK
Use the given "Competitor title" as a search query in Tavily and return the best 3 authoritative URLs.

## TOOLS
- Tavily search

## RULES
- Do NOT include: affiliate, promotional, or sales pages
- PRIORITIZE Trusted authority sites (Google, HubSpot, Forbes, etc.)
- Return EXACTLY the top 3 most relevant results after filtering

## EXCLUDE DOMAINS:
youtube.com, vimeo.com, dailymotion.com, twitch.tv, facebook.com, instagram.com, tiktok.com, twitter.com, x.com, linkedin.com, pinterest.com, snapchat.com, amazon.com, ebay.com, aliexpress.com, walmart.com, blogspot.com

## OUTPUT (JSON - STRICT):
{
  "External_url_1": "",
  "External_url_2": "",
  "External_url_3": ""
}`,
  },
  image_analysis: {
    agent_name: "Image Analysis",
    description: "Analyzes competitor featured image using vision model and generates an image prompt",
    system_message: `Your task is to analyze the Competitor Featured IMG in a single paragraph and turn it into a detailed image generation prompt.

## Tools:
- Vision model (Gemini or GPT-4o)

## RULES:
- Describe the visual style, colors, composition, and subject matter
- Create a prompt suitable for AI image generation. 
- CRITICAL: The prompt MUST be in English regardless of the article language.
- Keep it concise but descriptive (2-3 sentences max)
- Focus on what makes the image work for the blog topic

## OUTPUT FORMAT (STRICT):
{
  "Image_prompt": ""
}`,
  },
  article_writer: {
    agent_name: "Article Writer",
    description: "Writes the full SEO-optimized article using all gathered research data",
    system_message: `You are an expert tech journalist and content writer specializing in consumer electronics, AI, and startup culture.

## INPUT UTILIZATION RULES
- improved Title defines the editorial framing, news angle, and narrative direction
- primary Keyword defines the main SEO focus and must guide topic relevance
- keyword Strategy must guide semantic variations and topical emphasis
- content Structure is the organizational backbone - progress logically through its points
- content Gaps must be addressed naturally by adding missing explanations and context
- Internal_links and External_links must be used exactly as provided

## WRITING STYLE
- Open with a bold, specific claim or provocative statement
- Use an inverted pyramid: lead claim → context → detail → examples → implication
- Write short, scannable paragraphs (2-4 sentences max)
- Vary sentence rhythm: mix short punchy with longer analytical
- Use active voice and strong verbs
- Write like you're explaining to a smart friend, not a textbook

## SEO REQUIREMENTS
- Use primary keyword naturally in first paragraph
- Include secondary keywords throughout organically
- Use H2 and H3 headings to structure content
- Internal links: embed naturally within sentences (not "click here")
- External links: cite as supporting evidence

## OUTPUT FORMAT:
Return complete HTML article content without <html>, <head>, or <body> tags.`,
  },
};

// ── SITES ─────────────────────────────────────────────────────────────────────

router.get("/", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const sites = await db.select().from(sitesTable).where(eq(sitesTable.user_id, user.id));

  const sitesWithCount = await Promise.all(sites.map(async (site) => {
    const [row] = await db.select({ count: count() }).from(articlesTable).where(eq(articlesTable.site_id, site.id));
    return { ...site, article_count: Number(row.count) };
  }));

  return res.json({ sites: sitesWithCount });
});

router.post("/", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const { name, wp_url, wp_username, wp_password, rss_feed_url, is_active = true } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });

  const [site] = await db.insert(sitesTable).values({
    user_id: user.id,
    name,
    wp_url,
    wp_username,
    wp_password,
    rss_feed_url,
    is_active,
  }).returning();

  // Create full default agent set for the site
  for (const [key, defaults] of Object.entries(DEFAULT_PROMPTS)) {
    await db.insert(agentPromptsTable).values({
      site_id: site.id,
      agent_key: key,
      agent_name: defaults.agent_name,
      description: defaults.description,
      system_message: defaults.system_message,
      is_active: true,
    }).catch(() => {});
  }

  return res.status(201).json({ ...site, article_count: 0 });
});

router.get("/:id", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const id = parseInt(req.params.id as string);
  const [site] = await db.select().from(sitesTable).where(and(eq(sitesTable.id, id), eq(sitesTable.user_id, user.id))).limit(1);
  if (!site) return res.status(404).json({ error: "Site not found" });
  const [row] = await db.select({ count: count() }).from(articlesTable).where(eq(articlesTable.site_id, site.id));
  return res.json({ ...site, article_count: Number(row.count) });
});

router.put("/:id", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const id = parseInt(req.params.id as string);
  const [existing] = await db.select().from(sitesTable).where(and(eq(sitesTable.id, id), eq(sitesTable.user_id, user.id))).limit(1);
  if (!existing) return res.status(404).json({ error: "Site not found" });

  const { name, wp_url, wp_username, wp_password, rss_feed_url, is_active, global_instructions } = req.body;

  const [updated] = await db.update(sitesTable).set({
    name:               name               ?? existing.name,
    wp_url:             wp_url             ?? existing.wp_url,
    wp_username:        wp_username        ?? existing.wp_username,
    wp_password:        wp_password        ?? existing.wp_password,
    rss_feed_url:       rss_feed_url       ?? existing.rss_feed_url,
    is_active:          is_active          ?? existing.is_active,
    global_instructions: global_instructions !== undefined ? global_instructions : existing.global_instructions,
    updated_at: new Date(),
  }).where(eq(sitesTable.id, id)).returning();

  return res.json(updated);
});

router.delete("/:id", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const id = parseInt(req.params.id as string);
  const [existing] = await db.select().from(sitesTable).where(and(eq(sitesTable.id, id), eq(sitesTable.user_id, user.id))).limit(1);
  if (!existing) return res.status(404).json({ error: "Site not found" });
  await db.delete(sitesTable).where(eq(sitesTable.id, id));
  return res.json({ success: true });
});

// ── AGENT PROMPTS ─────────────────────────────────────────────────────────────

router.get("/:id/agents", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const id = parseInt(req.params.id as string);
  const [site] = await db.select().from(sitesTable).where(and(eq(sitesTable.id, id), eq(sitesTable.user_id, user.id))).limit(1);
  if (!site) return res.status(404).json({ error: "Site not found" });

  let prompts = await db.select().from(agentPromptsTable).where(eq(agentPromptsTable.site_id, id));

  // Auto-seed any missing agents
  const existingKeys = new Set(prompts.map(p => p.agent_key));
  for (const [key, defaults] of Object.entries(DEFAULT_PROMPTS)) {
    if (!existingKeys.has(key)) {
      await db.insert(agentPromptsTable).values({
        site_id: id,
        agent_key: key,
        agent_name: defaults.agent_name,
        description: defaults.description,
        system_message: defaults.system_message,
        is_active: true,
      }).catch(() => {});
    }
  }

  // Re-fetch after seeding
  prompts = await db.select().from(agentPromptsTable).where(eq(agentPromptsTable.site_id, id));

  return res.json({ prompts });
});

router.put("/:id/agents/:agentKey", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const id = parseInt(req.params.id as string);
  const agentKey = req.params.agentKey;
  const { system_message, is_active } = req.body as { system_message?: string; is_active?: boolean };

  const [site] = await db.select().from(sitesTable).where(and(eq(sitesTable.id, id), eq(sitesTable.user_id, user.id))).limit(1);
  if (!site) return res.status(404).json({ error: "Site not found" });

  const existing = await db.select().from(agentPromptsTable).where(eq(agentPromptsTable.site_id, id));
  const prompt = existing.find(p => p.agent_key === agentKey);

  if (!prompt) {
    const defaults = DEFAULT_PROMPTS[agentKey];
    const [created] = await db.insert(agentPromptsTable).values({
      site_id: id,
      agent_key: agentKey,
      agent_name: defaults?.agent_name ?? agentKey,
      description: defaults?.description ?? "",
      system_message: system_message ?? defaults?.system_message ?? "",
      is_active: is_active ?? true,
    }).returning();
    return res.json(created);
  }

  const [updated] = await db.update(agentPromptsTable).set({
    ...(system_message !== undefined ? { system_message } : {}),
    ...(is_active !== undefined ? { is_active } : {}),
    updated_at: new Date(),
  }).where(eq(agentPromptsTable.id, prompt.id)).returning();

  return res.json(updated);
});

router.post("/:id/agents/reset/:agentKey", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const id = parseInt(req.params.id as string);
  const agentKey = req.params.agentKey;
  const defaults = DEFAULT_PROMPTS[agentKey];

  if (!defaults) return res.status(404).json({ error: "Agent not found" });

  const [site] = await db.select().from(sitesTable).where(and(eq(sitesTable.id, id), eq(sitesTable.user_id, user.id))).limit(1);
  if (!site) return res.status(404).json({ error: "Site not found" });

  const existing = await db.select().from(agentPromptsTable).where(eq(agentPromptsTable.site_id, id));
  const prompt = existing.find(p => p.agent_key === agentKey);

  if (!prompt) {
    const [created] = await db.insert(agentPromptsTable).values({
      site_id: id,
      agent_key: agentKey,
      agent_name: defaults.agent_name,
      description: defaults.description,
      system_message: defaults.system_message,
      is_active: true,
    }).returning();
    return res.json(created);
  }

  const [updated] = await db.update(agentPromptsTable).set({
    system_message: defaults.system_message,
    updated_at: new Date(),
  }).where(eq(agentPromptsTable.id, prompt.id)).returning();

  return res.json(updated);
});

router.post("/:id/agents/reset-all", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const id = parseInt(req.params.id as string);

  const [site] = await db.select().from(sitesTable).where(and(eq(sitesTable.id, id), eq(sitesTable.user_id, user.id))).limit(1);
  if (!site) return res.status(404).json({ error: "Site not found" });

  const existing = await db.select().from(agentPromptsTable).where(eq(agentPromptsTable.site_id, id));
  const results = [];

  for (const [key, defaults] of Object.entries(DEFAULT_PROMPTS)) {
    const prompt = existing.find(p => p.agent_key === key);
    if (!prompt) {
      const [created] = await db.insert(agentPromptsTable).values({
        site_id: id,
        agent_key: key,
        agent_name: defaults.agent_name,
        description: defaults.description,
        system_message: defaults.system_message,
        is_active: true,
      }).returning();
      results.push(created);
    } else {
      const [updated] = await db.update(agentPromptsTable).set({
        system_message: defaults.system_message,
        is_active: true,
        updated_at: new Date(),
      }).where(eq(agentPromptsTable.id, prompt.id)).returning();
      results.push(updated);
    }
  }

  return res.json(results);
});

// ── RSS FEEDS ─────────────────────────────────────────────────────────────────

router.get("/:id/rss-feeds", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const siteId = parseInt(req.params.id);
  const [site] = await db.select().from(sitesTable).where(and(eq(sitesTable.id, siteId), eq(sitesTable.user_id, user.id))).limit(1);
  if (!site) return res.status(404).json({ error: "Site not found" });

  const feeds = await db.select().from(rssFeedsTable)
    .where(and(eq(rssFeedsTable.site_id, siteId), eq(rssFeedsTable.user_id, user.id)));
  return res.json({ feeds: feeds.map(feedToSnake) });
});

router.post("/:id/rss-feeds", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const siteId = parseInt(req.params.id);
  const [site] = await db.select().from(sitesTable).where(and(eq(sitesTable.id, siteId), eq(sitesTable.user_id, user.id))).limit(1);
  if (!site) return res.status(404).json({ error: "Site not found" });

  const { rss_url, label, wp_category_id, wp_category_name, poll_hours, poll_minutes, max_articles } = req.body as {
    rss_url: string; label?: string; wp_category_id?: number; wp_category_name?: string;
    poll_hours?: number; poll_minutes?: number; max_articles?: number;
  };
  if (!rss_url) return res.status(400).json({ error: "rss_url is required" });

  const [feed] = await db.insert(rssFeedsTable).values({
    user_id: user.id,
    site_id: siteId,
    rss_url: rss_url,
    label: label ?? null,
    wp_category_id: wp_category_id ?? null,
    wp_category_name: wp_category_name ?? null,
    poll_hours: poll_hours ?? 4,
    poll_minutes: poll_minutes ?? 0,
    max_articles: max_articles ?? 0,
    is_active: true,
  }).returning();

  return res.status(201).json(feedToSnake(feed));
});

// ── RANK MATH BULK ────────────────────────────────────────────────────────────

router.post("/:id/rank-math/bulk", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const siteId = parseInt(req.params.id);
  const [site] = await db.select().from(sitesTable).where(and(eq(sitesTable.id, siteId), eq(sitesTable.user_id, user.id))).limit(1);
  if (!site) return res.status(404).json({ error: "Site not found" });

  if (!site.wp_url || !site.wp_username || !site.wp_password) {
    return res.status(400).json({ error: "WordPress credentials not configured for this site" });
  }

  // Get all published articles with wp_post_id and primary_keyword
  const articles = await db.select({
    id: articlesTable.id,
    wp_post_id: articlesTable.wp_post_id,
    primary_keyword: articlesTable.primary_keyword,
    meta_description: articlesTable.meta_description,
  }).from(articlesTable).where(
    and(
      eq(articlesTable.site_id, siteId),
      eq(articlesTable.article_status, "published"),
      isNotNull(articlesTable.wp_post_id),
      isNotNull(articlesTable.primary_keyword),
    )
  );

  if (articles.length === 0) {
    return res.json({ queued: 0, message: "No published articles with keywords found" });
  }

  const base = site.wp_url.replace(/\/$/, "");
  const credentials = Buffer.from(`${site.wp_username}:${site.wp_password}`).toString("base64");

  let queued = 0;
  let failed = 0;

  for (const article of articles) {
    try {
      const wpRes = await fetch(`${base}/wp-json/wp/v2/posts/${article.wp_post_id}`, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          meta: {
            rank_math_focus_keyword: article.primary_keyword,
            ...(article.meta_description ? { rank_math_description: article.meta_description } : {}),
          },
        }),
      });
      if (wpRes.ok) queued++;
      else failed++;
    } catch {
      failed++;
    }
  }

  return res.json({ queued, failed, message: `${queued} articles updated, ${failed} failed` });
});

// ── WP CATEGORIES ─────────────────────────────────────────────────────────────

router.get("/:id/wp-categories", requireAuth, async (req, res) => {
  const user = (req as any).user as typeof usersTable.$inferSelect;
  const siteId = parseInt(req.params.id);
  const [site] = await db.select().from(sitesTable).where(and(eq(sitesTable.id, siteId), eq(sitesTable.user_id, user.id))).limit(1);
  if (!site) return res.status(404).json({ error: "Site not found" });

  if (!site.wp_url || !site.wp_username || !site.wp_password) {
    return res.status(400).json({ error: "WordPress credentials not configured for this site" });
  }

  try {
    const base = site.wp_url.replace(/\/$/, "");
    const credentials = Buffer.from(`${site.wp_username}:${site.wp_password}`).toString("base64");
    const wpRes = await fetch(`${base}/wp-json/wp/v2/categories?per_page=100&_fields=id,name,slug,count,parent`, {
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Accept": "application/json",
      },
    });

    if (!wpRes.ok) {
      const text = await wpRes.text().catch(() => "");
      return res.status(wpRes.status).json({ error: `WordPress returned ${wpRes.status}: ${text.slice(0, 200)}` });
    }

    const categories = await wpRes.json() as Array<{ id: number; name: string; slug: string; count: number; parent: number }>;
    return res.json({ categories });
  } catch (err: any) {
    console.error("[WP-CATEGORIES] fetch error:", err?.message);
    return res.status(500).json({ error: err?.message ?? "Failed to fetch WordPress categories" });
  }
});

export default router;
