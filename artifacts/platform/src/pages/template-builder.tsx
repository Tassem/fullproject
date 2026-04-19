import { useState, useRef, useEffect, useCallback } from "react";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  Undo2, Redo2, Save, Upload, Trash2, Lock, Unlock, Eye, EyeOff,
  Copy, ChevronUp, ChevronDown, ZoomIn, ZoomOut, AlignLeft, AlignCenter,
  AlignRight, Layers, Image, Type, Square, Circle, Minus, Grid,
  Download, FolderOpen,
} from "lucide-react";

// ─── Design tokens ────────────────────────────────────────────────────────────
const AC  = "#6366f1";
const AC2 = "#22d3ee";
const BG  = "rgba(255,255,255,0.04)";
const BD  = "rgba(255,255,255,0.08)";
const BD2 = "rgba(255,255,255,0.18)";
const TX  = "rgba(255,255,255,0.88)";
const MT  = "rgba(255,255,255,0.4)";

// ─── Canvas constants ─────────────────────────────────────────────────────────
const CW = 540;
const CH = 540;

// ─── Canvas size presets ──────────────────────────────────────────────────────
const CANVAS_SIZES = [
  { label: "Square 1:1 (1080×1080)",     w: 540,  h: 540,  ratio: "1:1"     },
  { label: "Landscape 16:9 (1920×1080)", w: 540,  h: 304,  ratio: "16:9"    },
  { label: "Portrait 9:16 (1080×1920)",  w: 304,  h: 540,  ratio: "9:16"    },
  { label: "Portrait 4:5 (1080×1350)",   w: 540,  h: 675,  ratio: "4:5"     },
  { label: "Wide OG 1.91:1 (1200×628)", w: 540,  h: 283,  ratio: "1.91:1"  },
  { label: "Classic 4:3 (1024×768)",     w: 540,  h: 405,  ratio: "4:3"     },
];

// ─── Types ────────────────────────────────────────────────────────────────────
type EType = "bg" | "photo" | "text" | "rect" | "circle" | "line" | "badge" | "social" | "logo";

interface CE {
  id: string; type: EType;
  x: number; y: number; w: number; h: number;
  zIndex: number;
  locked?: boolean; hidden?: boolean;
  // Style
  opacity?: number; fill?: string; gradient?: string; borderRadius?: number;
  borderColor?: string; borderWidth?: number;
  // Text / Badge
  content?: string; color?: string; fontSize?: number;
  fontFamily?: string; fontWeight?: string;
  textAlign?: "right" | "center" | "left"; lineHeight?: number;
  // Social / Logo
  platform?: string; src?: string;
  // Badge bg
  bgColor?: string;
}

// ─── Social platforms ─────────────────────────────────────────────────────────
const SOCIALS = [
  { id: "twitter",   label: "X / Twitter", color: "#000000", bg: "#000", glyph: "𝕏" },
  { id: "instagram", label: "Instagram",   color: "#E1306C", bg: "linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)", glyph: "📷" },
  { id: "facebook",  label: "Facebook",    color: "#1877F2", bg: "#1877F2", glyph: "f" },
  { id: "youtube",   label: "YouTube",     color: "#FF0000", bg: "#FF0000", glyph: "▶" },
  { id: "tiktok",    label: "TikTok",      color: "#010101", bg: "#010101", glyph: "♪" },
  { id: "whatsapp",  label: "WhatsApp",    color: "#25D366", bg: "#25D366", glyph: "✆" },
  { id: "telegram",  label: "Telegram",    color: "#229ED9", bg: "#229ED9", glyph: "✈" },
  { id: "snapchat",  label: "Snapchat",    color: "#FFFC00", bg: "#FFFC00", glyph: "👻" },
];

const FONTS = ["Cairo", "Tajawal", "Amiri", "Noto Kufi Arabic", "IBM Plex Arabic", "Reem Kufi"];

const uid = () => Math.random().toString(36).slice(2, 8);

// ─── Default template ─────────────────────────────────────────────────────────
const DEFAULT: CE[] = [
  { id: "bg", type: "bg", x: 0, y: 0, w: CW, h: CH, zIndex: 0, locked: true,
    gradient: "linear-gradient(170deg, #0d1b3e 0%, #0f2557 55%, #1a3a6e 100%)", fill: "#0f2557" },
  { id: "photo", type: "photo", x: 0, y: 0, w: CW, h: 312, zIndex: 1 },
  { id: "label", type: "text", x: 18, y: 326, w: 340, h: 26, zIndex: 4,
    content: "Archival photo", color: "rgba(255,255,255,0.55)", fontSize: 12,
    fontFamily: "Inter", fontWeight: "400", textAlign: "right" },
  { id: "headline", type: "text", x: 14, y: 358, w: 512, h: 120, zIndex: 4,
    content: "Main news headline written here clearly and readably", color: "#ffffff",
    fontSize: 22, fontFamily: "Inter", fontWeight: "700", textAlign: "right", lineHeight: 1.6 },
  { id: "logo", type: "logo", x: CW - 114, y: 12, w: 102, h: 44, zIndex: 6 },
  { id: "badge", type: "badge", x: 12, y: 14, w: 64, h: 26, zIndex: 6,
    content: "Breaking", bgColor: "#dc2626", color: "#fff", fontSize: 12,
    fontFamily: "Inter", fontWeight: "800", borderRadius: 999 },
];

// ─── Render element content ───────────────────────────────────────────────────
function ElContent({ el, scale }: { el: CE; scale: number }) {
  const plat = SOCIALS.find(p => p.id === el.platform) ?? SOCIALS[0];

  if (el.type === "bg") {
    const isTransparent = el.fill === "transparent";
    return (
      <div style={{
        width: "100%", height: "100%",
        backgroundColor: isTransparent ? "transparent" : (el.fill || "#000"),
        backgroundImage: el.src
          ? `url(${el.src})`
          : isTransparent
            ? "repeating-conic-gradient(#555 0% 25%, #333 0% 50%)"
            : (el.gradient ?? undefined),
        backgroundSize: el.src ? "cover" : (isTransparent ? "20px 20px" : undefined),
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        opacity: el.opacity ?? 1,
      }} />
    );
  }

  if (el.type === "photo") return (
    <div style={{
      width: "100%", height: "100%", position: "relative", overflow: "hidden",
      background: el.src ? "transparent" : "none",
      display: "flex", alignItems: "center", justifyContent: "center",
      opacity: el.opacity ?? 1,
    }}>
      {el.src
        ? <img src={el.src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <div style={{
            position: "absolute", inset: 0,
            border: `${1.5 * scale}px dashed rgba(255,255,255,0.18)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", gap: 4,
          }}>
            <div style={{ fontSize: 22 * scale, opacity: 0.2 }}>📸</div>
            <div style={{ fontSize: 8 * scale, color: "rgba(255,255,255,0.2)", fontFamily: "Inter" }}>Photo area</div>
          </div>
      }
    </div>
  );

  if (el.type === "text") return (
    <div style={{
      width: "100%", height: "100%", overflow: "hidden",
      color: el.color ?? "#fff",
      fontSize: (el.fontSize ?? 16) * scale,
      fontFamily: `'${el.fontFamily ?? "Cairo"}', sans-serif`,
      fontWeight: el.fontWeight ?? "400",
      textAlign: el.textAlign ?? "right",
      lineHeight: el.lineHeight ?? 1.5,
      direction: "ltr", opacity: el.opacity ?? 1, wordBreak: "break-word",
    }}>
      {el.content || "Text here"}
    </div>
  );

  if (el.type === "rect") return (
    <div style={{
      width: "100%", height: "100%",
      background: el.gradient || el.fill || "#6366f1",
      borderRadius: (el.borderRadius ?? 0) * scale,
      border: el.borderWidth ? `${el.borderWidth * scale}px solid ${el.borderColor ?? "#fff"}` : "none",
      opacity: el.opacity ?? 1,
    }} />
  );

  if (el.type === "circle") return (
    <div style={{
      width: "100%", height: "100%", borderRadius: "50%",
      background: el.fill || "#6366f1",
      border: el.borderWidth ? `${el.borderWidth * scale}px solid ${el.borderColor ?? "#fff"}` : "none",
      opacity: el.opacity ?? 1,
    }} />
  );

  if (el.type === "line") return (
    <div style={{
      width: "100%",
      height: Math.max(1, (el.borderWidth ?? 2) * scale),
      background: el.fill || "#fff",
      borderRadius: 99, opacity: el.opacity ?? 1,
      marginTop: "50%", transform: "translateY(-50%)",
    }} />
  );

  if (el.type === "badge") return (
    <div style={{
      width: "100%", height: "100%",
      background: el.bgColor || "#dc2626",
      borderRadius: (el.borderRadius ?? 999) * scale,
      display: "flex", alignItems: "center", justifyContent: "center",
      opacity: el.opacity ?? 1,
    }}>
      <span style={{
        color: el.color ?? "#fff",
        fontSize: (el.fontSize ?? 13) * scale,
        fontFamily: `'${el.fontFamily ?? "Cairo"}', sans-serif`,
        fontWeight: el.fontWeight ?? "800",
      }}>{el.content || "Text"}</span>
    </div>
  );

  if (el.type === "social") return (
    <div style={{
      width: "100%", height: "100%", borderRadius: (el.borderRadius ?? 10) * scale,
      background: el.fill || plat.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      opacity: el.opacity ?? 1,
    }}>
      <span style={{ fontSize: (el.fontSize ?? 20) * scale, lineHeight: 1 }}>{plat.glyph}</span>
    </div>
  );

  if (el.type === "logo") return (
    <div style={{
      width: "100%", height: "100%",
      display: "flex", alignItems: "center", justifyContent: "center",
      opacity: el.opacity ?? 1,
    }}>
      {el.src
        ? <img src={el.src} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
        : <div style={{
            border: `${1.5 * scale}px dashed rgba(255,255,255,0.35)`,
            borderRadius: 6 * scale, width: "100%", height: "100%",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 9 * scale, color: "rgba(255,255,255,0.35)", fontFamily: "Inter" }}>Logo</span>
          </div>
      }
    </div>
  );

  return null;
}

// ─── Prop row helper ──────────────────────────────────────────────────────────
const PR = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 12 }}>
    <label style={{ fontSize: 10, color: MT, display: "block", marginBottom: 5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</label>
    {children}
  </div>
);

const numIn = (val: number, onChange: (v: number) => void, min = -9999, max = 9999): React.ReactNode => (
  <input type="number" value={Math.round(val)} min={min} max={max}
    onChange={e => onChange(Number(e.target.value))}
    style={{ width: "100%", background: BG, border: `1px solid ${BD}`, borderRadius: 7,
      color: TX, padding: "6px 8px", fontSize: 12, outline: "none",
      fontFamily: "'Cairo', sans-serif", boxSizing: "border-box" as const }} />
);

const txtIn = (val: string, onChange: (v: string) => void, placeholder = ""): React.ReactNode => (
  <input type="text" value={val} placeholder={placeholder} onChange={e => onChange(e.target.value)}
    style={{ width: "100%", background: BG, border: `1px solid ${BD}`, borderRadius: 7,
      color: TX, padding: "7px 10px", fontSize: 12, outline: "none",
      fontFamily: "'Cairo', sans-serif", boxSizing: "border-box" as const }} />
);

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function TemplateBuilder() {
  const { toast } = useToast();
  const { data: user } = useGetMe({
    query: { enabled: !!localStorage.getItem("pro_token"), queryKey: getGetMeQueryKey() },
  });
  const isAdmin = !!user?.isAdmin;
  const token   = localStorage.getItem("pro_token") ?? "";

  // ── Admin mode (from admin panel) ─────────────────────────────────────────
  const urlParams = new URLSearchParams(window.location.search);
  const fromAdmin = urlParams.get("from") === "admin";
  const editSystemTemplateId = urlParams.get("editSystemTemplate");

  // ── State ──────────────────────────────────────────────────────────────────
  const [els, setEls] = useState<CE[]>(() => DEFAULT.map(e => ({ ...e })));
  const [selId, setSelId]     = useState<string | null>(null);
  const [zoom, setZoom]       = useState(0.82);
  const [leftTab, setLeftTab] = useState<"elements" | "layers">("elements");
  const [tplName, setTplName] = useState("My Custom Template");
  const [tplCat, setTplCat]   = useState("News");
  const [history, setHistory] = useState<CE[][]>([DEFAULT.map(e => ({ ...e }))]);
  const [histIdx, setHistIdx] = useState(0);
  const [saving, setSaving]   = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState(CANVAS_SIZES[0]);
  const [watermark, setWatermark] = useState("");
  const [watermarkPos, setWatermarkPos] = useState<"bottom-right"|"bottom-left"|"bottom-center"|"top-right">("bottom-right");
  const [watermarkFontSize, setWatermarkFontSize] = useState(14);
  const [watermarkFontFamily, setWatermarkFontFamily] = useState("Inter");
  const [watermarkColor, setWatermarkColor] = useState("rgba(255,255,255,0.6)");
  const [watermarkBold, setWatermarkBold] = useState(false);
  const [watermarkItalic, setWatermarkItalic] = useState(false);
  const [watermarkBg, setWatermarkBg] = useState(false);
  const [savedTemplateId, setSavedTemplateId] = useState<number | null>(null);

  const canvasRef  = useRef<HTMLDivElement>(null);
  const dragRef    = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const resizeRef  = useRef<{ id: string; handle: string; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number } | null>(null);
  const fileRef    = useRef<HTMLInputElement>(null);
  const logoRef    = useRef<HTMLInputElement>(null);
  const importRef  = useRef<HTMLInputElement>(null);

  const sel = els.find(e => e.id === selId) ?? null;

  // ── Load template from gallery ("Use Template" or "Edit Template") ──────
  useEffect(() => {
    const raw      = localStorage.getItem("ncg_use_template");
    const name     = localStorage.getItem("ncg_use_template_name");
    const cat      = localStorage.getItem("ncg_use_template_cat");
    const editId   = localStorage.getItem("ncg_edit_user_template_id");
    // Always clean up classic preset (used when navigating from classic builtin templates)
    localStorage.removeItem("ncg_classic_preset");
    if (!raw) {
      // Classic template preset: apply name/category and start with empty canvas
      if (name) { setTplName(name); localStorage.removeItem("ncg_use_template_name"); }
      if (cat)  { setTplCat(cat);  localStorage.removeItem("ncg_use_template_cat"); }
      return;
    }
    localStorage.removeItem("ncg_use_template");
    localStorage.removeItem("ncg_use_template_name");
    localStorage.removeItem("ncg_use_template_cat");
    localStorage.removeItem("ncg_edit_user_template_id");
    try {
      const layout = JSON.parse(raw);
      const elems: CE[] = Array.isArray(layout?.elements) ? layout.elements : null;
      if (!elems) return;
      if (name) setTplName(name);
      if (cat)  setTplCat(cat);
      // If editing an existing user template → set the ID so Save will UPDATE
      if (editId) setSavedTemplateId(Number(editId));
      setEls(elems.map(e => ({ ...e })));
      setHistory([elems.map(e => ({ ...e }))]);
      setHistIdx(0);
      setSelId(null);
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load system template for editing (from admin panel) ───────────────────
  useEffect(() => {
    if (!editSystemTemplateId) return;
    const adminToken = localStorage.getItem("ncg_admin_token") || token;
    fetch(`/api/admin/system-templates/${editSystemTemplateId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.name) setTplName(data.name);
        if (data.category) setTplCat(data.category);
        const layout = data.canvasLayout;
        if (layout && Array.isArray(layout.elements)) {
          const elems: CE[] = layout.elements;
          setEls(elems.map(e => ({ ...e })));
          setHistory([elems.map(e => ({ ...e }))]);
          setHistIdx(0);
          setSelId(null);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editSystemTemplateId]);

  // ── History ────────────────────────────────────────────────────────────────
  const commit = useCallback((next: CE[]) => {
    setEls(next);
    setHistory(h => {
      const trimmed = h.slice(0, histIdx + 1);
      return [...trimmed, next.map(e => ({ ...e }))];
    });
    setHistIdx(i => i + 1);
  }, [histIdx]);

  const undo = () => {
    if (histIdx <= 0) return;
    const prev = history[histIdx - 1];
    setEls(prev.map(e => ({ ...e })));
    setHistIdx(i => i - 1);
  };
  const redo = () => {
    if (histIdx >= history.length - 1) return;
    const next = history[histIdx + 1];
    setEls(next.map(e => ({ ...e })));
    setHistIdx(i => i + 1);
  };

  // ── Update element ─────────────────────────────────────────────────────────
  const upd = useCallback((id: string, patch: Partial<CE>, doCommit = true) => {
    setEls(prev => {
      const next = prev.map(e => e.id === id ? { ...e, ...patch } : e);
      if (doCommit) {
        setHistory(h => {
          const trimmed = h.slice(0, histIdx + 1);
          return [...trimmed, next.map(e => ({ ...e }))];
        });
        setHistIdx(i => i + 1);
      }
      return next;
    });
  }, [histIdx]);

  // ── Add element ────────────────────────────────────────────────────────────
  const addEl = (type: EType, extra: Partial<CE> = {}) => {
    const maxZ = Math.max(...els.map(e => e.zIndex), 0);
    const base: CE = {
      id: uid(), type,
      x: 80 + Math.random() * 80, y: 80 + Math.random() * 80,
      w: 140, h: 50, zIndex: maxZ + 1,
    };
    const presets: Partial<Record<EType, Partial<CE>>> = {
      text:   { content: "New text", color: "#fff", fontSize: 18, fontFamily: "Inter", fontWeight: "700", textAlign: "right", w: 260, h: 60 },
      rect:   { fill: "#6366f1", borderRadius: 8, w: 160, h: 90 },
      circle: { fill: "#8b5cf6", w: 80, h: 80 },
      line:   { fill: "#fff", borderWidth: 2, w: 200, h: 10 },
      badge:  { content: "Breaking", bgColor: "#dc2626", color: "#fff", fontSize: 13, fontFamily: "Inter", fontWeight: "800", borderRadius: 999, w: 70, h: 30 },
      social: { platform: "instagram", borderRadius: 10, w: 44, h: 44 },
      logo:   { w: 110, h: 48 },
      photo:  { w: CW, h: 200, x: 0, y: 0, zIndex: maxZ + 1 },
    };
    const next = [...els, { ...base, ...(presets[type] ?? {}), ...extra }];
    commit(next);
    setSelId(base.id);
  };

  // ── Delete / duplicate ─────────────────────────────────────────────────────
  const delEl = (id: string) => {
    commit(els.filter(e => e.id !== id));
    setSelId(null);
  };
  const dupEl = (id: string) => {
    const el = els.find(e => e.id === id);
    if (!el) return;
    const maxZ = Math.max(...els.map(e => e.zIndex), 0);
    const copy = { ...el, id: uid(), x: el.x + 14, y: el.y + 14, zIndex: maxZ + 1 };
    commit([...els, copy]);
    setSelId(copy.id);
  };

  // ── Z-order ────────────────────────────────────────────────────────────────
  const bringForward = (id: string) => {
    const el = els.find(e => e.id === id);
    if (!el) return;
    commit(els.map(e => e.id === id ? { ...e, zIndex: e.zIndex + 1 } : e));
  };
  const sendBack = (id: string) => {
    const el = els.find(e => e.id === id);
    if (!el || el.zIndex <= 0) return;
    commit(els.map(e => e.id === id ? { ...e, zIndex: Math.max(0, e.zIndex - 1) } : e));
  };

  // ── Mouse drag ────────────────────────────────────────────────────────────
  const onElMouseDown = (e: React.MouseEvent, el: CE) => {
    if (el.locked) return;
    e.stopPropagation();
    e.preventDefault();
    setSelId(el.id);
    dragRef.current = { id: el.id, sx: e.clientX, sy: e.clientY, ox: el.x, oy: el.y };
  };

  // ── Mouse resize ──────────────────────────────────────────────────────────
  const onResizeDown = (e: React.MouseEvent, el: CE, handle: string) => {
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = null;
    resizeRef.current = { id: el.id, handle, sx: e.clientX, sy: e.clientY, ox: el.x, oy: el.y, ow: el.w, oh: el.h };
  };

  // ── Global mouse events ───────────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const inv = 1 / zoom;
      if (dragRef.current) {
        const { id, sx, sy, ox, oy } = dragRef.current;
        const dx = (e.clientX - sx) * inv;
        const dy = (e.clientY - sy) * inv;
        setEls(prev => prev.map(el => el.id === id
          ? { ...el, x: Math.round(ox + dx), y: Math.round(oy + dy) } : el));
        return;
      }
      if (resizeRef.current) {
        const { id, handle, sx, sy, ox, oy, ow, oh } = resizeRef.current;
        const dx = (e.clientX - sx) * inv;
        const dy = (e.clientY - sy) * inv;
        let nx = ox, ny = oy, nw = ow, nh = oh;
        if (handle.includes("e")) nw = Math.max(20, ow + dx);
        if (handle.includes("s")) nh = Math.max(10, oh + dy);
        if (handle.includes("w")) { nw = Math.max(20, ow - dx); nx = ox + (ow - nw); }
        if (handle.includes("n")) { nh = Math.max(10, oh - dy); ny = oy + (oh - nh); }
        setEls(prev => prev.map(el => el.id === id
          ? { ...el, x: Math.round(nx), y: Math.round(ny), w: Math.round(nw), h: Math.round(nh) } : el));
      }
    };
    const onUp = () => {
      if (dragRef.current || resizeRef.current) {
        setEls(prev => {
          setHistory(h => {
            const slice = h.slice(0, histIdx + 1);
            return [...slice, prev.map(e => ({ ...e }))];
          });
          setHistIdx(i => i + 1);
          return prev;
        });
      }
      dragRef.current = null;
      resizeRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [zoom, histIdx]);

  // ── Image upload ──────────────────────────────────────────────────────────
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, forLogo = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const src = ev.target?.result as string;
      if (forLogo) {
        const existing = els.find(el => el.type === "logo");
        if (existing) upd(existing.id, { src });
        else addEl("logo", { src });
      } else {
        // Always create a NEW photo element (allow multiple photos)
        addEl("photo", { src, w: canvasSize.w, h: Math.round(canvasSize.h * 0.58), x: 0, y: 0 });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ── Upload base64 image to server and return URL (fast method) ───────────
  const uploadBase64 = async (base64: string, authToken: string): Promise<string | null> => {
    try {
      const fetchRes = await fetch(base64);
      const blob = await fetchRes.blob();
      const ext = blob.type.split("/")[1] || "png";
      const form = new FormData();
      form.append("photo", blob, `img-${Date.now()}.${ext}`);
      const r = await fetch("/api/photo/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: form,
      });
      if (!r.ok) return null;
      const { previewUrl } = await r.json();
      return previewUrl as string;
    } catch { return null; }
  };

  // ── Prepare elements for saving ─────────────────────────────────────────
  // Photo elements: strip src (photos are added fresh when generating)
  // BG/Logo elements with base64 src: upload to server
  const prepareEls = async (authToken: string): Promise<CE[]> => {
    const result: CE[] = [];
    for (const e of els) {
      if (e.type === "photo") {
        // Templates never save photo src — photos are runtime content
        result.push({ ...e, src: "" });
      } else if (e.src && e.src.startsWith("data:")) {
        // BG image or logo: upload to server
        const url = await uploadBase64(e.src, authToken);
        result.push({ ...e, src: url || "" });
      } else {
        result.push(e);
      }
    }
    return result;
  };

  // ── Save / Publish ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!token) { toast({ title: "Not logged in", description: "Please log in to save templates", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const safeEls = await prepareEls(token);
      const wmData = watermark ? JSON.stringify({
        text: watermark, pos: watermarkPos,
        fontSize: watermarkFontSize, fontFamily: watermarkFontFamily,
        color: watermarkColor, bold: watermarkBold, italic: watermarkItalic, bg: watermarkBg,
      }) : null;
      const payload = {
        name: tplName?.trim() || "Custom Template",
        category: tplCat || "News",
        bannerColor: safeEls.find(e => e.type === "bg")?.fill || "#0f2557",
        textColor: (safeEls.find(e => e.type === "text" && e.id === "headline") ?? safeEls.find(e => e.type === "text"))?.color || "#fff",
        font: (safeEls.find(e => e.type === "text"))?.fontFamily || "Cairo",
        aspectRatio: canvasSize.ratio,
        isPublic: false,
        canvasLayout: { width: canvasSize.w, height: canvasSize.h, elements: safeEls },
        watermark: wmData,
      };
      const isUpdate = !!savedTemplateId;
      const url = isUpdate ? `/api/templates/${savedTemplateId}` : "/api/templates";
      const method = isUpdate ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (!isUpdate && data.id) setSavedTemplateId(data.id);
        toast({ title: isUpdate ? "✅ Updated" : "✅ Saved", description: "Template saved successfully" });
      } else {
        let errMsg = "Save failed";
        try { const d = await res.json(); errMsg = d.error || errMsg; } catch {}
        toast({ title: "Error saving", description: errMsg, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "destructive" });
    } finally { setSaving(false); }
  };

  // ── Export template as JSON file ──────────────────────────────────────────
  const handleExport = () => {
    const payload = { name: tplName, category: tplCat, version: 1, elements: els };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `${tplName || "template"}.ncgt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Import template from JSON file ────────────────────────────────────────
  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        const elems: CE[] = Array.isArray(data) ? data
          : Array.isArray(data.elements) ? data.elements : null;
        if (!elems) throw new Error("Invalid format");
        if (data.name) setTplName(data.name);
        if (data.category) setTplCat(data.category);
        commit(elems.map(e => ({ ...e })));
        setSelId(null);
        toast({ title: "✅ Imported", description: `${elems.length} elements` });
      } catch {
        toast({ title: "Error", description: "Invalid template file", variant: "destructive" });
      }
    };
    reader.readAsText(file);
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const adminToken = localStorage.getItem("ncg_admin_token") || token;
      // Upload any base64 bg images to server first
      const safeEls = await prepareEls(adminToken);

      const bgEl      = safeEls.find(e => e.type === "bg");
      const headline  = safeEls.find(e => e.type === "text" && e.id === "headline")
                     ?? safeEls.find(e => e.type === "text");
      const labelEl   = safeEls.find(e => e.type === "text" && e.id === "label");

      const bannerColor    = bgEl?.fill      || "#0f2557";
      const bannerGradient = bgEl?.gradient  || null;
      const textColor      = headline?.color || "#ffffff";
      const labelColor     = labelEl?.color  || "rgba(255,255,255,0.7)";
      const font           = headline?.fontFamily || "Cairo";
      const name           = tplName?.trim() || "Custom Template";

      const isEdit = !!editSystemTemplateId;
      const url    = isEdit ? `/api/admin/system-templates/${editSystemTemplateId}` : "/api/admin/system-templates";
      const method = isEdit ? "PUT" : "POST";

      const wmData = watermark ? JSON.stringify({
        text: watermark, pos: watermarkPos,
        fontSize: watermarkFontSize, fontFamily: watermarkFontFamily,
        color: watermarkColor, bold: watermarkBold, italic: watermarkItalic, bg: watermarkBg,
      }) : null;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          name, category: tplCat || "News",
          bannerColor, bannerGradient, textColor, labelColor, font,
          isActive: true,
          watermark: wmData,
          canvasLayout: { width: canvasSize.w, height: canvasSize.h, elements: safeEls },
        }),
      });
      if (res.ok) {
        toast({ title: isEdit ? "✅ Updated" : "⏳ Submitted for Review", description: isEdit ? "Template updated" : "Template submitted — admin will review and approve it for the gallery" });
        if (fromAdmin) setTimeout(() => { window.location.href = "/pro/admin"; }, 900);
      } else {
        const d = await res.json();
        toast({ title: "Error", description: d.error, variant: "destructive" });
      }
    } finally { setPublishing(false); }
  };

  // ── Resize handles ────────────────────────────────────────────────────────
  const HANDLES = [
    { id: "nw", cursor: "nw-resize", top: -6, left: -6 },
    { id: "n",  cursor: "n-resize",  top: -6, left: "50%", transform: "translateX(-50%)" },
    { id: "ne", cursor: "ne-resize", top: -6, right: -6 },
    { id: "e",  cursor: "e-resize",  top: "50%", right: -6, transform: "translateY(-50%)" },
    { id: "se", cursor: "se-resize", bottom: -6, right: -6 },
    { id: "s",  cursor: "s-resize",  bottom: -6, left: "50%", transform: "translateX(-50%)" },
    { id: "sw", cursor: "sw-resize", bottom: -6, left: -6 },
    { id: "w",  cursor: "w-resize",  top: "50%", left: -6, transform: "translateY(-50%)" },
  ];

  const sortedEls = [...els].sort((a, b) => a.zIndex - b.zIndex);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      fontFamily: "'Cairo', sans-serif", direction: "ltr",
      display: "flex", flexDirection: "column", height: "calc(100vh - 0px)",
      overflow: "hidden", background: "#080810",
    }}>

      {/* ════ TOP BAR ═══════════════════════════════════════════════════════ */}
      <div style={{
        height: 56, flexShrink: 0,
        background: "rgba(8,8,20,0.98)", borderBottom: `1px solid ${BD}`,
        display: "flex", alignItems: "center", gap: 8, padding: "0 14px",
        backdropFilter: "blur(20px)",
      }}>
        {/* Back to admin button */}
        {fromAdmin && (
          <button
            onClick={() => { window.location.href = "/pro/admin"; }}
            style={{
              ...toolBtn,
              background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)",
              color: "#a5b4fc", padding: "7px 12px", gap: 5, fontSize: 11, fontWeight: 700,
            }}
          >← Admin Panel</button>
        )}

        {/* Template name */}
        <input value={tplName} onChange={e => setTplName(e.target.value)}
          style={{ background: BG, border: `1px solid ${BD}`, borderRadius: 8,
            color: TX, padding: "6px 12px", fontSize: 13, fontWeight: 700,
            outline: "none", fontFamily: "'Cairo', sans-serif", width: 160 }} />
        <select value={tplCat} onChange={e => setTplCat(e.target.value)}
          style={{ background: BG, border: `1px solid ${BD}`, borderRadius: 8,
            color: TX, padding: "6px 10px", fontSize: 12, outline: "none",
            fontFamily: "'Cairo', sans-serif" }}>
          {["News","Breaking","Sports","Quote","Modern","Premium","Featured","Social"].map(c =>
            <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Image Dimensions / Canvas size */}
        <select
          value={canvasSize.label}
          onChange={e => {
            const s = CANVAS_SIZES.find(x => x.label === e.target.value);
            if (!s) return;
            setCanvasSize(s);
            // Resize background element to match new canvas
            const newEls = els.map(el => el.type === "bg" ? { ...el, w: s.w, h: s.h } : el);
            commit(newEls);
          }}
          style={{ background: BG, border: `1px solid rgba(99,102,241,0.35)`, borderRadius: 8,
            color: "#a5b4fc", padding: "6px 8px", fontSize: 10, outline: "none",
            fontFamily: "'Cairo', sans-serif", maxWidth: 180 }}>
          {CANVAS_SIZES.map(s => <option key={s.label} value={s.label}>{s.label}</option>)}
        </select>

        <div style={{ flex: 1 }} />

        {/* Undo / Redo */}
        <button onClick={undo} disabled={histIdx <= 0} title="Undo"
          style={{ ...toolBtn, opacity: histIdx <= 0 ? 0.3 : 1 }}><Undo2 size={15} /></button>
        <button onClick={redo} disabled={histIdx >= history.length - 1} title="Redo"
          style={{ ...toolBtn, opacity: histIdx >= history.length - 1 ? 0.3 : 1 }}><Redo2 size={15} /></button>

        {/* Zoom */}
        <div style={{ display: "flex", alignItems: "center", gap: 4,
          background: BG, border: `1px solid ${BD}`, borderRadius: 8, padding: "0 6px" }}>
          <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} style={toolBtn}><ZoomOut size={14} /></button>
          <span style={{ fontSize: 11, color: TX, width: 40, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} style={toolBtn}><ZoomIn size={14} /></button>
        </div>

        <div style={{ width: 1, height: 28, background: BD }} />

        {/* Export */}
        <button onClick={handleExport} title="Export template as file" style={{
          ...toolBtn, background: "rgba(34,211,238,0.1)", border: `1px solid rgba(34,211,238,0.25)`,
          color: "#67e8f9", padding: "7px 12px", gap: 5, fontSize: 11, fontWeight: 700,
        }}>
          <Download size={13} /> Export
        </button>

        {/* Import */}
        <button onClick={() => importRef.current?.click()} title="Import template from file" style={{
          ...toolBtn, background: "rgba(251,191,36,0.1)", border: `1px solid rgba(251,191,36,0.25)`,
          color: "#fcd34d", padding: "7px 12px", gap: 5, fontSize: 11, fontWeight: 700,
        }}>
          <FolderOpen size={13} /> Import
        </button>

        <div style={{ width: 1, height: 28, background: BD }} />

        {/* Save */}
        <button onClick={handleSave} disabled={saving} style={{
          ...toolBtn, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)",
          color: "#86efac", padding: "7px 14px", gap: 6, fontWeight: 700, fontSize: 12,
        }}>
          <Save size={13} /> {saving ? "..." : "Save"}
        </button>

        {isAdmin && (
          <button onClick={handlePublish} disabled={publishing} style={{
            ...toolBtn,
            background: `linear-gradient(135deg, ${AC}, #8b5cf6)`,
            color: "#fff", border: "none", padding: "7px 14px", gap: 6, fontWeight: 700, fontSize: 12,
            boxShadow: "0 3px 14px rgba(99,102,241,0.4)",
          }}>
            <Upload size={13} /> {publishing ? "..." : "Publish"}
          </button>
        )}
      </div>

      {/* ════ MAIN AREA ══════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ═══ LEFT PANEL ══════════════════════════════════════════════════ */}
        <div style={{
          width: 218, flexShrink: 0, borderLeft: `1px solid ${BD}`,
          background: "rgba(8,8,18,0.96)", display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: `1px solid ${BD}`, flexShrink: 0 }}>
            {(["elements", "layers"] as const).map(t => (
              <button key={t} onClick={() => setLeftTab(t)} style={{
                flex: 1, padding: "11px 0", fontSize: 11, fontWeight: 700,
                cursor: "pointer", fontFamily: "'Cairo', sans-serif",
                background: leftTab === t ? "rgba(99,102,241,0.12)" : "transparent",
                color: leftTab === t ? "#fff" : MT,
                border: "none", borderBottom: leftTab === t ? `2px solid ${AC}` : "2px solid transparent",
              }}>
                {t === "elements" ? "🎨 Elements" : <><Layers size={12} style={{ display: "inline", marginLeft: 4 }} />Layers</>}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "12px 10px" }}>
            {leftTab === "elements" && (
              <div>
                {/* ── Media section ── */}
                <SectionTitle>Media</SectionTitle>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 16 }}>
                  <ElBtn icon={<Image size={15} />} label="Image" onClick={() => fileRef.current?.click()} />
                  <ElBtn icon="🖼️" label="Logo" onClick={() => logoRef.current?.click()} />
                </div>

                {/* ── Text section ── */}
                <SectionTitle>Texts</SectionTitle>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 16 }}>
                  <ElBtn icon={<Type size={15} />} label="Headline"
                    onClick={() => addEl("text", { content: "News headline", fontSize: 22, fontWeight: "700", w: 460, h: 90 })} />
                  <ElBtn icon={<Type size={13} />} label="Regular text"
                    onClick={() => addEl("text", { content: "Text here", fontSize: 14, fontWeight: "400", w: 260, h: 50 })} />
                  <ElBtn icon="🏷️" label="Label"
                    onClick={() => addEl("text", { content: "Label", fontSize: 12, color: "rgba(255,255,255,0.6)", w: 220, h: 28 })} />
                  <ElBtn icon="🔡" label="Badge"
                    onClick={() => addEl("badge", { content: "Breaking", bgColor: "#dc2626" })} />
                </div>

                {/* ── Shapes section ── */}
                <SectionTitle>Shapes</SectionTitle>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 16 }}>
                  <ElBtn icon={<Square size={14} />} label="Rectangle" onClick={() => addEl("rect")} />
                  <ElBtn icon={<Circle size={14} />} label="Circle"   onClick={() => addEl("circle", { w: 80, h: 80 })} />
                  <ElBtn icon={<Minus size={14} />}  label="Line"      onClick={() => addEl("line", { w: 400, h: 10 })} />
                  <ElBtn icon="📸" label="Photo Frame" onClick={() => addEl("photo", { w: 240, h: 160 })} />
                </div>

                {/* ── Background section ── */}
                <SectionTitle>Ready Backgrounds</SectionTitle>
                {/* Upload custom bg image */}
                <label style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  padding: "9px", borderRadius: 10, cursor: "pointer", marginBottom: 10,
                  border: `1px dashed ${BD2}`, color: MT, fontSize: 11,
                  fontFamily: "'Cairo', sans-serif", background: BG,
                }}>
                  <Image size={13} /> Upload Custom Background
                  <input type="file" accept="image/*" style={{ display: "none" }}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const r = new FileReader();
                      r.onload = ev => upd("bg", { src: ev.target?.result as string, gradient: undefined });
                      r.readAsDataURL(file);
                      e.target.value = "";
                    }} />
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {/* Clear image button (only when bg has src) */}
                  {els.find(e => e.id === "bg")?.src && (
                    <button onClick={() => upd("bg", { src: undefined })}
                      style={{ width: "100%", padding: "5px", borderRadius: 8, cursor: "pointer",
                        background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                        color: "#f87171", fontSize: 10, fontFamily: "'Cairo', sans-serif",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                      <Trash2 size={10} /> Remove Custom Image
                    </button>
                  )}
                  {[
                    { gradient: "linear-gradient(170deg,#0d1b3e,#0f2557)", fill: "#0f2557" },
                    { gradient: "linear-gradient(135deg,#991b1b,#7f1d1d)", fill: "#7f1d1d" },
                    { gradient: "linear-gradient(135deg,#065f46,#064e3b)", fill: "#064e3b" },
                    { gradient: "linear-gradient(135deg,#4c1d95,#3b0764)", fill: "#3b0764" },
                    { gradient: "linear-gradient(135deg,#92400e,#78350f)", fill: "#78350f" },
                    { gradient: "linear-gradient(135deg,#0f172a,#1e293b)", fill: "#0f172a" },
                    { gradient: "linear-gradient(135deg,#030712,#0f0a1e)", fill: "#030712" },
                    { fill: "#ffffff", gradient: undefined },
                  ].map((p, i) => (
                    <button key={i} onClick={() => {
                      const bg = els.find(e => e.id === "bg");
                      if (bg) upd("bg", { fill: p.fill, gradient: p.gradient ?? null as any, src: undefined });
                    }} style={{
                      width: 34, height: 34, borderRadius: 8, cursor: "pointer",
                      background: p.gradient || p.fill, border: `2px solid ${BD}`,
                      flexShrink: 0,
                    }} />
                  ))}
                </div>

                {/* ── Social Media ── */}
                <SectionTitle>Social Media</SectionTitle>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                  {SOCIALS.map(p => (
                    <ElBtn key={p.id} icon={<span style={{ fontSize: 13 }}>{p.glyph}</span>}
                      label={p.label.split(" ")[0]}
                      onClick={() => addEl("social", { platform: p.id, fill: p.bg, w: 44, h: 44 })} />
                  ))}
                </div>
              </div>
            )}

            {/* ── LAYERS TAB ─────────────────────────────────────────────── */}
            {leftTab === "layers" && (
              <div>
                {[...els].sort((a, b) => b.zIndex - a.zIndex).map(el => (
                  <div key={el.id}
                    onClick={() => setSelId(el.id === selId ? null : el.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "7px 8px", borderRadius: 8, marginBottom: 4, cursor: "pointer",
                      background: el.id === selId ? "rgba(99,102,241,0.15)" : "transparent",
                      border: el.id === selId ? `1px solid rgba(99,102,241,0.3)` : "1px solid transparent",
                    }}>
                    <span style={{ fontSize: 13 }}>{layerIcon(el.type)}</span>
                    <span style={{ fontSize: 11, color: TX, flex: 1, overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {el.content || el.type === "bg" ? (el.content || "Background") : (el.platform || el.type)}
                    </span>
                    <button onClick={e => { e.stopPropagation(); upd(el.id, { hidden: !el.hidden }); }}
                      style={{ ...iconBtn, opacity: el.hidden ? 0.4 : 1 }}>
                      {el.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                    <button onClick={e => { e.stopPropagation(); upd(el.id, { locked: !el.locked }); }}
                      style={{ ...iconBtn, opacity: el.locked ? 1 : 0.4 }}>
                      {el.locked ? <Lock size={12} /> : <Unlock size={12} />}
                    </button>
                    {el.id !== "bg" && (
                      <button onClick={e => { e.stopPropagation(); delEl(el.id); }}
                        style={{ ...iconBtn, color: "#f87171", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ═══ CANVAS AREA ══════════════════════════════════════════════════ */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "auto", position: "relative",
          background: "radial-gradient(ellipse at 50% 50%,#1a1a2e 0%,#080810 100%)",
          backgroundImage: "radial-gradient(ellipse at 50% 50%,#1a1a2e 0%,#080810 100%), repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,0.04) 39px,rgba(255,255,255,0.04) 40px), repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(255,255,255,0.04) 39px,rgba(255,255,255,0.04) 40px)",
        }}
          onClick={() => { setSelId(null); setEditingId(null); }}
        >
          {/* Canvas shadow wrapper */}
          <div style={{
            transformOrigin: "center center",
            transform: `scale(${zoom})`,
            flexShrink: 0,
            boxShadow: "0 30px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06)",
            borderRadius: 2,
          }}>
            <div ref={canvasRef} style={{
              width: canvasSize.w, height: canvasSize.h, position: "relative", overflow: "hidden",
              userSelect: "none", cursor: "default",
            }}>
              {sortedEls.map(el => {
                if (el.hidden) return null;
                const isSelected = el.id === selId;
                const isBg = el.type === "bg";
                return (
                  <div
                    key={el.id}
                    onMouseDown={e => { if (editingId === el.id) return; onElMouseDown(e, el); }}
                    onClick={e => e.stopPropagation()}
                    onDoubleClick={e => {
                      e.stopPropagation();
                      if ((el.type === "text" || el.type === "badge") && !el.locked) {
                        setSelId(el.id);
                        setEditingId(el.id);
                      }
                    }}
                    style={{
                      position: "absolute",
                      left: el.x, top: el.y, width: el.w, height: el.h,
                      zIndex: el.zIndex,
                      cursor: editingId === el.id ? "text" : el.locked ? "default" : "move",
                      outline: isSelected ? `2px solid ${AC}` : "none",
                      outlineOffset: 1,
                      boxSizing: "border-box",
                    }}>
                    {/* Inline text editor */}
                    {editingId === el.id && (el.type === "text" || el.type === "badge") ? (
                      <textarea
                        autoFocus
                        value={el.content ?? ""}
                        onChange={e => upd(el.id, { content: e.target.value }, false)}
                        onBlur={() => setEditingId(null)}
                        onKeyDown={e => { if (e.key === "Escape") setEditingId(null); e.stopPropagation(); }}
                        onClick={e => e.stopPropagation()}
                        onMouseDown={e => e.stopPropagation()}
                        style={{
                          position: "absolute", inset: 0, width: "100%", height: "100%",
                          background: "rgba(99,102,241,0.08)",
                          border: "none", outline: "none", resize: "none",
                          color: el.color ?? "#fff",
                          fontSize: el.fontSize ?? 16,
                          fontFamily: `'${el.fontFamily ?? "Cairo"}', sans-serif`,
                          fontWeight: el.fontWeight ?? "400",
                          textAlign: el.textAlign ?? "right",
                          lineHeight: el.lineHeight ?? 1.5,
                          direction: "ltr", wordBreak: "break-word",
                          padding: el.type === "badge" ? "0 8px" : 0,
                          boxSizing: "border-box", cursor: "text",
                          caretColor: el.color ?? "#fff",
                          zIndex: 10000,
                        }}
                      />
                    ) : (
                      <ElContent el={el} scale={1} />
                    )}

                    {/* Selection handles */}
                    {isSelected && !isBg && (
                      <>
                        {HANDLES.map(h => (
                          <div key={h.id}
                            onMouseDown={e => onResizeDown(e, el, h.id)}
                            style={{
                              position: "absolute",
                              width: 22, height: 22,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              cursor: h.cursor, zIndex: 9999,
                              ...(h.top !== undefined ? { top: h.top } : {}),
                              ...(h.bottom !== undefined ? { bottom: h.bottom } : {}),
                              ...(h.left !== undefined ? { left: h.left } : {}),
                              ...(h.right !== undefined ? { right: h.right } : {}),
                              ...(h.transform ? { transform: h.transform } : {}),
                            }}>
                            <div style={{
                              width: 10, height: 10,
                              background: "#fff", border: `2px solid ${AC}`,
                              borderRadius: 2, pointerEvents: "none",
                              boxShadow: "0 0 0 1px rgba(0,0,0,0.3)",
                            }} />
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                );
              })}

              {/* Watermark overlay */}
              {watermark && (
                <div style={{
                  position: "absolute",
                  ...(watermarkPos === "bottom-right" ? { bottom: 10, right: 12 } :
                      watermarkPos === "bottom-left"  ? { bottom: 10, left: 12 } :
                      watermarkPos === "bottom-center"? { bottom: 10, left: "50%", transform: "translateX(-50%)" } :
                                                        { top: 10, right: 12 }),
                  zIndex: 9999,
                  pointerEvents: "none",
                  fontSize: watermarkFontSize,
                  color: watermarkColor,
                  fontFamily: watermarkFontFamily === "Cairo" ? "'Cairo', sans-serif"
                            : watermarkFontFamily === "Tajawal" ? "'Tajawal', sans-serif"
                            : watermarkFontFamily === "Amiri" ? "'Amiri', serif"
                            : `'${watermarkFontFamily}', sans-serif`,
                  fontWeight: watermarkBold ? 700 : 500,
                  fontStyle: watermarkItalic ? "italic" : "normal",
                  letterSpacing: "0.03em",
                  textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                  background: watermarkBg ? "rgba(0,0,0,0.4)" : "transparent",
                  padding: watermarkBg ? "2px 6px" : "0",
                  borderRadius: watermarkBg ? 4 : 0,
                  userSelect: "none",
                  whiteSpace: "nowrap",
                }}>
                  {watermark}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ RIGHT PANEL ══════════════════════════════════════════════════ */}
        <div style={{
          width: 268, flexShrink: 0, borderRight: `1px solid ${BD}`,
          background: "rgba(8,8,18,0.96)", overflowY: "auto",
          padding: "14px 12px",
        }}>
          {!sel ? (
            <div style={{ textAlign: "center", marginTop: 40, color: MT, fontSize: 12, marginBottom: 24 }}>
              <Grid size={28} style={{ display: "block", margin: "0 auto 10px", opacity: 0.25 }} />
              Click an element to edit it
            </div>
          ) : (
            <>
              {/* Type label */}
              <div style={{ fontSize: 10, color: AC2, fontWeight: 700, letterSpacing: "0.08em",
                textTransform: "uppercase", marginBottom: 14 }}>
                {typeLabel(sel.type)}
              </div>

              {/* ── Position & Size ── */}
              <PR label="Position & Size">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <div><label style={{ fontSize: 9, color: MT, display: "block", marginBottom: 3 }}>X</label>
                    {numIn(sel.x, v => upd(sel.id, { x: v }))}</div>
                  <div><label style={{ fontSize: 9, color: MT, display: "block", marginBottom: 3 }}>Y</label>
                    {numIn(sel.y, v => upd(sel.id, { y: v }))}</div>
                  <div><label style={{ fontSize: 9, color: MT, display: "block", marginBottom: 3 }}>Width</label>
                    {numIn(sel.w, v => upd(sel.id, { w: Math.max(10, v) }), 10)}</div>
                  <div><label style={{ fontSize: 9, color: MT, display: "block", marginBottom: 3 }}>Height</label>
                    {numIn(sel.h, v => upd(sel.id, { h: Math.max(5, v) }), 5)}</div>
                </div>
              </PR>

              {/* ── Opacity ── */}
              <PR label={`Opacity — ${Math.round((sel.opacity ?? 1) * 100)}%`}>
                <input type="range" min={0} max={1} step={0.01} value={sel.opacity ?? 1}
                  onChange={e => upd(sel.id, { opacity: Number(e.target.value) })}
                  style={{ width: "100%", accentColor: AC }} />
              </PR>

              {/* ── TEXT properties ── */}
              {(sel.type === "text" || sel.type === "badge") && (
                <>
                  <PR label="Text">
                    <textarea value={sel.content ?? ""} onChange={e => upd(sel.id, { content: e.target.value })}
                      rows={3} style={{
                        width: "100%", background: BG, border: `1px solid ${BD}`, borderRadius: 7,
                        color: TX, padding: "7px 10px", fontSize: 12, outline: "none",
                        fontFamily: `'${sel.fontFamily || "Cairo"}', sans-serif`,
                        resize: "vertical", boxSizing: "border-box", lineHeight: 1.6,
                      }} />
                  </PR>
                  <PR label="Font">
                    <select value={sel.fontFamily ?? "Cairo"} onChange={e => upd(sel.id, { fontFamily: e.target.value })}
                      style={{ ...selStyle }}>
                      {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </PR>
                  <PR label="Size & Weight">
                    <div style={{ display: "flex", gap: 6 }}>
                      {numIn(sel.fontSize ?? 16, v => upd(sel.id, { fontSize: Math.max(6, v) }), 6, 200)}
                      <select value={sel.fontWeight ?? "400"} onChange={e => upd(sel.id, { fontWeight: e.target.value })}
                        style={{ ...selStyle, flex: 1 }}>
                        {["300","400","500","600","700","800","900"].map(w =>
                          <option key={w} value={w}>{w}</option>)}
                      </select>
                    </div>
                  </PR>
                  <PR label="Text Color">
                    <div style={{ display: "flex", gap: 6 }}>
                      <input type="color" value={toHex(sel.color ?? "#fff")}
                        onChange={e => upd(sel.id, { color: e.target.value })}
                        style={{ width: 38, height: 32, border: "none", borderRadius: 6, cursor: "pointer", padding: 2, flexShrink: 0 }} />
                      {txtIn(sel.color ?? "#ffffff", v => upd(sel.id, { color: v }), "#ffffff")}
                    </div>
                  </PR>
                  {sel.type === "text" && (
                    <>
                      <PR label="Alignment">
                        <div style={{ display: "flex", gap: 5 }}>
                          {(["right","center","left"] as const).map(a => (
                            <button key={a} onClick={() => upd(sel.id, { textAlign: a })} style={{
                              ...iconBtn, flex: 1,
                              background: sel.textAlign === a ? "rgba(99,102,241,0.2)" : BG,
                              border: `1px solid ${sel.textAlign === a ? AC : BD}`,
                              height: 32,
                            }}>
                              {a === "right" ? <AlignRight size={13} /> : a === "center" ? <AlignCenter size={13} /> : <AlignLeft size={13} />}
                            </button>
                          ))}
                        </div>
                      </PR>
                      <PR label={`Line Height — ${sel.lineHeight ?? 1.5}`}>
                        <input type="range" min={1} max={3} step={0.05} value={sel.lineHeight ?? 1.5}
                          onChange={e => upd(sel.id, { lineHeight: Number(e.target.value) })}
                          style={{ width: "100%", accentColor: AC }} />
                      </PR>
                    </>
                  )}
                </>
              )}

              {/* ── BADGE properties ── */}
              {sel.type === "badge" && (
                <>
                  <PR label="Background Color">
                    <div style={{ display: "flex", gap: 6 }}>
                      <input type="color" value={toHex(sel.bgColor ?? "#dc2626")}
                        onChange={e => upd(sel.id, { bgColor: e.target.value })}
                        style={{ width: 38, height: 32, border: "none", borderRadius: 6, cursor: "pointer", padding: 2, flexShrink: 0 }} />
                      {txtIn(sel.bgColor ?? "#dc2626", v => upd(sel.id, { bgColor: v }))}
                    </div>
                  </PR>
                  <PR label="Border Radius">
                    <input type="range" min={0} max={999} value={sel.borderRadius ?? 999}
                      onChange={e => upd(sel.id, { borderRadius: Number(e.target.value) })}
                      style={{ width: "100%", accentColor: AC }} />
                  </PR>
                </>
              )}

              {/* ── BG / RECT properties ── */}
              {(sel.type === "bg" || sel.type === "rect") && (
                <>
                  {/* Image background (bg only) */}
                  {sel.type === "bg" && (
                    <PR label="Custom Background Image">
                      <label style={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                        padding: "9px", borderRadius: 9, cursor: "pointer",
                        border: `1px dashed ${BD2}`, color: sel.src ? AC2 : MT, fontSize: 11,
                        fontFamily: "'Cairo', sans-serif", background: BG,
                      }}>
                        <Image size={13} />
                        {sel.src ? "Change Image" : "Upload Background"}
                        <input type="file" accept="image/*" style={{ display: "none" }}
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const r = new FileReader();
                            r.onload = ev => upd(sel.id, { src: ev.target?.result as string, gradient: undefined });
                            r.readAsDataURL(file);
                            e.target.value = "";
                          }} />
                      </label>
                      {sel.src && (
                        <button onClick={() => upd(sel.id, { src: undefined })}
                          style={{ ...iconBtn, marginTop: 6, width: "100%", background: "rgba(239,68,68,0.1)",
                            border: "1px solid rgba(239,68,68,0.3)", color: "#f87171",
                            justifyContent: "center", padding: "7px", borderRadius: 8, fontSize: 11, gap: 5 }}>
                          <Trash2 size={11} /> Remove Image
                        </button>
                      )}
                    </PR>
                  )}

                  {/* For bg with image: always show transparent toggle (needed so photo shows through) */}
                  {/* For rect: show color always. For bg without image: show color/gradient */}
                  {(sel.type === "bg" || sel.type === "rect" || !sel.src) && (
                    <>
                      <PR label={sel.type === "bg" && sel.src ? "Transparent Areas / Underlay Color" : "Background Color"}>
                        <>
                          {/* Transparent toggle — always visible for bg */}
                          <button
                            onClick={() => upd(sel.id, {
                              fill: sel.fill === "transparent" ? "#0f2557" : "transparent",
                              gradient: undefined,
                            })}
                            style={{
                              width: "100%", marginBottom: 8, padding: "7px 10px",
                              borderRadius: 8, border: `1px solid ${sel.fill === "transparent" ? "#a78bfa" : BD}`,
                              background: sel.fill === "transparent"
                                ? "rgba(167,139,250,0.15)"
                                : BG,
                              color: sel.fill === "transparent" ? "#a78bfa" : MT,
                              fontSize: 11, fontWeight: 700, cursor: "pointer",
                              fontFamily: "'Inter', sans-serif",
                              display: "flex", alignItems: "center", gap: 8,
                            }}
                          >
                            <span style={{
                              display: "inline-block", width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                              background: "repeating-conic-gradient(#888 0% 25%, #ddd 0% 50%)",
                              backgroundSize: "8px 8px",
                              border: `1px solid ${BD}`,
                            }} />
                            {sel.fill === "transparent" ? "✓ Transparent (layers below show through)" : "Transparent / No Background"}
                          </button>

                          {/* Hint when image is uploaded with transparent mode */}
                          {sel.type === "bg" && sel.src && sel.fill === "transparent" && (
                            <div style={{
                              fontSize: 10, color: "#a78bfa", padding: "6px 8px", borderRadius: 7,
                              background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)",
                              marginBottom: 6, lineHeight: 1.5,
                            }}>
                              ✅ Transparent areas of your uploaded design will show layers below (e.g. the Photo layer)
                            </div>
                          )}

                          {/* Hint when image is uploaded WITHOUT transparent mode */}
                          {sel.type === "bg" && sel.src && sel.fill !== "transparent" && (
                            <div style={{
                              fontSize: 10, color: "#fb923c", padding: "6px 8px", borderRadius: 7,
                              background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.2)",
                              marginBottom: 6, lineHeight: 1.5,
                            }}>
                              ⚠️ Enable Transparent above so transparent areas of your design show layers below
                            </div>
                          )}

                          {/* Only show color picker when NOT transparent */}
                          {sel.fill !== "transparent" && (
                            <div style={{ display: "flex", gap: 6 }}>
                              <input type="color" value={toHex(sel.fill ?? "#0f2557")}
                                onChange={e => upd(sel.id, { fill: e.target.value, gradient: undefined })}
                                style={{ width: 38, height: 32, border: "none", borderRadius: 6, cursor: "pointer", padding: 2, flexShrink: 0 }} />
                              {txtIn(sel.fill ?? "#0f2557", v => upd(sel.id, { fill: v }))}
                            </div>
                          )}
                        </>
                      </PR>
                      {/* Only show gradient when no image and not transparent */}
                      {!sel.src && sel.fill !== "transparent" && (
                        <PR label="Gradient (CSS)">
                          <textarea value={sel.gradient ?? ""} rows={2}
                            placeholder="linear-gradient(135deg, #991b1b, #7f1d1d)"
                            onChange={e => upd(sel.id, { gradient: e.target.value || undefined })}
                            style={{ width: "100%", background: BG, border: `1px solid ${BD}`, borderRadius: 7,
                              color: TX, padding: "6px 8px", fontSize: 10, outline: "none", fontFamily: "monospace",
                              resize: "vertical", boxSizing: "border-box" }} />
                        </PR>
                      )}
                    </>
                  )}

                  {sel.type === "rect" && (
                    <PR label="Border Radius">
                      <input type="range" min={0} max={200} value={sel.borderRadius ?? 0}
                        onChange={e => upd(sel.id, { borderRadius: Number(e.target.value) })}
                        style={{ width: "100%", accentColor: AC }} />
                    </PR>
                  )}
                </>
              )}

              {/* ── LINE properties ── */}
              {sel.type === "line" && (
                <>
                  <PR label="Color">
                    <div style={{ display: "flex", gap: 6 }}>
                      <input type="color" value={toHex(sel.fill ?? "#ffffff")}
                        onChange={e => upd(sel.id, { fill: e.target.value })}
                        style={{ width: 38, height: 32, border: "none", borderRadius: 6, cursor: "pointer", padding: 2, flexShrink: 0 }} />
                      {txtIn(sel.fill ?? "#ffffff", v => upd(sel.id, { fill: v }))}
                    </div>
                  </PR>
                  <PR label="Thickness">
                    <input type="range" min={1} max={20} value={sel.borderWidth ?? 2}
                      onChange={e => upd(sel.id, { borderWidth: Number(e.target.value) })}
                      style={{ width: "100%", accentColor: AC }} />
                  </PR>
                </>
              )}

              {/* ── CIRCLE properties ── */}
              {sel.type === "circle" && (
                <PR label="Color">
                  <div style={{ display: "flex", gap: 6 }}>
                    <input type="color" value={toHex(sel.fill ?? "#6366f1")}
                      onChange={e => upd(sel.id, { fill: e.target.value })}
                      style={{ width: 38, height: 32, border: "none", borderRadius: 6, cursor: "pointer", padding: 2, flexShrink: 0 }} />
                    {txtIn(sel.fill ?? "#6366f1", v => upd(sel.id, { fill: v }))}
                  </div>
                </PR>
              )}

              {/* ── SOCIAL properties ── */}
              {sel.type === "social" && (
                <>
                  <PR label="Platform">
                    <select value={sel.platform ?? "instagram"}
                      onChange={e => {
                        const p = SOCIALS.find(s => s.id === e.target.value)!;
                        upd(sel.id, { platform: e.target.value, fill: p.bg });
                      }} style={{ ...selStyle }}>
                      {SOCIALS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  </PR>
                  <PR label="Border Radius">
                    <input type="range" min={0} max={200} value={sel.borderRadius ?? 10}
                      onChange={e => upd(sel.id, { borderRadius: Number(e.target.value) })}
                      style={{ width: "100%", accentColor: AC }} />
                  </PR>
                  <PR label="Icon Size">
                    <input type="range" min={10} max={60} value={sel.fontSize ?? 20}
                      onChange={e => upd(sel.id, { fontSize: Number(e.target.value) })}
                      style={{ width: "100%", accentColor: AC }} />
                  </PR>
                </>
              )}

              {/* ── LOGO / PHOTO image upload ── */}
              {(sel.type === "logo" || sel.type === "photo") && (
                <PR label="Upload Image">
                  <label style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    padding: "9px", borderRadius: 9, cursor: "pointer",
                    border: `1px dashed ${BD2}`, color: MT, fontSize: 12,
                    fontFamily: "'Cairo', sans-serif",
                  }}>
                    <Image size={14} />
                    {sel.src ? "Change Image" : "Choose Image"}
                    <input type="file" accept="image/*" style={{ display: "none" }}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const r = new FileReader();
                        r.onload = ev => upd(sel.id, { src: ev.target?.result as string });
                        r.readAsDataURL(file);
                        e.target.value = "";
                      }} />
                  </label>
                  {sel.src && (
                    <button onClick={() => upd(sel.id, { src: undefined })}
                      style={{ ...iconBtn, marginTop: 6, width: "100%", background: "rgba(239,68,68,0.1)",
                        border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", justifyContent: "center",
                        padding: "6px", borderRadius: 8, fontSize: 11, gap: 5 }}>
                      <Trash2 size={11} /> Remove Image
                    </button>
                  )}
                </PR>
              )}

              {/* ── Z-Index & Layer actions ── */}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${BD}` }}>
                <div style={{ fontSize: 10, color: MT, fontWeight: 700, letterSpacing: "0.06em",
                  textTransform: "uppercase", marginBottom: 10 }}>Layer Actions</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  <button onClick={() => bringForward(sel.id)} title="Bring Forward" style={{ ...iconBtn, flex: 1, height: 30, justifyContent: "center" }}>
                    <ChevronUp size={14} /><span style={{ fontSize: 10 }}>Forward</span>
                  </button>
                  <button onClick={() => sendBack(sel.id)} title="Send Back" style={{ ...iconBtn, flex: 1, height: 30, justifyContent: "center" }}>
                    <ChevronDown size={14} /><span style={{ fontSize: 10 }}>Backward</span>
                  </button>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => dupEl(sel.id)} title="Duplicate" style={{ ...iconBtn, flex: 1, height: 30, justifyContent: "center", background: "rgba(99,102,241,0.1)", border: `1px solid rgba(99,102,241,0.3)`, color: "#a5b4fc" }}>
                    <Copy size={13} /><span style={{ fontSize: 10 }}>Duplicate</span>
                  </button>
                  <button onClick={() => upd(sel.id, { locked: !sel.locked })} title="Lock" style={{ ...iconBtn, flex: 1, height: 30, justifyContent: "center" }}>
                    {sel.locked ? <Lock size={13} /> : <Unlock size={13} />}
                    <span style={{ fontSize: 10 }}>{sel.locked ? "Locked" : "Lock"}</span>
                  </button>
                  {sel.id !== "bg" && (
                    <button onClick={() => delEl(sel.id)} title="Delete" style={{ ...iconBtn, flex: 1, height: 30, justifyContent: "center", background: "rgba(239,68,68,0.1)", border: `1px solid rgba(239,68,68,0.3)`, color: "#f87171" }}>
                      <Trash2 size={13} /><span style={{ fontSize: 10 }}>Delete</span>
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ─── Watermark — ALWAYS VISIBLE ─── */}
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${BD}` }}>
            <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 800, letterSpacing: "0.07em",
              textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              🔏 Watermark
            </div>

            {/* Text */}
            <label style={{ fontSize: 9, color: MT, display: "block", marginBottom: 3, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Text</label>
            <input
              value={watermark}
              onChange={e => setWatermark(e.target.value)}
              placeholder="e.g. © BERRECHI NEWS"
              style={{ width: "100%", background: BG, border: `1px solid ${BD}`, borderRadius: 7,
                color: TX, padding: "7px 10px", fontSize: 12, outline: "none",
                fontFamily: "'Cairo', sans-serif", boxSizing: "border-box" as const, marginBottom: 10 }}
            />

            {/* Position */}
            <label style={{ fontSize: 9, color: MT, display: "block", marginBottom: 3, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Position</label>
            <select value={watermarkPos} onChange={e => setWatermarkPos(e.target.value as typeof watermarkPos)}
              style={{ ...selStyle, marginBottom: 10 }}>
              <option value="bottom-right">Bottom Right</option>
              <option value="bottom-left">Bottom Left</option>
              <option value="bottom-center">Bottom Center</option>
              <option value="top-right">Top Right</option>
            </select>

            {/* Font Family */}
            <label style={{ fontSize: 9, color: MT, display: "block", marginBottom: 3, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Font</label>
            <select value={watermarkFontFamily} onChange={e => setWatermarkFontFamily(e.target.value)}
              style={{ ...selStyle, marginBottom: 10 }}>
              {["Inter","Cairo","Tajawal","Amiri","Noto Kufi Arabic","IBM Plex Arabic","Reem Kufi",
                "Roboto","Open Sans","Montserrat","Poppins","Raleway","Oswald","Merriweather","Lato"].map(f =>
                <option key={f} value={f}>{f}</option>
              )}
            </select>

            {/* Font Size + Color */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 9, color: MT, display: "block", marginBottom: 3, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Size</label>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="range" min={8} max={48} value={watermarkFontSize}
                    onChange={e => setWatermarkFontSize(Number(e.target.value))}
                    style={{ flex: 1, accentColor: AC }} />
                  <span style={{ fontSize: 11, color: TX, minWidth: 24 }}>{watermarkFontSize}</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 9, color: MT, display: "block", marginBottom: 3, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Color</label>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <input type="color" value={watermarkColor.startsWith("rgba") ? "#ffffff" : watermarkColor}
                    onChange={e => setWatermarkColor(e.target.value)}
                    style={{ width: 28, height: 28, padding: 2, border: "none", borderRadius: 5, background: "transparent", cursor: "pointer" }} />
                  <input type="text" value={watermarkColor} onChange={e => setWatermarkColor(e.target.value)}
                    style={{ flex: 1, background: BG, border: `1px solid ${BD}`, borderRadius: 5,
                      color: TX, padding: "4px 6px", fontSize: 10, outline: "none", fontFamily: "monospace" }} />
                </div>
              </div>
            </div>

            {/* Style toggles */}
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              <button onClick={() => setWatermarkBold(v => !v)}
                style={{ ...iconBtn, flex: 1, justifyContent: "center", fontWeight: 700, fontSize: 12,
                  background: watermarkBold ? "rgba(99,102,241,0.2)" : BG,
                  border: `1px solid ${watermarkBold ? "rgba(99,102,241,0.5)" : BD}`,
                  color: watermarkBold ? "#a5b4fc" : TX }}>
                B
              </button>
              <button onClick={() => setWatermarkItalic(v => !v)}
                style={{ ...iconBtn, flex: 1, justifyContent: "center", fontStyle: "italic", fontSize: 12,
                  background: watermarkItalic ? "rgba(99,102,241,0.2)" : BG,
                  border: `1px solid ${watermarkItalic ? "rgba(99,102,241,0.5)" : BD}`,
                  color: watermarkItalic ? "#a5b4fc" : TX }}>
                I
              </button>
              <button onClick={() => setWatermarkBg(v => !v)}
                style={{ ...iconBtn, flex: 1, justifyContent: "center", fontSize: 10,
                  background: watermarkBg ? "rgba(245,158,11,0.2)" : BG,
                  border: `1px solid ${watermarkBg ? "rgba(245,158,11,0.5)" : BD}`,
                  color: watermarkBg ? "#f59e0b" : TX }}>
                BG
              </button>
            </div>

            {watermark && (
              <button onClick={() => { setWatermark(""); }} style={{ ...iconBtn, width: "100%",
                justifyContent: "center", fontSize: 11, color: "#f87171", background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)", padding: "6px", borderRadius: 7, gap: 5 }}>
                <Trash2 size={11} /> Remove Watermark
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Hidden file inputs */}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={e => handleImageUpload(e, false)} />
      <input ref={logoRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={e => handleImageUpload(e, true)} />
      <input ref={importRef} type="file" accept=".ncgt,.json" style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ""; }} />
    </div>
  );
}

// ─── Shared button styles ─────────────────────────────────────────────────────
const toolBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 5,
  background: BG, border: `1px solid ${BD}`,
  color: TX, padding: "6px 10px", borderRadius: 8,
  fontSize: 12, cursor: "pointer", fontFamily: "'Cairo', sans-serif",
  transition: "all 0.1s",
};

const iconBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 4,
  background: BG, border: `1px solid ${BD}`,
  color: TX, padding: "5px 7px", borderRadius: 6,
  fontSize: 11, cursor: "pointer", fontFamily: "'Cairo', sans-serif",
};

const selStyle: React.CSSProperties = {
  width: "100%", background: BG, border: `1px solid ${BD}`, borderRadius: 7,
  color: TX, padding: "7px 8px", fontSize: 12, outline: "none",
  fontFamily: "'Cairo', sans-serif", appearance: "none" as const,
};

// ─── Small helpers ────────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 9, color: MT, fontWeight: 800, letterSpacing: "0.08em",
      textTransform: "uppercase", marginBottom: 7, marginTop: 4 }}>
      {children}
    </div>
  );
}

function ElBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
      padding: "10px 4px", borderRadius: 10, cursor: "pointer",
      background: BG, border: `1px solid ${BD}`,
      color: TX, fontSize: 10, fontWeight: 700, fontFamily: "'Cairo', sans-serif",
      transition: "all 0.12s",
    }}
      onMouseEnter={e => { e.currentTarget.style.background = "rgba(99,102,241,0.1)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.3)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = BG; e.currentTarget.style.borderColor = BD; }}>
      <span style={{ opacity: 0.85 }}>{icon}</span>
      {label}
    </button>
  );
}

function layerIcon(type: EType) {
  const m: Record<EType, string> = { bg: "🎨", photo: "📸", text: "✏️", rect: "⬛", circle: "⚫", line: "➖", badge: "🏷️", social: "🌐", logo: "🖼️" };
  return m[type] || "📄";
}

function typeLabel(type: EType) {
  const m: Record<EType, string> = { bg: "Background", photo: "Photo", text: "Text", rect: "Rectangle", circle: "Circle", line: "Line", badge: "Badge", social: "Social Media", logo: "Logo" };
  return m[type] || type;
}

function toHex(color: string): string {
  if (color === "transparent") return "#000000";
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  if (/^#[0-9a-fA-F]{3}$/.test(color)) return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  return "#000000";
}
