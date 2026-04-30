import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Settings, User, CreditCard, Key, Check, X, Zap, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { user } = useAuth();

  const plan = user?.plan || "free";
  const pd = user?.planDetails;
  const cr = user?.credits;

  const monthly  = cr?.monthly  ?? 0;
  const purchased = cr?.purchased ?? 0;
  const total    = cr?.total    ?? 0;
  const dailyUsage = cr?.daily_usage ?? 0;
  const dailyLimit = cr?.daily_limit ?? 0;

  return (
    <AppLayout title="Settings">
      <div className="max-w-xl space-y-5">

        {/* Account */}
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Account</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-border">
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="text-sm font-medium text-foreground mt-0.5">{user?.name}</p>
              </div>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium text-foreground mt-0.5">{user?.email}</p>
              </div>
              <Badge variant={user?.emailVerified ? "default" : "secondary"} className="text-xs">
                {user?.emailVerified ? "Verified" : "Unverified"}
              </Badge>
            </div>
            {user?.phone && (
              <div className="py-2">
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="text-sm font-medium text-foreground mt-0.5">{user.phone}</p>
              </div>
            )}
          </div>
        </div>

        {/* Plan & Credits */}
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Plan & Credits</h2>
          </div>

          {/* Plan name */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base font-bold text-foreground capitalize">{plan}</span>
            <Badge variant="outline" className="capitalize">{plan}</Badge>
          </div>

          {/* Credits grid */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-muted/40 rounded-lg p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Zap className="w-3 h-3" /> Monthly
              </p>
              <p className="text-sm font-bold text-foreground mt-1">{monthly} cr</p>
            </div>
            <div className="bg-muted/40 rounded-lg p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Purchased
              </p>
              <p className="text-sm font-bold text-violet-400 mt-1">{purchased} cr</p>
            </div>
            <div className="bg-muted/40 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-sm font-bold text-foreground mt-1">{total} cr</p>
            </div>
          </div>

          {/* Daily usage */}
          <div className="bg-muted/40 rounded-lg p-3 mb-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Daily Usage</span>
              <span>{dailyUsage} / {dailyLimit}</span>
            </div>
            {dailyLimit > 0 && (
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${Math.min(100, Math.round((dailyUsage / dailyLimit) * 100))}%` }}
                />
              </div>
            )}
          </div>

          {/* Plan limits */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: "Daily Limit", value: pd?.rate_limit_daily != null ? pd.rate_limit_daily : "—" },
              { label: "Max Templates", value: pd?.max_templates != null ? (pd.max_templates <= 0 ? "—" : pd.max_templates) : "—" },
              { label: "Max Sites", value: pd?.max_sites != null ? (pd.max_sites <= 0 ? "—" : pd.max_sites) : "—" },
              { label: "Monthly Credits", value: pd?.monthly_credits != null ? pd.monthly_credits : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">{String(value)}</p>
              </div>
            ))}
          </div>

          {/* Feature flags */}
          <div className="space-y-1.5">
            {[
              { label: "Image Generator",  on: pd?.has_image_generator },
              { label: "Blog Automation",  on: pd?.has_blog_automation },
              { label: "Telegram Bot",     on: pd?.has_telegram_bot },
              { label: "API Access",       on: pd?.has_api_access },
              { label: "Overlay Upload",   on: pd?.has_overlay_upload },
              { label: "Custom Watermark", on: pd?.has_custom_watermark },
            ].map(({ label, on }) => (
              <div key={label} className="flex items-center gap-2">
                {on
                  ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                  : <X className="w-3.5 h-3.5 text-muted-foreground/30" />}
                <span className={cn("text-xs", on ? "text-foreground" : "text-muted-foreground/50")}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* API Key */}
        {user?.apiKey && (
          <div className="bg-card border border-card-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Key className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">API Key</h2>
            </div>
            <div className="bg-muted rounded-lg px-3 py-2.5">
              <code className="text-xs font-mono text-muted-foreground" data-testid="text-settings-api-key">{user.apiKey}</code>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Keep this key secret. It grants full API access to your account.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
