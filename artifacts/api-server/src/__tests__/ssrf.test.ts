import { describe, it, expect } from "vitest";

// Test the BLOCKED_IP_PATTERNS regex directly (same as in v1.ts)
const BLOCKED_IP_PATTERNS = [
  /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
  /^169\.254\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^::1$/, /^fc/, /^fd/, /^fe80/,
];

function isBlockedIp(addr: string): boolean {
  return BLOCKED_IP_PATTERNS.some(pattern => pattern.test(addr));
}

describe("SSRF IP Blocking", () => {
  it("should block loopback 127.0.0.1", () => {
    expect(isBlockedIp("127.0.0.1")).toBe(true);
  });

  it("should block RFC 1918 10.x.x.x", () => {
    expect(isBlockedIp("10.0.0.1")).toBe(true);
    expect(isBlockedIp("10.255.255.255")).toBe(true);
  });

  it("should block RFC 1918 172.16-31.x.x", () => {
    expect(isBlockedIp("172.16.0.1")).toBe(true);
    expect(isBlockedIp("172.31.255.255")).toBe(true);
  });

  it("should NOT block 172.32.x.x (public)", () => {
    expect(isBlockedIp("172.32.0.1")).toBe(false);
  });

  it("should block RFC 1918 192.168.x.x", () => {
    expect(isBlockedIp("192.168.1.1")).toBe(true);
  });

  it("should block link-local 169.254.x.x (cloud metadata)", () => {
    expect(isBlockedIp("169.254.169.254")).toBe(true);
  });

  it("should block CGNAT 100.64-127.x.x", () => {
    expect(isBlockedIp("100.64.0.1")).toBe(true);
    expect(isBlockedIp("100.127.255.255")).toBe(true);
  });

  it("should NOT block 100.128.x.x (public)", () => {
    expect(isBlockedIp("100.128.0.1")).toBe(false);
  });

  it("should block IPv6 loopback ::1", () => {
    expect(isBlockedIp("::1")).toBe(true);
  });

  it("should block IPv6 private fc/fd prefixes", () => {
    expect(isBlockedIp("fc00::1")).toBe(true);
    expect(isBlockedIp("fd00::1")).toBe(true);
  });

  it("should block IPv6 link-local fe80", () => {
    expect(isBlockedIp("fe80::1")).toBe(true);
  });

  it("should allow public IPs", () => {
    expect(isBlockedIp("8.8.8.8")).toBe(false);
    expect(isBlockedIp("1.1.1.1")).toBe(false);
    expect(isBlockedIp("203.0.113.1")).toBe(false);
  });
});
