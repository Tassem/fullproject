import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useListTemplates, getListTemplatesQueryKey, useDeleteTemplate,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Check, Trash2, Play, Zap, Eye, Shield, Pencil } from "lucide-react";

// ── Design tokens ───────────────────────────────────────────────────────────
const ACCENT  = "#6366f1";
const ACCENT3 = "#8b5cf6";
const ACCENT2 = "#22d3ee";
const SURFACE = "rgba(255,255,255,0.04)";
const BORDER  = "rgba(255,255,255,0.08)";
const BORDER2 = "rgba(255,255,255,0.14)";
const TEXT    = "rgba(255,255,255,0.88)";
const MUTED   = "rgba(255,255,255,0.42)";
const GREEN   = "#22c55e";
const RED     = "#ef4444";

// ── Built-in template definitions ──────────────────────────────────────────
interface BuiltinTemplate {
  id: string;
  name: string;
  category: string;
  bannerColor: string;
  bannerGradient?: string;
  textColor: string;
  labelColor: string;
  photoHeight: number;  // % of card height
  isLight?: boolean;
  accentColor?: string;
  bannerBorderRadius?: string;
  badge?: string;
  badgeColor?: string;
  canvasLayout?: { width: number; height: number; elements: CE[] } | null;
}

const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: "classic-blue",
    name: "Classic",
    category: "News",
    bannerColor: "#0f2557",
    textColor: "#ffffff",
    labelColor: "rgba(255,255,255,0.8)",
    photoHeight: 62,
  },
  {
    id: "breaking-red",
    name: "Breaking",
    category: "Breaking",
    bannerColor: "#7f1d1d",
    bannerGradient: "linear-gradient(135deg, #991b1b, #7f1d1d)",
    textColor: "#ffffff",
    labelColor: "rgba(255,255,255,0.8)",
    photoHeight: 60,
    badge: "Breaking",
    badgeColor: "#ef4444",
  },
  {
    id: "modern-black",
    name: "Modern",
    category: "Modern",
    bannerColor: "#0a0a0a",
    bannerGradient: "linear-gradient(180deg, rgba(0,0,0,0) 0%, #000000 100%)",
    textColor: "#f5f5f5",
    labelColor: "rgba(255,255,255,0.7)",
    photoHeight: 70,
  },
  {
    id: "emerald",
    name: "Emerald",
    category: "Sports",
    bannerColor: "#064e3b",
    bannerGradient: "linear-gradient(135deg, #065f46, #064e3b)",
    textColor: "#ffffff",
    labelColor: "rgba(255,255,255,0.85)",
    photoHeight: 62,
  },
  {
    id: "royal-purple",
    name: "Royal",
    category: "Premium",
    bannerColor: "#3b0764",
    bannerGradient: "linear-gradient(135deg, #4c1d95, #3b0764)",
    textColor: "#ffffff",
    labelColor: "rgba(255,255,255,0.85)",
    photoHeight: 60,
  },
  {
    id: "gold",
    name: "Gold",
    category: "Featured",
    bannerColor: "#78350f",
    bannerGradient: "linear-gradient(135deg, #92400e, #78350f)",
    textColor: "#fef3c7",
    labelColor: "rgba(255,255,255,0.85)",
    photoHeight: 62,
    badge: "★",
    badgeColor: "#f59e0b",
  },
  {
    id: "midnight",
    name: "Midnight",
    category: "News",
    bannerColor: "#1e1b4b",
    bannerGradient: "linear-gradient(135deg, #312e81, #1e1b4b)",
    textColor: "#e0e7ff",
    labelColor: "rgba(255,255,255,0.75)",
    photoHeight: 60,
  },
  {
    id: "slate-fade",
    name: "Gradient",
    category: "Modern",
    bannerColor: "transparent",
    bannerGradient: "linear-gradient(to top, rgba(2,6,23,0.95) 0%, rgba(2,6,23,0.6) 60%, transparent 100%)",
    textColor: "#ffffff",
    labelColor: "rgba(255,255,255,0.85)",
    photoHeight: 100,
  },
  {
    id: "white-quote",
    name: "White",
    category: "Quote",
    bannerColor: "#ffffff",
    textColor: "#111111",
    labelColor: "rgba(0,0,0,0.45)",
    photoHeight: 58,
    isLight: true,
    accentColor: "#dc2626",
  },
  {
    id: "purple-wave",
    name: "Wave",
    category: "Social",
    bannerColor: "#7c3aed",
    bannerGradient: "linear-gradient(135deg, #8b5cf6 0%, #5b21b6 100%)",
    textColor: "#ffffff",
    labelColor: "rgba(255,255,255,0.8)",
    photoHeight: 60,
    bannerBorderRadius: "14px 14px 0 0",
  },
  {
    id: "crimson",
    name: "Crimson",
    category: "Breaking",
    bannerColor: "#dc2626",
    textColor: "#ffffff",
    labelColor: "rgba(255,255,255,0.9)",
    photoHeight: 62,
  },
  {
    id: "neon-dark",
    name: "Neon",
    category: "Modern",
    bannerColor: "#030712",
    bannerGradient: "linear-gradient(135deg, #030712 0%, #0f0a1e 100%)",
    textColor: "#22d3ee",
    labelColor: "rgba(34,211,238,0.6)",
    photoHeight: 65,
    badge: "New",
    badgeColor: "#6366f1",
  },

  // ── Creative Canvas Templates ─────────────────────────────────────────────
  {
    id: "split-panel",
    name: "Split",
    category: "Editorial",
    bannerColor: "#0f2557",
    textColor: "#ffffff",
    labelColor: "rgba(255,255,255,0.7)",
    photoHeight: 60,
    canvasLayout: {
      width: 540, height: 540,
      elements: [
        { id: "sp-bg",   type: "bg",    x: 0,   y: 0,   w: 540, h: 540, fill: "#0a0a1a", zIndex: 0 },
        { id: "sp-ph",   type: "photo", x: 0,   y: 0,   w: 260, h: 540, zIndex: 1 },
        { id: "sp-rp",   type: "rect",  x: 260, y: 0,   w: 280, h: 540, fill: "#0f2557", zIndex: 2 },
        { id: "sp-div",  type: "rect",  x: 257, y: 0,   w: 5,   h: 540, fill: "#3b82f6", zIndex: 3 },
        { id: "sp-lbl",  type: "text",  x: 278, y: 36,  w: 240, h: 24,  content: "Breaking News", color: "#93c5fd", fontSize: 11, fontFamily: "Inter", fontWeight: "700", textAlign: "left", zIndex: 4 },
        { id: "sp-hdl",  type: "text",  x: 278, y: 68,  w: 240, h: 260, content: "Breaking: Arab Summit Convenes to Discuss Latest Regional Developments", color: "#ffffff", fontSize: 20, fontFamily: "Inter", fontWeight: "700", textAlign: "left", zIndex: 4 },
        { id: "sp-cat",  type: "text",  x: 278, y: 490, w: 240, h: 26,  content: "POLITICS", color: "rgba(255,255,255,0.35)", fontSize: 10, fontFamily: "Inter", fontWeight: "700", textAlign: "left", zIndex: 4 },
        { id: "sp-line", type: "rect",  x: 278, y: 480, w: 40,  h: 2,   fill: "#3b82f6", zIndex: 4 },
      ],
    },
  },
  {
    id: "magazine",
    name: "Magazine",
    category: "Editorial",
    bannerColor: "#ffffff",
    textColor: "#111111",
    labelColor: "rgba(0,0,0,0.5)",
    photoHeight: 54,
    isLight: true,
    canvasLayout: {
      width: 540, height: 540,
      elements: [
        { id: "mg-bg",   type: "bg",    x: 0,  y: 0,   w: 540, h: 540, fill: "#f8f8f8", zIndex: 0 },
        { id: "mg-ph",   type: "photo", x: 0,  y: 0,   w: 540, h: 292, zIndex: 1 },
        { id: "mg-wp",   type: "rect",  x: 0,  y: 285, w: 540, h: 255, fill: "#ffffff", zIndex: 2 },
        { id: "mg-acc",  type: "rect",  x: 24, y: 298, w: 56,  h: 4,   fill: "#dc2626", zIndex: 3 },
        { id: "mg-lbl",  type: "text",  x: 24, y: 308, w: 300, h: 24,  content: "WORLD NEWS", color: "#dc2626", fontSize: 11, fontFamily: "Inter", fontWeight: "800", textAlign: "left", zIndex: 3 },
        { id: "mg-hdl",  type: "text",  x: 24, y: 336, w: 492, h: 160, content: "Breaking: Arab Summit Convenes to Discuss Latest Regional Developments", color: "#111111", fontSize: 24, fontFamily: "Inter", fontWeight: "800", textAlign: "left", zIndex: 3 },
        { id: "mg-src",  type: "text",  x: 24, y: 510, w: 250, h: 22,  content: "Al Jazeera • Breaking", color: "rgba(0,0,0,0.4)", fontSize: 11, fontFamily: "Inter", fontWeight: "400", textAlign: "left", zIndex: 3 },
      ],
    },
  },
  {
    id: "cinematic",
    name: "Cinematic",
    category: "Modern",
    bannerColor: "#000000",
    textColor: "#ffffff",
    labelColor: "rgba(255,255,255,0.6)",
    photoHeight: 66,
    canvasLayout: {
      width: 540, height: 540,
      elements: [
        { id: "cn-bg",   type: "bg",    x: 0,  y: 0,   w: 540, h: 540, fill: "#000000", zIndex: 0 },
        { id: "cn-ph",   type: "photo", x: 0,  y: 86,  w: 540, h: 366, zIndex: 1 },
        { id: "cn-tb",   type: "rect",  x: 0,  y: 0,   w: 540, h: 86,  fill: "#000000", zIndex: 2 },
        { id: "cn-bb",   type: "rect",  x: 0,  y: 452, w: 540, h: 88,  fill: "#000000", zIndex: 2 },
        { id: "cn-rl",   type: "rect",  x: 0,  y: 452, w: 540, h: 2,   fill: "#dc2626", zIndex: 3 },
        { id: "cn-lgo",  type: "text",  x: 24, y: 26,  w: 200, h: 34,  content: "⬛ NEWS", color: "#ffffff", fontSize: 18, fontFamily: "Inter", fontWeight: "900", textAlign: "left", zIndex: 3 },
        { id: "cn-hdl",  type: "text",  x: 16, y: 462, w: 508, h: 68,  content: "Arab Summit Convenes to Discuss Latest Regional Developments", color: "#ffffff", fontSize: 16, fontFamily: "Inter", fontWeight: "700", textAlign: "left", zIndex: 3 },
      ],
    },
  },
  {
    id: "bold-overlay",
    name: "Bold",
    category: "Breaking",
    bannerColor: "#000000",
    textColor: "#ffffff",
    labelColor: "rgba(255,255,255,0.7)",
    photoHeight: 100,
    canvasLayout: {
      width: 540, height: 540,
      elements: [
        { id: "bo-bg",   type: "bg",    x: 0,  y: 0,   w: 540, h: 540, fill: "#000000", zIndex: 0 },
        { id: "bo-ph",   type: "photo", x: 0,  y: 0,   w: 540, h: 540, zIndex: 1 },
        { id: "bo-ov",   type: "rect",  x: 0,  y: 190, w: 540, h: 350, gradient: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.92) 100%)", fill: "transparent", zIndex: 2 },
        { id: "bo-acc",  type: "rect",  x: 0,  y: 368, w: 5,   h: 150, fill: "#f59e0b", zIndex: 3 },
        { id: "bo-lbl",  type: "text",  x: 20, y: 374, w: 400, h: 28,  content: "BREAKING NEWS", color: "#f59e0b", fontSize: 12, fontFamily: "Inter", fontWeight: "800", textAlign: "left", zIndex: 3 },
        { id: "bo-hdl",  type: "text",  x: 20, y: 408, w: 500, h: 120, content: "Arab Summit Convenes to Discuss Latest Regional Developments", color: "#ffffff", fontSize: 26, fontFamily: "Inter", fontWeight: "900", textAlign: "left", zIndex: 3 },
      ],
    },
  },
  {
    id: "frame-card",
    name: "Frame",
    category: "Premium",
    bannerColor: "#1e293b",
    textColor: "#e2e8f0",
    labelColor: "rgba(148,163,184,0.8)",
    photoHeight: 55,
    canvasLayout: {
      width: 540, height: 540,
      elements: [
        { id: "fr-bg",   type: "bg",    x: 0,   y: 0,   w: 540, h: 540, fill: "#0f172a", zIndex: 0 },
        { id: "fr-frm",  type: "rect",  x: 16,  y: 16,  w: 508, h: 508, fill: "#1e293b", borderWidth: 1, borderColor: "#334155", borderRadius: 12, zIndex: 1 },
        { id: "fr-ph",   type: "photo", x: 30,  y: 30,  w: 480, h: 278, zIndex: 2 },
        { id: "fr-rl",   type: "rect",  x: 30,  y: 318, w: 480, h: 2,   fill: "#3b82f6", zIndex: 3 },
        { id: "fr-lbl",  type: "text",  x: 30,  y: 325, w: 200, h: 24,  content: "WORLD NEWS", color: "#64748b", fontSize: 10, fontFamily: "Inter", fontWeight: "700", textAlign: "left", zIndex: 3 },
        { id: "fr-hdl",  type: "text",  x: 30,  y: 348, w: 480, h: 148, content: "Breaking: Arab Summit Convenes to Discuss Latest Regional Developments", color: "#e2e8f0", fontSize: 20, fontFamily: "Inter", fontWeight: "700", textAlign: "left", zIndex: 3 },
        { id: "fr-bdg",  type: "badge", x: 376, y: 44,  w: 90,  h: 28,  content: "LIVE", bgColor: "#ef4444", color: "#ffffff", fontSize: 12, fontFamily: "Inter", fontWeight: "800", borderRadius: 6, zIndex: 4 },
      ],
    },
  },
  {
    id: "duotone",
    name: "Duotone",
    category: "Social",
    bannerColor: "#4f46e5",
    bannerGradient: "linear-gradient(135deg, #7c3aed, #4f46e5)",
    textColor: "#ffffff",
    labelColor: "rgba(196,181,253,0.9)",
    photoHeight: 54,
    canvasLayout: {
      width: 540, height: 540,
      elements: [
        { id: "dt-bg",   type: "bg",    x: 0,  y: 0,   w: 540, h: 540, fill: "#7c3aed", zIndex: 0 },
        { id: "dt-ph",   type: "photo", x: 0,  y: 0,   w: 540, h: 294, zIndex: 1 },
        { id: "dt-bk",   type: "rect",  x: 0,  y: 280, w: 540, h: 260, fill: "#4f46e5", zIndex: 2 },
        { id: "dt-hl",   type: "rect",  x: 0,  y: 280, w: 540, h: 5,   fill: "#c4b5fd", zIndex: 3 },
        { id: "dt-lbl",  type: "text",  x: 24, y: 296, w: 300, h: 24,  content: "Featured Story", color: "#c4b5fd", fontSize: 11, fontFamily: "Inter", fontWeight: "700", textAlign: "left", zIndex: 3 },
        { id: "dt-hdl",  type: "text",  x: 24, y: 326, w: 492, h: 180, content: "Breaking: Arab Summit Convenes to Discuss Latest Regional Developments", color: "#ffffff", fontSize: 22, fontFamily: "Inter", fontWeight: "700", textAlign: "left", zIndex: 3 },
        { id: "dt-bdg",  type: "badge", x: 432, y: 14,  w: 88,  h: 28,  content: "★ Featured", bgColor: "#f59e0b", color: "#ffffff", fontSize: 11, fontFamily: "Inter", fontWeight: "800", borderRadius: 999, zIndex: 4 },
      ],
    },
  },
];

const CATEGORIES = ["All", "News", "Breaking", "Modern", "Sports", "Premium", "Featured", "Editorial", "Quote", "Social"];

const useAuthenticatedImage = (url: string) => {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    if (!url) return;
    if (!url.startsWith("/api/photo")) {
      setSrc(url);
      return;
    }
    const token = localStorage.getItem("pro_token");
    let isMounted = true;
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => res.ok ? res.blob() : Promise.reject())
    .then(blob => {
      if (isMounted) setSrc(URL.createObjectURL(blob));
    })
    .catch(() => {
      if (isMounted) setSrc("");
    });
    return () => {
      isMounted = false;
    };
  }, [url]);
  return src;
};

function MiniBuilderElement({ el, scale, s }: { el: CE; scale: number; s: React.CSSProperties }) {
  const authSrc = useAuthenticatedImage(el.src || "");

  if (el.type === "bg") return (
    <div key={el.id} style={{
      ...s, backgroundColor: el.fill || "#000",
      backgroundImage: authSrc ? `url(${authSrc})` : (el.gradient ?? undefined),
      backgroundSize: "cover", backgroundPosition: "center",
    }} />
  );

  if (el.type === "logo") return (
    <div key={el.id} style={{
      ...s, background: "rgba(255,255,255,0.08)", borderRadius: 4 * scale,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 4 * scale,
    }}>
      {authSrc ? (
        <img src={authSrc} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
      ) : (
        <span style={{ fontSize: 9 * scale, color: "rgba(255,255,255,0.4)", fontFamily: "Cairo" }}>LOGO</span>
      )}
    </div>
  );

  return null;
}

// ── Mini Builder Preview (renders CE[] canvas) ─────────────────────────────
type CE = { id: string; type: string; x: number; y: number; w: number; h: number;
  zIndex?: number; hidden?: boolean; fill?: string; gradient?: string; src?: string;
  color?: string; fontSize?: number; fontFamily?: string; fontWeight?: string;
  textAlign?: string; content?: string; bgColor?: string; borderRadius?: number;
  opacity?: number; borderWidth?: number; borderColor?: string; };

function MiniBuilderPreview({ elements, scale = 1 }: { elements: CE[]; scale?: number }) {
  const CW = 540, CH = 540;
  const W = CW * scale, H = CH * scale;
  const sorted = [...elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  return (
    <div style={{
      width: W, height: H, position: "relative", overflow: "hidden",
      borderRadius: 8, flexShrink: 0,
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    }}>
      {sorted.map(el => {
        if (el.hidden) return null;
        const s: React.CSSProperties = {
          position: "absolute",
          left: el.x * scale, top: el.y * scale,
          width: el.w * scale, height: el.h * scale,
          opacity: el.opacity ?? 1, zIndex: el.zIndex ?? 0,
          boxSizing: "border-box",
        };
        if (el.type === "bg" || el.type === "logo") {
          return <MiniBuilderElement key={el.id} el={el} scale={scale} s={s} />;
        }
        if (el.type === "photo") return (
          <div key={el.id} style={{
            ...s, border: `${scale}px dashed rgba(255,255,255,0.15)`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 16 * scale, opacity: 0.2 }}>📸</span>
          </div>
        );
        if (el.type === "text") return (
          <div key={el.id} style={{
            ...s, overflow: "hidden",
            color: el.color ?? "#fff",
            fontSize: (el.fontSize ?? 16) * scale,
            fontFamily: `'${el.fontFamily ?? "Cairo"}', sans-serif`,
            fontWeight: el.fontWeight ?? "400",
            textAlign: (el.textAlign as React.CSSProperties["textAlign"]) ?? "right",
            direction: "ltr", lineHeight: 1.5,
          }}>{el.content || ""}</div>
        );
        if (el.type === "badge") return (
          <div key={el.id} style={{
            ...s, background: el.bgColor || "#dc2626",
            borderRadius: (el.borderRadius ?? 999) * scale,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{
              color: el.color ?? "#fff",
              fontSize: (el.fontSize ?? 13) * scale,
              fontFamily: `'${el.fontFamily ?? "Cairo"}', sans-serif`,
              fontWeight: el.fontWeight ?? "800",
            }}>{el.content || ""}</span>
          </div>
        );
        if (el.type === "rect") return (
          <div key={el.id} style={{
            ...s, background: el.gradient || el.fill || "#6366f1",
            borderRadius: (el.borderRadius ?? 0) * scale,
            border: el.borderWidth ? `${el.borderWidth * scale}px solid ${el.borderColor ?? "#fff"}` : "none",
          }} />
        );
        if (el.type === "circle") return (
          <div key={el.id} style={{
            ...s, borderRadius: "50%", background: el.fill || "#6366f1",
            border: el.borderWidth ? `${el.borderWidth * scale}px solid ${el.borderColor ?? "#fff"}` : "none",
          }} />
        );
        if (el.type === "social") return (
          <div key={el.id} style={{
            ...s, background: el.fill || "rgba(255,255,255,0.08)",
            borderRadius: (el.borderRadius ?? 8) * scale,
          }} />
        );
        return null;
      })}
    </div>
  );
}

// ── Mini Card Preview ──────────────────────────────────────────────────────
const SAMPLE_HEADLINE = "Breaking: Arab Summit Convenes to Discuss Latest Regional Developments";
const SAMPLE_LABEL    = "Archival photo";

function MiniCardPreview({ tmpl, scale = 1 }: { tmpl: BuiltinTemplate; scale?: number }) {
  const W = 260;
  const H = 260;
  const photoH = (tmpl.photoHeight / 100) * H;
  const bannerH = H - photoH;
  const isFade = tmpl.id === "slate-fade";

  return (
    <div style={{
      width: W * scale, height: H * scale,
      borderRadius: 10 * scale,
      overflow: "hidden",
      position: "relative",
      flexShrink: 0,
      fontFamily: "'Inter', sans-serif",
      direction: "ltr",
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    }}>
      {/* Photo area */}
      <div style={{
        position: "absolute",
        top: 0, left: 0, right: 0,
        height: isFade ? H * scale : photoH * scale,
        background: "linear-gradient(135deg, #1e293b 0%, #334155 50%, #1e293b 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        {/* Subtle placeholder pattern */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 2px, transparent 2px, transparent 16px)",
        }} />
        <span style={{ fontSize: 28 * scale, opacity: 0.2 }}>📰</span>
      </div>

      {/* Banner / text area */}
      {isFade ? (
        <div style={{
          position: "absolute", inset: 0,
          background: tmpl.bannerGradient,
          display: "flex", flexDirection: "column", justifyContent: "flex-end",
          padding: 12 * scale,
        }}>
          <div style={{ fontSize: 9 * scale, color: tmpl.labelColor, marginBottom: 4 * scale, opacity: 0.8 }}>{SAMPLE_LABEL}</div>
          <div style={{ fontSize: 10.5 * scale, color: tmpl.textColor, fontWeight: 700, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{SAMPLE_HEADLINE}</div>
        </div>
      ) : (
        <div style={{
          position: "absolute",
          bottom: 0, left: 0, right: 0,
          height: bannerH * scale,
          background: tmpl.bannerGradient ?? tmpl.bannerColor,
          borderRadius: tmpl.bannerBorderRadius ? `${parseFloat(tmpl.bannerBorderRadius) * scale}px ${parseFloat(tmpl.bannerBorderRadius) * scale}px 0 0` : undefined,
          display: "flex", flexDirection: "column", justifyContent: "center",
          padding: `${10 * scale}px ${12 * scale}px`,
        }}>
          {tmpl.isLight && tmpl.accentColor && (
            <div style={{ width: 28 * scale, height: 2.5 * scale, background: tmpl.accentColor, marginBottom: 5 * scale, borderRadius: 2 }} />
          )}
          {tmpl.id === "white-quote" && (
            <div style={{ fontSize: 22 * scale, color: tmpl.accentColor, lineHeight: 1, marginBottom: 3 * scale, fontFamily: "serif" }}>"</div>
          )}
          <div style={{ fontSize: 9 * scale, color: tmpl.labelColor, marginBottom: 3 * scale }}>{SAMPLE_LABEL}</div>
          <div style={{ fontSize: 10 * scale, color: tmpl.textColor, fontWeight: 700, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{SAMPLE_HEADLINE}</div>
        </div>
      )}

      {/* Badge */}
      {tmpl.badge && (
        <div style={{
          position: "absolute", top: 8 * scale, right: 8 * scale,
          background: tmpl.badgeColor ?? "#6366f1",
          color: "#fff", fontSize: 7.5 * scale, fontWeight: 800,
          padding: `${2 * scale}px ${6 * scale}px`, borderRadius: 999,
          letterSpacing: "0.04em",
        }}>{tmpl.badge}</div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function Templates() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab]     = useState<"gallery" | "api">("gallery");
  const [activeCategory, setCategory] = useState("All");
  const [hoveredId, setHoveredId]     = useState<string | null>(null);
  const [copiedId, setCopiedId]       = useState<number | null>(null);
  const [previewTmpl, setPreviewTmpl] = useState<BuiltinTemplate | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);

  // System templates from DB (added by admin)
  const [dbTemplates, setDbTemplates] = useState<BuiltinTemplate[]>([]);
  useEffect(() => {
    fetch("/api/system-templates")
      .then(r => r.ok ? r.json() : [])
      .then((rows: any[]) => {
        setDbTemplates(rows.map(r => ({
          id: `sys-${r.id}`,
          name: r.name,
          category: r.category,
          bannerColor: r.bannerColor,
          bannerGradient: r.bannerGradient ?? undefined,
          textColor: r.textColor,
          labelColor: r.labelColor,
          photoHeight: r.photoHeight,
          font: r.font,
          isLight: r.isLight,
          accentColor: r.accentColor ?? undefined,
          bannerBorderRadius: r.bannerBorderRadius ?? undefined,
          badge: r.badge ? `${r.badge} ✦` : "Custom",
          badgeColor: r.badgeColor ?? "#6366f1",
          canvasLayout: r.canvasLayout ?? null,
        })));
      })
      .catch(() => {});
  }, []);

  const { data: apiTemplates, isLoading } = useListTemplates({
    query: { queryKey: getListTemplatesQueryKey(), enabled: !!localStorage.getItem("pro_token") },
  });
  const { mutate: deleteTemplate, isPending: isDeleting } = useDeleteTemplate();

  const handleCopyId = (id: number) => {
    navigator.clipboard.writeText(String(id)).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({ title: "Copied", description: `Template ID: ${id}` });
    });
  };

  const handleDelete = (id: number, name: string) => {
    setConfirmDelete({ id, name });
  };

  const confirmDoDelete = () => {
    if (!confirmDelete) return;
    const { id } = confirmDelete;
    setConfirmDelete(null);
    deleteTemplate({ id }, {
      onSuccess: () => {
        toast({ title: "✅ Deleted", description: "Template removed successfully" });
        queryClient.invalidateQueries({ queryKey: getListTemplatesQueryKey() });
      },
      onError: (err: any) => toast({ title: "Delete failed", description: String(err?.message || err), variant: "destructive" }),
    });
  };

  const allTemplates = [...dbTemplates, ...BUILTIN_TEMPLATES];
  const filteredTemplates = activeCategory === "All"
    ? allTemplates
    : allTemplates.filter(t => t.category === activeCategory);

  // ── Convert classic BuiltinTemplate → canvas elements for template-builder ──
  const classicToCanvasLayout = (tmpl: BuiltinTemplate) => {
    const CW = 540, CH = 540;
    const photoH = Math.round((tmpl.photoHeight / 100) * CH);
    const bannerH = CH - photoH;
    const isFullPhoto = tmpl.photoHeight >= 99;
    const uid = () => Math.random().toString(36).slice(2, 9);

    const els: CE[] = [];

    // 1. Background base
    els.push({ id: uid(), type: "bg", x: 0, y: 0, w: CW, h: CH, fill: "#111827", zIndex: 0 });

    // 2. Photo slot (top area)
    els.push({ id: uid(), type: "photo", x: 0, y: 0, w: CW, h: photoH, zIndex: 1 });

    if (isFullPhoto) {
      // Gradient overlay at bottom for full-photo templates
      els.push({
        id: uid(), type: "rect", x: 0, y: Math.round(CH * 0.45), w: CW, h: Math.round(CH * 0.55),
        gradient: tmpl.bannerGradient ?? `linear-gradient(to top, ${tmpl.bannerColor} 0%, transparent 100%)`,
        fill: tmpl.bannerColor, borderRadius: 0, zIndex: 2,
      });
      // Label text
      els.push({
        id: uid(), type: "text", x: 16, y: Math.round(CH * 0.52), w: CW - 32, h: 26,
        content: "Archival photo", fontSize: 13, color: tmpl.labelColor ?? "rgba(255,255,255,0.7)",
        fontFamily: "Inter", fontWeight: "400", textAlign: "left", zIndex: 3,
      });
      // Headline text
      els.push({
        id: uid(), type: "text", x: 16, y: Math.round(CH * 0.59), w: CW - 32, h: 120,
        content: "Breaking: Arab Summit Convenes to Discuss Latest Regional Developments",
        fontSize: 22, color: tmpl.textColor, fontFamily: "Inter", fontWeight: "700", textAlign: "left", zIndex: 3,
      });
    } else {
      // Banner block (bottom)
      els.push({
        id: uid(), type: "rect", x: 0, y: photoH, w: CW, h: bannerH,
        gradient: tmpl.bannerGradient ?? undefined,
        fill: tmpl.bannerColor, borderRadius: 0, zIndex: 2,
      });
      // Label text
      els.push({
        id: uid(), type: "text", x: 16, y: photoH + 10, w: CW - 32, h: 24,
        content: "Archival photo", fontSize: 13, color: tmpl.labelColor ?? "rgba(255,255,255,0.7)",
        fontFamily: "Inter", fontWeight: "400", textAlign: "left", zIndex: 3,
      });
      // Headline text
      els.push({
        id: uid(), type: "text", x: 16, y: photoH + 36, w: CW - 32, h: 120,
        content: "Breaking: Arab Summit Convenes to Discuss Latest Regional Developments",
        fontSize: 22, color: tmpl.textColor, fontFamily: "Inter", fontWeight: "700", textAlign: "left", zIndex: 3,
      });
      // Badge (if applicable)
      if (tmpl.badge) {
        els.push({
          id: uid(), type: "badge", x: CW - 110, y: 14, w: 96, h: 30,
          content: tmpl.badge, bgColor: tmpl.badgeColor ?? "#ef4444",
          color: "#ffffff", fontSize: 13, fontFamily: "Inter", fontWeight: "800",
          borderRadius: 999, zIndex: 4,
        });
      }
    }

    return { width: CW, height: CH, elements: els };
  };

  const useTemplate = (id: string, forEdit = false) => {
    const allTmpls = [...BUILTIN_TEMPLATES, ...dbTemplates];
    const tmpl = allTmpls.find(t => t.id === id);
    if (tmpl?.canvasLayout?.elements) {
      // Canvas-based template → open in Template Builder
      localStorage.setItem("ncg_use_template", JSON.stringify(tmpl.canvasLayout));
      if (tmpl.name) localStorage.setItem("ncg_use_template_name", tmpl.name);
      if (tmpl.category) localStorage.setItem("ncg_use_template_cat", tmpl.category);
      if (forEdit && tmpl.userId != null && typeof tmpl.id === "number") {
        localStorage.setItem("ncg_edit_user_template_id", String(tmpl.id));
      } else {
        localStorage.removeItem("ncg_edit_user_template_id");
      }
      setLocation("/template-builder");
    } else if (tmpl) {
      // Classic builtin template → convert to canvas layout and open in Template Builder
      localStorage.removeItem("ncg_edit_user_template_id");
      localStorage.removeItem("ncg_classic_preset");
      const layout = classicToCanvasLayout(tmpl as BuiltinTemplate);
      localStorage.setItem("ncg_use_template", JSON.stringify(layout));
      if (tmpl.name) localStorage.setItem("ncg_use_template_name", tmpl.name);
      if (tmpl.category) localStorage.setItem("ncg_use_template_cat", tmpl.category);
      setLocation("/template-builder");
    } else {
      setLocation("/template-builder");
    }
  };

  // ── Shared tab button style ──
  const tabStyle = (t: typeof activeTab): React.CSSProperties => ({
    padding: "9px 22px", borderRadius: 10,
    cursor: "pointer", fontFamily: "'Inter', sans-serif",
    fontSize: 14, fontWeight: activeTab === t ? 700 : 400,
    background: activeTab === t
      ? `linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.14))`
      : "transparent",
    color: activeTab === t ? "#fff" : MUTED,
    border: activeTab === t ? `1px solid rgba(99,102,241,0.35)` : `1px solid transparent`,
    transition: "all 0.15s",
  });

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", direction: "ltr" }}>

      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: "#fff", margin: 0, marginBottom: 6, letterSpacing: "-0.5px" }}>
            Template Gallery
          </h1>
          <p style={{ color: MUTED, fontSize: 14, margin: 0 }}>
            Choose a ready-made template or design your own
          </p>
        </div>
        <a href="/pro/template-builder" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          color: "#fff", padding: "10px 20px", borderRadius: 12,
          fontSize: 13, fontWeight: 700, textDecoration: "none",
          boxShadow: "0 4px 18px rgba(99,102,241,0.35)",
          fontFamily: "'Inter', sans-serif",
          transition: "opacity 0.15s",
        }}
          onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.opacity = "0.85"}
          onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.opacity = "1"}
        >
          ✏️ Build Custom Template
        </a>
      </div>

      {/* Tab switcher */}
      <div style={{
        display: "flex", gap: 6, marginBottom: 28,
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${BORDER}`,
        padding: 5, borderRadius: 14, width: "fit-content",
      }}>
        <button style={tabStyle("gallery")} onClick={() => setActiveTab("gallery")}>
          🎨 Template Gallery ({BUILTIN_TEMPLATES.length})
        </button>
        <button style={tabStyle("api")} onClick={() => setActiveTab("api")}>
          ⚡ API Templates ({apiTemplates?.length ?? 0})
        </button>
      </div>

      {/* ═══ GALLERY TAB ═══════════════════════════════════════════════════ */}
      {activeTab === "gallery" && (
        <div>
          {/* Category filter */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)} style={{
                padding: "6px 16px", borderRadius: 999,
                border: activeCategory === cat ? `1px solid rgba(99,102,241,0.5)` : `1px solid ${BORDER}`,
                background: activeCategory === cat ? "rgba(99,102,241,0.15)" : SURFACE,
                color: activeCategory === cat ? "#fff" : MUTED,
                fontSize: 13, fontWeight: activeCategory === cat ? 700 : 400,
                cursor: "pointer", fontFamily: "'Inter', sans-serif",
                transition: "all 0.15s",
              }}
                onMouseEnter={e => { if (activeCategory !== cat) e.currentTarget.style.borderColor = BORDER2; }}
                onMouseLeave={e => { if (activeCategory !== cat) e.currentTarget.style.borderColor = BORDER; }}
              >{cat}</button>
            ))}
          </div>

          {/* Template grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 20,
          }}>
            {filteredTemplates.map(tmpl => (
              <div key={tmpl.id}
                style={{
                  background: SURFACE,
                  border: hoveredId === tmpl.id ? `1px solid rgba(99,102,241,0.4)` : `1px solid ${BORDER}`,
                  borderRadius: 16, overflow: "hidden",
                  transition: "all 0.2s",
                  transform: hoveredId === tmpl.id ? "translateY(-3px)" : "translateY(0)",
                  boxShadow: hoveredId === tmpl.id ? "0 16px 40px rgba(0,0,0,0.35)" : "none",
                  cursor: "default",
                }}
                onMouseEnter={() => setHoveredId(tmpl.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* Preview area */}
                <div style={{
                  padding: tmpl.canvasLayout?.elements ? "10px 10px 0" : 16,
                  background: "rgba(255,255,255,0.02)",
                  display: "flex", justifyContent: "center",
                  position: "relative", overflow: "hidden",
                }}>
                  {/* Subtle glow behind card */}
                  <div style={{
                    position: "absolute", inset: 0,
                    background: `radial-gradient(ellipse at center, ${tmpl.bannerColor === "transparent" ? "rgba(2,6,23,0.3)" : tmpl.bannerColor + "22"} 0%, transparent 70%)`,
                    pointerEvents: "none",
                  }} />
                  {tmpl.canvasLayout?.elements
                    ? <MiniBuilderPreview elements={tmpl.canvasLayout.elements} scale={0.46} />
                    : <MiniCardPreview tmpl={tmpl} scale={0.88} />
                  }

                  {/* Hover overlay with "Preview" */}
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "rgba(0,0,0,0.5)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    opacity: hoveredId === tmpl.id ? 1 : 0,
                    transition: "opacity 0.2s",
                    backdropFilter: "blur(2px)",
                  }}>
                    <button onClick={() => setPreviewTmpl(tmpl)} style={{
                      display: "flex", alignItems: "center", gap: 6,
                      background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)",
                      color: "#fff", padding: "8px 18px", borderRadius: 999,
                      fontSize: 13, fontWeight: 600, cursor: "pointer",
                      fontFamily: "'Inter', sans-serif", backdropFilter: "blur(8px)",
                    }}>
                      <Eye size={14} />
                      Full Preview
                    </button>
                  </div>
                </div>

                {/* Card footer */}
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>{tmpl.name}</div>
                      <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{tmpl.category}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: "50%",
                        background: tmpl.bannerGradient ?? tmpl.bannerColor,
                        border: "2px solid rgba(255,255,255,0.15)",
                        flexShrink: 0,
                      }} />
                      <div style={{
                        width: 18, height: 18, borderRadius: "50%",
                        background: tmpl.textColor,
                        border: "2px solid rgba(255,255,255,0.15)",
                        flexShrink: 0,
                      }} />
                    </div>
                  </div>

                  <button onClick={() => useTemplate(tmpl.id)} style={{
                    width: "100%",
                    background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT3})`,
                    color: "#fff", border: "none",
                    padding: "10px 14px", borderRadius: 10,
                    fontSize: 13, fontWeight: 700, cursor: "pointer",
                    fontFamily: "'Inter', sans-serif",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    boxShadow: "0 4px 16px rgba(99,102,241,0.3)",
                    transition: "all 0.15s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(99,102,241,0.45)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(99,102,241,0.3)"; }}
                  >
                    <Play size={13} fill="currentColor" />
                    Use Template
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Info banner */}
          <div style={{
            marginTop: 32, padding: "16px 20px",
            background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)",
            borderRadius: 12, display: "flex", alignItems: "flex-start", gap: 12,
          }}>
            <Zap size={18} color={ACCENT} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 4 }}>
                Want to save a custom template?
              </div>
              <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.7 }}>
                Go to <strong style={{ color: TEXT }}>Create Card</strong>, customize the design, then save it as an API template to use later in automation and n8n.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ API TEMPLATES TAB ════════════════════════════════════════════ */}
      {activeTab === "api" && (
        <div>
          {isLoading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ height: 220, background: SURFACE, borderRadius: 14, border: `1px solid ${BORDER}`, animation: "pulse 1.5s infinite" }} />
              ))}
            </div>
          ) : !apiTemplates || apiTemplates.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "64px 32px",
              background: SURFACE, border: `1px dashed ${BORDER2}`,
              borderRadius: 16,
            }}>
              <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>⚡</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 8 }}>No API Templates</div>
              <div style={{ fontSize: 13, color: MUTED, maxWidth: 360, margin: "0 auto", lineHeight: 1.7 }}>
                Go to <strong style={{ color: ACCENT2 }}>Create Card</strong>, customize the design, then save it as an API template for use in n8n or any automation.
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
              {apiTemplates.map(template => (
                <div key={template.id} style={{
                  background: SURFACE, border: `1px solid ${BORDER}`,
                  borderRadius: 14, overflow: "hidden",
                  transition: "all 0.2s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = BORDER2; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  {/* Template preview */}
                  {(() => {
                    const raw = (template as any).canvasLayout;
                    const elems: CE[] | null = Array.isArray(raw?.elements) ? raw.elements : null;
                    if (elems) return (
                      <div style={{ padding: "10px 10px 0", display: "flex", justifyContent: "center", overflow: "hidden", borderBottom: `1px solid ${BORDER}` }}>
                        <MiniBuilderPreview elements={elems} scale={0.42} />
                      </div>
                    );
                    return (
                      <div style={{
                        height: 80, display: "flex", alignItems: "center", justifyContent: "center",
                        background: (template as any).bannerGradient ?? template.bannerColor,
                        borderBottom: `1px solid ${BORDER}`,
                      }}>
                        <span style={{ color: template.textColor, fontSize: 11, fontWeight: 700, opacity: 0.7, fontFamily: "Cairo" }}>
                          {template.name}
                        </span>
                      </div>
                    );
                  })()}

                  <div style={{ padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>{template.name}</div>
                        <div style={{ fontSize: 11, color: MUTED, fontFamily: "monospace", marginTop: 3 }}>
                          {new Date(template.createdAt).toLocaleDateString("ar-MA")}
                        </div>
                      </div>
                      <span style={{
                        fontFamily: "monospace", fontSize: 11,
                        background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER2}`,
                        padding: "2px 8px", borderRadius: 6, color: MUTED,
                      }}>{template.aspectRatio}</span>
                    </div>
                    {/* Approval status badge */}
                    {(template as any).isPublic && (
                      <div style={{ marginBottom: 10 }}>
                        {(template as any).isApproved ? (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "rgba(34,197,94,0.12)", color: GREEN, border: "1px solid rgba(34,197,94,0.25)" }}>
                            ✅ Published in Gallery
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}>
                            ⏳ Awaiting Admin Approval
                          </span>
                        )}
                      </div>
                    )}

                    {/* Template ID */}
                    <div style={{
                      background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)",
                      borderRadius: 10, padding: "10px 14px",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      marginBottom: 14,
                    }}>
                      <div>
                        <div style={{ fontSize: 10, color: MUTED, marginBottom: 3 }}>Template ID</div>
                        <div style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 16, color: ACCENT2 }} dir="ltr">
                          {template.id}
                        </div>
                      </div>
                      <button onClick={() => handleCopyId(template.id)} style={{
                        background: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER2}`,
                        color: copiedId === template.id ? GREEN : MUTED,
                        padding: "6px 8px", borderRadius: 8, cursor: "pointer",
                        display: "flex", alignItems: "center",
                        transition: "all 0.15s",
                      }}>
                        {copiedId === template.id ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>

                    {/* Colors */}
                    <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                      {[
                        { label: "Banner", color: template.bannerColor },
                        { label: "Text", color: template.textColor },
                      ].map(c => (
                        <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 16, height: 16, borderRadius: 4, background: c.color, border: "1px solid rgba(255,255,255,0.15)" }} />
                          <span style={{ fontSize: 11, color: MUTED }}>{c.label}</span>
                        </div>
                      ))}
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ fontSize: 11, color: MUTED }}>Font: <span style={{ color: TEXT }}>{template.font}</span></div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 8 }}>
                      {(() => {
                        const cl = (template as any).canvasLayout;
                        const isCanvas = cl && Array.isArray(cl.elements);
                        return isCanvas ? (
                          <button onClick={() => {
                            localStorage.setItem("ncg_use_template", JSON.stringify(cl));
                            if (template.name) localStorage.setItem("ncg_use_template_name", template.name);
                            if (template.category) localStorage.setItem("ncg_use_template_cat", template.category);
                            localStorage.setItem("ncg_edit_user_template_id", String(template.id));
                            setLocation("/template-builder");
                          }} style={{
                            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                            background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)",
                            color: "#86efac", padding: "9px 12px", borderRadius: 9,
                            fontSize: 12, fontWeight: 700, cursor: "pointer",
                          }}>
                            <Pencil size={11} /> Edit
                          </button>
                        ) : (
                          <button onClick={() => { window.location.href = `/pro/generate?templateId=${template.id}`; }} style={{
                            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                            background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT3})`,
                            color: "#fff", border: "none",
                            padding: "9px 12px", borderRadius: 9,
                            fontSize: 12, fontWeight: 700, cursor: "pointer",
                            boxShadow: "0 3px 14px rgba(99,102,241,0.3)",
                          }}>
                            <Play size={11} fill="currentColor" /> Use
                          </button>
                        );
                      })()}
                      <button onClick={() => handleDelete(template.id, template.name)} disabled={isDeleting} style={{
                        background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                        color: "#ef4444", padding: "9px 12px", borderRadius: 9,
                        cursor: "pointer", display: "flex", alignItems: "center",
                      }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ LARGE PREVIEW MODAL ══════════════════════════════════════════ */}
      {previewTmpl && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 300,
            background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setPreviewTmpl(null)}
        >
          <div
            style={{
              background: "rgba(13,13,26,0.98)", border: `1px solid ${BORDER2}`,
              borderRadius: 20, padding: "28px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 24,
              maxWidth: 420, width: "100%",
              boxShadow: "0 40px 100px rgba(0,0,0,0.7)",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>{previewTmpl.name}</div>
                <div style={{ fontSize: 12, color: MUTED }}>{previewTmpl.category}</div>
              </div>
              <button onClick={() => setPreviewTmpl(null)} style={{
                background: SURFACE, border: `1px solid ${BORDER}`,
                color: MUTED, width: 32, height: 32, borderRadius: 8,
                cursor: "pointer", fontSize: 16, display: "flex",
                alignItems: "center", justifyContent: "center",
              }}>✕</button>
            </div>

            {previewTmpl.canvasLayout?.elements
              ? <div style={{ display: "flex", justifyContent: "center" }}>
                  <MiniBuilderPreview elements={previewTmpl.canvasLayout.elements} scale={0.7} />
                </div>
              : <MiniCardPreview tmpl={previewTmpl} scale={1.35} />
            }

            <button onClick={() => { useTemplate(previewTmpl.id); setPreviewTmpl(null); }} style={{
              width: "100%",
              background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT3})`,
              color: "#fff", border: "none",
              padding: "13px", borderRadius: 10,
              fontSize: 15, fontWeight: 700, cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: "0 4px 24px rgba(99,102,241,0.4)",
            }}>
              <Play size={15} fill="currentColor" />
              Use this template now
            </button>
          </div>
        </div>
      )}

      {/* ═══ DELETE CONFIRMATION MODAL ══════════════════════════════════════ */}
      {confirmDelete && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setConfirmDelete(null)}>
          <div style={{
            background: "#111827", border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 16, padding: "28px 32px", width: 360, maxWidth: "90vw",
            fontFamily: "'Inter', sans-serif",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>🗑️</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", textAlign: "center", marginBottom: 8 }}>
              Delete Template
            </div>
            <div style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", marginBottom: 24 }}>
              Are you sure you want to delete <strong style={{ color: "#ef4444" }}>"{confirmDelete.name}"</strong>?
              <br />This action cannot be undone.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)} style={{
                flex: 1, padding: "11px 0", borderRadius: 10,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#9ca3af", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}>Cancel</button>
              <button onClick={confirmDoDelete} disabled={isDeleting} style={{
                flex: 1, padding: "11px 0", borderRadius: 10,
                background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)",
                color: "#ef4444", fontSize: 14, fontWeight: 700, cursor: isDeleting ? "wait" : "pointer",
              }}>{isDeleting ? "Deleting..." : "Delete"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
