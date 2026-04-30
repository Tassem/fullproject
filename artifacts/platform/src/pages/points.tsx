import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Zap, TrendingDown, TrendingUp, Clock, Package, Image, RefreshCw, ShoppingCart } from "lucide-react";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { getUserCredits } from "@/lib/creditUtils";


interface Transaction {
  id: number;
  type: string;
  amount: number;
  description: string | null;
  service: string | null;
  createdAt: string;
}

interface PointsData {
  monthly_credits: number;
  purchased_credits: number;
  balance: number;
  reset_date: string | null;
  daily_usage: number;
  daily_limit: number;
  transactions: Transaction[];
  rates: { card: number; article: number };
  plan_monthly_allocation: number;
}

function txIcon(type: string, service: string | null): React.ReactNode {
  if (type === "earn") return <TrendingUp size={14} />;
  if (service === "image_generator") return <Image size={14} />;
  return <TrendingDown size={14} />;
}

function txColor(type: string) {
  return type === "earn" ? "#34d399" : "#f87171";
}

function txBg(type: string) {
  return type === "earn" ? "rgba(52,211,153,0.08)" : "rgba(239,68,68,0.08)";
}

function serviceLabel(service: string | null) {
  const map: Record<string, string> = {
    image_generator: "News Card Generator",
    blog_automation: "Blog Automation",
    subscription: "Subscription",
    admin: "Admin",
    system: "System",
  };
  return service ? (map[service] ?? service) : "";
}

function formatDate(d: string) {
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatResetDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function PointsPage() {
  const { data: user } = useGetMe({
    query: { enabled: !!localStorage.getItem("pro_token"), queryKey: getGetMeQueryKey(), staleTime: 0 },
  });
  const [data, setData] = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("pro_token");
    if (!token) return;
    fetch("/api/points", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false));
  }, []);

  const { monthly, purchased, total } = getUserCredits(data);

  const earned = (data?.transactions ?? []).filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const spent = (data?.transactions ?? []).filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const dailyUsed = data?.daily_usage ?? 0;
  const dailyLimit = data?.daily_limit ?? 50;
  const dailyPct = dailyLimit > 0 ? Math.min(100, Math.round((dailyUsed / dailyLimit) * 100)) : 0;
  const monthlyAlloc = data?.plan_monthly_allocation ?? user?.planDetails?.monthly_credits ?? 0;
  const monthlyPct = monthlyAlloc > 0 ? Math.min(100, Math.round(((monthlyAlloc - monthly) / monthlyAlloc) * 100)) : 0;

  return (
    <div style={{ fontFamily: "'Cairo', sans-serif", direction: "ltr", padding: "32px 36px", maxWidth: 860, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 32, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: "linear-gradient(135deg, #d97706, #f59e0b)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 20px rgba(245,158,11,0.3)",
          }}>
            <Zap size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#fff" }}>Credits</h1>
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Track your balance and usage history</p>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <Link href="/billing" style={{ textDecoration: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#a78bfa", fontWeight: 700, background: "rgba(167,139,250,0.1)", padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(167,139,250,0.2)", cursor: "pointer" }}>
              <Package size={13} />
              Feature Add-ons
            </div>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
            <RefreshCw size={13} />
            Resets: {formatResetDate(data?.reset_date ?? null)}
          </div>
        </div>
      </div>

      {/* Top cards: Monthly / Purchased / Total */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
        {/* Monthly */}
        <div style={{ background: "linear-gradient(135deg, rgba(56,189,248,0.12), rgba(56,189,248,0.04))", border: "1px solid rgba(56,189,248,0.28)", borderRadius: 16, padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
            <RefreshCw size={13} color="#38bdf8" />
            <span style={{ fontSize: 11, color: "rgba(56,189,248,0.7)", fontWeight: 700, letterSpacing: "0.07em" }}>MONTHLY CREDITS</span>
          </div>
          <div style={{ fontSize: 34, fontWeight: 900, color: "#38bdf8", lineHeight: 1 }}>{monthly.toLocaleString()}</div>
          {monthlyAlloc > 0 && (
            <>
              <div style={{ marginTop: 10, height: 4, borderRadius: 4, background: "rgba(56,189,248,0.15)" }}>
                <div style={{ height: "100%", borderRadius: 4, background: "#38bdf8", width: monthlyAlloc >= 999999 ? "0%" : `${100 - monthlyPct}%`, transition: "width .3s" }} />
              </div>
              <div style={{ fontSize: 11, color: "rgba(56,189,248,0.5)", marginTop: 5 }}>
                {monthlyAlloc >= 999999 ? "Unlimited" : `${monthly} of ${monthlyAlloc}`} remaining
              </div>
            </>
          )}
        </div>

        {/* Purchased */}
        <div style={{ background: "linear-gradient(135deg, rgba(167,139,250,0.1), rgba(167,139,250,0.03))", border: "1px solid rgba(167,139,250,0.22)", borderRadius: 16, padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
            <ShoppingCart size={13} color="#a78bfa" />
            <span style={{ fontSize: 11, color: "rgba(167,139,250,0.7)", fontWeight: 700, letterSpacing: "0.07em" }}>PURCHASED</span>
          </div>
          <div style={{ fontSize: 34, fontWeight: 900, color: "#a78bfa", lineHeight: 1 }}>{purchased.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: "rgba(167,139,250,0.4)", marginTop: 8 }}>Never expires</div>
        </div>

        {/* Total */}
        <div style={{ background: "linear-gradient(135deg, rgba(217,119,6,0.15), rgba(245,158,11,0.05))", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 16, padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
            <Zap size={13} color="#fbbf24" />
            <span style={{ fontSize: 11, color: "rgba(251,191,36,0.6)", fontWeight: 700, letterSpacing: "0.07em" }}>TOTAL AVAILABLE</span>
          </div>
          <div style={{ fontSize: 34, fontWeight: 900, color: "#fbbf24", lineHeight: 1 }}>{total.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: "rgba(251,191,36,0.4)", marginTop: 8 }}>Monthly + Purchased</div>
        </div>
      </div>

      {/* Daily usage bar */}
      <div style={{
        background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14, padding: "16px 20px", marginBottom: 20,
        display: "flex", alignItems: "center", gap: 20,
      }}>
        <Clock size={16} color="rgba(255,255,255,0.4)" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>Daily Usage</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{dailyUsed} / {dailyLimit} operations</span>
          </div>
          <div style={{ height: 6, borderRadius: 6, background: "rgba(255,255,255,0.07)" }}>
            <div style={{
              height: "100%", borderRadius: 6,
              background: dailyPct > 80 ? "#f87171" : dailyPct > 60 ? "#fbbf24" : "#34d399",
              width: `${dailyPct}%`, transition: "width .3s",
            }} />
          </div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: dailyPct > 80 ? "#f87171" : "rgba(255,255,255,0.5)", flexShrink: 0 }}>{dailyPct}%</span>
      </div>

      {/* Plan info + cost rates */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
        {/* Plan allocation */}
        {monthlyAlloc > 0 && (
          <div style={{ background: "rgba(56,189,248,0.05)", border: "1px solid rgba(56,189,248,0.15)", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
            <Package size={15} style={{ color: "#38bdf8", flexShrink: 0 }} />
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
              Your <span style={{ color: "#38bdf8", fontWeight: 700, textTransform: "capitalize" }}>{user?.plan}</span> plan gives{" "}
              <span style={{ color: "#fbbf24", fontWeight: 800 }}>{monthlyAlloc}</span> credits/month
            </div>
          </div>
        )}

        {/* Burn rates */}
        <div style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.18)", borderRadius: 12, padding: "14px 18px", display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 10, color: "rgba(167,139,250,0.55)", fontWeight: 700, marginBottom: 2 }}>NEWS CARD</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#a5b4fc" }}>−{data?.rates?.card ?? 1} cr</div>
          </div>
          <div style={{ width: 1, background: "rgba(99,102,241,0.2)", alignSelf: "stretch" }} />
          <div>
            <div style={{ fontSize: 10, color: "rgba(167,139,250,0.55)", fontWeight: 700, marginBottom: 2 }}>ARTICLE</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#a5b4fc" }}>−{data?.rates?.article ?? 5} cr</div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
        <div style={{ background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.15)", borderRadius: 14, padding: "16px 20px" }}>
          <div style={{ fontSize: 11, color: "rgba(52,211,153,0.6)", fontWeight: 700, marginBottom: 8 }}>TOTAL EARNED (last 100 tx)</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#34d399" }}>+{earned.toLocaleString()}</div>
        </div>
        <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 14, padding: "16px 20px" }}>
          <div style={{ fontSize: 11, color: "rgba(248,113,113,0.6)", fontWeight: 700, marginBottom: 8 }}>TOTAL SPENT (last 100 tx)</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#f87171" }}>{spent.toLocaleString()}</div>
        </div>
      </div>

      {/* Transaction history */}
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <Clock size={15} /> Transaction History
        </h2>
        {loading ? (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", padding: "40px 0" }}>Loading...</div>
        ) : (data?.transactions ?? []).length === 0 ? (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.25)", padding: "48px 0", background: "rgba(255,255,255,0.02)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
            <Zap size={32} style={{ opacity: 0.2, marginBottom: 12 }} />
            <div>No transactions yet</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(data?.transactions ?? []).map(tx => {
              const isPositive = tx.amount > 0;
              const color = txColor(tx.type);
              const bg = txBg(tx.type);
              const svcLabel = serviceLabel(tx.service);
              return (
                <div key={tx.id} style={{
                  display: "flex", alignItems: "center", gap: 14,
                  background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12, padding: "13px 16px",
                }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: bg, display: "flex", alignItems: "center", justifyContent: "center", color }}>
                    {txIcon(tx.type, tx.service)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
                      {tx.description || (isPositive ? "Credits Earned" : "Credits Used")}
                    </div>
                    {svcLabel && (
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{svcLabel}</div>
                    )}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color }}>
                      {isPositive ? "+" : ""}{tx.amount} cr
                    </div>
                    <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{formatDate(tx.createdAt)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
