import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { userAddonsTable } from "@workspace/db";
import { and, eq, lt, isNotNull } from "drizzle-orm";
import { ensureSystemAddons, ensureDefaultSettings } from "./lib/seed";
import { plansTable } from "@workspace/db";

/** Deactivate expired user addons (runs every hour). */
async function deactivateExpiredAddons() {
  try {
    const now = new Date();
    const result = await db
      .update(userAddonsTable)
      .set({ isActive: false })
      .where(
        and(
          eq(userAddonsTable.isActive, true),
          isNotNull(userAddonsTable.expiresAt),
          lt(userAddonsTable.expiresAt, now)
        )
      );
    const count = (result as any).rowCount ?? 0;
    if (count > 0) logger.info({ count }, "Deactivated expired addons");
  } catch (err) {
    logger.error({ err }, "Failed to deactivate expired addons");
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

/** Validate BYOK_ENCRYPTION_KEY based on plan modes. */
async function validateByokConfig() {
  try {
    const byokPlans = await db
      .select({ id: plansTable.id })
      .from(plansTable)
      .where(eq(plansTable.plan_mode, "byok"))
      .limit(1);

    const hasByokPlans = byokPlans.length > 0;
    const encryptionKey = process.env["BYOK_ENCRYPTION_KEY"];

    if (hasByokPlans && !encryptionKey) {
      logger.error("FATAL: BYOK_ENCRYPTION_KEY is required when BYOK plans exist in the database.");
      process.exit(1);
    }

    if (!hasByokPlans && !encryptionKey) {
      logger.warn("WARN: BYOK_ENCRYPTION_KEY is not set. BYOK plans will not function if created.");
    } else if (encryptionKey && encryptionKey.length < 64) {
      logger.warn("WARN: BYOK_ENCRYPTION_KEY should be a 32-byte hex string (64 characters).");
    }
  } catch (err) {
    logger.error({ err }, "Failed to validate BYOK configuration during startup");
  }
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Run startup syncs
  ensureSystemAddons();
  ensureDefaultSettings();
  validateByokConfig();
  
  // Run expiration cleanup immediately, then every hour
  deactivateExpiredAddons();
  setInterval(deactivateExpiredAddons, 60 * 60 * 1000);
});
