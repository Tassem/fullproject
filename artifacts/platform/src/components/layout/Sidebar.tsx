import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, History, Layers,
  KeySquare, LogOut, Bot, CreditCard, PenTool,
  Globe, FileText, GitBranch, ScrollText, ShieldCheck, Rss, Zap,
} from "lucide-react";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";

const PLAN_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  free:    { label: "Free",       color: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.15)" },
  starter: { label: "Starter",    color: "#38bdf8", bg: "rgba(56,189,248,0.08)",  border: "rgba(56,189,248,0.2)" },
  pro:     { label: "Pro",        color: "#a78bfa", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.2)" },
  agency:  { label: "Agency",     color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.2)" },
};

const MAIN_NAV = [
  { name: "Dashboard",       href: "/dashboard",        icon: LayoutDashboard },
  { name: "Card History",    href: "/history",          icon: History         },
  { name: "Templates",       href: "/templates",        icon: Layers          },
  { name: "Template Builder",href: "/template-builder", icon: PenTool         },
  { name: "Points",          href: "/points",           icon: Zap             },
  { name: "API Keys",        href: "/keys",             icon: KeySquare       },
  { name: "Telegram Bot",    href: "/telegram",         icon: Bot             },
  { name: "My Plan",         href: "/billing",          icon: CreditCard      },
];

const BLOG_NAV = [
  { name: "Sites",      href: "/sites",       icon: Globe      },
  { name: "Articles",   href: "/articles",    icon: FileText   },
  { name: "RSS Feeds",  href: "/rss-feeds",   icon: Rss        },
  { name: "Pipeline",   href: "/pipeline",    icon: GitBranch  },
  { name: "Logs",       href: "/logs",        icon: ScrollText },
];

function NavItem({ href, icon: Icon, name, activeColor = "#7c3aed", activeBg = "rgba(124,58,237,0.15)", activeBorder = "rgba(124,58,237,0.3)" }: {
  href: string; icon: React.ElementType; name: string;
  activeColor?: string; activeBg?: string; activeBorder?: string;
}) {
  const [location] = useLocation();
  const isActive = location === href || (href !== "/" && location.startsWith(href));
  return (
    <Link href={href}>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "9px 12px", borderRadius: 10,
          cursor: "pointer", transition: "all 0.15s",
          background: isActive ? activeBg : "transparent",
          border: isActive ? `1px solid ${activeBorder}` : "1px solid transparent",
          color: isActive ? activeColor : "rgba(255,255,255,0.5)",
          position: "relative",
        }}
        onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.8)"; } }}
        onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; } }}
      >
        {isActive && (
          <div style={{
            position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
            width: 3, height: 18, borderRadius: "0 2px 2px 0", background: activeColor,
          }} />
        )}
        <Icon size={15} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 13.5, fontWeight: isActive ? 600 : 400 }}>{name}</span>
      </div>
    </Link>
  );
}

export function Sidebar() {
  const [location, setLocation] = useLocation();
  const { data: user } = useGetMe({
    query: {
      enabled: !!localStorage.getItem("pro_token"),
      queryKey: getGetMeQueryKey(),
      staleTime: 0,
      refetchOnWindowFocus: true,
    },
  });
  const creditsTotal = typeof user?.credits === "object" && user?.credits !== null
    ? ((user.credits as any)?.total ?? 0)
    : null;

  const handleLogout = () => {
    localStorage.removeItem("pro_token");
    setLocation("/login");
  };

  const isAdmin  = user?.isAdmin;
  const canBot   = isAdmin || user?.planDetails?.has_telegram_bot === true;
  const canApi   = isAdmin || user?.planDetails?.has_api_access === true;
  const plan     = user?.plan ?? "free";
  const planInfo = PLAN_LABELS[plan] ?? PLAN_LABELS.free;
  const isInAdmin = location.startsWith("/blog-admin") || location.startsWith("/admin");

  return (
    <div style={{
      width: 248, minWidth: 248, height: "100vh",
      display: "flex", flexDirection: "column",
      background: "linear-gradient(180deg, #0a0618 0%, #070612 100%)",
      borderRight: "1px solid rgba(255,255,255,0.06)",
      position: "relative", overflow: "hidden",
    }} dir="ltr">

      {/* Background glow */}
      <div style={{
        position: "absolute", top: -80, left: -80,
        width: 240, height: 240,
        background: "radial-gradient(ellipse, rgba(124,58,237,0.15) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: -60, right: -60,
        width: 180, height: 180,
        background: "radial-gradient(ellipse, rgba(6,182,212,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Logo */}
      <div style={{
        padding: "0 18px", height: 64,
        display: "flex", alignItems: "center",
        borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{
            width: 36, height: 36,
            background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
            borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: 16, color: "#fff",
            boxShadow: "0 0 20px rgba(124,58,237,0.45), 0 0 40px rgba(124,58,237,0.15)",
          }}>N</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#fff", lineHeight: 1.2, letterSpacing: "-0.02em" }}>NewsCard</div>
            <div style={{ fontSize: 10, color: "rgba(167,139,250,0.7)", fontFamily: "monospace", letterSpacing: "0.08em" }}>Pro · MediaFlow</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "10px 8px" }}>
        {/* Main section */}
        <div style={{ marginBottom: 4 }}>
          {MAIN_NAV.map(item => {
            if (item.href === "/telegram" && !canBot) return null;
            if (item.href === "/keys" && !canApi) return null;
            return <NavItem key={item.href} {...item} />;
          })}
        </div>

        {/* Blog Automation divider */}
        <div style={{ margin: "8px 4px" }}>
          <div style={{ height: 1, background: "rgba(255,255,255,0.04)", marginBottom: 8 }} />
          <div style={{ fontSize: 9, color: "rgba(251,146,60,0.5)", fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", padding: "2px 12px 6px" }}>
            Blog Automation
          </div>
          {BLOG_NAV.map(item => (
            <NavItem key={item.href} {...item} activeColor="#f97316" activeBg="rgba(249,115,22,0.12)" activeBorder="rgba(249,115,22,0.25)" />
          ))}
        </div>

        {/* Admin link */}
        {isAdmin && (
          <div style={{ margin: "8px 4px" }}>
            <div style={{ height: 1, background: "rgba(255,255,255,0.04)", marginBottom: 8 }} />
            <Link href="/blog-admin">
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 12,
                cursor: "pointer", transition: "all 0.15s",
                background: isInAdmin
                  ? "linear-gradient(135deg, rgba(124,58,237,0.25) 0%, rgba(79,70,229,0.15) 100%)"
                  : "rgba(124,58,237,0.05)",
                border: isInAdmin
                  ? "1px solid rgba(124,58,237,0.4)"
                  : "1px solid rgba(124,58,237,0.15)",
                color: isInAdmin ? "#c4b5fd" : "rgba(167,139,250,0.55)",
                boxShadow: isInAdmin ? "0 0 16px rgba(124,58,237,0.15)" : "none",
              }}
                onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(79,70,229,0.12))"; e.currentTarget.style.color = "#c4b5fd"; }}
                onMouseLeave={e => { e.currentTarget.style.background = isInAdmin ? "linear-gradient(135deg, rgba(124,58,237,0.25) 0%, rgba(79,70,229,0.15) 100%)" : "rgba(124,58,237,0.05)"; e.currentTarget.style.color = isInAdmin ? "#c4b5fd" : "rgba(167,139,250,0.55)"; }}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                  background: isInAdmin ? "linear-gradient(135deg, #7c3aed, #4f46e5)" : "rgba(124,58,237,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <ShieldCheck size={13} style={{ color: isInAdmin ? "#fff" : "#a78bfa" }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>Admin Panel</div>
                  <div style={{ fontSize: 9, opacity: 0.6, fontFamily: "monospace" }}>Control Center</div>
                </div>
              </div>
            </Link>
          </div>
        )}
      </nav>

      {/* Credits strip */}
      {creditsTotal !== null && (
        <Link href="/points">
          <div style={{
            margin: "0 8px 6px",
            background: "linear-gradient(135deg, rgba(124,58,237,0.12), rgba(99,102,241,0.06))",
            border: "1px solid rgba(124,58,237,0.25)",
            borderRadius: 10, padding: "8px 12px",
            display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
          }}>
            <Zap size={14} style={{ color: "#a78bfa", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: "rgba(167,139,250,0.6)", fontWeight: 700, letterSpacing: "0.05em" }}>CREDITS</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#a78bfa", lineHeight: 1.2 }}>{creditsTotal.toLocaleString()} CR</div>
            </div>
          </div>
        </Link>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "0 14px" }} />

      {/* User footer */}
      <div style={{ padding: "12px 14px", flexShrink: 0 }}>
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 12, padding: "11px 13px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
            <div style={{
              width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg, #7c3aed, #06b6d4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 14, color: "#fff",
              boxShadow: "0 0 12px rgba(124,58,237,0.3)",
            }}>
              {(user?.name ?? "U")[0].toUpperCase()}
            </div>
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user?.name ?? "User"}
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
                color: planInfo.color, background: planInfo.bg,
                border: `1px solid ${planInfo.border}`,
                padding: "1px 8px", borderRadius: 999, display: "inline-block", marginTop: 1,
              }}>
                {planInfo.label}
              </span>
            </div>
          </div>

          <button onClick={handleLogout} style={{
            background: "transparent", border: "none",
            color: "rgba(255,255,255,0.3)", cursor: "pointer",
            padding: 6, borderRadius: 8, transition: "all 0.15s",
            display: "flex", alignItems: "center", flexShrink: 0,
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.color = "#f87171"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.3)"; }}
            title="Log out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
