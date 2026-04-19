import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Settings, User, CreditCard, Key, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { user } = useAuth();

  const plan = user?.plan || "free";
  const limits: Record<string, unknown> = {};

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

        {/* Plan */}
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Plan & Usage</h2>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-foreground capitalize">{plan}</span>
                <Badge variant="outline" className="capitalize">{plan}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{user?.credits ?? 0} credits available</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Cards / Day", value: limits.cardsPerDay, used: user?.imagesToday },
              { label: "Templates", value: limits.maxTemplates },
              { label: "Sites", value: limits.maxSites },
              { label: "Articles / Month", value: limits.articlesPerMonth, used: user?.articlesThisMonth },
            ].map(({ label, value, used }) => (
              <div key={label} className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">
                  {used !== undefined ? `${used} / ` : ""}{value != null ? String(value) : "—"}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-1.5">
            {[
              { label: "Image Generator", on: limits.hasImageGenerator },
              { label: "Blog Automation", on: limits.hasBlogAutomation },
              { label: "Telegram Bot", on: limits.hasTelegramBot },
              { label: "API Access", on: limits.apiAccess },
              { label: "Overlay Upload", on: limits.overlayUpload },
            ].map(({ label, on }) => (
              <div key={label} className="flex items-center gap-2">
                <Check className={cn("w-3.5 h-3.5", on ? "text-emerald-500" : "text-muted-foreground/30")} />
                <span className={cn("text-xs", on ? "text-foreground" : "text-muted-foreground/50")}>{label}</span>
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
