
import { db } from "@workspace/db";
import { planAddonsTable } from "@workspace/db";

async function main() {
  try {
    const addons = await db.select().from(planAddonsTable);
    console.log("---ADDONS_START---");
    console.log(JSON.stringify(addons, null, 2));
    console.log("---ADDONS_END---");
  } catch (err) {
    console.error("DB Query Error:", err);
  }
  process.exit(0);
}

main();
