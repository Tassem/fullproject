import { deductCredits } from "../lib/credits";
import { getBlogArticleCost } from "../lib/costService";

import type { KeySource } from "../lib/providerKeyResolver";

export async function consumeArticleCredit(
  userId: number,
  _articleId?: number,
  providerKeySource: KeySource = "platform"
): Promise<{ success: boolean; error?: string; consumedType?: "quota" | "points" }> {
  const cost = await getBlogArticleCost();
  
  const result = await deductCredits(
    userId,
    cost,
    "blog_automation",
    "has_blog_automation",
    `[Blog] نشر مقال`,
    providerKeySource
  );

  if (result.ok) {
    return { success: true, consumedType: "points" };
  }

  return { 
    success: false, 
    error: result.error || "Insufficient credits. Please upgrade your plan or purchase more credits." 
  };
}
