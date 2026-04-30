import { Lock, ArrowUpCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

interface UpgradePromptProps {
  requiredPlan: "pro" | "business";
  featureName?: string;
  title?: string;
  description?: string;
}

const PLAN_LABELS: Record<"pro" | "business", string> = {
  pro: "Pro",
  business: "Business",
};

export function UpgradePrompt({ 
  requiredPlan, 
  featureName, 
  title = "Feature Locked", 
  description 
}: UpgradePromptProps) {
  
  const planLabel = PLAN_LABELS[requiredPlan];
  const defaultDesc = `This feature is available on the ${planLabel} plan and above. Upgrade your plan to unlock full access.`;

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4 max-w-lg mx-auto bg-card border rounded-2xl shadow-sm">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <Lock className="w-8 h-8 text-primary" />
      </div>
      
      <h2 className="text-2xl font-bold text-foreground mb-3">
        {featureName ? `Unlock ${featureName}` : title}
      </h2>
      
      <p className="text-muted-foreground mb-8">
        {description || defaultDesc}
      </p>
      
      <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
        <Button asChild size="lg" className="gap-2 bg-primary hover:bg-primary/90">
          <Link href="/billing">
            <ArrowUpCircle size={18} />
            Upgrade to {planLabel}
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/">Back to Dashboard</Link>
        </Button>
      </div>
      
      <p className="mt-6 text-xs text-muted-foreground">
        Need help? <Link href="/tickets" className="underline">Contact Support</Link>
      </p>
    </div>
  );
}
