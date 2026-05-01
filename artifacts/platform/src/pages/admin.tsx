import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import { useLocation } from "wouter";

type PlanSlug = "free" | "starter" | "pro" | "business";
interface AdminUser {
  id: number; name: string; email: string; plan: PlanSlug;
  daily_usage_count: number; totalImages: number; isAdmin: boolean;
  botCode: string | null; createdAt: string;
  has_openrouter_key: boolean;
  openrouter_key_valid: boolean;
}
interface Stats {
  totalUsers: number; proUsers: number; freeUsers: number;
  totalImages: number; todayImages: number;
}
interface AdminImage {
  id: number; userId: number; title: string; imageUrl: string;
  aspectRatio: string; createdAt: string;
  userName: string | null; userEmail: string | null;
}
interface AdminPlan {
  id: number; name: string; slug: string; description: string | null;
  price_monthly: number; price_yearly: number;
  monthly_credits: number; rate_limit_daily: number;
  max_templates: number; max_saved_designs: number; max_sites: number;
  has_api_access: boolean; has_telegram_bot: boolean;
  has_overlay_upload: boolean; has_custom_watermark: boolean;
  has_blog_automation: boolean; has_image_generator: boolean;
  has_ai_image_generation: boolean;
  has_priority_support: boolean; has_priority_processing: boolean;
  is_active: boolean; is_free: boolean; sort_order: number;
  plan_mode: "platform" | "byok";
}

// ─── Design tokens ──────────────────────────────────────────────────────────
const BG        = "#05050a";
const SIDEBAR   = "#0e0e1c";
const TOPBAR    = "#0a0a16";
const SURFACE   = "rgba(255,255,255,0.04)";
const BORDER    = "rgba(255,255,255,0.07)";
const BORDER2   = "rgba(255,255,255,0.14)";
const TEXT      = "rgba(255,255,255,0.88)";
const MUTED     = "rgba(255,255,255,0.42)";
const ACCENT    = "#6366f1";
const ACCENT3   = "#8b5cf6";
const ACCENT2   = "#22d3ee";
const GREEN     = "#22c55e";
const RED       = "#ef4444";
const AMBER     = "#f59e0b";
const SIDEBAR_W = 240;

// ─── Helpers ────────────────────────────────────────────────────────────────
const PLAN_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  free:    { bg: "rgba(148,163,184,0.1)", color: "#94a3b8", border: "rgba(148,163,184,0.2)", label: "Free" },
  starter: { bg: "rgba(96,165,250,0.1)",  color: "#60a5fa", border: "rgba(96,165,250,0.2)",  label: "Starter" },
  pro:     { bg: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "rgba(167,139,250,0.2)", label: "Pro" },
  business: { bg: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "rgba(251,191,36,0.2)", label: "Business" },
};

function PlanBadge({ plan }: { plan: string }) {
  const s = PLAN_STYLE[plan] ?? PLAN_STYLE.free;
  return (
    <span style={{
      padding: "3px 12px", borderRadius: 999,
      fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>{s.label}</span>
  );
}

function StatCard({ label, value, icon, gradient }: {
  label: string; value: number; icon: string; gradient: string;
}) {
  return (
    <div style={{
      flex: 1, minWidth: 160,
      background: SURFACE, border: `1px solid ${BORDER}`,
      borderRadius: 16, padding: "20px 22px",
      backdropFilter: "blur(12px)",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, right: 0, width: 100, height: 100,
        background: gradient, pointerEvents: "none",
      }} />
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: "rgba(255,255,255,0.05)",
        border: `1px solid ${BORDER2}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20, marginBottom: 14,
      }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color: TEXT, lineHeight: 1 }}>
        {value.toLocaleString("ar-MA")}
      </div>
      <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{label}</div>
    </div>
  );
}

const getSafeHost = (url: string) => {
  try {
    if (!url || url.includes("...")) return "veoaifree.com";
    return new URL(url).hostname;
  } catch { return "veoaifree.com"; }
};

// ─── Main ──────────────────────────────────────────────────────────────────
export default function Admin() {
  const { user, token, isLoading: authLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  const [adminName, setAdminName]     = useState("");
  const [stats, setStats]             = useState<Stats | null>(null);
  const [users, setUsers]             = useState<AdminUser[]>([]);
  const [images, setImages]           = useState<AdminImage[]>([]);
  const [activeTab, setActiveTab]     = useState<"stats" | "users" | "images" | "plans" | "bot" | "whatsapp" | "templates" | "settings" | "payments">("stats");
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingId, setUpdatingId]   = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [adminPlans, setAdminPlans]   = useState<AdminPlan[]>([]);
  const [editingPlan, setEditingPlan] = useState<AdminPlan | null>(null);
  const [planSaving, setPlanSaving]   = useState(false);
  const [botStatus, setBotStatus]     = useState<{ connected: boolean; botUsername: string | null; hasToken: boolean } | null>(null);
  const [newBotToken, setNewBotToken] = useState("");
  const [botLoading, setBotLoading]   = useState(false);

  // ── WhatsApp state ──
  type WAStatus = "disconnected" | "connecting" | "qr_ready" | "connected";
  const [waStatus, setWaStatus]         = useState<WAStatus>("disconnected");
  const [waQr, setWaQr]                 = useState<string | null>(null);
  const [waPhone, setWaPhone]           = useState<string | null>(null);
  const [waLoading, setWaLoading]       = useState(false);
  const [waPollRef, setWaPollRef]       = useState<ReturnType<typeof setInterval> | null>(null);

  // ── Site Settings state ──
  interface GoogleSettings { hasClientId: boolean; clientIdMasked: string | null; source: string; }
  interface SmtpSettings { hasCredentials: boolean; host: string; port: number; user: string | null; passMasked: string | null; from: string | null; }
  const [googleSettings, setGoogleSettings] = useState<GoogleSettings | null>(null);
  const [smtpSettings,   setSmtpSettings]   = useState<SmtpSettings | null>(null);
  const [newGoogleId,    setNewGoogleId]     = useState("");
  const [smtpForm,       setSmtpForm]        = useState({ host: "", port: "587", user: "", pass: "", from: "" });
  const [settingsSaving, setSettingsSaving]  = useState<string | null>(null);
  const [settingsMsg,    setSettingsMsg]     = useState<{ key: string; type: "ok" | "err"; text: string } | null>(null);
  const [testEmailTo,    setTestEmailTo]     = useState("");
  const [aiSettings,     setAiSettings]      = useState({ enabled: true, cost: 2, baseCost: 1, blogCost: 5, signupBonus: 30, status: "operational", statusMessage: "" });
  const [providerSettings, setProviderSettings] = useState({
    provider: "nanobanana",
    fallbackEnabled: true,
    nanobanana: { pageUrl: "", ajaxUrl: "", timeoutS: 180, nonceCacheMin: 30, retryCount: 1, queueEnabled: true, maxConcurrent: 1 },
    openai: { apiKey: "", model: "dall-e-3", size: "1024x1024" }
  });
  const [nbStatus, setNbStatus] = useState<any>(null);
  const [nbTesting, setNbTesting] = useState(false);
  const [oaTesting, setOaTesting] = useState(false);
  const [settingsData, setSettingsData] = useState<Record<string, string> | null>(null);



  // ── Homepage settings state ──
  type HF = {
    siteName: string; siteLogo: string; defaultLang: string;
    heroBadge: string; heroHeadline: string; heroSubtitle: string;
    featuresTitle: string;
    f1t: string; f1d: string; f2t: string; f2d: string; f3t: string; f3d: string;
    f4t: string; f4d: string; f5t: string; f5d: string; f6t: string; f6d: string;
    s1n: string; s1l: string; s2n: string; s2l: string; s3n: string; s3l: string; s4n: string; s4l: string;
    howTitle: string; st1l: string; st1d: string; st2l: string; st2d: string; st3l: string; st3d: string;
    ctaTitle: string; ctaSubtitle: string;
    pricingTitle: string; pricingBadge: string; pricingPopular: string; pricingPeriod: string; pricingCta: string; popularSlug: string;
  };
  const EMPTY_HF: HF = {
    siteName: "", siteLogo: "", defaultLang: "ar",
    heroBadge: "", heroHeadline: "", heroSubtitle: "",
    featuresTitle: "",
    f1t: "", f1d: "", f2t: "", f2d: "", f3t: "", f3d: "",
    f4t: "", f4d: "", f5t: "", f5d: "", f6t: "", f6d: "",
    s1n: "", s1l: "", s2n: "", s2l: "", s3n: "", s3l: "", s4n: "", s4l: "",
    howTitle: "", st1l: "", st1d: "", st2l: "", st2d: "", st3l: "", st3d: "",
    ctaTitle: "", ctaSubtitle: "",
    pricingTitle: "", pricingBadge: "", pricingPopular: "", pricingPeriod: "", pricingCta: "", popularSlug: "",
  };
  const [homepageForm, setHomepageForm] = useState<HF>(EMPTY_HF);
  const [planHrefs, setPlanHrefs] = useState<Record<string, string>>({});
  const [homepageTab, setHomepageTab]   = useState<"basic"|"hero"|"features"|"stats"|"steps"|"pricing">("basic");
  const [homepageSaving, setHomepageSaving] = useState(false);
  const [homepageMsg, setHomepageMsg]     = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // ── System Templates state ──
  interface SysTmpl {
    id: number; name: string; category: string;
    bannerColor: string; bannerGradient: string | null;
    textColor: string; labelColor: string;
    photoHeight: number; font: string;
    isLight: boolean; accentColor: string | null;
    badge: string | null; badgeColor: string | null;
    isActive: boolean; aiPrompt: string | null;
    isApproved: boolean | null;
    createdAt: string;
  }
  const [sysTmpls, setSysTmpls]             = useState<SysTmpl[]>([]);
  const [tmplLoading, setTmplLoading]       = useState(false);
  const [showTmplForm, setShowTmplForm]     = useState(false);
  const [aiPromptText, setAiPromptText]     = useState("");
  const [aiLoading, setAiLoading]           = useState(false);
  const [editingTmpl, setEditingTmpl]       = useState<Partial<SysTmpl>>({});
  const [tmplMsg, setTmplMsg]               = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // ── Pending user templates (awaiting admin approval) ──
  interface PendingTmpl { id: number; name: string; userId: number; category: string; bannerColor: string; bannerGradient: string | null; textColor: string; font: string; createdAt: string; }
  const [pendingTmpls, setPendingTmpls]     = useState<PendingTmpl[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);

  // ── Payment requests state ──
  interface PayReq {
    id: number; userId: number; type: string;
    planId: number | null; pointsAmount: number | null;
    paymentMethod: string; proofDetails: string;
    status: string; adminNotes: string | null;
    createdAt: string; updatedAt: string;
    userName: string | null; userEmail: string | null; userPlan: string | null;
    planName: string | null; planSlug: string | null;
  }
  const [payReqs, setPayReqs]               = useState<PayReq[]>([]);
  const [payFilter, setPayFilter]           = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [payLoading, setPayLoading]         = useState(false);
  const [payActionId, setPayActionId]       = useState<number | null>(null);
  const [payNotes, setPayNotes]             = useState<Record<number, string>>({});
  const [payMsg, setPayMsg]                 = useState<{ type: "ok"|"err"; text: string } | null>(null);
  const [expandedProof, setExpandedProof]   = useState<number | null>(null);
  const [approvalMsg, setApprovalMsg]       = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const authHeaders = useMemo(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }), [token]);

  const loadData = useCallback(async (t: string) => {
    try {
      const [sR, uR, iR, pR] = await Promise.all([
        fetch("/api/admin/stats",  { headers: { Authorization: `Bearer ${t}` } }),
        fetch("/api/admin/users",  { headers: { Authorization: `Bearer ${t}` } }),
        fetch("/api/admin/images", { headers: { Authorization: `Bearer ${t}` } }),
        fetch("/api/admin/plans",  { headers: { Authorization: `Bearer ${t}` } }),
      ]);
      if (sR.status === 403 || sR.status === 401) {
        return;
      }
      const [s, u, i, p] = await Promise.all([sR.json(), uR.json(), iR.json(), pR.json()]);
      setStats(s);
      setUsers(Array.isArray(u) ? u : (u.users || []));
      setImages(Array.isArray(i) ? i : (i.images || []));
      if (Array.isArray(p)) setAdminPlans(p);
      const bR = await fetch("/api/settings/telegram", { headers: { Authorization: `Bearer ${t}` } });
      if (bR.ok) setBotStatus(await bR.json());
    } catch {}
  }, []);

  useEffect(() => { if (token) loadData(token); }, [token, loadData]);

  const loadSettings = useCallback(async () => {
    if (!token) return;
    const h = { Authorization: `Bearer ${token}` };
    const [gR, sR] = await Promise.all([
      fetch("/api/settings/google", { headers: h }),
      fetch("/api/settings/smtp",   { headers: h }),
    ]);
    if (gR.ok) setGoogleSettings(await gR.json());
    if (sR.ok) {
      const s = await sR.json();
      setSmtpSettings(s);
      setSmtpForm(f => ({
        ...f,
        host: s.host || "",
        port: String(s.port || "587"),
        user: s.user || "",
        pass: "",
        from: s.from || "",
      }));
    }

    const res = await fetch("/api/settings", { headers: h });
    if (res.ok) {
      const s = await res.json() as any[];
      const map = Object.fromEntries(s.map(i => [i.key, i.value]));
      setSettingsData(map);
      setAiSettings({
        enabled: map["ai_image_generation_enabled"] !== "false",
        cost: parseInt(map["ai_image_cost_per_generation"] || "2", 10),
        baseCost: parseInt(map["card_generation_base_cost"] || "1", 10),
        blogCost: parseInt(map["points_burn_per_article"] || "5", 10),
        signupBonus: parseInt(map["signup_bonus_credits"] || "30", 10),
        status: map["ai_image_service_status"] || "operational",
        statusMessage: map["ai_image_service_status_message"] || "",
      });

      // Fetch Nanobanana status
      fetch("/api/admin/nanobanana/status", { headers: h })
        .then(r => r.json())
        .then(d => setNbStatus(d))
        .catch(() => {});
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetch("/api/admin/nanobanana/status", { headers: authHeaders })
        .then(r => r.json())
        .then(setNbStatus)
        .catch(console.error);
    }
  }, [token]);

  useEffect(() => {
    if (!settingsData) return;
    setProviderSettings({
      provider: settingsData["ai_image_provider"] || "nanobanana",
      fallbackEnabled: settingsData["ai_image_fallback_enabled"] !== "false",
      nanobanana: {
        pageUrl: settingsData["nanobanana_page_url"] || "",
        ajaxUrl: settingsData["nanobanana_ajax_url"] || "",
        timeoutS: Math.round(parseInt(settingsData["nanobanana_timeout_ms"] || "180000") / 1000),
        nonceCacheMin: parseInt(settingsData["nanobanana_nonce_cache_min"] || "30"),
        retryCount: parseInt(settingsData["nanobanana_retry_count"] || "1"),
        queueEnabled: settingsData["nanobanana_queue_enabled"] !== "false",
        maxConcurrent: parseInt(settingsData["nanobanana_max_concurrent"] || "1"),
      },
      openai: {
        apiKey: settingsData["openai_api_key"] || "",
        model: settingsData["openai_image_model"] || "dall-e-3",
        size: settingsData["openai_image_size"] || "1024x1024",
      }
    });
  }, [settingsData]);

  useEffect(() => {
    if (token && activeTab === "settings") { loadSettings(); loadHomepageSettings(); }
  }, [token, activeTab, loadSettings]);

  const loadHomepageSettings = async () => {
    if (!token) return;
    const r = await fetch("/api/settings/homepage", { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) {
      const d = await r.json();
      setHomepageForm({
        siteName:     d.siteName    || "",
        siteLogo:     d.siteLogo    || "",
        defaultLang:  d.defaultLang || "ar",
        heroBadge:    d.heroBadge   || "",
        heroHeadline: d.heroHeadline || "",
        heroSubtitle: d.heroSubtitle || "",
        featuresTitle: d.featuresTitle || "",
        f1t: d.f1t||"", f1d: d.f1d||"", f2t: d.f2t||"", f2d: d.f2d||"",
        f3t: d.f3t||"", f3d: d.f3d||"", f4t: d.f4t||"", f4d: d.f4d||"",
        f5t: d.f5t||"", f5d: d.f5d||"", f6t: d.f6t||"", f6d: d.f6d||"",
        s1n: d.s1n||"", s1l: d.s1l||"", s2n: d.s2n||"", s2l: d.s2l||"",
        s3n: d.s3n||"", s3l: d.s3l||"", s4n: d.s4n||"", s4l: d.s4l||"",
        howTitle: d.howTitle||"",
        st1l: d.st1l||"", st1d: d.st1d||"", st2l: d.st2l||"", st2d: d.st2d||"",
        st3l: d.st3l||"", st3d: d.st3d||"",
        ctaTitle: d.ctaTitle||"", ctaSubtitle: d.ctaSubtitle||"",
        pricingTitle: d.pricingTitle||"", pricingBadge: d.pricingBadge||"",
        pricingPopular: d.pricingPopular||"", pricingPeriod: d.pricingPeriod||"",
        pricingCta: d.pricingCta||"", popularSlug: d.popularSlug||"",
      });
      // Extract per-slug hrefs (keys ending with _href)
      const hrefs: Record<string, string> = {};
      for (const [k, v] of Object.entries(d)) {
        if (k.endsWith("_href") && typeof v === "string") hrefs[k] = v;
      }
      if (Object.keys(hrefs).length > 0) setPlanHrefs(hrefs);
    }
  };

  const handleSaveHomepage = async () => {
    setHomepageSaving(true); setHomepageMsg(null);
    try {
      const r = await fetch("/api/settings/homepage", {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...homepageForm, ...planHrefs }),
      });
      if (r.ok) setHomepageMsg({ type: "ok", text: "✅ Homepage settings saved successfully" });
      else { const d = await r.json(); setHomepageMsg({ type: "err", text: d.error || "Save failed" }); }
    } catch { setHomepageMsg({ type: "err", text: "Connection error" }); }
    finally { setHomepageSaving(false); }
  };

  useEffect(() => {
    if (user) setAdminName(user.name);
  }, [user]);

  const handlePlanChange = async (userId: number, plan: PlanSlug) => {
    setUpdatingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH", headers: authHeaders, body: JSON.stringify({ plan }),
      });
      if (res.ok) setUsers(prev => prev.map(u => u.id === userId ? { ...u, plan } : u));
    } finally { setUpdatingId(null); }
  };

  const handleSavePlan = async () => {
    if (!editingPlan) return; setPlanSaving(true);
    try {
      const isNew = editingPlan.id === -1;
      const url = isNew ? "/api/admin/plans" : `/api/admin/plans/${editingPlan.id}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PUT", headers: authHeaders, body: JSON.stringify(editingPlan),
      });
      if (res.ok) {
        const saved = await res.json();
        if (isNew) setAdminPlans(prev => [...prev, saved]);
        else setAdminPlans(prev => prev.map(p => p.id === saved.id ? saved : p));
        setEditingPlan(null);
      }
    } finally { setPlanSaving(false); }
  };

  const handleDeletePlan = async (id: number) => {
    if (!confirm("Are you sure you want to delete this plan?")) return;
    const res = await fetch(`/api/admin/plans/${id}`, { method: "DELETE", headers: authHeaders });
    if (res.ok) setAdminPlans(prev => prev.filter(p => p.id !== id));
  };

  const handleAdminToggle = async (userId: number, isAdmin: boolean) => {
    setUpdatingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH", headers: authHeaders, body: JSON.stringify({ isAdmin }),
      });
      if (res.ok) setUsers(prev => prev.map(u => u.id === userId ? { ...u, isAdmin } : u));
    } finally { setUpdatingId(null); }
  };

  const handleDelete = async (userId: number) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE", headers: authHeaders });
      if (res.ok) { setUsers(prev => prev.filter(u => u.id !== userId)); setConfirmDeleteId(null); }
    } catch {}
  };

  const handleUpdateBot = async () => {
    if (!newBotToken.trim()) return; setBotLoading(true);
    try {
      const res = await fetch("/api/settings/telegram", {
        method: "PUT", headers: authHeaders, body: JSON.stringify({ token: newBotToken.trim() }),
      });
      const data = await res.json();
      if (res.ok) { alert(`Connected successfully: @${data.botUsername}`); setNewBotToken(""); loadData(token); }
      else alert(data.error || "Connection failed");
    } finally { setBotLoading(false); }
  };

  const handleRemoveBot = async () => {
    if (!confirm("Remove bot?")) return; setBotLoading(true);
    try {
      const res = await fetch("/api/settings/telegram", { method: "DELETE", headers: authHeaders });
      if (res.ok) loadData(token);
    } finally { setBotLoading(false); }
  };

  // ── WhatsApp handlers ─────────────────────────────────────────────────────
  const fetchWAStatus = async () => {
    try {
      const res = await fetch("/api/whatsapp/status", { headers: authHeaders });
      if (!res.ok) return;
      const d = await res.json();
      setWaStatus(d.status);
      setWaQr(d.qrBase64 || null);
      setWaPhone(d.phoneNumber || null);
    } catch {}
  };

  const startWAPolling = () => {
    if (waPollRef) return;
    fetchWAStatus();
    const ref = setInterval(fetchWAStatus, 3000);
    setWaPollRef(ref);
  };

  const stopWAPolling = () => {
    if (waPollRef) { clearInterval(waPollRef); setWaPollRef(null); }
  };

  const handleWAStart = async () => {
    setWaLoading(true);
    try {
      await fetch("/api/whatsapp/start", { method: "POST", headers: authHeaders });
      startWAPolling();
    } finally { setWaLoading(false); }
  };

  const handleWAStop = async () => {
    setWaLoading(true);
    try {
      await fetch("/api/whatsapp/stop", { method: "POST", headers: authHeaders });
      stopWAPolling();
      setWaStatus("disconnected"); setWaQr(null); setWaPhone(null);
    } finally { setWaLoading(false); }
  };

  const handleWALogout = async () => {
    if (!confirm("WhatsApp will be disconnected and the session deleted. You will need to scan QR again. Are you sure?")) return;
    setWaLoading(true);
    try {
      await fetch("/api/whatsapp/logout", { method: "POST", headers: authHeaders });
      stopWAPolling();
      setWaStatus("disconnected"); setWaQr(null); setWaPhone(null);
    } finally { setWaLoading(false); }
  };

  // Start polling when tab opens
  const handleWATabOpen = () => {
    setActiveTab("whatsapp" as any);
    fetchWAStatus();
  };

  // ── System Templates handlers ──────────────────────────────────────────────
  const loadSysTmpls = useCallback(async () => {
    setTmplLoading(true);
    try {
      const res = await fetch("/api/admin/system-templates", { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setSysTmpls(await res.json());
    } finally { setTmplLoading(false); }
  }, [token]);

  const loadPendingTmpls = useCallback(async () => {
    setPendingLoading(true);
    try {
      const res = await fetch("/api/admin/pending-templates", { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setPendingTmpls(await res.json());
    } finally { setPendingLoading(false); }
  }, [token]);

  useEffect(() => {
    if (token && activeTab === "templates") { loadSysTmpls(); loadPendingTmpls(); }
  }, [token, activeTab, loadSysTmpls, loadPendingTmpls]);

  const loadPayReqs = async (filter: "all"|"pending"|"approved"|"rejected" = "pending") => {
    if (!token) return;
    setPayLoading(true); setPayMsg(null);
    try {
      const qs = filter === "all" ? "" : `?status=${filter}`;
      const r = await fetch(`/api/admin/payments${qs}`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) { const d = await r.json(); setPayReqs(d.requests ?? []); }
      else setPayMsg({ type: "err", text: "Failed to load payment requests" });
    } catch { setPayMsg({ type: "err", text: "Network error" }); }
    finally { setPayLoading(false); }
  };

  useEffect(() => {
    if (token && activeTab === "payments") { loadPayReqs(payFilter); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeTab, payFilter]);

  const handlePayAction = async (id: number, action: "approve" | "deny") => {
    setPayActionId(id); setPayMsg(null);
    try {
      const r = await fetch(`/api/admin/payments/${id}/${action}`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ adminNotes: payNotes[id] ?? "" }),
      });
      const d = await r.json();
      if (r.ok) {
        setPayMsg({ type: "ok", text: action === "approve" ? "✅ Request approved successfully" : "🚫 Request rejected" });
        loadPayReqs(payFilter);
      } else {
        setPayMsg({ type: "err", text: d.error ?? "Action failed" });
      }
    } catch { setPayMsg({ type: "err", text: "Network error" }); }
    finally { setPayActionId(null); }
  };

  const handleApprove = async (id: number) => {
    setApprovalMsg(null);
    const res = await fetch(`/api/admin/templates/${id}/approve`, { method: "POST", headers: authHeaders });
    if (res.ok) {
      setPendingTmpls(p => p.filter(t => t.id !== id));
      setApprovalMsg({ type: "ok", text: "✅ Template approved and published in gallery" });
    } else {
      setApprovalMsg({ type: "err", text: "❌ Approval failed" });
    }
  };

  const handleReject = async (id: number) => {
    setApprovalMsg(null);
    const res = await fetch(`/api/admin/templates/${id}/reject`, { method: "POST", headers: authHeaders });
    if (res.ok) {
      setPendingTmpls(p => p.filter(t => t.id !== id));
      setApprovalMsg({ type: "ok", text: "🚫 Template rejected and hidden from gallery" });
    } else {
      setApprovalMsg({ type: "err", text: "❌ Rejection failed" });
    }
  };

  const handleAiGenerate = async () => {
    if (!aiPromptText.trim()) return;
    setAiLoading(true); setTmplMsg(null);
    try {
      const res = await fetch("/api/admin/system-templates/ai-generate", {
        method: "POST", headers: authHeaders, body: JSON.stringify({ prompt: aiPromptText }),
      });
      const data = await res.json();
      if (res.ok && data.template) {
        const tmpl = { ...data.template, aiPrompt: aiPromptText, isActive: true };
        const saveRes = await fetch("/api/admin/system-templates", {
          method: "POST", headers: authHeaders, body: JSON.stringify(tmpl),
        });
        if (saveRes.ok) {
          const saved = await saveRes.json();
          setSysTmpls(p => [saved, ...p]);
          setAiPromptText("");
          setTmplMsg({ type: "ok", text: data.usedAI ? "✨ Template created with AI" : "⚡ Template created from keywords" });
        } else setTmplMsg({ type: "err", text: "Template save failed" });
      } else setTmplMsg({ type: "err", text: data.error || "Generation failed" });
    } catch { setTmplMsg({ type: "err", text: "Connection error" }); }
    finally { setAiLoading(false); }
  };

  const handleSaveTmpl = async () => {
    if (!editingTmpl.name || !editingTmpl.bannerColor || !editingTmpl.textColor) {
      setTmplMsg({ type: "err", text: "Name, banner color, and text color are required" }); return;
    }
    setTmplLoading(true); setTmplMsg(null);
    try {
      const isNew = !editingTmpl.id;
      const url = isNew ? "/api/admin/system-templates" : `/api/admin/system-templates/${editingTmpl.id}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PUT", headers: authHeaders, body: JSON.stringify(editingTmpl),
      });
      const data = await res.json();
      if (res.ok) {
        if (isNew) setSysTmpls(p => [data, ...p]);
        else setSysTmpls(p => p.map(t => t.id === data.id ? data : t));
        setShowTmplForm(false); setEditingTmpl({});
        setTmplMsg({ type: "ok", text: isNew ? "✅ Template created successfully" : "✅ Template updated" });
      } else setTmplMsg({ type: "err", text: data.error || "Save failed" });
    } finally { setTmplLoading(false); }
  };

  const handleDeleteTmpl = async (id: number) => {
    if (!confirm("Delete template?")) return;
    const res = await fetch(`/api/admin/system-templates/${id}`, { method: "DELETE", headers: authHeaders });
    if (res.ok) setSysTmpls(p => p.filter(t => t.id !== id));
  };

  const handleToggleTmpl = async (t: any) => {
    const res = await fetch(`/api/admin/system-templates/${t.id}`, {
      method: "PUT", headers: authHeaders, body: JSON.stringify({ isActive: !t.isActive }),
    });
    if (res.ok) setSysTmpls(p => p.map(x => x.id === t.id ? { ...x, isActive: !x.isActive } : x));
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── INPUT / BUTTON shared styles ──
  const inputStyle: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.04)",
    border: `1px solid ${BORDER}`, borderRadius: 10,
    color: TEXT, padding: "11px 14px", fontSize: 14, outline: "none",
    boxSizing: "border-box", fontFamily: "'Inter', sans-serif",
    transition: "border-color 0.2s",
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", color: TEXT }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Loading Admin Panel...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user?.isAdmin) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", color: TEXT }}>
        <div style={{ textAlign: "center", maxWidth: 400, padding: 30, background: SURFACE, border: `1px solid ${RED}`, borderRadius: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>🚫</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>Access Denied</h1>
          <p style={{ color: MUTED, fontSize: 14, marginBottom: 24 }}>
            You do not have administrative privileges to access this area.
          </p>
          <button onClick={() => setLocation("/")} style={{
            background: SURFACE, border: `1px solid ${BORDER}`, color: TEXT,
            padding: "10px 20px", borderRadius: 10, cursor: "pointer", fontWeight: 600
          }}>Return Home</button>
        </div>
      </div>
    );
  }

  // ── Settings handlers ────────────────────────────────────────────────────────
  const handleSaveGoogle = async () => {
    if (!newGoogleId.trim()) return;
    setSettingsSaving("google"); setSettingsMsg(null);
    try {
      const r = await fetch("/api/settings/google", {
        method: "PUT", headers: authHeaders,
        body: JSON.stringify({ clientId: newGoogleId.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setNewGoogleId(""); await loadSettings();
      setSettingsMsg({ key: "google", type: "ok", text: "✅ Google Client ID saved successfully" });
    } catch (e: any) { setSettingsMsg({ key: "google", type: "err", text: e.message }); }
    finally { setSettingsSaving(null); }
  };

  const handleSaveAISettings = async () => {
    setSettingsSaving("ai");
    setSettingsMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({
          settings: [
            { key: "ai_image_generation_enabled", value: String(aiSettings.enabled) },
            { key: "ai_image_cost_per_generation", value: String(aiSettings.cost) },
            { key: "card_generation_base_cost", value: String(aiSettings.baseCost) },
            { key: "points_burn_per_article", value: String(aiSettings.blogCost) },
            { key: "signup_bonus_credits", value: String(aiSettings.signupBonus) },
            { key: "ai_image_service_status", value: aiSettings.status },
            { key: "ai_image_service_status_message", value: aiSettings.statusMessage },
          ],
        }),
      });
      if (res.ok) {
        setSettingsMsg({ key: "ai", type: "ok", text: "✅ تم حفظ إعدادات النقاط بنجاح" });
        loadSettings(); // Refresh preview
      } else {
        setSettingsMsg({ key: "ai", type: "err", text: "Failed to update settings" });
      }
    } catch {
      setSettingsMsg({ key: "ai", type: "err", text: "Network error" });
    } finally {
      setSettingsSaving(null);
    }
  };

  const handleDeleteGoogle = async () => {
    setSettingsSaving("google-del"); setSettingsMsg(null);
    try {
      await fetch("/api/settings/google", { method: "DELETE", headers: authHeaders });
      await loadSettings();
      setSettingsMsg({ key: "google", type: "ok", text: "✅ Google Client ID removed" });
    } catch { setSettingsMsg({ key: "google", type: "err", text: "An error occurred" }); }
    finally { setSettingsSaving(null); }
  };

  const handleSaveSMTP = async () => {
    setSettingsSaving("smtp"); setSettingsMsg(null);
    try {
      const r = await fetch("/api/settings/smtp", {
        method: "PUT", headers: authHeaders,
        body: JSON.stringify(smtpForm),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      await loadSettings();
      setSettingsMsg({ key: "smtp", type: "ok", text: "✅ Email settings saved successfully" });
    } catch (e: any) { setSettingsMsg({ key: "smtp", type: "err", text: e.message }); }
    finally { setSettingsSaving(null); }
  };

  const handleDeleteSMTP = async () => {
    setSettingsSaving("smtp-del"); setSettingsMsg(null);
    try {
      await fetch("/api/settings/smtp", { method: "DELETE", headers: authHeaders });
      setSmtpForm({ host: "", port: "587", user: "", pass: "", from: "" });
      await loadSettings();
      setSettingsMsg({ key: "smtp", type: "ok", text: "✅ Email settings removed" });
    } catch { setSettingsMsg({ key: "smtp", type: "err", text: "An error occurred" }); }
    finally { setSettingsSaving(null); }
  };

  const handleTestEmail = async () => {
    setSettingsSaving("test"); setSettingsMsg(null);
    try {
      const r = await fetch("/api/settings/smtp/test", {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({ to: testEmailTo }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setSettingsMsg({ key: "smtp-test", type: "ok", text: `✅ Test email sent to ${testEmailTo || "sender"}` });
    } catch (e: any) { setSettingsMsg({ key: "smtp-test", type: "err", text: e.message }); }
    finally { setSettingsSaving(null); }
  };

  const handleSaveProviderSettings = async () => {
    setSettingsSaving("provider"); setSettingsMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT", headers: authHeaders,
        body: JSON.stringify({
          settings: [
            { key: "ai_image_provider", value: providerSettings.provider },
            { key: "ai_image_fallback_enabled", value: String(providerSettings.fallbackEnabled) },
            { key: "nanobanana_page_url", value: providerSettings.nanobanana.pageUrl },
            { key: "nanobanana_ajax_url", value: providerSettings.nanobanana.ajaxUrl },
            { key: "nanobanana_timeout_ms", value: String(providerSettings.nanobanana.timeoutS * 1000) },
            { key: "nanobanana_nonce_cache_min", value: String(providerSettings.nanobanana.nonceCacheMin) },
            { key: "nanobanana_retry_count", value: String(providerSettings.nanobanana.retryCount) },
            { key: "nanobanana_queue_enabled", value: String(providerSettings.nanobanana.queueEnabled) },
            { key: "nanobanana_max_concurrent", value: String(providerSettings.nanobanana.maxConcurrent) },
            { key: "openai_api_key", value: providerSettings.openai.apiKey },
            { key: "openai_image_model", value: providerSettings.openai.model },
            { key: "openai_image_size", value: providerSettings.openai.size },
          ],
        }),
      });
      if (res.ok) {
        setSettingsMsg({ key: "provider", type: "ok", text: "✅ AI Provider settings saved successfully" });
        loadSettings();
      } else throw new Error("Failed to save provider settings");
    } catch (e: any) { setSettingsMsg({ key: "provider", type: "err", text: e.message }); }
    finally { setSettingsSaving(null); }
  };

  const handleTestNanobanana = async () => {
    setNbTesting(true);
    try {
      const r = await fetch("/api/admin/nanobanana/test", { method: "POST", headers: authHeaders });
      const d = await r.json();
      setNbStatus((prev: any) => ({ ...prev, lastTestResult: d }));
    } catch (err) {
      console.error("Test failed:", err);
    } finally { setNbTesting(false); }
  };

  const handleClearNbCache = async () => {
    const r = await fetch("/api/admin/nanobanana/clear-cache", { method: "POST", headers: authHeaders });
    if (r.ok) alert("Cache cleared successfully");
  };

  const handleTestOpenAI = async () => {
    setOaTesting(true);
    try {
      const r = await fetch("/api/admin/openai/test", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ apiKey: providerSettings.openai.apiKey })
      });
      const d = await r.json();
      if (r.ok) alert("Connected ✅");
      else alert(`Invalid Key ❌: ${d.error || ""}`);
    } catch { alert("Connection failed ❌"); }
    finally { setOaTesting(false); }
  };


  // ── NAV GROUPS ─────────────────────────────────────────────────────────────
  const NAV_GROUPS = [
    {
      label: "Overview",
      items: [
        { id: "stats",     label: "Dashboard",  icon: "◈" },
      ],
    },
    {
      label: "Content",
      items: [
        { id: "users",     label: "Users",       icon: "◎" },
        { id: "images",    label: "Images",            icon: "▣" },
        { id: "templates", label: "Templates",          icon: "◻" },
      ],
    },
    {
      label: "Business",
      items: [
        { id: "plans",     label: "Plans",          icon: "◆" },
        { id: "payments",  label: "Payments",        icon: "💳" },
        { id: "bot",       label: "Telegram Bot",    icon: "◉" },
        { id: "whatsapp",  label: "WhatsApp Bot",       icon: "◈" },
      ],
    },
    {
      label: "System",
      items: [
        { id: "settings",  label: "Settings",        icon: "◌" },
      ],
    },
  ] as const;

  const TAB_TITLES: Record<string, string> = {
    stats: "Dashboard", users: "Users", images: "Images",
    templates: "Templates", plans: "Plans", bot: "Telegram Bot",
    whatsapp: "WhatsApp Bot", settings: "Settings", payments: "Payment Requests",
  };
  const TAB_ICONS: Record<string, string> = {
    stats: "◈", users: "◎", images: "▣", templates: "◻", plans: "◆",
    bot: "◉", whatsapp: "◈", settings: "◌", payments: "💳",
  };

  const cardStyle: React.CSSProperties = {
    background: SURFACE, border: `1px solid ${BORDER}`,
    borderRadius: 14, padding: "22px",
    backdropFilter: "blur(12px)",
  };

  // ── DASHBOARD ─────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: BG, color: TEXT, fontFamily: "'Inter', sans-serif", direction: "ltr" }}>

      {/* ═══ SIDEBAR ═══ */}
      <aside style={{
        position: "fixed", top: 0, left: 0, bottom: 0,
        width: SIDEBAR_W,
        background: SIDEBAR,
        borderRight: `1px solid ${BORDER}`,
        display: "flex", flexDirection: "column",
        zIndex: 200,
        overflowY: "auto",
      }}>
        {/* Logo area */}
        <div style={{
          padding: "20px 18px 16px",
          borderBottom: `1px solid ${BORDER}`,
          display: "flex", alignItems: "center", gap: 12,
          background: "rgba(99,102,241,0.06)",
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT3})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, boxShadow: `0 0 18px rgba(99,102,241,0.4)`,
          }}>🛡️</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>News Card Pro</div>
            <div style={{ fontSize: 10, color: "rgba(99,102,241,0.8)", fontWeight: 600, marginTop: 2 }}>Admin Panel</div>
          </div>
        </div>

        {/* Nav groups */}
        <nav style={{ flex: 1, padding: "10px 0" }}>
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              {/* Group label */}
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
                color: "rgba(255,255,255,0.22)", textTransform: "uppercase",
                padding: "14px 18px 6px",
              }}>{group.label}</div>

              {group.items.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button key={item.id}
                    onClick={() => item.id === "whatsapp" ? handleWATabOpen() : setActiveTab(item.id as typeof activeTab)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 18px 9px 14px",
                      background: isActive ? "rgba(99,102,241,0.12)" : "transparent",
                      border: "none", cursor: "pointer",
                      fontFamily: "'Inter', sans-serif", fontSize: 13,
                      fontWeight: isActive ? 700 : 400,
                      color: isActive ? "#c4b5fd" : MUTED,
                      textAlign: "left", direction: "ltr",
                      position: "relative", transition: "all 0.15s",
                      borderLeft: isActive ? `3px solid ${ACCENT}` : "3px solid transparent",
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                  >
                    <span style={{ fontSize: 14, opacity: isActive ? 1 : 0.6 }}>{item.icon}</span>
                    <span>{item.label}</span>
                    {/* Badge for counts */}
                    {item.id === "users" && users.length > 0 && (
                      <span style={{
                        marginLeft: "auto", marginRight: 0,
                        background: "rgba(99,102,241,0.2)", color: "#a78bfa",
                        fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 99,
                      }}>{users.length}</span>
                    )}
                    {item.id === "plans" && adminPlans.length > 0 && (
                      <span style={{
                        marginLeft: "auto", marginRight: 0,
                        background: "rgba(34,211,238,0.1)", color: ACCENT2,
                        fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 99,
                      }}>{adminPlans.length}</span>
                    )}
                    {item.id === "templates" && pendingTmpls.length > 0 && (
                      <span style={{
                        marginLeft: "auto", marginRight: 0,
                        background: "rgba(245,158,11,0.2)", color: AMBER,
                        fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 99,
                      }}>{pendingTmpls.length}</span>
                    )}
                    {item.id === "templates" && pendingTmpls.length === 0 && sysTmpls.length > 0 && (
                      <span style={{
                        marginLeft: "auto", marginRight: 0,
                        background: "rgba(139,92,246,0.1)", color: ACCENT3,
                        fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 99,
                      }}>{sysTmpls.length}</span>
                    )}
                    {item.id === "payments" && payReqs.filter(r => r.status === "pending").length > 0 && (
                      <span style={{
                        marginLeft: "auto", marginRight: 0,
                        background: "rgba(245,158,11,0.2)", color: AMBER,
                        fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 99,
                      }}>{payReqs.filter(r => r.status === "pending").length}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Admin info + logout */}
        <div style={{
          padding: "14px 16px",
          borderTop: `1px solid ${BORDER}`,
          background: "rgba(0,0,0,0.2)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: `linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3))`,
              border: `1px solid rgba(99,102,241,0.3)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14,
            }}>👤</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{adminName || "Admin"}</div>
              <div style={{ fontSize: 10, color: MUTED }}>System Admin</div>
            </div>
          </div>
          <button
            onClick={() => { localStorage.removeItem("ncg_admin_token"); setToken(""); }}
            style={{
              width: "100%", padding: "7px", borderRadius: 8,
              background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)",
              color: "rgba(239,68,68,0.7)", fontSize: 12, fontWeight: 600,
              cursor: "pointer", fontFamily: "'Inter', sans-serif",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.12)"; e.currentTarget.style.color = RED; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.06)"; e.currentTarget.style.color = "rgba(239,68,68,0.7)"; }}
          >⬡ Sign Out</button>
        </div>
      </aside>

      {/* ═══ MAIN AREA ═══ */}
      <div style={{ flex: 1, marginLeft: SIDEBAR_W, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* TOP BAR */}
        <header style={{
          position: "sticky", top: 0, zIndex: 100,
          background: TOPBAR,
          borderBottom: `1px solid ${BORDER}`,
          height: 52, display: "flex", alignItems: "center",
          padding: "0 28px", gap: 16,
        }}>
          {/* Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>Admin</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.15)" }}>›</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{TAB_TITLES[activeTab]}</span>
          </div>

          {/* Quick stats pills */}
          {stats && (
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { v: stats.totalUsers, l: "Users", c: ACCENT },
                { v: stats.todayImages, l: "Images today", c: ACCENT2 },
              ].map(({ v, l, c }) => (
                <div key={l} style={{
                  padding: "4px 12px", borderRadius: 99,
                  background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`,
                  fontSize: 11, color: MUTED,
                  display: "flex", alignItems: "center", gap: 5,
                }}>
                  <span style={{ color: c, fontWeight: 800 }}>{v.toLocaleString("ar-MA")}</span>
                  <span>{l}</span>
                </div>
              ))}
            </div>
          )}

          {/* View site link */}
          <a href="/" target="_blank" style={{
            padding: "5px 14px", borderRadius: 8,
            background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`,
            color: MUTED, fontSize: 12, fontWeight: 600,
            textDecoration: "none", display: "flex", alignItems: "center", gap: 6,
            transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.color = TEXT; e.currentTarget.style.borderColor = BORDER2; }}
          onMouseLeave={e => { e.currentTarget.style.color = MUTED; e.currentTarget.style.borderColor = BORDER; }}
          >↗ View Site</a>
        </header>

        {/* PAGE CONTENT */}
        <main style={{ flex: 1, padding: "28px 32px", background: BG }}>

          {/* Page title row */}
          <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: "rgba(99,102,241,0.1)", border: `1px solid rgba(99,102,241,0.2)`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
            }}>{TAB_ICONS[activeTab]}</div>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#fff" }}>{TAB_TITLES[activeTab]}</h1>
              <p style={{ margin: 0, fontSize: 12, color: MUTED, marginTop: 2 }}>
                {activeTab === "stats" && "Overview of platform activity"}
                {activeTab === "users" && `${users.length} registered users`}
                {activeTab === "images" && "All images created on the platform"}
                {activeTab === "templates" && `${sysTmpls.length} available templates`}
                {activeTab === "plans" && `${adminPlans.length} defined plans`}
                {activeTab === "bot" && "Connect and manage Telegram bot"}
                {activeTab === "whatsapp" && "Connect WhatsApp bot via QR Code"}
                {activeTab === "settings" && "System settings and homepage"}
                {activeTab === "payments" && `${payReqs.length} ${payFilter === "all" ? "total" : payFilter} requests`}
              </p>
            </div>
          </div>

          {/* Mini stat cards — always visible */}
          {stats && (
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 28 }}>
              <StatCard label="Total Users" value={stats.totalUsers}   icon="👥" gradient="radial-gradient(ellipse at top right, rgba(99,102,241,0.15), transparent 60%)" />
              <StatCard label="Pro Users"        value={stats.proUsers}    icon="⭐" gradient="radial-gradient(ellipse at top right, rgba(139,92,246,0.15), transparent 60%)" />
              <StatCard label="Total Images"       value={stats.totalImages}  icon="🖼️" gradient="radial-gradient(ellipse at top right, rgba(34,197,94,0.12), transparent 60%)" />
              <StatCard label="Today's Images"           value={stats.todayImages} icon="📅" gradient="radial-gradient(ellipse at top right, rgba(245,158,11,0.12), transparent 60%)" />
            </div>
          )}

        {/* ── STATS ── */}
        {activeTab === "stats" && stats && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#fff" }}>Plan Distribution</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  { label: "Free",    value: stats.freeUsers, color: "#94a3b8", pct: stats.totalUsers ? Math.round(stats.freeUsers / stats.totalUsers * 100) : 0 },
                  { label: "Pro +",    value: stats.proUsers,  color: ACCENT,    pct: stats.totalUsers ? Math.round(stats.proUsers / stats.totalUsers * 100) : 0 },
                ].map(row => (
                  <div key={row.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                      <span style={{ color: TEXT }}>{row.label}</span>
                      <span style={{ color: row.color, fontWeight: 700 }}>{row.value} ({row.pct}%)</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 4, background: "rgba(255,255,255,0.06)" }}>
                      <div style={{ height: "100%", width: `${row.pct}%`, borderRadius: 4, background: row.color, transition: "width 0.6s" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#fff" }}>Usage Rate</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Images / User", value: stats.totalUsers ? (stats.totalImages / stats.totalUsers).toFixed(1) : "0" },
                  { label: "Today's Images",    value: stats.todayImages },
                  { label: "Active Today",  value: users.filter(u => u.daily_usage_count > 0).length },
                ].map(row => (
                  <div key={row.label} style={{
                    display: "flex", justifyContent: "space-between",
                    padding: "10px 14px", background: "rgba(255,255,255,0.03)",
                    border: `1px solid ${BORDER}`, borderRadius: 10,
                  }}>
                    <span style={{ fontSize: 13, color: MUTED }}>{row.label}</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: TEXT }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── USERS ── */}
        {activeTab === "users" && (
          <div>
            <div style={{ marginBottom: 16, display: "flex", gap: 10 }}>
              <input
                placeholder="🔍 Search by name or email..." value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)} dir="rtl"
                style={{ ...inputStyle, maxWidth: 360 }}
                onFocus={e => e.currentTarget.style.borderColor = ACCENT}
                onBlur={e => e.currentTarget.style.borderColor = BORDER}
              />
              <button onClick={() => loadData(token)} style={{
                background: SURFACE, border: `1px solid ${BORDER}`,
                color: MUTED, padding: "10px 18px", borderRadius: 10,
                fontSize: 13, cursor: "pointer", fontFamily: "'Inter', sans-serif",
                transition: "all 0.15s",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = BORDER2; e.currentTarget.style.color = TEXT; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = MUTED; }}
              >🔄 Refresh</button>
            </div>

            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                    {["#", "Name / Email", "Plan", "Key Status", "Bot Code", "Images", "Today", "Actions"].map(h => (
                      <th key={h} style={{ padding: "13px 16px", color: MUTED, fontWeight: 600, textAlign: "left", borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u, i) => (
                    <tr key={u.id}
                      style={{ borderBottom: `1px solid ${BORDER}`, transition: "background 0.1s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.025)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{ padding: "12px 16px", color: MUTED, fontFamily: "monospace" }}>{i + 1}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                            background: `linear-gradient(135deg, ${ACCENT}80, ${ACCENT3}80)`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 13, fontWeight: 700, color: "#fff",
                          }}>{u.name[0]}</div>
                          <div>
                            <div style={{ fontWeight: 600, color: TEXT }}>
                              {u.name}
                              {u.isAdmin && <span style={{ marginRight: 6, fontSize: 10, background: "rgba(245,158,11,0.15)", color: AMBER, border: "1px solid rgba(245,158,11,0.25)", padding: "1px 7px", borderRadius: 999, fontWeight: 700 }}>Admin</span>}
                            </div>
                            <div style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}><PlanBadge plan={u.plan} /></td>
                      <td style={{ padding: "12px 16px" }}>
                        {u.has_openrouter_key ? (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                            background: u.openrouter_key_valid ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                            color: u.openrouter_key_valid ? GREEN : RED,
                            border: `1px solid ${u.openrouter_key_valid ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`
                          }}>
                            {u.openrouter_key_valid ? "Active" : "Invalid"}
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, color: MUTED }}>None</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontFamily: "monospace", fontSize: 11, background: "rgba(255,255,255,0.05)", border: `1px solid ${BORDER}`, padding: "2px 8px", borderRadius: 6, color: MUTED }}>
                          {u.botCode || "—"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 700, color: TEXT }}>{u.totalImages}</td>
                      <td style={{ padding: "12px 16px", color: u.daily_usage_count > 0 ? GREEN : MUTED, fontWeight: 600 }}>{u.daily_usage_count}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                          {updatingId === u.id ? (
                            <span style={{ fontSize: 12, color: MUTED }}>⏳</span>
                          ) : (
                            <>
                              <select value={u.plan}
                                onChange={e => handlePlanChange(u.id, e.target.value as any)}
                                style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 7, fontSize: 11, padding: "4px 8px", fontFamily: "'Inter', sans-serif", cursor: "pointer" }}
                              >
                                {adminPlans.map(p => (
                                  <option key={p.id} value={p.slug}>{p.name}</option>
                                ))}
                                {!adminPlans.find(p => p.slug === u.plan) && (
                                  <option value={u.plan}>{u.plan} (Custom)</option>
                                )}
                              </select>
                              {!u.isAdmin
                                ? <button onClick={() => handleAdminToggle(u.id, true)} style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: AMBER, padding: "4px 10px", borderRadius: 7, fontSize: 11, cursor: "pointer", fontFamily: "'Inter', sans-serif" }} title="Grant Admin privileges">🛡️</button>
                                : <button onClick={() => handleAdminToggle(u.id, false)} style={{ background: "rgba(100,116,139,0.08)", border: `1px solid ${BORDER}`, color: MUTED, padding: "4px 10px", borderRadius: 7, fontSize: 11, cursor: "pointer", fontFamily: "'Inter', sans-serif" }} title="Revoke Admin privileges">−🛡️</button>
                              }
                              {confirmDeleteId === u.id ? (
                                <>
                                  <button onClick={() => handleDelete(u.id)} style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: RED, padding: "4px 10px", borderRadius: 7, fontSize: 11, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>Confirm</button>
                                  <button onClick={() => setConfirmDeleteId(null)} style={{ background: SURFACE, border: `1px solid ${BORDER}`, color: MUTED, padding: "4px 10px", borderRadius: 7, fontSize: 11, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>Cancel</button>
                                </>
                              ) : (
                                <button onClick={() => setConfirmDeleteId(u.id)} style={{ background: "transparent", border: "none", color: "rgba(239,68,68,0.5)", padding: "4px 8px", borderRadius: 7, fontSize: 14, cursor: "pointer" }} title="Delete">🗑</button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: "center", padding: "32px", color: MUTED }}>No users found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── IMAGES ── */}
        {activeTab === "images" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
              {images.slice(0, 24).map(img => (
                <div key={img.id} style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
                  <div style={{ height: 140, background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {img.imageUrl ? (
                      <img src={img.imageUrl} alt={img.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span style={{ fontSize: 32, opacity: 0.3 }}>🖼️</span>
                    )}
                  </div>
                  <div style={{ padding: "12px 14px" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {img.title || "Untitled"}
                    </div>
                    <div style={{ fontSize: 11, color: MUTED }}>{img.userName || "—"}</div>
                    <div style={{ fontSize: 10, color: MUTED, fontFamily: "monospace", marginTop: 2 }}>
                      {new Date(img.createdAt).toLocaleDateString("ar-MA")}
                    </div>
                  </div>
                </div>
              ))}
              {images.length === 0 && (
                <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px", color: MUTED }}>
                  No images yet
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PLANS ── */}
        {activeTab === "plans" && (
          <div>
            <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 16 }}>
              <button onClick={() => setEditingPlan({ id: -1, name: "", slug: "", description: null, price_monthly: 0, price_yearly: 0, monthly_credits: 30, rate_limit_daily: 10, max_templates: 3, max_saved_designs: 5, max_sites: 0, has_api_access: false, has_telegram_bot: false, has_overlay_upload: false, has_custom_watermark: false, has_blog_automation: false, has_image_generator: true, has_ai_image_generation: false, has_priority_support: false, has_priority_processing: false, is_active: true, is_free: false, sort_order: adminPlans.length, plan_mode: "platform" })}
                style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT3})`, color: "#fff", border: "none", padding: "10px 22px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
                + Add New Plan
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {adminPlans.map(plan => (
                <div key={plan.id} style={{
                  ...cardStyle,
                  borderColor: plan.is_active ? "rgba(99,102,241,0.2)" : BORDER,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16, color: "#fff", marginBottom: 4 }}>{plan.name}</div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontFamily: "monospace", fontSize: 11, color: MUTED, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, padding: "2px 8px", borderRadius: 6 }}>{plan.slug}</span>
                        {plan.plan_mode === "byok" && (
                          <span style={{ fontSize: 10, background: "rgba(99,102,241,0.15)", color: "#c4b5fd", border: "1px solid rgba(99,102,241,0.25)", padding: "1px 7px", borderRadius: 999, fontWeight: 700 }}>BYOK</span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>${plan.price_monthly}<span style={{ fontSize: 12, color: MUTED }}>/mo</span></div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                    {[
                      { label: "Credits/mo", value: plan.monthly_credits },
                      { label: "Daily limit", value: plan.rate_limit_daily },
                      { label: "API", value: plan.has_api_access ? "✓" : "✗" },
                      { label: "Telegram Bot", value: plan.has_telegram_bot ? "✓" : "✗" },
                    ].map(row => (
                      <div key={row.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: MUTED }}>{row.label}</span>
                        <span style={{ color: row.value === "✓" ? GREEN : row.value === "✗" ? "rgba(239,68,68,0.5)" : TEXT, fontWeight: 700 }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setEditingPlan(plan)} style={{ flex: 1, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: ACCENT, padding: "7px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "'Inter', sans-serif", fontWeight: 600 }}>Edit</button>
                    <button onClick={() => handleDeletePlan(plan.id)} style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: RED, padding: "7px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>🗑</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Plan edit modal */}
            {editingPlan && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
                <div style={{ width: 480, background: "#0d0d1a", border: `1px solid ${BORDER2}`, borderRadius: 20, padding: "28px 28px 24px", maxHeight: "80vh", overflowY: "auto" }}>
                  <h2 style={{ margin: "0 0 24px", fontSize: 18, fontWeight: 800, color: "#fff" }}>
                    {editingPlan.id === -1 ? "Add New Plan" : "Edit Plan"}
                  </h2>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {[
                      { label: "Name", field: "name", type: "text" },
                      { label: "Slug", field: "slug", type: "text" },
                      { label: "Monthly Price ($)", field: "price_monthly", type: "number" },
                      { label: "Yearly Price ($)", field: "price_yearly", type: "number" },
                      { label: "Credits/month", field: "monthly_credits", type: "number" },
                      { label: "Daily limit", field: "rate_limit_daily", type: "number" },
                      { label: "Max Templates", field: "max_templates", type: "number" },
                      { label: "Max Saved Designs", field: "max_saved_designs", type: "number" },
                      { label: "Max Sites", field: "max_sites", type: "number" },
                      { label: "Sort Order", field: "sort_order", type: "number" },
                    ].map(f => (
                      <div key={f.field}>
                        <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 6, fontWeight: 600 }}>{f.label}</label>
                        <input
                          type={f.type}
                          value={(editingPlan as any)[f.field]}
                          onChange={e => setEditingPlan(prev => prev ? { ...prev, [f.field]: f.type === "number" ? +e.target.value : e.target.value } : null)}
                          dir={f.type === "number" ? "ltr" : "rtl"}
                          style={{ ...inputStyle, fontSize: 13 }}
                          onFocus={e => e.currentTarget.style.borderColor = ACCENT}
                          onBlur={e => e.currentTarget.style.borderColor = BORDER}
                        />
                      </div>
                    ))}
                    <div style={{ gridColumn: "span 2" }}>
                      <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 6, fontWeight: 600 }}>Plan Mode</label>
                      <select
                        value={editingPlan.plan_mode}
                        onChange={e => setEditingPlan(prev => prev ? { ...prev, plan_mode: e.target.value as "platform" | "byok" } : null)}
                        style={{ ...inputStyle, fontSize: 13, cursor: "pointer" }}
                      >
                        <option value="platform">Platform (System Key)</option>
                        <option value="byok">BYOK (User Key)</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
                    {[
                      { label: "Image Generator",    field: "has_image_generator" },
                      { label: "AI Image Generation", field: "has_ai_image_generation" },
                      { label: "Blog Automation",    field: "has_blog_automation" },
                      { label: "API Access",          field: "has_api_access" },
                      { label: "Telegram Bot",        field: "has_telegram_bot" },
                      { label: "Overlay Upload",      field: "has_overlay_upload" },
                      { label: "Custom Watermark",   field: "has_custom_watermark" },
                      { label: "Priority Processing", field: "has_priority_processing" },
                      { label: "Priority Support",    field: "has_priority_support" },
                      { label: "Is Free Plan",        field: "is_free" },
                      { label: "Active",              field: "is_active" },
                    ].map(f => (
                      <label key={f.field} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: TEXT }}>
                        <input type="checkbox" checked={(editingPlan as any)[f.field]}
                          onChange={e => setEditingPlan(prev => prev ? { ...prev, [f.field]: e.target.checked } : null)}
                          style={{ accentColor: ACCENT, width: 15, height: 15 }}
                        />
                        {f.label}
                      </label>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                    <button onClick={handleSavePlan} disabled={planSaving} style={{ flex: 1, background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT3})`, color: "#fff", border: "none", padding: "12px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
                      {planSaving ? "⏳ Saving..." : "Save"}
                    </button>
                    <button onClick={() => setEditingPlan(null)} style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, color: MUTED, padding: "12px", borderRadius: 10, fontSize: 14, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>Cancel</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── BOT ── */}
        {activeTab === "bot" && (
          <div style={{ maxWidth: 560 }}>
            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 800, color: "#fff" }}>🤖 Telegram Bot Settings</h3>

              {botStatus && (
                <div style={{
                  padding: "14px 18px", borderRadius: 12, marginBottom: 24,
                  background: botStatus.connected ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                  border: `1px solid ${botStatus.connected ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.2)"}`,
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <span style={{ fontSize: 20 }}>{botStatus.connected ? "✅" : "❌"}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: botStatus.connected ? GREEN : RED }}>
                      {botStatus.connected ? `Connected: @${botStatus.botUsername}` : "Bot not connected"}
                    </div>
                    <div style={{ fontSize: 12, color: MUTED }}>
                      {botStatus.hasToken ? "Auth token entered" : "No token entered"}
                    </div>
                  </div>
                  {botStatus.connected && (
                    <button onClick={handleRemoveBot} disabled={botLoading} style={{ marginRight: "auto", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: RED, padding: "6px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>Remove Bot</button>
                  )}
                </div>
              )}

              <div>
                <label style={{ fontSize: 12, color: MUTED, display: "block", marginBottom: 8, fontWeight: 600 }}>Bot Token (Telegram Bot Token)</label>
                <input
                  type="text" value={newBotToken}
                  onChange={e => setNewBotToken(e.target.value)}
                  placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                  dir="ltr"
                  style={{ ...inputStyle, fontFamily: "monospace", marginBottom: 12 }}
                  onFocus={e => e.currentTarget.style.borderColor = ACCENT}
                  onBlur={e => e.currentTarget.style.borderColor = BORDER}
                />
                <button onClick={handleUpdateBot} disabled={botLoading || !newBotToken.trim()} style={{
                  background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT3})`,
                  color: "#fff", border: "none", padding: "11px 24px",
                  borderRadius: 10, fontSize: 14, fontWeight: 700,
                  cursor: botLoading ? "wait" : "pointer",
                  fontFamily: "'Inter', sans-serif",
                  opacity: !newBotToken.trim() ? 0.5 : 1,
                }}>{botLoading ? "⏳ Connecting..." : "Connect Bot"}</button>
              </div>

              <div style={{ marginTop: 20, padding: "14px 16px", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: `1px solid ${BORDER}` }}>
                <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.8, margin: 0 }}>
                  💡 To get the bot token, talk to <code style={{ fontFamily: "monospace", color: ACCENT2 }}>@BotFather</code> on Telegram and create a new bot.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ WHATSAPP TAB ══════════ */}
        {activeTab === "whatsapp" && (
          <div style={{ maxWidth: 580 }}>
            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 800, color: "#fff" }}>
                💬 WhatsApp Bot
              </h3>

              {/* Status badge */}
              <div style={{
                padding: "14px 18px", borderRadius: 12, marginBottom: 24,
                background: waStatus === "connected"
                  ? "rgba(34,197,94,0.08)"
                  : waStatus === "qr_ready" || waStatus === "connecting"
                  ? "rgba(245,158,11,0.08)"
                  : "rgba(99,102,241,0.06)",
                border: `1px solid ${waStatus === "connected"
                  ? "rgba(34,197,94,0.25)"
                  : waStatus === "qr_ready" || waStatus === "connecting"
                  ? "rgba(245,158,11,0.25)"
                  : "rgba(99,102,241,0.15)"}`,
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <span style={{ fontSize: 22 }}>
                  {waStatus === "connected" ? "✅" : waStatus === "qr_ready" ? "📱" : waStatus === "connecting" ? "⏳" : "⭕"}
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: waStatus === "connected" ? GREEN : waStatus === "qr_ready" || waStatus === "connecting" ? "#f59e0b" : MUTED }}>
                    {waStatus === "connected"
                      ? `Connected${waPhone ? ` — +${waPhone}` : ""}`
                      : waStatus === "qr_ready"
                      ? "Waiting for QR scan"
                      : waStatus === "connecting"
                      ? "Connecting..."
                      : "Not connected"}
                  </div>
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                    {waStatus === "connected"
                      ? "Bot is running and receiving messages"
                      : waStatus === "qr_ready"
                      ? "Open WhatsApp on your phone → Linked Devices → Link a Device"
                      : waStatus === "connecting"
                      ? "Please wait..."
                      : "Press 'Start Bot' to begin"}
                  </div>
                </div>
              </div>

              {/* QR Code */}
              {waStatus === "qr_ready" && waQr && (
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                  <div style={{ fontSize: 13, color: MUTED, marginBottom: 12, fontWeight: 600 }}>
                    Scan this QR code from WhatsApp
                  </div>
                  <div style={{
                    display: "inline-block", padding: 16,
                    background: "#fff", borderRadius: 16,
                    boxShadow: "0 0 40px rgba(99,102,241,0.15)",
                  }}>
                    <img src={waQr} alt="WhatsApp QR Code" style={{ width: 220, height: 220, display: "block" }} />
                  </div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 10, lineHeight: 1.7 }}>
                    WhatsApp → ⋮ → Linked Devices → Link a Device → Scan Code
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {(waStatus === "disconnected") && (
                  <button
                    onClick={handleWAStart}
                    disabled={waLoading}
                    style={{
                      background: `linear-gradient(135deg, #25d366, #128c7e)`,
                      color: "#fff", border: "none", padding: "11px 24px",
                      borderRadius: 10, fontSize: 14, fontWeight: 700,
                      cursor: waLoading ? "wait" : "pointer",
                      fontFamily: "'Inter', sans-serif",
                      opacity: waLoading ? 0.6 : 1,
                    }}
                  >
                    {waLoading ? "⏳ Starting..." : "▶ Start Bot"}
                  </button>
                )}

                {(waStatus === "connecting" || waStatus === "qr_ready") && (
                  <button
                    onClick={() => { startWAPolling(); }}
                    disabled={waLoading}
                    style={{
                      background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)",
                      color: "#f59e0b", padding: "11px 24px",
                      borderRadius: 10, fontSize: 14, fontWeight: 700,
                      cursor: "pointer", fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    🔄 Refresh Status
                  </button>
                )}

                {waStatus === "connected" && (
                  <button
                    onClick={handleWAStop}
                    disabled={waLoading}
                    style={{
                      background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                      color: RED, padding: "11px 24px",
                      borderRadius: 10, fontSize: 14, fontWeight: 700,
                      cursor: waLoading ? "wait" : "pointer", fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    ⏹ Stop Bot
                  </button>
                )}

                {waStatus !== "disconnected" && (
                  <button
                    onClick={handleWALogout}
                    disabled={waLoading}
                    style={{
                      background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`,
                      color: MUTED, padding: "11px 24px",
                      borderRadius: 10, fontSize: 14, fontWeight: 600,
                      cursor: waLoading ? "wait" : "pointer", fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    🚪 Disconnect
                  </button>
                )}
              </div>
            </div>

            {/* Instructions card */}
            <div style={{ ...cardStyle, marginTop: 16 }}>
              <h4 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: TEXT }}>
                📖 How to Use the Bot
              </h4>
              <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.9 }}>
                <p style={{ margin: "0 0 10px" }}>
                  Send a text message to the bot in this format:
                </p>
                <div style={{
                  background: "rgba(0,0,0,0.3)", borderRadius: 10,
                  padding: "14px 16px", fontFamily: "monospace", fontSize: 12,
                  color: ACCENT2, border: `1px solid ${BORDER}`, marginBottom: 12, direction: "ltr"
                }}>
                  template: breaking<br />
                  title: News headline here<br />
                  account: NB-XXXX<br />
                  ratio: 16:9
                </div>
                <p style={{ margin: "0 0 8px", fontSize: 12 }}>
                  💡 <strong style={{ color: TEXT }}>Template field</strong> accepts: template name (e.g., <code style={{ color: ACCENT2 }}>breaking</code>), API template name (e.g., <code style={{ color: ACCENT2 }}>my-custom-template</code>), or a numeric <strong>Template ID</strong> (e.g., <code style={{ color: ACCENT2 }}>6</code>).
                </p>
                <p style={{ margin: "0 0 8px" }}>Then send a background image, or type <code style={{ color: ACCENT2 }}>/skip</code> to continue without an image.</p>
                <p style={{ margin: "0 0 4px" }}>
                  <strong style={{ color: TEXT }}>Available Commands:</strong>
                </p>
                <ul style={{ margin: "4px 0 0 0", paddingRight: 20 }}>
                  <li><code style={{ color: ACCENT2 }}>/start</code> — Start using</li>
                  <li><code style={{ color: ACCENT2 }}>/help</code> — Help</li>
                  <li><code style={{ color: ACCENT2 }}>/templates</code> — Template list</li>
                  <li><code style={{ color: ACCENT2 }}>/skip</code> — Continue without background image</li>
                </ul>
              </div>

              <div style={{ marginTop: 14, padding: "12px 14px", background: "rgba(239,68,68,0.06)", borderRadius: 10, border: "1px solid rgba(239,68,68,0.15)" }}>
                <p style={{ fontSize: 12, color: "#f87171", margin: 0, lineHeight: 1.7 }}>
                  ⚠️ <strong>Warning:</strong> The bot uses unofficial WhatsApp Web. There is a small risk of account restriction. It is recommended to use a dedicated phone number for the bot.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ TEMPLATES TAB ══════════ */}
        {activeTab === "templates" && (
          <div style={{ padding: "0 32px 40px" }}>

            {/* ── Pending User Templates (approval queue) ── */}
            <div style={{ ...cardStyle, marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: TEXT, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
                    Publish Requests
                    {pendingTmpls.length > 0 && (
                      <span style={{ background: AMBER, color: "#000", fontSize: 11, fontWeight: 800, padding: "2px 9px", borderRadius: 999 }}>
                        {pendingTmpls.length}
                      </span>
                    )}
                  </h2>
                  <p style={{ fontSize: 13, color: MUTED, margin: "4px 0 0" }}>User templates requested for gallery publication</p>
                </div>
                <button onClick={loadPendingTmpls} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${BORDER}`, color: MUTED, padding: "8px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>
                  🔄 Refresh
                </button>
              </div>

              {approvalMsg && (
                <div style={{
                  marginBottom: 16, padding: "12px 16px", borderRadius: 10,
                  background: approvalMsg.type === "ok" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                  border: `1px solid ${approvalMsg.type === "ok" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
                  color: approvalMsg.type === "ok" ? GREEN : RED, fontSize: 13,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  {approvalMsg.text}
                  <button onClick={() => setApprovalMsg(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 16 }}>✕</button>
                </div>
              )}

              {pendingLoading ? (
                <div style={{ textAlign: "center", padding: 32, color: MUTED }}>⏳ Loading...</div>
              ) : pendingTmpls.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0", color: MUTED }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>No pending requests</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>All templates have been processed</div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                  {pendingTmpls.map(t => (
                    <div key={t.id} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid rgba(245,158,11,0.3)`, borderRadius: 14, overflow: "hidden" }}>
                      <div style={{ height: 5, background: t.bannerGradient ?? t.bannerColor }} />
                      <div style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: TEXT }}>{t.name}</div>
                            <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>User #{t.userId} · {t.category}</div>
                          </div>
                          <span style={{ background: "rgba(245,158,11,0.15)", color: AMBER, fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(245,158,11,0.3)" }}>
                            Awaiting approval
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: MUTED, marginBottom: 12 }}>
                          Font: {t.font} · {new Date(t.createdAt).toLocaleDateString("ar-MA")}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button onClick={() => handleApprove(t.id)} style={{
                            flex: 1, padding: "8px 0", borderRadius: 8,
                            background: "rgba(34,197,94,0.15)", color: GREEN,
                            fontSize: 12, fontWeight: 700, cursor: "pointer",
                            border: "1px solid rgba(34,197,94,0.3)",
                          }}>✅ Approve</button>
                          <button onClick={() => handleReject(t.id)} style={{
                            flex: 1, padding: "8px 0", borderRadius: 8,
                            background: "rgba(239,68,68,0.1)", color: RED,
                            fontSize: 12, fontWeight: 700, cursor: "pointer",
                            border: "1px solid rgba(239,68,68,0.25)",
                          }}>🚫 Reject</button>
                          <button onClick={() => {
                            const res = fetch(`/api/admin/templates/${t.id}`, { method: "DELETE", headers: authHeaders });
                            res.then(r => { if (r.ok) { setPendingTmpls(p => p.filter(x => x.id !== t.id)); setApprovalMsg({ type: "ok", text: "🗑️ Template deleted" }); } });
                          }} style={{
                            padding: "8px 10px", borderRadius: 8,
                            background: "rgba(239,68,68,0.06)", color: RED,
                            fontSize: 12, cursor: "pointer",
                            border: "1px solid rgba(239,68,68,0.2)",
                          }} title="Delete template">🗑️</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ ...cardStyle }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: TEXT, margin: 0 }}>Site Templates</h2>
                  <p style={{ fontSize: 13, color: MUTED, margin: "4px 0 0" }}>Templates visible to everyone in the gallery</p>
                </div>
                <a href="/pro/template-builder?from=admin" style={{
                  background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT3})`,
                  color: "#fff", border: "none", padding: "10px 20px",
                  borderRadius: 10, fontSize: 13, fontWeight: 700,
                  cursor: "pointer", fontFamily: "'Inter', sans-serif",
                  textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6,
                  boxShadow: "0 4px 20px rgba(99,102,241,0.4)",
                }}>🎨 Professional Template Builder</a>
              </div>

              {/* ── AI Generator ── */}
              <div style={{ marginBottom: 28, padding: "18px 20px", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 4, display: "flex", alignItems: "center", gap: 7 }}>
                  <span>✨</span> Generate Template with AI
                </div>
                <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>Write a description of the template you want and the system will generate its settings automatically</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    type="text" value={aiPromptText}
                    onChange={e => setAiPromptText(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAiGenerate()}
                    placeholder="e.g. Dark green sports template for breaking news with badge"
                    style={{ ...inputStyle, flex: 1 }}
                    onFocus={e => e.currentTarget.style.borderColor = ACCENT}
                    onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}
                  />
                  <button onClick={handleAiGenerate} disabled={aiLoading || !aiPromptText.trim()} style={{
                    background: `linear-gradient(135deg, ${ACCENT3}, #7c3aed)`,
                    color: "#fff", border: "none", padding: "11px 20px",
                    borderRadius: 10, fontSize: 13, fontWeight: 700,
                    cursor: aiLoading ? "wait" : "pointer",
                    fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap",
                    opacity: !aiPromptText.trim() ? 0.5 : 1,
                  }}>{aiLoading ? "⏳ Generating..." : "✨ Generate"}</button>
                </div>
              </div>

              {/* ── Status message ── */}
              {tmplMsg && (
                <div style={{
                  marginBottom: 16, padding: "12px 16px", borderRadius: 10,
                  background: tmplMsg.type === "ok" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                  border: `1px solid ${tmplMsg.type === "ok" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
                  color: tmplMsg.type === "ok" ? GREEN : RED, fontSize: 13,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  {tmplMsg.text}
                  <button onClick={() => setTmplMsg(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 16 }}>✕</button>
                </div>
              )}

              {/* ── Templates List ── */}
              {tmplLoading && !sysTmpls.length ? (
                <div style={{ textAlign: "center", padding: "40px", color: MUTED }}>⏳ Loading...</div>
              ) : sysTmpls.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px", color: MUTED }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🎨</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 6 }}>No templates yet</div>
                  <div style={{ fontSize: 13 }}>Use AI generation or create a template manually</div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                  {sysTmpls.map(t => (
                    <div key={t.id} style={{
                      background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`,
                      borderRadius: 14, overflow: "hidden",
                      opacity: t.isActive ? 1 : 0.5,
                    }}>
                      {/* Color strip */}
                      <div style={{ height: 5, background: t.bannerGradient ?? t.bannerColor }} />
                      <div style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: TEXT }}>{t.name}</div>
                            <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{t.category}</div>
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            {t.badge && (
                              <span style={{ background: t.badgeColor ?? ACCENT, color: "#fff", fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 999 }}>{t.badge}</span>
                            )}
                            <div style={{ width: 16, height: 16, borderRadius: "50%", background: t.bannerGradient ?? t.bannerColor, border: "2px solid rgba(255,255,255,0.15)" }} />
                            <div style={{ width: 16, height: 16, borderRadius: "50%", background: t.textColor, border: "2px solid rgba(255,255,255,0.15)" }} />
                          </div>
                        </div>

                        {/* Approval status badge */}
                        <div style={{ marginBottom: 10 }}>
                          {t.isApproved === true ? (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "rgba(34,197,94,0.12)", color: GREEN, border: "1px solid rgba(34,197,94,0.25)" }}>
                              ✅ Approved — Live in Gallery
                            </span>
                          ) : t.isApproved === false ? (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "rgba(239,68,68,0.1)", color: RED, border: "1px solid rgba(239,68,68,0.2)" }}>
                              🚫 Rejected — Hidden
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "rgba(245,158,11,0.12)", color: AMBER, border: "1px solid rgba(245,158,11,0.25)" }}>
                              ⏳ Pending Review
                            </span>
                          )}
                        </div>

                        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 10, color: MUTED, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, padding: "2px 8px", borderRadius: 6 }}>
                            Font: {t.font}
                          </span>
                          {t.aiPrompt && (
                            <span style={{ fontSize: 10, color: "#8b5cf6", background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", padding: "2px 8px", borderRadius: 6 }}>
                              ✨ AI
                            </span>
                          )}
                        </div>

                        {/* Approve/Reject inline (for pending) */}
                        {t.isApproved === null && (
                          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                            <button onClick={() => handleApprove(t.id).then(() => setSysTmpls(p => p.map(x => x.id === t.id ? { ...x, isApproved: true } : x)))} style={{
                              flex: 1, padding: "6px 0", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer",
                              background: "rgba(34,197,94,0.15)", color: GREEN, border: "1px solid rgba(34,197,94,0.3)",
                            }}>✅ Approve</button>
                            <button onClick={() => handleReject(t.id).then(() => setSysTmpls(p => p.map(x => x.id === t.id ? { ...x, isApproved: false } : x)))} style={{
                              flex: 1, padding: "6px 0", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer",
                              background: "rgba(239,68,68,0.1)", color: RED, border: "1px solid rgba(239,68,68,0.25)",
                            }}>🚫 Reject</button>
                          </div>
                        )}

                        <div style={{ display: "flex", gap: 8 }}>
                          <a href={`/pro/template-builder?from=admin&editSystemTemplate=${t.id}`} style={{
                            flex: 1, background: SURFACE, border: `1px solid ${BORDER2}`,
                            color: TEXT, padding: "8px", borderRadius: 8, fontSize: 12,
                            cursor: "pointer", fontFamily: "'Inter', sans-serif",
                            textDecoration: "none", textAlign: "center", display: "flex",
                            alignItems: "center", justifyContent: "center", gap: 4,
                          }}>✏️ Edit</a>
                          <button onClick={() => handleDeleteTmpl(t.id)} style={{
                            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                            color: RED, padding: "8px 10px", borderRadius: 8, fontSize: 13,
                            cursor: "pointer",
                          }}>🗑️</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════ SETTINGS TAB ══════════ */}
        {activeTab === "settings" && (
          <div style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 24 }}>

            {/* ── Google OAuth ── */}
            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 32, height: 32, background: "rgba(255,255,255,0.06)", borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🔑</span>
                Google Sign-In
              </h3>
              <p style={{ fontSize: 13, color: MUTED, margin: "0 0 20px", lineHeight: 1.7 }}>
                Enable sign-in and registration via Google accounts. You need a Google OAuth 2.0 Client ID.
              </p>

              {googleSettings && (
                <div style={{
                  padding: "12px 16px", borderRadius: 10, marginBottom: 18,
                  background: googleSettings.hasClientId ? "rgba(34,197,94,0.07)" : "rgba(239,68,68,0.07)",
                  border: `1px solid ${googleSettings.hasClientId ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{googleSettings.hasClientId ? "✅" : "❌"}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: googleSettings.hasClientId ? GREEN : RED }}>
                        {googleSettings.hasClientId ? "Enabled" : "Disabled"}
                      </div>
                      {googleSettings.clientIdMasked && (
                        <div style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>{googleSettings.clientIdMasked}</div>
                      )}
                    </div>
                  </div>
                  {googleSettings.hasClientId && (
                    <button onClick={handleDeleteGoogle} disabled={settingsSaving === "google-del"}
                      style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: RED, padding: "6px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
                      Remove
                    </button>
                  )}
                </div>
              )}

              <label style={{ fontSize: 12, color: MUTED, display: "block", marginBottom: 8, fontWeight: 600 }}>
                New Google Client ID
              </label>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  type="text" value={newGoogleId} dir="ltr"
                  onChange={e => setNewGoogleId(e.target.value)}
                  placeholder="123456789-xxxx.apps.googleusercontent.com"
                  style={{ ...inputStyle, flex: 1, fontFamily: "monospace", fontSize: 12 }}
                  onFocus={e => e.currentTarget.style.borderColor = ACCENT}
                  onBlur={e => e.currentTarget.style.borderColor = BORDER}
                />
                <button onClick={handleSaveGoogle} disabled={settingsSaving === "google" || !newGoogleId.trim()} style={{
                  background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT3})`,
                  color: "#fff", border: "none", padding: "11px 20px",
                  borderRadius: 10, fontSize: 13, fontWeight: 700,
                  cursor: settingsSaving === "google" ? "wait" : "pointer",
                  fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap",
                  opacity: !newGoogleId.trim() ? 0.5 : 1,
                }}>{settingsSaving === "google" ? "⏳ Saving..." : "Save"}</button>
              </div>

              {settingsMsg?.key === "google" && (
                <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: settingsMsg.type === "ok" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                  color: settingsMsg.type === "ok" ? GREEN : RED,
                  border: `1px solid ${settingsMsg.type === "ok" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                }}>{settingsMsg.text}</div>
              )}

              <div style={{ marginTop: 16, padding: "12px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: `1px solid ${BORDER}` }}>
                <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.8, margin: 0 }}>
                  💡 To get Client ID: go to{" "}
                  <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" style={{ color: ACCENT2 }}>Google Cloud Console</a>
                  {" "}→ Create OAuth 2.0 Client ID → Add your site domain to "Authorized JavaScript origins".
                </p>
              </div>
            </div>

            {/* ── SMTP / Email ── */}
            {/* ── AI Image Generation Settings ── */}
            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 32, height: 32, background: "rgba(99,102,241,0.1)", borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✨</span>
                AI Image Generation
              </h3>
              <p style={{ fontSize: 13, color: MUTED, margin: "0 0 20px", lineHeight: 1.7 }}>
                Control the master switch and credit cost for AI image generation.
              </p>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: "12px 16px", background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, borderRadius: 10 }}>
                  <input type="checkbox" checked={aiSettings.enabled}
                    onChange={e => setAiSettings(s => ({ ...s, enabled: e.target.checked }))}
                    style={{ width: 18, height: 18, accentColor: ACCENT }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Enable AI Image Generation</div>
                    <div style={{ fontSize: 12, color: MUTED }}>Master switch to enable or disable the feature globally.</div>
                  </div>
                </label>
              {/* ── Points System Settings ── */}
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${BORDER}` }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 32, height: 32, background: "rgba(255,255,255,0.06)", borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⚙️</span>
                  إعدادات نظام النقاط - Points System Settings
                </h3>
                <p style={{ fontSize: 13, color: MUTED, margin: "0 0 20px", lineHeight: 1.7 }}>
                  تحكم في تكلفة النقاط لكل ميزة ومكافآت المستخدمين الجدد
                </p>

                {/* Cost Preview Box */}
                <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 16, marginBottom: 24, border: `1px solid ${BORDER}` }}>
                  <h4 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: ACCENT2 }}>💡 معاينة التكاليف - Cost Preview</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13, color: TEXT }}>
                    <div>• بطاقة بدون AI: <strong style={{ color: "#fff" }}>{aiSettings.baseCost}</strong> نقطة</div>
                    <div>• بطاقة مع صورة AI: <strong style={{ color: "#fff" }}>{aiSettings.baseCost + aiSettings.cost}</strong> نقطة</div>
                    <div>• نشر مقال: <strong style={{ color: "#fff" }}>{aiSettings.blogCost}</strong> نقطة</div>
                    <div style={{ color: GREEN }}>• مكافأة تسجيل جديد: <strong style={{ color: "#fff" }}>+{aiSettings.signupBonus}</strong> نقطة 🎁</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                  <div>
                    <label style={{ fontSize: 12, color: MUTED, display: "block", marginBottom: 7, fontWeight: 600 }}>إنشاء بطاقة (أساسي)</label>
                    <input type="number" value={aiSettings.baseCost} onChange={e => setAiSettings(s => ({ ...s, baseCost: parseInt(e.target.value) || 0 }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: MUTED, display: "block", marginBottom: 7, fontWeight: 600 }}>صورة ذكاء اصطناعي</label>
                    <input type="number" value={aiSettings.cost} onChange={e => setAiSettings(s => ({ ...s, cost: parseInt(e.target.value) || 0 }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: MUTED, display: "block", marginBottom: 7, fontWeight: 600 }}>نشر مقال مدونة</label>
                    <input type="number" value={aiSettings.blogCost} onChange={e => setAiSettings(s => ({ ...s, blogCost: parseInt(e.target.value) || 0 }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: MUTED, display: "block", marginBottom: 7, fontWeight: 600 }}>🎁 مكافأة التسجيل</label>
                    <input type="number" value={aiSettings.signupBonus} onChange={e => setAiSettings(s => ({ ...s, signupBonus: parseInt(e.target.value) || 0 }))} style={inputStyle} />
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", color: TEXT, fontSize: 14, fontWeight: 600 }}>
                  <input type="checkbox" checked={aiSettings.enabled} onChange={e => setAiSettings(s => ({ ...s, enabled: e.target.checked }))} />
                  تفعيل توليد الصور بالذكاء الاصطناعي - AI Image Generation Enabled
                </label>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, color: MUTED, display: "block", marginBottom: 7, fontWeight: 600 }}>حالة الخدمة - Service Status</label>
                <div style={{ display: "flex", gap: 12 }}>
                  <select value={aiSettings.status} onChange={e => setAiSettings(s => ({ ...s, status: e.target.value }))} style={{ ...inputStyle, width: "150px" }}>
                    <option value="operational">🟢 Operational</option>
                    <option value="degraded">🟡 Degraded</option>
                    <option value="offline">🔴 Offline</option>
                  </select>
                  <input type="text" value={aiSettings.statusMessage} onChange={e => setAiSettings(s => ({ ...s, statusMessage: e.target.value }))} placeholder="رسالة الحالة (مثلاً: تحت الصيانة)" style={{ ...inputStyle, flex: 1 }} />
                </div>
              </div>

              {(aiSettings.baseCost === 0 || aiSettings.cost === 0 || aiSettings.blogCost === 0) && (
                <div style={{ marginBottom: 20, padding: 12, borderRadius: 8, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: AMBER, fontSize: 13 }}>
                  ⚠️ تحذير: إحدى الميزات مجانية (تكلفة = 0). تأكد أن هذا مقصود.
                </div>
              )}

              <button onClick={handleSaveAISettings} disabled={settingsSaving === "ai"} style={{
                background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT3})`,
                color: "#fff", border: "none", padding: "12px 28px",
                borderRadius: 10, fontSize: 14, fontWeight: 700,
                cursor: settingsSaving === "ai" ? "wait" : "pointer",
                fontFamily: "'Inter', sans-serif",
              }}>{settingsSaving === "ai" ? "⏳ Saving..." : "💾 Save AI Settings"}</button>

              {settingsMsg?.key === "ai" && (
                <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: settingsMsg.type === "ok" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                  color: settingsMsg.type === "ok" ? GREEN : RED,
                  border: `1px solid ${settingsMsg.type === "ok" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                }}>{settingsMsg.text}</div>
              )}
            </div>

            {/* ── AI Image Provider Settings ── */}
            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 32, height: 32, background: "rgba(34,211,238,0.1)", borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🚀</span>
                AI Image Provider Settings
              </h3>
              <p style={{ fontSize: 13, color: MUTED, margin: "0 0 20px", lineHeight: 1.7 }}>
                Configure the provider and performance settings for the image generation engine.
              </p>

              {/* Section A: Provider Selection */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 12, color: MUTED, display: "block", marginBottom: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Image Generation Provider
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  {[
                    { id: "nanobanana", label: "Nanobanana", badge: "Free", badgeColor: GREEN, desc: "Free service - may be unstable" },
                    { id: "openai", label: "OpenAI DALL-E", badge: "Paid", badgeColor: ACCENT, desc: "Reliable paid service - requires API key" },
                    { id: "disabled", label: "Disabled", badge: "Off", badgeColor: MUTED, desc: "Disable image generation for all users" },
                  ].map(p => (
                    <button key={p.id} onClick={() => setProviderSettings(s => ({ ...s, provider: p.id }))} style={{
                      padding: "14px", borderRadius: 12, textAlign: "left", cursor: "pointer", border: "1px solid", transition: "all 0.2s",
                      background: providerSettings.provider === p.id ? "rgba(99,102,241,0.08)" : SURFACE,
                      borderColor: providerSettings.provider === p.id ? ACCENT : BORDER,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: providerSettings.provider === p.id ? "#fff" : TEXT }}>{p.label}</span>
                        <span style={{ fontSize: 10, fontWeight: 900, padding: "2px 6px", borderRadius: 6, background: `${p.badgeColor}20`, color: p.badgeColor, border: `1px solid ${p.badgeColor}40` }}>{p.badge}</span>
                      </div>
                      <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.4 }}>{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Section B: Nanobanana Settings */}
              {providerSettings.provider === "nanobanana" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: "20px", background: "rgba(255,255,255,0.02)", borderRadius: 14, border: `1px solid ${BORDER}`, marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ fontSize: 20 }}>🍌</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>Nanobanana Status</div>
                        <div style={{ display: "flex", gap: 12, marginBottom: 4 }}>
                          <div style={{ fontSize: 10, color: "#fb923c", background: "rgba(251,146,60,0.1)", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>
                            HOST: {getSafeHost(providerSettings.nanobanana.pageUrl)}
                          </div>
                          <div style={{ fontSize: 10, color: "#60a5fa", background: "rgba(96,165,250,0.1)", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>
                            MODEL: FLUX.1 [schnell]
                          </div>
                        </div>
                        {nbStatus?.lastTestResult ? (
                          <div style={{ fontSize: 11, color: MUTED }}>
                            Last tested {Math.round((Date.now() - new Date(nbStatus.lastTestResult.testedAt).getTime()) / 60000)}m ago • Latency: {nbStatus.lastTestResult.latencyMs}ms
                          </div>
                        ) : (
                          <div style={{ fontSize: 11, color: MUTED }}>Not tested yet</div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={handleClearNbCache} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, background: SURFACE, border: `1px solid ${BORDER}`, color: MUTED, cursor: "pointer" }}>Clear Cache</button>
                      <button onClick={handleTestNanobanana} disabled={nbTesting} style={{
                        padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                        background: nbStatus?.lastTestResult?.success ? "rgba(34,197,94,0.1)" : "rgba(99,102,241,0.1)",
                        color: nbStatus?.lastTestResult?.success ? GREEN : ACCENT,
                        border: `1px solid ${nbStatus?.lastTestResult?.success ? GREEN : ACCENT}40`
                      }}>
                        {nbTesting ? "Testing..." : nbStatus?.lastTestResult?.success ? "🟢 Connected" : nbStatus?.lastTestResult?.success === false ? "🔴 Disconnected" : "Test Connection"}
                      </button>
                    </div>
                  </div>

                  <div style={{ height: 1, background: BORDER, margin: "4px 0" }} />

                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 12 }}>Connection URLs</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 6 }}>Page URL</label>
                        <input type="text" value={providerSettings.nanobanana.pageUrl} onChange={e => setProviderSettings(s => ({ ...s, nanobanana: { ...s.nanobanana, pageUrl: e.target.value } }))} placeholder="https://veoaifree.com/..." style={inputStyle} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 6 }}>AJAX URL</label>
                        <input type="text" value={providerSettings.nanobanana.ajaxUrl} onChange={e => setProviderSettings(s => ({ ...s, nanobanana: { ...s.nanobanana, ajaxUrl: e.target.value } }))} placeholder="https://veoaifree.com/wp-admin/admin-ajax.php" style={inputStyle} />
                      </div>
                    </div>
                  </div>

                  <div style={{ height: 1, background: BORDER, margin: "4px 0" }} />

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                    <div>
                      <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 6 }}>Request Timeout (sec)</label>
                      <input type="number" value={providerSettings.nanobanana.timeoutS} onChange={e => setProviderSettings(s => ({ ...s, nanobanana: { ...s.nanobanana, timeoutS: parseInt(e.target.value) || 30 } }))} style={inputStyle} min={30} max={300} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 6 }}>Nonce Cache (min)</label>
                      <input type="number" value={providerSettings.nanobanana.nonceCacheMin} onChange={e => setProviderSettings(s => ({ ...s, nanobanana: { ...s.nanobanana, nonceCacheMin: parseInt(e.target.value) || 5 } }))} style={inputStyle} min={5} max={120} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 6 }}>Max Retry Count</label>
                      <input type="number" value={providerSettings.nanobanana.retryCount} onChange={e => setProviderSettings(s => ({ ...s, nanobanana: { ...s.nanobanana, retryCount: parseInt(e.target.value) || 1 } }))} style={inputStyle} min={1} max={5} />
                    </div>
                  </div>

                  <div style={{ height: 1, background: BORDER, margin: "4px 0" }} />

                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Request Queue</div>
                    <div style={{ fontSize: 11, color: MUTED, marginBottom: 12 }}>Control how concurrent requests are handled</div>
                    <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: "12px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: `1px solid ${BORDER}` }}>
                      <input type="checkbox" checked={providerSettings.nanobanana.queueEnabled} onChange={e => setProviderSettings(s => ({ ...s, nanobanana: { ...s.nanobanana, queueEnabled: e.target.checked } }))} style={{ width: 16, height: 16, accentColor: ACCENT }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Process one request at a time</div>
                        <div style={{ fontSize: 11, color: MUTED }}>Recommended for free services to avoid overload</div>
                      </div>
                    </label>
                    {!providerSettings.nanobanana.queueEnabled && (
                      <div style={{ marginTop: 12 }}>
                        <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 6 }}>Max Concurrent Requests</label>
                        <input type="number" value={providerSettings.nanobanana.maxConcurrent} onChange={e => setProviderSettings(s => ({ ...s, nanobanana: { ...s.nanobanana, maxConcurrent: parseInt(e.target.value) || 1 } }))} style={{ ...inputStyle, width: "100px" }} min={1} max={5} />
                      </div>
                    )}
                    {providerSettings.nanobanana.queueEnabled && (
                      <div style={{ marginTop: 12, padding: "10px", background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8, fontSize: 11, color: ACCENT }}>
                        ℹ️ Requests will be processed one at a time. Maximum wait time: 5 minutes.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Section C: OpenAI Settings */}
              {providerSettings.provider === "openai" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: "20px", background: "rgba(255,255,255,0.02)", borderRadius: 14, border: `1px solid ${BORDER}`, marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ fontSize: 20 }}>🤖</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>OpenAI API Configuration</div>
                        <div style={{ fontSize: 11, color: MUTED }}>DALL-E Integration</div>
                      </div>
                    </div>
                    <button onClick={handleTestOpenAI} disabled={oaTesting} style={{
                      padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                      background: "rgba(99,102,241,0.1)", color: ACCENT, border: `1px solid ${ACCENT}40`
                    }}>{oaTesting ? "Testing..." : "Test Connection"}</button>
                  </div>

                  <div style={{ height: 1, background: BORDER, margin: "4px 0" }} />

                  <div>
                    <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 6 }}>API Key</label>
                    <input type="password" value={providerSettings.openai.apiKey} onChange={e => setProviderSettings(s => ({ ...s, openai: { ...s.openai, apiKey: e.target.value } }))} placeholder="sk-..." style={inputStyle} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 6 }}>Model</label>
                      <select value={providerSettings.openai.model} onChange={e => setProviderSettings(s => ({ ...s, openai: { ...s.openai, model: e.target.value } }))} style={inputStyle}>
                        <option value="dall-e-3">DALL-E 3 (Recommended)</option>
                        <option value="dall-e-2">DALL-E 2 (Legacy)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 6 }}>Default Size</label>
                      <select value={providerSettings.openai.size} onChange={e => setProviderSettings(s => ({ ...s, openai: { ...s.openai, size: e.target.value } }))} style={inputStyle}>
                        <option value="1024x1024">1024x1024 (Square)</option>
                        <option value="1792x1024">1792x1024 (Landscape)</option>
                        <option value="1024x1792">1024x1792 (Portrait)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Section D: Fallback Settings */}
              {providerSettings.provider !== "disabled" && (
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: "16px", background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, borderRadius: 12 }}>
                    <input type="checkbox" checked={providerSettings.fallbackEnabled} onChange={e => setProviderSettings(s => ({ ...s, fallbackEnabled: e.target.checked }))} style={{ width: 18, height: 18, accentColor: ACCENT }} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>Enable Automatic Fallback</div>
                      <div style={{ fontSize: 12, color: MUTED }}>If primary provider fails, automatically try Nanobanana</div>
                    </div>
                  </label>
                </div>
              )}

              {/* Section E: Save Button */}
              <button onClick={handleSaveProviderSettings} disabled={settingsSaving === "provider"} style={{
                width: "100%", background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT3})`,
                color: "#fff", border: "none", padding: "14px", borderRadius: 12, fontSize: 15, fontWeight: 800,
                cursor: settingsSaving === "provider" ? "wait" : "pointer", boxShadow: `0 8px 24px ${ACCENT}30`
              }}>
                {settingsSaving === "provider" ? "⏳ Saving Configuration..." : "💾 Save Provider Settings"}
              </button>

              {settingsMsg?.key === "provider" && (
                <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                  background: settingsMsg.type === "ok" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                  color: settingsMsg.type === "ok" ? GREEN : RED,
                  border: `1px solid ${settingsMsg.type === "ok" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                }}>{settingsMsg.text}</div>
              )}
            </div>



            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 32, height: 32, background: "rgba(255,255,255,0.06)", borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📧</span>
                Email Settings (SMTP)
              </h3>
              <p style={{ fontSize: 13, color: MUTED, margin: "0 0 20px", lineHeight: 1.7 }}>
                Used for sending confirmation and password reset emails.
              </p>

              {smtpSettings && (
                <div style={{
                  padding: "12px 16px", borderRadius: 10, marginBottom: 18,
                  background: smtpSettings.hasCredentials ? "rgba(34,197,94,0.07)" : "rgba(245,158,11,0.07)",
                  border: `1px solid ${smtpSettings.hasCredentials ? "rgba(34,197,94,0.2)" : "rgba(245,158,11,0.2)"}`,
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{smtpSettings.hasCredentials ? "✅" : "⚠️"}</span>
                    <div style={{ fontSize: 13, fontWeight: 600, color: smtpSettings.hasCredentials ? GREEN : AMBER }}>
                      {smtpSettings.hasCredentials ? `Enabled — ${smtpSettings.user}` : "Credentials incomplete"}
                    </div>
                  </div>
                  {smtpSettings.hasCredentials && (
                    <button onClick={handleDeleteSMTP} disabled={settingsSaving === "smtp-del"}
                      style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: RED, padding: "6px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
                      Remove
                    </button>
                  )}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: MUTED, display: "block", marginBottom: 7, fontWeight: 600 }}>SMTP Host</label>
                  <input type="text" dir="ltr" placeholder="smtp.gmail.com" value={smtpForm.host}
                    onChange={e => setSmtpForm(f => ({ ...f, host: e.target.value }))}
                    style={{ ...inputStyle, fontFamily: "monospace", fontSize: 13 }}
                    onFocus={e => e.currentTarget.style.borderColor = ACCENT}
                    onBlur={e => e.currentTarget.style.borderColor = BORDER} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: MUTED, display: "block", marginBottom: 7, fontWeight: 600 }}>Port</label>
                  <input type="number" dir="ltr" placeholder="587" value={smtpForm.port}
                    onChange={e => setSmtpForm(f => ({ ...f, port: e.target.value }))}
                    style={{ ...inputStyle, fontFamily: "monospace", fontSize: 13 }}
                    onFocus={e => e.currentTarget.style.borderColor = ACCENT}
                    onBlur={e => e.currentTarget.style.borderColor = BORDER} />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: MUTED, display: "block", marginBottom: 7, fontWeight: 600 }}>Email (Sender)</label>
                <input type="email" dir="ltr" placeholder="yourmail@gmail.com" value={smtpForm.user}
                  onChange={e => setSmtpForm(f => ({ ...f, user: e.target.value }))}
                  style={{ ...inputStyle, fontFamily: "monospace", fontSize: 13 }}
                  onFocus={e => e.currentTarget.style.borderColor = ACCENT}
                  onBlur={e => e.currentTarget.style.borderColor = BORDER} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: MUTED, display: "block", marginBottom: 7, fontWeight: 600 }}>
                  Password{" "}
                  <span style={{ fontWeight: 400 }}>
                    (For Gmail: use{" "}
                    <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{ color: ACCENT2 }}>App Password</a>)
                  </span>
                </label>
                <input type="password" dir="ltr" placeholder={smtpSettings?.passMasked || "••••••••"} value={smtpForm.pass}
                  onChange={e => setSmtpForm(f => ({ ...f, pass: e.target.value }))}
                  style={{ ...inputStyle, fontFamily: "monospace", fontSize: 13 }}
                  onFocus={e => e.currentTarget.style.borderColor = ACCENT}
                  onBlur={e => e.currentTarget.style.borderColor = BORDER} />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 12, color: MUTED, display: "block", marginBottom: 7, fontWeight: 600 }}>
                  Sender Name <span style={{ fontWeight: 400 }}>(optional — e.g. NewsCard Pro)</span>
                </label>
                <input type="email" dir="ltr" placeholder={smtpForm.user || "sender@gmail.com"} value={smtpForm.from}
                  onChange={e => setSmtpForm(f => ({ ...f, from: e.target.value }))}
                  style={{ ...inputStyle, fontFamily: "monospace", fontSize: 13 }}
                  onFocus={e => e.currentTarget.style.borderColor = ACCENT}
                  onBlur={e => e.currentTarget.style.borderColor = BORDER} />
              </div>

              <button onClick={handleSaveSMTP} disabled={settingsSaving === "smtp"} style={{
                background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT3})`,
                color: "#fff", border: "none", padding: "12px 28px",
                borderRadius: 10, fontSize: 14, fontWeight: 700,
                cursor: settingsSaving === "smtp" ? "wait" : "pointer",
                fontFamily: "'Inter', sans-serif",
              }}>{settingsSaving === "smtp" ? "⏳ Saving..." : "💾 Save Settings"}</button>

              {settingsMsg?.key === "smtp" && (
                <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: settingsMsg.type === "ok" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                  color: settingsMsg.type === "ok" ? GREEN : RED,
                  border: `1px solid ${settingsMsg.type === "ok" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                }}>{settingsMsg.text}</div>
              )}

              {/* Test Email */}
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${BORDER}` }}>
                <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#fff" }}>🧪 Send Test Email</h4>
                <div style={{ display: "flex", gap: 10 }}>
                  <input type="email" dir="ltr" placeholder="test@example.com" value={testEmailTo}
                    onChange={e => setTestEmailTo(e.target.value)}
                    style={{ ...inputStyle, flex: 1, fontFamily: "monospace", fontSize: 13 }}
                    onFocus={e => e.currentTarget.style.borderColor = ACCENT2}
                    onBlur={e => e.currentTarget.style.borderColor = BORDER} />
                  <button onClick={handleTestEmail} disabled={settingsSaving === "test"} style={{
                    background: "rgba(34,211,238,0.1)", border: `1px solid rgba(34,211,238,0.25)`,
                    color: ACCENT2, padding: "11px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                    cursor: settingsSaving === "test" ? "wait" : "pointer",
                    fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap",
                  }}>{settingsSaving === "test" ? "⏳ Sending..." : "Send Test"}</button>
                </div>
                {settingsMsg?.key === "smtp-test" && (
                  <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                    background: settingsMsg.type === "ok" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                    color: settingsMsg.type === "ok" ? GREEN : RED,
                    border: `1px solid ${settingsMsg.type === "ok" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                  }}>{settingsMsg.text}</div>
                )}
              </div>
            </div>

          {/* ── Homepage Settings (full editor) ── */}
          <div style={{ marginTop: 28, padding: "22px 24px", background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER2}`, borderRadius: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: TEXT, marginBottom: 4 }}>🌐 Homepage Editor</div>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 20 }}>Edit all homepage content — leave any field empty to revert to default text</div>

            {/* Sub-tabs */}
            {(() => {
              const hpTabs: { k: typeof homepageTab; label: string }[] = [
                { k: "basic", label: "⚙️ Basic" },
                { k: "hero", label: "🦸 Hero" },
                { k: "features", label: "✨ Features" },
                { k: "stats", label: "📊 Stats" },
                { k: "steps", label: "🚀 Steps" },
                { k: "pricing", label: "💰 Pricing" },
              ];
              return (
                <div style={{ display: "flex", gap: 4, marginBottom: 20, flexWrap: "wrap" }}>
                  {hpTabs.map(tab => (
                    <button key={tab.k} onClick={() => setHomepageTab(tab.k)} style={{
                      padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                      cursor: "pointer", fontFamily: "'Inter', sans-serif",
                      background: homepageTab === tab.k ? `linear-gradient(135deg, ${ACCENT}, ${ACCENT3})` : SURFACE,
                      border: `1px solid ${homepageTab === tab.k ? "transparent" : BORDER2}`,
                      color: homepageTab === tab.k ? "#fff" : MUTED,
                    }}>{tab.label}</button>
                  ))}
                </div>
              );
            })()}

            {/* TAB: Basic */}
            {homepageTab === "basic" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                  <div>
                    <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 6 }}>Site Name</label>
                    <input type="text" value={homepageForm.siteName} onChange={e => setHomepageForm(p => ({ ...p, siteName: e.target.value }))}
                      placeholder="NewsCard Pro" style={{ ...inputStyle }}
                      onFocus={e => e.currentTarget.style.borderColor = ACCENT} onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 6 }}>Logo character</label>
                    <input type="text" value={homepageForm.siteLogo} onChange={e => setHomepageForm(p => ({ ...p, siteLogo: e.target.value }))}
                      placeholder="N" maxLength={3} style={{ ...inputStyle }}
                      onFocus={e => e.currentTarget.style.borderColor = ACCENT} onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 6 }}>Default Language</label>
                  <select value={homepageForm.defaultLang} onChange={e => setHomepageForm(p => ({ ...p, defaultLang: e.target.value }))}
                    style={{ ...inputStyle, appearance: "none" as const, width: "50%" }}>
                    <option value="en">English</option>
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                  </select>
                </div>
              </div>
            )}

            {/* TAB: Hero */}
            {homepageTab === "hero" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 6 }}>Badge text above title</label>
                  <input type="text" value={homepageForm.heroBadge} onChange={e => setHomepageForm(p => ({ ...p, heroBadge: e.target.value }))}
                    placeholder="The #1 choice for digital newsrooms" style={{ ...inputStyle }}
                    onFocus={e => e.currentTarget.style.borderColor = ACCENT} onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 6 }}>Main Headline (line 1)</label>
                  <input type="text" value={homepageForm.heroHeadline} onChange={e => setHomepageForm(p => ({ ...p, heroHeadline: e.target.value }))}
                    placeholder="Design news cards" style={{ ...inputStyle }}
                    onFocus={e => e.currentTarget.style.borderColor = ACCENT} onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 6 }}>Subtitle text</label>
                  <textarea value={homepageForm.heroSubtitle} onChange={e => setHomepageForm(p => ({ ...p, heroSubtitle: e.target.value }))}
                    placeholder="The most powerful SaaS platform for journalists..." rows={3}
                    style={{ ...inputStyle, resize: "vertical" as const }}
                    onFocus={e => e.currentTarget.style.borderColor = ACCENT} onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"} />
                </div>
              </div>
            )}

            {/* TAB: Features */}
            {homepageTab === "features" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 6 }}>Features section title</label>
                  <input type="text" value={homepageForm.featuresTitle} onChange={e => setHomepageForm(p => ({ ...p, featuresTitle: e.target.value }))}
                    placeholder="Everything you need for the digital newsroom" style={{ ...inputStyle }}
                    onFocus={e => e.currentTarget.style.borderColor = ACCENT} onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"} />
                </div>
                {([1,2,3,4,5,6] as const).map(n => (
                  <div key={n} style={{ padding: "14px", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: `1px solid ${BORDER}` }}>
                    <div style={{ fontSize: 11, color: ACCENT, fontWeight: 700, marginBottom: 10 }}>Feature {n}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 10, color: MUTED, display: "block", marginBottom: 5 }}>Title</label>
                        <input type="text" value={(homepageForm as Record<string,string>)[`f${n}t`]}
                          onChange={e => setHomepageForm(p => ({ ...p, [`f${n}t`]: e.target.value }))}
                          style={{ ...inputStyle, fontSize: 12 }}
                          onFocus={e => e.currentTarget.style.borderColor = ACCENT} onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: MUTED, display: "block", marginBottom: 5 }}>Description</label>
                        <input type="text" value={(homepageForm as Record<string,string>)[`f${n}d`]}
                          onChange={e => setHomepageForm(p => ({ ...p, [`f${n}d`]: e.target.value }))}
                          style={{ ...inputStyle, fontSize: 12 }}
                          onFocus={e => e.currentTarget.style.borderColor = ACCENT} onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB: Stats */}
            {homepageTab === "stats" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>Numbers and labels shown in the stats bar</div>
                {([
                  { n: "1", nl: "s1n", ll: "s1l" },
                  { n: "2", nl: "s2n", ll: "s2l" },
                  { n: "3", nl: "s3n", ll: "s3l" },
                  { n: "4", nl: "s4n", ll: "s4l" },
                ] as const).map(stat => (
                  <div key={stat.n} style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, padding: "12px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: `1px solid ${BORDER}` }}>
                    <div>
                      <label style={{ fontSize: 10, color: MUTED, display: "block", marginBottom: 5 }}>Number #{stat.n}</label>
                      <input type="text" dir="ltr" value={(homepageForm as Record<string,string>)[stat.nl]}
                        onChange={e => setHomepageForm(p => ({ ...p, [stat.nl]: e.target.value }))}
                        placeholder="+50K" style={{ ...inputStyle, fontSize: 13 }}
                        onFocus={e => e.currentTarget.style.borderColor = ACCENT} onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: MUTED, display: "block", marginBottom: 5 }}>Label</label>
                      <input type="text" value={(homepageForm as Record<string,string>)[stat.ll]}
                        onChange={e => setHomepageForm(p => ({ ...p, [stat.ll]: e.target.value }))}
                        placeholder="cards generated" style={{ ...inputStyle, fontSize: 13 }}
                        onFocus={e => e.currentTarget.style.borderColor = ACCENT} onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB: Steps + CTA */}
            {homepageTab === "steps" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 6 }}>"How it works" section title</label>
                  <input type="text" value={homepageForm.howTitle} onChange={e => setHomepageForm(p => ({ ...p, howTitle: e.target.value }))}
                    placeholder="Three simple steps" style={{ ...inputStyle }}
                    onFocus={e => e.currentTarget.style.borderColor = ACCENT} onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"} />
                </div>
                {([
                  { n: "1", ll: "st1l", dl: "st1d" },
                  { n: "2", ll: "st2l", dl: "st2d" },
                  { n: "3", ll: "st3l", dl: "st3d" },
                ] as const).map(s => (
                  <div key={s.n} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "12px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: `1px solid ${BORDER}` }}>
                    <div>
                      <label style={{ fontSize: 10, color: MUTED, display: "block", marginBottom: 5 }}>Step {s.n} — Title</label>
                      <input type="text" value={(homepageForm as Record<string,string>)[s.ll]}
                        onChange={e => setHomepageForm(p => ({ ...p, [s.ll]: e.target.value }))}
                        style={{ ...inputStyle, fontSize: 12 }}
                        onFocus={e => e.currentTarget.style.borderColor = ACCENT} onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: MUTED, display: "block", marginBottom: 5 }}>Description</label>
                      <input type="text" value={(homepageForm as Record<string,string>)[s.dl]}
                        onChange={e => setHomepageForm(p => ({ ...p, [s.dl]: e.target.value }))}
                        style={{ ...inputStyle, fontSize: 12 }}
                        onFocus={e => e.currentTarget.style.borderColor = ACCENT} onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"} />
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 10, padding: "14px", background: "rgba(99,102,241,0.05)", borderRadius: 10, border: `1px solid rgba(99,102,241,0.2)` }}>
                  <div style={{ fontSize: 12, color: ACCENT, fontWeight: 700, marginBottom: 12 }}>🎯 Call-to-Action Banner (CTA)</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 10, color: MUTED, display: "block", marginBottom: 5 }}>Title</label>
                      <input type="text" value={homepageForm.ctaTitle} onChange={e => setHomepageForm(p => ({ ...p, ctaTitle: e.target.value }))}
                        placeholder="Start Now — Free" style={{ ...inputStyle }}
                        onFocus={e => e.currentTarget.style.borderColor = ACCENT} onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: MUTED, display: "block", marginBottom: 5 }}>Subtitle text</label>
                      <input type="text" value={homepageForm.ctaSubtitle} onChange={e => setHomepageForm(p => ({ ...p, ctaSubtitle: e.target.value }))}
                        placeholder="No credit card required..." style={{ ...inputStyle }}
                        onFocus={e => e.currentTarget.style.borderColor = ACCENT} onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: Pricing */}
            {homepageTab === "pricing" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Info box */}
                <div style={{ padding: "12px 16px", background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 10, fontSize: 12, color: ACCENT2 }}>
                  ⚡ <strong>Smart sync:</strong> Features and prices are pulled automatically from the <strong>Plans</strong> tab — any edit there reflects instantly on the homepage.
                </div>

                {/* Global fields */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 6 }}>Section Title</label>
                    <input type="text" value={homepageForm.pricingTitle} onChange={e => setHomepageForm(p => ({ ...p, pricingTitle: e.target.value }))}
                      placeholder="Plans for every need" style={{ ...inputStyle }}
                      onFocus={e => e.currentTarget.style.borderColor = ACCENT} onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 6 }}>Section Badge</label>
                    <input type="text" value={homepageForm.pricingBadge} onChange={e => setHomepageForm(p => ({ ...p, pricingBadge: e.target.value }))}
                      placeholder="Pricing" style={{ ...inputStyle }}
                      onFocus={e => e.currentTarget.style.borderColor = ACCENT} onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 6 }}>Subscribe button text</label>
                    <input type="text" value={homepageForm.pricingCta} onChange={e => setHomepageForm(p => ({ ...p, pricingCta: e.target.value }))}
                      placeholder="Start Now" style={{ ...inputStyle }}
                      onFocus={e => e.currentTarget.style.borderColor = ACCENT} onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 6 }}>Billing period text</label>
                    <input type="text" dir="ltr" value={homepageForm.pricingPeriod} onChange={e => setHomepageForm(p => ({ ...p, pricingPeriod: e.target.value }))}
                      placeholder="/ month" style={{ ...inputStyle }}
                      onFocus={e => e.currentTarget.style.borderColor = ACCENT} onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 6 }}>"Most Popular" badge text</label>
                    <input type="text" value={homepageForm.pricingPopular} onChange={e => setHomepageForm(p => ({ ...p, pricingPopular: e.target.value }))}
                      placeholder="Most Popular" style={{ ...inputStyle }}
                      onFocus={e => e.currentTarget.style.borderColor = ACCENT} onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 6 }}>
                      Featured plan (slug) <span style={{ color: "rgba(255,255,255,0.3)" }}>— gets the colored border</span>
                    </label>
                    <input type="text" dir="ltr" value={homepageForm.popularSlug} onChange={e => setHomepageForm(p => ({ ...p, popularSlug: e.target.value }))}
                      placeholder="pro" style={{ ...inputStyle }}
                      onFocus={e => e.currentTarget.style.borderColor = ACCENT} onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"} />
                  </div>
                </div>

                {/* Per-plan href from actual plans */}
                {adminPlans.length > 0 && (
                  <div style={{ padding: "14px 16px", background: "rgba(255,255,255,0.02)", borderRadius: 12, border: `1px solid ${BORDER}` }}>
                    <div style={{ fontSize: 12, color: TEXT, fontWeight: 700, marginBottom: 14 }}>🔗 "Start Now" button links per plan</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {adminPlans.filter(p => p.is_active).map(plan => (
                        <div key={plan.id} style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 10, alignItems: "center" }}>
                          <div style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>
                            {plan.name} <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>({plan.slug})</span>
                          </div>
                          <input type="text" dir="ltr"
                            value={planHrefs[`${plan.slug}_href`] || ""}
                            onChange={e => setPlanHrefs(h => ({ ...h, [`${plan.slug}_href`]: e.target.value }))}
                            placeholder={plan.slug === "free" ? "opens free tool" : "/pro/register"}
                            style={{ ...inputStyle, fontSize: 12 }}
                            onFocus={e => e.currentTarget.style.borderColor = ACCENT} onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Live preview of plan features */}
                {adminPlans.length > 0 && (
                  <div style={{ padding: "14px 16px", background: "rgba(255,255,255,0.02)", borderRadius: 12, border: `1px solid ${BORDER}` }}>
                    <div style={{ fontSize: 12, color: MUTED, fontWeight: 700, marginBottom: 12 }}>👁 Plan features preview (auto-fetched)</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {adminPlans.filter(p => p.is_active).map(plan => (
                        <div key={plan.id} style={{ padding: "10px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: `1px solid ${BORDER}` }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 6 }}>{plan.name} — <span style={{ color: MUTED, fontFamily: "monospace" }}>${plan.price_monthly}/mo</span></div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {[
                              `${plan.monthly_credits} credits/mo`,
                              `${plan.rate_limit_daily}/day limit`,
                              plan.max_templates > 0 && `${plan.max_templates === -1 ? "All" : plan.max_templates} templates`,
                              plan.has_api_access && "API",
                              plan.has_telegram_bot && "Telegram Bot",
                              plan.has_overlay_upload && "Overlay upload",
                              plan.has_custom_watermark && "Custom watermark",
                              plan.has_blog_automation && "Blog automation",
                            ].filter(Boolean).map((f, i) => (
                              <span key={i} style={{ fontSize: 11, color: ACCENT2, background: "rgba(34,211,238,0.06)", padding: "2px 8px", borderRadius: 99, border: "1px solid rgba(34,211,238,0.15)" }}>{f}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: 20, display: "flex", gap: 12, alignItems: "center" }}>
              <button onClick={handleSaveHomepage} disabled={homepageSaving} style={{
                background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT3})`,
                color: "#fff", border: "none", padding: "11px 28px",
                borderRadius: 10, fontSize: 13, fontWeight: 700,
                cursor: homepageSaving ? "wait" : "pointer", fontFamily: "'Inter', sans-serif",
              }}>{homepageSaving ? "⏳ Saving..." : "💾 Save All Settings"}</button>
              <button onClick={() => setHomepageForm(EMPTY_HF)} style={{
                background: SURFACE, border: `1px solid ${BORDER2}`, color: MUTED,
                padding: "11px 18px", borderRadius: 10, fontSize: 12, cursor: "pointer", fontFamily: "'Inter', sans-serif",
              }}>🔄 Reset</button>
            </div>

            {homepageMsg && (
              <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: homepageMsg.type === "ok" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                color: homepageMsg.type === "ok" ? GREEN : RED,
                border: `1px solid ${homepageMsg.type === "ok" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
              }}>{homepageMsg.text}</div>
            )}
          </div>

          </div>
        </div>
        )}

        {/* ══════════ PAYMENTS TAB ══════════ */}
        {activeTab === "payments" && (
          <div style={{ maxWidth: 900, display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Filter bar */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {(["pending", "approved", "rejected", "all"] as const).map(f => (
                <button key={f} onClick={() => setPayFilter(f)} style={{
                  padding: "7px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", fontFamily: "'Inter', sans-serif",
                  border: payFilter === f ? "1px solid rgba(99,102,241,0.5)" : `1px solid ${BORDER}`,
                  background: payFilter === f ? "rgba(99,102,241,0.15)" : SURFACE,
                  color: payFilter === f ? ACCENT : MUTED,
                  transition: "all 0.15s",
                }}>
                  {f === "pending" ? "⏳ Pending" : f === "approved" ? "✅ Approved" : f === "rejected" ? "❌ Rejected" : "🗂 All"}
                </button>
              ))}
              <button onClick={() => loadPayReqs(payFilter)} style={{
                marginLeft: "auto", padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: "'Inter', sans-serif",
                border: `1px solid ${BORDER}`, background: SURFACE, color: MUTED,
              }}>🔄 Refresh</button>
            </div>

            {payMsg && (
              <div style={{ padding: "11px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                background: payMsg.type === "ok" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                color: payMsg.type === "ok" ? GREEN : RED,
                border: `1px solid ${payMsg.type === "ok" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
              }}>{payMsg.text}</div>
            )}

            {payLoading ? (
              <div style={{ textAlign: "center", color: MUTED, padding: 40 }}>Loading...</div>
            ) : payReqs.length === 0 ? (
              <div style={{ ...cardStyle, textAlign: "center", padding: 48, color: MUTED }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>No {payFilter === "all" ? "" : payFilter} payment requests</div>
              </div>
            ) : payReqs.map(req => {
              const isPending = req.status === "pending";
              const statusColor = req.status === "approved" ? GREEN : req.status === "rejected" ? RED : AMBER;
              const isProofImage = req.proofDetails?.startsWith("data:image");
              return (
                <div key={req.id} style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
                    {/* Left info */}
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>#{req.id}</span>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 99,
                          background: req.status === "approved" ? "rgba(34,197,94,0.1)" : req.status === "rejected" ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)",
                          color: statusColor, border: `1px solid ${statusColor}40`,
                        }}>{req.status.toUpperCase()}</span>
                        <span style={{ fontSize: 11, color: MUTED, marginLeft: "auto" }}>
                          {new Date(req.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 4 }}>
                        {req.type === "plan_upgrade" ? `Plan upgrade → ${req.planName ?? req.planSlug ?? `Plan #${req.planId}`}` : `Points purchase: +${req.pointsAmount?.toLocaleString()} credits`}
                      </div>
                      <div style={{ fontSize: 12, color: MUTED }}>
                        👤 {req.userName ?? "Unknown"} &nbsp;·&nbsp; {req.userEmail ?? "no email"} &nbsp;·&nbsp; Current plan: <span style={{ color: ACCENT }}>{req.userPlan}</span>
                      </div>
                      <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                        💳 Payment method: <span style={{ color: TEXT, fontWeight: 600 }}>{req.paymentMethod}</span>
                      </div>
                    </div>
                  </div>

                  {/* Proof of payment */}
                  <div>
                    <button onClick={() => setExpandedProof(expandedProof === req.id ? null : req.id)} style={{
                      padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      border: `1px solid ${BORDER}`, background: SURFACE, color: MUTED,
                      cursor: "pointer", fontFamily: "'Inter', sans-serif",
                    }}>
                      {expandedProof === req.id ? "▲ Hide Proof" : "▼ View Payment Proof"}
                    </button>
                    {expandedProof === req.id && (
                      <div style={{ marginTop: 12, padding: "14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
                        {isProofImage ? (
                          <img src={req.proofDetails} alt="Payment proof" style={{ maxWidth: "100%", maxHeight: 400, borderRadius: 8, objectFit: "contain" }} />
                        ) : (
                          <pre style={{ margin: 0, fontSize: 12, color: TEXT, whiteSpace: "pre-wrap", wordBreak: "break-all", lineHeight: 1.6 }}>{req.proofDetails}</pre>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Admin notes + action buttons */}
                  {isPending && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 10, borderTop: `1px solid ${BORDER}` }}>
                      <textarea
                        placeholder="Admin notes (optional)..."
                        value={payNotes[req.id] ?? ""}
                        onChange={e => setPayNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                        rows={2}
                        style={{
                          width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 13,
                          background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`,
                          color: TEXT, fontFamily: "'Inter', sans-serif", resize: "vertical",
                          boxSizing: "border-box",
                        }}
                      />
                      <div style={{ display: "flex", gap: 10 }}>
                        <button
                          disabled={payActionId === req.id}
                          onClick={() => handlePayAction(req.id, "approve")}
                          style={{
                            padding: "9px 22px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                            cursor: payActionId === req.id ? "not-allowed" : "pointer",
                            fontFamily: "'Inter', sans-serif",
                            background: payActionId === req.id ? "rgba(34,197,94,0.05)" : "rgba(34,197,94,0.12)",
                            border: "1px solid rgba(34,197,94,0.3)", color: GREEN,
                            opacity: payActionId === req.id ? 0.6 : 1,
                          }}>
                          {payActionId === req.id ? "Processing..." : "✅ Approve"}
                        </button>
                        <button
                          disabled={payActionId === req.id}
                          onClick={() => handlePayAction(req.id, "deny")}
                          style={{
                            padding: "9px 22px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                            cursor: payActionId === req.id ? "not-allowed" : "pointer",
                            fontFamily: "'Inter', sans-serif",
                            background: payActionId === req.id ? "rgba(239,68,68,0.05)" : "rgba(239,68,68,0.1)",
                            border: "1px solid rgba(239,68,68,0.25)", color: RED,
                            opacity: payActionId === req.id ? 0.6 : 1,
                          }}>
                          ❌ Reject
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Show admin notes if already processed */}
                  {!isPending && req.adminNotes && (
                    <div style={{ fontSize: 12, color: MUTED, paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
                      <span style={{ fontWeight: 700, color: TEXT }}>Admin notes:</span> {req.adminNotes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        </main>
      </div>
    </div>
  );
}
