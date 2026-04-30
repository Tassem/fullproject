import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRegister } from "@workspace/api-client-react";
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

const registerSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(7, "Invalid phone number").optional().or(z.literal("")),
  password: z.string().min(6, "At least 6 characters"),
});

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { mutate: registerMutate, isPending } = useRegister();
  const authCtx = useContext(AuthContext);

  const { register: reg, handleSubmit, formState: { errors } } = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", phone: "", password: "" },
  });

  function onSuccess(data: any) {
    if (authCtx) {
      authCtx.login(data.token, data.user, data.refreshToken);
    } else {
      localStorage.setItem("pro_token", data.token);
      if (data.refreshToken) localStorage.setItem("pro_refresh_token", data.refreshToken);
    }
    toast({
      title: "Account created",
      description: data.user?.emailVerified
        ? "Welcome to NewsCard Pro"
        : "Welcome! Check your email to verify your account.",
    });
    setLocation("/dashboard");
  }

  function onSubmit(values: z.infer<typeof registerSchema>) {
    const payload: any = { name: values.name, email: values.email, password: values.password };
    if (values.phone) payload.phone = values.phone;
    registerMutate({ data: payload }, {
      onSuccess,
      onError: (error: any) => {
        toast({ title: "Error", description: error?.data?.error || "Something went wrong", variant: "destructive" });
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
      if (!resp.ok) throw new Error(data.error || "Google sign-up failed");
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
      <div style={{ position: "absolute", top: "10%", right: "20%", width: 500, height: 500, background: "radial-gradient(ellipse, rgba(139,92,246,0.1) 0%, transparent 60%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "10%", left: "10%", width: 400, height: 400, background: "radial-gradient(ellipse, rgba(34,211,238,0.07) 0%, transparent 60%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)", backgroundSize: "28px 28px", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 440, position: "relative" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, margin: "0 auto 16px",
            background: `linear-gradient(135deg, ${ACCENT3}, ${ACCENT})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: 22, color: "#fff",
            boxShadow: `0 0 28px rgba(139,92,246,0.4)`,
          }}>N</div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "#fff", margin: 0, marginBottom: 8, letterSpacing: "-0.5px" }}>Create Account</h1>
          <p style={{ color: MUTED, fontSize: 14, margin: 0 }}>Join now and start generating news cards</p>
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
                  onError={() => toast({ title: "Error", description: "Google sign-up failed", variant: "destructive" })}
                  text="signup_with"
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
              <label style={{ fontSize: 12, color: MUTED, display: "block", marginBottom: 7, fontWeight: 600, letterSpacing: "0.04em" }}>Full Name</label>
              <input
                type="text" placeholder="Your name" dir="ltr"
                style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = ACCENT3}
                {...reg("name")}
              />
              {errors.name && <div style={{ fontSize: 12, color: "#fca5a5", marginTop: 5 }}>{errors.name.message}</div>}
            </div>

            <div>
              <label style={{ fontSize: 12, color: MUTED, display: "block", marginBottom: 7, fontWeight: 600, letterSpacing: "0.04em" }}>Email address</label>
              <input
                type="email" placeholder="name@example.com" dir="ltr"
                style={{ ...inputStyle, fontFamily: "monospace" }}
                onFocus={e => e.currentTarget.style.borderColor = ACCENT3}
                {...reg("email")}
              />
              {errors.email && <div style={{ fontSize: 12, color: "#fca5a5", marginTop: 5 }}>{errors.email.message}</div>}
            </div>

            <div>
              <label style={{ fontSize: 12, color: MUTED, display: "block", marginBottom: 7, fontWeight: 600, letterSpacing: "0.04em" }}>
                Phone <span style={{ color: MUTED, fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                type="tel" placeholder="+1 234 567 8900" dir="ltr"
                style={{ ...inputStyle, fontFamily: "monospace" }}
                onFocus={e => e.currentTarget.style.borderColor = ACCENT3}
                {...reg("phone")}
              />
              {errors.phone && <div style={{ fontSize: 12, color: "#fca5a5", marginTop: 5 }}>{errors.phone.message}</div>}
            </div>

            <div>
              <label style={{ fontSize: 12, color: MUTED, display: "block", marginBottom: 7, fontWeight: 600, letterSpacing: "0.04em" }}>Password</label>
              <input
                type="password" dir="ltr" placeholder="••••••••"
                style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = ACCENT3}
                {...reg("password")}
              />
              {errors.password && <div style={{ fontSize: 12, color: "#fca5a5", marginTop: 5 }}>{errors.password.message}</div>}
            </div>

            <button type="submit" disabled={isPending} style={{
              background: `linear-gradient(135deg, ${ACCENT3}, ${ACCENT})`,
              color: "#fff", border: "none",
              padding: "13px", borderRadius: 10,
              fontSize: 15, fontWeight: 700, cursor: isPending ? "wait" : "pointer",
              fontFamily: "'Inter', sans-serif", marginTop: 6,
              boxShadow: `0 4px 24px rgba(139,92,246,0.4)`,
              transition: "all 0.2s", opacity: isPending ? 0.8 : 1,
            }}
              onMouseEnter={e => { if (!isPending) e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
            >
              {isPending ? "⏳ Creating account..." : "Create Account"}
            </button>

            <div style={{ textAlign: "center", fontSize: 12, color: MUTED }}>
              By signing up, you agree to our Terms of Service and Privacy Policy
            </div>
          </form>
        </div>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: MUTED }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: ACCENT2, textDecoration: "none", fontWeight: 600 }}>Sign In</Link>
        </div>
      </div>
    </div>
  );
}
