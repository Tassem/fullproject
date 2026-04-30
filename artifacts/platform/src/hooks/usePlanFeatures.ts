import { useAuth } from "../contexts/auth";
import { PlanFeatures } from "@workspace/db"; // Assuming types are shared

export function usePlanFeatures() {
  const { user, isLoading } = useAuth();

  const hasFeature = (feature: keyof PlanFeatures): boolean => {
    if (!user) return false;
    if (user.isAdmin) return true;
    
    return !!user.planDetails?.[feature as keyof typeof user.planDetails];
  };

  const getLimit = (limit: string): number | null => {
    if (!user) return null;
    if (user.isAdmin) return Infinity;
    return (user.planDetails as any)?.[limit] ?? null;
  };

  return {
    hasFeature,
    getLimit,
    currentPlan: user?.plan || "free",
    limits: {
      maxSites: user?.planDetails?.max_sites ?? 0,
      monthlyCredits: user?.planDetails?.monthly_credits ?? 0,
    },
    isLoading,
  };
}
