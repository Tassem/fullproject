import { AlertCircle } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #060410 0%, #070612 100%)",
      fontFamily: "'Cairo', sans-serif", direction: "rtl",
    }}>
      <div style={{ textAlign: "center", padding: 40 }}>
        <div style={{
          width: 80, height: 80, borderRadius: 24, margin: "0 auto 24px",
          background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <AlertCircle style={{ width: 40, height: 40, color: "#f87171" }} />
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: "#fff", marginBottom: 8, letterSpacing: "-0.02em" }}>404 — الصفحة غير موجودة</h1>
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 15, marginBottom: 28 }}>
          الصفحة التي تبحث عنها غير موجودة أو تم نقلها
        </p>
        <Link href="/">
          <a style={{
            display: "inline-block", padding: "12px 28px",
            background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
            color: "#fff", borderRadius: 12, textDecoration: "none",
            fontSize: 14, fontWeight: 700,
            boxShadow: "0 4px 20px rgba(124,58,237,0.35)",
          }}>العودة للرئيسية</a>
        </Link>
      </div>
    </div>
  );
}
