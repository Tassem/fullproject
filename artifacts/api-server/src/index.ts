import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { userAddonsTable } from "@workspace/db";
import { and, eq, lt, isNotNull } from "drizzle-orm";

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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Run expiration cleanup immediately, then every hour
  deactivateExpiredAddons();
  setInterval(deactivateExpiredAddons, 60 * 60 * 1000);
});
