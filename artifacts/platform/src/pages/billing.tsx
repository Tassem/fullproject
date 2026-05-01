import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  CreditCard, Package, Check, Zap, ArrowRight, ShieldCheck, History, Coins, Calendar,
  Globe, FileText, TrendingUp, ChevronRight, Star, Clock, ArrowUpRight,
  AlertCircle, RefreshCw, XCircle, Sparkles, Layers, X, Loader2, Puzzle, HelpCircle,
} from "lucide-react";
import { getUserCredits } from "@/lib/creditUtils";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UpgradeModal } from "@/components/SaaS/UpgradeModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OpenRouterKeyModal } from "@/components/OpenRouterKeyModal";

const AUTH = () => ({ Authorization: `Bearer ${localStorage.getItem("pro_token")}` });

// ─── Types ────────────────────────────────────────────────────────────────────

interface BillingStatus {
  plan: {
    id: number; name: string; displayName: string;
    price_monthly: number; price_yearly: number;
    monthly_credits: number; max_sites: number;
    rate_limit_daily: number;
    has_telegram_bot: boolean; has_blog_automation: boolean;
    has_image_generator: boolean; has_api_access: boolean;
    has_overlay_upload: boolean; has_custom_watermark: boolean;
    has_ai_image_generation: boolean;
    plan_mode?: string;
  } | null;
  /** effective = plan + addons merged — use this for UI display */
  effective: {
    max_sites: number; max_templates: number | null;
    max_saved_designs: number | null; rate_limit_daily: number;
    has_ai_image_generation?: boolean; [key: string]: unknown;
  } | null;
  subscription: {
    id: number; status: string;
    currentPeriodStart: string; currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  } | null;
  usage: {
    credits: {
      monthly: number; purchased: number; total: number;
      reset_date: string | null; daily_usage: number; daily_limit: number;
    };
    sites: { used: number; max: number; percentage: number };
  };
  has_openrouter_key?: boolean;
  openrouter_key_hint?: string | null;
}

interface Plan {
  id: number; name: string; slug: string;
  price_monthly: number; price_yearly: number;
  monthly_credits: number; max_sites: number;
  has_telegram_bot: boolean; has_blog_automation: boolean;
  has_image_generator: boolean; has_ai_image_generation: boolean;
  has_api_access: boolean; has_overlay_upload: boolean;
  has_custom_watermark: boolean; has_priority_support: boolean;
  is_active: boolean; sort_order: number;
}

interface PaymentRequest {
  id: number; type: string;
  planId: number | null; planName: string | null;
  pointsAmount: number | null; paymentMethod: string;
  proofDetails: string; status: string; adminNotes: string | null;
  createdAt: string;
}

interface PlanAddon {
  id: number; name: string; slug: string;
  type: "feature" | "credits" | "limit";
  credits_amount: number; feature_key: string | null;
  limit_key: string | null; limit_value: number | null;
  price: number; is_recurring: boolean; is_active: boolean;
  subscriber_count?: number;
}

interface UserAddon {
  id: number; addonId: number;
  name: string; slug: string;
  type: string; credits_amount: number;
  feature_key: string | null; limit_key: string | null; limit_value: number | null;
  price: number; is_recurring: boolean;
  purchasedAt: string; expiresAt: string | null; isActive: boolean;
}

// ─── Addon Purchase Modal ──────────────────────────────────────────────────────
function AddonPurchaseModal({
  addon, open, onClose, onSuccess,
}: { addon: PlanAddon; open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [method, setMethod] = useState<"paypal" | "bank_transfer">("paypal");
  const [proof, setProof] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!proof.trim()) return;
    setSubmitting(true);
    try {
      const r = await fetch("/api/addons/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...AUTH() },
        body: JSON.stringify({ addonId: addon.id, paymentMethod: method, proofDetails: proof }),
      });
        if (r.status === 409) {
          const e = await r.json().catch(() => ({}));
          alert(e.message || "Conflict: Addon already purchased or pending.");
          onClose();
          return;
        }
        if (!r.ok) {
          const e = await r.json().catch(() => ({})) as any;
          throw new Error(e.message || e.error || "Request failed");
        }
        setDone(true);
        onSuccess();
      } catch (err: any) {
        alert(err.message);
      } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const typeIcon = addon.type === "feature" ? <Sparkles className="w-5 h-5 text-purple-400" />
    : addon.type === "credits" ? <Coins className="w-5 h-5 text-amber-400" />
    : <Layers className="w-5 h-5 text-blue-400" />;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            {typeIcon}
            <div>
              <h3 className="text-base font-black text-white">{addon.name}</h3>
              <p className="text-xs text-zinc-500">{addon.is_recurring ? "Monthly subscription" : "One-time purchase"}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-white font-bold">Request Submitted!</p>
            <p className="text-sm text-zinc-400 mt-1">Our team will review and activate within 24h.</p>
            <button onClick={onClose} className="mt-5 px-6 py-2 rounded-xl bg-white/10 text-white text-sm font-bold hover:bg-white/20 transition-all">
              Close
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
              <span className="text-sm text-zinc-400 font-medium">Price</span>
              <span className="text-2xl font-black text-white font-mono">${addon.price}<span className="text-sm text-zinc-500 font-bold">{addon.is_recurring ? "/mo" : ""}</span></span>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">Payment Method</p>
              <div className="grid grid-cols-2 gap-2">
                {(["paypal", "bank_transfer"] as const).map(m => (
                  <button key={m} onClick={() => setMethod(m)}
                    className={cn("p-3 rounded-xl border text-sm font-bold transition-all text-left",
                      method === m ? "border-orange-500/50 bg-orange-500/10 text-white" : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20"
                    )}>
                    {m === "paypal" ? "PayPal" : "Bank Transfer"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">Payment Proof / Reference</p>
              <textarea
                value={proof} onChange={e => setProof(e.target.value)}
                placeholder="Transaction ID, screenshot URL, or reference number..."
                className="w-full h-20 bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/40 resize-none"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || !proof.trim()}
              className="w-full h-11 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Submit Payment Request
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; className: string }> = {
    active:    { label: "Active",    className: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
    trialing:  { label: "Trial",     className: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
    cancelled: { label: "Cancelled", className: "text-rose-400 bg-rose-500/10 border-rose-500/20" },
    expired:   { label: "Expired",   className: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20" },
  };
  const c = cfg[status] ?? cfg.active;
  return (
    <span className={cn("px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-widest", c.className)}>
      {c.label}
    </span>
  );
}

function LimitBar({ label, used, max, percentage, icon: Icon, color }: {
  label: string; used: number; max: number;
  percentage: number;
  icon: React.ElementType; color: string;
}) {
  const isWarning = percentage >= 80;
  const isDanger  = percentage >= 95;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn("w-4 h-4", color)} />
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-black font-mono", isDanger ? "text-rose-400" : isWarning ? "text-amber-400" : "text-white")}>
            {used}
          </span>
          <span className="text-xs text-zinc-600 font-mono">/ {max >= 999999 ? "∞" : max.toLocaleString()}</span>
        </div>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700",
            isDanger ? "bg-gradient-to-r from-rose-600 to-rose-400"
            : isWarning ? "bg-gradient-to-r from-amber-600 to-amber-400"
            : "bg-gradient-to-r from-orange-600 to-orange-400")}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <p className="text-[10px] text-zinc-600 font-medium">{Math.max(0, max - used)} remaining</p>
    </div>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/5 bg-white/[0.02] rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-6 text-left"
      >
        <span className="text-sm font-bold text-white">{q}</span>
        <ChevronRight className={cn("w-4 h-4 text-zinc-600 transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <div className="px-6 pb-6 text-xs text-zinc-500 leading-relaxed animate-in slide-in-from-top-2 duration-300">
          {a}
        </div>
      )}
    </div>
  );
}

function PlanCard({ plan, currentPlanSlug, onUpgrade, pendingRequest, rejectedRequest }: {
  plan: Plan; currentPlanSlug: string; onUpgrade: (plan: Plan) => void;
  pendingRequest?: PaymentRequest; rejectedRequest?: PaymentRequest;
}) {
  const isCurrent = plan.slug === currentPlanSlug;
  const isPopular = plan.slug === "pro";
  const features: string[] = [
    plan.monthly_credits >= 999999 ? "Unlimited credits/month" : plan.monthly_credits > 0 ? `${plan.monthly_credits} credits/month` : "",
    plan.has_blog_automation       ? "Blog Automation"   : "",
    plan.has_telegram_bot          ? "Telegram Bot"      : "",
    plan.has_image_generator       ? "Image Generator"   : "",
    plan.has_ai_image_generation   ? "AI Image Generation" : "",
    plan.has_api_access            ? "API Access"        : "",
    plan.has_overlay_upload        ? "Overlay Upload"    : "",
    plan.has_custom_watermark      ? "Custom Watermark"  : "",
    plan.has_priority_support      ? "Priority Support"  : "",
  ].filter(Boolean);

  return (
    <div className={cn(
      "relative rounded-2xl border p-6 flex flex-col gap-4 transition-all duration-300",
      isCurrent ? "border-orange-500/40 bg-orange-500/5 shadow-[0_0_30px_rgba(249,115,22,0.1)]"
      : isPopular ? "border-blue-500/20 bg-blue-500/5 hover:border-blue-500/40"
      : "border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.03]"
    )}>
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-500 rounded-full">
          <span className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-1">
            <Star className="w-3 h-3" fill="currentColor" /> Popular
          </span>
        </div>
      )}
      {isCurrent && (
        <div className="absolute -top-3 right-4 px-3 py-1 bg-orange-500 rounded-full">
          <span className="text-[10px] font-black text-white uppercase tracking-widest">Current</span>
        </div>
      )}
      <div>
        <h3 className="text-base font-black text-white tracking-tight">{plan.name}</h3>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-black text-white font-mono tracking-tighter">
          {plan.price_monthly === 0 ? "Free" : `${plan.price_monthly}`}
        </span>
        {plan.price_monthly > 0 && (
          <span className="text-xs text-zinc-500 font-bold">$/mo</span>
        )}
      </div>
      <div className="space-y-2 text-[11px] text-zinc-400 flex-1">
        <div className="flex items-center gap-2">
          <Globe className="w-3 h-3 text-orange-400" />
          <span className={!plan.has_blog_automation ? "text-muted-foreground italic" : ""}>
            {!plan.has_blog_automation ? "Not available" : (plan.max_sites === 0 ? "No sites" : `${plan.max_sites} site${plan.max_sites !== 1 ? "s" : ""}`)}
          </span>
        </div>
        {features.map((f) => (
          <div key={f} className="flex items-center gap-2">
            <Check className="w-3 h-3 text-emerald-400" />
            <span>{f}</span>
          </div>
        ))}
      </div>
      {isCurrent ? (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-orange-500/20 bg-orange-500/5">
          <Check className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-[11px] font-black text-orange-400 uppercase tracking-widest">Current Plan</span>
        </div>
      ) : pendingRequest ? (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] font-black text-amber-400 uppercase tracking-widest">Pending Review</span>
        </div>
      ) : (
        <button
          onClick={() => onUpgrade(plan)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 bg-orange-600 hover:bg-orange-700 border border-orange-500/50 text-white"
        >
          {rejectedRequest ? "Try Again" : "Upgrade Plan"} <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      )}
      {rejectedRequest && !pendingRequest && (
        <p className="text-[9px] text-rose-400 font-bold text-center mt-1">Previous request rejected: {rejectedRequest.adminNotes}</p>
      )}
    </div>
  );
}

const REQ_STATUS: Record<string, { label: string; cls: string }> = {
  pending:   { label: "Pending Review", cls: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  approved:  { label: "Approved",       cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  rejected:  { label: "Rejected",       cls: "text-rose-400 bg-rose-500/10 border-rose-500/20" },
  cancelled: { label: "Cancelled",      cls: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20" },
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Billing() {
  const qc = useQueryClient();
  const [selectedPlan, setSelectedPlan]       = useState<Plan | null>(null);
  const [activeTab, setActiveTab]               = useState<"platform" | "byok">("platform");
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [customPoints, setCustomPoints]         = useState(50);
  const [pointsForPurchase, setPointsForPurchase] = useState(50);
  const [showHistory, setShowHistory]           = useState(false);
  const [addonModalOpen, setAddonModalOpen]     = useState(false);
  const [selectedAddon, setSelectedAddon]       = useState<PlanAddon | null>(null);
  const [showKeyModal, setShowKeyModal]         = useState(false);

  const { data: billing, isLoading: billingLoading, refetch } = useQuery<BillingStatus>({
    queryKey: ["billing", "status"],
    queryFn: async () => {
      const r = await fetch("/api/billing/status", { headers: AUTH() });
      if (!r.ok) throw new Error("Failed to fetch billing status");
      return r.json();
    },
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });

  const { data: plansData, isLoading: plansLoading } = useQuery<{ plans: Plan[] }>({
    queryKey: ["billing", "plans"],
    queryFn: async () => {
      const r = await fetch("/api/billing/plans", { headers: AUTH() });
      if (!r.ok) throw new Error("Failed to fetch plans");
      return r.json();
    },
  });

  const { data: siteInfo } = useQuery<{ settings: Record<string, string> }>({
    queryKey: ["public", "site-info"],
    queryFn: async () => {
      const r = await fetch("/api/public/site-info");
      if (!r.ok) return { settings: {} };
      return r.json();
    },
    staleTime: 60_000,
  });

  const { data: myRequests = [] } = useQuery<PaymentRequest[]>({
    queryKey: ["payments", "my-requests"],
    queryFn: async () => {
      const r = await fetch("/api/payments/my-requests", { headers: AUTH() });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    staleTime: 15_000,
  });

  const { data: addonsData } = useQuery<{ addons: PlanAddon[] }>({
    queryKey: ["addons", "available"],
    queryFn: async () => {
      const r = await fetch("/api/addons", { headers: AUTH() });
      if (!r.ok) return { addons: [] };
      return r.json();
    },
    staleTime: 60_000,
  });

  const { data: myAddonsData, refetch: refetchMyAddons } = useQuery<{ addons: UserAddon[] }>({
    queryKey: ["addons", "mine"],
    queryFn: async () => {
      const r = await fetch("/api/addons/mine", { headers: AUTH() });
      if (!r.ok) return { addons: [] };
      return r.json();
    },
    staleTime: 30_000,
  });

  const cancelAddon = async (userAddonId: number) => {
    if (!confirm("Are you sure you want to cancel this addon?")) return;
    await fetch(`/api/addons/mine/${userAddonId}`, { method: "DELETE", headers: AUTH() });
    refetchMyAddons();
    qc.invalidateQueries({ queryKey: ["billing", "status"] });
  };

  const availableAddons = addonsData?.addons ?? [];
  const myAddons = myAddonsData?.addons ?? [];

  const pointPrice = parseFloat(siteInfo?.settings?.points_price_per_unit || "2") || 2;
  const creditsTotal = billing?.usage.credits.total ?? 0;

  const handleUpgradeClick = (plan: Plan) => {
    setSelectedPlan(plan);
    setUpgradeModalOpen(true);
  };

  const handleLoadPoints = () => {
    setSelectedPlan({
      id: 0,
      name: `points_${customPoints}`,
      slug: `points_${customPoints}`,
      price_monthly: customPoints * pointPrice,
      price_yearly: 0,
      monthly_credits: 0, max_sites: 0,
      has_telegram_bot: false, has_blog_automation: false, has_image_generator: false,
      has_api_access: false, has_overlay_upload: false, has_custom_watermark: false,
      is_active: true, sort_order: 0,
    } as any);
    setPointsForPurchase(customPoints);
    setUpgradeModalOpen(true);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  if (billingLoading) {
    return (
      <div className="p-8 space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 rounded-2xl bg-white/[0.03] animate-pulse" />
        ))}
      </div>
    );
  }

  const currentPlanSlug = billing?.plan?.name ?? "free";
  const sub = billing?.subscription;
  const { monthly, purchased, total } = billing 
    ? getUserCredits({ ...billing.plan, ...billing.usage, ...billing.usage?.credits }) 
    : { monthly: 0, purchased: 0, total: 0 };

  return (
    <div className="p-8 space-y-10 max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* Header */}
      <div>
        <h1 className="text-4xl font-black text-white tracking-tighter">Billing & Plans</h1>
        <div className="flex items-center gap-2 mt-2">
          <div className="h-1 w-12 bg-orange-500 rounded-full" />
          <p className="text-sm text-zinc-500">Manage your subscription and usage</p>
        </div>
      </div>

      {/* Current Plan + Points Wallet */}
      {billing && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Plan Card */}
          <div className="lg:col-span-2 rounded-2xl border border-white/5 bg-white/[0.02] p-8 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest mb-2">Current Plan</p>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-black text-white tracking-tight">{billing.plan?.displayName ?? "Free"}</h2>
                  {sub && <StatusBadge status={sub.status} />}
                </div>
              </div>
              <div className="text-right">
                <div className="grid grid-cols-3 gap-4">
                  <Card className="border-orange-500/20 bg-orange-500/5">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Monthly Plan</CardTitle>
                      <Calendar className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{monthly}</div>
                      <p className="text-[10px] text-muted-foreground mt-1">credits remaining</p>
                    </CardContent>
                  </Card>

                  <Card className="border-amber-500/20 bg-amber-500/5">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Purchased</CardTitle>
                      <Coins className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{purchased}</div>
                      <p className="text-[10px] text-muted-foreground mt-1">never expire</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-xs font-semibold uppercase tracking-wider text-primary">Total Balance</CardTitle>
                      <Zap className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-primary">{total}</div>
                      <p className="text-[10px] text-primary/60 mt-1">available now</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>

            {/* Period */}
            {sub && (
              <div className="flex items-center gap-4 p-4 bg-white/[0.02] rounded-xl border border-white/5">
                <Calendar className="w-4 h-4 text-zinc-500 shrink-0" />
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Billing Period</p>
                  <p className="text-sm text-white font-medium mt-0.5">
                    {formatDate(sub.currentPeriodStart)} →{" "}
                    <span className="text-orange-400">{formatDate(sub.currentPeriodEnd)}</span>
                  </p>
                </div>
              </div>
            )}

            {/* Usage Bars */}
            <div className="space-y-6">
              <LimitBar
                label="Daily Operations"
                used={billing.usage.credits.daily_usage}
                max={billing.usage.credits.daily_limit}
                percentage={billing.usage.credits.daily_limit > 0 ? Math.round((billing.usage.credits.daily_usage / billing.usage.credits.daily_limit) * 100) : 0}
                icon={Zap} color="text-amber-400"
              />

          {/* BYOK Key Management */}
          {billing?.plan?.plan_mode === "byok" && (
            <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6 mb-8 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                    🔑 OpenRouter API Key
                  </h3>
                  <p className="text-xs text-zinc-500">Required for AI generation on your plan</p>
                </div>
                <Badge variant={billing?.has_openrouter_key ? "default" : "destructive"} className="h-6 font-bold uppercase tracking-widest text-[9px]">
                  {billing?.has_openrouter_key ? "Connected" : "Missing Key"}
                </Badge>
              </div>

              {billing?.has_openrouter_key ? (
                <div className="flex items-center justify-between p-4 rounded-xl bg-black/40 border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center border border-green-500/20">
                      <ShieldCheck className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Active Connection</p>
                      <p className="text-[10px] text-zinc-500 font-mono">
                        Key Hint: <span className="text-zinc-300">...{(billing as any).openrouter_key_hint || "sk-or-..."}</span>
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setShowKeyModal(true)}
                    variant="ghost"
                    className="h-9 px-4 rounded-lg text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/5"
                  >
                    Update Key
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 rounded-xl bg-orange-500/5 border border-orange-500/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                      <Zap className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Setup Required</p>
                      <p className="text-[10px] text-zinc-500">Connect your OpenRouter key to start generating</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setShowKeyModal(true)}
                    className="h-9 px-4 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold uppercase tracking-wider"
                  >
                    Connect Key
                  </Button>
                </div>
              )}
            </div>
          )}

          {showKeyModal && (
            <OpenRouterKeyModal
              open={showKeyModal}
              onClose={() => setShowKeyModal(false)}
              onSuccess={() => {
                setShowKeyModal(false);
                refetch();
              }}
              currentHint={(billing as any).openrouter_key_hint}
            />
          )}

          {/* Usage Stats (Monthly Credits) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Plan Monthly Credits */}
                <div className="space-y-3 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-orange-400" />
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Plan Monthly Credits</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-black text-white font-mono">
                        {monthly} / {(billing.plan as any)?.monthly_credits ?? 0}
                      </span>
                      <span className="text-[10px] text-zinc-600 font-bold uppercase">remaining</span>
                    </div>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-700"
                      style={{ width: `${(billing.plan as any)?.monthly_credits ? Math.min(100, Math.round((monthly / (billing.plan as any).monthly_credits) * 100)) : 0}%` }}
                    />
                  </div>
                  {billing.usage.credits.reset_date && (
                    <p className="text-[10px] text-zinc-500 font-medium">
                      Resets on: <span className="text-zinc-400">{formatDate(billing.usage.credits.reset_date)}</span>
                    </p>
                  )}
                </div>

                {/* 2. Purchased Credits */}
                <div className="space-y-3 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Purchased Credits</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-black text-white font-mono">{purchased}</span>
                      <span className="text-[10px] text-zinc-600 font-bold uppercase">available</span>
                    </div>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full" />
                  <p className="text-[10px] text-zinc-500 font-medium italic">These do not expire</p>
                </div>
              </div>

              {/* Consumption Order Tip */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                <HelpCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-[10px] text-zinc-400 leading-relaxed">
                  <span className="font-bold text-blue-400 uppercase tracking-tighter mr-1">Usage Rule:</span>
                  Credits are consumed in this order: <span className="text-zinc-300 font-bold">1. Monthly credits</span>, then <span className="text-zinc-300 font-bold">2. Purchased credits</span>. 
                  Purchased credits can be used for all services but do not unlock features exclusive to higher plans.
                </div>
              </div>

              <LimitBar
                label={
                  (billing.effective && billing.plan &&
                  billing.effective.max_sites > billing.plan.max_sites)
                    ? "Sites (boosted by Add-on)"
                    : "Sites"
                }
                used={billing.usage.sites.used}
                max={billing.usage.sites.max}
                percentage={billing.usage.sites.percentage}
                icon={Globe} color="text-blue-400"
              />
            </div>
          </div>

          {/* ── Points Wallet — Fuel Reservoir ── */}
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-8 flex flex-col">
            <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest mb-6 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> Fuel Reservoir
            </p>

            <div className="flex-1 flex flex-col items-center justify-center gap-2 my-4">
              <span className="text-6xl font-black text-white font-mono tracking-tighter">{billing.usage.credits.total}</span>
              <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-widest">Total Available Credits</span>
            </div>

            {/* Quick presets */}
            <div className="space-y-2 mb-4">
              <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-2">Quick Load</p>
              <div className="grid grid-cols-3 gap-1.5">
                {[10, 50, 200].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setCustomPoints(amt)}
                    className={cn(
                      "p-2 rounded-lg border text-left transition-all group text-center",
                      customPoints === amt
                        ? "border-amber-500/60 bg-amber-500/10"
                        : "bg-white/5 border-white/5 hover:border-amber-500/30"
                    )}
                  >
                    <p className={cn("text-xs font-black", customPoints === amt ? "text-amber-400" : "text-white group-hover:text-amber-400")}>
                      {amt} PT
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom input */}
            <div className="space-y-2 mb-4">
              <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                Custom Amount (min 10 PT)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={10}
                  step={5}
                  value={customPoints}
                  onChange={(e) => setCustomPoints(Math.max(10, parseInt(e.target.value) || 10))}
                  className="flex-1 h-11 bg-black/60 border border-white/10 rounded-xl px-3 text-sm font-mono text-amber-400 font-black focus:outline-none focus:border-amber-500/50"
                />
                <div className="h-11 px-3 flex items-center justify-center bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <span className="text-xs font-black text-amber-400 font-mono">{customPoints * pointPrice} MAD</span>
                </div>
              </div>
              <button
                onClick={handleLoadPoints}
                disabled={myRequests.some(r => r.type === "points_purchase" && r.status === "pending")}
                className="w-full h-11 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                {myRequests.some(r => r.type === "points_purchase" && r.status === "pending") ? (
                  <Clock className="w-3.5 h-3.5" />
                ) : (
                  <Zap className="w-3.5 h-3.5" />
                )}
                {myRequests.some(r => r.type === "points_purchase" && r.status === "pending") 
                  ? "Credits request pending..." 
                  : `Load ${customPoints} PT — ${customPoints * pointPrice} MAD`}
              </button>
            </div>

            <div className="space-y-3 mt-auto pt-4 border-t border-white/5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Rate</span>
                <span className="text-xs text-zinc-300 font-mono font-bold">{pointPrice} MAD / PT</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Credit Balance</span>
                <span className="text-xs text-zinc-300 font-mono font-bold">{billing.usage.credits.total} CR</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plans Grid */}
      <div>
        <div className="flex items-center gap-4 mb-6">
          <TrendingUp className="w-4 h-4 text-zinc-500" />
          <h2 className="text-lg font-bold text-white tracking-tight">Available Plans</h2>
        </div>
        {plansLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-72 rounded-2xl bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {[...(plansData?.plans ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                currentPlanSlug={currentPlanSlug}
                onUpgrade={handleUpgradeClick}
                pendingRequest={myRequests.find(r => r.planId === plan.id && r.status === "pending")}
                rejectedRequest={myRequests.find(r => r.planId === plan.id && r.status === "rejected")}
              />
            ))}
          </div>
        )}
      </div>

      {/* Trial Warning */}
      {sub?.status === "trialing" && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 flex items-start gap-4">
          <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-400">Trial Period Active</p>
            <p className="text-xs text-zinc-400 mt-1">
              Your trial expires on{" "}
              <span className="text-amber-400 font-bold">
                {sub.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : "—"}
              </span>
              . Upgrade to keep all features.
            </p>
          </div>
          <button
            onClick={() => {
              const upgradePlan = plansData?.plans.find(p => p.price_monthly > 0);
              if (upgradePlan) handleUpgradeClick(upgradePlan);
            }}
            className="ml-auto shrink-0 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[11px] font-black uppercase tracking-widest hover:bg-amber-500/30 transition-all flex items-center gap-1.5"
          >
            Upgrade <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Add-ons ─────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-4 mb-6">
          <Puzzle className="w-4 h-4 text-zinc-500" />
          <h2 className="text-lg font-bold text-white tracking-tight">Feature Add-ons</h2>
        </div>

        {/* My Active Add-ons */}
        {myAddons.length > 0 && (
          <div className="mb-6 space-y-3">
            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-3">My Active Add-ons</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {myAddons.map(a => (
                <div key={a.id} className="flex items-center justify-between gap-3 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                      {a.type === "feature" ? <Sparkles className="w-4 h-4 text-purple-400" />
                        : a.type === "credits" ? <Coins className="w-4 h-4 text-amber-400" />
                        : <Layers className="w-4 h-4 text-blue-400" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{a.name}</p>
                      <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wide">
                        {a.is_recurring ? "Monthly" : "Lifetime"} • ${a.price}{a.is_recurring ? "/mo" : ""}
                      </p>
                      {a.expiresAt && <p className="text-[10px] text-zinc-500">Expires {new Date(a.expiresAt).toLocaleDateString()}</p>}
                    </div>
                  </div>
                  {a.is_recurring && (
                    <button
                      onClick={() => cancelAddon(a.id)}
                      className="px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 text-[10px] font-black uppercase tracking-widest hover:bg-rose-500/20 transition-all"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available Add-ons */}
        {availableAddons.length === 0 ? (
          <div className="text-center py-10 rounded-2xl border border-dashed border-white/10">
            <Package className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
            <p className="text-zinc-500 text-sm">No add-ons available</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {availableAddons.map(addon => {
              const isActive = myAddons.some(a => a.addonId === addon.id);
              const pendingReq = myRequests.find(r => r.type === "addon_purchase" && (r as any).addonId === addon.id && r.status === "pending");
              const rejectedReq = myRequests.find(r => r.type === "addon_purchase" && (r as any).addonId === addon.id && r.status === "rejected");

              const typeIcon = addon.type === "feature" ? <Sparkles className="w-4 h-4 text-purple-400" />
                : addon.type === "credits" ? <Coins className="w-4 h-4 text-amber-400" />
                : <Layers className="w-4 h-4 text-blue-400" />;
              const typeLabel = addon.type === "feature" ? "Feature Unlock"
                : addon.type === "credits" ? `+${addon.credits_amount} Credits`
                : addon.limit_key ? `+${addon.limit_value} ${addon.limit_key.replace(/_/g, " ")}` : "Limit Boost";
              return (
                <div key={addon.id} className={cn(
                  "relative rounded-2xl border p-5 flex flex-col gap-4 transition-all duration-300",
                  isActive
                    ? "border-emerald-500/40 bg-emerald-500/5 shadow-[0_0_30px_rgba(16,185,129,0.08)]"
                    : pendingReq
                    ? "border-amber-500/30 bg-amber-500/5"
                    : "border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.03]"
                )}>
                  {isActive && (
                    <div className="absolute -top-2.5 right-4 px-2.5 py-0.5 bg-emerald-500 rounded-full">
                      <span className="text-[9px] font-black text-white uppercase tracking-widest flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" /> Active
                      </span>
                    </div>
                  )}
                  {pendingReq && (
                    <div className="absolute -top-2.5 right-4 px-2.5 py-0.5 bg-amber-500 rounded-full">
                      <span className="text-[9px] font-black text-white uppercase tracking-widest flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" /> Pending
                      </span>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/5">
                      {typeIcon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-black text-white">{addon.name}</h3>
                      <p className="text-[10px] text-zinc-500 mt-0.5">{typeLabel}</p>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-white font-mono">${addon.price}</span>
                    {addon.is_recurring && <span className="text-xs text-zinc-500 font-bold">/mo</span>}
                    {!addon.is_recurring && <span className="text-xs text-zinc-500 font-bold">one-time</span>}
                  </div>
                  
                  {isActive ? (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest">Active</span>
                    </div>
                  ) : pendingReq ? (
                    <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-400 text-[11px] font-black uppercase tracking-widest">
                      <Clock className="w-3.5 h-3.5" /> Pending Review
                    </div>
                  ) : (
                    <button
                      onClick={() => { setSelectedAddon(addon); setAddonModalOpen(true); }}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white"
                    >
                      {rejectedReq ? "Try Again" : "Buy Now"} <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {rejectedReq && !pendingReq && (
                    <p className="text-[9px] text-rose-400 font-bold text-center mt-1">Rejected: {rejectedReq.adminNotes}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Comparison Table */}
      <div className="mt-12">
        <div className="flex items-center gap-4 mb-6">
          <Layers className="w-4 h-4 text-zinc-500" />
          <h2 className="text-lg font-bold text-white tracking-tight">Compare Plans</h2>
        </div>
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="p-6 text-[10px] font-black text-zinc-600 uppercase tracking-widest">Feature</th>
                {plansData?.plans.sort((a, b) => a.sort_order - b.sort_order).map(p => (
                  <th key={p.id} className="p-6 text-center">
                    <p className="text-xs font-black text-white uppercase tracking-tight">{p.name}</p>
                    <p className="text-[10px] text-zinc-500 font-mono mt-1">${p.price_monthly}/mo</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[
                { label: "Monthly Credits", key: "monthly_credits" },
                { label: "WordPress Sites", key: "max_sites" },
                { label: "Daily Capacity", key: "rate_limit_daily" },
                { label: "Blog Automation", key: "has_blog_automation", isBool: true },
                { label: "Telegram Bot", key: "has_telegram_bot", isBool: true },
                { label: "Image Generator", key: "has_image_generator", isBool: true },
                { label: "AI Image Gen", key: "has_ai_image_generation", isBool: true },
                { label: "API Access", key: "has_api_access", isBool: true },
                { label: "Custom Watermark", key: "has_custom_watermark", isBool: true },
                { label: "Priority Support", key: "has_priority_support", isBool: true },
              ].map(feat => (
                <tr key={feat.key} className="hover:bg-white/[0.01] transition-colors">
                  <td className="p-5 text-xs font-bold text-zinc-400">{feat.label}</td>
                  {plansData?.plans.sort((a, b) => a.sort_order - b.sort_order).map(p => {
                    const val = (p as any)[feat.key];
                    return (
                      <td key={p.id} className="p-5 text-center">
                        {feat.isBool ? (
                          val ? <Check className="w-4 h-4 text-emerald-500 mx-auto" /> : <XCircle className="w-4 h-4 text-zinc-800 mx-auto" />
                        ) : (
                          <span className="text-xs font-black text-white font-mono">
                            {val >= 999999 ? "∞" : val}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="mt-12 mb-12">
        <div className="flex items-center gap-4 mb-6">
          <HelpCircle className="w-4 h-4 text-zinc-500" />
          <h2 className="text-lg font-bold text-white tracking-tight">Frequently Asked Questions</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FAQItem
            q="What are monthly credits?"
            a="Monthly credits are your monthly quota for generating articles and high-quality AI images. They reset at the start of each billing cycle."
          />
          <FAQItem
            q="What happens if I run out of credits?"
            a="You can still use the basic features, or you can purchase 'Fuel Reservoir' points to top up your account instantly without changing your plan."
          />
          <FAQItem
            q="Can I cancel my subscription?"
            a="Yes, you can cancel at any time from this dashboard. You will keep your access until the end of your current billing period."
          />
          <FAQItem
            q="How do I get support?"
            a="Our support team is available via the Help Center. Pro and Business users get priority response times."
          />
        </div>
      </div>

      {/* Payment History */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setShowHistory(v => !v)}
            className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm font-bold transition-colors"
          >
            <History className="w-4 h-4 text-indigo-400" />
            Payment History
            <ChevronRight className={cn("w-4 h-4 transition-transform", showHistory && "rotate-90")} />
          </button>
          {showHistory && (
            <button
              className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
              onClick={() => qc.invalidateQueries({ queryKey: ["payments"] })}
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          )}
        </div>

        {showHistory && (
          <div className="space-y-3">
            {myRequests.length === 0 ? (
              <div className="text-center py-10 rounded-2xl border border-dashed border-white/10">
                <CreditCard className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-zinc-500 text-sm">No payment requests yet</p>
              </div>
            ) : (
              myRequests.map(req => {
                const badge = REQ_STATUS[req.status] ?? REQ_STATUS.pending;
                return (
                  <div key={req.id} className="p-4 rounded-xl border border-white/8 bg-white/[0.02]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-sm capitalize">
                            {req.type === "points_purchase" ? "Points Purchase"
                              : req.type === "addon_purchase" ? (req as any).addonName || "Add-on Purchase"
                              : "Plan Upgrade"}
                          </span>
                          {req.planName && <span className="text-xs text-zinc-500">→ {req.planName}</span>}
                          {req.pointsAmount && <span className="text-xs text-amber-400 font-bold">{req.pointsAmount} PT</span>}
                          {(req as any).addonPrice && <span className="text-xs text-zinc-500">— ${(req as any).addonPrice}</span>}
                          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-widest", badge.cls)}>
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">via {req.paymentMethod}</p>
                        <p className="text-xs text-zinc-600">{new Date(req.createdAt).toLocaleString()}</p>
                        {req.adminNotes && (
                          <p className="text-xs text-amber-400 mt-1.5 flex items-start gap-1">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {req.adminNotes}
                          </p>
                        )}
                      </div>
                      <span className="text-xl">
                        {req.status === "approved" ? "✅" : req.status === "rejected" ? "❌" : "⏳"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Addon Purchase Modal */}
      {selectedAddon && (
        <AddonPurchaseModal
          addon={selectedAddon}
          open={addonModalOpen}
          onClose={() => { setAddonModalOpen(false); setSelectedAddon(null); }}
          onSuccess={() => {
            refetchMyAddons();
            qc.invalidateQueries({ queryKey: ["payments", "my-requests"] });
          }}
        />
      )}

      {/* Upgrade Modal */}
      {selectedPlan && (
        <UpgradeModal
          open={upgradeModalOpen}
          onOpenChange={(open) => {
            setUpgradeModalOpen(open);
          }}
          planId={selectedPlan.id}
          planName={(selectedPlan as any).displayName ?? selectedPlan.name}
          price={selectedPlan.price_monthly}
          type={selectedPlan.name.startsWith("points_") ? "points_purchase" : "plan_upgrade"}
          pointsAmount={selectedPlan.name.startsWith("points_") ? pointsForPurchase : undefined}
          hasPendingRequest={myRequests.some(r => r.planId === selectedPlan.id && r.status === "pending")}
          lastRejected={myRequests.find(r => r.planId === selectedPlan.id && r.status === "rejected") ?? null}
        />
      )}
    </div>
  );
}
