import { describe, it, expect, vi, beforeEach } from "vitest";
import { encryptKey, decryptKey, maskKey, redactText } from "../lib/userKeyManager";
import { resolveProviderKey, BYOKKeyMissingError } from "../lib/providerKeyResolver";

// Mock the database
vi.mock("@workspace/db", () => {
  return {
    db: {
      select: vi.fn(),
      delete: vi.fn(),
    },
    userProviderKeysTable: { id: "id", userId: "userId", provider: "provider", encryptedKey: "encryptedKey", keyIv: "keyIv", keyTag: "keyTag", isValid: "isValid" },
    plansTable: { id: "id", plan_mode: "plan_mode", slug: "slug" },
    usersTable: { id: "id", plan: "plan" },
  };
});

import { db } from "@workspace/db";

describe("BYOK Security & Isolation", () => {
  const userId = 1;
  const otherUserId = 2;
  const platformKey = "sk-or-v1-platform";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BYOK_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  it("should encrypt keys in the database (rest at rest)", () => {
    const plainKey = "sk-or-v1-secret-key-123";
    const encrypted = encryptKey(plainKey);
    
    expect(encrypted.encrypted).not.toBe(plainKey);
    expect(encrypted.encrypted).not.toContain("secret-key");
    
    const decrypted = decryptKey(encrypted.encrypted, encrypted.iv, encrypted.tag);
    expect(decrypted).toBe(plainKey);
  });

  it("should enforce strict no-fallback to platform key", async () => {
    // Mock user on BYOK plan but no key in DB
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]), // No key found
        }),
      }),
    });

    // Should throw missing error, NOT return platform key
    await expect(resolveProviderKey(userId, "openrouter", platformKey, "byok"))
      .rejects.toThrow(BYOKKeyMissingError);
  });

  it("should ensure IV uniqueness on updates", () => {
    const key = "sk-or-v1-test-key";
    const enc1 = encryptKey(key);
    const enc2 = encryptKey(key);
    
    expect(enc1.iv).not.toBe(enc2.iv);
    expect(enc1.encrypted).not.toBe(enc2.encrypted);
  });

  it("should not contain sensitive key material in error messages", () => {
    const sensitiveKey = "sk-or-v1-very-secret-key";
    try {
      throw new Error(`Failed to validate key ${sensitiveKey}`);
    } catch (err: any) {
      const redacted = redactText(err.message);
      expect(redacted).not.toContain(sensitiveKey);
      expect(redacted).toContain("sk-****");
    }
  });
});
