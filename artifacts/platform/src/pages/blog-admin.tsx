import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, CreditCard, Layers, ShieldAlert, ShieldCheck,
  Search, ExternalLink, Check, X, MoreVertical, LayoutDashboard,
  Zap, Clock, Globe, FileText, CheckCircle2, ArrowRight,
  Settings, Plus, Trash2, Edit3, Eye, EyeOff, Save,
  MessageCircle, Phone, Mail, Send, RefreshCw, TrendingUp,
  Award, Activity, ToggleLeft, AlertTriangle, Ban,
  Star, Bot, Coins, SlidersHorizontal, Link, Hash,
  Image as ImageIcon, Palette, Rss
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type Tab = "overview" | "users" | "payments" | "plans" | "points" | "images" | "templates" | "bot" | "channels" | "system";

const TABS: { id: Tab; label: string; labelAr: string; icon: React.ElementType; color: string; bg: string }[] = [
  { id: "overview",   label: "Overview",   labelAr: "Overview",   icon: LayoutDashboard, color: "#38bdf8", bg: "rgba(56,189,248,0.12)"   },
  { id: "users",      label: "Users",      labelAr: "Users",  icon: Users,           color: "#a78bfa", bg: "rgba(167,139,250,0.12)"  },
  { id: "payments",   label: "Payments",   labelAr: "Payments",   icon: CreditCard,      color: "#34d399", bg: "rgba(52,211,153,0.12)"   },
  { id: "plans",      label: "Plans",      labelAr: "Plans",     icon: Layers,          color: "#f59e0b", bg: "rgba(245,158,11,0.12)"   },
  { id: "points",     label: "Points",     labelAr: "Points",      icon: Coins,           color: "#fb923c", bg: "rgba(251,146,60,0.12)"   },
  { id: "images",     label: "Images",     labelAr: "Images",       icon: ImageIcon,       color: "#22d3ee", bg: "rgba(34,211,238,0.12)"   },
  { id: "templates",  label: "Templates",  labelAr: "Templates",     icon: Palette,         color: "#f472b6", bg: "rgba(244,114,182,0.12)"  },
  { id: "channels",   label: "Channels",   labelAr: "Channels",     icon: Rss,             color: "#4ade80", bg: "rgba(74,222,128,0.12)"   },
  { id: "bot",        label: "Bot",        labelAr: "Bot",       icon: Bot,             color: "#818cf8", bg: "rgba(129,140,248,0.12)"  },
  { id: "system",     label: "System",     labelAr: "System",      icon: Settings,        color: "#94a3b8", bg: "rgba(148,163,184,0.12)"  },
];

// ─── useAdminSettings hook ───────────────────────────────────────────────────
function useAdminSettings() {
  return useQuery<{ settings: Record<string, string> }>({
    queryKey: ["admin", "settings"],
    queryFn: async () => {
      const r = await fetch("/api/admin/settings", { headers: { "Authorization": `Bearer ${localStorage.getItem("pro_token")}` } });
      if (!r.ok) throw new Error("Failed to fetch settings");
      return r.json();
    },
  });
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab() {
  const { data } = useQuery<{ total_users: number; plan_breakdown: any[]; pending_payments: number }>({
    queryKey: ["admin", "usage"],
    queryFn: async () => {
      const r = await fetch("/api/admin/usage", { headers: { "Authorization": `Bearer ${localStorage.getItem("pro_token")}` } });
      return r.json();
    },
  });

  const stats = [
    { label: "Total Users", value: data?.total_users ?? 0, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
    { label: "Pending Payments", value: data?.pending_payments ?? 0, icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
    { label: "Active Plans", value: data?.plan_breakdown?.length ?? 0, icon: Layers, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  ];

  return (
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
          <Activity className="w-5 h-5 text-orange-500" />
          System Overview
        </h2>
        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-1">Real-time platform metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className={cn("p-6 rounded-2xl border", s.bg)}>
            <div className="flex items-center gap-3 mb-4">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", s.bg)}>
                <s.icon className={cn("w-5 h-5", s.color)} />
              </div>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{s.label}</p>
            </div>
            <p className={cn("text-4xl font-black font-mono", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {data?.plan_breakdown && data.plan_breakdown.length > 0 && (
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
          <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-orange-400" />
            Plan Distribution
          </h3>
          <div className="space-y-3">
            {data.plan_breakdown.map((p) => (
              <div key={p.plan_name} className="flex items-center justify-between">
                <span className="text-xs text-zinc-300 font-bold uppercase tracking-wider">{p.plan_name}</span>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-zinc-500 font-mono">{Number(p.total_articles)} articles</span>
                  <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20">{Number(p.count)} users</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────
function UsersTab() {
  const [search, setSearch] = useState("");
  const [grantDialog, setGrantDialog] = useState<any>(null);
  const [planDialog, setPlanDialog] = useState<any>(null);
  const [grantAmount, setGrantAmount] = useState(50);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [durationDays, setDurationDays] = useState(30);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ users: any[] }>({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const r = await fetch("/api/admin/users", { headers: { "Authorization": `Bearer ${localStorage.getItem("pro_token")}` } });
      return r.json();
    },
  });

  const { data: plansData } = useQuery<{ plans: any[] }>({
    queryKey: ["admin", "plans"],
    queryFn: async () => {
      const r = await fetch("/api/admin/plans", { headers: { "Authorization": `Bearer ${localStorage.getItem("pro_token")}` } });
      return r.json();
    },
  });

  const grantMutation = useMutation({
    mutationFn: async () => {
      await fetch(`/api/admin/users/${grantDialog.id}/grant-points`, {
        method: "POST", headers: { "Authorization": `Bearer ${localStorage.getItem("pro_token")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: grantAmount, description: "Admin grant" }),
      });
    },
    onSuccess: () => {
      toast({ title: "Points Granted", description: `${grantAmount} PT added to ${grantDialog.username}` });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      setGrantDialog(null);
    },
  });

  const planMutation = useMutation({
    mutationFn: async () => {
      await fetch(`/api/admin/users/${planDialog.id}/change-plan`, {
        method: "POST", headers: { "Authorization": `Bearer ${localStorage.getItem("pro_token")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ plan_name: selectedPlan, duration_days: durationDays }),
      });
    },
    onSuccess: () => {
      toast({ title: "Plan Updated", description: `Plan changed to ${selectedPlan}` });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      setPlanDialog(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: number) => {
      await fetch(`/api/admin/users/${userId}`, { method: "DELETE", headers: { "Authorization": `Bearer ${localStorage.getItem("pro_token")}` } });
    },
    onSuccess: () => {
      toast({ title: "User Removed" });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });

  const filtered = (data?.users ?? []).filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const statusColor: Record<string, string> = {
    active: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    trialing: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    null: "text-zinc-600 bg-zinc-800/50 border-white/5",
  };

  if (isLoading) return <div className="p-8 animate-pulse space-y-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-white/5 rounded-2xl" />)}</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            className="pl-10 h-12 bg-white/5 border-white/10 rounded-xl text-xs font-bold"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20 ml-4">
          {filtered.length} users
        </Badge>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="border-white/5 hover:bg-transparent">
            {["User", "Plan", "Usage", "Points", "Status", "Joined", ""].map((h) => (
              <TableHead key={h} className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((u) => (
            <TableRow key={u.id} className="border-white/5 hover:bg-white/[0.02]">
              <TableCell>
                <div>
                  <div className="text-xs font-black text-white uppercase">{u.username}</div>
                  <div className="text-[10px] text-zinc-600 font-mono">{u.role}</div>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-xs text-zinc-300 font-bold">{u.plan}</span>
              </TableCell>
              <TableCell>
                <div className="text-[10px] text-zinc-500 font-mono space-y-0.5">
                  <div>{u.articles_used} articles</div>
                  <div>{u.sites_used} sites</div>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-xs font-black font-mono text-amber-400">{u.points_balance} PT</span>
              </TableCell>
              <TableCell>
                <span className={cn(
                  "px-2 py-1 rounded-full text-[9px] font-black border uppercase tracking-widest",
                  statusColor[u.subscription_status] ?? statusColor["null"]
                )}>
                  {u.subscription_status ?? "none"}
                </span>
              </TableCell>
              <TableCell>
                <span className="text-[10px] text-zinc-600 font-mono">
                  {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                </span>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-zinc-950 border-white/10">
                    <DropdownMenuLabel className="text-[10px] text-zinc-500 uppercase tracking-widest">Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/5" />
                    <DropdownMenuItem onClick={() => { setGrantDialog(u); setGrantAmount(50); }} className="text-amber-400 focus:bg-amber-500/10 focus:text-amber-400">
                      <Zap className="w-3.5 h-3.5 mr-2" /> Grant Points
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setPlanDialog(u); setSelectedPlan(u.plan_name ?? ""); }} className="text-blue-400 focus:bg-blue-500/10 focus:text-blue-400">
                      <Layers className="w-3.5 h-3.5 mr-2" /> Change Plan
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/5" />
                    <DropdownMenuItem
                      onClick={() => { if (confirm(`Delete user ${u.username}?`)) deleteMutation.mutate(u.id); }}
                      className="text-rose-400 focus:bg-rose-500/10 focus:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete User
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Grant Points Dialog */}
      <Dialog open={!!grantDialog} onOpenChange={() => setGrantDialog(null)}>
        <DialogContent className="bg-zinc-950 border-white/10 rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white font-black">Grant Points</DialogTitle>
            <DialogDescription className="text-zinc-500">Add points to {grantDialog?.username}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-zinc-500">Amount (PT)</Label>
              <Input
                type="number" min={1}
                value={grantAmount}
                onChange={(e) => setGrantAmount(parseInt(e.target.value) || 1)}
                className="bg-black border-white/10 h-12 rounded-xl font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setGrantDialog(null)}>Cancel</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-500"
              onClick={() => grantMutation.mutate()}
              disabled={grantMutation.isPending}
            >
              <Zap className="w-4 h-4 mr-2" />
              {grantMutation.isPending ? "Granting..." : `Grant ${grantAmount} PT`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Plan Dialog */}
      <Dialog open={!!planDialog} onOpenChange={() => setPlanDialog(null)}>
        <DialogContent className="bg-zinc-950 border-white/10 rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white font-black">Change Plan</DialogTitle>
            <DialogDescription className="text-zinc-500">Update plan for {planDialog?.username}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-zinc-500">Select Plan</Label>
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger className="bg-black border-white/10 h-12 rounded-xl">
                  <SelectValue placeholder="Choose plan..." />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-white/10">
                  {(plansData?.plans ?? []).map((p) => (
                    <SelectItem key={p.name} value={p.name}>{p.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-zinc-500">Duration (days)</Label>
              <Input
                type="number" min={1} max={365}
                value={durationDays}
                onChange={(e) => setDurationDays(parseInt(e.target.value) || 30)}
                className="bg-black border-white/10 h-12 rounded-xl font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPlanDialog(null)}>Cancel</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-500"
              onClick={() => planMutation.mutate()}
              disabled={planMutation.isPending || !selectedPlan}
            >
              {planMutation.isPending ? "Updating..." : "Update Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Payments Tab ─────────────────────────────────────────────────────────────
function PaymentsTab() {
  const { data: settingsData } = useAdminSettings();
  const settings = settingsData?.settings ?? {};
  const qc = useQueryClient();
  const { toast } = useToast();
  const [paymentConfig, setPaymentConfig] = useState({
    payment_paypal_email: "",
    payment_paypal_link: "",
    payment_bank_name: "",
    payment_bank_holder: "",
    payment_bank_iban: "",
    payment_bank_swift: "",
  });
  const [configLoaded, setConfigLoaded] = useState(false);
  const [activeSection, setActiveSection] = useState<"queue" | "config">("queue");

  useEffect(() => {
    if (settingsData && !configLoaded) {
      setPaymentConfig({
        payment_paypal_email: settings.payment_paypal_email || "",
        payment_paypal_link: settings.payment_paypal_link || "",
        payment_bank_name: settings.payment_bank_name || "",
        payment_bank_holder: settings.payment_bank_holder || "",
        payment_bank_iban: settings.payment_bank_iban || "",
        payment_bank_swift: settings.payment_bank_swift || "",
      });
      setConfigLoaded(true);
    }
  }, [settingsData, configLoaded]);

  const { data, isLoading } = useQuery<{ requests: any[] }>({
    queryKey: ["admin", "payments"],
    queryFn: async () => {
      const r = await fetch("/api/admin/payments", { headers: { "Authorization": `Bearer ${localStorage.getItem("pro_token")}` } });
      return r.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/admin/payments/${id}/approve`, {
        method: "POST", headers: { "Authorization": `Bearer ${localStorage.getItem("pro_token")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Approved" }),
      });
      if (!r.ok) throw new Error("Approval failed");
    },
    onSuccess: () => {
      toast({ title: "Payment Approved" });
      qc.invalidateQueries({ queryKey: ["admin", "payments"] });
    },
  });

  const denyMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/admin/payments/${id}/deny`, {
        method: "POST", headers: { "Authorization": `Bearer ${localStorage.getItem("pro_token")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Denied by admin" }),
      });
      if (!r.ok) throw new Error("Denial failed");
    },
    onSuccess: () => {
      toast({ title: "Payment Denied" });
      qc.invalidateQueries({ queryKey: ["admin", "payments"] });
    },
  });

  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/admin/settings", {
        method: "PUT", headers: { "Authorization": `Bearer ${localStorage.getItem("pro_token")}`, "Content-Type": "application/json" },
        body: JSON.stringify(paymentConfig),
      });
      if (!r.ok) throw new Error("Failed to save");
    },
    onSuccess: () => {
      toast({ title: "Payment Config Saved" });
      qc.invalidateQueries({ queryKey: ["admin", "settings"] });
    },
  });

  const pending = (data?.requests ?? []).filter((r) => r.request.status === "pending");
  const processed = (data?.requests ?? []).filter((r) => r.request.status !== "pending");

  return (
    <div className="p-8 space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-2">
        {[{ id: "queue", label: `Queue (${pending.length})`, icon: Clock }, { id: "config", label: "Payment Info", icon: Settings }].map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id as any)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              activeSection === s.id ? "bg-indigo-600 text-white" : "bg-white/5 text-zinc-500 hover:text-zinc-300"
            )}
          >
            <s.icon className="w-3.5 h-3.5" />
            {s.label}
          </button>
        ))}
      </div>

      {activeSection === "queue" && (
        <div className="space-y-4">
          <h2 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-indigo-400" />
            Verification Queue
            {pending.length > 0 && (
              <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">{pending.length} pending</Badge>
            )}
          </h2>

          {isLoading && <div className="animate-pulse h-32 bg-white/5 rounded-2xl" />}

          {pending.length === 0 && !isLoading && (
            <div className="p-16 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500/20 mx-auto mb-4" />
              <p className="text-[10px] font-black text-zinc-700 uppercase tracking-widest">Queue Clear — No pending approvals</p>
            </div>
          )}

          <div className="space-y-3">
            {pending.map((req) => (
              <div key={req.request.id} className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/20 transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-4 items-start">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                      {req.request.type === "plan_upgrade" ? <Layers className="w-6 h-6" /> : <Zap className="w-6 h-6" />}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white">{req.username}</span>
                        <ArrowRight className="w-3 h-3 text-zinc-600" />
                        <span className="text-xs text-indigo-400 font-bold">
                          {req.plan_name || `${req.request.points_amount} Points`}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-3">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(req.request.created_at).toLocaleString()}</span>
                        <span className="flex items-center gap-1 text-amber-500"><AlertTriangle className="w-3 h-3" /> ID: {req.request.proof_details?.slice(0, 24)}</span>
                      </div>
                      {/* Proof image if URL */}
                      {req.request.proof_details?.startsWith("http") && (
                        <a href={req.request.proof_details} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] text-blue-400 flex items-center gap-1 mt-1 hover:underline">
                          <ExternalLink className="w-3 h-3" /> View Proof Screenshot
                        </a>
                      )}
                      {!req.request.proof_details?.startsWith("http") && req.request.proof_details && (
                        <p className="text-[10px] text-zinc-600 italic mt-1">"{req.request.proof_details}"</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => denyMutation.mutate(req.request.id)}
                      disabled={denyMutation.isPending}
                      className="rounded-xl text-rose-400 hover:bg-rose-500/10"
                    >
                      <X className="w-4 h-4 mr-1" /> Deny
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => approveMutation.mutate(req.request.id)}
                      disabled={approveMutation.isPending}
                      className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white"
                    >
                      <Check className="w-4 h-4 mr-1" /> Approve
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {processed.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-[10px] font-black text-zinc-600 uppercase tracking-widest hover:text-zinc-400">
                {processed.length} Processed Requests
              </summary>
              <div className="mt-3 space-y-2">
                {processed.map((req) => (
                  <div key={req.request.id} className="p-4 rounded-xl bg-white/[0.01] border border-white/[0.03] flex items-center justify-between">
                    <span className="text-xs text-zinc-500">{req.username} — {req.plan_name || `${req.request.points_amount} PT`}</span>
                    <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-full border uppercase",
                      req.request.status === "approved" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-rose-400 bg-rose-500/10 border-rose-500/20"
                    )}>
                      {req.request.status}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {activeSection === "config" && (
        <div className="space-y-6">
          <h2 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
            <Settings className="w-4 h-4 text-zinc-400" />
            Payment Configuration
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* PayPal */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
              <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-black">PP</div>
                PayPal Settings
              </h3>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-zinc-500">PayPal Email</Label>
                  <Input
                    value={paymentConfig.payment_paypal_email}
                    onChange={(e) => setPaymentConfig({ ...paymentConfig, payment_paypal_email: e.target.value })}
                    placeholder="payments@yourbusiness.com"
                    className="bg-black border-white/10 h-11 rounded-xl text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-zinc-500">PayPal.me Link</Label>
                  <Input
                    value={paymentConfig.payment_paypal_link}
                    onChange={(e) => setPaymentConfig({ ...paymentConfig, payment_paypal_link: e.target.value })}
                    placeholder="https://paypal.me/yourbusiness"
                    className="bg-black border-white/10 h-11 rounded-xl text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Bank Transfer */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
              <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-black">BT</div>
                Bank Transfer
              </h3>
              <div className="space-y-3">
                {[
                  { key: "payment_bank_name", label: "Bank Name", placeholder: "International Business Bank" },
                  { key: "payment_bank_holder", label: "Account Holder", placeholder: "Your Company Ltd" },
                  { key: "payment_bank_iban", label: "IBAN", placeholder: "MA64 0011 0000 0000 0123 4567 890" },
                  { key: "payment_bank_swift", label: "SWIFT / BIC", placeholder: "BMCEMAMC" },
                ].map((f) => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-zinc-500">{f.label}</Label>
                    <Input
                      value={(paymentConfig as any)[f.key]}
                      onChange={(e) => setPaymentConfig({ ...paymentConfig, [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                      className="bg-black border-white/10 h-11 rounded-xl text-sm font-mono"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Button
            onClick={() => saveConfigMutation.mutate()}
            disabled={saveConfigMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-500 h-12 px-8 rounded-xl font-black"
          >
            <Save className="w-4 h-4 mr-2" />
            {saveConfigMutation.isPending ? "Saving..." : "Save Payment Config"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Plans Tab ────────────────────────────────────────────────────────────────
const EMPTY_PLAN = {
  name: "", display_name: "", description: "",
  price_monthly: 0, price_yearly: 0,
  cards_per_day: 5, max_templates: 3, max_saved_designs: 5,
  max_sites: 1, max_articles_per_month: 0,
  has_blog_automation: false, has_image_generator: true,
  api_access: false, telegram_bot: false,
  overlay_upload: false, custom_watermark: false,
  credits: 10, sort_order: 0, is_active: true,
};

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/5">
      <span className="text-[10px] font-black uppercase text-zinc-400">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn("w-9 h-5 rounded-full transition-colors relative shrink-0", checked ? "bg-orange-500" : "bg-white/10")}
      >
        <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", checked ? "translate-x-4" : "translate-x-0.5")} />
      </button>
    </div>
  );
}

function PlanFormFields({ plan, onChange }: { plan: any; onChange: (p: any) => void }) {
  const num = (key: string, val: string) => onChange({ ...plan, [key]: parseInt(val) || 0 });
  const str = (key: string, val: string) => onChange({ ...plan, [key]: val });
  const tog = (key: string, val: boolean) => onChange({ ...plan, [key]: val });

  return (
    <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
      {/* Identity */}
      <div>
        <p className="text-[9px] font-black uppercase text-zinc-600 mb-2 tracking-widest">Identity</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase text-zinc-500">System ID (slug)</Label>
            <Input value={plan.name ?? ""} onChange={e => str("name", e.target.value)}
              placeholder="pro" className="bg-black border-white/10 h-10 rounded-xl text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase text-zinc-500">Display Name</Label>
            <Input value={plan.display_name ?? ""} onChange={e => str("display_name", e.target.value)}
              placeholder="Pro Plan" className="bg-black border-white/10 h-10 rounded-xl text-sm" />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-[10px] font-black uppercase text-zinc-500">Description</Label>
            <Input value={plan.description ?? ""} onChange={e => str("description", e.target.value)}
              placeholder="Best for professionals" className="bg-black border-white/10 h-10 rounded-xl text-sm" />
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div>
        <p className="text-[9px] font-black uppercase text-zinc-600 mb-2 tracking-widest">Pricing</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase text-zinc-500">/month</Label>
            <Input type="number" value={plan.price_monthly ?? 0} onChange={e => num("price_monthly", e.target.value)}
              className="bg-black border-white/10 h-10 rounded-xl text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase text-zinc-500">/year</Label>
            <Input type="number" value={plan.price_yearly ?? 0} onChange={e => num("price_yearly", e.target.value)}
              className="bg-black border-white/10 h-10 rounded-xl text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase text-zinc-500">Credits</Label>
            <Input type="number" value={plan.credits ?? 0} onChange={e => num("credits", e.target.value)}
              className="bg-black border-white/10 h-10 rounded-xl text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase text-zinc-500">Sort Order</Label>
            <Input type="number" value={plan.sort_order ?? 0} onChange={e => num("sort_order", e.target.value)}
              className="bg-black border-white/10 h-10 rounded-xl text-sm" />
          </div>
        </div>
      </div>

      {/* Image Design limits */}
      <div>
        <p className="text-[9px] font-black uppercase text-zinc-600 mb-2 tracking-widest">🗞 Image Design</p>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase text-zinc-500">Cards/day</Label>
            <Input type="number" value={plan.cards_per_day ?? 5} onChange={e => num("cards_per_day", e.target.value)}
              className="bg-black border-white/10 h-10 rounded-xl text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase text-zinc-500">Templates</Label>
            <Input type="number" value={plan.max_templates ?? 3} onChange={e => num("max_templates", e.target.value)}
              className="bg-black border-white/10 h-10 rounded-xl text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase text-zinc-500">Saved Designs</Label>
            <Input type="number" value={plan.max_saved_designs ?? 5} onChange={e => num("max_saved_designs", e.target.value)}
              className="bg-black border-white/10 h-10 rounded-xl text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ToggleField label="Image Generator" checked={plan.has_image_generator ?? true} onChange={v => tog("has_image_generator", v)} />
          <ToggleField label="Custom Watermark" checked={plan.custom_watermark ?? false} onChange={v => tog("custom_watermark", v)} />
          <ToggleField label="Overlay Upload" checked={plan.overlay_upload ?? false} onChange={v => tog("overlay_upload", v)} />
        </div>
      </div>

      {/* Blog Automation limits */}
      <div>
        <p className="text-[9px] font-black uppercase text-zinc-600 mb-2 tracking-widest">📡 Blog Automation</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase text-zinc-500">Articles/month (0=∞)</Label>
            <Input type="number" value={plan.max_articles_per_month ?? 0} onChange={e => num("max_articles_per_month", e.target.value)}
              className="bg-black border-white/10 h-10 rounded-xl text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase text-zinc-500">WordPress Sites (0=∞)</Label>
            <Input type="number" value={plan.max_sites ?? 1} onChange={e => num("max_sites", e.target.value)}
              className="bg-black border-white/10 h-10 rounded-xl text-sm" />
          </div>
        </div>
        <ToggleField label="Blog Automation" checked={plan.has_blog_automation ?? false} onChange={v => tog("has_blog_automation", v)} />
      </div>

      {/* General flags */}
      <div>
        <p className="text-[9px] font-black uppercase text-zinc-600 mb-2 tracking-widest">⚙️ General</p>
        <div className="grid grid-cols-2 gap-2">
          <ToggleField label="API Access" checked={plan.api_access ?? false} onChange={v => tog("api_access", v)} />
          <ToggleField label="Telegram Bot" checked={plan.telegram_bot ?? false} onChange={v => tog("telegram_bot", v)} />
          <ToggleField label="Plan is Active" checked={plan.is_active ?? true} onChange={v => tog("is_active", v)} />
        </div>
      </div>
    </div>
  );
}

function PlansTab() {
  const [showCreate, setShowCreate] = useState(false);
  const [editPlan, setEditPlan] = useState<any>(null);
  const [newPlan, setNewPlan] = useState<any>({ ...EMPTY_PLAN });
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ plans: any[] }>({
    queryKey: ["admin", "plans"],
    queryFn: async () => {
      const r = await fetch("/api/admin/plans", { headers: { "Authorization": `Bearer ${localStorage.getItem("pro_token")}` } });
      return r.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/admin/plans", {
        method: "POST", headers: { "Authorization": `Bearer ${localStorage.getItem("pro_token")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...newPlan, features: [] }),
      });
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      toast({ title: "Plan Created" });
      qc.invalidateQueries({ queryKey: ["admin", "plans"] });
      setShowCreate(false);
      setNewPlan({ ...EMPTY_PLAN });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (plan: any) => {
      const r = await fetch(`/api/admin/plans/${plan.id}`, {
        method: "PUT", headers: { "Authorization": `Bearer ${localStorage.getItem("pro_token")}`, "Content-Type": "application/json" },
        body: JSON.stringify(plan),
      });
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      toast({ title: "Plan Updated" });
      qc.invalidateQueries({ queryKey: ["admin", "plans"] });
      setEditPlan(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: number; is_active: boolean }) => {
      await fetch(`/api/admin/plans/${id}`, {
        method: "PUT", headers: { "Authorization": `Bearer ${localStorage.getItem("pro_token")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ is_active }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "plans"] }),
  });

  if (isLoading) return <div className="p-8 animate-pulse h-48 bg-white/5 rounded-2xl" />;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
          <Layers className="w-5 h-5 text-orange-500" />
          Strategic Tiers
          <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20">{data?.plans?.length ?? 0} active</Badge>
        </h2>
        <Button onClick={() => setShowCreate(true)} className="rounded-xl h-11 px-6 bg-orange-600 hover:bg-orange-500 text-white font-black text-xs uppercase">
          <Plus className="w-4 h-4 mr-2" /> Add Plan
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {(data?.plans ?? []).map((plan) => (
          <div key={plan.id} className={cn(
            "p-5 rounded-2xl border transition-all",
            plan.is_active ? "bg-white/[0.02] border-white/5 hover:border-orange-500/20" : "bg-black/20 border-white/[0.03] opacity-60"
          )}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-white uppercase">{plan.display_name}</h3>
                  {!plan.is_active && <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold">INACTIVE</span>}
                </div>
                <p className="text-[10px] text-zinc-600 font-mono mt-0.5">{plan.name}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="w-8 h-8 text-zinc-600 hover:text-blue-400"
                  onClick={() => setEditPlan({ ...plan })}>
                  <Edit3 className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="w-8 h-8 text-zinc-600 hover:text-amber-400"
                  onClick={() => toggleMutation.mutate({ id: plan.id, is_active: !plan.is_active })}>
                  {plan.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-xl font-black text-orange-400">{plan.price_monthly === 0 ? "Free" : `${plan.price_monthly}`}</span>
              {plan.price_monthly > 0 && <span className="text-[10px] text-zinc-600">/mo</span>}
              {plan.price_yearly > 0 && <span className="text-[10px] text-zinc-600 mr-2">· {plan.price_yearly} /yr</span>}
            </div>

            {/* Image design stats */}
            <div className="mb-2">
              <p className="text-[9px] font-black text-zinc-600 uppercase mb-1">🗞 Image Design</p>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: "Cards/day", value: plan.cards_per_day },
                  { label: "Templates", value: plan.max_templates },
                  { label: "Designs", value: plan.max_saved_designs },
                ].map(item => (
                  <div key={item.label} className="p-2 rounded-lg bg-black/40 border border-white/5 text-center">
                    <p className="text-xs font-black text-white font-mono">{item.value === 0 ? "∞" : item.value}</p>
                    <p className="text-[9px] text-zinc-600">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Blog stats */}
            <div className="mb-3">
              <p className="text-[9px] font-black text-zinc-600 uppercase mb-1">📡 Blog Automation</p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: "Articles/mo", value: plan.max_articles_per_month },
                  { label: "Sites", value: plan.max_sites },
                ].map(item => (
                  <div key={item.label} className={cn("p-2 rounded-lg border text-center",
                    plan.has_blog_automation ? "bg-black/40 border-white/5" : "bg-black/20 border-white/[0.03] opacity-50")}>
                    <p className="text-xs font-black text-white font-mono">{item.value === 0 ? "∞" : item.value}</p>
                    <p className="text-[9px] text-zinc-600">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Feature badges */}
            <div className="flex flex-wrap gap-1 mb-3">
              {plan.has_image_generator && <span className="text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded font-bold">Images</span>}
              {plan.has_blog_automation && <span className="text-[9px] bg-green-500/10 text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded font-bold">Blog</span>}
              {plan.api_access && <span className="text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded font-bold">API</span>}
              {plan.telegram_bot && <span className="text-[9px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-1.5 py-0.5 rounded font-bold">Telegram</span>}
              {plan.overlay_upload && <span className="text-[9px] bg-orange-500/10 text-orange-400 border border-orange-500/20 px-1.5 py-0.5 rounded font-bold">Overlay</span>}
              {plan.custom_watermark && <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded font-bold">Watermark</span>}
              <span className="text-[9px] bg-white/5 text-zinc-400 border border-white/5 px-1.5 py-0.5 rounded font-bold">{plan.credits} pts</span>
            </div>

            <Button
              onClick={() => setEditPlan({ ...plan })}
              className="w-full h-9 bg-white/5 hover:bg-orange-500/10 hover:text-orange-400 border border-white/10 text-zinc-300 text-[10px] font-black uppercase tracking-widest rounded-xl"
            >
              <Edit3 className="w-3.5 h-3.5 mr-2" /> Configure
            </Button>
          </div>
        ))}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-zinc-950 border-white/10 rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white font-black uppercase">New Plan</DialogTitle>
            <DialogDescription className="text-zinc-500">Create a new subscription plan with all settings</DialogDescription>
          </DialogHeader>
          <PlanFormFields plan={newPlan} onChange={setNewPlan} />
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowCreate(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}
              className="bg-orange-600 hover:bg-orange-500 rounded-xl font-black text-[10px] uppercase tracking-widest px-6">
              {createMutation.isPending ? "Creating..." : "Create Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editPlan} onOpenChange={(open) => { if (!open) setEditPlan(null); }}>
        <DialogContent className="bg-zinc-950 border-white/10 rounded-2xl max-w-lg z-[200]">
          <DialogHeader>
            <DialogTitle className="text-white font-black uppercase tracking-tight">
              Configure: {editPlan?.display_name || "Plan"}
            </DialogTitle>
            <DialogDescription className="text-zinc-500">Full edit of all plan settings</DialogDescription>
          </DialogHeader>
          {editPlan && <PlanFormFields plan={editPlan} onChange={setEditPlan} />}
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" onClick={() => setEditPlan(null)} className="h-11 rounded-xl">Cancel</Button>
            <Button onClick={() => updateMutation.mutate(editPlan)} disabled={updateMutation.isPending}
              className="bg-orange-600 hover:bg-orange-500 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest px-6">
              <Save className="w-4 h-4 mr-2" />
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Points Tab ───────────────────────────────────────────────────────────────
function PointsTab() {
  const { data: settingsData, isLoading } = useAdminSettings();
  const settings = settingsData?.settings ?? {};
  const [config, setConfig] = useState({
    points_price_per_unit: "2",
    points_burn_per_article: "1",
    points_min_purchase: "10",
    points_system_enabled: "true",
  });
  const [loaded, setLoaded] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (settingsData && !loaded) {
      setConfig({
        points_price_per_unit: settings.points_price_per_unit || "2",
        points_burn_per_article: settings.points_burn_per_article || "1",
        points_min_purchase: settings.points_min_purchase || "10",
        points_system_enabled: settings.points_system_enabled || "true",
      });
      setLoaded(true);
    }
  }, [settingsData, loaded]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/admin/settings", {
        method: "PUT", headers: { "Authorization": `Bearer ${localStorage.getItem("pro_token")}`, "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      toast({ title: "Points Config Saved" });
      qc.invalidateQueries({ queryKey: ["admin", "settings"] });
    },
  });

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
          <Zap className="w-5 h-5 text-amber-500" />
          Points System Settings
        </h2>
        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-1">Configure the point economy for your platform</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-6">
          <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400" />
            Pricing
          </h3>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-zinc-500">Price per Point (MAD)</Label>
              <Input
                type="number" min={0} step={0.5}
                value={config.points_price_per_unit}
                onChange={(e) => setConfig({ ...config, points_price_per_unit: e.target.value })}
                className="bg-black border-white/10 h-12 rounded-xl font-mono text-amber-400 text-lg font-black"
              />
              <p className="text-[10px] text-zinc-600">1 PT = {config.points_price_per_unit} MAD</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-zinc-500">Minimum Purchase (PT)</Label>
              <Input
                type="number" min={1}
                value={config.points_min_purchase}
                onChange={(e) => setConfig({ ...config, points_min_purchase: e.target.value })}
                className="bg-black border-white/10 h-12 rounded-xl font-mono"
              />
            </div>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-6">
          <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
            <Activity className="w-4 h-4 text-orange-400" />
            Consumption
          </h3>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-zinc-500">Points Burned per Article</Label>
              <Input
                type="number" min={0}
                value={config.points_burn_per_article}
                onChange={(e) => setConfig({ ...config, points_burn_per_article: e.target.value })}
                className="bg-black border-white/10 h-12 rounded-xl font-mono"
              />
              <p className="text-[10px] text-zinc-600">0 = Free article generation</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">Points System</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Enable or disable the entire points economy</p>
              </div>
              <button
                onClick={() => setConfig({ ...config, points_system_enabled: config.points_system_enabled === "true" ? "false" : "true" })}
                className={cn(
                  "w-12 h-6 rounded-full transition-all relative",
                  config.points_system_enabled === "true" ? "bg-amber-500" : "bg-zinc-700"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow",
                  config.points_system_enabled === "true" ? "left-7" : "left-1"
                )} />
              </button>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="md:col-span-2 p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20">
          <h3 className="text-sm font-black text-amber-400 uppercase mb-3 flex items-center gap-2">
            <Star className="w-4 h-4" /> Preview
          </h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-black font-mono text-white">{parseInt(config.points_min_purchase) * parseFloat(config.points_price_per_unit)} MAD</p>
              <p className="text-[10px] text-zinc-500 uppercase">Min Purchase ({config.points_min_purchase} PT)</p>
            </div>
            <div>
              <p className="text-2xl font-black font-mono text-white">{50 * parseFloat(config.points_price_per_unit)} MAD</p>
              <p className="text-[10px] text-zinc-500 uppercase">50 PT Package</p>
            </div>
            <div>
              <p className="text-2xl font-black font-mono text-white">{200 * parseFloat(config.points_price_per_unit)} MAD</p>
              <p className="text-[10px] text-zinc-500 uppercase">200 PT Package</p>
            </div>
          </div>
        </div>
      </div>

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="bg-amber-600 hover:bg-amber-500 h-12 px-8 rounded-xl font-black"
      >
        <Save className="w-4 h-4 mr-2" />
        {saveMutation.isPending ? "Saving..." : "Save Points Config"}
      </Button>
    </div>
  );
}

// ─── Channels Tab ─────────────────────────────────────────────────────────────
function ChannelsTab() {
  const { data: settingsData } = useAdminSettings();
  const settings = settingsData?.settings ?? {};
  const [channels, setChannels] = useState({
    channel_discord_url: "",
    channel_discord_enabled: "false",
    channel_whatsapp_number: "",
    channel_whatsapp_enabled: "false",
    channel_telegram_url: "",
    channel_telegram_enabled: "false",
    channel_email: "",
    channel_email_enabled: "false",
    registration_enabled: "true",
    landing_enabled: "true",
    landing_title: "AI-Powered Content Automation",
    landing_subtitle: "Write. Publish. Dominate. Automatically.",
    landing_hero_badge: "Trusted by 500+ creators",
    site_name: "Liya",
  });
  const [loaded, setLoaded] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (settingsData && !loaded) {
      setChannels((prev) => {
        const updated = { ...prev };
        for (const key of Object.keys(prev)) {
          if (settings[key] !== undefined) {
            (updated as any)[key] = settings[key];
          }
        }
        return updated;
      });
      setLoaded(true);
    }
  }, [settingsData, loaded]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/admin/settings", {
        method: "PUT", headers: { "Authorization": `Bearer ${localStorage.getItem("pro_token")}`, "Content-Type": "application/json" },
        body: JSON.stringify(channels),
      });
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      toast({ title: "Channels & Site Config Saved" });
      qc.invalidateQueries({ queryKey: ["admin", "settings"] });
    },
  });

  const toggleChannel = (key: string) => {
    setChannels((prev) => ({
      ...prev,
      [key]: (prev as any)[key] === "true" ? "false" : "true",
    }));
  };

  const CHANNELS = [
    { id: "discord", label: "Discord", icon: "💬", urlKey: "channel_discord_url", enableKey: "channel_discord_enabled", placeholder: "https://discord.gg/your-server" },
    { id: "whatsapp", label: "WhatsApp", icon: "📱", urlKey: "channel_whatsapp_number", enableKey: "channel_whatsapp_enabled", placeholder: "+212600000000" },
    { id: "telegram", label: "Telegram", icon: "✈️", urlKey: "channel_telegram_url", enableKey: "channel_telegram_enabled", placeholder: "https://t.me/yourgroup" },
    { id: "email", label: "Email", icon: "📧", urlKey: "channel_email", enableKey: "channel_email_enabled", placeholder: "support@yourbusiness.com" },
  ];

  return (
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
          <MessageCircle className="w-5 h-5 text-blue-500" />
          Channels & Site Config
        </h2>
        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-1">Control what's visible to your users</p>
      </div>

      {/* Social Channels */}
      <div className="space-y-4">
        <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
          <Send className="w-4 h-4 text-zinc-500" /> Support Channels
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CHANNELS.map((ch) => (
            <div key={ch.id} className={cn(
              "p-5 rounded-2xl border transition-all",
              (channels as any)[ch.enableKey] === "true" ? "bg-blue-500/5 border-blue-500/20" : "bg-white/[0.02] border-white/5"
            )}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{ch.icon}</span>
                  <span className="text-sm font-black text-white">{ch.label}</span>
                </div>
                <button
                  onClick={() => toggleChannel(ch.enableKey)}
                  className={cn(
                    "w-11 h-6 rounded-full transition-all relative",
                    (channels as any)[ch.enableKey] === "true" ? "bg-blue-500" : "bg-zinc-700"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow",
                    (channels as any)[ch.enableKey] === "true" ? "left-6" : "left-1"
                  )} />
                </button>
              </div>
              <Input
                value={(channels as any)[ch.urlKey]}
                onChange={(e) => setChannels({ ...channels, [ch.urlKey]: e.target.value })}
                placeholder={ch.placeholder}
                className="bg-black/40 border-white/10 h-10 rounded-lg text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Site Settings */}
      <div className="space-y-4">
        <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
          <Globe className="w-4 h-4 text-zinc-500" /> Landing Page & Registration
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { key: "registration_enabled", label: "Allow Member Registration", type: "toggle" },
            { key: "landing_enabled", label: "Show Landing Page to Visitors", type: "toggle" },
            { key: "site_name", label: "Site Name", type: "text", placeholder: "Liya" },
            { key: "landing_hero_badge", label: "Hero Badge Text", type: "text", placeholder: "Trusted by 500+ creators" },
            { key: "landing_title", label: "Landing Page Title", type: "text", placeholder: "AI-Powered Content Automation" },
            { key: "landing_subtitle", label: "Landing Page Subtitle", type: "text", placeholder: "Write. Publish. Dominate." },
          ].map((f) => (
            <div key={f.key} className={cn("space-y-1.5", (f.key === "landing_title" || f.key === "landing_subtitle") && "md:col-span-2")}>
              {f.type === "toggle" ? (
                <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                  <Label className="text-sm font-bold text-zinc-300">{f.label}</Label>
                  <button
                    onClick={() => toggleChannel(f.key)}
                    className={cn(
                      "w-11 h-6 rounded-full transition-all relative",
                      (channels as any)[f.key] === "true" ? "bg-emerald-500" : "bg-zinc-700"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow",
                      (channels as any)[f.key] === "true" ? "left-6" : "left-1"
                    )} />
                  </button>
                </div>
              ) : (
                <>
                  <Label className="text-[10px] font-black uppercase text-zinc-500">{f.label}</Label>
                  <Input
                    value={(channels as any)[f.key]}
                    onChange={(e) => setChannels({ ...channels, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    className="bg-black border-white/10 h-11 rounded-xl"
                  />
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="bg-blue-600 hover:bg-blue-500 h-12 px-8 rounded-xl font-black"
      >
        <Save className="w-4 h-4 mr-2" />
        {saveMutation.isPending ? "Saving..." : "Save Configuration"}
      </Button>
    </div>
  );
}

// ─── System Tab (merged Settings link) ────────────────────────────────────────
// ─── SystemTab sub-navigation ─────────────────────────────────────────────────
const SYS_TABS = [
  { id: "ai-roles",    label: "🎭 AI Roles",        desc: "Provider per pipeline role" },
  { id: "openrouter",  label: "🔀 OpenRouter",       desc: "Multi-model gateway" },
  { id: "openai",      label: "⚡ OpenAI",           desc: "GPT-4o direct" },
  { id: "search-ai",   label: "🔍 Search AI",        desc: "Perplexity · Tavily · Gemini" },
  { id: "kieai",       label: "🎨 kie.ai Images",    desc: "FLUX image generation" },
  { id: "custom-ai",   label: "🔧 Custom AI",        desc: "Ollama · LM Studio · any OpenAI-compat" },
  { id: "rss",         label: "📡 RSS & Pipeline",   desc: "Content automation" },
  { id: "wordpress",   label: "🌐 WordPress",        desc: "Global credentials" },
  { id: "smtp",        label: "✉️ SMTP",             desc: "Email settings" },
  { id: "n8n",         label: "⚡ Webhooks",         desc: "N8N · Make · Zapier" },
  { id: "image-card",  label: "🖼️ News Card",       desc: "Default banner settings" },
];

function SystemTab() {
  const token = localStorage.getItem("pro_token") ?? "";
  const { toast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState("openrouter");
  const [customSlots, setCustomSlots] = useState<(1 | 2 | 3)[]>([1]);

  const { data, isLoading, refetch } = useQuery<{ settings: Record<string, string> }>({
    queryKey: ["admin-system-settings"],
    queryFn: async () => {
      const r = await fetch("/api/admin/settings", { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    },
  });

  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string; ms?: number }>>({});

  useEffect(() => {
    if (data?.settings) {
      setForm({ ...data.settings });
      setDirty(false);
      const slots: (1 | 2 | 3)[] = [1];
      if (data.settings["custom_ai_2_base_url"] || data.settings["custom_ai_2_name"]) slots.push(2);
      if (data.settings["custom_ai_3_base_url"] || data.settings["custom_ai_3_name"]) slots.push(3);
      setCustomSlots(slots);
    }
  }, [data?.settings]);

  const set = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setDirty(true);
    setTestResults(r => { const n = { ...r }; delete n[k]; return n; });
  };

  const save = async () => {
    setSaving(true);
    try {
      await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      toast({ title: "✅ Saved", description: "All settings synchronized" });
      setDirty(false);
      refetch();
    } catch {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    } finally { setSaving(false); }
  };

  // Test reads from DB → must save first
  const testService = async (settingKey: string, service: string) => {
    if (dirty) {
      toast({ title: "Save first", description: "Save your settings before testing.", variant: "destructive" });
      return;
    }
    setTesting(t => ({ ...t, [settingKey]: true }));
    setTestResults(r => { const n = { ...r }; delete n[settingKey]; return n; });
    const t0 = Date.now();
    try {
      const resp = await fetch(`/api/test/${service}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await resp.json();
      setTestResults(r => ({ ...r, [settingKey]: { ok: d.ok, msg: d.ok ? d.message : d.message, ms: d.latency ?? (Date.now() - t0) } }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTestResults(r => ({ ...r, [settingKey]: { ok: false, msg } }));
    } finally { setTesting(t => ({ ...t, [settingKey]: false })); }
  };

  // ── Field helpers ───────────────────────────────────────────────────────────
  const inp: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10, padding: "9px 12px", color: "#fff", fontSize: 13,
    fontFamily: "'Inter', sans-serif", outline: "none", boxSizing: "border-box",
  };
  const lbl: React.CSSProperties = {
    fontSize: 10, color: "#71717a", display: "block", marginBottom: 5,
    fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
  };

  // Text field
  const F = ({ label, k, type = "text", placeholder = "" }: { label: string; k: string; type?: string; placeholder?: string }) => (
    <div>
      <label style={lbl}>{label}</label>
      <input type={type} value={form[k] ?? ""} onChange={e => set(k, e.target.value)} placeholder={placeholder} style={inp} />
    </div>
  );

  // Select field
  const Sel = ({ label, k, options }: { label: string; k: string; options: { v: string; l: string }[] }) => (
    <div>
      <label style={lbl}>{label}</label>
      <select value={form[k] ?? ""} onChange={e => set(k, e.target.value)}
        style={{ ...inp, background: "#0f0e1a", appearance: "none" as const }}>
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );

  // Toggle field
  const Tog = ({ label, k, desc }: { label: string; k: string; desc?: string }) => {
    const on = form[k] === "true";
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: on ? "rgba(251,146,60,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${on ? "rgba(251,146,60,0.25)" : "rgba(255,255,255,0.07)"}`, borderRadius: 12, padding: "12px 16px" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: on ? "#fb923c" : "#a1a1aa" }}>{label}</div>
          {desc && <div style={{ fontSize: 11, color: "#52525b", marginTop: 2 }}>{desc}</div>}
        </div>
        <button onClick={() => set(k, on ? "false" : "true")} style={{
          width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
          background: on ? "#fb923c" : "#3f3f46", position: "relative", transition: "background 0.2s",
        }}>
          <span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 18, height: 18, borderRadius: 9, background: "#fff", transition: "left 0.2s" }} />
        </button>
      </div>
    );
  };

  // Slider field
  const Slider = ({ label, k, min, max, step, suffix }: { label: string; k: string; min: number; max: number; step: number; suffix?: string }) => {
    const val = Number(form[k]) || min;
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <label style={lbl}>{label}</label>
          <span style={{ fontSize: 14, fontWeight: 800, color: "#fb923c" }}>{val}{suffix}</span>
        </div>
        <input type="range" min={min} max={max} step={step} value={val}
          onChange={e => set(k, e.target.value)}
          style={{ width: "100%", accentColor: "#fb923c" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#52525b", fontWeight: 700, textTransform: "uppercase" as const, marginTop: 4 }}>
          <span>{min}{suffix}</span><span>{max}{suffix}</span>
        </div>
      </div>
    );
  };

  // Test button + result row
  const TestRow = ({ settingKey, service, label }: { settingKey: string; service: string; label?: string }) => {
    const r = testResults[settingKey];
    return (
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <F label={label ?? "API Key"} k={settingKey} type="password" placeholder="Enter API key..." />
          </div>
          <button
            onClick={() => testService(settingKey, service)}
            disabled={testing[settingKey]}
            style={{
              background: r ? (r.ok ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)") : "rgba(251,146,60,0.12)",
              border: `1px solid ${r ? (r.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)") : "rgba(251,146,60,0.25)"}`,
              color: r ? (r.ok ? "#4ade80" : "#f87171") : "#fb923c",
              padding: "9px 16px", borderRadius: 10, fontSize: 11, fontWeight: 800,
              cursor: "pointer", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" as const,
              opacity: testing[settingKey] ? 0.6 : 1, flexShrink: 0, height: 38,
            }}
          >
            {testing[settingKey] ? "⏳ Testing..." : r ? (r.ok ? "✅ OK" : "❌ Fail") : "⚡ Test"}
          </button>
        </div>
        {r && (
          <div style={{
            fontSize: 11, padding: "6px 10px", borderRadius: 8,
            color: r.ok ? "#4ade80" : "#f87171",
            background: r.ok ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
            border: `1px solid ${r.ok ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"}`,
            wordBreak: "break-all" as const,
          }}>
            {r.msg}{r.ms ? ` (${r.ms}ms)` : ""}
          </div>
        )}
      </div>
    );
  };

  // Custom AI slot key helper
  const slotPrefix = (slot: 1 | 2 | 3) => slot === 1 ? "custom_ai" : `custom_ai_${slot}`;

  const customProviderNames = {
    1: form["custom_ai_name"] || "Custom 1",
    2: form["custom_ai_2_name"] || "Custom 2",
    3: form["custom_ai_3_name"] || "Custom 3",
  };

  const providerOptions = (extra?: { v: string; l: string }[]) => [
    { v: "openrouter", l: "OpenRouter" },
    { v: "openai",     l: "OpenAI (GPT-4o)" },
    { v: "gemini",     l: "Google Gemini" },
    { v: "custom",     l: customProviderNames[1] },
    { v: "custom_2",   l: customProviderNames[2] },
    { v: "custom_3",   l: customProviderNames[3] },
    ...(extra ?? []),
  ];

  const geminiModels = [
    { v: "gemini-2.0-flash", l: "Gemini 2.0 Flash" },
    { v: "gemini-2.0-flash-lite", l: "Gemini 2.0 Flash Lite" },
    { v: "gemini-1.5-pro", l: "Gemini 1.5 Pro" },
    { v: "gemini-1.5-flash", l: "Gemini 1.5 Flash" },
  ];

  const openaiVisionModels = [
    { v: "gpt-4o", l: "GPT-4o" },
    { v: "gpt-4o-mini", l: "GPT-4o Mini" },
    { v: "gpt-4-turbo", l: "GPT-4 Turbo" },
  ];

  const imgAnalProvider = form["ai_provider_image_analysis"] ?? "gemini";
  const imgGenProvider = form["image_gen_provider"] ?? "kieai";
  const tmplGenProvider = form["ai_provider_template_gen"] ?? "replit_openai";

  const box: React.CSSProperties = {
    background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14, padding: 16,
  };

  // ── Section renderers ──────────────────────────────────────────────────────
  const sections: Record<string, React.ReactNode> = {
    "ai-roles": (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Sel label="Blog Orchestrator (Main Brain)" k="ai_provider_main" options={providerOptions()} />
        <Sel label="Research Specialist (Sub-agent)" k="ai_provider_sub" options={providerOptions()} />
        <Sel label="Drafting Engine (Writer)" k="ai_provider_writer" options={providerOptions()} />
        <Sel label="Image Analysis Provider" k="ai_provider_image_analysis" options={[
          { v: "gemini", l: "Google Gemini Vision" },
          { v: "openai", l: "OpenAI Vision (GPT-4o)" },
          { v: "openrouter", l: "OpenRouter (Vision)" },
          { v: "custom",   l: customProviderNames[1] },
          { v: "custom_2", l: customProviderNames[2] },
          { v: "custom_3", l: customProviderNames[3] },
        ]} />
        {["gemini","openai"].includes(imgAnalProvider) ? (
          <Sel label="Image Analysis Model" k="ai_image_analysis_model" options={imgAnalProvider === "gemini" ? geminiModels : openaiVisionModels} />
        ) : (
          <F label="Image Analysis Model (free text)" k="ai_image_analysis_model" placeholder="e.g. gpt-4o, llava-v1.6..." />
        )}
        <Sel label="Image Generation Provider" k="image_gen_provider" options={[
          { v: "kieai",    l: "kie.ai (FLUX)" },
          { v: "openai",   l: "DALL-E 3 (OpenAI)" },
          { v: "openrouter", l: "OpenRouter" },
          { v: "nanobanana", l: "Nanobanana" },
          { v: "custom",   l: customProviderNames[1] },
          { v: "custom_2", l: customProviderNames[2] },
          { v: "custom_3", l: customProviderNames[3] },
        ]} />
        {imgGenProvider === "nanobanana" && (
          <Sel label="Credentials Source (Slot)" k="image_gen_custom_slot" options={[
            { v: "",  l: `Slot 1 (${customProviderNames[1]})` },
            { v: "2", l: `Slot 2 (${customProviderNames[2]})` },
            { v: "3", l: `Slot 3 (${customProviderNames[3]})` },
          ]} />
        )}
        {imgGenProvider === "kieai" ? (
          <Sel label="Image Generation Model" k="image_gen_model" options={[
            { v: "flux-schnell", l: "FLUX Schnell (Fast)" },
            { v: "flux-dev",     l: "FLUX Dev (Quality)" },
            { v: "flux-pro",     l: "FLUX Pro" },
          ]} />
        ) : imgGenProvider === "openai" ? (
          <Sel label="Image Generation Model" k="image_gen_model" options={[
            { v: "dall-e-3", l: "DALL-E 3" },
            { v: "dall-e-2", l: "DALL-E 2" },
          ]} />
        ) : (
          <F label="Image Generation Model (free text)" k="image_gen_model" placeholder="e.g. gpt-image-1, flux-pro-ultra..." />
        )}

        {/* ── Template Generator AI ── */}
        <div style={{ gridColumn: "1 / -1", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14, marginTop: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#8b5cf6", textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 12 }}>🎨 Template Generator AI</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Sel label="Template Generator Provider" k="ai_provider_template_gen" options={[
              { v: "replit_openai", l: "Replit AI (GPT-5.2) — No key needed" },
              { v: "openrouter",    l: "OpenRouter (API Key 1)" },
              { v: "openai",        l: "OpenAI Direct API" },
              { v: "custom",        l: customProviderNames[1] },
              { v: "custom_2",      l: customProviderNames[2] },
              { v: "custom_3",      l: customProviderNames[3] },
            ]} />
            <F
              label="Template Generator Model"
              k="ai_model_template_gen"
              placeholder={
                tmplGenProvider === "replit_openai" ? "gpt-5.2 (default)" :
                tmplGenProvider === "openrouter"    ? "e.g. openai/gpt-4o, anthropic/claude-3.5-sonnet" :
                tmplGenProvider === "openai"        ? "e.g. gpt-4o" :
                "e.g. llama3, mistral"
              }
            />
          </div>
        </div>
      </div>
    ),

    "openrouter": (
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 20 }}>
        <div style={box}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#fb923c", marginBottom: 12, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
            🔑 API Key #1 — Main Brain / Blog Manager
          </div>
          <TestRow settingKey="openrouter_api_key_1" service="openrouter_1" label="OpenRouter API Key 1 (Main Brain)" />
        </div>
        <div style={box}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#fb923c", marginBottom: 12, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
            🔑 API Key #2 — Sub-agents + Writer (optional, leave empty to reuse Key 1)
          </div>
          <TestRow settingKey="openrouter_api_key_2" service="openrouter_2" label="OpenRouter API Key 2 (Sub-agents)" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <F label="Main Intelligence Model" k="openrouter_model_main" placeholder="anthropic/claude-3.5-sonnet" />
          <F label="Research Model" k="openrouter_model_sub" placeholder="google/gemini-flash-1.5" />
          <F label="Creative Writer Model" k="openrouter_model_writer" placeholder="openai/gpt-4o" />
        </div>
        <div style={{ fontSize: 11, color: "#52525b", padding: "10px 14px", background: "rgba(251,146,60,0.05)", borderRadius: 10, border: "1px solid rgba(251,146,60,0.1)" }}>
          💡 Browse all available models at <strong style={{ color: "#fb923c" }}>openrouter.ai/models</strong>
        </div>
      </div>
    ),

    "openai": (
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 20 }}>
        <TestRow settingKey="openai_api_key" service="openai" label="OpenAI API Key" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <F label="Main Intelligence Model" k="openai_model_main" placeholder="gpt-4o" />
          <F label="Research Model" k="openai_model_sub" placeholder="gpt-4o-mini" />
          <F label="Creative Writer Model" k="openai_model_writer" placeholder="gpt-4o" />
        </div>
      </div>
    ),

    "search-ai": (
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 20 }}>
        <div style={box}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#60a5fa", marginBottom: 12, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
            🔍 Perplexity — Keyword Research & Real-time Search
          </div>
          <TestRow settingKey="perplexity_api_key" service="perplexity" label="Perplexity API Key" />
        </div>
        <div style={box}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#34d399", marginBottom: 12, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
            🔗 Tavily — External Link & Source Search
          </div>
          <TestRow settingKey="tavily_api_key" service="tavily" label="Tavily API Key" />
        </div>
        <div style={box}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#a78bfa", marginBottom: 12, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
            👁️ Gemini — Image Analysis (Vision)
          </div>
          <TestRow settingKey="gemini_api_key" service="gemini" label="Google Gemini API Key" />
        </div>
      </div>
    ),

    "kieai": (
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 16 }}>
        <Tog label="Enable kie.ai Image Generation" k="use_kieai" desc="Use kie.ai FLUX models to generate featured images for articles" />
        <TestRow settingKey="kieai_api_key" service="kieai" label="kie.ai API Key" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Sel label="FLUX Model" k="kieai_model" options={[
            { v: "flux-schnell", l: "FLUX Schnell (Fast)" },
            { v: "flux-dev",     l: "FLUX Dev (Quality)" },
            { v: "flux-pro",     l: "FLUX Pro" },
          ]} />
          <Sel label="Aspect Ratio" k="kieai_aspect_ratio" options={[
            { v: "1:1",  l: "Square (1:1)" },
            { v: "16:9", l: "Widescreen (16:9)" },
            { v: "4:3",  l: "Standard (4:3)" },
            { v: "3:2",  l: "Photo (3:2)" },
          ]} />
        </div>
      </div>
    ),

    "custom-ai": (
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 24 }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          {customSlots.length < 3 && (
            <button
              onClick={() => {
                const next = ([2,3] as const).find(s => !customSlots.includes(s));
                if (next) setCustomSlots(prev => [...prev, next]);
              }}
              style={{
                background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.25)",
                color: "#fb923c", padding: "7px 16px", borderRadius: 10, fontSize: 11,
                fontWeight: 800, cursor: "pointer", fontFamily: "'Inter', sans-serif",
              }}
            >+ Add Slot</button>
          )}
        </div>
        {customSlots.map(slot => {
          const p = slotPrefix(slot);
          const svc = slot === 1 ? "custom_ai_1" : `custom_ai_${slot}`;
          return (
            <div key={slot} style={{ ...box, borderColor: "rgba(251,146,60,0.12)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#fb923c", textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>
                  🔧 Interface Terminal #{slot}
                </span>
                {slot !== 1 && (
                  <button onClick={() => {
                    setCustomSlots(prev => prev.filter(s => s !== slot));
                    [`${p}_name`,`${p}_base_url`,`${p}_key`,`${p}_model_main`,`${p}_model_sub`,`${p}_model_writer`,`${p}_model_image_analysis`].forEach(k => set(k, ""));
                  }} style={{ fontSize: 11, color: "#71717a", background: "none", border: "none", cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
                    🗑️ Remove
                  </button>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <F label="Interface Nickname" k={`${p}_name`} placeholder="Ollama Local / LM Studio..." />
                <F label="API Terminal URL" k={`${p}_base_url`} placeholder="http://localhost:11434/v1" />
              </div>
              <div style={{ marginBottom: 12 }}>
                <TestRow settingKey={`${p}_key`} service={svc} label="API Key (leave empty if not needed)" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
                <F label="Primary Model" k={`${p}_model_main`} placeholder="llama3.2" />
                <F label="Research Model" k={`${p}_model_sub`} placeholder="llama3.2" />
                <F label="Writer Model" k={`${p}_model_writer`} placeholder="llama3.2" />
                <F label="Vision Model" k={`${p}_model_image_analysis`} placeholder="llava" />
              </div>
            </div>
          );
        })}
      </div>
    ),

    "rss": (
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Tog label="Pipeline Enabled" k="pipeline_enabled" desc="Master switch — turns on/off all automation" />
          <Tog label="Auto-Publish" k="auto_publish" desc="Publish articles immediately (false = draft)" />
        </div>
        <F label="RSS Feed URL (Global Fallback)" k="rss_feed_url" placeholder="https://feeds.bbci.co.uk/news/rss.xml" />
        <Slider label="Refresh Interval" k="rss_poll_hours" min={1} max={24} step={1} suffix="h" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Slider label="Min Word Count" k="article_length_min" min={100} max={5000} step={50} suffix=" words" />
          <Slider label="Max Word Count" k="article_length_max" min={100} max={5000} step={50} suffix=" words" />
        </div>
      </div>
    ),

    "wordpress": (
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 16 }}>
        <div style={{ fontSize: 11, color: "#71717a", padding: "8px 12px", background: "rgba(96,165,250,0.06)", borderRadius: 10, border: "1px solid rgba(96,165,250,0.12)" }}>
          Used when a site doesn't have its own credentials configured in Sites.
        </div>
        <F label="WordPress Site URL" k="wp_url" placeholder="https://yoursite.com" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <F label="WordPress Username" k="wp_username" placeholder="admin" />
        </div>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <F label="WordPress App Password" k="wp_password" type="password" placeholder="xxxx xxxx xxxx xxxx" />
            </div>
            <button
              onClick={() => testService("wp_password", "wordpress")}
              disabled={testing["wp_password"]}
              style={{
                background: testResults["wp_password"] ? (testResults["wp_password"].ok ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)") : "rgba(96,165,250,0.1)",
                border: `1px solid ${testResults["wp_password"] ? (testResults["wp_password"].ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)") : "rgba(96,165,250,0.25)"}`,
                color: testResults["wp_password"] ? (testResults["wp_password"].ok ? "#4ade80" : "#f87171") : "#60a5fa",
                padding: "9px 16px", borderRadius: 10, fontSize: 11, fontWeight: 800,
                cursor: "pointer", fontFamily: "'Inter', sans-serif", flexShrink: 0, height: 38,
              }}
            >
              {testing["wp_password"] ? "⏳..." : testResults["wp_password"] ? (testResults["wp_password"].ok ? "✅ OK" : "❌") : "⚡ Test"}
            </button>
          </div>
          {testResults["wp_password"] && (
            <div style={{ fontSize: 11, padding: "6px 10px", borderRadius: 8,
              color: testResults["wp_password"].ok ? "#4ade80" : "#f87171",
              background: testResults["wp_password"].ok ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
              border: `1px solid ${testResults["wp_password"].ok ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"}`,
            }}>{testResults["wp_password"].msg}</div>
          )}
        </div>
        <Sel label="Default Post Status" k="wp_default_status" options={[
          { v: "draft", l: "Draft" }, { v: "publish", l: "Publish immediately" },
          { v: "pending", l: "Pending review" }, { v: "private", l: "Private" },
        ]} />
      </div>
    ),

    "smtp": (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <F label="SMTP Host" k="smtp_host" placeholder="smtp.gmail.com" />
        <F label="SMTP Port" k="smtp_port" placeholder="587" />
        <F label="SMTP User" k="smtp_user" placeholder="you@gmail.com" />
        <F label="SMTP Password" k="smtp_pass" type="password" placeholder="••••••••" />
        <F label="Sender Name" k="smtp_from_name" placeholder="NewsCard Pro" />
        <F label="Sender Email" k="smtp_from_email" placeholder="noreply@yoursite.com" />
        <Sel label="Encryption" k="smtp_encryption" options={[{ v: "tls", l: "TLS (587)" }, { v: "ssl", l: "SSL (465)" }, { v: "none", l: "None" }]} />
      </div>
    ),

    "n8n": (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <F label="N8N Webhook URL" k="n8n_webhook_url" placeholder="https://n8n.yoursite.com/webhook/..." />
        <F label="Webhook Secret" k="webhook_secret" type="password" placeholder="••••••••" />
        <F label="Make (Integromat) Webhook" k="make_webhook_url" placeholder="https://hook.make.com/..." />
        <F label="Generic Webhook URL" k="generic_webhook_url" placeholder="https://..." />
      </div>
    ),

    "image-card": (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <F label="Default Template Slug" k="default_template" placeholder="classic" />
        <Sel label="Default Aspect Ratio" k="default_aspect_ratio" options={[
          { v: "1:1", l: "1:1 — Square" }, { v: "16:9", l: "16:9 — Landscape" },
          { v: "9:16", l: "9:16 — Portrait" }, { v: "4:3", l: "4:3 — Standard" },
        ]} />
        <div>
          <label style={lbl}>Default Banner Color</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="color" value={form["default_banner_color"] || "#1a1a2e"} onChange={e => set("default_banner_color", e.target.value)}
              style={{ width: 38, height: 38, padding: 2, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", cursor: "pointer" }} />
            <input type="text" value={form["default_banner_color"] ?? "#1a1a2e"} onChange={e => set("default_banner_color", e.target.value)} placeholder="#1a1a2e" style={{ ...inp, flex: 1 }} />
          </div>
        </div>
        <div>
          <label style={lbl}>Default Text Color</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="color" value={form["default_text_color"] || "#ffffff"} onChange={e => set("default_text_color", e.target.value)}
              style={{ width: 38, height: 38, padding: 2, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", cursor: "pointer" }} />
            <input type="text" value={form["default_text_color"] ?? "#ffffff"} onChange={e => set("default_text_color", e.target.value)} placeholder="#ffffff" style={{ ...inp, flex: 1 }} />
          </div>
        </div>
        <F label="Default Watermark Text" k="default_watermark" placeholder="NewsCard Pro" />
        <F label="Default Logo URL" k="default_logo_url" placeholder="https://..." />
        <Sel label="Default Font" k="default_font" options={[
          { v: "Inter", l: "Inter" }, { v: "Cairo", l: "Cairo" }, { v: "Roboto", l: "Roboto" },
          { v: "Montserrat", l: "Montserrat" }, { v: "Oswald", l: "Oswald" }, { v: "Playfair Display", l: "Playfair Display" },
        ]} />
        <Sel label="Default Layout" k="default_layout" options={[
          { v: "standard", l: "Standard" }, { v: "compact", l: "Compact" }, { v: "bold", l: "Bold" }, { v: "minimal", l: "Minimal" },
        ]} />
      </div>
    ),
  };

  const activeTab = SYS_TABS.find(t => t.id === activeSubTab) ?? SYS_TABS[0];

  if (isLoading) return (
    <div className="flex items-center justify-center py-20 text-zinc-500 gap-3">
      <RefreshCw className="w-5 h-5 animate-spin" /><span>Loading settings...</span>
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }} dir="ltr">
      {/* ── Inner Sidebar ── */}
      <div style={{ width: 210, flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.07)", padding: "16px 10px", overflowY: "auto" as const, background: "rgba(0,0,0,0.15)" }}>
        {SYS_TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveSubTab(tab.id)} style={{
            display: "block", width: "100%", textAlign: "left" as const, padding: "9px 12px",
            borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "'Inter', sans-serif",
            marginBottom: 3, transition: "all 0.15s",
            background: activeSubTab === tab.id ? "rgba(251,146,60,0.12)" : "transparent",
            color: activeSubTab === tab.id ? "#fb923c" : "#71717a",
            borderLeft: activeSubTab === tab.id ? "3px solid #fb923c" : "3px solid transparent",
          }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>{tab.label}</div>
          </button>
        ))}
      </div>

      {/* ── Main Content ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" as const, minWidth: 0 }}>
        {/* Section header + Save */}
        <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>{activeTab.label}</div>
            <div style={{ fontSize: 11, color: "#52525b", marginTop: 2 }}>{activeTab.desc}</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {dirty && (
              <span style={{ fontSize: 10, color: "#fb923c", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
                Unsaved changes
              </span>
            )}
            <button
              onClick={save} disabled={saving || !dirty}
              style={{
                background: dirty ? "linear-gradient(135deg, #fb923c, #f97316)" : "rgba(255,255,255,0.05)",
                color: dirty ? "#fff" : "#52525b",
                border: dirty ? "none" : "1px solid rgba(255,255,255,0.08)",
                padding: "9px 20px", borderRadius: 10, fontWeight: 800,
                fontSize: 12, cursor: dirty ? "pointer" : "default",
                fontFamily: "'Inter', sans-serif", opacity: saving ? 0.7 : 1,
              }}
            >{saving ? "Saving..." : "💾 Save"}</button>
          </div>
        </div>

        {/* Section body */}
        <div style={{ flex: 1, overflowY: "auto" as const, padding: "20px 24px" }}>
          {sections[activeSubTab] ?? <div style={{ color: "#52525b", fontSize: 13 }}>Select a section from the left</div>}
        </div>

        {/* Bottom note about testing */}
        {["openrouter","openai","search-ai","kieai","custom-ai","wordpress"].includes(activeSubTab) && (
          <div style={{ padding: "10px 24px", borderTop: "1px solid rgba(255,255,255,0.05)", fontSize: 11, color: "#3f3f46", fontWeight: 600 }}>
            💡 Save settings first, then click ⚡ Test to verify the connection
          </div>
        )}
      </div>
    </div>
  );
}



// ─── ImageGalleryTab ─────────────────────────────────────────────────────────
function ImageGalleryTab() {
  const token = localStorage.getItem("pro_token") ?? "";
  const { data, isLoading } = useQuery<{ images: { id: number; userId: number; title: string; imageUrl: string; aspectRatio: string; bannerColor: string; createdAt: string }[] }>({
    queryKey: ["admin-images"],
    queryFn: async () => {
      const r = await fetch("/api/admin/images", { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    },
  });
  const images = data?.images ?? [];

  return (
    <div className="p-6" dir="ltr">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-black text-white">Image Gallery</h2>
          <p className="text-xs text-zinc-500 mt-1">All news cards generated on the platform</p>
        </div>
        <div className="flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl px-4 py-2">
          <ImageIcon className="w-4 h-4 text-cyan-400" />
          <span className="text-cyan-400 font-black text-sm">{images.length}</span>
          <span className="text-zinc-500 text-xs">images</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-zinc-500 gap-3">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading...</span>
        </div>
      ) : images.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center mx-auto mb-4 border border-cyan-500/20">
            <ImageIcon className="w-8 h-8 text-cyan-400" />
          </div>
          <p className="text-zinc-400 font-bold">No images yet</p>
          <p className="text-zinc-600 text-sm mt-1">Generated news cards will appear here</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
          {images.map(img => (
            <div key={img.id} style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16, overflow: "hidden",
              transition: "border-color 0.2s",
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(34,211,238,0.25)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
            >
              <div style={{ height: 130, background: img.bannerColor || "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {img.imageUrl ? (
                  <img src={img.imageUrl} alt={img.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <ImageIcon style={{ width: 36, height: 36, opacity: 0.2, color: "#fff" }} />
                )}
              </div>
              <div style={{ padding: "10px 12px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {img.title || "Untitled"}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "rgba(34,211,238,0.7)", background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.15)", padding: "1px 7px", borderRadius: 999 }}>
                    #{img.userId}
                  </span>
                  <span style={{ fontSize: 10, color: "#71717a", fontFamily: "monospace" }}>
                    {new Date(img.createdAt).toLocaleDateString("en")}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TemplatesManagementTab ───────────────────────────────────────────────────
type CE = {
  id: string; type: string; x: number; y: number; w: number; h: number;
  zIndex?: number; hidden?: boolean; fill?: string; gradient?: string; src?: string;
  color?: string; fontSize?: number; fontFamily?: string; fontWeight?: string;
  textAlign?: string; content?: string; bgColor?: string; borderRadius?: number;
  opacity?: number; borderWidth?: number; borderColor?: string;
};
type SysTmplItem = {
  id: number; name: string; slug: string | null;
  bannerColor: string; bannerGradient?: string | null;
  textColor: string; font: string; category: string;
  isSystem: boolean; isApproved: boolean | null;
  userId: number | null; createdAt: string;
  canvasLayout?: { width?: number; height?: number; elements?: CE[] } | null;
};

// Same rendering logic as Template Gallery's MiniBuilderPreview
function AdminMiniPreview({ elements, scale = 0.37 }: { elements: CE[]; scale?: number }) {
  const CW = 540, CH = 540;
  const W = CW * scale, H = CH * scale;
  const sorted = [...elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  return (
    <div style={{ width: W, height: H, position: "relative", overflow: "hidden", borderRadius: 0, flexShrink: 0 }}>
      {sorted.map(el => {
        if (el.hidden) return null;
        const s: React.CSSProperties = {
          position: "absolute",
          left: el.x * scale, top: el.y * scale,
          width: el.w * scale, height: el.h * scale,
          opacity: el.opacity ?? 1, zIndex: el.zIndex ?? 0,
          boxSizing: "border-box",
        };
        if (el.type === "bg") return (
          <div key={el.id} style={{ ...s, backgroundColor: el.fill || "#000", backgroundImage: el.src ? `url(${el.src})` : (el.gradient ?? undefined), backgroundSize: "cover", backgroundPosition: "center" }} />
        );
        if (el.type === "photo") return (
          <div key={el.id} style={{ ...s, border: `${scale}px dashed rgba(255,255,255,0.15)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 16 * scale, opacity: 0.2 }}>📸</span>
          </div>
        );
        if (el.type === "text") return (
          <div key={el.id} style={{ ...s, overflow: "hidden", color: el.color ?? "#fff", fontSize: (el.fontSize ?? 16) * scale, fontFamily: `'${el.fontFamily ?? "Cairo"}', sans-serif`, fontWeight: el.fontWeight ?? "400", textAlign: (el.textAlign as React.CSSProperties["textAlign"]) ?? "right", direction: "ltr", lineHeight: 1.5 }}>
            {el.content || ""}
          </div>
        );
        if (el.type === "badge") return (
          <div key={el.id} style={{ ...s, background: el.bgColor || "#dc2626", borderRadius: (el.borderRadius ?? 999) * scale, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: el.color ?? "#fff", fontSize: (el.fontSize ?? 13) * scale, fontFamily: `'${el.fontFamily ?? "Cairo"}', sans-serif`, fontWeight: el.fontWeight ?? "800" }}>{el.content || ""}</span>
          </div>
        );
        if (el.type === "rect") return (
          <div key={el.id} style={{ ...s, background: el.gradient || el.fill || "#6366f1", borderRadius: (el.borderRadius ?? 0) * scale, border: el.borderWidth ? `${el.borderWidth * scale}px solid ${el.borderColor ?? "#fff"}` : "none" }} />
        );
        if (el.type === "circle") return (
          <div key={el.id} style={{ ...s, borderRadius: "50%", background: el.fill || "#6366f1", border: el.borderWidth ? `${el.borderWidth * scale}px solid ${el.borderColor ?? "#fff"}` : "none" }} />
        );
        if (el.type === "logo") return (
          <div key={el.id} style={{ ...s, background: "rgba(255,255,255,0.12)", borderRadius: 4 * scale, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 9 * scale, color: "rgba(255,255,255,0.4)", fontFamily: "Cairo" }}>LOGO</span>
          </div>
        );
        if (el.type === "social") return (
          <div key={el.id} style={{ ...s, background: el.fill || "rgba(255,255,255,0.08)", borderRadius: (el.borderRadius ?? 8) * scale }} />
        );
        return null;
      })}
    </div>
  );
}

function TmplPreview({ t }: { t: SysTmplItem }) {
  const els = t.canvasLayout?.elements ?? [];
  const hasCanvas = els.length > 0;
  const accentColor = t.bannerColor && t.bannerColor !== "transparent" ? t.bannerColor : "#0f2557";

  return (
    <div style={{
      width: "100%", aspectRatio: "1", overflow: "hidden",
      background: accentColor,
      display: "flex", alignItems: "center", justifyContent: "center",
      borderRadius: "10px 10px 0 0",
      position: "relative",
    }}>
      {hasCanvas ? (
        /* Render full canvas elements exactly like Template Gallery */
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          <div style={{ transform: "scale(1)", transformOrigin: "center center", lineHeight: 0 }}>
            <AdminMiniPreview elements={els} scale={0.37} />
          </div>
        </div>
      ) : (
        /* No canvas data — show colored placeholder */
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: "100%" }}>
          <div style={{ fontSize: 32, opacity: 0.5 }}>🗞️</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 1 }}>{t.category}</div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>{t.font}</div>
        </div>
      )}
    </div>
  );
}

function AITemplateGenerator({ token, onSaved }: { token: string; onSaved: () => void }) {
  const { toast } = useToast();
  const authHdr = (ct = true) => ({
    ...(ct ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${token}`,
  });

  const [desc, setDesc]             = useState("");
  const [imgB64, setImgB64]         = useState<string | null>(null);
  const [imgMime, setImgMime]       = useState<string>("image/jpeg");
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [layout, setLayout]         = useState<{ width: number; height: number; elements: CE[] } | null>(null);
  const [saveName, setSaveName]     = useState("");
  const [saveCat, setSaveCat]       = useState("News");
  const [saving, setSaving]         = useState(false);

  const imgInputRef = useRef<HTMLInputElement>(null);

  const CATS = ["News","Breaking","Modern","Sports","Premium","Featured","Editorial","Quote","Social"];

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgMime(file.type || "image/jpeg");
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setImgPreview(result);
      // Strip the data:mime;base64, prefix
      const b64 = result.split(",")[1];
      setImgB64(b64 ?? null);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!desc.trim() && !imgB64) {
      toast({ title: "Please add a description or upload a reference image", variant: "destructive" });
      return;
    }
    setGenerating(true);
    setLayout(null);
    try {
      const body: Record<string, string> = {};
      if (desc.trim()) body.description = desc.trim();
      if (imgB64) { body.imageBase64 = imgB64; body.imageMimeType = imgMime; }

      const r = await fetch("/api/admin/ai-generate-template", {
        method: "POST",
        headers: authHdr(),
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) {
        toast({ title: "Generation failed", description: data.error ?? "Unknown error", variant: "destructive" });
        return;
      }
      const gen = data.layout as { width: number; height: number; elements: CE[] };
      if (!gen?.elements?.length) {
        toast({ title: "AI returned empty layout", variant: "destructive" });
        return;
      }
      setLayout(gen);
      if (!saveName) setSaveName("AI Template");
      toast({ title: "✨ Template generated!", description: "Review the preview and save it." });
    } catch (err) {
      toast({ title: "Network error", description: String(err), variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!layout) return;
    if (!saveName.trim()) { toast({ title: "Enter a template name", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/admin/system-templates", {
        method: "POST",
        headers: authHdr(),
        body: JSON.stringify({
          name: saveName.trim(),
          slug: saveName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
          category: saveCat,
          bannerColor: "#0f2557",
          textColor: "#ffffff",
          font: "Inter",
          isSystem: true,
          isApproved: true, // admin-created → auto approved
          canvasLayout: layout,
        }),
      });
      if (r.ok) {
        toast({ title: "✅ Template saved and approved!", description: "It's now live in the gallery." });
        setLayout(null);
        setDesc("");
        setImgB64(null);
        setImgPreview(null);
        setSaveName("");
        onSaved();
      } else {
        const d = await r.json();
        toast({ title: "Save failed", description: d.error ?? "Unknown error", variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  const inp: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
    color: "#e4e4e7", borderRadius: 10, padding: "10px 14px",
    fontSize: 13, fontFamily: "'Inter', sans-serif", outline: "none", width: "100%", boxSizing: "border-box",
  };

  return (
    <div style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.06), rgba(59,130,246,0.06))", border: "1px solid rgba(139,92,246,0.25)", borderRadius: 16, padding: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <div style={{ background: "linear-gradient(135deg, #8b5cf6, #3b82f6)", borderRadius: 10, padding: "8px 10px", fontSize: 20 }}>✨</div>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: "#fff", margin: 0 }}>AI Template Generator</h2>
          <p style={{ fontSize: 12, color: "#71717a", margin: "3px 0 0" }}>Describe a template or upload a reference image — AI will design it for you</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: layout ? "1fr 1fr" : "1fr", gap: 20 }}>
        {/* ── Input column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Image upload */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#a1a1aa", marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>Reference Image (optional)</div>
            <div
              onClick={() => imgInputRef.current?.click()}
              style={{
                border: "2px dashed rgba(139,92,246,0.3)", borderRadius: 12, padding: "16px",
                cursor: "pointer", textAlign: "center", background: "rgba(139,92,246,0.05)",
                transition: "all 0.2s", position: "relative", overflow: "hidden",
                minHeight: imgPreview ? "auto" : 80,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {imgPreview ? (
                <>
                  <img src={imgPreview} alt="reference" style={{ maxHeight: 120, maxWidth: "100%", borderRadius: 8, objectFit: "contain" }} />
                  <span style={{ fontSize: 11, color: "#a1a1aa" }}>Click to change image</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 24 }}>📸</span>
                  <span style={{ fontSize: 12, color: "#71717a" }}>Upload reference image</span>
                  <span style={{ fontSize: 10, color: "#52525b" }}>PNG, JPG, WebP</span>
                </>
              )}
            </div>
            <input ref={imgInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImagePick} />
            {imgPreview && (
              <button
                onClick={() => { setImgB64(null); setImgPreview(null); if (imgInputRef.current) imgInputRef.current.value = ""; }}
                style={{ marginTop: 6, fontSize: 11, color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >✕ Remove image</button>
            )}
          </div>

          {/* Description */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#a1a1aa", marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>Description</div>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Describe the template style, colors, layout, and mood...&#10;Examples:&#10;• A dark sports card with red accent and bold headline&#10;• Magazine style with white background and large photo&#10;• Cinematic black bars with gold typography"
              style={{ ...inp, minHeight: 120, resize: "vertical" as const }}
              rows={5}
            />
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              background: generating ? "rgba(139,92,246,0.3)" : "linear-gradient(135deg, #8b5cf6, #3b82f6)",
              border: "none", borderRadius: 12, padding: "13px 20px",
              color: "#ffffff", fontSize: 14, fontWeight: 800, cursor: generating ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.2s",
            }}
          >
            {generating ? (
              <><div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Generating...</>
            ) : (
              <><span style={{ fontSize: 16 }}>✨</span> Generate Template</>
            )}
          </button>
        </div>

        {/* ── Preview + Save column (only when layout exists) ── */}
        {layout && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#a1a1aa", textTransform: "uppercase" as const, letterSpacing: 0.5 }}>Preview</div>
            <div style={{ display: "flex", justifyContent: "center", background: "rgba(0,0,0,0.3)", borderRadius: 12, padding: 16, border: "1px solid rgba(255,255,255,0.06)" }}>
              <AdminMiniPreview elements={layout.elements} scale={0.46} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#a1a1aa", marginBottom: 5, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>Template Name</div>
                <input value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="e.g. Blue Breaking" style={inp} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#a1a1aa", marginBottom: 5, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>Category</div>
                <select value={saveCat} onChange={e => setSaveCat(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                  {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  background: saving ? "rgba(34,197,94,0.3)" : "linear-gradient(135deg, #22c55e, #16a34a)",
                  border: "none", borderRadius: 12, padding: "12px 20px",
                  color: "#ffffff", fontSize: 13, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {saving ? "Saving..." : "💾 Save to Gallery"}
              </button>
              <button
                onClick={() => setLayout(null)}
                style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "9px 16px", color: "#71717a", fontSize: 12, cursor: "pointer" }}
              >
                ↩ Generate Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TemplatesManagementTab() {
  const token = localStorage.getItem("pro_token") ?? "";
  const { toast } = useToast();
  const authHdr = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` });

  // All system templates (approved + rejected only, no pending → no duplication)
  const { data: sysTmplsRaw, isLoading: loadingSys, refetch: refetchSys } = useQuery<SysTmplItem[]>({
    queryKey: ["admin-sys-templates"],
    queryFn: async () => {
      const r = await fetch("/api/admin/system-templates", { cache: "no-store", headers: authHdr() });
      if (!r.ok) return [];
      const d = await r.json();
      const all: SysTmplItem[] = Array.isArray(d) ? d : (d.templates ?? []);
      return all.filter(t => t.isApproved !== null); // exclude pending (shown above)
    },
  });
  const [sysTmpls, setSysTmpls] = useState<SysTmplItem[]>([]);
  useEffect(() => { if (sysTmplsRaw) setSysTmpls(sysTmplsRaw); }, [sysTmplsRaw]);

  // Pending templates
  const { data: pendingRaw, isLoading: loadingPending, refetch: refetchPending } = useQuery<SysTmplItem[]>({
    queryKey: ["admin-pending-templates"],
    queryFn: async () => {
      const r = await fetch("/api/admin/pending-templates", { cache: "no-store", headers: authHdr() });
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d) ? d : [];
    },
  });
  const [pendingTmpls, setPendingTmpls] = useState<SysTmplItem[]>([]);
  useEffect(() => { if (pendingRaw) setPendingTmpls(pendingRaw); }, [pendingRaw]);

  const [confirmDel, setConfirmDel] = useState<{ id: number; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const doDelete = async () => {
    if (!confirmDel) return;
    setDeleting(true);
    const r = await fetch(`/api/admin/system-templates/${confirmDel.id}`, { method: "DELETE", headers: authHdr() });
    setDeleting(false);
    if (r.ok) {
      toast({ title: "🗑️ Deleted" });
      setSysTmpls(p => p.filter(t => t.id !== confirmDel.id));
      setPendingTmpls(p => p.filter(t => t.id !== confirmDel.id));
      setConfirmDel(null);
    } else toast({ title: "Error", description: "Delete failed", variant: "destructive" });
  };

  const handleApprove = async (id: number) => {
    const r = await fetch(`/api/admin/templates/${id}/approve`, { method: "POST", headers: authHdr() });
    if (!r.ok) return;
    toast({ title: "✅ Approved — now live in gallery" });
    const fromPending = pendingTmpls.find(t => t.id === id);
    if (fromPending) {
      // was pending → remove from pending, add to sysTmpls as approved
      setPendingTmpls(p => p.filter(t => t.id !== id));
      setSysTmpls(p => [{ ...fromPending, isApproved: true }, ...p]);
    } else {
      // was rejected → update in place (stays in sysTmpls, moves to approved section)
      setSysTmpls(p => p.map(t => t.id === id ? { ...t, isApproved: true } : t));
    }
  };

  const handleReject = async (id: number) => {
    const r = await fetch(`/api/admin/templates/${id}/reject`, { method: "POST", headers: authHdr() });
    if (!r.ok) return;
    toast({ title: "🚫 Rejected — hidden from gallery" });
    const fromPending = pendingTmpls.find(t => t.id === id);
    if (fromPending) {
      // was pending → remove from pending, add to sysTmpls as rejected
      setPendingTmpls(p => p.filter(t => t.id !== id));
      setSysTmpls(p => [{ ...fromPending, isApproved: false }, ...p]);
    } else {
      // was approved → update in place (stays in sysTmpls, moves to rejected section)
      setSysTmpls(p => p.map(t => t.id === id ? { ...t, isApproved: false } : t));
    }
  };

  const doRefresh = () => { refetchPending(); refetchSys(); };

  return (
    <div className="p-6" dir="ltr" style={{ display: "flex", flexDirection: "column", gap: 32 }}>

      {/* ═══════ AI TEMPLATE GENERATOR ═══════ */}
      <AITemplateGenerator token={token} onSaved={doRefresh} />

      {/* ═══════ PENDING (Publish Requests) ═══════ */}
      <div style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 16, padding: "20px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "#fff", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              Publish Requests
              {pendingTmpls.length > 0 && <span style={{ background: "#f59e0b", color: "#000", fontSize: 10, fontWeight: 800, padding: "2px 9px", borderRadius: 999 }}>{pendingTmpls.length}</span>}
            </h2>
            <p style={{ fontSize: 12, color: "#71717a", margin: "4px 0 0" }}>Templates awaiting admin approval before appearing in the gallery</p>
          </div>
          <button onClick={doRefresh} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#a1a1aa", padding: "7px 14px", borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>

        {loadingPending ? (
          <div style={{ textAlign: "center", padding: "24px", color: "#71717a" }}>⏳ Loading...</div>
        ) : pendingTmpls.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>✅</div>
            <div style={{ fontWeight: 700, color: "#fff", fontSize: 13 }}>No pending requests</div>
            <div style={{ fontSize: 11, color: "#71717a", marginTop: 4 }}>All templates have been reviewed</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
            {pendingTmpls.map(t => (
              <div key={t.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 14, overflow: "hidden" }}>
                <TmplPreview t={t} />
                <div style={{ padding: "0 12px 12px" }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: "#fff", marginBottom: 2 }}>{t.name}</div>
                  <div style={{ fontSize: 10, color: "#71717a", marginBottom: 4 }}>{t.category} · {t.font}</div>
                  <div style={{ fontSize: 10, color: "#52525b", marginBottom: 10 }}>
                    {t.userId ? `User #${t.userId} · ` : "Admin · "}{new Date(t.createdAt).toLocaleDateString("en-GB")}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => handleApprove(t.id)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: "rgba(34,197,94,0.15)", color: "#22c55e", fontSize: 11, fontWeight: 700, cursor: "pointer", border: "1px solid rgba(34,197,94,0.3)" }}>✅ Approve</button>
                    <button onClick={() => handleReject(t.id)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: "rgba(239,68,68,0.1)", color: "#f87171", fontSize: 11, fontWeight: 700, cursor: "pointer", border: "1px solid rgba(239,68,68,0.25)" }}>🚫 Reject</button>
                    <button onClick={() => setConfirmDel({ id: t.id, name: t.name })} style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(239,68,68,0.06)", color: "#f87171", fontSize: 12, cursor: "pointer", border: "1px solid rgba(239,68,68,0.15)" }} title="Delete">🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══════ SITE TEMPLATES HEADER ═══════ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: "#fff", margin: 0 }}>Site Templates</h2>
          <p style={{ fontSize: 12, color: "#71717a", margin: "4px 0 0" }}>
            Approved: {sysTmpls.filter(t => t.isApproved === true).length} · Rejected: {sysTmpls.filter(t => t.isApproved === false).length}
          </p>
        </div>
        <a href="/template-builder?from=admin" style={{
          display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px",
          background: "linear-gradient(135deg, #ec4899, #8b5cf6)",
          color: "#fff", borderRadius: 12, fontSize: 12, fontWeight: 800,
          textDecoration: "none", boxShadow: "0 4px 20px rgba(236,72,153,0.3)",
        }}>
          <Palette className="w-4 h-4" /> Template Builder
        </a>
      </div>

      {loadingSys && (
        <div style={{ textAlign: "center", padding: "48px", color: "#71717a", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <RefreshCw className="w-5 h-5 animate-spin" /><span>Loading...</span>
        </div>
      )}

      {/* ── ✅ Approved Templates ── */}
      {!loadingSys && (() => {
        const approved = sysTmpls.filter(t => t.isApproved === true);
        return (
          <div style={{ background: "rgba(34,197,94,0.03)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 16, padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />
              <h3 style={{ fontSize: 14, fontWeight: 800, color: "#22c55e", margin: 0 }}>
                Approved Templates
              </h3>
              <span style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, border: "1px solid rgba(34,197,94,0.3)" }}>
                {approved.length} Live in Gallery
              </span>
            </div>
            {approved.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 0", color: "#4b5563", fontSize: 12 }}>
                No approved templates yet — approve from Publish Requests above
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
                {approved.map(t => (
                  <div key={t.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 14, overflow: "hidden" }}>
                    <TmplPreview t={t} />
                    <div style={{ padding: "0 12px 12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                        <div style={{ fontWeight: 800, fontSize: 13, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: "80%" }}>{t.name}</div>
                        <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                          <div style={{ width: 12, height: 12, borderRadius: "50%", background: t.bannerColor, border: "1.5px solid rgba(255,255,255,0.15)" }} />
                          <div style={{ width: 12, height: 12, borderRadius: "50%", background: t.textColor, border: "1.5px solid rgba(255,255,255,0.15)" }} />
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: "#71717a", marginBottom: 3 }}>{t.category} · {t.font}</div>
                      <div style={{ fontSize: 10, color: "#3f3f46", marginBottom: 10 }}>
                        {t.userId ? `User #${t.userId}` : "Admin"} · {new Date(t.createdAt).toLocaleDateString("en-GB")}
                      </div>
                      <div style={{ display: "flex", gap: 7 }}>
                        <a href={`/template-builder?from=admin&editSystemTemplate=${t.id}`}
                          style={{ flex: 1, background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", color: "#a78bfa", padding: "7px", borderRadius: 8, fontSize: 11, fontWeight: 700, textDecoration: "none", textAlign: "center" as const, display: "block" }}>
                          ✏️ Edit
                        </a>
                        <button onClick={() => setConfirmDel({ id: t.id, name: t.name })} style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", padding: "7px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>🗑️</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── 🚫 Rejected Templates ── */}
      {!loadingSys && (() => {
        const rejected = sysTmpls.filter(t => t.isApproved === false);
        return (
          <div style={{ background: "rgba(239,68,68,0.03)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 16, padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
              <h3 style={{ fontSize: 14, fontWeight: 800, color: "#f87171", margin: 0 }}>
                Rejected Templates
              </h3>
              <span style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, border: "1px solid rgba(239,68,68,0.25)" }}>
                {rejected.length} Hidden
              </span>
            </div>
            {rejected.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 0", color: "#4b5563", fontSize: 12 }}>
                No rejected templates
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
                {rejected.map(t => (
                  <div key={t.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 14, overflow: "hidden", opacity: 0.85 }}>
                    <div style={{ position: "relative" }}>
                      <TmplPreview t={t} />
                      <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(239,68,68,0.9)", borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 800, color: "#fff" }}>REJECTED</div>
                    </div>
                    <div style={{ padding: "0 12px 12px" }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: "#9ca3af", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{t.name}</div>
                      <div style={{ fontSize: 10, color: "#52525b", marginBottom: 3 }}>{t.category} · {t.font}</div>
                      <div style={{ fontSize: 10, color: "#3f3f46", marginBottom: 10 }}>
                        {t.userId ? `User #${t.userId}` : "Admin"} · {new Date(t.createdAt).toLocaleDateString("en-GB")}
                      </div>
                      <div style={{ display: "flex", gap: 7 }}>
                        <button onClick={() => handleApprove(t.id)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, background: "rgba(34,197,94,0.1)", color: "#22c55e", fontSize: 10, fontWeight: 700, cursor: "pointer", border: "1px solid rgba(34,197,94,0.25)" }}>✅ Re-approve</button>
                        <button onClick={() => setConfirmDel({ id: t.id, name: t.name })} style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", padding: "7px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>🗑️</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ═══════ DELETE CONFIRM MODAL ═══════ */}
      {confirmDel && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setConfirmDel(null)}>
          <div style={{ background: "#111827", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 16, padding: "28px 32px", width: 360, maxWidth: "90vw" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>🗑️</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", textAlign: "center", marginBottom: 8 }}>Delete Template</div>
            <div style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", marginBottom: 24 }}>
              Delete <strong style={{ color: "#ef4444" }}>"{confirmDel.name}"</strong>? This cannot be undone.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDel(null)} style={{ flex: 1, padding: "11px 0", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={doDelete} disabled={deleting} style={{ flex: 1, padding: "11px 0", borderRadius: 10, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", color: "#ef4444", fontSize: 14, fontWeight: 700, cursor: deleting ? "wait" : "pointer" }}>{deleting ? "Deleting..." : "Delete"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BotTab ───────────────────────────────────────────────────────────────────
function BotTab() {
  const token = localStorage.getItem("pro_token") ?? "";
  const { toast } = useToast();
  const { data, isLoading } = useQuery<{ settings: Record<string, string> }>({
    queryKey: ["admin-settings-bot"],
    queryFn: async () => {
      const r = await fetch("/api/admin/settings", { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    },
  });
  const settings = data?.settings ?? {};
  const [botToken, setBotToken] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings.telegram_bot_token) setBotToken(settings.telegram_bot_token);
  }, [settings.telegram_bot_token]);

  const handleSave = async () => {
    setSaving(true);
    await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ telegram_bot_token: botToken }),
    });
    setSaving(false);
    toast({ title: "Saved", description: "Bot settings updated" });
  };

  return (
    <div className="p-6 max-w-xl" dir="ltr">
      <div className="mb-6">
        <h2 className="text-xl font-black text-white">Telegram Bot Settings</h2>
        <p className="text-xs text-zinc-500 mt-1">Manage the Telegram bot connected to the platform</p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-3 text-zinc-500 py-8">
          <RefreshCw className="w-4 h-4 animate-spin" /> Loading...
        </div>
      ) : (
        <div style={{
          background: "rgba(129,140,248,0.06)", border: "1px solid rgba(129,140,248,0.15)",
          borderRadius: 20, padding: "24px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14, flexShrink: 0,
              background: "linear-gradient(135deg, rgba(129,140,248,0.3), rgba(99,102,241,0.2))",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "1px solid rgba(129,140,248,0.3)",
            }}>
              <Bot style={{ width: 24, height: 24, color: "#818cf8" }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#fff" }}>Telegram Bot</div>
              <div style={{ fontSize: 12, color: settings.telegram_bot_token ? "#4ade80" : "#f87171", display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: settings.telegram_bot_token ? "#4ade80" : "#f87171" }} />
                {settings.telegram_bot_token ? "Configured" : "Not configured"}
              </div>
            </div>
          </div>

          <label style={{ display: "block", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>Bot Token</span>
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              type="password"
              value={botToken}
              onChange={e => setBotToken(e.target.value)}
              placeholder="1234567890:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              dir="ltr"
              style={{
                flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 13, fontFamily: "monospace",
                outline: "none",
              }}
              onFocus={e => (e.currentTarget.style.borderColor = "rgba(129,140,248,0.5)")}
              onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            />
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                background: "linear-gradient(135deg, #818cf8, #6366f1)", color: "#fff",
                border: "none", padding: "10px 20px", borderRadius: 10,
                fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "..." : "Save"}
            </button>
          </div>

          <div style={{ marginTop: 20, padding: "14px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 11, color: "#71717a", lineHeight: 1.7 }}>
              <div>• Get your bot token from <strong style={{ color: "#818cf8" }}>@BotFather</strong> on Telegram</div>
              <div>• Send <code style={{ background: "rgba(255,255,255,0.05)", padding: "1px 6px", borderRadius: 4 }}>/newbot</code> to create a new bot</div>
              <div>• Copy the token and paste it here</div>
            </div>
          </div>

          {/* Telegram Webhook Setup */}
          {settings.telegram_bot_token && (
            <div style={{ marginTop: 20, padding: "16px", background: "rgba(129,140,248,0.04)", borderRadius: 12, border: "1px solid rgba(129,140,248,0.18)" }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#a5b4fc", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                🔗 Telegram Webhook
              </div>
              <div style={{ fontSize: 11, color: "#71717a", marginBottom: 12 }}>
                Register the webhook so the bot can receive messages and link user accounts by their Bot Secret Code.
              </div>
              <WebhookSetupButton />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── WebhookSetupButton ───────────────────────────────────────────────────────
function WebhookSetupButton() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [webhookInfo, setWebhookInfo] = React.useState<{ url?: string; pending_update_count?: number } | null>(null);
  const [customUrl, setCustomUrl] = React.useState("");

  const fetchInfo = React.useCallback(async () => {
    try {
      const r = await fetch("/api/bot/webhook-info", {
        headers: { Authorization: `Bearer ${localStorage.getItem("pro_token")}` },
      });
      const d = await r.json() as { configured?: boolean; webhook?: { url?: string; pending_update_count?: number } };
      if (d.webhook) setWebhookInfo(d.webhook);
    } catch {}
  }, []);

  React.useEffect(() => { fetchInfo(); }, [fetchInfo]);

  const setupWebhook = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/bot/setup-webhook", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("pro_token")}`, "Content-Type": "application/json" },
        body: JSON.stringify(customUrl.trim() ? { webhookUrl: customUrl.trim() } : {}),
      });
      const d = await r.json() as { success?: boolean; webhookUrl?: string; error?: string };
      if (d.success) {
        toast({ title: "Webhook registered!", description: d.webhookUrl });
        setCustomUrl("");
        fetchInfo();
      } else {
        toast({ title: "Failed", description: d.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {webhookInfo?.url ? (
        <div style={{ fontSize: 11, color: "#4ade80", marginBottom: 14 }}>
          ✅ Active: <span style={{ fontFamily: "monospace", color: "#a5b4fc", wordBreak: "break-all" }}>{webhookInfo.url}</span>
          {webhookInfo.pending_update_count !== undefined && (
            <span style={{ color: "#71717a", marginLeft: 8 }}>({webhookInfo.pending_update_count} pending)</span>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: "#f87171", marginBottom: 14 }}>❌ Webhook not registered</div>
      )}

      <label style={{ display: "block", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>Custom Webhook URL (Optional for ngrok / localhost testing)</span>
      </label>
      <div style={{ display: "flex", gap: 10 }}>
        <input
          type="text"
          value={customUrl}
          onChange={e => setCustomUrl(e.target.value)}
          placeholder="https://yourapp.ngrok.app/api/bot/webhook"
          dir="ltr"
          style={{
            flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 12, fontFamily: "monospace",
            outline: "none",
          }}
          onFocus={e => (e.currentTarget.style.borderColor = "rgba(129,140,248,0.5)")}
          onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
        />
        <button
          onClick={setupWebhook}
          disabled={loading}
          style={{
            background: "linear-gradient(135deg, #818cf8, #6366f1)", color: "#fff",
            border: "none", padding: "8px 16px", borderRadius: 8,
            fontSize: 12, fontWeight: 700, cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.7 : 1, whiteSpace: "nowrap"
          }}
        >
          {loading ? "Registering..." : webhookInfo?.url ? "Update Webhook" : "Register"}
        </button>
      </div>
    </div>
  );
}

// ─── BlogAdmin (Main Shell) ───────────────────────────────────────────────────
export function BlogAdmin() {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTabState] = useState<Tab>("overview");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab") as Tab;
    if (tab && TABS.some((t) => t.id === tab)) {
      setActiveTabState(tab);
    }
  }, []);

  const setActiveTab = (t: Tab) => {
    setActiveTabState(t);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    window.history.replaceState({}, "", url.toString());
  };

  if (!isAdmin) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, textAlign: "center", gap: 20, padding: 40 }} dir="ltr">
        <div style={{ width: 72, height: 72, borderRadius: 20, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ShieldAlert style={{ width: 36, height: 36, color: "#f87171" }} />
        </div>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em" }}>Access Denied</h1>
          <p style={{ color: "#71717a", marginTop: 8 }}>This panel is for administrators only</p>
        </div>
        <a href="/" style={{ padding: "10px 24px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", color: "#a1a1aa", textDecoration: "none", fontSize: 14 }}>Back to Home</a>
      </div>
    );
  }

  const activeInfo = TABS.find(t => t.id === activeTab)!;

  return (
    <div dir="ltr" style={{ minHeight: "80vh" }}>
      {/* ── Page header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 24px rgba(124,58,237,0.4)",
          }}>
            <ShieldCheck style={{ width: 20, height: 20, color: "#fff" }} />
          </div>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em", lineHeight: 1 }}>
              Comprehensive Control Panel
            </h1>
            <p style={{ fontSize: 11, color: "rgba(167,139,250,0.6)", fontFamily: "monospace", letterSpacing: "0.12em", marginTop: 3 }}>
              ADMIN CONTROL CENTER · MediaFlow Pro
            </p>
          </div>
        </div>
      </div>

      {/* ── Two-panel layout ── */}
      <div style={{
        display: "flex", gap: 0, minHeight: 600,
        borderRadius: 24, overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(8,6,20,0.6)",
        backdropFilter: "blur(12px)",
      }}>
        {/* ── Left: Tab navigation ── */}
        <div style={{
          width: 200, minWidth: 200, flexShrink: 0,
          borderRight: "1px solid rgba(255,255,255,0.05)",
          background: "rgba(5,3,15,0.7)",
          display: "flex", flexDirection: "column",
          padding: "16px 10px",
          gap: 2,
        }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", borderRadius: 12,
                  border: isActive ? `1px solid ${tab.color}30` : "1px solid transparent",
                  background: isActive ? tab.bg : "transparent",
                  color: isActive ? tab.color : "rgba(255,255,255,0.45)",
                  cursor: "pointer", transition: "all 0.15s",
                  width: "100%", textAlign: "left",
                  fontFamily: "'Inter', system-ui, sans-serif",
                  position: "relative",
                }}
                onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.7)"; } }}
                onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.45)"; } }}
              >
                {isActive && (
                  <div style={{
                    position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
                    width: 3, height: 20, borderRadius: "0 2px 2px 0", background: tab.color,
                  }} />
                )}
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: isActive ? `${tab.color}20` : "rgba(255,255,255,0.05)",
                }}>
                  <tab.icon style={{ width: 14, height: 14 }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.2 }}>{tab.labelAr}</div>
                  <div style={{ fontSize: 9, opacity: 0.5, fontFamily: "monospace", letterSpacing: "0.05em" }}>{tab.label}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Right: Tab content ── */}
        <div style={{ flex: 1, minWidth: 0, overflow: "auto" }}>
          {/* Content header strip */}
          <div style={{
            padding: "14px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            display: "flex", alignItems: "center", gap: 10,
            background: `linear-gradient(90deg, ${activeInfo.bg}, transparent)`,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: `${activeInfo.color}20`, border: `1px solid ${activeInfo.color}30`,
            }}>
              <activeInfo.icon style={{ width: 15, height: 15, color: activeInfo.color }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{activeInfo.labelAr}</div>
              <div style={{ fontSize: 10, color: activeInfo.color, opacity: 0.7, fontFamily: "monospace" }}>{activeInfo.label.toUpperCase()}</div>
            </div>
          </div>

          {/* Tab content */}
          {activeTab === "overview"   && <OverviewTab />}
          {activeTab === "users"      && <UsersTab />}
          {activeTab === "payments"   && <PaymentsTab />}
          {activeTab === "plans"      && <PlansTab />}
          {activeTab === "points"     && <PointsTab />}
          {activeTab === "images"     && <ImageGalleryTab />}
          {activeTab === "templates"  && <TemplatesManagementTab />}
          {activeTab === "channels"   && <ChannelsTab />}
          {activeTab === "bot"        && <BotTab />}
          {activeTab === "system"     && <SystemTab />}
        </div>
      </div>
    </div>
  );
}
