import { describe, it, expect } from "vitest";
import { signToken, verifyToken, signRefreshToken, verifyRefreshToken } from "../lib/auth";

describe("JWT Auth", () => {
  const payload = { userId: 1, isAdmin: false };

  it("should sign and verify an access token", () => {
    const token = signToken(payload);
    expect(token).toBeTruthy();
    const decoded = verifyToken(token);
    expect(decoded.userId).toBe(1);
    expect(decoded.isAdmin).toBe(false);
  });

  it("should sign and verify a refresh token", () => {
    const rt = signRefreshToken({ userId: 42 });
    expect(rt).toBeTruthy();
    const decoded = verifyRefreshToken(rt);
    expect(decoded.userId).toBe(42);
  });

  it("should reject an invalid token", () => {
    expect(() => verifyToken("invalid.token.here")).toThrow();
  });

  it("should reject a refresh token verified with access secret", () => {
    const rt = signRefreshToken({ userId: 1 });
    expect(() => verifyToken(rt)).toThrow();
  });

  it("should produce different tokens for access vs refresh", () => {
    const access = signToken(payload);
    const refresh = signRefreshToken({ userId: payload.userId });
    expect(access).not.toBe(refresh);
  });
});
