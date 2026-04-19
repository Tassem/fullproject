import { useState, useRef, useCallback, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Zap, Image as ImageIcon, Sparkles, Move, Save, Send, Type, Palette, Settings2, Share2, AlertCircle, CheckCircle2, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
// ─── Constants (mirror original) ──────────────────────────────────────────────

const DEFAULT_HEADLINE =
  "Trump Sets 8 PM Tuesday Eastern Time as Deadline for Iran";

const ARABIC_FONTS = [
  { value: "Cairo", label: "Cairo" },
  { value: "Tajawal", label: "Tajawal" },
  { value: "Noto Kufi Arabic", label: "Noto Kufi Arabic" },
  { value: "Amiri", label: "Amiri" },
  { value: "Reem Kufi", label: "Reem Kufi" },
  { value: "IBM Plex Arabic", label: "IBM Plex Arabic" },
  { value: "Lateef", label: "Lateef" },
];

interface Template {
  id: string;
  name: string;
  bannerColor: string;
  bannerGradient?: string;
  labelColor: string;
  textColor: string;
  photoHeight: number;
  showQuote?: boolean;
  bannerBorderRadius?: string;
  isLight?: boolean;
  accentColor?: string;
}

const TEMPLATES: Template[] = [
  { id: "classic-blue",  name: "Classic",      bannerColor: "#0f2557",  labelColor: "rgba(255,255,255,0.85)", textColor: "#ffffff", photoHeight: 62 },
  { id: "breaking-red",  name: "Breaking",        bannerColor: "#7f1d1d",  bannerGradient: "linear-gradient(135deg,#991b1b,#7f1d1d)", labelColor: "rgba(255,255,255,0.85)", textColor: "#ffffff", photoHeight: 60 },
  { id: "modern-black",  name: "Modern",       bannerColor: "#0a0a0a",  bannerGradient: "linear-gradient(180deg,rgba(0,0,0,0) 0%,#000000 100%)", labelColor: "rgba(255,255,255,0.7)", textColor: "#f5f5f5", photoHeight: 70 },
  { id: "emerald",       name: "Emerald",        bannerColor: "#064e3b",  bannerGradient: "linear-gradient(135deg,#065f46,#064e3b)", labelColor: "rgba(255,255,255,0.85)", textColor: "#ffffff", photoHeight: 62 },
  { id: "royal-purple",  name: "Royal",        bannerColor: "#3b0764",  bannerGradient: "linear-gradient(135deg,#4c1d95,#3b0764)", labelColor: "rgba(255,255,255,0.85)", textColor: "#ffffff", photoHeight: 60 },
  { id: "gold",          name: "Gold",        bannerColor: "#78350f",  bannerGradient: "linear-gradient(135deg,#92400e,#78350f)", labelColor: "rgba(255,255,255,0.85)", textColor: "#fef3c7", photoHeight: 62 },
  { id: "midnight",      name: "Midnight",        bannerColor: "#1e1b4b",  bannerGradient: "linear-gradient(135deg,#312e81,#1e1b4b)", labelColor: "rgba(255,255,255,0.75)", textColor: "#e0e7ff", photoHeight: 60 },
  { id: "slate-fade",    name: "Gradient",        bannerColor: "transparent", bannerGradient: "linear-gradient(to top,rgba(2,6,23,0.95) 0%,rgba(2,6,23,0.6) 60%,transparent 100%)", labelColor: "rgba(255,255,255,0.85)", textColor: "#ffffff", photoHeight: 100 },
  { id: "white-quote",   name: "White",       bannerColor: "#ffffff",  labelColor: "rgba(0,0,0,0.45)", textColor: "#111111", photoHeight: 58, showQuote: true, isLight: true, accentColor: "#dc2626" },
  { id: "purple-wave",   name: "Purple Wave",bannerColor: "#7c3aed",  bannerGradient: "linear-gradient(135deg,#8b5cf6 0%,#5b21b6 100%)", labelColor: "rgba(255,255,255,0.8)", textColor: "#ffffff", photoHeight: 60, bannerBorderRadius: "28px 28px 0 0" },
  { id: "crimson",       name: "Crimson",       bannerColor: "#dc2626",  labelColor: "rgba(255,255,255,0.9)", textColor: "#ffffff", photoHeight: 62 },
  { id: "custom",        name: "Custom",        bannerColor: "#0f2557",  labelColor: "rgba(255,255,255,0.85)", textColor: "#ffffff", photoHeight: 62 },
  // ── New templates ──
  { id: "news-social",   name: "News + Strip",  bannerColor: "#ffffff",  labelColor: "rgba(0,0,0,0.45)", textColor: "#111111", photoHeight: 57, showQuote: true, isLight: true, accentColor: "#dc2626" },
  { id: "wave-white",    name: "White Wave",  bannerColor: "#ffffff",  labelColor: "rgba(0,0,0,0.4)",  textColor: "#111111", photoHeight: 65, isLight: true },
  { id: "wave-blue",     name: "Blue Wave",  bannerColor: "#0f2557",  labelColor: "rgba(255,255,255,0.85)", textColor: "#ffffff", photoHeight: 65 },
  { id: "ocean",         name: "Ocean",         bannerColor: "#0c4a6e",  bannerGradient: "linear-gradient(135deg,#0369a1,#0c4a6e)", labelColor: "rgba(255,255,255,0.8)", textColor: "#e0f2fe", photoHeight: 60 },
  { id: "amber",         name: "Amber",         bannerColor: "#d97706",  bannerGradient: "linear-gradient(135deg,#f59e0b,#d97706)", labelColor: "rgba(255,255,255,0.85)", textColor: "#ffffff", photoHeight: 62 },
  { id: "rose",          name: "Rose",         bannerColor: "#9f1239",  bannerGradient: "linear-gradient(135deg,#be123c,#9f1239)", labelColor: "rgba(255,255,255,0.85)", textColor: "#fff1f2", photoHeight: 60 },
  { id: "teal",          name: "Teal",       bannerColor: "#0f766e",  bannerGradient: "linear-gradient(135deg,#0d9488,#0f766e)", labelColor: "rgba(255,255,255,0.85)", textColor: "#f0fdfa", photoHeight: 62 },
  { id: "dark-social",   name: "Dark + Strip",  bannerColor: "#18181b",  labelColor: "rgba(255,255,255,0.7)", textColor: "#f4f4f5", photoHeight: 60 },
  { id: "overlay-only",  name: "Custom Design",  bannerColor: "transparent", bannerGradient: "none", labelColor: "rgba(255,255,255,0.85)", textColor: "#ffffff", photoHeight: 100 },
];

const ASPECT_RATIOS = {
  "1:1":  { w: 480, h: 480,  label: "Square 1:1",    export: "1080×1080" },
  "16:9": { w: 480, h: 270,  label: "Landscape 16:9",   export: "1080×608"  },
  "4:5":  { w: 480, h: 600,  label: "Portrait 4:5", export: "1080×1350" },
  "9:16": { w: 270, h: 480,  label: "Story 9:16",  export: "750×1334"  },
} as const;
type AspectRatio = keyof typeof ASPECT_RATIOS;
type LogoPos = "top-right" | "top-left" | "bottom-right" | "bottom-left";
type TabId = "content" | "design" | "saved" | "typography" | "api" | "settings";

// ── Canvas free-positioning editor ─────────────────────────────────────────
type ElemKey = "headline" | "subtitle" | "label" | "logo";
interface ElemRect { x: number; y: number; w: number; }   // %, %, %
type CanvasLayout = Record<ElemKey, ElemRect>;
const CANVAS_DEFAULT: CanvasLayout = {
  headline: { x: 4,  y: 63, w: 92 },
  subtitle:  { x: 4,  y: 79, w: 92 },
  label:     { x: 4,  y: 88, w: 42 },
  logo:      { x: 74, y: 3,  w: 22 },
};

interface SavedDesign {
  id: string;
  name: string;
  createdAt: number;
  settings: {
    selectedTemplateId: string;
    aspectRatio: AspectRatio;
    font: string;
    fontSize: number;
    fontWeight: number;
    textShadow: boolean;
    logoPos: LogoPos;
    logoInvert: boolean;
    useLogoText: boolean;
    logoText: string;
    showSubtitle: boolean;
    showLabel: boolean;
    imgPositionX: number;
    imgPositionY: number;
    customBannerColor: string;
    customTextColor: string;
    customPhotoHeight: number;
    // content
    headline: string;
    subtitle: string;
    label: string;
    // logo image (base64) — saved so it reloads with the design
    logoImage: string | null;
    // overlay image (base64) — saved so it reloads with the design
    overlayImage: string | null;
    overlayPhotoFilename: string | null;
    // Canvas free-positioning
    canvasMode: boolean;
    canvasLayout: CanvasLayout;
  };
}

interface ApiTemplate {
  id: number;
  name: string;
  slug: string | null;
  aspectRatio: string;
  bannerColor: string;
  bannerGradient: string | null;
  textColor: string;
  labelColor: string;
  font: string;
  fontSize: number;
  fontWeight: number;
  photoHeight: number;
  subtitle: string | null;
  label: string | null;
  logoText: string | null;
  logoUrl: string | null;
  logoPos: string;
  logoInvert: boolean;
  textShadow: boolean;
  isPublic: boolean;
  createdAt: string;
  headlineAlign?: string | null;
  subtitleAlign?: string | null;
  labelAlign?: string | null;
  watermarkText?: string | null;
  watermarkOpacity?: number | null;
  showSubtitle?: boolean | null;
  showLabel?: boolean | null;
  useLogoText?: boolean | null;
  canvasLayout?: CanvasLayout | null;
  overlayUrl?: string | null;
}

function loadSaved() {
  try { return JSON.parse(localStorage.getItem("ncg-pro-settings") || "{}"); }
  catch { return {}; }
}
function loadDesigns(): SavedDesign[] {
  try {
    const all: SavedDesign[] = JSON.parse(localStorage.getItem("ncg-pro-designs") || "[]");
    const seen = new Set<string>();
    return all.filter(d => { if (seen.has(d.id)) return false; seen.add(d.id); return true; });
  } catch { return []; }
}


// ─── Main component ───────────────────────────────────────────────────────────
export default function Generate() {
  const s = useRef(loadSaved()).current;
  const { data: user } = useGetMe({ query: { enabled: !!localStorage.getItem("pro_token"), queryKey: getGetMeQueryKey(), staleTime: 0, refetchOnWindowFocus: true } });
  const { toast } = useToast();

  // Content state
  const [bgImage, setBgImage]           = useState<string | null>(null);
  const [bgFile,  setBgFile]            = useState<File | null>(null);
  const [bgFileName, setBgFileName]     = useState("");
  const [bgServerFilename, setBgServerFilename] = useState("");
  const [logoServerFilename, setLogoServerFilename] = useState("");
  const [logoImage, setLogoImage]       = useState<string | null>(null);
  const [logoFileName, setLogoFileName] = useState("");
  // Custom overlay PNG (frame on top of card)
  const [overlayImage, setOverlayImage]     = useState<string | null>(null);
  const [overlayFileName, setOverlayFileName] = useState("");
  const [overlayServerFilename, setOverlayServerFilename] = useState("");
  const [headline, setHeadline]         = useState<string>(s.headline ?? DEFAULT_HEADLINE);
  const [subtitle, setSubtitle]         = useState<string>(s.subtitle ?? "");
  const [label, setLabel]               = useState<string>(s.label ?? "");
  const [showSubtitle, setShowSubtitle] = useState<boolean>(s.showSubtitle ?? false);
  const [showLabel, setShowLabel]       = useState<boolean>(s.showLabel ?? false);

  // Design state
  const [activeTab, setActiveTab]           = useState<TabId>("content");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(s.selectedTemplateId ?? "breaking-red");
  const [aspectRatio, setAspectRatio]       = useState<AspectRatio>(s.aspectRatio ?? "1:1");
  const [customBannerColor, setCustomBannerColor] = useState<string>(s.customBannerColor ?? "#ff0000");
  const [customTextColor, setCustomTextColor] = useState<string>(s.customTextColor ?? "#ffffff");
  const [customPhotoHeight, setCustomPhotoHeight] = useState<number>(s.customPhotoHeight ?? 62);

  // Typography state
  const [font, setFont]               = useState<string>(s.font ?? "Cairo");
  const [fontSize, setFontSize]       = useState<number>(s.fontSize ?? 26);
  const [fontWeight, setFontWeight]   = useState<number>(s.fontWeight ?? 700);
  const [textShadow, setTextShadow]   = useState<boolean>(s.textShadow ?? false);
  // Text alignment per element
  type TextAlign = "right" | "center" | "left";
  const [headlineAlign, setHeadlineAlign] = useState<TextAlign>(s.headlineAlign ?? "right");
  const [subtitleAlign, setSubtitleAlign] = useState<TextAlign>(s.subtitleAlign ?? "right");
  const [labelAlign, setLabelAlign]       = useState<TextAlign>(s.labelAlign ?? "right");
  // Watermark
  const [watermarkText, setWatermarkText]       = useState<string>(s.watermarkText ?? "");
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(s.watermarkOpacity ?? 0.18);

  // Logo state
  const [logoPos, setLogoPos]         = useState<LogoPos>(s.logoPos ?? "top-right");
  const [useLogoText, setUseLogoText] = useState<boolean>(s.useLogoText ?? false);
  const [logoText, setLogoText]       = useState<string>(s.logoText ?? "");
  const [logoInvert, setLogoInvert]   = useState<boolean>(s.logoInvert ?? false);

  // Image position
  const [imgPositionX, setImgPositionX] = useState<number>(s.imgPositionX ?? 50);
  const [imgPositionY, setImgPositionY] = useState<number>(s.imgPositionY ?? 50);

  // ── Canvas free-positioning state ──────────────────────────────────────────
  const [canvasMode, setCanvasMode]     = useState<boolean>(s.canvasMode ?? false);
  const [canvasLayout, setCanvasLayout] = useState<CanvasLayout>(s.canvasLayout ? { ...CANVAS_DEFAULT, ...s.canvasLayout } : CANVAS_DEFAULT);
  const [selElem, setSelElem]           = useState<ElemKey | null>(null);

  // Saved designs (local)
  const [savedDesigns, setSavedDesigns] = useState<SavedDesign[]>(loadDesigns());
  const [saveNameInput, setSaveNameInput] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

  // API Templates (server-side, reusable via ID/slug)
  const [apiTemplates, setApiTemplates] = useState<ApiTemplate[]>([]);
  const [showApiTemplateSave, setShowApiTemplateSave] = useState(false);
  const [apiTplName, setApiTplName] = useState("");
  const [apiTplSlug, setApiTplSlug] = useState("");
  const [apiTplSaving, setApiTplSaving] = useState(false);
  const [editingTplId, setEditingTplId] = useState<number | null>(null);

  // Download state
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSendingTg, setIsSendingTg] = useState(false);

  // API tab state
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [botStatus, setBotStatus] = useState<null | { username: string }>(null);
  const [apiKey, setApiKey] = useState("");
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [apiKeyRegenerating, setApiKeyRegenerating] = useState(false);

  // User state
  const [userName, setUserName] = useState("...");

  const bgInputRef      = useRef<HTMLInputElement>(null);
  const logoInputRef    = useRef<HTMLInputElement>(null);
  const overlayInputRef = useRef<HTMLInputElement>(null);
  const importRef       = useRef<HTMLInputElement>(null);
  const cardRef         = useRef<HTMLDivElement>(null);
  const dragRef  = useRef<{ key: ElemKey; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const rszRef   = useRef<{ key: ElemKey; sx: number; ow: number; cw: number } | null>(null);

  // ── Load system template from localStorage (navigated from Templates gallery) ─
  useEffect(() => {
    const raw = localStorage.getItem("ncg_system_template");
    if (!raw) return;
    localStorage.removeItem("ncg_system_template");
    try {
      const tmpl = JSON.parse(raw);
      if (tmpl.bannerColor) setCustomBannerColor(tmpl.bannerColor);
      if (tmpl.textColor)   setCustomTextColor(tmpl.textColor);
      if (tmpl.font)        setFont(tmpl.font);
      if (tmpl.photoHeight) setCustomPhotoHeight(tmpl.photoHeight);
      if (typeof tmpl.isLight === "boolean" && tmpl.isLight) {
        setCustomBannerColor(tmpl.bannerColor || "#ffffff");
      }
      setSelectedTemplateId("custom");
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load API template from ?templateId=<id> URL param ────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tplId = params.get("templateId");
    if (!tplId) return;
    const token = localStorage.getItem("pro_token");
    fetch(`/api/templates/${tplId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then((tpl: ApiTemplate | null) => {
        if (!tpl) return;
        // Apply all saved template settings to the generator state
        if (tpl.aspectRatio && Object.keys(ASPECT_RATIOS).includes(tpl.aspectRatio))
          setAspectRatio(tpl.aspectRatio as AspectRatio);
        if (tpl.font)             setFont(tpl.font);
        if (tpl.fontSize)         setFontSize(tpl.fontSize);
        if (tpl.fontWeight)       setFontWeight(tpl.fontWeight);
        if (typeof tpl.textShadow === "boolean") setTextShadow(tpl.textShadow);
        setCustomBannerColor(tpl.bannerColor);
        setCustomTextColor(tpl.textColor);
        if (tpl.photoHeight)      setCustomPhotoHeight(tpl.photoHeight);
        setSelectedTemplateId("custom");
        if (tpl.logoPos && ["top-right","top-left","bottom-right","bottom-left"].includes(tpl.logoPos))
          setLogoPos(tpl.logoPos as LogoPos);
        if (typeof tpl.logoInvert === "boolean") setLogoInvert(tpl.logoInvert);
        if (tpl.label != null)    { setLabel(tpl.label); setShowLabel(true); }
        if (tpl.subtitle != null) { setSubtitle(tpl.subtitle); setShowSubtitle(true); }
        if (tpl.showSubtitle != null) setShowSubtitle(!!tpl.showSubtitle);
        if (tpl.showLabel    != null) setShowLabel(!!tpl.showLabel);
        if (tpl.logoText != null) { setLogoText(tpl.logoText); }
        if (tpl.useLogoText  != null) setUseLogoText(!!tpl.useLogoText);
        if (tpl.headlineAlign && ["right","center","left"].includes(tpl.headlineAlign))
          setHeadlineAlign(tpl.headlineAlign as "right"|"center"|"left");
        if (tpl.subtitleAlign && ["right","center","left"].includes(tpl.subtitleAlign))
          setSubtitleAlign(tpl.subtitleAlign as "right"|"center"|"left");
        if (tpl.labelAlign && ["right","center","left"].includes(tpl.labelAlign))
          setLabelAlign(tpl.labelAlign as "right"|"center"|"left");
        if (tpl.watermarkText != null) setWatermarkText(tpl.watermarkText);
        if (tpl.watermarkOpacity != null) setWatermarkOpacity(tpl.watermarkOpacity);
        // Load logo from URL if present
        if (tpl.logoUrl) {
          const filename = tpl.logoUrl.split("/").pop() || "";
          setLogoServerFilename(filename);
          fetch(tpl.logoUrl)
            .then(r => r.blob())
            .then(blob => {
              const reader = new FileReader();
              reader.onload = e => { if (e.target?.result) setLogoImage(e.target.result as string); };
              reader.readAsDataURL(blob);
            }).catch(() => {});
        }
        // Load overlay (frame) from URL if present
        if (tpl.overlayUrl) {
          const fn = tpl.overlayUrl.split("/").pop() || "";
          setOverlayServerFilename(fn);
          setOverlayImage(tpl.overlayUrl);
          setOverlayFileName("(saved on server)");
        } else {
          setOverlayImage(null);
          setOverlayFileName("");
          setOverlayServerFilename("");
        }
        // Load canvas layout if present
        if (tpl.canvasLayout) {
          setCanvasLayout({ ...CANVAS_DEFAULT, ...tpl.canvasLayout });
          setCanvasMode(true);
        } else {
          setCanvasMode(false);
          setCanvasLayout(CANVAS_DEFAULT);
        }
        setSelElem(null);
        // Clean ?templateId from URL without reload
        const url = new URL(window.location.href);
        url.searchParams.delete("templateId");
        window.history.replaceState({}, "", url.toString());
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist settings ─────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem("ncg-pro-settings", JSON.stringify({
      headline, subtitle, label, showSubtitle, showLabel,
      selectedTemplateId, aspectRatio, font, fontSize, fontWeight, textShadow,
      logoPos, useLogoText, logoText, logoInvert,
      imgPositionX, imgPositionY,
      customBannerColor, customTextColor, customPhotoHeight,
      headlineAlign, subtitleAlign, labelAlign,
      watermarkText, watermarkOpacity,
      canvasMode, canvasLayout,
    }));
  }, [headline, subtitle, label, showSubtitle, showLabel, selectedTemplateId, aspectRatio,
      font, fontSize, fontWeight, textShadow, logoPos, useLogoText, logoText, logoInvert,
      imgPositionX, imgPositionY, customBannerColor, customTextColor, customPhotoHeight,
      headlineAlign, subtitleAlign, labelAlign, watermarkText, watermarkOpacity,
      canvasMode, canvasLayout]);

  useEffect(() => {
    localStorage.setItem("ncg-pro-designs", JSON.stringify(savedDesigns));
  }, [savedDesigns]);

  // Load user info + bot status + auto-sync old local designs to server
  useEffect(() => {
    const token = localStorage.getItem("pro_token");
    if (!token) return;
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => {
        if (d.name) setUserName(d.name);
        if (d.apiKey) setApiKey(d.apiKey);
      }).catch(() => {});
    // Load bot token from system settings (auto-fill so user doesn't need to enter manually)
    fetch("/api/settings/telegram", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => {
        if (d.connected && d.botUsername) setBotStatus({ username: d.botUsername });
        // If token is saved in system (even if not verified yet), pre-fill from /api/bot/status
      }).catch(() => {});
    fetch("/api/bot/status", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => {
        if (d.connected) setBotStatus({ username: d.username });
        // Pre-fill the bot token from system settings for quick send
        if (d.token) setBotToken(d.token);
      }).catch(() => {});

    // Auto-sync all locally-saved designs to server (idempotent — server upserts by name)
    const local = loadDesigns();
    if (local.length === 0) return;
    local.forEach(design => {
      const { logoImage: _img, ...serverSettings } = design.settings as any;
      fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: design.name, settings: serverSettings }),
      }).catch(() => {});
    });
  }, []);

  // ── API Templates (server-side) ───────────────────────────────────────────
  const fetchApiTemplates = useCallback(async () => {
    const token = localStorage.getItem("pro_token");
    if (!token) return;
    try {
      const r = await fetch("/api/templates", { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setApiTemplates(await r.json());
    } catch {}
  }, []);

  useEffect(() => { fetchApiTemplates(); }, [fetchApiTemplates]);

  // Load ALL template settings into UI when user clicks "Edit"
  const handleEditApiTemplate = useCallback((t: ApiTemplate) => {
    // Form state
    setEditingTplId(t.id);
    setApiTplName(t.name);
    setApiTplSlug(t.slug ?? "");
    setShowApiTemplateSave(true);
    // Typography
    if (t.fontSize)    setFontSize(t.fontSize);
    if (t.fontWeight)  setFontWeight(t.fontWeight);
    if (t.font)        setFont(t.font);
    if (typeof t.textShadow === "boolean") setTextShadow(t.textShadow);
    // Layout / aspect
    if (t.aspectRatio && Object.keys(ASPECT_RATIOS).includes(t.aspectRatio))
      setAspectRatio(t.aspectRatio as AspectRatio);
    // Colors
    if (t.bannerColor) { setCustomBannerColor(t.bannerColor); setSelectedTemplateId("custom"); }
    if (t.textColor)   setCustomTextColor(t.textColor);
    // Photo
    if (t.photoHeight) setCustomPhotoHeight(t.photoHeight);
    // Logo
    if (t.logoPos && ["top-right","top-left","bottom-right","bottom-left"].includes(t.logoPos))
      setLogoPos(t.logoPos as LogoPos);
    if (typeof t.logoInvert === "boolean") setLogoInvert(t.logoInvert);
    if (t.logoText != null) { setLogoText(t.logoText); setUseLogoText(true); }
    else                    { setUseLogoText(false); }
    if (t.logoUrl && !t.logoText) {
      const fn = t.logoUrl.split("/").pop() ?? "";
      setLogoServerFilename(fn);
      setLogoImage(null);
      setLogoFileName("(saved on server)");
    }
    // Text alignments
    if (t.headlineAlign && ["right","center","left"].includes(t.headlineAlign))
      setHeadlineAlign(t.headlineAlign as "right"|"center"|"left");
    if (t.subtitleAlign && ["right","center","left"].includes(t.subtitleAlign))
      setSubtitleAlign(t.subtitleAlign as "right"|"center"|"left");
    if (t.labelAlign && ["right","center","left"].includes(t.labelAlign))
      setLabelAlign(t.labelAlign as "right"|"center"|"left");
    // Watermark
    if (t.watermarkText != null)    setWatermarkText(t.watermarkText);
    if (t.watermarkOpacity != null) setWatermarkOpacity(Number(t.watermarkOpacity));
    // Subtitle / label
    if (t.subtitle != null) { setSubtitle(t.subtitle); setShowSubtitle(true); }
    if (t.label    != null) { setLabel(t.label);       setShowLabel(true); }
    // Canvas layout
    if (t.canvasLayout) { setCanvasLayout({ ...CANVAS_DEFAULT, ...t.canvasLayout }); setCanvasMode(true); }
    else                { setCanvasMode(false); setCanvasLayout(CANVAS_DEFAULT); }
    setSelElem(null);
    // Overlay
    if (t.overlayUrl) {
      const fn = t.overlayUrl.split("/").pop() ?? "";
      setOverlayServerFilename(fn);
      setOverlayImage(t.overlayUrl);
      setOverlayFileName("(saved on server)");
    } else {
      setOverlayImage(null);
      setOverlayFileName("");
      setOverlayServerFilename("");
    }
  }, []);

  const handleSaveApiTemplate = useCallback(async () => {
    const name = apiTplName.trim(); if (!name) return;
    setApiTplSaving(true);
    const token = localStorage.getItem("pro_token");
    const tmplNow = TEMPLATES.find(t => t.id === selectedTemplateId) || TEMPLATES[0];
    const payload = {
      name,
      slug: apiTplSlug.trim() || null,
      aspectRatio,
      bannerColor: selectedTemplateId === "custom" ? customBannerColor : (tmplNow.bannerColor ?? "#0f2557"),
      bannerGradient: selectedTemplateId !== "custom" ? (tmplNow.bannerGradient ?? null) : null,
      textColor: selectedTemplateId === "custom" ? customTextColor : (tmplNow.textColor ?? "#ffffff"),
      labelColor: tmplNow.labelColor ?? "rgba(255,255,255,0.85)",
      font,
      fontSize,
      fontWeight,
      photoHeight: customPhotoHeight,
      subtitle: showSubtitle && subtitle ? subtitle : null,
      label: showLabel && label ? label : null,
      logoText: useLogoText && logoText ? logoText : null,
      logoUrl: !useLogoText && logoServerFilename ? `/api/uploads/${logoServerFilename}` : null,
      logoPos,
      logoInvert,
      textShadow,
      headlineAlign,
      subtitleAlign,
      labelAlign,
      watermarkText: watermarkText || null,
      watermarkOpacity: String(watermarkOpacity),
      isPublic: false,
      canvasLayout: canvasMode ? canvasLayout : null,
      overlayUrl: overlayServerFilename ? `/api/uploads/${overlayServerFilename}` : null,
    };
    try {
      let r: Response;
      if (editingTplId !== null) {
        r = await fetch(`/api/templates/${editingTplId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
      } else {
        r = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
      }
      if (r.ok) {
        await fetchApiTemplates();
        setShowApiTemplateSave(false);
        setApiTplName(""); setApiTplSlug(""); setEditingTplId(null);
      }
    } catch {} finally { setApiTplSaving(false); }
  }, [apiTplName, apiTplSlug, aspectRatio, selectedTemplateId, customBannerColor, customTextColor, customPhotoHeight, font, fontSize, fontWeight, textShadow, subtitle, label, logoText, logoPos, logoInvert, showSubtitle, showLabel, useLogoText, headlineAlign, subtitleAlign, labelAlign, watermarkText, watermarkOpacity, editingTplId, fetchApiTemplates, canvasMode, canvasLayout, overlayServerFilename]);

  const handleDeleteApiTemplate = useCallback(async (id: number) => {
    if (!confirm("Delete this template?")) return;
    const token = localStorage.getItem("pro_token");
    await fetch(`/api/templates/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setApiTemplates(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleRegenerateApiKey = useCallback(async () => {
    if (!confirm("Regenerating will revoke the old key. Are you sure?")) return;
    setApiKeyRegenerating(true);
    try {
      const token = localStorage.getItem("pro_token");
      const res = await fetch("/api/auth/regenerate-key", { 
        method: "POST", 
        headers: { Authorization: `Bearer ${token}` } 
      });
      const d = await res.json();
      if (d.apiKey) setApiKey(d.apiKey);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setApiKeyRegenerating(false);
    }
  }, [toast]);

  // ── Canvas drag / resize handlers ────────────────────────────────────────
  const startDrag = useCallback((key: ElemKey) => (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    setSelElem(key);
    const el = canvasLayout[key];
    dragRef.current = { key, sx: e.clientX, sy: e.clientY, ox: el.x, oy: el.y };
    const card = cardRef.current; if (!card) return;
    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current; if (!d) return;
      const r = card.getBoundingClientRect();
      setCanvasLayout(p => ({
        ...p,
        [d.key]: {
          ...p[d.key],
          x: Math.max(0, Math.min(90, d.ox + ((ev.clientX - d.sx) / r.width)  * 100)),
          y: Math.max(0, Math.min(95, d.oy + ((ev.clientY - d.sy) / r.height) * 100)),
        },
      }));
    };
    const onUp = () => { dragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [canvasLayout]);

  const startResize = useCallback((key: ElemKey) => (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    const card = cardRef.current; if (!card) return;
    rszRef.current = { key, sx: e.clientX, ow: canvasLayout[key].w, cw: card.getBoundingClientRect().width };
    const onMove = (ev: MouseEvent) => {
      const d = rszRef.current; if (!d) return;
      setCanvasLayout(p => ({ ...p, [d.key]: { ...p[d.key], w: Math.max(8, Math.min(98, d.ow + ((ev.clientX - d.sx) / d.cw) * 100)) } }));
    };
    const onUp = () => { rszRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [canvasLayout]);

  // ── Template helpers ──────────────────────────────────────────────────────
  const getTemplate = useCallback((): Template => {
    const t = TEMPLATES.find(t => t.id === selectedTemplateId)!;
    if (selectedTemplateId === "custom") {
      return { ...t, bannerColor: customBannerColor, bannerGradient: undefined, textColor: customTextColor, photoHeight: customPhotoHeight };
    }
    return t;
  }, [selectedTemplateId, customBannerColor, customTextColor, customPhotoHeight]);

  const tmpl = getTemplate();
  const photoH = tmpl.photoHeight;
  const bannerH = Math.max(0, 100 - photoH);
  const isFade = tmpl.id === "slate-fade" || tmpl.id === "overlay-only" || photoH >= 100;
  const { w: cardW, h: cardH } = ASPECT_RATIOS[aspectRatio];

  const logoStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = { position: "absolute", height: "36px", width: "auto", maxWidth: "110px", objectFit: "contain" };
    if (logoPos === "top-right")    return { ...base, top: 12, right: 12 };
    if (logoPos === "top-left")     return { ...base, top: 12, left: 12 };
    if (logoPos === "bottom-right") return { ...base, bottom: 12, right: 12 };
    return { ...base, bottom: 12, left: 12 };
  };
  const logoBoxStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: "absolute", height: "32px", display: "flex", alignItems: "center",
      justifyContent: "center", background: "rgba(255,255,255,0.12)",
      borderRadius: "4px", padding: "4px 10px", border: "1px dashed rgba(255,255,255,0.25)",
    };
    if (logoPos === "top-right")    return { ...base, top: 10, right: 10 };
    if (logoPos === "top-left")     return { ...base, top: 10, left: 10 };
    if (logoPos === "bottom-right") return { ...base, bottom: 10, right: 10 };
    return { ...base, bottom: 10, left: 10 };
  };

  // ── File handlers ─────────────────────────────────────────────────────────
  const handleBgUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setBgFileName(file.name);
    setBgFile(file);
    const reader = new FileReader();
    reader.onload = ev => setBgImage(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
    // Also upload to server for high-quality generation
    const token = localStorage.getItem("pro_token");
    const fd = new FormData();
    fd.append("photo", file);
    fetch("/api/photo/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd })
      .then(r => r.json()).then(d => { if (d.filename) setBgServerFilename(d.filename); }).catch(() => {});
  }, []);

  const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setLogoFileName(file.name);
    // Preview locally
    const reader = new FileReader();
    reader.onload = ev => setLogoImage(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
    // Upload to server for high-quality generation
    const token = localStorage.getItem("pro_token");
    const fd = new FormData();
    fd.append("photo", file);
    fetch("/api/photo/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd })
      .then(r => r.json()).then(d => { if (d.filename) setLogoServerFilename(d.filename); }).catch(() => {});
  }, []);

  const handleOverlayUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setOverlayFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => setOverlayImage(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
    const token = localStorage.getItem("pro_token");
    const fd = new FormData();
    fd.append("photo", file);
    fetch("/api/photo/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd })
      .then(r => r.json()).then(d => { if (d.filename) setOverlayServerFilename(d.filename); }).catch(() => {});
  }, []);

  // ── Saved designs ─────────────────────────────────────────────────────────
  const handleSaveDesign = useCallback(() => {
    const name = saveNameInput.trim(); if (!name) return;
    const settings = {
      selectedTemplateId, aspectRatio, font, fontSize, fontWeight, textShadow,
      logoPos, logoInvert, useLogoText, logoText, showSubtitle, showLabel,
      imgPositionX, imgPositionY, customBannerColor, customTextColor, customPhotoHeight,
      headline, subtitle, label,
      logoImage: logoImage ?? null,
      logoPhotoFilename: (!useLogoText && logoServerFilename) ? logoServerFilename : null,
      // Overlay frame
      overlayImage: overlayImage ?? null,
      overlayPhotoFilename: overlayServerFilename || null,
      // Canvas free-positioning
      canvasMode,
      canvasLayout,
    };
    const design: SavedDesign = { id: Date.now().toString(), name, createdAt: Date.now(), settings };
    setSavedDesigns(prev => [design, ...prev.filter(d => d.name !== name)]);
    setSaveNameInput(""); setShowSaveInput(false);
    setActiveTab("saved");
    // Sync to server (strip logoImage base64 but keep logoPhotoFilename)
    const token = localStorage.getItem("pro_token");
    const { logoImage: _img, ...serverSettings } = settings;
    fetch("/api/designs", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, settings: serverSettings }),
    }).catch(() => {});
  }, [saveNameInput, selectedTemplateId, aspectRatio, font, fontSize, fontWeight, textShadow, logoPos, logoInvert, useLogoText, logoText, showSubtitle, showLabel, imgPositionX, imgPositionY, customBannerColor, customTextColor, customPhotoHeight, headline, subtitle, label, logoImage, logoServerFilename, overlayImage, overlayServerFilename, canvasMode, canvasLayout]);

  const handleLoadDesign = useCallback((d: SavedDesign) => {
    const s = d.settings;
    setSelectedTemplateId(s.selectedTemplateId);
    setAspectRatio(s.aspectRatio);
    setFont(s.font); setFontSize(s.fontSize); setFontWeight(s.fontWeight); setTextShadow(s.textShadow);
    setLogoPos(s.logoPos); setLogoInvert(s.logoInvert ?? false);
    setUseLogoText(s.useLogoText); setLogoText(s.logoText);
    setShowSubtitle(s.showSubtitle); setShowLabel(s.showLabel);
    setImgPositionX(s.imgPositionX); setImgPositionY(s.imgPositionY);
    setCustomBannerColor(s.customBannerColor); setCustomTextColor(s.customTextColor);
    setCustomPhotoHeight(s.customPhotoHeight);
    if (s.headline) setHeadline(s.headline);
    if (s.subtitle !== undefined) setSubtitle(s.subtitle);
    if (s.label !== undefined) setLabel(s.label);
    // Restore canvas free-positioning — always merge with CANVAS_DEFAULT to ensure all keys exist
    if (s.canvasMode !== undefined) setCanvasMode(s.canvasMode);
    if (s.canvasLayout) setCanvasLayout({ ...CANVAS_DEFAULT, ...s.canvasLayout });
    else setCanvasLayout(CANVAS_DEFAULT);
    setSelElem(null);
    // Restore logo image if saved
    if (s.logoImage) {
      setLogoImage(s.logoImage);
      setLogoFileName("(saved)");
      // If we already have the server filename saved, use it directly (avoids re-upload)
      if ((s as any).logoPhotoFilename) {
        setLogoServerFilename((s as any).logoPhotoFilename);
      } else {
        // Re-upload to server so it's available for generation
        const token = localStorage.getItem("pro_token");
        fetch(s.logoImage).then(r => r.blob()).then(blob => {
          const fd = new FormData();
          fd.append("photo", blob, "logo.png");
          return fetch("/api/photo/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
        }).then(r => r.json()).then(data => { if (data.filename) setLogoServerFilename(data.filename); }).catch(() => {});
      }
    } else if ((s as any).logoPhotoFilename) {
      // Logo was uploaded to server but base64 not stored locally — restore filename only
      setLogoImage(null);
      setLogoFileName("(saved on server)");
      setLogoServerFilename((s as any).logoPhotoFilename);
    } else {
      setLogoImage(null);
      setLogoFileName("");
      setLogoServerFilename("");
    }
    // Restore overlay image if saved
    if (s.overlayImage) {
      setOverlayImage(s.overlayImage);
      setOverlayFileName("(saved)");
      if (s.overlayPhotoFilename) {
        setOverlayServerFilename(s.overlayPhotoFilename);
      } else {
        const token = localStorage.getItem("pro_token");
        fetch(s.overlayImage).then(r => r.blob()).then(blob => {
          const fd = new FormData();
          fd.append("photo", blob, "overlay.png");
          return fetch("/api/photo/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
        }).then(r => r.json()).then(data => { if (data.filename) setOverlayServerFilename(data.filename); }).catch(() => {});
      }
    } else if (s.overlayPhotoFilename) {
      setOverlayImage(null);
      setOverlayFileName("(saved on server)");
      setOverlayServerFilename(s.overlayPhotoFilename);
    } else {
      setOverlayImage(null);
      setOverlayFileName("");
      setOverlayServerFilename("");
    }
    setActiveTab("content");
  }, []);

  const exportDesigns = useCallback(() => {
    const blob = new Blob([JSON.stringify(savedDesigns, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "ncg-pro-designs.json"; a.click();
  }, [savedDesigns]);

  const importDesigns = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (Array.isArray(data)) setSavedDesigns(prev => [...data, ...prev]);
      } catch { toast({ title: "Invalid file", description: "Could not parse JSON file", variant: "destructive" }); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  // ── Download via server (Playwright) ─────────────────────────────────────
  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    try {
      const token = localStorage.getItem("pro_token");
      const payload: Record<string, unknown> = {
        title: headline,
        subtitle: showSubtitle ? subtitle : null,
        label: showLabel ? label : null,
        logoText: useLogoText ? logoText : null,
        templateId: selectedTemplateId,
        aspectRatio,
        font,
        fontSize,
        fontWeight,
        textShadow,
        logoPos,
        logoInvert,
        customBannerColor,
        customTextColor,
        customPhotoHeight,
        imgPositionX,
        imgPositionY,
        headlineAlign,
        subtitleAlign,
        labelAlign,
        watermarkText: watermarkText || null,
        watermarkOpacity,
      };
      if (bgServerFilename)   payload.backgroundPhotoFilename = bgServerFilename;
      if (!useLogoText && logoServerFilename) payload.logoPhotoFilename = logoServerFilename;
      if (overlayServerFilename) payload.overlayPhotoFilename = overlayServerFilename;
      if (canvasMode) payload.canvasLayout = canvasLayout;

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      const a = document.createElement("a");
      a.href = data.imageUrl; a.download = `card-${selectedTemplateId}-${aspectRatio.replace(":", "x")}.png`;
      a.click();
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message, variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  }, [headline, subtitle, label, showSubtitle, showLabel, useLogoText, logoText, selectedTemplateId, aspectRatio, font, fontSize, fontWeight, textShadow, logoPos, logoInvert, customBannerColor, customTextColor, customPhotoHeight, imgPositionX, imgPositionY, bgServerFilename, logoServerFilename, overlayServerFilename, toast]);

  // ── Telegram quick send ───────────────────────────────────────────────────
  const handleTelegramSend = useCallback(async () => {
    if (!chatId.trim()) {
      toast({ title: "Chat ID required", description: "Enter the Telegram channel/chat ID below", variant: "destructive" });
      return;
    }
    if (!botToken.trim()) {
      toast({ title: "Bot not configured", description: "Go to Admin → Settings and save the Telegram bot token first", variant: "destructive" });
      return;
    }
    setIsSendingTg(true);
    try {
      const token = localStorage.getItem("pro_token");
      const payload: Record<string, unknown> = {
        title: headline,
        subtitle: showSubtitle ? subtitle : null,
        label: showLabel ? label : null,
        logoText: useLogoText ? logoText : null,
        templateId: selectedTemplateId,
        aspectRatio, font, fontSize, fontWeight, textShadow, logoPos, logoInvert,
        customBannerColor, customTextColor, customPhotoHeight, imgPositionX, imgPositionY,
        headlineAlign, subtitleAlign, labelAlign,
        watermarkText: watermarkText || null,
        watermarkOpacity,
      };
      if (bgServerFilename)   payload.backgroundPhotoFilename = bgServerFilename;
      if (!useLogoText && logoServerFilename) payload.logoPhotoFilename = logoServerFilename;
      if (overlayServerFilename) payload.overlayPhotoFilename = overlayServerFilename;
      if (canvasMode) payload.canvasLayout = canvasLayout;

      // Generate image first
      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const genData = await genRes.json();
      if (!genRes.ok) throw new Error(genData.error || "Generation failed");

      // Send via Telegram Bot API
      const imgRes = await fetch(genData.imageUrl);
      const imgBlob = await imgRes.blob();
      const fd = new FormData();
      fd.append("chat_id", chatId.trim());
      fd.append("photo", imgBlob, "card.png");
      const tgRes = await fetch(`https://api.telegram.org/bot${botToken.trim()}/sendPhoto`, {
        method: "POST", body: fd,
      });
      const tgData = await tgRes.json();
      if (!tgData.ok) throw new Error(tgData.description || "Send failed");
      toast({ title: "Sent successfully ✅", description: `Card sent to ${chatId}` });
    } catch (err: any) {
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSendingTg(false);
    }
  }, [botToken, chatId, headline, subtitle, label, showSubtitle, showLabel, useLogoText, logoText, selectedTemplateId, aspectRatio, font, fontSize, fontWeight, textShadow, logoPos, logoInvert, customBannerColor, customTextColor, customPhotoHeight, imgPositionX, imgPositionY, bgServerFilename, logoServerFilename, toast]);

  // ── Tab style ─────────────────────────────────────────────────────────────
  const tabStyle = (id: TabId): React.CSSProperties => {
    return {
      padding: "7px 14px", borderRadius: "8px", border: "none", cursor: "pointer",
      fontSize: "13px", fontWeight: activeTab === id ? 600 : 400,
      background: activeTab === id ? "#3b82f6" : "rgba(255,255,255,0.05)",
      color: activeTab === id ? "#fff" : "#94a3b8",
      transition: "all 0.15s", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" as const,
    };
  };

  const FONT_WEIGHTS = [900, 800, 700, 600, 500, 400];
  const tabs: { id: TabId; label: string }[] = [
    { id: "content",    label: "Content" },
    { id: "design",     label: "Design" },
    { id: "saved",      label: `My Templates${savedDesigns.length ? ` (${savedDesigns.length})` : ""}` },
    { id: "typography", label: "Typography" },
    { id: "api",        label: "API" },
    { id: "settings",   label: "Settings" },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)} className="flex h-[calc(100vh-8rem)] w-full overflow-hidden" dir="rtl">
        {/* ── Left sidebar ── */}
        <aside className="w-[420px] min-w-[380px] bg-sidebar border-l border-sidebar-border flex flex-col shrink-0 z-10 shadow-lg overflow-hidden">
          <div className="p-4 border-b border-sidebar-border bg-sidebar/95 backdrop-blur sticky top-0 z-20">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2 text-sidebar-foreground">
                <Settings2 className="text-primary w-5 h-5" /> Settings
              </h2>
              <div className="flex items-center gap-2">
                 <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                   {user?.isAdmin ? 'Admin' : user?.plan === 'pro' ? 'Pro' : user?.plan === 'agency' ? 'Agency' : user?.plan === 'starter' ? 'Starter' : 'Free'}
                 </span>
              </div>
            </div>
            <TabsList className="grid grid-cols-3 h-auto p-1 gap-1 bg-muted/50">
              <TabsTrigger value="content" className="flex flex-col gap-1 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <ImageIcon className="w-4 h-4" />
                <span className="text-[10px]">Content</span>
              </TabsTrigger>
              <TabsTrigger value="design" className="flex flex-col gap-1 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Palette className="w-4 h-4" />
                <span className="text-[10px]">Design</span>
              </TabsTrigger>
              <TabsTrigger value="typography" className="flex flex-col gap-1 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Type className="w-4 h-4" />
                <span className="text-[10px]">Fonts</span>
              </TabsTrigger>
              <TabsTrigger value="saved" className="flex flex-col gap-1 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Save className="w-4 h-4" />
                <span className="text-[10px]">My Tmpl</span>
              </TabsTrigger>
              {(user?.isAdmin || user?.planDetails?.apiAccess === true) && (
                <>
                  <TabsTrigger value="api" className="flex flex-col gap-1 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <Zap className="w-4 h-4" />
                    <span className="text-[10px]">API</span>
                  </TabsTrigger>
                  <TabsTrigger value="settings" className="flex flex-col gap-1 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <Share2 className="w-4 h-4" />
                    <span className="text-[10px]">Export</span>
                  </TabsTrigger>
                </>
              )}
            </TabsList>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-5 flex flex-col gap-6">
              
              <TabsContent value="content" className="m-0 space-y-6">
                <Accordion type="multiple" defaultValue={["item-bg", "item-text", "item-logo"]} className="w-full space-y-4">
                  
                  {/* Background Section */}
                  <AccordionItem value="item-bg" className="border rounded-xl bg-card overflow-hidden shadow-sm">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-sm">Background Image</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-2 space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Choose File</Label>
                          {bgImage && (
                            <Button 
                              variant={customPhotoHeight === 100 ? "default" : "outline"} 
                              size="sm" 
                              className="h-7 text-[10px] px-2"
                              onClick={() => setCustomPhotoHeight(customPhotoHeight === 100 ? 62 : 100)}
                            >
                              {customPhotoHeight === 100 ? "✓ Full BG" : "Full BG"}
                            </Button>
                          )}
                        </div>
                        <div 
                          className={cn(
                            "group relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-all cursor-pointer",
                            bgFileName ? "border-primary/50 bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/50"
                          )}
                          onClick={() => bgInputRef.current?.click()}
                        >
                          {bgFileName ? (
                            <div className="flex flex-col items-center gap-2 text-center">
                              <CheckCircle2 className="w-8 h-8 text-primary animate-in zoom-in duration-300" />
                              <div className="text-xs font-medium truncate max-w-[200px]">{bgFileName}</div>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBgImage(null); setBgFileName(""); setBgFile(null); setBgServerFilename("");
                                }}
                              >
                                Remove Image
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                <ImageIcon className="w-5 h-5 text-primary" />
                              </div>
                              <p className="text-xs font-medium">Click to upload</p>
                              <p className="text-[10px] text-muted-foreground mt-1 text-center">PNG, JPG up to 5MB</p>
                            </>
                          )}
                          <input ref={bgInputRef} type="file" accept="image/*" onChange={handleBgUpload} className="hidden" />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Text Content Section */}
                  <AccordionItem value="item-text" className="border rounded-xl bg-card overflow-hidden shadow-sm">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <Type className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-sm">Card Text</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-2 space-y-4">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Main Headline</Label>
                          <textarea 
                            value={headline} 
                            onChange={e => setHeadline(e.target.value)}
                            className="w-full min-h-[100px] p-3 rounded-lg bg-muted/50 border-input text-sm resize-none focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                            placeholder="Enter headline here..."
                            dir="rtl"
                          />
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Subtitle</Label>
                            <Switch checked={showSubtitle} onCheckedChange={setShowSubtitle} />
                          </div>
                          {showSubtitle && (
                            <Input 
                              value={subtitle} 
                              onChange={e => setSubtitle(e.target.value)}
                              placeholder="Enter subtitle..."
                              className="bg-muted/50"
                              dir="rtl"
                            />
                          )}
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Label / Date</Label>
                            <Switch checked={showLabel} onCheckedChange={setShowLabel} />
                          </div>
                          {showLabel && (
                            <Input 
                              value={label} 
                              onChange={e => setLabel(e.target.value)}
                              placeholder="Breaking, Sports, Saturday..."
                              className="bg-muted/50"
                              dir="rtl"
                            />
                          )}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Logo Section */}
                  <AccordionItem value="item-logo" className="border rounded-xl bg-card overflow-hidden shadow-sm">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-sm">Logo</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-2 space-y-4">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="space-y-0.5">
                            <Label className="text-sm font-medium">Use text instead</Label>
                            <p className="text-[10px] text-muted-foreground">Use a word instead of image</p>
                          </div>
                          <Switch checked={useLogoText} onCheckedChange={setUseLogoText} />
                        </div>

                        {useLogoText ? (
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Logo text</Label>
                            <Input 
                              value={logoText} 
                              onChange={e => setLogoText(e.target.value)}
                              placeholder="Channel name..."
                              className="bg-muted/50"
                              dir="rtl"
                            />
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Upload Logo</Label>
                            <div 
                              className={cn(
                                "group relative flex items-center gap-3 p-3 border-2 border-dashed rounded-xl transition-all cursor-pointer",
                                logoFileName ? "border-primary/50 bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/50"
                              )}
                              onClick={() => logoInputRef.current?.click()}
                            >
                              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <Zap className="w-5 h-5 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{logoFileName || "Choose logo image"}</p>
                                <p className="text-[10px] text-muted-foreground">Transparent PNG preferred</p>
                              </div>
                              {logoFileName && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 text-destructive px-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLogoImage(null); setLogoFileName(""); setLogoServerFilename("");
                                  }}
                                >
                                  Remove
                                </Button>
                              )}
                              <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                            </div>
                            {logoImage && (
                              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                <span className="text-xs">Invert logo colors</span>
                                <Switch checked={logoInvert} onCheckedChange={setLogoInvert} />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                </Accordion>
              </TabsContent>

              <TabsContent value="design" className="m-0 space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                <Accordion type="multiple" defaultValue={["item-tpl", "item-style", "item-overlay"]} className="w-full space-y-4">
                  
                  {/* Template Selection */}
                  <AccordionItem value="item-tpl" className="border rounded-xl bg-card overflow-hidden shadow-sm">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <Palette className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-sm">Ready Templates</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-2">
                      <div className="grid grid-cols-3 gap-2">
                        {TEMPLATES.map(t => {
                          const isSelected = selectedTemplateId === t.id;
                          const isFade = t.id === "slate-fade" || t.id === "overlay-only";
                          const photoH = t.photoHeight ?? 62;
                          const bannerH = 100 - photoH;
                          return (
                            <Button
                              key={t.id}
                              variant="outline"
                              className={cn(
                                "h-20 p-0 flex flex-col items-stretch overflow-hidden relative group border-2",
                                isSelected ? "border-primary bg-primary/5" : "hover:border-primary/30"
                              )}
                              onClick={() => setSelectedTemplateId(t.id)}
                            >
                              {/* Preview mock */}
                              <div className="flex-1 flex flex-col w-full">
                                <div style={{ 
                                  height: isFade ? '100%' : `${photoH}%`,
                                  background: t.isLight ? 'linear-gradient(135deg,#e2e8f0,#f1f5f9)' : 'linear-gradient(135deg,#1e293b,#0f172a)' 
                                }} className="w-full relative">
                                  {isFade && (
                                    <div style={{ background: t.bannerGradient || t.bannerColor }} className="absolute inset-0 opacity-40"></div>
                                  )}
                                </div>
                                {!isFade && (
                                  <div style={{ height: `${bannerH}%`, background: t.bannerGradient || t.bannerColor }} className="w-full"></div>
                                )}
                              </div>
                              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-[10px] text-white font-bold">{t.name}</span>
                              </div>
                              {isSelected && (
                                <div className="absolute top-1 right-1">
                                  <CheckCircle2 className="w-3 h-3 text-primary bg-white rounded-full" />
                                </div>
                              )}
                            </Button>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Custom Style */}
                  <AccordionItem value="item-style" className="border rounded-xl bg-card overflow-hidden shadow-sm">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-sm">Custom Colors & Sizes</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-4 space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] text-muted-foreground uppercase">Banner Color</Label>
                          <div className="flex items-center gap-2 p-1 border rounded-lg bg-muted/30">
                            <input 
                              type="color" 
                              value={customBannerColor} 
                              onChange={e => setCustomBannerColor(e.target.value)}
                              className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                            />
                            <span className="text-xs font-mono uppercase">{customBannerColor}</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] text-muted-foreground uppercase">Text Color</Label>
                          <div className="flex items-center gap-2 p-1 border rounded-lg bg-muted/30">
                            <input 
                              type="color" 
                              value={customTextColor} 
                              onChange={e => setCustomTextColor(e.target.value)}
                              className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                            />
                            <span className="text-xs font-mono uppercase">{customTextColor}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">Image Height</Label>
                          <span className="text-xs font-bold text-primary">{customPhotoHeight}%</span>
                        </div>
                        <Slider 
                          value={[customPhotoHeight]} 
                          onValueChange={([v]) => setCustomPhotoHeight(v)}
                          min={40} 
                          max={100} 
                          step={1}
                        />
                        <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                          <span>Small</span>
                          <Button 
                            variant="link" 
                            className="h-auto p-0 text-primary text-[10px]"
                            onClick={() => setCustomPhotoHeight(100)}
                          >Full BG</Button>
                          <span>100%</span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Overlay PNG */}
                  <AccordionItem value="item-overlay" className="border rounded-xl bg-card overflow-hidden shadow-sm">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-sm">Custom Overlay Frame</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-2 space-y-4">
                      <div className="space-y-3">
                        <div 
                          className={cn(
                            "group relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-all cursor-pointer",
                            overlayFileName ? "border-primary/50 bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/50"
                          )}
                          onClick={() => overlayInputRef.current?.click()}
                        >
                          {overlayFileName ? (
                            <div className="flex flex-col items-center gap-2 text-center">
                              <CheckCircle2 className="w-8 h-8 text-primary" />
                              <div className="text-xs font-medium truncate max-w-[200px]">{overlayFileName}</div>
                              <div className="flex gap-2">
                                <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={(e) => { e.stopPropagation(); overlayInputRef.current?.click(); }}>Change</Button>
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive" onClick={(e) => { e.stopPropagation(); setOverlayImage(null); setOverlayFileName(""); setOverlayServerFilename(""); }}>Remove</Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <Layers className="w-6 h-6 text-muted-foreground mb-2" />
                              <p className="text-xs font-medium">Upload PNG Frame</p>
                              <p className="text-[10px] text-muted-foreground mt-1">Placed over the entire card</p>
                            </>
                          )}
                          <input ref={overlayInputRef} type="file" accept="image/png,image/*" onChange={handleOverlayUpload} className="hidden" />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
                
                <div className="flex gap-2 pt-2">
                  <Button onClick={() => setShowSaveInput(v => !v)} className="flex-1 gap-2">
                    <Save className="w-4 h-4" /> Save Current Design
                  </Button>
                </div>

                {showSaveInput && (
                  <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="pt-4 space-y-3">
                      <Label className="text-xs">Design Name</Label>
                      <div className="flex gap-2">
                        <Input 
                          autoFocus 
                          value={saveNameInput} 
                          onChange={e => setSaveNameInput(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") handleSaveDesign(); if (e.key === "Escape") setShowSaveInput(false); }}
                          placeholder="e.g. breaking-red-cnn"
                          className="bg-background h-9"
                        />
                        <Button size="sm" onClick={handleSaveDesign}>Save</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="saved" className="m-0 space-y-6">
                <Card>
                  <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-sm font-bold">API Templates</CardTitle>
                      <CardDescription className="text-[10px]">Cloud templates for programmatic use</CardDescription>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => { setShowApiTemplateSave(true); setEditingTplId(null); setApiTplName(""); setApiTplSlug(""); }}
                    >
                      + New
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {showApiTemplateSave && (
                      <div className="p-3 border rounded-lg bg-primary/5 space-y-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Template Name</Label>
                          <Input 
                            value={apiTplName} 
                            onChange={e => setApiTplName(e.target.value)}
                            placeholder="Daily news template..."
                            className="bg-background h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Slug (optional)</Label>
                          <Input 
                            value={apiTplSlug} 
                            onChange={e => setApiTplSlug(e.target.value.toLowerCase())}
                            placeholder="news-tpl"
                            className="bg-background h-8 text-xs font-mono"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1 h-8" onClick={handleSaveApiTemplate} disabled={apiTplSaving}>
                            {apiTplSaving ? "Saving..." : "Save"}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8" onClick={() => setShowApiTemplateSave(false)}>✕</Button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      {apiTemplates.length === 0 ? (
                        <div className="text-center py-6 border-2 border-dashed rounded-lg text-muted-foreground">
                          <AlertCircle className="w-8 h-8 mx-auto opacity-20 mb-2" />
                          <p className="text-xs">No API templates yet</p>
                        </div>
                      ) : (
                        apiTemplates.map(t => (
                          <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors group">
                            <div className="min-w-0">
                              <p className="text-xs font-bold truncate">{t.name}</p>
                              <div className="flex gap-2 mt-1">
                                <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded font-mono">ID: {t.id}</span>
                                {t.slug && <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">@{t.slug}</span>}
                              </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleEditApiTemplate(t)}>
                                <Move className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDeleteApiTemplate(t.id)}>
                                <AlertCircle className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold">Local Designs</CardTitle>
                    <CardDescription className="text-[10px]">Saved in your current browser</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {savedDesigns.length === 0 ? (
                      <p className="text-center text-xs text-muted-foreground py-4">No saved designs</p>
                    ) : (
                      savedDesigns.map(d => (
                        <div key={d.id} className="flex items-center justify-between p-2 border rounded-lg group">
                          <span className="text-xs font-medium truncate flex-1">{d.name}</span>
                          <Button size="sm" variant="ghost" className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleLoadDesign(d)}>Load</Button>
                        </div>
                      ))
                    )}
                    <div className="flex gap-2 pt-2 border-t mt-4">
                      <Button variant="outline" size="sm" className="flex-1 text-[10px]" onClick={exportDesigns}>Export All</Button>
                      <Button variant="outline" size="sm" className="flex-1 text-[10px]" onClick={() => importRef.current?.click()}>Import JSON</Button>
                      <input ref={importRef} type="file" accept=".json" onChange={importDesigns} className="hidden" />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="typography" className="m-0 space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                <Accordion type="multiple" defaultValue={["item-font", "item-align"]} className="w-full space-y-4">
                  
                  {/* Font Selection */}
                  <AccordionItem value="item-font" className="border rounded-xl bg-card overflow-hidden shadow-sm">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <Type className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-sm">Font</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-2 space-y-6">
                      <div className="space-y-3">
                        <Label className="text-xs text-muted-foreground uppercase">Choose Font</Label>
                        <select 
                          value={font} 
                          onChange={e => setFont(e.target.value)} 
                          className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-input text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium appearance-none"
                          style={{ fontFamily: `'${font}', sans-serif` }}
                        >
                          {ARABIC_FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                        <div 
                          className="p-6 rounded-lg bg-muted/30 text-center border overflow-hidden min-h-[80px] flex items-center justify-center"
                          style={{ fontFamily: `'${font}', sans-serif`, fontSize: `${fontSize}px`, fontWeight: fontWeight, textShadow: textShadow ? "0 1px 4px rgba(0,0,0,0.3)" : "none" }}
                        >
                          {headline || "This is a font preview"}
                        </div>
                        
                        <div className="space-y-4 pt-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground">Text Size</Label>
                            <span className="text-xs font-bold text-primary">{fontSize}px</span>
                          </div>
                          <Slider 
                            value={[fontSize]} 
                            onValueChange={([v]) => setFontSize(v)}
                            min={14} 
                            max={48} 
                            step={1}
                          />
                        </div>

                        <div className="space-y-4 pt-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground">Font Weight</Label>
                            <span className="text-xs font-bold text-primary">{fontWeight}</span>
                          </div>
                          <div className="grid grid-cols-5 gap-1.5">
                            {[300, 400, 500, 600, 700].map(w => (
                              <Button
                                key={w}
                                variant={fontWeight === w ? "default" : "outline"}
                                className="h-8 p-0 text-[10px]"
                                onClick={() => setFontWeight(w)}
                              >
                                {w}
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="space-y-0.5">
                            <Label className="text-sm font-medium">Text Shadow</Label>
                            <p className="text-[10px] text-muted-foreground">Add depth to text</p>
                          </div>
                          <Switch checked={textShadow} onCheckedChange={setTextShadow} />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Alignment Section */}
                  <AccordionItem value="item-align" className="border rounded-xl bg-card overflow-hidden shadow-sm">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <Move className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-sm">Element Alignment</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-2 space-y-4">
                      {[
                        { label: "Main Headline", current: headlineAlign, onChange: setHeadlineAlign },
                        { label: "Subtitle",  current: subtitleAlign,  onChange: setSubtitleAlign },
                        { label: "Label (small text)", current: labelAlign,    onChange: setLabelAlign }
                      ].map((item, idx) => (
                        <div key={idx} className="space-y-2">
                          <Label className="text-[10px] text-muted-foreground uppercase">{item.label}</Label>
                          <div className="flex gap-1 p-1 bg-muted/30 rounded-lg">
                            {(['right', 'center', 'left'] as const).map(a => (
                              <Button
                                key={a}
                                variant={item.current === a ? "default" : "ghost"}
                                size="sm"
                                className="flex-1 h-8 px-0"
                                onClick={() => item.onChange(a)}
                              >
                                {a === 'right' ? 'Right' : a === 'center' ? 'Center' : 'Left'}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </TabsContent>

              <TabsContent value="api" className="m-0 space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                {user?.plan === 'free' && !user?.isAdmin ? (
                  <Card className="border-primary/20 bg-primary/5 overflow-hidden">
                    <CardHeader className="text-center pb-2">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                        <Zap className="w-6 h-6 text-primary" />
                      </div>
                      <CardTitle className="text-lg">Pro Features</CardTitle>
                      <CardDescription>This feature is only available for Pro subscribers</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pb-6 text-center">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Upgrade your account to access API keys, connect your Telegram bot, and full automation via n8n.
                      </p>
                      <div className="flex flex-col gap-2">
                        <Button className="w-full">Upgrade to Pro</Button>
                        <Button variant="ghost" className="w-full text-[10px]" onClick={() => setActiveTab("content")}>Back to Home</Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-6">
                    {/* API Key Card */}
                    <Card className="overflow-hidden border-2 border-primary/10 shadow-md">
                      <CardHeader className="pb-4 bg-primary/5 border-b">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Zap className="w-5 h-5 text-primary" />
                            <CardTitle className="text-sm font-bold">Access Key (API Key)</CardTitle>
                          </div>
                          <Badge variant="outline" className="text-[10px] uppercase font-mono">X-Api-Key</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-5 space-y-4">
                        <div className="space-y-3">
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Use this key to access the API from <span className="font-bold text-foreground">n8n</span> or <span className="font-bold text-foreground">Make</span>. Never share it with anyone.
                          </p>
                          <div className="flex gap-2 relative">
                            <Input 
                              value={apiKeyVisible ? apiKey : "••••••••••••••••••••••••"} 
                              readOnly 
                              dir="ltr"
                              className="bg-muted/50 font-mono text-xs pr-10"
                            />
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="absolute right-12 h-8 w-8 p-0" 
                              onClick={() => setApiKeyVisible(!apiKeyVisible)}
                            >
                              {apiKeyVisible ? "🙈" : "👁️"}
                            </Button>
                            <Button size="sm" variant="secondary" className="h-9 px-3" onClick={() => { if (apiKey) navigator.clipboard.writeText(apiKey); }}>
                              Copy
                            </Button>
                          </div>
                          <Button 
                            variant="outline" 
                            className="w-full h-8 text-[10px] text-destructive hover:bg-destructive/10 border-destructive/20"
                            disabled={apiKeyRegenerating}
                            onClick={handleRegenerateApiKey}
                          >
                            {apiKeyRegenerating ? "Regenerating..." : "Regenerate Key"}
                          </Button>
                        </div>
                      </CardContent>
                      <div className="p-3 bg-muted/30 border-t flex flex-col gap-2 font-mono">
                        <p className="text-[10px] text-muted-foreground">Endpoint: <span className="text-primary truncate">{window.location.origin}/api/generate</span></p>
                      </div>
                    </Card>

                    {/* Telegram Bot Card */}
                    <Card className="overflow-hidden shadow-md">
                      <CardHeader className="pb-4 bg-blue-500/5 border-b">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Send className="w-5 h-5 text-blue-500" />
                            <CardTitle className="text-sm font-bold">Telegram Bot</CardTitle>
                          </div>
                          {botStatus && (
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-[9px] font-bold border border-green-500/20">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Connected
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-5 space-y-6">
                        {botStatus ? (
                          <div className="p-4 rounded-xl border border-green-500/20 bg-green-500/5 flex items-center justify-between">
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-green-600 truncate">@{botStatus.username} linked</p>
                              <p className="text-[10px] text-muted-foreground">Bot is active and ready to receive commands</p>
                            </div>
                            <CheckCircle2 className="w-6 h-6 text-green-500" />
                          </div>
                        ) : (
                          <div className="p-4 rounded-xl border border-orange-500/20 bg-orange-500/5 space-y-3">
                            <p className="text-xs text-orange-600 leading-relaxed font-medium">Send a message to @{user?.botCode || 'NewsCardBot'} to link automatically</p>
                            <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => window.open(`https://t.me/${user?.botCode || 'NewsCardBot'}`, '_blank')}>Open in Telegram</Button>
                          </div>
                        )}

                        <div className="space-y-4">
                          <Label className="text-xs font-bold">Quick Send to Channel</Label>
                          <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
                            <div className="space-y-1.5">
                              <Label className="text-[10px]">Chat ID</Label>
                              <Input 
                                value={chatId} 
                                onChange={e => setChatId(e.target.value)} 
                                placeholder="-100123456789" 
                                className="h-9 text-xs font-mono"
                              />
                            </div>
                            <Button 
                              className="w-full h-9 text-xs font-bold gap-2" 
                              disabled={isSendingTg} 
                              onClick={handleTelegramSend}
                            >
                              {isSendingTg ? "Sending..." : <><Send className="w-3.5 h-3.5" /> Send Current Card</>}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="settings" className="m-0 space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                <Accordion type="multiple" defaultValue={["item-ratio", "item-watermark"]} className="w-full space-y-4">
                  
                  {/* Aspect Ratio */}
                  <AccordionItem value="item-ratio" className="border rounded-xl bg-card overflow-hidden shadow-sm">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-sm">Image Dimensions</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-2">
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.entries(ASPECT_RATIOS) as [AspectRatio, { label: string; export: string }][]).map(([ratio, info]) => {
                          const icons: Record<string, string> = { "1:1": "⬛", "16:9": "▬", "4:5": "▮", "9:16": "📱" };
                          const isSelected = aspectRatio === ratio;
                          return (
                            <Button
                              key={ratio}
                              variant={isSelected ? "default" : "outline"}
                              className={cn("h-auto py-3 flex-col gap-1 border-2", isSelected && "border-primary")}
                              onClick={() => setAspectRatio(ratio)}
                            >
                              <span className="text-xl">{icons[ratio]}</span>
                              <span className="font-bold text-xs">{info.label}</span>
                              <span className="text-[9px] opacity-70 font-mono">{info.export}</span>
                            </Button>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Positioning */}
                  <AccordionItem value="item-pos" className="border rounded-xl bg-card overflow-hidden shadow-sm">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <Move className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-sm">Element Positioning</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-4 space-y-6">
                      <div className="space-y-4">
                        <Label className="text-xs text-muted-foreground uppercase">Logo Position</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { pos: "top-right" as LogoPos,    label: "Top Right" },
                            { pos: "top-left" as LogoPos,     label: "Top Left" },
                            { pos: "bottom-right" as LogoPos, label: "Bottom Right" },
                            { pos: "bottom-left" as LogoPos,  label: "Bottom Left" },
                          ].map(({ pos, label: lbl }) => (
                            <Button 
                              key={pos} 
                              variant={logoPos === pos ? "default" : "outline"}
                              size="sm"
                              className="h-9 text-[11px]"
                              onClick={() => setLogoPos(pos)}
                            >
                              {lbl}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {bgImage && (
                        <div className="space-y-6 pt-2 border-t">
                          <Label className="text-xs text-muted-foreground uppercase">Background Position</Label>
                          {[
                            { label: "Horizontal (Left - Right)", value: imgPositionX, onChange: setImgPositionX },
                            { label: "Vertical (Top - Bottom)", value: imgPositionY, onChange: setImgPositionY },
                          ].map((ctrl, i) => (
                            <div key={i} className="space-y-3">
                              <div className="flex justify-between text-[10px]">
                                <span>{ctrl.label}</span>
                                <span className="font-bold text-primary">{ctrl.value}%</span>
                              </div>
                              <Slider 
                                value={[ctrl.value]} 
                                onValueChange={([v]) => ctrl.onChange(v)}
                                min={0} max={100}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  {/* Watermark Section */}
                  <AccordionItem value="item-watermark" className="border rounded-xl bg-card overflow-hidden shadow-sm">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-sm">Watermark</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-4 space-y-5">
                      <div className="space-y-2">
                        <Label className="text-xs">Watermark text (e.g. site name)</Label>
                        <Input 
                          value={watermarkText} 
                          onChange={e => setWatermarkText(e.target.value)} 
                          placeholder="BerrechidNews.com"
                          className="h-10 text-xs"
                        />
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <Label className="text-xs text-muted-foreground">Opacity</Label>
                          <span className="text-xs font-bold">{Math.round(watermarkOpacity * 100)}%</span>
                        </div>
                        <Slider 
                          value={[watermarkOpacity * 100]} 
                          onValueChange={([v]) => setWatermarkOpacity(v / 100)}
                          min={5} max={80}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <div className="pt-4">
                  <Button 
                    className="w-full h-12 text-md font-bold gap-2 shadow-lg hover:shadow-primary/20 transition-all font-cairo"
                    onClick={handleDownload}
                    disabled={isDownloading}
                  >
                    {isDownloading ? "Generating..." : <><Save className="w-5 h-5" /> Download Card Now</>}
                  </Button>
                </div>
              </TabsContent>

          </div>
        </ScrollArea>
      </aside>

        {/* ── Right: Card preview ── */}
        <main className="flex-1 flex flex-col items-center justify-center p-6 bg-muted/20 overflow-y-auto min-w-0">
          {/* Card */}
          <div
            ref={cardRef}
            style={{
              width: cardW, height: cardH,
              position: "relative", overflow: "hidden",
              boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
              borderRadius: "4px", flexShrink: 0,
              background: "#1a2035",
            }}
          >
            {/* ── Photo area ─────────────────────────────────────────── */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: isFade ? "100%" : `${photoH}%`, overflow: "hidden" }}>
              {bgImage ? (
                <img src={bgImage} alt="bg" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${imgPositionX}% ${imgPositionY}%` }} />
              ) : (
                <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#1a2035,#2d3748)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "8px" }}>
                  <div style={{ fontSize: "28px", opacity: 0.5 }}>🖼️</div>
                  <p style={{ color: "#64748b", fontSize: "12px", fontFamily: "'Inter', sans-serif" }}>Add background image</p>
                </div>
              )}
            </div>

            {/* ── Banner background (always rendered, text only in classic mode) ── */}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              height: isFade ? "100%" : `${bannerH}%`,
              background: tmpl.bannerGradient || tmpl.bannerColor,
              borderRadius: tmpl.bannerBorderRadius,
              display: "flex", flexDirection: "column", justifyContent: "center",
              padding: isFade ? "0 14px 14px" : "10px 14px 10px",
              direction: "ltr",
              zIndex: 2,
            }}>
              {/* Classic mode: text lives inside banner */}
              {!canvasMode && (
                <>
                  {tmpl.showQuote && (
                    <div style={{ position: "absolute", top: 8, right: 10, fontSize: "30px", color: tmpl.accentColor || "#dc2626", lineHeight: 1, fontFamily: "Georgia, serif", opacity: 0.85 }}>❝</div>
                  )}
                  <p style={{ color: tmpl.textColor, fontSize: `${fontSize}px`, fontWeight, fontFamily: `'${font}', sans-serif`, lineHeight: 1.45, margin: 0, marginTop: tmpl.showQuote ? "24px" : 0, textShadow: textShadow ? "0 1px 4px rgba(0,0,0,0.7)" : "none", textAlign: headlineAlign }}>
                    {headline || "Enter headline here..."}
                  </p>
                  {showSubtitle && subtitle && (
                    <p style={{ color: tmpl.labelColor, fontSize: `${Math.max(11, fontSize - 8)}px`, fontFamily: `'${font}', sans-serif`, margin: "5px 0 0", lineHeight: 1.4, textAlign: subtitleAlign }}>{subtitle}</p>
                  )}
                  {showLabel && label && (
                    <div style={{ marginTop: "6px", alignSelf: labelAlign === "center" ? "center" : labelAlign === "left" ? "flex-end" : "flex-start", background: tmpl.isLight ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.1)", borderRadius: "4px", padding: "2px 8px" }}>
                      <span style={{ color: tmpl.labelColor, fontSize: "10px", fontFamily: `'${font}', sans-serif` }}>{label}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── Custom overlay (z-index 5 — above banner background, below canvas elements) ── */}
            {overlayImage && (
              <img src={overlayImage} alt="overlay" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "fill", pointerEvents: "none", zIndex: 5 }} />
            )}

            {/* ── Classic mode: Logo at fixed position ── */}
            {!canvasMode && (
              useLogoText && logoText ? (
                <div style={{ ...logoBoxStyle(), border: "none", background: "rgba(0,0,0,0.3)", zIndex: 6 }}>
                  <span style={{ color: "#ffffff", fontSize: "12px", fontWeight: 700, fontFamily: `'${font}', sans-serif` }}>{logoText}</span>
                </div>
              ) : logoImage ? (
                <img src={logoImage} alt="logo" style={{ ...logoStyle(), filter: logoInvert ? "invert(1)" : "none", zIndex: 6 }} />
              ) : (
                <div style={{ ...logoBoxStyle(), zIndex: 6 }}>
                  <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", fontFamily: "'Inter', sans-serif" }}>Logo</span>
                </div>
              )
            )}

            {/* ── Watermark (above overlay in both modes) ── */}
            {watermarkText && (
              <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: canvasMode ? 12 : 7 }}>
                <span style={{ fontSize: `${Math.max(10, fontSize * 0.85)}px`, color: `rgba(255,255,255,${watermarkOpacity})`, fontFamily: `'${font}', sans-serif`, fontWeight: 700, transform: "rotate(-30deg)", whiteSpace: "nowrap", textShadow: "0 1px 3px rgba(0,0,0,0.2)" }}>
                  {watermarkText}
                </span>
              </div>
            )}

            {/* ── CANVAS MODE: freely draggable elements (z-index 11+) ── */}
            {canvasMode && (
              <div
                onMouseDown={(e) => { if (e.target === e.currentTarget) setSelElem(null); }}
                style={{ position: "absolute", inset: 0, zIndex: 11 }}
              >

                {/* ── Reusable canvas element wrapper ── */}
                {(
                  [
                    {
                      key: "headline" as ElemKey,
                      rect: canvasLayout.headline,
                      label: "Headline",
                      content: (
                        <p style={{ color: customTextColor || tmpl.textColor, fontSize: `${fontSize}px`, fontWeight, fontFamily: `'${font}', sans-serif`, lineHeight: 1.45, margin: 0, textAlign: headlineAlign, textShadow: textShadow ? "0 1px 4px rgba(0,0,0,0.7)" : "none", pointerEvents: "none", direction: "ltr" }}>
                          {headline || "Enter headline here..."}
                        </p>
                      ),
                    },
                    ...(showSubtitle && subtitle ? [{
                      key: "subtitle" as ElemKey,
                      rect: canvasLayout.subtitle,
                      label: "Subtitle",
                      content: (
                        <p style={{ color: tmpl.labelColor, fontSize: `${Math.max(11, fontSize - 8)}px`, fontFamily: `'${font}', sans-serif`, margin: 0, lineHeight: 1.4, textAlign: subtitleAlign, pointerEvents: "none", direction: "ltr" }}>{subtitle}</p>
                      ),
                    }] : []),
                    ...(showLabel && label ? [{
                      key: "label" as ElemKey,
                      rect: canvasLayout.label,
                      label: "Label",
                      content: (
                        <div style={{ background: tmpl.isLight ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.1)", borderRadius: "4px", padding: "2px 8px", display: "inline-block", pointerEvents: "none" }}>
                          <span style={{ color: tmpl.labelColor, fontSize: "10px", fontFamily: `'${font}', sans-serif` }}>{label}</span>
                        </div>
                      ),
                    }] : []),
                    {
                      key: "logo" as ElemKey,
                      rect: canvasLayout.logo,
                      label: "Logo",
                      content: useLogoText && logoText ? (
                        <div style={{ background: "rgba(0,0,0,0.4)", borderRadius: "4px", padding: "3px 8px", display: "inline-block", pointerEvents: "none" }}>
                          <span style={{ color: "#ffffff", fontSize: "11px", fontWeight: 700, fontFamily: `'${font}', sans-serif` }}>{logoText}</span>
                        </div>
                      ) : logoImage ? (
                        <img src={logoImage} alt="logo" style={{ width: "100%", height: "auto", objectFit: "contain", filter: logoInvert ? "invert(1)" : "none", display: "block", pointerEvents: "none" }} />
                      ) : (
                        <div style={{ background: "rgba(255,255,255,0.08)", border: "1px dashed rgba(255,255,255,0.3)", borderRadius: "4px", padding: "4px 8px", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", fontFamily: "'Inter', sans-serif" }}>Logo</span>
                        </div>
                      ),
                    },
                  ] as { key: ElemKey; rect: { x: number; y: number; w: number } | undefined; label: string; content: React.ReactNode }[]
                ).filter(item => !!item.rect).map(({ key, rect, label: elemLabel, content }) => {
                  const rect2 = rect!;
                  const sel = selElem === key;
                  return (
                    <div
                      key={key}
                      onMouseDown={startDrag(key)}
                      style={{
                        position: "absolute",
                        left: `${rect2.x}%`, top: `${rect2.y}%`, width: `${rect2.w}%`,
                        cursor: "move", userSelect: "none",
                        outline: sel ? "2px solid #6366f1" : "1px dashed rgba(255,255,255,0.25)",
                        borderRadius: "4px",
                        padding: "2px 4px",
                        boxSizing: "border-box",
                        zIndex: sel ? 13 : 11,
                      }}
                    >
                      {content}

                      {/* Label badge (always shown in canvas mode) */}
                      <div style={{
                        position: "absolute", top: -16, left: 0,
                        fontSize: "9px", color: sel ? "#c7d2fe" : "rgba(255,255,255,0.45)",
                        background: sel ? "rgba(99,102,241,0.85)" : "rgba(0,0,0,0.5)",
                        padding: "1px 6px", borderRadius: "3px", whiteSpace: "nowrap",
                        pointerEvents: "none", lineHeight: 1.6,
                      }}>
                        {elemLabel}
                      </div>

                      {/* ── Resize handle — bottom-right corner, large touch target ── */}
                      <div
                        onMouseDown={startResize(key)}
                        onClick={(e) => e.stopPropagation()}
                        title="Drag to resize"
                        style={{
                          position: "absolute",
                          bottom: 0, right: 0,
                          width: 26, height: 26,
                          background: sel ? "#6366f1" : "rgba(99,102,241,0.7)",
                          cursor: "ew-resize",
                          borderRadius: "4px 0 4px 0",
                          zIndex: 15,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "12px", color: "#fff",
                          userSelect: "none",
                          boxShadow: "0 1px 5px rgba(0,0,0,0.5)",
                          lineHeight: 1,
                        }}
                      >
                        ↔
                      </div>
                    </div>
                  );
                })}

              </div>
            )}
          </div>

          {/* Caption + canvas toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", maxWidth: `${cardW}px`, gap: "8px" }}>
            <p style={{ color: "#475569", fontSize: "11px", fontFamily: "Inter, monospace", letterSpacing: "0.02em", margin: 0 }}>
              {cardW}×{cardH} → {ASPECT_RATIOS[aspectRatio].export}
            </p>
            <div style={{ display: "flex", gap: "6px" }}>
              {canvasMode && (
                <button
                  onClick={() => setCanvasLayout(CANVAS_DEFAULT)}
                  title="Reset positions"
                  style={{ padding: "5px 10px", background: "rgba(100,116,139,0.15)", border: "1px solid rgba(100,116,139,0.3)", borderRadius: "7px", color: "#94a3b8", cursor: "pointer", fontSize: "11px", fontFamily: "'Inter', sans-serif" }}
                >↺ Reset</button>
              )}
              <button
                onClick={() => { setCanvasMode(p => !p); setSelElem(null); }}
                style={{
                  padding: "5px 12px",
                  background: canvasMode ? "rgba(99,102,241,0.2)" : "rgba(100,116,139,0.1)",
                  border: `1px solid ${canvasMode ? "rgba(99,102,241,0.6)" : "rgba(100,116,139,0.3)"}`,
                  borderRadius: "7px",
                  color: canvasMode ? "#a5b4fc" : "#94a3b8",
                  cursor: "pointer", fontSize: "12px", fontWeight: 600,
                  fontFamily: "'Inter', sans-serif",
                  display: "flex", alignItems: "center", gap: "5px",
                }}
              >
                {canvasMode ? "✏️ Free Design Mode — ON" : "✏️ Free Design Mode"}
              </button>
            </div>
          </div>

          {canvasMode && (
            <div style={{ width: "100%", maxWidth: `${cardW}px`, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: "8px", padding: "8px 12px", direction: "ltr" }}>
              <p style={{ margin: 0, fontSize: "11px", color: "#a5b4fc", fontFamily: "'Inter', sans-serif", lineHeight: 1.6 }}>
                🎨 <strong>Free Design Mode:</strong> Drag any element (headline / logo / label) to where you want it on the card. Drag the blue bar on the right to resize.
              </p>
            </div>
          )}

          {/* Download button */}
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            style={{
              width: "100%", maxWidth: `${cardW}px`,
              padding: "13px", background: isDownloading ? "#1d4ed8" : "#3b82f6",
              color: "#fff", border: "none", borderRadius: "10px",
              cursor: isDownloading ? "wait" : "pointer",
              fontSize: "15px", fontWeight: 600, fontFamily: "'Inter', sans-serif",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              transition: "background 0.15s",
            }}
          >
            {isDownloading ? "⏳ Exporting..." : "📥 Download Card PNG"}
          </button>

          {/* n8n + Telegram row */}
          <div style={{ width: "100%", maxWidth: `${cardW}px`, display: "flex", gap: "8px" }}>
            <button
              onClick={() => {
                const url = `${window.location.origin}/api/generate`;
                navigator.clipboard?.writeText(url).then(() => toast({ title: "Copied ✅", description: "API URL copied to clipboard" }));
              }}
              style={{ flex: 1, padding: "11px", background: "#1a1208", color: "#f59e0b", border: "1px solid #44320a", borderRadius: "10px", cursor: "pointer", fontSize: "13px", fontWeight: 600, fontFamily: "'Inter', sans-serif" }}
            >
              n8n ⚡
            </button>
            <button
              onClick={() => { setActiveTab("api"); }}
              style={{ flex: 1, padding: "11px", background: "#052e16", color: "#4ade80", border: "1px solid #14532d", borderRadius: "10px", cursor: "pointer", fontSize: "13px", fontWeight: 600, fontFamily: "'Inter', sans-serif" }}
            >
              Telegram 🔗
            </button>
          </div>

        </main>
    </Tabs>
  );
}
