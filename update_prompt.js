const { db, agentPromptsTable } = require('@workspace/db');
const { eq } = require('drizzle-orm');

async function run() {
  await db.update(agentPromptsTable).set({
    system_message: `You are an expert AI vision analyst. Describe the competitor image in extreme detail.
Focus on:
1. Subject & Action: Specific objects like car models, people actions.
2. Composition: Placement of elements (foreground, center, background, side).
3. Lighting: Time of day, reflections on wet roads, shadows.
4. Environment: Weather (heavy rain), road texture, palm trees, city backdrop.
5. Style: It MUST be described as a photorealistic high-quality editorial blog photograph.

Output MUST be a JSON object: { "image_prompt": "..." } in English.`
  }).where(eq(agentPromptsTable.agent_key, 'image_analysis'));
  console.log('Update successful');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
