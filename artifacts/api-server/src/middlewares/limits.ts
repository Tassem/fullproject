// @ts-nocheck
import { db, pointsWalletTable, pointsTransactionsTable, subscriptionsTable, plansTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

export async function checkAndDeductPoints(
  userId: number,
  pointsRequired: number,
  description: string,
  articleId?: number
): Promise<{ success: boolean; error?: string }> {
  const [wallet] = await db.select().from(pointsWalletTable).where(eq(pointsWalletTable.userId, userId)).limit(1);
  if (!wallet || wallet.balance < pointsRequired) {
    return { success: false, error: "Insufficient points" };
  }
  await db.transaction(async (tx) => {
    await tx.update(pointsWalletTable).set({ balance: sql`${pointsWalletTable.balance} - ${pointsRequired}`, updatedAt: new Date() }).where(eq(pointsWalletTable.userId, userId));
    await tx.insert(pointsTransactionsTable).values({ userId, type: "usage", amount: -pointsRequired, articleId, description });
  });
  return { success: true };
}

export async function consumeArticleCredit(
  userId: number,
  articleId?: number
): Promise<{ success: boolean; error?: string; consumedType?: "quota" | "points" }> {
  const [subInfo] = await db
    .select({ subscription: subscriptionsTable, plan: plansTable })
    .from(subscriptionsTable)
    .innerJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
    .where(eq(subscriptionsTable.userId, userId))
    .limit(1);

  if (!subInfo) {
    // No subscription — allow processing (free mode)
    return { success: true, consumedType: "quota" };
  }

  const { subscription, plan } = subInfo;
  const used = subscription.articlesUsedThisPeriod;
  const max = (plan as any).max_articles_per_month ?? (plan as any).maxArticlesPerMonth ?? 0;

  if (max === 0 || used < max) {
    await db.update(subscriptionsTable).set({ articlesUsedThisPeriod: used + 1, updatedAt: new Date() }).where(eq(subscriptionsTable.id, subscription.id));
    return { success: true, consumedType: "quota" };
  }

  const POINTS_PER_ARTICLE = 10;
  const pointsResult = await checkAndDeductPoints(userId, POINTS_PER_ARTICLE, "Article generation (quota exceeded)", articleId);
  if (pointsResult.success) return { success: true, consumedType: "points" };

  return { success: false, error: "Monthly quota reached and insufficient points. Please upgrade or buy points." };
}
