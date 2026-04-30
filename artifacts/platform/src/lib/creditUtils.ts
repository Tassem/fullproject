/**
 * creditUtils.ts
 * Single source of truth for reading credit data from user object.
 * Use this in ALL components that display credit information.
 */

export interface UserCredits {
  monthly: number;
  purchased: number;
  total: number;
}

/**
 * Safely extracts credit information from user object
 * regardless of API response structure.
 * Handles both nested and flat structures.
 */
export function getUserCredits(user: any): UserCredits {
  if (!user) {
    return { monthly: 0, purchased: 0, total: 0 };
  }

  // Try nested structure first: user.credits.purchased
  if (user.credits && typeof user.credits === "object") {
    const monthly = Number(user.credits.monthly ?? 
                          user.credits.monthly_credits ?? 0);
    const purchased = Number(user.credits.purchased ?? 
                            user.credits.purchased_credits ?? 0);
    return {
      monthly,
      purchased,
      total: monthly + purchased,
    };
  }

  // Fallback to flat structure: user.purchased_credits
  const monthly = Number(user.monthly_credits ?? 
                        user.monthly ?? 0);
  const purchased = Number(user.purchased_credits ?? 
                          user.purchased ?? 0);
  return {
    monthly,
    purchased,
    total: monthly + purchased,
  };
}

/**
 * Format credits for display
 */
export function formatCredits(amount: number): string {
  return amount.toLocaleString("ar-SA");
}

/**
 * Check if user has enough credits
 */
export function hasEnoughCredits(user: any, required: number): boolean {
  const { total } = getUserCredits(user);
  return total >= required;
}
