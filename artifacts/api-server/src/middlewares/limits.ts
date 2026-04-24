import { db, usersTable, creditTransactionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function checkAndDeductPoints(
  userId: number,
  pointsRequired: number,
  description: string,
  service: string = "system"
): Promise<{ success: boolean; error?: string }> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return { success: false, error: "User not found" };

  const monthly = user.monthly_credits ?? 0;
  const purchased = user.purchased_credits ?? 0;
  const total = monthly + purchased;

  if (total < pointsRequired) {
    return { success: false, error: "Insufficient credits" };
  }

  // Deduct from monthly first, then purchased
  let newMonthly = monthly;
  let newPurchased = purchased;
  let remaining = pointsRequired;

  if (newMonthly >= remaining) {
    newMonthly -= remaining;
    remaining = 0;
  } else {
    remaining -= newMonthly;
    newMonthly = 0;
    newPurchased -= remaining;
  }

  await db.transaction(async (tx) => {
    await tx.update(usersTable)
      .set({ monthly_credits: newMonthly, purchased_credits: newPurchased })
      .where(eq(usersTable.id, userId));
    await tx.insert(creditTransactionsTable).values({
      userId, type: "spend", amount: -pointsRequired, description, service,
    });
  });
  return { success: true };
}

export async function consumeArticleCredit(
  userId: number,
  _articleId?: number
): Promise<{ success: boolean; error?: string; consumedType?: "quota" | "points" }> {
  const CREDITS_PER_ARTICLE = 5;
  const result = await checkAndDeductPoints(userId, CREDITS_PER_ARTICLE, "Article generation", "blog_automation");
  if (result.success) return { success: true, consumedType: "points" };
  return { success: false, error: "Insufficient credits. Please upgrade your plan or purchase more credits." };
}
