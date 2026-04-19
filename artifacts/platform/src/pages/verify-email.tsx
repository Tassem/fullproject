import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { getApiBaseUrl } from "@/lib/api";

const ACCENT  = "#6366f1";
const ACCENT3 = "#8b5cf6";
const BG      = "#05050a";
const MUTED   = "rgba(255,255,255,0.42)";

export default function VerifyEmail() {
  const search = useSearch();
  const token = new URLSearchParams(search).get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("رمز التحقق مفقود");
      return;
    }
    const baseUrl = getApiBaseUrl();
    fetch(`${baseUrl}/auth/verify-email?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setStatus("success");
          setMessage(data.message || "تم تأكيد بريدك الإلكتروني بنجاح!");
        } else {
          setStatus("error");
          setMessage(data.error || "فشل التحقق");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("حدث خطأ أثناء التحقق");
      });
  }, [token]);

  return (
    <div style={{
      minHeight: "100vh", background: BG,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Cairo', sans-serif", direction: "rtl", padding: 24,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)", backgroundSize: "28px 28px", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "20%", left: "20%", width: 500, height: 500, background: "radial-gradient(ellipse, rgba(139,92,246,0.1) 0%, transparent 60%)", pointerEvents: "none" }} />

      <div style={{ textAlign: "center", position: "relative", maxWidth: 420 }}>
        <div style={{
          width: 80, height: 80, borderRadius: "50%", margin: "0 auto 24px",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36,
          background: status === "success"
            ? "linear-gradient(135deg, #22d3ee22, #6366f122)"
            : status === "error"
            ? "rgba(239,68,68,0.15)"
            : "rgba(255,255,255,0.05)",
          border: `2px solid ${status === "success" ? "#22d3ee44" : status === "error" ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.1)"}`,
        }}>
          {status === "loading" ? "⏳" : status === "success" ? "✅" : "❌"}
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#fff", margin: "0 0 12px" }}>
          {status === "loading" ? "جاري التحقق..." : status === "success" ? "تم التأكيد!" : "فشل التحقق"}
        </h1>
        <p style={{ color: MUTED, fontSize: 15, margin: "0 0 32px", lineHeight: 1.7 }}>{message}</p>

        {status !== "loading" && (
          <Link href="/login" style={{
            display: "inline-block",
            background: `linear-gradient(135deg, ${ACCENT3}, ${ACCENT})`,
            color: "#fff", textDecoration: "none",
            padding: "12px 32px", borderRadius: 10,
            fontSize: 14, fontWeight: 700,
          }}>
            {status === "success" ? "تسجيل الدخول الآن" : "العودة لتسجيل الدخول"}
          </Link>
        )}
      </div>
    </div>
  );
}
