import { getSettingNumber } from "./settings";

// ─── Card & AI Costs ───────────────────────────────────────────
export async function getCardBaseCost(): Promise<number> {
  return getSettingNumber("card_generation_base_cost", 1);
}

export async function getAiImageCost(): Promise<number> {
  return getSettingNumber("ai_image_cost_per_generation", 2);
}

export async function getCardTotalCost(aiLayersCount: number = 0): Promise<number> {
  const base = await getCardBaseCost();
  const ai = await getAiImageCost();
  return base + (aiLayersCount * ai);
}

// ─── Blog Costs ────────────────────────────────────────────────
export async function getBlogArticleCost(): Promise<number> {
  return getSettingNumber("points_burn_per_article", 5);
}

// ─── Signup & Subscription ─────────────────────────────────────
export async function getSignupBonus(): Promise<number> {
  return getSettingNumber("signup_bonus_credits", 30);
}

export async function getMonthlyResetAmount(plan: string): Promise<number> {
  // Keep plan-based logic but make default configurable if needed
  // This is a placeholder for more complex plan logic if required later
  return getSettingNumber(`plan_${plan}_monthly_credits`, 0);
}

// ─── Future Features (add here, never hardcode elsewhere) ──────
export async function getAllPointCosts(): Promise<{
  cardBaseCost: number;
  aiImageCost: number;
  blogArticleCost: number;
  signupBonus: number;
}> {
  const [cardBaseCost, aiImageCost, blogArticleCost, signupBonus] = await Promise.all([
    getCardBaseCost(),
    getAiImageCost(),
    getBlogArticleCost(),
    getSignupBonus(),
  ]);
  return { cardBaseCost, aiImageCost, blogArticleCost, signupBonus };
}
