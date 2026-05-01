import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function main() {
  try {
    console.log("=== Query A: plans.plan_mode column ===");
    const resA = await db.execute(sql`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'plans' 
      AND column_name = 'plan_mode';
    `);
    console.table(resA.rows);

    console.log("\n=== Query B: user_provider_keys table exists ===");
    const resB = await db.execute(sql`SELECT COUNT(*) FROM user_provider_keys;`);
    console.table(resB.rows);

    console.log("\n=== Query C: credit_transactions.provider_key_source column ===");
    const resC = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'credit_transactions'
      AND column_name = 'provider_key_source';
    `);
    console.table(resC.rows);

    process.exit(0);
  } catch (err) {
    console.error("❌ Database verification failed:", err.message);
    process.exit(1);
  }
}

main();
