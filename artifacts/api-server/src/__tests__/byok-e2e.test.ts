import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveProviderKey, BYOKKeyMissingError } from "../lib/providerKeyResolver";
import { encryptKey } from "../lib/userKeyManager";

// Mock the database
vi.mock("@workspace/db", () => {
  return {
    db: {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    userProviderKeysTable: { id: "id", userId: "userId", provider: "provider", encryptedKey: "encryptedKey", keyIv: "keyIv", keyTag: "keyTag", isValid: "isValid" },
    plansTable: { id: "id", plan_mode: "plan_mode", slug: "slug" },
    usersTable: { id: "id", plan: "plan" },
    subscriptionsTable: { id: "id", userId: "userId" },
    creditTransactionsTable: { id: "id" },
  };
});

import { db } from "@workspace/db";

describe("BYOK End-to-End Journey", () => {
  const userId = 123;
  const platformKey = "sk-or-v1-platform-key";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BYOK_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  describe("Suite 1: Full BYOK user journey", () => {
    it("should follow the journey from missing key to successful AI call", async () => {
      // 1. User tries AI action on BYOK plan -> fails BYOK_KEY_MISSING
      // Mock db.select for getUserPlanMode and resolveProviderKey
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // No key found
          }),
        }),
      });

      await expect(resolveProviderKey(userId, "openrouter", platformKey, "byok"))
        .rejects.toThrow(BYOKKeyMissingError);

      // 2. User adds valid key -> encryption and storage
      const plainKey = "sk-or-v1-valid-key-123456789";
      const encrypted = encryptKey(plainKey);
      
      // Mock successful storage (insert or update)
      (db.insert as any).mockReturnValue({ values: vi.fn().mockResolvedValue({ rowCount: 1 }) });

      // 3. User tries AI action -> succeeds with user key
      // Mock db.select to return the stored key
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              encryptedKey: encrypted.encrypted,
              keyIv: encrypted.iv,
              keyTag: encrypted.tag,
              isValid: true,
            }]),
          }),
        }),
      });

      const resolved = await resolveProviderKey(userId, "openrouter", platformKey, "byok");
      expect(resolved.key).toBe(plainKey);
      expect(resolved.source).toBe("user_byok");
    });
  });

  describe("Suite 2: Standard plan user unaffected", () => {
    it("should use platform key for standard users", async () => {
      const resolved = await resolveProviderKey(userId, "openrouter", platformKey, "platform");
      expect(resolved.key).toBe(platformKey);
      expect(resolved.source).toBe("platform");
      // Verify DB was NOT queried for keys
      expect(db.select).not.toHaveBeenCalled();
    });
  });

  describe("Suite 3: Plan switching", () => {
    it("should respect plan mode after switching", async () => {
      // Switch to platform -> uses platform key
      let resolved = await resolveProviderKey(userId, "openrouter", platformKey, "platform");
      expect(resolved.source).toBe("platform");

      // Switch to BYOK -> requires key
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      await expect(resolveProviderKey(userId, "openrouter", platformKey, "byok"))
        .rejects.toThrow(BYOKKeyMissingError);
    });
  });
});
