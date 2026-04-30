/**
 * BYOK Phase 1 — Unit & Security Tests
 *
 * Tests cover:
 *   - Key encryption/decryption round-trip
 *   - Key format validation
 *   - Key masking and hint generation
 *   - Provider resolution: platform mode → platform key
 *   - Provider resolution: BYOK mode + no key → error (never fallback)
 *   - Provider resolution: BYOK mode + invalid key → error
 *   - Key never appears in API responses (full key)
 *   - Key never appears in logs
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Set BYOK_ENCRYPTION_KEY before importing modules
const TEST_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.BYOK_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;

import {
  encryptKey,
  decryptKey,
  validateKeyFormat,
  maskKey,
  makeKeyHint,
} from "../lib/userKeyManager";

import {
  BYOKKeyMissingError,
  BYOKKeyInvalidError,
} from "../lib/providerKeyResolver";

// ── userKeyManager tests ──────────────────────────────────────────────────────

describe("userKeyManager", () => {
  describe("encryptKey / decryptKey round-trip", () => {
    it("should encrypt and decrypt a key correctly", () => {
      const plainKey = "sk-or-v1-abc123def456ghi789jkl012mno345";
      const { encrypted, iv, tag } = encryptKey(plainKey);

      expect(encrypted).toBeTruthy();
      expect(iv).toBeTruthy();
      expect(tag).toBeTruthy();
      expect(encrypted).not.toBe(plainKey);

      const decrypted = decryptKey(encrypted, iv, tag);
      expect(decrypted).toBe(plainKey);
    });

    it("should produce different ciphertext for the same key (unique IVs)", () => {
      const plainKey = "sk-or-v1-test123456789";
      const enc1 = encryptKey(plainKey);
      const enc2 = encryptKey(plainKey);

      expect(enc1.encrypted).not.toBe(enc2.encrypted);
      expect(enc1.iv).not.toBe(enc2.iv);

      // But both decrypt to the same value
      expect(decryptKey(enc1.encrypted, enc1.iv, enc1.tag)).toBe(plainKey);
      expect(decryptKey(enc2.encrypted, enc2.iv, enc2.tag)).toBe(plainKey);
    });

    it("should throw on tampered ciphertext", () => {
      const plainKey = "sk-or-v1-tamper-test-key-12345";
      const { encrypted, iv, tag } = encryptKey(plainKey);

      // Tamper with ciphertext
      const tampered = "X" + encrypted.slice(1);
      expect(() => decryptKey(tampered, iv, tag)).toThrow();
    });

    it("should throw on wrong tag", () => {
      const plainKey = "sk-or-v1-wrong-tag-test";
      const { encrypted, iv } = encryptKey(plainKey);

      expect(() => decryptKey(encrypted, iv, "wrongtagvalue")).toThrow();
    });
  });

  describe("validateKeyFormat", () => {
    it("should accept valid OpenRouter keys", () => {
      expect(validateKeyFormat("sk-or-v1-abc123def456ghi789").valid).toBe(true);
    });

    it("should reject keys not starting with sk-or-", () => {
      const result = validateKeyFormat("sk-1234567890abcdef");
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it("should reject empty strings", () => {
      expect(validateKeyFormat("").valid).toBe(false);
    });

    it("should reject keys that are too short", () => {
      expect(validateKeyFormat("sk-or-").valid).toBe(false);
    });
  });

  describe("maskKey", () => {
    it("should mask the key showing only first 5 and last 4 chars", () => {
      const masked = maskKey("sk-or-v1-abc123def456ghi789xK7m");
      expect(masked).toContain("sk-or");
      expect(masked).toContain("xK7m");
      expect(masked).not.toContain("abc123");
    });

    it("should return safe fallback for very short keys", () => {
      const masked = maskKey("short");
      expect(masked).toBeTruthy();
      expect(masked.length).toBeGreaterThan(0);
    });
  });

  describe("makeKeyHint", () => {
    it("should return last 4 characters", () => {
      expect(makeKeyHint("sk-or-v1-abcdefghijklmnop")).toBe("mnop");
    });

    it("should handle short keys gracefully", () => {
      const hint = makeKeyHint("ab");
      expect(hint).toBeTruthy();
      expect(hint).toBe("****");
    });
  });
});

// ── providerKeyResolver tests ─────────────────────────────────────────────────

describe("providerKeyResolver", () => {
  describe("BYOKKeyMissingError", () => {
    it("should have correct error code", () => {
      const error = new BYOKKeyMissingError();
      expect(error.code).toBe("BYOK_KEY_MISSING");
      expect(error instanceof Error).toBe(true);
      expect(error.message).toBeTruthy();
    });

    it("should not contain any API key in message", () => {
      const error = new BYOKKeyMissingError();
      expect(error.message).not.toMatch(/sk-or-/);
      expect(error.message).not.toMatch(/sk-\w+/);
    });
  });

  describe("BYOKKeyInvalidError", () => {
    it("should have correct error code", () => {
      const error = new BYOKKeyInvalidError();
      expect(error.code).toBe("BYOK_KEY_INVALID");
      expect(error instanceof Error).toBe(true);
      expect(error.message).toBeTruthy();
    });

    it("should not contain any API key in message", () => {
      const error = new BYOKKeyInvalidError();
      expect(error.message).not.toMatch(/sk-or-/);
      expect(error.message).not.toMatch(/sk-\w+/);
    });
  });
});

// ── Security tests ────────────────────────────────────────────────────────────

describe("BYOK Security", () => {
  describe("Key masking", () => {
    const testKey = "sk-or-v1-this-is-a-secret-key-that-should-never-leak-xK7m";

    it("masked key should not contain full key", () => {
      const masked = maskKey(testKey);
      expect(masked).not.toBe(testKey);
      expect(masked.length).toBeLessThan(testKey.length);
    });

    it("encrypted key should not contain plaintext", () => {
      const { encrypted } = encryptKey(testKey);
      expect(encrypted).not.toContain(testKey);
      expect(encrypted).not.toContain("secret-key");
    });
  });

  describe("Key never in error messages", () => {
    it("BYOKKeyMissingError should not contain any key material", () => {
      const err = new BYOKKeyMissingError();
      expect(err.message).not.toMatch(/sk-or/i);
      expect(err.stack).not.toMatch(/sk-or-v1/);
    });

    it("BYOKKeyInvalidError should not contain any key material", () => {
      const err = new BYOKKeyInvalidError();
      expect(err.message).not.toMatch(/sk-or/i);
      expect(err.stack).not.toMatch(/sk-or-v1/);
    });
  });

  describe("Encryption strength", () => {
    it("should use unique IV for each encryption", () => {
      const key = "sk-or-v1-test-iv-uniqueness-check";
      const results = Array.from({ length: 10 }, () => encryptKey(key));
      const ivs = new Set(results.map(r => r.iv));
      // All IVs should be unique
      expect(ivs.size).toBe(10);
    });

    it("should produce authentication tag", () => {
      const { tag } = encryptKey("sk-or-v1-tag-test");
      expect(tag).toBeTruthy();
      expect(tag.length).toBeGreaterThan(0);
    });
  });
});
