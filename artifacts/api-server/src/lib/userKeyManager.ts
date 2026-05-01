/**
 * User API Key Manager — encrypt, decrypt, validate, and mask user-provided API keys.
 *
 * Uses AES-256-GCM authenticated encryption.
 * Encryption key sourced from BYOK_ENCRYPTION_KEY environment variable.
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const hex = process.env.BYOK_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error("BYOK_ENCRYPTION_KEY environment variable is not set. Cannot encrypt/decrypt user keys.");
  }
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) {
    throw new Error("BYOK_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).");
  }
  return buf;
}

export interface EncryptedKeyData {
  encrypted: string; // base64
  iv: string;        // base64
  tag: string;       // base64
}

export function encryptKey(plainKey: string): EncryptedKeyData {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainKey, "utf8", "base64");
  encrypted += cipher.final("base64");
  const tag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptKey(encrypted: string, iv: string, tag: string): string {
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));

  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function validateKeyFormat(apiKey: string): { valid: boolean; error?: string } {
  if (!apiKey || typeof apiKey !== "string") {
    return { valid: false, error: "API key is required." };
  }
  const trimmed = apiKey.trim();
  if (!trimmed.startsWith("sk-or-")) {
    return { valid: false, error: "Invalid OpenRouter key format. Key must start with 'sk-or-'." };
  }
  if (trimmed.length < 20) {
    return { valid: false, error: "API key is too short." };
  }
  return { valid: true };
}

export async function testKeyWithProvider(apiKey: string, provider: string = "openrouter"): Promise<{ valid: boolean; error?: string }> {
  if (provider !== "openrouter") {
    return { valid: false, error: `Provider '${provider}' is not supported for BYOK in v1.` };
  }

  try {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://mediaflow.app",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: "Say OK" }],
        max_tokens: 2,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (resp.ok) {
      return { valid: true };
    }

    if (resp.status === 401 || resp.status === 403) {
      return { valid: false, error: "API key is invalid or has been revoked." };
    }

    // 429 or other errors mean the key itself is valid but may be rate-limited
    if (resp.status === 429) {
      return { valid: true };
    }

    const body = await resp.text().catch(() => "");
    return { valid: false, error: `OpenRouter returned HTTP ${resp.status}. Please verify your key.` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("timeout") || msg.includes("abort")) {
      return { valid: false, error: "Validation timed out. Please try again." };
    }
    return { valid: false, error: "Could not reach OpenRouter to validate the key." };
  }
}

export function maskKey(plainKey: string): string {
  if (!plainKey || plainKey.length < 8) return "****";
  const prefix = plainKey.slice(0, 5);
  const suffix = plainKey.slice(-4);
  return `${prefix}...${suffix}`;
}

export function makeKeyHint(plainKey: string): string {
  if (!plainKey || plainKey.length < 4) return "****";
  return plainKey.slice(-4);
}
