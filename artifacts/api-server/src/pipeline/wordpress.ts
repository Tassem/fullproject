// @ts-nocheck
import sharp from "sharp";

export interface WPPost {
  id: number;
  title: { rendered: string };
  link: string;
  slug: string;
}

export interface WPMedia {
  id: number;
  source_url: string;
}

export interface WPCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
  parent: number;
}

const COMMON_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json",
};

function authHeader(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

function getBasePatterns(wpUrl: string) {
  const base = wpUrl.replace(/\/+$/, "");
  return [
    `${base}/wp-json/wp/v2`,
    `${base}/index.php?rest_route=/wp/v2`,
    `${base}/?rest_route=/wp/v2`,
  ];
}

async function fetchWP(
  wpUrl: string,
  username: string,
  password: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const patterns = getBasePatterns(wpUrl);
  const auth = authHeader(username, password);
  let lastResponse: Response | null = null;

  for (const base of patterns) {
    let url: string;
    
    // Normalize endpoint (ensure it starts with /)
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    
    if (base.includes("rest_route=")) {
      // Split endpoint into path and query
      const [path, query] = cleanEndpoint.split("?");
      // Ensure base doesn't end with slash if path starts with one, or vice versa
      const safeBase = base.endsWith("/") ? base.slice(0, -1) : base;
      url = `${safeBase}${path}${query ? "&" + query : ""}`;
    } else {
      const safeBase = base.endsWith("/") ? base.slice(0, -1) : base;
      url = `${safeBase}${cleanEndpoint}`;
    }

    console.log(`[WP] Fetching: ${url}`);

    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          ...COMMON_HEADERS,
          Authorization: auth,
          ...(options.headers || {}),
        },
        signal: AbortSignal.timeout(options.method === "POST" ? 60000 : 20000),
      });

      // Special case: if we get the API root instead of the expected data, we should try next pattern
      // but only if it's a 200 OK without being the expected JSON array (for categories)
      if (res.ok) {
        return res;
      }
      lastResponse = res;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw err;
      console.warn(`[WP] Failed pattern ${url}:`, err);
    }
  }

  return lastResponse || new Response(null, { status: 404, statusText: "Not Found" });
}



async function downloadAsJpeg(imageUrl: string): Promise<Buffer> {
  let inputBuffer: Buffer;
  if (imageUrl.startsWith("data:")) {
    const base64Data = imageUrl.split(",")[1];
    if (!base64Data) throw new Error("Invalid data URL");
    inputBuffer = Buffer.from(base64Data, "base64");
  } else {
    const res = await fetch(imageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`Could not download image: ${res.status}`);
    inputBuffer = Buffer.from(await res.arrayBuffer());
  }
  return sharp(inputBuffer)
    .resize({ width: 1920, withoutEnlargement: true })
    .jpeg({ quality: 85, progressive: true })
    .toBuffer();
}

export async function wpGetCategories(wpUrl: string, username: string, password: string): Promise<WPCategory[]> {
  const res = await fetchWP(wpUrl, username, password, "/categories?per_page=100&_fields=id,name,slug,count,parent");
  const bodyText = await res.text();
  
  if (!res.ok) {
    throw new Error(`WP get categories failed (${res.status}): ${bodyText.slice(0, 150)}`);
  }
  
  let data;
  try {
    data = JSON.parse(bodyText);
  } catch (err) {
    throw new Error(`WordPress returned invalid JSON: ${bodyText.slice(0, 150)}`);
  }

  if (!Array.isArray(data)) {
    console.error("WP Category Error Response:", data);
    const wpMsg = data?.message || JSON.stringify(data);
    throw new Error(`WordPress Error: ${wpMsg}`);
  }
  return data as WPCategory[];
}



export async function wpGetPosts(wpUrl: string, username: string, password: string, perPage = 50): Promise<WPPost[]> {
  const res = await fetchWP(wpUrl, username, password, `/posts?per_page=${perPage}&status=publish,draft&_fields=id,title,link,slug`);
  if (!res.ok) throw new Error(`WP get posts failed: ${res.status}`);
  return (await res.json()) as WPPost[];
}

export async function wpUploadImage(wpUrl: string, username: string, password: string, imageUrl: string, filename: string, altText?: string): Promise<WPMedia> {
  const jpegBuffer = await downloadAsJpeg(imageUrl);
  const safeBaseName = filename.replace(/\.[^.]+$/, "").replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, "-").replace(/^-|-$/g, "");
  const jpegFilename = (safeBaseName || `image-${Date.now()}`) + ".jpg";

  const uploadRes = await fetchWP(wpUrl, username, password, "/media", {
    method: "POST",
    headers: { "Content-Type": "image/jpeg", "Content-Disposition": `attachment; filename="${jpegFilename}"` },
    body: jpegBuffer,
  });

  if (!uploadRes.ok) throw new Error(`WP media upload failed: ${uploadRes.status}`);
  const media = (await uploadRes.json()) as WPMedia;

  if (altText) {
    await fetchWP(wpUrl, username, password, `/media/${media.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alt_text: altText, caption: altText, title: altText }),
    }).catch(() => {});
  }
  return media;
}

export interface WPCreatePostParams {
  title: string;
  content: string;
  slug: string;
  status: "publish" | "draft";
  featured_media?: number;
  meta?: Record<string, string>;
  categories?: number[];
  tags?: number[];
}

export interface WPCreatedPost {
  id: number;
  link: string;
}

export async function wpCreatePost(wpUrl: string, username: string, password: string, params: WPCreatePostParams): Promise<WPCreatedPost> {
  const wrappedContent = `<!-- wp:html -->\n${params.content}\n<!-- /wp:html -->`;
  const res = await fetchWP(wpUrl, username, password, "/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...params, content: wrappedContent }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message ?? `WP create post failed: ${res.status}`);
  }
  return (await res.json()) as WPCreatedPost;
}

export async function wpUpdateRankMath(
  wpUrl: string,
  username: string,
  password: string,
  postId: number,
  metaTitle: string,
  metaDescription: string,
  primaryKeyword: string,
  secondaryKeywords?: string,
  ogImageUrl?: string,
  locale?: string
): Promise<{ success: boolean; error?: string }> {
  const cleanKw = (raw: string): string => {
    let kw = raw.trim().replace(/\s*\([^)]*\)/g, "").replace(/[|:;,!?@#$%^&*'"'"]/g, " ").replace(/&#?\w+;/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
    return kw.split(" ").filter(Boolean).slice(0, 3).join(" ");
  };

  const allKeywords = [primaryKeyword, ...(secondaryKeywords ? secondaryKeywords.split(",").slice(0, 4) : [])].map(cleanKw).filter(Boolean).join(",");

  const meta: Record<string, string | number> = {
    rank_math_title: metaTitle,
    rank_math_description: metaDescription,
    rank_math_focus_keyword: allKeywords,
    rank_math_og_title: metaTitle,
    rank_math_og_description: metaDescription,
    rank_math_og_locale: locale || "en_US",
    rank_math_og_type: "article",
    rank_math_twitter_title: metaTitle,
    rank_math_twitter_description: metaDescription,
    rank_math_twitter_card_type: "summary_large_image",
    rank_math_pillar_content: "off",
    rank_math_robots: "index,follow",
  };

  if (ogImageUrl) {
    meta["rank_math_og_image"] = ogImageUrl;
    meta["rank_math_og_image_url"] = ogImageUrl;
    meta["rank_math_twitter_image"] = ogImageUrl;
  }

  const res = await fetchWP(wpUrl, username, password, `/posts/${postId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ meta }),
  });

  if (!res.ok) {
    const resBody = await res.json().catch(() => ({}));
    return { success: false, error: resBody?.message ?? `HTTP ${res.status}` };
  }
  return { success: true };
}
