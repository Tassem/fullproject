import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { GoogleLogin } from "@react-oauth/google";
import { getApiBaseUrl } from "@/lib/api";
import { usePublicSettings } from "@/lib/publicSettings";
import { useContext } from "react";
import { AuthContext } from "@/contexts/auth";

const ACCENT  = "#6366f1";
const ACCENT3 = "#8b5cf6";
const ACCENT2 = "#22d3ee";
const BG      = "#05050a";
const SURFACE = "rgba(255,255,255,0.04)";
const BORDER  = "rgba(255,255,255,0.08)";
const BORDER2 = "rgba(255,255,255,0.14)";
const TEXT    = "rgba(255,255,255,0.88)";
const MUTED   = "rgba(255,255,255,0.42)";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { mutate: loginMutate, isPending } = useLogin();
  const authCtx = useContext(AuthContext);

  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  function onSuccess(data: any) {
    if (authCtx) {
      authCtx.login(data.token, data.user);
    } else {
      localStorage.setItem("pro_token", data.token);
    }
    toast({ title: "Signed in successfully", description: "Welcome back to NewsCard Pro" });
    setLocation("/dashboard");
  }

  function onSubmit(values: z.infer<typeof loginSchema>) {
    loginMutate({ data: values }, {
      onSuccess,
      onError: (error: any) => {
        toast({ title: "Error", description: error?.data?.error || "Invalid email or password", variant: "destructive" });
      },
    });
  }

  async function handleGoogle(credential: string) {
    try {
      const baseUrl = getApiBaseUrl();
      const resp = await fetch(`${baseUrl}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Google sign-in failed");
      onSuccess(data);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.04)",
    border: `1px solid ${BORDER}`, borderRadius: 10,
    color: TEXT, padding: "12px 14px", fontSize: 14, outline: "none",
    boxSizing: "border-box", fontFamily: "'Inter', sans-serif",
    transition: "border-color 0.2s",
  };

  const { googleClientId } = usePublicSettings();
  const showGoogle = !!googleClientId;

  return (
    <div style={{
      minHeight: "100vh", background: BG,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', sans-serif", direction: "ltr",
      position: "relative", overflow: "hidden", padding: 24,
    }}>
      <div style={{ position: "absolute", top: "15%", left: "15%", width: 500, height: 500, background: "radial-gradient(ellipse, rgba(99,102,241,0.1) 0%, transparent 60%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "15%", right: "15%", width: 400, height: 400, background: "radial-gradient(ellipse, rgba(34,211,238,0.07) 0%, transparent 60%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)", backgroundSize: "28px 28px", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 400, position: "relative" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, margin: "0 auto 16px",
            background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT3})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: 22, color: "#fff",
            boxShadow: `0 0 28px rgba(99,102,241,0.4)`,
          }}>N</div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "#fff", margin: 0, marginBottom: 8, letterSpacing: "-0.5px" }}>Sign In</h1>
          <p style={{ color: MUTED, fontSize: 14, margin: 0 }}>Welcome back to NewsCard Pro</p>
        </div>

        {/* Card */}
        <div style={{
          background: SURFACE, border: `1px solid ${BORDER2}`,
          borderRadius: 20, padding: "32px 28px",
          backdropFilter: "blur(20px)",
          boxShadow: "0 24px 70px rgba(0,0,0,0.5)",
        }}>

          {/* Google Button */}
          {showGoogle && (
            <>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                <GoogleLogin
                  onSuccess={r => r.credential && handleGoogle(r.credential)}
                  onError={() => toast({ title: "Error", description: "Google sign-in failed", variant: "destructive" })}
                  text="signin_with"
                  shape="pill"
                  size="large"
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1, height: 1, background: BORDER2 }} />
                <span style={{ color: MUTED, fontSize: 12 }}>or with email</span>
                <div style={{ flex: 1, height: 1, background: BORDER2 }} />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label style={{ fontSize: 12, color: MUTED, display: "block", marginBottom: 7, fontWeight: 600, letterSpacing: "0.04em" }}>Email address</label>
              <input
                type="email" placeholder="name@example.com" dir="ltr"
                style={{ ...inputStyle, fontFamily: "monospace" }}
                onFocus={e => e.currentTarget.style.borderColor = ACCENT}
                {...register("email")}
              />
              {errors.email && <div style={{ fontSize: 12, color: "#fca5a5", marginTop: 5 }}>{errors.email.message}</div>}
            </div>

            <div>
              <label style={{ fontSize: 12, color: MUTED, display: "block", marginBottom: 7, fontWeight: 600, letterSpacing: "0.04em" }}>Password</label>
              <input
                type="password" dir="ltr" style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = ACCENT}
                {...register("password")}
              />
              {errors.password && <div style={{ fontSize: 12, color: "#fca5a5", marginTop: 5 }}>{errors.password.message}</div>}
              <div style={{ textAlign: "right", marginTop: 4 }}>
                <Link href="/forgot-password" style={{ fontSize: 13, color: ACCENT2, textDecoration: "none", fontWeight: 500 }}>Forgot password?</Link>
              </div>
            </div>

            <button type="submit" disabled={isPending} style={{
              background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT3})`,
              color: "#fff", border: "none",
              padding: "13px", borderRadius: 10,
              fontSize: 15, fontWeight: 700, cursor: isPending ? "wait" : "pointer",
              fontFamily: "'Inter', sans-serif", marginTop: 6,
              boxShadow: `0 4px 24px rgba(99,102,241,0.4)`,
              transition: "all 0.2s", opacity: isPending ? 0.8 : 1,
            }}
              onMouseEnter={e => { if (!isPending) e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
            >
              {isPending ? "⏳ Signing in..." : "Sign In"}
            </button>
          </form>
        </div>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: MUTED }}>
          Don't have an account?{" "}
          <Link href="/register" style={{ color: ACCENT2, textDecoration: "none", fontWeight: 600 }}>Register now</Link>
        </div>

        <div style={{ textAlign: "center", marginTop: 12 }}>
          <a href="/" style={{ fontSize: 13, color: MUTED, textDecoration: "none" }}
            onMouseEnter={e => e.currentTarget.style.color = TEXT}
            onMouseLeave={e => e.currentTarget.style.color = MUTED}
          >← Back to home</a>
        </div>
      </div>
    </div>
  );
}
