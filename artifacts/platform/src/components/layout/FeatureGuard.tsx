import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { Lock } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

import { PlanFeatures } from "@workspace/db";

import { useAuth } from "@/hooks/useAuth";

interface FeatureGuardProps {
  children: React.ReactNode;
  feature: keyof PlanFeatures;
  title?: string;
  description?: string;
  fallback?: React.ReactNode;
}

export function FeatureGuard({ children, feature, title, description, fallback }: FeatureGuardProps) {
  const { user, loading: isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasAccess = user?.isAdmin || user?.planDetails?.[feature as keyof typeof user.planDetails] === true;
  
  if (!hasAccess) {
    if (fallback) return <>{fallback}</>;
    
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-4 max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-6">
          <Lock className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-3">{title || "Feature Locked"}</h2>
        <p className="text-muted-foreground mb-8">
          {description || "This feature is not available on your current plan."}
        </p>
        <Button asChild size="lg" className="gap-2">
          <Link href="/billing">Upgrade Plan</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
