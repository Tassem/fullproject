import { useEffect, useState } from "react";
import { Check, X, Zap, Building2, User, Star, AlertCircle, Newspaper, Rss, RefreshCw, Coins } from "lucide-react";
import { getUserCredits } from "@/lib/creditUtils";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface Plan {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  monthly_credits: number;
  max_templates: number;
  max_saved_designs: number;
  max_sites: number;
  has_blog_automation: boolean;
  has_image_generator: boolean;
  has_ai_image_generation: boolean;
  has_api_access: boolean;
  has_telegram_bot: boolean;
  has_overlay_upload: boolean;
  has_custom_watermark: boolean;
  has_priority_processing: boolean;
  has_priority_support: boolean;
  rate_limit_daily: number;
  rate_limit_hourly: number;
  sort_order: number;
  is_active: boolean;
  is_free: boolean;
}

interface Usage {
  monthly_credits: number;
  purchased_credits: number;
  total_credits: number;
  credits_reset_date: string | null;
  daily_usage: number;
  daily_limit: number;
  sitesLimit: number;
  templatesLimit: number;
  savedDesignsLimit: number;
  has_api_access: boolean;
  has_telegram_bot: boolean;
  has_overlay_upload: boolean;
  has_custom_watermark: boolean;
  has_blog_automation: boolean;
  has_image_generator: boolean;
  monthly_allocation: number;
}

interface SubscriptionData {
  currentPlan: string;
  usage: Usage;
  plans: Plan[];
}

const PLAN_ICONS: Record<string, React.FC<{ className?: string }>> = {
  free: User,
  starter: Zap,
  pro: Star,
  business: Building2,
};

const PLAN_ACCENT: Record<string, { bar: string; icon: string; badge: string; ring: string }> = {
  free:     { bar: "bg-slate-500",   icon: "bg-slate-500/15 text-slate-300",   badge: "bg-slate-500/15 text-slate-300",   ring: "ring-slate-500" },
  starter:  { bar: "bg-blue-500",    icon: "bg-blue-500/15 text-blue-400",     badge: "bg-blue-500/15 text-blue-400",     ring: "ring-blue-400" },
  pro:      { bar: "bg-violet-600",  icon: "bg-violet-500/15 text-violet-400", badge: "bg-violet-500/15 text-violet-400", ring: "ring-violet-500" },
  business: { bar: "bg-amber-500",   icon: "bg-amber-500/15 text-amber-400",   badge: "bg-amber-500/15 text-amber-400",   ring: "ring-amber-400" },
};

function displayNum(n: number, suffix = "") {
  if (n <= 0) return "—";
  return n.toLocaleString() + suffix;
}

function UsageMeter({ label, used, limit }: { label: string; used: number; limit: number }) {
  if (limit <= 0) return null;
  const pct = Math.min((used / limit) * 100, 100);
  const color = pct >= 90 ? "text-red-600" : pct >= 70 ? "text-amber-600" : "text-foreground";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-medium", color)}>{used} / {limit.toLocaleString()}</span>
      </div>
      <Progress value={pct} className={cn("h-2", pct >= 90 ? "[&>div]:bg-red-500" : pct >= 70 ? "[&>div]:bg-amber-500" : "")} />
    </div>
  );
}

function FeatureRow({ label, value, active }: { label: string; value?: string; active: boolean }) {
  return (
    <li className={cn("flex items-center justify-between gap-2 text-sm py-0.5", !active && "opacity-40")}>
      <span className="flex items-center gap-2">
        {active
          ? <Check className="h-3.5 w-3.5 shrink-0 text-green-500" />
          : <X className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        {label}
      </span>
      {value && <span className="font-medium text-xs tabular-nums">{value}</span>}
    </li>
  );
}

export default function Subscription() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    const token = localStorage.getItem("pro_token");
    if (!token) return;
    fetch("/api/subscription", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid gap-6 lg:grid-cols-4">
          {[1,2,3,4].map(i => <div key={i} className="h-96 bg-muted animate-pulse rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!data) return <div className="text-muted-foreground">Could not load subscription data.</div>;
  const usage = data.usage;
  const { currentPlan, plans } = data;

  const { monthly, purchased, total } = getUserCredits(usage);

  const creditsUsed = usage.monthly_allocation > 0
    ? usage.monthly_allocation - monthly
    : 0;

  const resetDate = usage.credits_reset_date
    ? new Date(usage.credits_reset_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500" dir="ltr">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Plan</h1>
        <p className="text-muted-foreground mt-1">Manage your subscription and track usage</p>
      </div>

      {/* Usage Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-semibold">Current Usage</h2>
              <p className="text-sm text-muted-foreground">
                Daily limit resets at midnight
                {resetDate && <> · Monthly credits reset {resetDate}</>}
              </p>
            </div>
            <Badge className={cn("text-xs px-3 py-1", accent.badge)}>
              {activePlan?.name ?? currentPlan}
            </Badge>
          </div>
        </CardHeader>

        {/* Credits & Daily usage */}
        <CardContent className="pb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" /> Credits
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <UsageMeter
              label="Monthly credits used"
              used={creditsUsed}
              limit={usage.monthly_allocation}
            />
            <UsageMeter
              label="Daily operations"
              used={usage.daily_usage}
              limit={usage.daily_limit}
            />
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Purchased credits</span>
                <span className="font-medium text-violet-500">{purchased}</span>

              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <RefreshCw className="h-3 w-3" /> Never expires
              </div>
            </div>
          </div>
        </CardContent>

        {/* Blog Automation */}
        {usage.has_blog_automation && (
          <CardContent className="pb-4 border-t pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Rss className="h-3.5 w-3.5" /> Blog Automation
            </p>
            <UsageMeter label="Managed sites" used={0} limit={usage.sitesLimit} />
          </CardContent>
        )}

        {/* Feature flags */}
        <CardContent className="pt-0 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "API Access",       active: usage.has_api_access },
            { label: "Telegram Bot",     active: usage.has_telegram_bot },
            { label: "Overlay Upload",   active: usage.has_overlay_upload },
            { label: "Custom Watermark", active: usage.has_custom_watermark },
          ].map(f => (
            <div key={f.label} className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
              f.active ? "border-green-200 bg-green-50 text-green-700" : "border-dashed bg-muted/30 text-muted-foreground")}>
              {f.active
                ? <Check className="h-4 w-4 text-green-500 shrink-0" />
                : <AlertCircle className="h-4 w-4 shrink-0 opacity-40" />}
              {f.label}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Plans Grid */}
      <div>
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h2 className="text-xl font-semibold">Subscription Plans</h2>
          <div className="flex items-center gap-1 rounded-lg border p-1 bg-muted/30 text-sm">
            <button
              className={cn("px-3 py-1 rounded-md transition-colors",
                billing === "monthly" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground")}
              onClick={() => setBilling("monthly")}>Monthly</button>
            <button
              className={cn("px-3 py-1 rounded-md transition-colors",
                billing === "yearly" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground")}
              onClick={() => setBilling("yearly")}>
              Yearly <span className="ml-1 text-xs text-green-600 font-medium">Save ~20%</span>
            </button>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[...plans].sort((a, b) => a.sort_order - b.sort_order).map(plan => {
            const isActive = plan.slug === currentPlan;
            const Icon = PLAN_ICONS[plan.slug] ?? User;
            const ac = PLAN_ACCENT[plan.slug] ?? PLAN_ACCENT.free;
            const price = billing === "yearly" && plan.price_yearly > 0
              ? Math.round(plan.price_yearly / 12)
              : plan.price_monthly;

            return (
              <Card key={plan.id} className={cn("flex flex-col relative transition-all",
                isActive ? `ring-2 ${ac.ring} shadow-lg scale-[1.02]` : "hover:shadow-md")}>
                {isActive && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-primary text-primary-foreground px-3 text-xs">Current Plan</Badge>
                  </div>
                )}
                <div className={cn("h-1.5 w-full rounded-t-xl", ac.bar)} />

                <CardHeader className="pt-5 pb-2">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-2", ac.icon)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  {plan.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
                  )}
                  <div className="mt-1">
                    {plan.price_monthly === 0 ? (
                      <span className="text-2xl font-bold">Free</span>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold">${price}</span>
                        <span className="text-sm text-muted-foreground">/mo</span>
                      </div>
                    )}
                    {billing === "yearly" && plan.price_yearly > 0 && (
                      <p className="text-xs text-green-600 mt-0.5">${plan.price_yearly} / year</p>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex-1 pt-0 pb-3 space-y-3">
                  {/* Credits */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                      <Zap className="h-3 w-3" /> Credits
                    </p>
                    <ul className="space-y-0.5">
                      <FeatureRow label="Monthly credits" value={displayNum(plan.monthly_credits, " cr")} active={true} />
                      <FeatureRow label="Daily limit" value={displayNum(plan.rate_limit_daily, "/day")} active={true} />
                    </ul>
                  </div>

                  {/* Image Design */}
                  <div className="border-t pt-2.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                      <Newspaper className="h-3 w-3" /> Image Design
                    </p>
                    <ul className="space-y-0.5">
                      <FeatureRow label="Templates"      value={displayNum(plan.max_templates)}    active={plan.has_image_generator} />
                      <FeatureRow label="Saved designs"  value={displayNum(plan.max_saved_designs)} active={plan.has_image_generator} />
                      <FeatureRow label="Custom watermark" active={plan.has_custom_watermark} />
                      <FeatureRow label="Overlay upload"   active={plan.has_overlay_upload} />
                    </ul>
                  </div>

                  {/* Blog Automation */}
                  <div className="border-t pt-2.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                      <Rss className="h-3 w-3" /> Blog Automation
                    </p>
                    <ul className="space-y-0.5">
                      <FeatureRow label="Full automation" active={plan.has_blog_automation} />
                      <FeatureRow
                        label="WordPress sites"
                        value={plan.has_blog_automation ? displayNum(plan.max_sites) : undefined}
                        active={plan.has_blog_automation}
                      />
                    </ul>
                  </div>

                  {/* General */}
                  <div className="border-t pt-2.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">General</p>
                    <ul className="space-y-0.5">
                      <FeatureRow label="API Access"        active={plan.has_api_access} />
                      <FeatureRow label="Telegram Bot"      active={plan.has_telegram_bot} />
                      <FeatureRow label="Priority support"  active={plan.has_priority_support} />
                    </ul>
                  </div>
                </CardContent>

                <CardFooter className="pt-0">
                  {isActive ? (
                    <Button className="w-full" disabled variant="outline">Current Plan</Button>
                  ) : (
                    <Button className="w-full" variant={plan.slug === "pro" ? "default" : "outline"}>
                      {plan.price_monthly === 0 ? "Use for Free" : `Upgrade to ${plan.name}`}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          To upgrade or change plans, contact your administrator
        </p>
      </div>
    </div>
  );
}
