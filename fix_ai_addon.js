
const pg = require('pg');

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const client = await pool.connect();
    console.log("Connected to DB");

    // Check if addon exists
    const res = await client.query("SELECT * FROM plan_addons WHERE slug = 'ai_image_generation'");
    console.log("Current AI Addon count:", res.rowCount);

    if (res.rowCount === 0) {
      console.log("Inserting AI Image Generation addon...");
      await client.query(`
        INSERT INTO plan_addons (
          name, slug, type, feature_key, price, is_recurring, is_active
        ) VALUES (
          'AI Image Generation',
          'ai_image_generation',
          'feature',
          'has_ai_image_generation',
          39,
          true,
          true
        )
      `);
      console.log("Inserted successfully.");
    } else {
      const addon = res.rows[0];
      console.log("Addon exists:", JSON.stringify(addon));
      if (!addon.is_active) {
        console.log("Activating addon...");
        await client.query("UPDATE plan_addons SET is_active = true WHERE slug = 'ai_image_generation'");
      }
    }

    client.release();
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

main();
