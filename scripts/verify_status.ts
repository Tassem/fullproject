import { db } from "@workspace/db";
import { plansTable, userProviderKeysTable, creditTransactionsTable } from "@workspace/db";
import { count, sql } from "drizzle-orm";

async function main() {
  try {
    const plans = await db.select().from(plansTable);
    console.log("=== Q7: Plans ===");
    console.table(plans.map(p => ({ id: p.id, name: p.name, slug: p.slug, plan_mode: (p as any).plan_mode })));

    const [keysCount] = await db.select({ value: count() }).from(userProviderKeysTable);
    console.log("\n=== Q9: user_provider_keys COUNT ===");
    console.log(keysCount.value);

    console.log("\n=== Q10: credit_transactions Columns ===");
    const cols = await db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'credit_transactions'`);
    console.table(cols.rows);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
