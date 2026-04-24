import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Globe, Rss, Edit2, Trash2, CheckCircle, XCircle,
  Bot, RefreshCw, FolderOpen, Loader2, X, BarChart2, Clock, Save, Lock,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BASE_URL } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Site {
  id: number;
  name: string;
  wp_url: string;
  wp_username: string;
  wp_password: string;
  rss_feed_url: string;
  rss_poll_hours: number;
  css_selector_content: string;
  css_selector_image: string;
  auto_publish: boolean;
  is_active: boolean;
  article_count?: number;
  created_at: string;
}

interface RssFeed {
  id: number;
  site_id: number;
  rss_url: string;
  label: string | null;
  wp_category_id: number | null;
  wp_category_name: string | null;
  poll_hours: number;
  poll_minutes: number;
  max_articles: number;
  is_active: boolean;
}

interface WPCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
  parent: number;
}

// Draft feed (not yet saved) for the add form
interface DraftFeed {
  rss_url: string;
  label: string;
  wp_category_id: number | null;
  wp_category_name: string | null;
  poll_hours: number;
  poll_minutes: number;
  max_articles: number;
}

// ── Form default ───────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: "",
  wp_url: "",
  wp_username: "",
  wp_password: "",
  rss_feed_url: "",
  rss_poll_hours: 4,
  css_selector_content: ".single-content",
  css_selector_image: ".wp-site-blocks .post-thumbnail img",
  auto_publish: false,
  is_active: true,
};

const EMPTY_DRAFT: DraftFeed = {
  rss_url: "",
  label: "",
  wp_category_id: null,
  wp_category_name: null,
  poll_hours: 4,
  poll_minutes: 0,
  max_articles: 0,
};

// ── API helpers ────────────────────────────────────────────────────────────────

async function fetchSites(): Promise<{ sites: Site[] }> {
  const r = await fetch(`/api/sites`, { headers: { "Authorization": `Bearer ${localStorage.getItem("pro_token")}` } });
  if (!r.ok) throw new Error("Failed to fetch sites");
  return r.json();
}

async function createSite(data: typeof EMPTY_FORM) {
  const r = await fetch(`${BASE_URL}api/sites`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("pro_token")}` },
    body: JSON.stringify(data),
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.message || body.error || "Failed to create site");
  }
  return r.json() as Promise<Site>;
}

async function updateSite(id: number, data: Partial<typeof EMPTY_FORM>) {
  const r = await fetch(`/api/sites/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("pro_token")}` },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Failed to update site");
  return r.json();
}

async function deleteSite(id: number) {
  const r = await fetch(`/api/sites/${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${localStorage.getItem("pro_token")}` } });
  if (!r.ok) throw new Error("Failed to delete site");
  return r.json();
}

async function fetchRssFeeds(siteId: number): Promise<{ feeds: RssFeed[] }> {
  const r = await fetch(`/api/sites/${siteId}/rss-feeds`, { headers: { "Authorization": `Bearer ${localStorage.getItem("pro_token")}` } });
  if (!r.ok) throw new Error("Failed to fetch RSS feeds");
  return r.json();
}

async function createRssFeed(siteId: number, data: Omit<DraftFeed, "label"> & { label?: string }) {
  const r = await fetch(`/api/sites/${siteId}/rss-feeds`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("pro_token")}` },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Failed to create RSS feed");
  return r.json() as Promise<RssFeed>;
}

async function updateRssFeed(feedId: number, data: Partial<RssFeed>) {
  const r = await fetch(`/api/rss-feeds/${feedId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("pro_token")}` },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Failed to update RSS feed");
  return r.json();
}

async function deleteRssFeed(feedId: number) {
  const r = await fetch(`/api/rss-feeds/${feedId}`, { method: "DELETE", headers: { "Authorization": `Bearer ${localStorage.getItem("pro_token")}` } });
  if (!r.ok) throw new Error("Failed to delete RSS feed");
  return r.json();
}

async function fetchWPCategories(siteId: number): Promise<{ categories: WPCategory[] }> {
  const r = await fetch(`/api/sites/${siteId}/wp-categories`, { headers: { "Authorization": `Bearer ${localStorage.getItem("pro_token")}` } });
  if (!r.ok) {
    const err = await r.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Failed to fetch categories");
  }
  return r.json();
}

// ── Category selector ──────────────────────────────────────────────────────────

function CategorySelect({
  categories = [],
  value,
  onChange,
  loading,
  onLoad,
  canLoad,
}: {
  categories: WPCategory[];
  value: number | null;
  onChange: (id: number | null, name: string | null) => void;
  loading: boolean;
  onLoad: () => void;
  canLoad: boolean;
}) {
  const safeCategories = Array.isArray(categories) ? categories : [];
  const selected = safeCategories.find((c) => c.id === value);

  if (safeCategories.length === 0) {
    return (
      <div className="flex gap-2">
        <select
          className="flex-1 h-9 rounded-md border border-border bg-background/50 px-3 text-sm text-muted-foreground"
          disabled
        >
          <option>— load categories first —</option>
        </select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onLoad}
          disabled={!canLoad || loading}
          className="h-9 gap-1.5 text-xs"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Load
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <select
        className="flex-1 h-9 rounded-md border border-border bg-background/50 px-3 text-sm"
        value={value ?? ""}
        onChange={(e) => {
          const id = e.target.value ? parseInt(e.target.value) : null;
          const cat = categories.find((c) => c.id === id);
          onChange(id, cat?.name ?? null);
        }}
      >
        <option value="">— No category —</option>
        {/* Top-level (parent=0) */}
        {safeCategories.filter((c) => c.parent === 0).map((parent) => (
          <optgroup key={parent.id} label={parent.name}>
            <option value={parent.id}>{parent.name} ({parent.count})</option>
            {safeCategories.filter((c) => c.parent === parent.id).map((child) => (
              <option key={child.id} value={child.id}>
                &nbsp;&nbsp;↳ {child.name} ({child.count})
              </option>
            ))}
          </optgroup>
        ))}
        {/* Orphan children not shown under a parent */}
        {safeCategories.filter((c) => c.parent !== 0 && !safeCategories.find((p) => p.id === c.parent)).map((c) => (
          <option key={c.id} value={c.id}>{c.name} ({c.count})</option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onLoad}
        disabled={!canLoad || loading}
        className="h-9 px-2"
        title="Reload categories"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
      </Button>
    </div>
  );
}

// ── RSS Feeds manager (shown in edit dialog for existing sites) ────────────────

function RssFeedsManager({
  siteId,
  categories,
  categoriesLoading,
  onLoadCategories,
  wpCredentialsFilled,
}: {
  siteId: number;
  categories: WPCategory[];
  categoriesLoading: boolean;
  onLoadCategories: () => void;
  wpCredentialsFilled: boolean;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<DraftFeed>(EMPTY_DRAFT);
  const [editingFeedId, setEditingFeedId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<RssFeed>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["rss-feeds", siteId],
    queryFn: () => fetchRssFeeds(siteId),
  });

  const addMutation = useMutation({
    mutationFn: (d: DraftFeed) => createRssFeed(siteId, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rss-feeds", siteId] });
      setDraft(EMPTY_DRAFT);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<RssFeed> }) =>
      updateRssFeed(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rss-feeds", siteId] });
      setEditingFeedId(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      updateRssFeed(id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rss-feeds", siteId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRssFeed,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rss-feeds", siteId] }),
  });

  const feeds = data?.feeds ?? [];

  const startEdit = (feed: RssFeed) => {
    setEditingFeedId(feed.id);
    setEditDraft({ ...feed });
  };

  const cancelEdit = () => {
    setEditingFeedId(null);
    setEditDraft({});
  };

  return (
    <div className="border border-border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          RSS Feeds & Categories
        </p>
        <span className="text-xs text-muted-foreground">{feeds.length} feed{feeds.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Existing feeds */}
      {isLoading ? (
        <div className="h-12 rounded bg-background/50 animate-pulse" />
      ) : feeds.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">
          No RSS feeds yet — add one below
        </p>
      ) : (
        <div className="space-y-2">
          {feeds.map((feed) =>
            editingFeedId === feed.id ? (
              <div key={feed.id} className="bg-background/50 border border-primary/30 rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-primary">Editing Feed</p>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="ghost" onClick={cancelEdit} className="h-7 text-xs">
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => updateMutation.mutate({ id: feed.id, data: editDraft })}
                      disabled={updateMutation.isPending}
                      className="h-7 text-xs gap-1"
                    >
                      {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      Save Changes
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">RSS Feed URL</Label>
                    <Input
                      className="bg-background/30 text-sm h-8"
                      value={editDraft.rss_url ?? ""}
                      onChange={(e) => setEditDraft({ ...editDraft, rss_url: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Label (optional)</Label>
                    <Input
                      className="bg-background/30 text-sm h-8"
                      value={editDraft.label ?? ""}
                      onChange={(e) => setEditDraft({ ...editDraft, label: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1.5">
                    <FolderOpen className="w-3 h-3 text-primary" />
                    WordPress Category
                  </Label>
                  <CategorySelect
                    categories={categories}
                    value={editDraft.wp_category_id ?? null}
                    onChange={(id, name) => setEditDraft({ ...editDraft, wp_category_id: id, wp_category_name: name })}
                    loading={categoriesLoading}
                    onLoad={onLoadCategories}
                    canLoad={wpCredentialsFilled}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Poll Hours</Label>
                    <Input
                      type="number"
                      min={0}
                      max={168}
                      className="bg-background/30 text-sm h-8"
                      value={editDraft.poll_hours ?? 4}
                      onChange={(e) => setEditDraft({ ...editDraft, poll_hours: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Poll Minutes</Label>
                    <Input
                      type="number"
                      min={0}
                      max={59}
                      className="bg-background/30 text-sm h-8"
                      value={editDraft.poll_minutes ?? 0}
                      onChange={(e) => setEditDraft({ ...editDraft, poll_minutes: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Max Articles</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      className="bg-background/30 text-sm h-8"
                      value={editDraft.max_articles ?? 0}
                      onChange={(e) => setEditDraft({ ...editDraft, max_articles: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editDraft.is_active ?? true}
                    onCheckedChange={(v) => setEditDraft({ ...editDraft, is_active: v })}
                  />
                  <Label className="text-xs">Active</Label>
                </div>
              </div>
            ) : (
              <div
                key={feed.id}
                className="bg-background/40 rounded-lg p-3 space-y-2 group"
              >
                <div className="flex items-start gap-3">
                  <Switch
                    checked={feed.is_active}
                    onCheckedChange={(v) => toggleMutation.mutate({ id: feed.id, is_active: v })}
                    className="mt-0.5 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {feed.label && (
                        <span className={cn("text-xs font-medium", feed.is_active ? "text-foreground" : "text-muted-foreground")}>{feed.label}</span>
                      )}
                      {feed.wp_category_name && (
                        <span className={cn("inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded", feed.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                          <FolderOpen className="w-2.5 h-2.5" />
                          {feed.wp_category_name}
                        </span>
                      )}
                      {!feed.is_active && (
                        <span className="text-[10px] text-amber-400/70 bg-amber-400/10 px-1.5 py-0.5 rounded font-medium">Paused</span>
                      )}
                    </div>
                    <p className={cn("text-xs truncate mt-0.5", feed.is_active ? "text-muted-foreground" : "text-muted-foreground/50")}>{feed.rss_url}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70 font-mono">
                        <Clock className="w-2.5 h-2.5" />
                        Every {feed.poll_hours > 0 ? `${feed.poll_hours}h` : ""}{feed.poll_minutes > 0 ? `${feed.poll_minutes}m` : ""}{feed.poll_hours === 0 && feed.poll_minutes === 0 ? "4h" : ""}
                      </span>
                      {feed.max_articles > 0 && (
                        <span className="text-[10px] text-muted-foreground/70 font-mono">
                          Max {feed.max_articles} per window
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(feed)}
                      className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                      title="Edit feed"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(feed.id)}
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      title="Delete feed"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* Add new feed form */}
      <div className="border border-dashed border-border rounded-lg p-3 space-y-3">
        <p className="text-xs text-muted-foreground font-medium">Add RSS Feed</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">RSS Feed URL *</Label>
            <Input
              className="bg-background/30 text-sm h-8"
              placeholder="https://site.com/feed"
              value={draft.rss_url}
              onChange={(e) => setDraft({ ...draft, rss_url: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Label (optional)</Label>
            <Input
              className="bg-background/30 text-sm h-8"
              placeholder="Tech News"
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1.5">
            <FolderOpen className="w-3 h-3 text-primary" />
            WordPress Category
            {!wpCredentialsFilled && (
              <span className="text-muted-foreground/60 font-normal">(save WP credentials first)</span>
            )}
          </Label>
          <CategorySelect
            categories={categories}
            value={draft.wp_category_id}
            onChange={(id, name) => setDraft({ ...draft, wp_category_id: id, wp_category_name: name })}
            loading={categoriesLoading}
            onLoad={onLoadCategories}
            canLoad={wpCredentialsFilled}
          />
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Poll Hours</Label>
            <Input
              type="number"
              min={0}
              max={168}
              className="bg-background/30 text-sm h-8"
              value={draft.poll_hours}
              onChange={(e) => setDraft({ ...draft, poll_hours: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Poll Minutes</Label>
            <Input
              type="number"
              min={0}
              max={59}
              className="bg-background/30 text-sm h-8"
              value={draft.poll_minutes}
              onChange={(e) => setDraft({ ...draft, poll_minutes: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs" title="0 = unlimited">Max (0=∞)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              className="bg-background/30 text-sm h-8"
              value={draft.max_articles}
              onChange={(e) => setDraft({ ...draft, max_articles: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              size="sm"
              onClick={() => draft.rss_url && addMutation.mutate(draft)}
              disabled={!draft.rss_url || addMutation.isPending}
              className="h-8 w-full gap-1.5 text-xs"
            >
              {addMutation.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Plus className="w-3 h-3" />
              )}
              Add Feed
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Sites component ────────────────────────────────────────────────────────

const AUTH = () => ({ "Authorization": `Bearer ${localStorage.getItem("pro_token")}` });

async function fetchSubscription() {
  const r = await fetch(`${BASE_URL}api/subscription`, { headers: AUTH() });
  if (!r.ok) return null;
  return r.json();
}

export default function Sites() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editSite, setEditSite] = useState<Site | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [savedSiteId, setSavedSiteId] = useState<number | null>(null);
  const [categories, setCategories] = useState<WPCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["sites"],
    queryFn: fetchSites,
    refetchInterval: 10000,
  });

  const { data: subData } = useQuery({
    queryKey: ["subscription"],
    queryFn: fetchSubscription,
    staleTime: 30000,
  });

  const { toast } = useToast();

  // ── Plan limit enforcement (UI layer) ────────────────────────────────────
  const usage = subData?.usage;
  const sitesLimit: number = usage?.sites_limit ?? 0;
  const hasBlogAutomation: boolean = usage?.has_blog_automation ?? false;
  const sites: Site[] = data?.sites ?? [];
  const sitesUsed = sites.length;
  const atLimit = hasBlogAutomation && sitesLimit > 0 && sitesUsed >= sitesLimit;
  const noBlogPlan = !hasBlogAutomation;
  const canAddSite = !noBlogPlan && !atLimit;

  const createMutation = useMutation({
    mutationFn: createSite,
    onSuccess: (site) => {
      qc.invalidateQueries({ queryKey: ["sites"] });
      qc.invalidateQueries({ queryKey: ["subscription"] });
      setSavedSiteId(site.id);
      setEditSite(site);
      toast({
        title: "Site Created",
        description: "Site has been successfully created. You can now add RSS feeds.",
      });
    },
    onError: (err) => {
      toast({
        title: "Error creating site",
        description: err instanceof Error ? err.message : "Failed to create site. Please check your data.",
        variant: "destructive",
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<typeof EMPTY_FORM> }) =>
      updateSite(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sites"] });
      closeForm();
    },
  });

  const toggleSiteMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<typeof EMPTY_FORM> }) =>
      updateSite(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sites"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSite,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sites"] }); setDeleteId(null); },
  });

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditSite(null);
    setSavedSiteId(null);
    setCategories([]);
    setCategoriesError(null);
    setShowPassword(false);
    setShowForm(true);
  };

  const openEdit = (site: Site) => {
    setForm({
      name: site.name,
      wp_url: site.wp_url,
      wp_username: site.wp_username,
      wp_password: site.wp_password,
      rss_feed_url: site.rss_feed_url ?? "",
      rss_poll_hours: site.rss_poll_hours,
      css_selector_content: site.css_selector_content ?? ".single-content",
      css_selector_image: site.css_selector_image ?? ".wp-site-blocks .post-thumbnail img",
      auto_publish: site.auto_publish,
      is_active: site.is_active,
    });
    setEditSite(site);
    setSavedSiteId(site.id);
    setCategories([]);
    setCategoriesError(null);
    setShowPassword(false);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditSite(null);
    setSavedSiteId(null);
    setCategories([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Manual validation to fix hidden HTML5 validation tooltips in Dialog
    if (!form.name || !form.wp_url || !form.wp_username || (!editSite && !form.wp_password)) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields (Site Name, WordPress URL, Username, and Password).",
        variant: "destructive",
      });
      return;
    }

    if (editSite) {
      updateMutation.mutate({ id: editSite.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const loadCategories = async () => {
    const siteId = savedSiteId ?? editSite?.id;
    if (!siteId) return;
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      const { categories: cats } = await fetchWPCategories(siteId);
      setCategories(Array.isArray(cats) ? cats : []);
    } catch (err) {
      setCategoriesError(err instanceof Error ? err.message : "Failed to load categories");
    } finally {
      setCategoriesLoading(false);
    }
  };

  const wpCredentialsFilled = !!(form.wp_url && form.wp_username && form.wp_password);
  const currentSiteId = savedSiteId ?? editSite?.id ?? null;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sites</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your WordPress sites and RSS sources
            {hasBlogAutomation && sitesLimit > 0 && (
              <span className="ml-2 text-xs text-muted-foreground/60">
                ({sitesUsed}/{sitesLimit} used)
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button
            onClick={canAddSite ? openCreate : undefined}
            disabled={!canAddSite}
            className="gap-2"
            title={
              noBlogPlan
                ? "Blog Automation is not included in your current plan"
                : atLimit
                  ? `You have reached the maximum number of sites (${sitesLimit}) on your plan`
                  : undefined
            }
          >
            {canAddSite ? <Plus className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            Add Site
          </Button>
          {(noBlogPlan || atLimit) && (
            <span className="text-[11px] text-amber-400/80">
              {noBlogPlan ? "Upgrade to add sites" : `Limit reached (${sitesUsed}/${sitesLimit})`}
            </span>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-lg bg-card animate-pulse" />
          ))}
        </div>
      ) : sites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Globe className="w-12 h-12 text-muted-foreground/30 mb-4" />
          {noBlogPlan ? (
            <>
              <p className="text-muted-foreground">Blog Automation is not included in your current plan.</p>
              <p className="text-sm text-amber-400/80 mt-1">Upgrade your plan to add WordPress sites.</p>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">No sites yet. Add your first WordPress site.</p>
              <Button onClick={openCreate} className="mt-4 gap-2" variant="outline" disabled={!canAddSite}>
                <Plus className="w-4 h-4" /> Add Site
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sites.map((site) => (
            <SiteCard
              key={site.id}
              site={site}
              onEdit={() => openEdit(site)}
              onDelete={() => setDeleteId(site.id)}
              onToggle={(active) => toggleSiteMutation.mutate({ id: site.id, data: { is_active: active } })}
            />
          ))}
        </div>
      )}

      {/* Site Dialog */}
      <Dialog open={showForm} onOpenChange={(v) => !v && closeForm()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editSite ? "Edit Site" : "Add New Site"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5 pt-2">
            {/* Site name */}
            <div className="space-y-1.5">
              <Label>Site Name</Label>
              <Input
                placeholder="My Tech Blog"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="bg-background/50"
              />
            </div>

            {/* WordPress credentials */}
            <div className="border border-border rounded-lg p-4 space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                WordPress
              </p>
              <div className="space-y-1.5">
                <Label>WordPress URL</Label>
                <Input
                  placeholder="https://myblog.com"
                  value={form.wp_url}
                  onChange={(e) => setForm({ ...form, wp_url: e.target.value })}
                  className="bg-background/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Username</Label>
                  <Input
                    placeholder="admin"
                    value={form.wp_username}
                    onChange={(e) => setForm({ ...form, wp_username: e.target.value })}
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>App Password</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="xxxx xxxx xxxx xxxx"
                      value={form.wp_password}
                      onChange={(e) => setForm({ ...form, wp_password: e.target.value })}
                      className="bg-background/50 pr-16"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Selectors */}
            <div className="border border-border rounded-lg p-4 space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Content Selectors (CSS)
              </p>
              <div className="space-y-1.5">
                <Label>Content CSS Selector</Label>
                <Input
                  placeholder=".single-content"
                  value={form.css_selector_content}
                  onChange={(e) => setForm({ ...form, css_selector_content: e.target.value })}
                  className="bg-background/50 font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Featured Image CSS Selector</Label>
                <Input
                  placeholder=".post-thumbnail img"
                  value={form.css_selector_image}
                  onChange={(e) => setForm({ ...form, css_selector_image: e.target.value })}
                  className="bg-background/50 font-mono text-sm"
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.auto_publish}
                  onCheckedChange={(v) => setForm({ ...form, auto_publish: v })}
                />
                <Label>Auto-publish to WordPress</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
                <Label>Active</Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={closeForm}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                {editSite ? (currentSiteId && !createMutation.isPending ? "Save Changes" : "Saving…") : "Create & Continue"}
              </Button>
            </DialogFooter>
          </form>

          {/* RSS Feeds section — only shown after site is created/saved */}
          {currentSiteId && (
            <div className="border-t border-border pt-5 mt-1">
              {categoriesError && (
                <div className="mb-3 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 flex items-center gap-2">
                  <X className="w-3 h-3" />
                  {categoriesError}
                </div>
              )}
              <RssFeedsManager
                siteId={currentSiteId}
                categories={categories}
                categoriesLoading={categoriesLoading}
                onLoadCategories={loadCategories}
                wpCredentialsFilled={wpCredentialsFilled}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Site</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the site, all its RSS feeds, and agent prompts. Articles
              will be kept but unlinked. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Site card ──────────────────────────────────────────────────────────────────

function SiteCard({
  site,
  onEdit,
  onDelete,
  onToggle,
}: {
  site: Site;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (active: boolean) => void;
}) {
  const { data } = useQuery({
    queryKey: ["rss-feeds", site.id],
    queryFn: () => fetchRssFeeds(site.id),
  });
  const feeds = data?.feeds ?? [];

  const [rankMathStatus, setRankMathStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [rankMathMsg, setRankMathMsg] = useState<string>("");

  const syncRankMath = async () => {
    setRankMathStatus("running");
    setRankMathMsg("");
    try {
      const r = await fetch(`/api/sites/${site.id}/rank-math/bulk`, { method: "POST", headers: { "Authorization": `Bearer ${localStorage.getItem("pro_token")}` } });
      const j = await r.json() as { queued?: number; message?: string; error?: string };
      if (!r.ok) throw new Error(j.error ?? "Failed");
      setRankMathStatus("done");
      setRankMathMsg(`${j.queued ?? 0} articles queued`);
    } catch (e) {
      setRankMathStatus("error");
      setRankMathMsg(e instanceof Error ? e.message : "Error");
    }
  };

  return (
    <div
      className={cn(
        "bg-card border border-border rounded-lg p-5 flex flex-col gap-4 transition-all",
        !site.is_active && "opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <Switch
            checked={site.is_active}
            onCheckedChange={onToggle}
            className="flex-shrink-0 mt-0.5"
          />
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">{site.name}</p>
            <p className="text-xs text-muted-foreground truncate">{site.wp_url}</p>
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* RSS feeds summary */}
      <div className="space-y-1.5">
        {feeds.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Rss className="w-3.5 h-3.5" />
            <span className="truncate">
              {site.rss_feed_url || "No RSS feeds configured"}
            </span>
          </div>
        ) : (
          feeds.slice(0, 3).map((feed) => (
            <div key={feed.id} className="flex items-center gap-2 text-xs text-muted-foreground">
              <Rss className={cn("w-3 h-3 flex-shrink-0", feed.is_active ? "text-primary" : "text-muted-foreground/40")} />
              <span className="truncate flex-1">
                {feed.label || feed.rss_url}
              </span>
              {feed.wp_category_name && (
                <span className="flex-shrink-0 text-primary/70 bg-primary/10 px-1.5 rounded text-[10px]">
                  {feed.wp_category_name}
                </span>
              )}
            </div>
          ))
        )}
        {feeds.length > 3 && (
          <p className="text-xs text-muted-foreground/60 pl-5">+{feeds.length - 3} more</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {!site.is_active && (
            <Badge variant="outline" className="text-xs border-0 bg-amber-500/10 text-amber-400">
              Paused
            </Badge>
          )}
          {site.auto_publish && (
            <Badge variant="outline" className="text-xs border-0 bg-primary/10 text-primary">
              Auto-publish
            </Badge>
          )}
          {feeds.length > 0 && (
            <Badge variant="outline" className="text-xs border-0 bg-slate-500/10 text-slate-400">
              {feeds.length} feed{feeds.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {site.article_count ?? 0} articles
        </span>
      </div>

      <div className="flex gap-2">
        <Link
          href={`/sites/${site.id}/agents`}
          className="flex items-center justify-center gap-2 flex-1 py-2 rounded-md border border-border text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
        >
          <Bot className="w-3.5 h-3.5" />
          AI Agents
        </Link>
        <button
          onClick={syncRankMath}
          disabled={rankMathStatus === "running"}
          title="Re-apply Rank Math SEO to all published articles"
          className={cn(
            "flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border text-xs transition-colors",
            rankMathStatus === "done"
              ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
              : rankMathStatus === "error"
              ? "border-rose-500/40 text-rose-400 bg-rose-500/10"
              : "border-border text-muted-foreground hover:border-amber-500/50 hover:text-amber-400"
          )}
        >
          {rankMathStatus === "running" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <BarChart2 className="w-3.5 h-3.5" />
          )}
          {rankMathStatus === "done" ? rankMathMsg : rankMathStatus === "error" ? "Error" : "Rank Math"}
        </button>
      </div>
    </div>
  );
}
