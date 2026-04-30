import { useState } from "react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { BASE_URL } from "@/lib/api";

const ACCENT = "#6366f1";
const ACCENT3 = "#8b5cf6";
const ACCENT2 = "#22d3ee";
const BG = "#05050a";
const SURFACE = "rgba(255,255,255,0.04)";
const BORDER = "rgba(255,255,255,0.08)";
const BORDER2 = "rgba(255,255,255,0.14)";
const TEXT = "rgba(255,255,255,0.88)";
const MUTED = "rgba(255,255,255,0.42)";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const resp = await fetch(`${BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await resp.json();
      if (resp.ok) {
        setMessage(data.message);
        setEmail("");
        toast({ title: "Email sent", description: data.message });
      } else {
        setError(data.error || "Failed to send reset email");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.04)",
    border: `1px solid ${BORDER}`, borderRadius: 10,
    color: TEXT, padding: "12px 14px", fontSize: 14, outline: "none",
    boxSizing: "border-box", fontFamily: "'Inter', sans-serif",
    transition: "border-color 0.2s",
  };

  return (
    <div style={{
      minHeight: "100vh", background: BG,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', sans-serif", direction: "ltr",
      position: "relative", overflow: "hidden", padding: 24,
    }}>
      <div style={{ position: "absolute", top: "15%", left: "15%", width: 500, height: 500, background: "radial-gradient(ellipse, rgba(99,102,241,0.1) 0%, transparent 60%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "15%", right: "15%", width: 400, height: 400, background: "radial-gradient(ellipse, rgba(34,211,238,0.07) 0%, transparent 60%)", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 400, position: "relative" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, margin: "0 auto 16px",
            background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT3})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: 22, color: "#fff",
            boxShadow: `0 0 28px rgba(99,102,241,0.4)`,
          }}>N</div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "#fff", margin: 0, marginBottom: 8, letterSpacing: "-0.5px" }}>Forgot Password</h1>
          <p style={{ color: MUTED, fontSize: 14, margin: 0 }}>Enter your email and we'll send you a reset link</p>
        </div>

        <div style={{
          background: SURFACE, border: `1px solid ${BORDER2}`,
          borderRadius: 20, padding: "32px 28px",
          backdropFilter: "blur(20px)",
          boxShadow: "0 24px 70px rgba(0,0,0,0.5)",
        }}>
          {message && (
            <div style={{ marginBottom: 20, padding: "14px 16px", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 10, color: "#6ee7b7", fontSize: 14 }}>
              {message}
            </div>
          )}
          {error && (
            <div style={{ marginBottom: 20, padding: "14px 16px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, color: "#fca5a5", fontSize: 14 }}>
              {error}
            </div>
          )}
          {!message && (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <label style={{ fontSize: 12, color: MUTED, display: "block", marginBottom: 7, fontWeight: 600, letterSpacing: "0.04em" }}>Email address</label>
                <input
                  type="email" placeholder="name@example.com" dir="ltr"
                  value={email} onChange={e => setEmail(e.target.value)}
                  style={{ ...inputStyle, fontFamily: "monospace" }}
                  onFocus={e => e.currentTarget.style.borderColor = ACCENT}
                  onBlur={e => e.currentTarget.style.borderColor = BORDER}
                  required disabled={loading}
                />
              </div>
              <button type="submit" disabled={loading} style={{
                background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT3})`,
                color: "#fff", border: "none",
                padding: "13px", borderRadius: 10,
                fontSize: 15, fontWeight: 700, cursor: loading ? "wait" : "pointer",
                fontFamily: "'Inter', sans-serif", marginTop: 6,
                boxShadow: `0 4px 24px rgba(99,102,241,0.4)`,
                transition: "all 0.2s", opacity: loading ? 0.8 : 1,
              }}>
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: MUTED }}>
          <Link href="/login" style={{ color: ACCENT2, textDecoration: "none", fontWeight: 600 }}>Back to Login</Link>
        </div>
      </div>
    </div>
  );
}
