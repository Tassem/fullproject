import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Rss, Plus, Trash2, Globe, Clock, Pencil, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface RssFeed {
  id: number;
  site_id: number;
  rss_url: string;
  label: string | null;
  wp_category_name: string | null;
  poll_hours: number;
  poll_minutes: number;
  max_articles: number;
  is_active: boolean;
  last_polled_at: string | null;
  created_at: string;
}

interface Site {
  id: number;
  name: string;
  domain: string | null;
}

const AUTH = () => ({ Authorization: `Bearer ${localStorage.getItem("pro_token")}` });

export default function RssFeeds() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    rss_url: "", label: "", wp_category_name: "",
    poll_hours: 4, poll_minutes: 0, max_articles: 0,
  });

  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ["sites"],
    queryFn: async () => {
      const r = await fetch("/api/sites", { headers: AUTH() });
      if (!r.ok) return [];
      return r.json();
    },
    select: (data: any) => Array.isArray(data) ? data : (data?.sites ?? []),
  });

  const { data: feeds = [], isLoading } = useQuery<RssFeed[]>({
    queryKey: ["rss", selectedSiteId],
    queryFn: async () => {
      if (!selectedSiteId) {
        const r = await fetch("/api/rss", { headers: AUTH() });
        return r.json();
      }
      const r = await fetch(`/api/rss/site/${selectedSiteId}`, { headers: AUTH() });
      return r.json();
    },
    enabled: true,
  });

  const addFeed = useMutation({
    mutationFn: async () => {
      if (!selectedSiteId) throw new Error("Select a site first");
      const r = await fetch("/api/rss", {
        method: "POST",
        headers: { ...AUTH(), "Content-Type": "application/json" },
        body: JSON.stringify({ site_id: selectedSiteId, ...form }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed to add");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rss"] });
      setShowAdd(false);
      setForm({ rss_url: "", label: "", wp_category_name: "", poll_hours: 4, poll_minutes: 0, max_articles: 0 });
      toast({ title: "RSS feed added" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleFeed = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/rss/${id}/toggle`, { method: "PATCH", headers: AUTH() });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rss"] }),
  });

  const deleteFeed = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/rss/${id}`, { method: "DELETE", headers: AUTH() });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rss"] });
      toast({ title: "Feed removed" });
    },
  });

  const updateFeed = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof form }) => {
      const r = await fetch(`/api/rss/${id}`, {
        method: "PUT",
        headers: { ...AUTH(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed to update");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rss"] });
      setEditingId(null);
      toast({ title: "Feed updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function startEdit(feed: RssFeed) {
    setEditingId(feed.id);
    setForm({
      rss_url: feed.rss_url,
      label: feed.label ?? "",
      wp_category_name: feed.wp_category_name ?? "",
      poll_hours: feed.poll_hours,
      poll_minutes: feed.poll_minutes,
      max_articles: feed.max_articles,
    });
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Rss className="w-5 h-5 text-orange-400" /> RSS Feeds
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Monitor RSS feeds and auto-generate articles</p>
        </div>
        <Button
          onClick={() => setShowAdd(true)}
          disabled={!selectedSiteId}
          className="gap-2 bg-orange-600 hover:bg-orange-700 text-white"
        >
          <Plus className="w-4 h-4" /> Add Feed
        </Button>
      </div>

      {/* Site selector */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedSiteId(null)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-sm font-medium border transition-all",
            selectedSiteId === null
              ? "border-orange-500 bg-orange-500/10 text-orange-400"
              : "border-border text-muted-foreground hover:border-border/80"
          )}
        >
          All Sites
        </button>
        {(Array.isArray(sites) ? sites : []).map(s => (
          <button
            key={s.id}
            onClick={() => setSelectedSiteId(s.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium border transition-all flex items-center gap-1.5",
              selectedSiteId === s.id
                ? "border-orange-500 bg-orange-500/10 text-orange-400"
                : "border-border text-muted-foreground hover:border-border/80"
            )}
          >
            <Globe className="w-3 h-3" />{s.name}
          </button>
        ))}
      </div>

      {/* Add Feed Form */}
      {showAdd && (
        <div className="p-5 rounded-xl border border-orange-500/30 bg-orange-500/5 space-y-4">
          <h3 className="font-semibold text-foreground text-sm">New RSS Feed</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">RSS URL *</Label>
              <Input
                value={form.rss_url}
                onChange={e => setForm(f => ({ ...f, rss_url: e.target.value }))}
                placeholder="https://example.com/feed"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Label</Label>
              <Input
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="My Feed"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">WP Category Name</Label>
              <Input
                value={form.wp_category_name}
                onChange={e => setForm(f => ({ ...f, wp_category_name: e.target.value }))}
                placeholder="News"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Max Articles (0 = unlimited)</Label>
              <Input
                type="number"
                min={0}
                value={form.max_articles}
                onChange={e => setForm(f => ({ ...f, max_articles: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Poll every (hours)</Label>
              <Input
                type="number"
                min={1}
                max={168}
                value={form.poll_hours}
                onChange={e => setForm(f => ({ ...f, poll_hours: parseInt(e.target.value) || 4 }))}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button
              onClick={() => addFeed.mutate()}
              disabled={!form.rss_url || addFeed.isPending}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {addFeed.isPending ? "Adding..." : "Add Feed"}
            </Button>
          </div>
        </div>
      )}

      {/* Feeds list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-xl bg-card animate-pulse border border-border" />
          ))}
        </div>
      ) : feeds.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-dashed border-border">
          <Rss className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No RSS feeds yet</p>
          <p className="text-muted-foreground/60 text-sm mt-1">Select a site and add your first feed</p>
        </div>
      ) : (
        <div className="space-y-3">
          {feeds.map(feed => (
            <div
              key={feed.id}
              className={cn(
                "p-4 rounded-xl border transition-all",
                feed.is_active ? "border-border bg-card" : "border-border/50 bg-card/50 opacity-60"
              )}
            >
              {editingId === feed.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">URL</Label>
                      <Input
                        value={form.rss_url}
                        onChange={e => setForm(f => ({ ...f, rss_url: e.target.value }))}
                        className="h-8 text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Label</Label>
                      <Input
                        value={form.label}
                        onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                        className="h-8 text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">WP Category</Label>
                      <Input
                        value={form.wp_category_name}
                        onChange={e => setForm(f => ({ ...f, wp_category_name: e.target.value }))}
                        className="h-8 text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Poll Hours</Label>
                      <Input
                        type="number"
                        value={form.poll_hours}
                        onChange={e => setForm(f => ({ ...f, poll_hours: +e.target.value }))}
                        className="h-8 text-xs mt-1"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      <X className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      className="bg-orange-600 hover:bg-orange-700 text-white h-7 text-xs gap-1"
                      onClick={() => updateFeed.mutate({ id: feed.id, data: form })}
                      disabled={updateFeed.isPending}
                    >
                      <Save className="w-3 h-3" /> Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground text-sm truncate">
                        {feed.label || feed.rss_url}
                      </span>
                      {feed.wp_category_name && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {feed.wp_category_name}
                        </span>
                      )}
                    </div>
                    {feed.label && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{feed.rss_url}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />Every {feed.poll_hours}h
                      </span>
                      {feed.max_articles > 0 && (
                        <span className="text-[10px] text-muted-foreground">Max {feed.max_articles} articles</span>
                      )}
                      {feed.last_polled_at && (
                        <span className="text-[10px] text-muted-foreground">
                          Last: {new Date(feed.last_polled_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={feed.is_active}
                      onCheckedChange={() => toggleFeed.mutate(feed.id)}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => startEdit(feed)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-red-400 hover:text-red-300"
                      onClick={() => deleteFeed.mutate(feed.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
