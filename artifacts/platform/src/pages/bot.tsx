import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle, XCircle, Bot, RefreshCw, Eye, EyeOff, Trash2,
  Copy, ExternalLink, BookOpen, Zap, Layers, Hash, ImageIcon, MessageSquare,
  ChevronRight, Info, AlertCircle
} from "lucide-react";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

interface BotStatus {
  connected: boolean;
  hasToken: boolean;
  botUsername: string | null;
  tokenSource: "env" | "db" | "none";
  tokenMasked: string | null;
}

// ── Helper: Code Block ────────────────────────────────────────────────────────
function CodeBlock({ children, className }: { children: string; className?: string }) {
  const { toast } = useToast();
  return (
    <div className={cn("relative group bg-muted rounded-lg p-4 font-mono text-sm whitespace-pre-wrap text-foreground border border-border/50", className)}>
      {children}
      <button
        onClick={() => {
          navigator.clipboard.writeText(children);
          toast({ title: "Copied ✓" });
        }}
        className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md bg-background border border-border shadow-sm hover:bg-muted"
        title="Copy"
      >
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}

// ── Helper: Section Step ──────────────────────────────────────────────────────
function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shadow-sm">
        {number}
      </div>
      <div className="flex-1 space-y-2">
        <h4 className="font-semibold text-foreground text-sm">{title}</h4>
        <div className="text-sm text-muted-foreground space-y-2">{children}</div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function TelegramBot() {
  const { toast } = useToast();
  const { data: user } = useGetMe({
    query: {
      enabled: !!localStorage.getItem("pro_token"),
      queryKey: getGetMeQueryKey(),
      staleTime: 0,
      refetchOnWindowFocus: true,
    }
  });
  const isAdmin = user?.isAdmin;

  const [status, setStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const stored_token = localStorage.getItem("pro_token");

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/settings/telegram", {
        headers: { Authorization: `Bearer ${stored_token}` },
      });
      if (r.ok) setStatus(await r.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleSave = async () => {
    if (!token.trim()) return;
    setSaving(true);
    try {
      const r = await fetch("/api/settings/telegram", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${stored_token}` },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await r.json();
      if (r.ok) {
        toast({ title: "Bot connected ✓", description: `Bot: @${data.botUsername}` });
        setToken("");
        fetchStatus();
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Connection error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm("Remove bot connection?")) return;
    setRemoving(true);
    try {
      const r = await fetch("/api/settings/telegram", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${stored_token}` },
      });
      if (r.ok) { toast({ title: "Bot disconnected" }); fetchStatus(); }
    } finally {
      setRemoving(false);
    }
  };

  const botUsername = status?.botUsername;
  const botConnected = status?.connected;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" dir="ltr">

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2.5 rounded-xl border border-primary/20">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Telegram Bot</h1>
            <p className="text-muted-foreground text-sm">Create news cards directly from Telegram</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStatus} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          Refresh Status
        </Button>
      </div>

      {/* ── Status Card ───────────────────────────────────────────────────────── */}
      <Card className={cn("border-2 transition-colors", botConnected ? "border-green-500/30 bg-green-500/5" : "border-border")}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            {loading ? (
              <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            ) : botConnected ? (
              <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
            ) : (
              <XCircle className="h-6 w-6 text-red-500 flex-shrink-0" />
            )}
            <div className="flex-1">
              <div className="font-semibold text-sm">
                {loading ? "Checking..." : botConnected ? `Connected — @${botUsername}` : "Bot not connected"}
              </div>
              {!loading && status && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {status.tokenSource === "env" && "Token set from server environment"}
                  {status.tokenSource === "db" && `Token saved: ${status.tokenMasked}`}
                  {status.tokenSource === "none" && "No bot connected — contact admin to set it up"}
                </div>
              )}
            </div>
            {botConnected && botUsername && (
              <a
                href={`https://t.me/${botUsername}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                Open Bot
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Admin: Manage Bot Token ────────────────────────────────────────────── */}
      {isAdmin && status?.tokenSource !== "env" && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-600">Admin only</Badge>
              Connect / Manage Bot
            </CardTitle>
            <CardDescription>
              Create a new bot from{" "}
              <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-primary underline font-medium">
                @BotFather
              </a>{" "}
              then paste the token here to activate it for all users
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="bot-token">Bot Token</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="bot-token"
                    type={showToken ? "text" : "password"}
                    value={token}
                    onChange={e => setToken(e.target.value)}
                    placeholder="123456789:ABCdefGhi..."
                    className="text-left pr-10 font-mono text-sm"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button onClick={handleSave} disabled={saving || !token.trim()}>
                  {saving ? "Connecting..." : "Connect Bot"}
                </Button>
              </div>
            </div>
            {status?.tokenSource === "db" && (
              <Button variant="outline" size="sm" onClick={handleRemove} disabled={removing} className="text-red-500 border-red-200 hover:bg-red-50">
                <Trash2 className="h-4 w-4 mr-2" />
                {removing ? "Removing..." : "Disconnect"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Personal botCode (non-admin premium users) ─────────────────────────── */}
      {!isAdmin && botConnected && user?.botCode && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Hash className="h-4 w-4 text-primary" />
              Your Personal Code
            </CardTitle>
            <CardDescription>
              Send this code to the bot after typing <code className="font-mono bg-muted px-1 rounded text-xs">/start</code> to link your account once — the bot will recognize you automatically in every message with this code
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 bg-background rounded-xl border border-border p-4">
              <span className="font-mono text-3xl font-bold tracking-widest text-primary select-all">{user.botCode}</span>
              <Button
                variant="ghost"
                size="sm"
                className="mr-auto"
                onClick={() => {
                  navigator.clipboard.writeText(user.botCode!);
                  toast({ title: "Code copied ✓" });
                }}
              >
                <Copy className="h-4 w-4 ml-1" />
                Copy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Quick Start ───────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Quick Start — 3 Easy Steps
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Step number={1} title="Start a conversation with the bot">
            {botConnected && botUsername ? (
              <a
                href={`https://t.me/${botUsername}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-primary font-medium hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {`@${botUsername}`}
              </a>
            ) : (
              <span className="text-amber-600 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                Bot not connected — contact admin
              </span>
            )}
          </Step>

          <Step number={2} title="Send your code to link your account">
            <p>Send the command <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">/start</code> then send your personal code shown above</p>
          </Step>

          <Step number={3} title="Send a message to create a card">
            <p>Basic format:</p>
            <CodeBlock>{`template: breaking
title: Trump Announces New Tariffs
account: ${user?.botCode ?? "NB-XXXX"}`}</CodeBlock>
            <p className="text-xs mt-1 flex items-center gap-1">
              <Info className="h-3 w-3" />
              Then send a background image, or type <code className="font-mono bg-muted px-1 rounded">/skip</code> to generate without an image
            </p>
          </Step>
        </CardContent>
      </Card>

      {/* ── Format Reference ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Message Format — Available Fields
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-xs text-muted-foreground">
                  <th className="text-left pb-2 pl-3">Field</th>
                  <th className="text-left pb-2 pl-3">Description</th>
                  <th className="text-left pb-2">Example</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {[
                  ["template", "Template name or number (required, default: classic)", "template: breaking"],
                  ["title", "Main headline text (required)", "title: Breaking news..."],
                  ["account", "Your Personal Code (required)", `account: ${user?.botCode ?? "NB-XXXX"}`],
                  ["ratio", "Aspect ratio (optional, default: 1:1)", "ratio: 16:9"],
                  ["label", "Small text / source (optional)", "label: CNN"],
                ].map(([field, desc, ex]) => (
                  <tr key={field} className="text-xs">
                    <td className="py-2 pr-3 font-mono text-primary font-semibold">{field}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{desc}</td>
                    <td className="py-2 font-mono text-foreground/70">{ex}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-2">
            <div className="bg-muted/50 rounded-lg p-2">
              <span className="font-medium text-foreground block mb-1">Aspect Ratios</span>
              <div className="space-y-0.5">
                <div>• <code className="font-mono">1:1</code> — Square (default)</div>
                <div>• <code className="font-mono">16:9</code> — Landscape / Thumbnail</div>
                <div>• <code className="font-mono">4:5</code> — Portrait</div>
                <div>• <code className="font-mono">9:16</code> — Story</div>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-2">
              <span className="font-medium text-foreground block mb-1">Bot Commands</span>
              <div className="space-y-0.5">
                <div>• <code className="font-mono">/start</code> — Welcome & help</div>
                <div>• <code className="font-mono">/templates</code> — Templates list</div>
                <div>• <code className="font-mono">/skip</code> — Generate without image</div>
                <div>• <code className="font-mono">/help</code> — Full guide</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Built-in Templates ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Built-in Templates
          </CardTitle>
          <CardDescription>Use the template name (English or Arabic), built-in number, or custom API template name/ID</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              { ar: "Classic", en: "classic-blue", num: "1", color: "bg-blue-500" },
              { ar: "Breaking", en: "breaking-red", num: "2", color: "bg-red-500" },
              { ar: "Modern", en: "modern-black", num: "3", color: "bg-gray-800" },
              { ar: "Emerald", en: "emerald", num: "4", color: "bg-emerald-500" },
              { ar: "Royal", en: "royal-purple", num: "5", color: "bg-purple-600" },
              { ar: "Gold", en: "gold", num: "6", color: "bg-yellow-500" },
              { ar: "Midnight", en: "midnight", num: "7", color: "bg-slate-800" },
              { ar: "Gradient", en: "slate-fade", num: "8", color: "bg-slate-500" },
              { ar: "White", en: "white-quote", num: "9", color: "bg-white border border-gray-200" },
              { ar: "Wave", en: "purple-wave", num: "10", color: "bg-violet-500" },
              { ar: "Crimson", en: "crimson", num: "11", color: "bg-rose-700" },
            ].map(t => (
              <div key={t.en} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${t.color}`} />
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">{t.ar}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{t.num}  •  {t.en}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Custom (Saved Designs) Templates ─────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Saved Templates (Your Designs)
          </CardTitle>
          <CardDescription>
            Save any design from the "Create Card" page then use its name directly in the bot — applies all your settings automatically (color, font, logo, alignment...)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
              <ChevronRight className="h-3.5 w-3.5" />
              Save Steps
            </div>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground pr-4">
              <li>Go to <strong className="text-foreground">Create Card</strong> and customize the design</li>
              <li>Click <strong className="text-foreground">Save Design</strong> and give it a unique name (e.g., <code className="font-mono bg-muted px-1 rounded text-xs">breaking-cnn</code>)</li>
              <li>Use this name directly in the bot:</li>
            </ol>
          </div>
          <CodeBlock>{`template: breaking-cnn
title: Breaking News Now
account: ${user?.botCode ?? "NB-XXXX"}`}</CodeBlock>
          <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-300">
            <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <div>The bot automatically searches your saved templates, then API templates, then built-in templates — just send the correct name.</div>
          </div>
        </CardContent>
      </Card>

      {/* ── API Templates ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            API Templates (Admin Public Templates)
          </CardTitle>
          <CardDescription>
            Templates created by the admin from the control panel, available to all users via the bot — with a slug like <code className="font-mono text-xs">berrechid-breaking</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <CodeBlock>{`template: berrechid-breaking
title: News Headline
ratio: 16:9
account: ${user?.botCode ?? "NB-XXXX"}`}</CodeBlock>
          </div>
          <div className="flex items-start gap-2 bg-muted rounded-lg p-3 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <div>The bot automatically applies all API template settings: colors, logo, font, watermark, overlay frame...</div>
          </div>
        </CardContent>
      </Card>

      {/* ── Sending with Photo ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" />
            Send Card with Background Image
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Method 1: Message then Image</p>
              <CodeBlock>{`template: breaking
title: News headline
account: ${user?.botCode ?? "NB-XXXX"}`}</CodeBlock>
              <p className="text-xs text-muted-foreground">← Send the image in the next message</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Method 2: Image with direct caption</p>
              <CodeBlock>{`template: royal
title: News headline
ratio: 16:9
account: ${user?.botCode ?? "NB-XXXX"}`}</CodeBlock>
              <p className="text-xs text-muted-foreground">← Write the caption under the image when sending</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Examples Gallery ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ready-to-Copy Examples</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            {
              label: "Breaking Square",
              code: `template: breaking\ntitle: Trump raises tariffs to 145% on China\naccount: ${user?.botCode ?? "NB-XXXX"}`,
            },
            {
              label: "Horizontal with Source",
              code: `template: classic\ntitle: PM Announces 2025 Budget\nratio: 16:9\nlabel: News Agency\naccount: ${user?.botCode ?? "NB-XXXX"}`,
            },
            {
              label: "Saved Custom Template",
              code: `template: my-breaking-template\ntitle: Breaking News Headline\naccount: ${user?.botCode ?? "NB-XXXX"}`,
            },
          ].map(ex => (
            <div key={ex.label} className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{ex.label}</p>
              <CodeBlock>{ex.code}</CodeBlock>
            </div>
          ))}
        </CardContent>
      </Card>

    </div>
  );
}
