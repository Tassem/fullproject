import { db, systemSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const CACHE_TTL = 30_000; // 30 seconds
let settingsCache: { data: Record<string, string>; ts: number } | null = null;

export async function getAllSettings(): Promise<Record<string, string>> {
  if (settingsCache && Date.now() - settingsCache.ts < CACHE_TTL) {
    return settingsCache.data;
  }

  const rows = await db.select().from(systemSettingsTable);
  const data: Record<string, string> = {};
  for (const row of rows) {
    data[row.key] = row.value ?? "";
  }

  settingsCache = { data, ts: Date.now() };
  return data;
}

export async function getSetting(key: string, defaultValue = ""): Promise<string> {
  const settings = await getAllSettings();
  return settings[key] ?? defaultValue;
}

export async function getSettingNumber(key: string, defaultValue = 0): Promise<number> {
  const val = await getSetting(key);
  const n = parseFloat(val);
  return isNaN(n) ? defaultValue : n;
}

export function invalidateSettingsCache() {
  settingsCache = null;
}
