/**
 * Server-side card renderer — mirrors the exact CSS layout from generate.tsx.
 *
 * Design rules (from generate.tsx):
 * - Preview card: 480 × (270|480|600) px  →  exported at 1080 × (608|1080|1350|...) px
 * - Scale factor = exportW / 480
 * - Default fontSize = 26 (preview px) → scaled at export
 * - Banner: absolute bottom, height = (100-photoH)%, display flex column justify-center
 * - Text vertically centered INSIDE banner with padding (10px top/bottom, 14px sides at preview scale)
 * - For "fade" templates (slate-fade / overlay-only): gradient covers full height
 */

import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Register fonts (Cairo, Noto Kufi Arabic, Inter) ──────────────────────────
let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  fontsRegistered = true;
  const fontsDir = path.join(__dirname, "fonts");
  if (!fs.existsSync(fontsDir)) {
    console.warn(`[FONTS] Fonts directory not found: ${fontsDir}`);
    return;
  }
  try {
    // Load all TTF files via their embedded family metadata (most reliable)
    GlobalFonts.loadFontsFromDir(fontsDir);
    // Register Cairo explicitly from buffer so it's accessible as "Cairo"
    const cairoPath = path.join(fontsDir, "Cairo.ttf");
    if (fs.existsSync(cairoPath)) {
      GlobalFonts.register(fs.readFileSync(cairoPath), "Cairo");
    }
    // Register aliases so template fontFamily values always resolve
    GlobalFonts.setAlias("KufiArabic",        "Noto Kufi Arabic");
    GlobalFonts.setAlias("NotoKufiArabic",    "Noto Kufi Arabic");
    GlobalFonts.setAlias("NotoSansArabic",    "Noto Sans Arabic");
    GlobalFonts.setAlias("IBM Plex Arabic",   "IBM Plex Sans Arabic");
    GlobalFonts.setAlias("IBMPlexArabic",     "IBM Plex Sans Arabic");
    console.log("[FONTS] Registered:", GlobalFonts.families.map((f: { family: string }) => f.family).join(", "));
  } catch (e) {
    console.error("[FONTS] Registration failed:", e);
  }
}

// ── Template definitions — mirrors TEMPLATES array in generate.tsx EXACTLY ───
interface TemplateConfig {
  bannerColor: string;
  bannerGradient?: string;   // raw CSS gradient string (we parse it)
  textColor: string;
  labelColor: string;
  photoHeight: number;       // % of card taken by photo area (top)
  isLight?: boolean;
  accentColor?: string;
  bannerBorderRadius?: string;
  showQuote?: boolean;
}

const TEMPLATES: Record<string, TemplateConfig> = {
  "classic-blue":  { bannerColor: "#0f2557", textColor: "#ffffff", labelColor: "rgba(255,255,255,0.85)", photoHeight: 62 },
  "breaking-red":  { bannerColor: "#7f1d1d", bannerGradient: "linear-gradient(135deg,#991b1b,#7f1d1d)", textColor: "#ffffff", labelColor: "rgba(255,255,255,0.85)", photoHeight: 60 },
  "modern-black":  { bannerColor: "#0a0a0a", bannerGradient: "linear-gradient(180deg,rgba(0,0,0,0) 0%,#000000 100%)", textColor: "#f5f5f5", labelColor: "rgba(255,255,255,0.7)", photoHeight: 70 },
  "emerald":       { bannerColor: "#064e3b", bannerGradient: "linear-gradient(135deg,#065f46,#064e3b)", textColor: "#ffffff", labelColor: "rgba(255,255,255,0.85)", photoHeight: 62 },
  "royal-purple":  { bannerColor: "#3b0764", bannerGradient: "linear-gradient(135deg,#4c1d95,#3b0764)", textColor: "#ffffff", labelColor: "rgba(255,255,255,0.85)", photoHeight: 60 },
  "gold":          { bannerColor: "#78350f", bannerGradient: "linear-gradient(135deg,#92400e,#78350f)", textColor: "#fef3c7", labelColor: "rgba(255,255,255,0.85)", photoHeight: 62 },
  "midnight":      { bannerColor: "#1e1b4b", bannerGradient: "linear-gradient(135deg,#312e81,#1e1b4b)", textColor: "#e0e7ff", labelColor: "rgba(255,255,255,0.75)", photoHeight: 60 },
  "slate-fade":    { bannerColor: "transparent", bannerGradient: "linear-gradient(to top,rgba(2,6,23,0.95) 0%,rgba(2,6,23,0.6) 60%,transparent 100%)", textColor: "#ffffff", labelColor: "rgba(255,255,255,0.85)", photoHeight: 100 },
  "white-quote":   { bannerColor: "#ffffff", textColor: "#111111", labelColor: "rgba(0,0,0,0.45)", photoHeight: 58, isLight: true, accentColor: "#dc2626", showQuote: true },
  "purple-wave":   { bannerColor: "#7c3aed", bannerGradient: "linear-gradient(135deg,#8b5cf6 0%,#5b21b6 100%)", textColor: "#ffffff", labelColor: "rgba(255,255,255,0.8)", photoHeight: 60, bannerBorderRadius: "28px 28px 0 0" },
  "crimson":       { bannerColor: "#dc2626", textColor: "#ffffff", labelColor: "rgba(255,255,255,0.9)", photoHeight: 62 },
  "news-social":   { bannerColor: "#ffffff", textColor: "#111111", labelColor: "rgba(0,0,0,0.45)", photoHeight: 57, isLight: true, accentColor: "#dc2626", showQuote: true },
  "wave-white":    { bannerColor: "#ffffff", textColor: "#111111", labelColor: "rgba(0,0,0,0.4)", photoHeight: 65, isLight: true },
  "wave-blue":     { bannerColor: "#0f2557", textColor: "#ffffff", labelColor: "rgba(255,255,255,0.85)", photoHeight: 65 },
  "ocean":         { bannerColor: "#0c4a6e", bannerGradient: "linear-gradient(135deg,#0369a1,#0c4a6e)", textColor: "#e0f2fe", labelColor: "rgba(255,255,255,0.8)", photoHeight: 60 },
  "amber":         { bannerColor: "#d97706", bannerGradient: "linear-gradient(135deg,#f59e0b,#d97706)", textColor: "#ffffff", labelColor: "rgba(255,255,255,0.85)", photoHeight: 62 },
  "rose":          { bannerColor: "#9f1239", bannerGradient: "linear-gradient(135deg,#be123c,#9f1239)", textColor: "#fff1f2", labelColor: "rgba(255,255,255,0.85)", photoHeight: 60 },
  "teal":          { bannerColor: "#0f766e", bannerGradient: "linear-gradient(135deg,#0d9488,#0f766e)", textColor: "#f0fdfa", labelColor: "rgba(255,255,255,0.85)", photoHeight: 62 },
  "dark-social":   { bannerColor: "#18181b", textColor: "#f4f4f5", labelColor: "rgba(255,255,255,0.7)", photoHeight: 60 },
  "overlay-only":  { bannerColor: "transparent", bannerGradient: "none", textColor: "#ffffff", labelColor: "rgba(255,255,255,0.85)", photoHeight: 100 },
};

// ── Export (output) dimensions ────────────────────────────────────────────────
const EXPORT_DIMS: Record<string, { w: number; h: number }> = {
  "1:1":  { w: 1080, h: 1080 },
  "16:9": { w: 1080, h: 608 },
  "4:5":  { w: 1080, h: 1350 },
  "9:16": { w: 608,  h: 1080 },
};

// Preview width (all ratios share same base width in generate.tsx)
const PREVIEW_W = 480;

// ── Word wrap ────────────────────────────────────────────────────────────────
type Ctx2D = ReturnType<ReturnType<typeof createCanvas>["getContext"]>;

function wrapText(ctx: Ctx2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ── Parse CSS rgba string into napi-rs/canvas compatible color ───────────────
function resolveColor(color: string): string {
  // napi-rs/canvas handles hex, rgb(), rgba() natively
  if (!color || color === "transparent") return "rgba(0,0,0,0)";
  return color;
}

// ── Draw rounded rectangle ────────────────────────────────────────────────────
function roundRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ── Canvas layout types (mirrors canvasLayout JSON in DB) ────────────────────
export interface CanvasElement {
  id: string;
  type: "bg" | "photo" | "text" | "rect" | "circle" | "badge" | "social" | "logo";
  x: number;
  y: number;
  w: number;
  h: number;
  zIndex?: number;
  // bg / photo
  src?: string;
  fill?: string;
  gradient?: string;
  hidden?: boolean;
  // text
  content?: string;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  textAlign?: "left" | "center" | "right";
  lineHeight?: number;
  opacity?: number;
  // rect / circle
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  // badge
  bgColor?: string;
}

export interface CanvasLayout {
  width: number;
  height: number;
  elements: CanvasElement[];
}

// ── Canvas renderer — uses canvasLayout JSON from DB to render a card ─────────
// Handles: photo (user bg), bg (overlay PNG), text (headline/fixed), rect, circle, badge, social
export async function renderFromCanvasLayout(
  layout: CanvasLayout,
  userTitle: string | null,
  userPhotoBuffer: Buffer | null,
  exportW: number,
  exportH: number,
  uploadsDir: string,
): Promise<Buffer> {
  ensureFonts();

  const scale = exportW / layout.width;
  const canvas = createCanvas(exportW, exportH);
  const ctx = canvas.getContext("2d");

  // Fill background
  ctx.fillStyle = "#1a2035";
  ctx.fillRect(0, 0, exportW, exportH);

  // Sort elements by zIndex
  const elements = [...layout.elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

  for (const el of elements) {
    if (el.hidden) continue;

    const ex = Math.round(el.x * scale);
    const ey = Math.round(el.y * scale);
    const ew = Math.round(el.w * scale);
    const eh = Math.round(el.h * scale);

    switch (el.type) {
      // ── Photo: draw user's background image ─────────────────────────────
      case "photo": {
        // 1. Use passed-in buffer (standard generate flow)
        // 2. Fallback: load from el.src server path (builder flow)
        let buf = userPhotoBuffer;
        if (!buf && el.src) {
          try {
            const filename = el.src.replace(/^.*[/\\]/, "");
            const imgPath = path.join(uploadsDir, filename);
            if (fs.existsSync(imgPath)) buf = fs.readFileSync(imgPath);
          } catch { /* skip */ }
        }
        if (buf) {
          try {
            const img = await loadImage(buf);
            const sx = ew / img.width;
            const sy = eh / img.height;
            const s = Math.max(sx, sy);    // cover-fit: fill the whole area
            const dw = img.width * s;
            const dh = img.height * s;
            const dx = ex + (ew - dw) / 2; // center horizontally
            // Top-anchor vertically: news photos have subject near top
            // Only center if image is wider than tall (landscape cropping is fine centered)
            const isPortrait = img.height > img.width;
            const dy = isPortrait ? ey : ey + (eh - dh) / 2;
            ctx.save();
            ctx.beginPath();
            ctx.rect(ex, ey, ew, eh);
            ctx.clip();
            ctx.drawImage(img, dx, dy, dw, dh);
            ctx.restore();
          } catch { /* skip */ }
        } else {
          // No photo: draw placeholder gradient
          const grad = ctx.createLinearGradient(ex, ey, ex + ew, ey + eh);
          grad.addColorStop(0, "#1a2035");
          grad.addColorStop(1, "#2d3748");
          ctx.fillStyle = grad;
          ctx.fillRect(ex, ey, ew, eh);
        }
        break;
      }

      // ── Bg: overlay PNG or solid fill ───────────────────────────────────
      case "bg": {
        ctx.save();
        if (el.opacity !== undefined && el.opacity !== 1) ctx.globalAlpha = el.opacity;
        if (el.src) {
          // Load overlay PNG from uploads directory
          try {
            const filename = el.src.replace(/^.*\//, ""); // strip path prefix
            const imgPath = path.join(uploadsDir, filename);
            const overlayBuf = (await import("fs")).default.readFileSync(imgPath);
            const img = await loadImage(overlayBuf);
            ctx.save();
            ctx.beginPath();
            ctx.rect(ex, ey, ew, eh);
            ctx.clip();
            ctx.drawImage(img, ex, ey, ew, eh);
            ctx.restore();
          } catch { /* skip if overlay not found */ }
        } else if (el.gradient) {
          // Parse simple linear gradient
          const grad = ctx.createLinearGradient(ex, ey, ex, ey + eh);
          const stops = el.gradient.match(/(rgba?\([^)]+\)|#[0-9a-f]+)\s+(\d+)%/gi) || [];
          if (stops.length >= 2) {
            for (const stop of stops) {
              const m = stop.match(/(rgba?\([^)]+\)|#[0-9a-f]+)\s+(\d+)%/i);
              if (m) grad.addColorStop(parseInt(m[2]) / 100, m[1]);
            }
          } else {
            grad.addColorStop(0, el.fill || "#1a2035");
            grad.addColorStop(1, "#000000");
          }
          ctx.fillStyle = grad;
          ctx.fillRect(ex, ey, ew, eh);
        } else if (el.fill && el.fill !== "transparent") {
          ctx.fillStyle = el.fill;
          ctx.fillRect(ex, ey, ew, eh);
        }
        ctx.restore();
        break;
      }

      // ── Rect: colored rectangle with optional gradient / border-radius ───
      case "rect": {
        ctx.save();
        if (el.opacity !== undefined && el.opacity !== 1) ctx.globalAlpha = el.opacity;

        let fillStyle: string | ReturnType<typeof ctx.createLinearGradient> = el.fill || "rgba(0,0,0,0.5)";
        if (el.gradient) {
          const g = ctx.createLinearGradient(ex, ey, ex, ey + eh);
          const stops = el.gradient.match(/(rgba?\([^)]+\)|#[0-9a-f]+)\s+(\d+)%/gi) || [];
          if (stops.length >= 2) {
            for (const s of stops) {
              const m = s.match(/(rgba?\([^)]+\)|#[0-9a-f]+)\s+(\d+)%/i);
              if (m) g.addColorStop(parseInt(m[2]) / 100, m[1]);
            }
            fillStyle = g;
          }
        }
        ctx.fillStyle = fillStyle;

        const r = Math.round((el.borderRadius || 0) * scale);
        if (r > 0) {
          roundRect(ctx, ex, ey, ew, eh, r);
          ctx.fill();
        } else {
          ctx.fillRect(ex, ey, ew, eh);
        }

        if (el.borderWidth && el.borderColor) {
          ctx.strokeStyle = el.borderColor;
          ctx.lineWidth = Math.round(el.borderWidth * scale);
          if (r > 0) { roundRect(ctx, ex, ey, ew, eh, r); ctx.stroke(); }
          else ctx.strokeRect(ex, ey, ew, eh);
        }
        ctx.restore();
        break;
      }

      // ── Circle ──────────────────────────────────────────────────────────
      case "circle": {
        ctx.save();
        if (el.opacity !== undefined && el.opacity !== 1) ctx.globalAlpha = el.opacity;
        ctx.fillStyle = el.fill || "rgba(0,0,0,0.5)";
        const cx2 = ex + ew / 2;
        const cy2 = ey + eh / 2;
        const r2 = Math.min(ew, eh) / 2;
        ctx.beginPath();
        ctx.arc(cx2, cy2, r2, 0, Math.PI * 2);
        ctx.fill();
        if (el.borderWidth && el.borderColor) {
          ctx.strokeStyle = el.borderColor;
          ctx.lineWidth = Math.round(el.borderWidth * scale);
          ctx.beginPath();
          ctx.arc(cx2, cy2, r2 - ctx.lineWidth / 2, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
        break;
      }

      // ── Line: horizontal divider ─────────────────────────────────────────
      case "line": {
        ctx.save();
        if (el.opacity !== undefined && el.opacity !== 1) ctx.globalAlpha = el.opacity;
        const lineThick = Math.max(1, Math.round((el.borderWidth ?? 2) * scale));
        const lineY = ey + Math.round(eh / 2) - Math.round(lineThick / 2);
        ctx.fillStyle = el.fill || "#ffffff";
        ctx.beginPath();
        ctx.roundRect(ex, lineY, ew, lineThick, lineThick / 2);
        ctx.fill();
        ctx.restore();
        break;
      }

      // ── Text: fixed or headline ──────────────────────────────────────────
      case "text": {
        const isHeadline = el.id === "headline" || el.id === "headline_text" || el.id?.includes("headline");
        // Use userTitle for headline when provided (standard generate flow)
        // Otherwise use el.content directly (builder/template-export flow)
        const rawContent = (isHeadline && userTitle) ? userTitle : (el.content || "");
        if (!rawContent.trim()) break;

        ctx.save();
        if (el.opacity !== undefined && el.opacity !== 1) ctx.globalAlpha = el.opacity;

        const family = el.fontFamily || "Cairo";
        const weight = el.fontWeight || 700;
        const fsize = Math.round((el.fontSize || 16) * scale);
        ctx.fillStyle = el.color || "#ffffff";
        ctx.textBaseline = "top";

        // Auto-detect text direction: Arabic fonts/content → RTL, Latin → LTR
        const isArabicFont = /arabic|kufi|noto|cairo|tajawal|amiri|reem/i.test(family);
        const isArabicText = /[\u0600-\u06FF]/.test(rawContent);
        const isRTL = isArabicFont || isArabicText;
        ctx.direction = isRTL ? "rtl" : "ltr";

        const lineH = fsize * (el.lineHeight || 1.45);
        // User-selected font FIRST, then fallbacks for missing glyphs
        ctx.font = `${weight} ${fsize}px "${family}", "Cairo", "Noto Kufi Arabic", "Noto Sans Arabic", "Inter", sans-serif`;
        const lines = wrapText(ctx, rawContent, ew);

        // Total text height for vertical centering within the element box
        const totalH = lines.length * lineH;
        let startY = ey + (eh - totalH) / 2;
        if (startY < ey) startY = ey;

        // Set canvas textAlign to match element's alignment
        const align = el.textAlign || "center";
        ctx.textAlign = align;
        const textX = align === "center"
          ? ex + ew / 2
          : align === "right"
          ? ex + ew   // RTL right-align = right edge of element
          : ex;       // left-align = left edge of element

        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], textX, Math.round(startY + i * lineH));
        }
        ctx.restore();
        break;
      }

      // ── Badge: colored rounded label ────────────────────────────────────
      case "badge": {
        if (!el.content) break;
        ctx.save();
        const r3 = Math.round((el.borderRadius || 4) * scale);
        ctx.fillStyle = el.bgColor || "#dc2626";
        roundRect(ctx, ex, ey, ew, eh, r3);
        ctx.fill();

        const bf = Math.round((el.fontSize || 12) * scale);
        const bfFamily = el.fontFamily || "Cairo";
        ctx.font = `bold ${bf}px "${bfFamily}", "Cairo", "Noto Kufi Arabic", sans-serif`;
        ctx.fillStyle = el.color || "#ffffff";
        ctx.direction = "rtl";
        ctx.textBaseline = "middle";
        ctx.fillText(el.content, ex + ew / 2, ey + eh / 2);
        ctx.restore();
        break;
      }

      // ── Social: single social platform icon ──────────────────────────────
      case "social": {
        ctx.save();
        if (el.opacity !== undefined && el.opacity !== 1) ctx.globalAlpha = el.opacity;
        const SOCIAL_MAP: Record<string, { bg: string; glyph: string }> = {
          twitter:   { bg: "#000000", glyph: "𝕏" },
          instagram: { bg: "#E1306C", glyph: "📷" },
          facebook:  { bg: "#1877F2", glyph: "f" },
          youtube:   { bg: "#FF0000", glyph: "▶" },
          tiktok:    { bg: "#010101", glyph: "♪" },
          whatsapp:  { bg: "#25D366", glyph: "✆" },
          telegram:  { bg: "#229ED9", glyph: "✈" },
          snapchat:  { bg: "#FFFC00", glyph: "👻" },
        };
        const plat = SOCIAL_MAP[el.platform || ""] || { bg: "#333", glyph: "?" };
        const bg  = el.fill || plat.bg;
        const r5  = Math.round((el.borderRadius ?? 10) * scale);
        ctx.fillStyle = bg;
        roundRect(ctx, ex, ey, ew, eh, r5);
        ctx.fill();
        const gSize = Math.round(Math.min(ew, eh) * 0.52);
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${gSize}px "Cairo", "Noto Kufi Arabic", sans-serif`;
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";
        ctx.direction = "ltr";
        ctx.fillText(plat.glyph.slice(0, 2), ex + ew / 2, ey + eh / 2);
        ctx.restore();
        break;
      }

      // ── Logo: draw logo image if src available ───────────────────────────
      case "logo": {
        if (el.src) {
          try {
            const filename = el.src.replace(/^.*\//, "");
            const imgPath = path.join(uploadsDir, filename);
            const logoBuf = (await import("fs")).default.readFileSync(imgPath);
            const img = await loadImage(logoBuf);
            ctx.save();
            ctx.drawImage(img, ex, ey, ew, eh);
            ctx.restore();
          } catch { /* skip */ }
        }
        // If no src, skip (logo may be part of overlay image)
        break;
      }

      default:
        break;
    }
  }

  return canvas.toBuffer("image/png");
}

// ── Main render ───────────────────────────────────────────────────────────────
export interface RenderCardOptions {
  title: string;
  label?: string | null;
  ratio?: string;
  templateSlug: string;
  canvasLayout?: CanvasLayout | string | null;  // parsed JSON from DB
  uploadsDir?: string;                           // needed to load overlay/logo images
  bannerColor?: string;       // override (from DB custom template)
  textColor?: string;         // override
  backgroundImageBuffer?: Buffer | null;
  logoText?: string | null;   // optional channel name top-right
  fontSize?: number;          // preview-px font size (default 26)
  fontWeight?: number;        // default 700
}

export async function renderCard(opts: RenderCardOptions): Promise<Buffer> {
  ensureFonts();

  // ── If a canvas layout is provided (from DB template), use canvas renderer ──
  if (opts.canvasLayout) {
    let layout: CanvasLayout;
    if (typeof opts.canvasLayout === "string") {
      try { layout = JSON.parse(opts.canvasLayout); } catch { layout = { width: 540, height: 540, elements: [] }; }
    } else {
      layout = opts.canvasLayout;
    }

    if (layout.elements && layout.elements.length > 0) {
      const dims = EXPORT_DIMS[opts.ratio ?? "1:1"] ?? EXPORT_DIMS["1:1"];
      const uploadsDir = opts.uploadsDir || path.join(__dirname, "..", "..", "uploads");
      return renderFromCanvasLayout(layout, opts.title, opts.backgroundImageBuffer ?? null, dims.w, dims.h, uploadsDir);
    }
  }

  const {
    title,
    label,
    ratio = "16:9",
    templateSlug,
    backgroundImageBuffer,
    logoText,
    fontSize: previewFontSize = 26,
    fontWeight = 700,
  } = opts;

  const dims = EXPORT_DIMS[ratio] ?? EXPORT_DIMS["16:9"];
  const W = dims.w;
  const H = dims.h;

  // Scale factor from preview → export
  const scale = W / PREVIEW_W;

  // Resolve template
  const tmplKey = templateSlug.toLowerCase().trim();
  const tmpl: TemplateConfig = TEMPLATES[tmplKey] ?? {
    // Use || so empty-string values from DB also fall back to defaults
    bannerColor: (opts.bannerColor || null) ?? "#0f2557",
    textColor:   (opts.textColor   || null) ?? "#ffffff",
    labelColor:  "rgba(255,255,255,0.85)",
    photoHeight: 62,
  };

  // Allow DB-level overrides — use || so empty strings also fall back
  const bannerColor = opts.bannerColor  || tmpl.bannerColor  || "#0f2557";
  const textColor   = opts.textColor    || tmpl.textColor    || "#ffffff";
  const labelColor  = tmpl.labelColor   || "rgba(255,255,255,0.85)";

  const isFade = tmplKey === "slate-fade" || tmplKey === "overlay-only" || tmpl.photoHeight >= 100;
  const photoH = tmpl.photoHeight;            // % of H for photo area
  const bannerHPct = Math.max(0, 100 - photoH); // % of H for banner

  const photoAreaH  = Math.round(H * photoH / 100);
  const bannerAreaY = photoAreaH;
  const bannerAreaH = H - photoAreaH;

  // Scaled font sizes (mirror generate.tsx defaults)
  const headlineFontSz = Math.round(previewFontSize * scale);
  const labelFontSz    = Math.max(Math.round(10 * scale), 14);
  const logoBadgeH     = Math.round(32 * scale);

  // Padding inside banner (mirrors generate.tsx: "10px 14px 10px")
  const padV = Math.round(10 * scale);  // vertical padding inside banner
  const padH = Math.round(14 * scale);  // horizontal padding

  const font = "Cairo";

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // ── 1. Background ──────────────────────────────────────────────────────────
  if (backgroundImageBuffer) {
    try {
      const bgImg = await loadImage(backgroundImageBuffer);
      // cover-fit: same as objectFit: cover, objectPosition: 50% 50%
      const scaleX = W / bgImg.width;
      const scaleY = H / bgImg.height;
      const s = Math.max(scaleX, scaleY);
      const dw = bgImg.width * s;
      const dh = bgImg.height * s;
      const dx = (W - dw) / 2;
      const dy = (H - dh) / 2;
      ctx.drawImage(bgImg, dx, dy, dw, dh);
    } catch {
      // fallback gradient
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, "#1a2035");
      bg.addColorStop(1, "#2d3748");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
    }
  } else {
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#1a2035");
    bg.addColorStop(1, "#2d3748");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
  }

  // ── 2. Banner / overlay ────────────────────────────────────────────────────
  // Parse the bannerGradient CSS string into canvas gradient, or use solid color
  if (isFade) {
    // Full-height bottom-to-top gradient overlay
    const grad = ctx.createLinearGradient(0, H, 0, 0);
    grad.addColorStop(0,   "rgba(2,6,23,0.95)");
    grad.addColorStop(0.6, "rgba(2,6,23,0.60)");
    grad.addColorStop(1,   "rgba(2,6,23,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  } else if (tmpl.bannerGradient && tmpl.bannerGradient !== "none") {
    // Parse gradient type from CSS string
    const gStr = tmpl.bannerGradient;
    if (gStr.includes("180deg") || gStr.includes("to top")) {
      // linear-gradient(180deg, rgba(0,0,0,0) 0%, #000 100%) — vertical top-to-bottom
      const grad = ctx.createLinearGradient(0, bannerAreaY, 0, H);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "#000000");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    } else if (gStr.includes("135deg")) {
      // diagonal gradient — draw as solid banner with gradient from corner to corner
      const colorMatch = gStr.match(/gradient\(135deg,\s*([^,]+),\s*([^)]+)\)/);
      const c1 = colorMatch ? colorMatch[1].trim() : bannerColor;
      const c2 = colorMatch ? colorMatch[2].trim() : bannerColor;
      const grad = ctx.createLinearGradient(0, bannerAreaY, W, H);
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);
      ctx.fillStyle = grad;

      // Apply border radius for purple-wave
      if (tmpl.bannerBorderRadius) {
        const r = Math.round(28 * scale);
        ctx.save();
        roundRect(ctx, 0, bannerAreaY - r, W, bannerAreaH + r, r);
        ctx.clip();
        ctx.fillRect(0, bannerAreaY - r, W, bannerAreaH + r);
        ctx.restore();
      } else {
        ctx.fillRect(0, bannerAreaY, W, bannerAreaH);
      }
    } else {
      // fallback: solid banner
      ctx.fillStyle = resolveColor(bannerColor);
      ctx.fillRect(0, bannerAreaY, W, bannerAreaH);
    }
  } else {
    // Solid banner
    if (bannerColor && bannerColor !== "transparent") {
      ctx.fillStyle = resolveColor(bannerColor);
      ctx.fillRect(0, bannerAreaY, W, bannerAreaH);
    }
  }

  // ── 3. White/light accent bar (left edge for white-quote, news-social) ─────
  if (tmpl.isLight && tmpl.accentColor) {
    ctx.fillStyle = tmpl.accentColor;
    ctx.fillRect(0, bannerAreaY, Math.round(8 * scale), bannerAreaH);
  }

  // ── 4. Text — vertically centered inside banner ────────────────────────────
  // Mirror CSS: flexDirection: column, justifyContent: center, padding: 10px 14px
  ctx.save();
  ctx.direction = "rtl";   // Arabic right-to-left (text flows from right)
  ctx.textBaseline = "top";
  ctx.shadowColor   = "rgba(0,0,0,0.65)";
  ctx.shadowBlur    = Math.round(4 * scale);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = Math.round(1 * scale);

  const maxTextW = W - 2 * padH;

  // Calculate headline lines
  ctx.font = `${fontWeight} ${headlineFontSz}px "Inter", "${font}", sans-serif`;
  const headlineLines = wrapText(ctx, title, maxTextW).slice(0, 4);
  const lineH = headlineFontSz * 1.45;

  // Calculate label line if present
  const hasLabel = !!(label && label.trim());

  // Total content height:
  //   headline lines + optional gap + label badge
  const labelGap   = hasLabel ? Math.round(6 * scale) : 0;
  const labelBadgeH = hasLabel ? labelFontSz + Math.round(4 * scale) : 0;
  const totalH = headlineLines.length * lineH + labelGap + labelBadgeH;

  // Vertical start of text block, centered in banner area
  let contentAreaY: number;
  if (isFade) {
    // For fade templates, place text near bottom with padding
    contentAreaY = H - totalH - padV * 2;
  } else {
    contentAreaY = bannerAreaY + (bannerAreaH - totalH) / 2;
    contentAreaY = Math.max(bannerAreaY + padV, contentAreaY);
  }

  // Draw headline lines
  ctx.fillStyle = resolveColor(textColor);
  ctx.font = `${fontWeight} ${headlineFontSz}px "${font}", sans-serif`;
  headlineLines.forEach((line, i) => {
    // RTL: x = padH from left, but canvas in RTL mode aligns text to the right
    ctx.fillText(line, padH, Math.round(contentAreaY + i * lineH));
  });

  // ── 5. Label badge ─────────────────────────────────────────────────────────
  if (hasLabel) {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur  = 0;

    const labelY = Math.round(contentAreaY + headlineLines.length * lineH + labelGap);
    ctx.font = `600 ${labelFontSz}px "${font}", "Inter", sans-serif`;

    const labelText = label!;
    const labelTextW = ctx.measureText(labelText).width;
    const badgePadH = Math.round(8 * scale);
    const badgePadV = Math.round(2 * scale);
    const badgeW = labelTextW + badgePadH * 2;
    const badgeH = labelFontSz + badgePadV * 2;

    // Badge background (RTL: positioned from the right side)
    const badgeX = padH; // left padding (in RTL canvas the text starts from here)
    ctx.fillStyle = tmpl.isLight ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.1)";
    roundRect(ctx, badgeX, labelY, badgeW, badgeH, Math.round(4 * scale));
    ctx.fill();

    // Label text
    ctx.fillStyle = resolveColor(labelColor);
    ctx.fillText(labelText, badgeX + badgePadH, labelY + badgePadV);
  }

  ctx.restore();

  // ── 6. Logo badge (top-right, channel name) ────────────────────────────────
  if (logoText) {
    const badgePadH = Math.round(10 * scale);
    const badgePadV = Math.round(4 * scale);
    ctx.save();
    ctx.direction = "ltr";
    ctx.textBaseline = "top";
    ctx.font = `bold ${Math.round(12 * scale)}px "${font}", sans-serif`;
    const logoW = ctx.measureText(logoText).width + badgePadH * 2;
    const logoBadgeY = Math.round(10 * scale);
    const logoBadgeX = W - logoW - Math.round(10 * scale);

    ctx.fillStyle = "rgba(0,0,0,0.3)";
    roundRect(ctx, logoBadgeX, logoBadgeY, logoW, logoBadgeH, Math.round(4 * scale));
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.fillText(logoText, logoBadgeX + badgePadH, logoBadgeY + (logoBadgeH - Math.round(12 * scale)) / 2);
    ctx.restore();
  }

  return canvas.toBuffer("image/png");
}
