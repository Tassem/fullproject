import { useState } from "react";
import { useListArticles, useCreateArticle, useDeleteArticle, useRetryArticle, getListArticlesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus, RefreshCw, Trash2, ExternalLink, ChevronLeft, ChevronRight,
  X, Link2, Search, ImageIcon, FileText, Globe, BarChart2,
  ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Clock, Loader2,
  Zap, Tag, Star,
} from "lucide-react";
import { cn, formatDate, getStatusColor } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { BASE_URL } from "@/lib/api";

interface ArticleDetail {
  id: number;
  rss_link: string;
  competitor_title?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  permalink_slug?: string | null;
  primary_keyword?: string | null;
  secondary_keywords?: string | null;
  keyword_strategy?: string | null;
  content_gaps?: string | null;
  content_structure?: string | null;
  internal_links?: { text: string; url: string }[] | null;
  external_links?: { text: string; url: string }[] | null;
  image_prompt?: string | null;
  competitor_image_url?: string | null;
  generated_image_url?: string | null;
  final_image_url?: string | null;
  article_html?: string | null;
  content_status: string;
  image_status: string;
  article_status: string;
  wp_post_url?: string | null;
  wp_post_id?: number | null;
  error_message?: string | null;
  created_at: string;
  updated_at?: string | null;
  site_id?: number | null;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("px-2 py-0.5 rounded text-xs font-medium font-mono border", getStatusColor(status))}>
      {status}
    </span>
  );
}

function StageIcon({ stage }: { stage: string }) {
  const icons: Record<string, React.ReactNode> = {
    keyword_research: <Search className="w-3.5 h-3.5" />,
    title_gen: <FileText className="w-3.5 h-3.5" />,
    description_gen: <FileText className="w-3.5 h-3.5" />,
    internal_links: <Link2 className="w-3.5 h-3.5" />,
    external_links: <Globe className="w-3.5 h-3.5" />,
    image_analysis: <ImageIcon className="w-3.5 h-3.5" />,
    image_generation: <Zap className="w-3.5 h-3.5" />,
    article_write: <FileText className="w-3.5 h-3.5" />,
    competitor_analysis: <BarChart2 className="w-3.5 h-3.5" />,
    rank_math: <Tag className="w-3.5 h-3.5" />,
  };
  return <>{icons[stage] ?? <Clock className="w-3.5 h-3.5" />}</>;
}

interface PipelineLog {
  id: number;
  stage: string;
  status: string;
  message?: string | null;
  duration_ms?: number | null;
  created_at: string;
}

function ArticleDetailsPanel({ article, onClose }: { article: ArticleDetail; onClose: () => void }) {
  const [logs, setLogs] = useState<PipelineLog[] | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showHtml, setShowHtml] = useState(false);
  const [reRankMathLoading, setReRankMathLoading] = useState(false);
  const [reRankMathResult, setReRankMathResult] = useState<{ ok: boolean; focus_keyword?: string; error?: string } | null>(null);
  const { toast } = useToast();

  const handleReRankMath = async () => {
    setReRankMathLoading(true);
    setReRankMathResult(null);
    try {
      const r = await fetch(`/api/articles/${article.id}/rank-math`, { method: "POST", headers: { "Authorization": `Bearer ${localStorage.getItem("pro_token")}` } });
      const data = await r.json() as { ok?: boolean; focus_keyword?: string; error?: string };
      if (data.ok) {
        setReRankMathResult({ ok: true, focus_keyword: data.focus_keyword });
        toast({ title: "Rank Math Updated", description: `Focus keyword: "${data.focus_keyword}"` });
      } else {
        setReRankMathResult({ ok: false, error: data.error });
        toast({ title: "Rank Math Failed", description: data.error ?? "Unknown error", variant: "destructive" });
      }
    } catch (e) {
      setReRankMathResult({ ok: false, error: "Network error" });
      toast({ title: "Error", description: "Could not reach the server", variant: "destructive" });
    } finally {
      setReRankMathLoading(false);
    }
  };

  const loadLogs = async () => {
    if (logs) return;
    setLogsLoading(true);
    try {
      const r = await fetch(`/api/logs?article_id=${article.id}&limit=50`, { headers: { "Authorization": `Bearer ${localStorage.getItem("pro_token")}` } });
      const data = await r.json() as { logs: PipelineLog[] };
      setLogs(data.logs ?? []);
    } catch {
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  const keywords = article.secondary_keywords
    ? article.secondary_keywords.split(",").map(k => k.trim()).filter(Boolean)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl h-full bg-card border-l border-border overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card border-b border-border px-5 py-4 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground text-sm leading-snug">
              {article.meta_title ?? article.competitor_title ?? "Untitled Article"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{article.rss_link}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-accent flex-shrink-0">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Status row */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Content:</span><StatusBadge status={article.content_status} />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Image:</span><StatusBadge status={article.image_status} />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Article:</span><StatusBadge status={article.article_status} />
            </div>
            <div className="ml-auto flex items-center gap-2">
              {article.wp_post_url && (
                <a href={article.wp_post_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                  <ExternalLink className="w-3 h-3" /> WordPress
                </a>
              )}
              {article.wp_post_id && (
                <button
                  onClick={handleReRankMath}
                  disabled={reRankMathLoading}
                  title="Re-apply Rank Math SEO meta to this post"
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
                >
                  {reRankMathLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Star className="w-3 h-3" />}
                  {reRankMathLoading ? "Updating..." : "Re-apply Rank Math"}
                </button>
              )}
            </div>
          </div>

          {/* Rank Math result feedback */}
          {reRankMathResult && (
            <div className={cn(
              "flex items-start gap-2 rounded-lg px-3 py-2 text-xs",
              reRankMathResult.ok
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                : "bg-rose-500/10 border border-rose-500/20 text-rose-400"
            )}>
              {reRankMathResult.ok
                ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
              <span>
                {reRankMathResult.ok
                  ? `Rank Math updated — Focus keyword: "${reRankMathResult.focus_keyword}"`
                  : `Failed: ${reRankMathResult.error}`}
              </span>
            </div>
          )}

          {/* Error */}
          {article.error_message && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 flex gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-rose-300">{article.error_message}</p>
            </div>
          )}

          {/* ── Keyword Research ──────────────────────────────── */}
          <Section title="Keyword Research" icon={<Search className="w-4 h-4" />}>
            {article.primary_keyword ? (
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Primary Keyword</p>
                  <span className="inline-flex items-center gap-1 bg-primary/15 text-primary text-xs font-medium px-2.5 py-1 rounded-full">
                    <Tag className="w-3 h-3" />{article.primary_keyword}
                  </span>
                </div>
                {keywords.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Secondary Keywords ({keywords.length})</p>
                    <div className="flex flex-wrap gap-1.5">
                      {keywords.map((kw, i) => (
                        <span key={i} className="bg-slate-700/60 text-slate-300 text-xs px-2 py-0.5 rounded">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {article.keyword_strategy && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Keyword Strategy</p>
                    <p className="text-xs text-foreground/80 leading-relaxed">{article.keyword_strategy}</p>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState label="No keywords researched yet" />
            )}
          </Section>

          {/* ── Title Generator ───────────────────────────────── */}
          <Section title="Title Generator" icon={<FileText className="w-4 h-4" />}>
            {article.meta_title ? (
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">SEO Title</p>
                  <p className="text-sm font-medium text-foreground">{article.meta_title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{article.meta_title.length} chars</p>
                </div>
                {article.meta_description && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Meta Description</p>
                    <p className="text-xs text-foreground/80">{article.meta_description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{article.meta_description.length} chars</p>
                  </div>
                )}
                {article.permalink_slug && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Permalink Slug</p>
                    <code className="text-xs bg-background/50 text-emerald-400 px-2 py-0.5 rounded font-mono">
                      /{article.permalink_slug}
                    </code>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState label="Title not generated yet" />
            )}
          </Section>

          {/* ── Competitor Analysis ───────────────────────────── */}
          {(article.content_gaps || article.content_structure) && (
            <Section title="Competitor Analysis" icon={<BarChart2 className="w-4 h-4" />}>
              <div className="space-y-2">
                {article.content_gaps && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Content Gaps</p>
                    <p className="text-xs text-foreground/80 leading-relaxed">{article.content_gaps.slice(0, 400)}</p>
                  </div>
                )}
                {article.content_structure && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Content Structure</p>
                    <p className="text-xs text-foreground/80 leading-relaxed">{article.content_structure.slice(0, 400)}</p>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* ── Internal Linking ─────────────────────────────── */}
          <Section title="Internal Linking" icon={<Link2 className="w-4 h-4" />}>
            {Array.isArray(article.internal_links) && article.internal_links.length > 0 ? (
              <div className="space-y-1.5">
                {(article.internal_links as { text: string; url: string }[]).map((link, i) => (
                  <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-start gap-2 text-xs text-primary hover:underline group">
                    <Link2 className="w-3 h-3 mt-0.5 flex-shrink-0 group-hover:text-primary/70" />
                    <span>{link.text || link.url}</span>
                  </a>
                ))}
              </div>
            ) : (
              <EmptyState label="No internal links found yet" />
            )}
          </Section>

          {/* ── External Linking ─────────────────────────────── */}
          <Section title="External Linking" icon={<Globe className="w-4 h-4" />}>
            {Array.isArray(article.external_links) && article.external_links.length > 0 ? (
              <div className="space-y-1.5">
                {(article.external_links as { text: string; url: string }[]).map((link, i) => (
                  <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-start gap-2 text-xs text-blue-400 hover:underline group">
                    <Globe className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>{link.text || link.url}</span>
                  </a>
                ))}
              </div>
            ) : (
              <EmptyState label="No external links found yet" />
            )}
          </Section>

          {/* ── Image Analysis ───────────────────────────────── */}
          <Section title="Image Analysis" icon={<ImageIcon className="w-4 h-4" />}>
            <div className="space-y-3">
              {article.competitor_image_url && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Competitor Image</p>
                  <img src={article.competitor_image_url} alt="Competitor"
                    className="w-full h-32 object-cover rounded-lg border border-border" />
                </div>
              )}
              {article.image_prompt && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Generated Prompt</p>
                  <p className="text-xs text-foreground/80 italic leading-relaxed bg-background/40 p-2 rounded">
                    {article.image_prompt}
                  </p>
                </div>
              )}
              {(article.generated_image_url || article.final_image_url) && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Generated Image</p>
                  <img src={article.final_image_url ?? article.generated_image_url ?? ""} alt="Generated"
                    className="w-full h-32 object-cover rounded-lg border border-border" />
                </div>
              )}
              {!article.image_prompt && !article.competitor_image_url && (
                <EmptyState label="Image analysis not run yet" />
              )}
            </div>
          </Section>

          {/* ── Article Writer ───────────────────────────────── */}
          <Section title="Article Writer" icon={<FileText className="w-4 h-4" />}>
            {article.article_html ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {article.article_html.replace(/<[^>]+>/g, "").split(/\s+/).filter(Boolean).length} words
                  </p>
                  <button
                    onClick={() => setShowHtml(!showHtml)}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    {showHtml ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {showHtml ? "Hide HTML" : "Show HTML"}
                  </button>
                </div>
                {showHtml && (
                  <pre className="text-xs text-foreground/70 bg-background/50 p-3 rounded-lg overflow-auto max-h-64 font-mono whitespace-pre-wrap">
                    {article.article_html.slice(0, 3000)}
                    {article.article_html.length > 3000 && "\n... [truncated]"}
                  </pre>
                )}
                {!showHtml && (
                  <p className="text-xs text-foreground/70 leading-relaxed line-clamp-3">
                    {article.article_html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200)}...
                  </p>
                )}
              </div>
            ) : (
              <EmptyState label="Article not written yet" />
            )}
          </Section>

          {/* ── Pipeline Logs ────────────────────────────────── */}
          <Section
            title="Pipeline Execution Logs"
            icon={<Clock className="w-4 h-4" />}
            onExpand={loadLogs}
            defaultCollapsed
          >
            {logsLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading logs...
              </div>
            ) : logs && logs.length > 0 ? (
              <div className="space-y-1.5">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2.5 text-xs">
                    {log.status === "success" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    ) : log.status === "failed" ? (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground font-mono">{log.stage}</span>
                        {log.duration_ms && (
                          <span className="text-muted-foreground">{log.duration_ms}ms</span>
                        )}
                      </div>
                      {log.message && (
                        <p className="text-muted-foreground mt-0.5 leading-relaxed">{log.message}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : logs !== null ? (
              <EmptyState label="No logs found" />
            ) : null}
          </Section>

          <p className="text-xs text-muted-foreground text-center">
            Created {formatDate(article.created_at)}
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
  onExpand,
  defaultCollapsed = false,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onExpand?: () => void;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const toggle = () => {
    if (collapsed && onExpand) onExpand();
    setCollapsed(!collapsed);
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-background/30 hover:bg-background/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-primary">{icon}</span>
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">{title}</span>
        </div>
        {collapsed ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
      {!collapsed && (
        <div className="px-4 py-3">
          {children}
        </div>
      )}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <p className="text-xs text-muted-foreground/60 italic text-center py-2">{label}</p>
  );
}

// ── Main Articles Component ────────────────────────────────────────────────────

export function Articles() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<ArticleDetail | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const limit = 25;
  const params = { page, limit, ...(statusFilter ? { status: statusFilter } : {}) };
  const query = useListArticles(params, { query: { queryKey: getListArticlesQueryKey(params) } });

  const createMutation = useCreateArticle({
    mutation: {
      onSuccess: () => {
        toast({ title: "Article added", description: "Article has been queued for processing." });
        qc.invalidateQueries({ queryKey: getListArticlesQueryKey({}) });
        setShowAddForm(false);
        setNewUrl("");
      },
      onError: () => toast({ title: "Error", description: "Failed to add article.", variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteArticle({
    mutation: {
      onSuccess: () => {
        toast({ title: "Deleted", description: "Article removed." });
        qc.invalidateQueries({ queryKey: getListArticlesQueryKey({}) });
        if (selectedArticle) setSelectedArticle(null);
      },
    },
  });

  const retryMutation = useRetryArticle({
    mutation: {
      onSuccess: () => {
        toast({ title: "Retrying", description: "Article queued for retry." });
        qc.invalidateQueries({ queryKey: getListArticlesQueryKey({}) });
      },
    },
  });

  const articles = query.data?.articles ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const statuses = ["", "pending", "completed", "failed", "scraping", "analyzing", "seo", "writing", "publishing"];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Articles</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} articles total</p>
        </div>
        <button
          data-testid="button-add-article"
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Add Article
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="bg-card border border-card-border rounded-lg p-4 flex gap-3">
          <input
            data-testid="input-rss-url"
            type="url"
            placeholder="https://example.com/article-url"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="flex-1 bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            data-testid="button-submit-article"
            onClick={() => createMutation.mutate({ data: { rss_link: newUrl } })}
            disabled={!newUrl || createMutation.isPending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {createMutation.isPending ? "Adding..." : "Add"}
          </button>
          <button onClick={() => setShowAddForm(false)} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
        </div>
      )}

      {/* Status Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-xs text-muted-foreground font-medium">Filter:</span>
        {statuses.map((s) => (
          <button
            key={s}
            data-testid={`filter-${s || "all"}`}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
              statusFilter === s
                ? "bg-primary text-primary-foreground border-primary"
                : "text-muted-foreground border-border hover:text-foreground"
            )}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide w-8">#</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Title / URL</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Keywords</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Pipeline</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Date</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {query.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-6" /></td>
                  <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-48" /></td>
                  <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-32" /></td>
                  <td className="px-4 py-3"><div className="h-5 bg-muted rounded w-24" /></td>
                  <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-20" /></td>
                  <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-8" /></td>
                </tr>
              ))
            ) : articles.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-sm text-muted-foreground">
                  No articles found.
                </td>
              </tr>
            ) : (
              (articles as ArticleDetail[]).map((article) => {
                const isSelected = selectedArticle?.id === article.id;
                const primaryKw = article.primary_keyword;
                const secondaryKws = article.secondary_keywords
                  ? article.secondary_keywords.split(",").map(k => k.trim()).filter(Boolean)
                  : [];

                return (
                  <tr
                    key={article.id}
                    onClick={() => setSelectedArticle(isSelected ? null : article)}
                    className={cn(
                      "transition-colors cursor-pointer",
                      isSelected ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/5"
                    )}
                    data-testid={`row-article-${article.id}`}
                  >
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground font-mono">{article.id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-xs">
                        <p className="font-medium text-foreground truncate text-sm">
                          {article.meta_title ?? article.competitor_title ?? "Untitled"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate font-mono mt-0.5">
                          {article.rss_link}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1 max-w-[200px]">
                        {primaryKw ? (
                          <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-medium">
                            <Tag className="w-2.5 h-2.5" />
                            {primaryKw.slice(0, 30)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        {secondaryKws.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {secondaryKws.slice(0, 3).map((kw, i) => (
                              <span key={i} className="text-[10px] bg-slate-700/50 text-slate-400 px-1.5 py-0.5 rounded">
                                {kw.slice(0, 20)}
                              </span>
                            ))}
                            {secondaryKws.length > 3 && (
                              <span className="text-[10px] text-muted-foreground">+{secondaryKws.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={article.content_status} />
                        </div>
                        <div className="flex gap-1">
                          <StatusBadge status={article.image_status} />
                          <StatusBadge status={article.article_status} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground">{formatDate(article.created_at)}</span>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {article.wp_post_url && (
                          <a href={article.wp_post_url} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                            data-testid={`link-wp-${article.id}`}>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          data-testid={`button-retry-${article.id}`}
                          onClick={() => retryMutation.mutate({ id: article.id })}
                          disabled={retryMutation.isPending}
                          className={`p-1.5 transition-colors ${article.article_status === "failed" || article.content_status === "failed" ? "text-amber-400 hover:text-amber-300" : "text-muted-foreground hover:text-foreground"}`}
                          title="Retry"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          data-testid={`button-delete-${article.id}`}
                          onClick={() => deleteMutation.mutate({ id: article.id })}
                          disabled={deleteMutation.isPending}
                          className="p-1.5 text-muted-foreground hover:text-rose-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages} · {total} articles
            </p>
            <div className="flex gap-2">
              <button
                data-testid="button-prev-page"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                data-testid="button-next-page"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Article Details Side Panel */}
      {selectedArticle && (
        <ArticleDetailsPanel article={selectedArticle} onClose={() => setSelectedArticle(null)} />
      )}
    </div>
  );
}
