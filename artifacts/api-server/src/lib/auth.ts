import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable, plansTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";

export function signToken(payload: { userId: number; isAdmin: boolean }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): { userId: number; isAdmin: boolean } {
  return jwt.verify(token, JWT_SECRET) as { userId: number; isAdmin: boolean };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);
    if (!user) return res.status(401).json({ error: "User not found" });
    (req as any).user = user;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// ── API Key authentication (with plan feature check) ─────────────────────────
// Accepts X-API-Key header OR Authorization: Bearer key_xxx
export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const headerKey = req.headers["x-api-key"] as string | undefined;
  const bearerKey = req.headers.authorization?.startsWith("Bearer key_")
    ? req.headers.authorization.slice(7)
    : undefined;
  const apiKey = headerKey || bearerKey;

  if (!apiKey) {
    return res.status(401).json({ error: "API key required. Pass X-API-Key header." });
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.apiKey, apiKey)).limit(1);
  if (!user) return res.status(401).json({ error: "Invalid API key" });

  // Check that user's plan has API access enabled
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.slug, user.plan)).limit(1);
  if (plan && !plan.has_api_access) {
    return res.status(403).json({
      error: "API access is not enabled on your current plan. Please upgrade to Pro or Business.",
      plan: user.plan,
    });
  }

  (req as any).user = user;
  (req as any).plan = plan ?? null;
  return next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, async () => {
    const user = (req as any).user;
    if (!user?.isAdmin) return res.status(403).json({ error: "Forbidden" });
    return next();
  });
}
