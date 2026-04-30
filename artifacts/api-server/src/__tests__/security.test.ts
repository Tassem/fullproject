import { describe, it, expect } from "vitest";

// Password validation regex (same as in auth.ts)
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-={}|;':",./<>?]).{8,}$/;
function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters";
  if (!PASSWORD_REGEX.test(pw)) return "Password must include uppercase, lowercase, number, and special character";
  return null;
}

// HTML escape (same as in email.ts)
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

describe("Password Validation", () => {
  it("should reject passwords shorter than 8 chars", () => {
    expect(validatePassword("Ab1!")).not.toBeNull();
  });

  it("should reject passwords without uppercase", () => {
    expect(validatePassword("abcdefg1!")).not.toBeNull();
  });

  it("should reject passwords without lowercase", () => {
    expect(validatePassword("ABCDEFG1!")).not.toBeNull();
  });

  it("should reject passwords without digit", () => {
    expect(validatePassword("Abcdefgh!")).not.toBeNull();
  });

  it("should reject passwords without special char", () => {
    expect(validatePassword("Abcdefg1")).not.toBeNull();
  });

  it("should accept a valid complex password", () => {
    expect(validatePassword("Admin123!")).toBeNull();
  });

  it("should accept a long complex password", () => {
    expect(validatePassword("MyP@ssw0rd!!Long")).toBeNull();
  });
});

describe("HTML Escape (XSS Prevention)", () => {
  it("should escape angle brackets", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("should escape ampersand", () => {
    expect(escapeHtml("A & B")).toBe("A &amp; B");
  });

  it("should escape quotes", () => {
    expect(escapeHtml('He said "hello"')).toBe("He said &quot;hello&quot;");
  });

  it("should escape single quotes", () => {
    expect(escapeHtml("it's")).toBe("it&#039;s");
  });

  it("should leave safe text unchanged", () => {
    expect(escapeHtml("Hello World")).toBe("Hello World");
  });
});

describe("Path Traversal Prevention", () => {
  function isValidFilename(raw: string): boolean {
    if (!raw) return false;
    if (raw.includes("..") || raw.includes("\0") || raw.includes("/") || raw.includes("\\")) return false;
    return true;
  }

  it("should reject filenames with ..", () => {
    expect(isValidFilename("../../etc/passwd")).toBe(false);
  });

  it("should reject filenames with null byte", () => {
    expect(isValidFilename("file.jpg\0.exe")).toBe(false);
  });

  it("should reject filenames with slashes", () => {
    expect(isValidFilename("/etc/passwd")).toBe(false);
    expect(isValidFilename("..\\windows\\system32")).toBe(false);
  });

  it("should accept valid filenames", () => {
    expect(isValidFilename("card-123456-abc.png")).toBe(true);
    expect(isValidFilename("photo.jpg")).toBe(true);
  });

  it("should reject empty filenames", () => {
    expect(isValidFilename("")).toBe(false);
  });
});

describe("API Key Masking", () => {
  function maskApiKey(text: string): string {
    return text
      .replace(/sk-[a-zA-Z0-9]{4,}/g, "sk-****")
      .replace(/key_[a-zA-Z0-9]{4,}/g, "key_****");
  }

  it("should mask sk- prefixed keys", () => {
    expect(maskApiKey("Error with key sk-abc123def456")).toBe("Error with key sk-****");
  });

  it("should mask key_ prefixed keys", () => {
    expect(maskApiKey("Using key_abc123def456")).toBe("Using key_****");
  });

  it("should leave text without keys unchanged", () => {
    expect(maskApiKey("No keys here")).toBe("No keys here");
  });
});
