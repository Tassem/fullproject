import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard, Zap, Globe, FileText, TrendingUp,
  Calendar, ChevronRight, Star, Check, Clock, ArrowUpRight,
  History, AlertCircle, RefreshCw, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UpgradeModal } from "@/components/SaaS/UpgradeModal";

const AUTH = () => ({ Authorization: `Bearer ${localStorage.getItem("pro_token")}` });

// ─── Types ────────────────────────────────────────────────────────────────────

interface BillingStatus {
  plan: {
    id: number; name: string; displayName: string;
    priceMonthly: number; priceYearly: number;
    cardsPerDay: number; maxSites: number; articlesPerMonth: number;
    hasTelegramBot: boolean; hasBlogAutomation: boolean;
    hasImageGenerator: boolean; apiAccess: boolean;
    overlayUpload: boolean; customWatermark: boolean;
  };
  subscription: {
    id: number; status: string;
    currentPeriodStart: string; currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  } | null;
  usage: {
    articles: { used: number; max: number; unlimited: boolean; percentage: number };
    sites:    { used: number; max: number; unlimited: boolean; percentage: number };
    cards:    { used: number; max: number; unlimited: boolean; percentage: number };
    credits:  { balance: number; points: number };
  };
}

interface Plan {
  id: number; name: string; slug: string;
  priceMonthly: number; priceYearly: number;
  cardsPerDay: number; maxSites: number; articlesPerMonth: number;
  hasTelegramBot: boolean; hasBlogAutomation: boolean;
  hasImageGenerator: boolean; apiAccess: boolean;
  overlayUpload: boolean; customWatermark: boolean;
  credits: number; isActive: boolean; sortOrder: number;
}

interface PaymentRequest {
  id: number; type: string;
  planId: number | null; planName: string | null;
  pointsAmount: number | null; paymentMethod: string;
  proofDetails: string; status: string; adminNotes: string | null;
  createdAt: string;
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

function LimitBar({ label, used, max, unlimited, percentage, icon: Icon, color }: {
  label: string; used: number; max: number;
  unlimited: boolean; percentage: number;
  icon: React.ElementType; color: string;
}) {
  const isWarning = !unlimited && percentage >= 80;
  const isDanger  = !unlimited && percentage >= 95;
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
          <span className="text-xs text-zinc-600 font-mono">{unlimited ? "/ ∞" : `/ ${max}`}</span>
        </div>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        {unlimited ? (
          <div className="h-full bg-gradient-to-r from-emerald-500/50 to-emerald-400/20 rounded-full animate-pulse w-full" />
        ) : (
          <div
            className={cn("h-full rounded-full transition-all duration-700",
              isDanger ? "bg-gradient-to-r from-rose-600 to-rose-400"
              : isWarning ? "bg-gradient-to-r from-amber-600 to-amber-400"
              : "bg-gradient-to-r from-orange-600 to-orange-400")}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        )}
      </div>
      {!unlimited && (
        <p className="text-[10px] text-zinc-600 font-medium">{Math.max(0, max - used)} remaining</p>
      )}
    </div>
  );
}

function PlanCard({ plan, currentPlanSlug, onUpgrade }: {
  plan: Plan; currentPlanSlug: string; onUpgrade: (plan: Plan) => void;
}) {
  const isCurrent = plan.slug === currentPlanSlug;
  const isPopular = plan.slug === "pro";
  const features: string[] = [
    plan.cardsPerDay >= 999 ? "Unlimited cards/day" : plan.cardsPerDay > 0 ? `${plan.cardsPerDay} cards/day` : "",
    plan.articlesPerMonth >= 999 ? "Unlimited articles/mo" : plan.articlesPerMonth > 0 ? `${plan.articlesPerMonth} articles/mo` : "",
    plan.hasBlogAutomation ? "Blog Automation" : "",
    plan.hasTelegramBot    ? "Telegram Bot"    : "",
    plan.hasImageGenerator ? "Image Generator" : "",
    plan.apiAccess         ? "API Access"      : "",
    plan.overlayUpload     ? "Overlay Upload"  : "",
    plan.customWatermark   ? "Custom Watermark": "",
    plan.credits > 0       ? `${plan.credits} credits` : "",
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
          {plan.priceMonthly === 0 ? "Free" : `${plan.priceMonthly}`}
        </span>
        {plan.priceMonthly > 0 && (
          <span className="text-xs text-zinc-500 font-bold">MAD/mo</span>
        )}
      </div>
      <div className="space-y-2 text-[11px] text-zinc-400 flex-1">
        <div className="flex items-center gap-2">
          <Globe className="w-3 h-3 text-orange-400" />
          <span>{plan.maxSites === 0 || plan.maxSites >= 999 ? "Unlimited" : plan.maxSites} site{plan.maxSites !== 1 ? "s" : ""}</span>
        </div>
        {features.map((f) => (
          <div key={f} className="flex items-center gap-2">
            <Check className="w-3 h-3 text-emerald-400" />
            <span>{f}</span>
          </div>
        ))}
      </div>
      {!isCurrent && (
        <button
          onClick={() => onUpgrade(plan)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 bg-orange-600 hover:bg-orange-700 border border-orange-500/50 text-white"
        >
          Select Plan <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

const REQ_STATUS: Record<string, { label: string; cls: string }> = {
  pending:  { label: "Pending Review", cls: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  approved: { label: "Approved",       cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  rejected: { label: "Rejected",       cls: "text-rose-400 bg-rose-500/10 border-rose-500/20" },
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Billing() {
  const qc = useQueryClient();
  const [selectedPlan, setSelectedPlan]       = useState<Plan | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [customPoints, setCustomPoints]         = useState(50);
  const [pointsForPurchase, setPointsForPurchase] = useState(50);
  const [showHistory, setShowHistory]           = useState(false);

  const { data: billing, isLoading: billingLoading } = useQuery<BillingStatus>({
    queryKey: ["billing", "status"],
    queryFn: async () => {
      const r = await fetch("/api/billing/status", { headers: AUTH() });
      if (!r.ok) throw new Error("Failed to fetch billing status");
      return r.json();
    },
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
    enabled: showHistory,
  });

  const pointPrice = parseFloat(siteInfo?.settings?.points_price_per_unit || "2") || 2;
  const pointsBalance = billing?.usage.credits.points ?? 0;

  const handleUpgradeClick = (plan: Plan) => {
    setSelectedPlan(plan);
    setUpgradeModalOpen(true);
  };

  const handleLoadPoints = () => {
    setSelectedPlan({
      id: 0,
      name: `points_${customPoints}`,
      slug: `points_${customPoints}`,
      displayName: `${customPoints} PT Package`,
      priceMonthly: customPoints * pointPrice,
      priceYearly: 0,
      cardsPerDay: 0, maxSites: 0, articlesPerMonth: 0,
      hasTelegramBot: false, hasBlogAutomation: false, hasImageGenerator: false,
      apiAccess: false, overlayUpload: false, customWatermark: false,
      credits: 0, isActive: true, sortOrder: 0,
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

  const currentPlanSlug = billing?.plan.name ?? "free";
  const sub = billing?.subscription;

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
                  <h2 className="text-2xl font-black text-white tracking-tight">{billing.plan.displayName}</h2>
                  {sub && <StatusBadge status={sub.status} />}
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-white font-mono">
                  {billing.plan.priceMonthly === 0 ? "Free" : `${billing.plan.priceMonthly}`}
                </p>
                {billing.plan.priceMonthly > 0 && <p className="text-xs text-zinc-500">MAD/month</p>}
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
            <div className="space-y-5">
              <LimitBar
                label="Cards Today"
                used={billing.usage.cards.used}
                max={billing.usage.cards.max}
                unlimited={billing.usage.cards.unlimited}
                percentage={billing.usage.cards.percentage}
                icon={Zap} color="text-amber-400"
              />
              <LimitBar
                label="Articles this month"
                used={billing.usage.articles.used}
                max={billing.usage.articles.max}
                unlimited={billing.usage.articles.unlimited}
                percentage={billing.usage.articles.percentage}
                icon={FileText} color="text-orange-400"
              />
              <LimitBar
                label="Sites"
                used={billing.usage.sites.used}
                max={billing.usage.sites.max}
                unlimited={billing.usage.sites.unlimited}
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
              <span className="text-6xl font-black text-white font-mono tracking-tighter">{pointsBalance}</span>
              <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-widest">points available</span>
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
                className="w-full h-11 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                <Zap className="w-3.5 h-3.5" />
                Load {customPoints} PT — {customPoints * pointPrice} MAD
              </button>
            </div>

            <div className="space-y-3 mt-auto pt-4 border-t border-white/5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Rate</span>
                <span className="text-xs text-zinc-300 font-mono font-bold">{pointPrice} MAD / PT</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Credit Balance</span>
                <span className="text-xs text-zinc-300 font-mono font-bold">{billing.usage.credits.balance} CR</span>
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
            {[...(plansData?.plans ?? [])].sort((a, b) => a.sortOrder - b.sortOrder).map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                currentPlanSlug={currentPlanSlug}
                onUpgrade={handleUpgradeClick}
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
              const upgradePlan = plansData?.plans.find(p => p.priceMonthly > 0);
              if (upgradePlan) handleUpgradeClick(upgradePlan);
            }}
            className="ml-auto shrink-0 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[11px] font-black uppercase tracking-widest hover:bg-amber-500/30 transition-all flex items-center gap-1.5"
          >
            Upgrade <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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
                            {req.type === "points_purchase" ? "Points Purchase" : "Plan Upgrade"}
                          </span>
                          {req.planName && <span className="text-xs text-zinc-500">→ {req.planName}</span>}
                          {req.pointsAmount && <span className="text-xs text-amber-400 font-bold">{req.pointsAmount} PT</span>}
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

      {/* Upgrade Modal */}
      {selectedPlan && (
        <UpgradeModal
          open={upgradeModalOpen}
          onOpenChange={setUpgradeModalOpen}
          planId={selectedPlan.id}
          planName={(selectedPlan as any).displayName ?? selectedPlan.name}
          price={selectedPlan.priceMonthly}
          type={selectedPlan.name.startsWith("points_") ? "points_purchase" : "plan_upgrade"}
          pointsAmount={selectedPlan.name.startsWith("points_") ? pointsForPurchase : undefined}
        />
      )}
    </div>
  );
}
