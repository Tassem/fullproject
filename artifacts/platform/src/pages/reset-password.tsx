import { useState, useEffect } from "react";
import { useLocation } from "wouter";
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

export default function ResetPassword() {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const token = params.get("token");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [tokenValid, setTokenValid] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid reset link — no token found.");
      setVerifying(false);
      return;
    }
    fetch(`${BASE_URL}/auth/verify-reset-token/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.valid) {
          setTokenValid(true);
        } else {
          setError(data.error || "Invalid or expired reset link");
        }
      })
      .catch(() => setError("Failed to verify reset link"))
      .finally(() => setVerifying(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(`${BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await resp.json();
      if (resp.ok) {
        setMessage(data.message);
        toast({ title: "Password reset", description: "Redirecting to login..." });
        setTimeout(() => setLocation("/login"), 3000);
      } else {
        setError(data.error || "Failed to reset password");
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

  if (verifying) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 40, height: 40, border: `3px solid ${BORDER2}`, borderTopColor: ACCENT, borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: MUTED, fontSize: 14 }}>Verifying reset link...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div style={{
        minHeight: "100vh", background: BG,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Inter', sans-serif", padding: 24,
      }}>
        <div style={{ width: "100%", maxWidth: 400, textAlign: "center" }}>
          <div style={{ fontSize: 48, color: "#ef4444", marginBottom: 16 }}>&#10005;</div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "#fff", marginBottom: 8 }}>Invalid Reset Link</h1>
          <p style={{ color: MUTED, fontSize: 14, marginBottom: 24 }}>{error}</p>
          <a href="/forgot-password" style={{ color: ACCENT2, textDecoration: "none", fontWeight: 600, fontSize: 14 }}>Request a new reset link</a>
        </div>
      </div>
    );
  }

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
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "#fff", margin: 0, marginBottom: 8, letterSpacing: "-0.5px" }}>Reset Password</h1>
          <p style={{ color: MUTED, fontSize: 14, margin: 0 }}>Enter your new password below</p>
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
              <p style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>Redirecting to login...</p>
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
                <label style={{ fontSize: 12, color: MUTED, display: "block", marginBottom: 7, fontWeight: 600, letterSpacing: "0.04em" }}>New Password</label>
                <input
                  type="password" dir="ltr" placeholder="••••••••"
                  value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = ACCENT}
                  onBlur={e => e.currentTarget.style.borderColor = BORDER}
                  required minLength={8} disabled={loading}
                />
                <p style={{ marginTop: 4, fontSize: 12, color: MUTED }}>Minimum 8 characters</p>
              </div>
              <div>
                <label style={{ fontSize: 12, color: MUTED, display: "block", marginBottom: 7, fontWeight: 600, letterSpacing: "0.04em" }}>Confirm Password</label>
                <input
                  type="password" dir="ltr" placeholder="••••••••"
                  value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  style={inputStyle}
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
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </form>
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: MUTED }}>
          <a href="/login" style={{ color: ACCENT2, textDecoration: "none", fontWeight: 600 }}>Back to Login</a>
        </div>
      </div>
    </div>
  );
}
