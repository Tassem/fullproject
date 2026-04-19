// @ts-nocheck
import { XMLParser } from "fast-xml-parser";

export interface RssItem {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
  imageUrl?: string;
}

interface RawItem {
  title?: string | { "#text"?: string };
  link?: string | { "#text"?: string } | { "@_href"?: string };
  description?: string | { "#text"?: string };
  pubDate?: string;
  "media:content"?: { "@_url"?: string } | Array<{ "@_url"?: string }>;
  enclosure?: { "@_url"?: string };
  "media:thumbnail"?: { "@_url"?: string };
}

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null) {
    const o = v as Record<string, unknown>;
    return String(o["#text"] ?? o["@_href"] ?? "");
  }
  return "";
}

export async function fetchRssFeed(feedUrl: string): Promise<RssItem[]> {
  const res = await fetch(feedUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; BlogBot/1.0)",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) throw new Error(`RSS fetch failed: HTTP ${res.status} for ${feedUrl}`);
  const xml = await res.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    allowBooleanAttributes: true,
  });

  const parsed = parser.parse(xml) as Record<string, unknown>;

  let rawItems: RawItem[] = [];

  // RSS 2.0
  const channel = (parsed?.rss as Record<string, unknown>)?.channel as Record<string, unknown>;
  if (channel?.item) {
    rawItems = Array.isArray(channel.item) ? channel.item as RawItem[] : [channel.item as RawItem];
  }

  // Atom
  const feed = parsed?.feed as Record<string, unknown>;
  if (feed?.entry) {
    rawItems = Array.isArray(feed.entry) ? feed.entry as RawItem[] : [feed.entry as RawItem];
  }

  return rawItems
    .map((item) => {
      const title = str(item.title);
      const link = str(item.link);
      const description = str(item.description);

      const mediaContent = item["media:content"];
      const mediaArr = Array.isArray(mediaContent) ? mediaContent : mediaContent ? [mediaContent] : [];
      const imageUrl =
        mediaArr[0]?.["@_url"] ??
        item.enclosure?.["@_url"] ??
        item["media:thumbnail"]?.["@_url"] ??
        undefined;

      return { title, link, description: description || undefined, imageUrl };
    })
    .filter((i) => i.title && i.link);
}
