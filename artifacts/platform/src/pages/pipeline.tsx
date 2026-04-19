import { useGetPipelineStatus, useGetPipelineStats, useRunPipeline } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Play, CheckCircle, XCircle, Clock, Zap } from "lucide-react";
import { cn, formatDate, formatDuration } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const STAGE_LABELS: Record<string, string> = {
  rss_fetch: "RSS Fetch",
  scrape: "Scrape",
  competitor_analysis: "Competitor Analysis",
  keyword_research: "Keyword Research",
  title_gen: "Title Generation",
  description_gen: "Description Generation",
  internal_links: "Internal Links",
  external_links: "External Links",
  image_analysis: "Image Analysis",
  image_generation: "Image Generation",
  image_upload: "Image Upload",
  image_seo: "Image SEO",
  article_write: "Article Write",
  wp_publish: "WordPress Publish",
  rank_math: "Rank Math SEO",
  status_update: "Status Update",
};

export function Pipeline() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const statusQuery = useGetPipelineStatus();
  const statsQuery = useGetPipelineStats();
  const runMutation = useRunPipeline({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Pipeline triggered", description: data.message });
        qc.invalidateQueries();
      },
      onError: () => toast({ title: "Error", description: "Failed to trigger pipeline.", variant: "destructive" }),
    },
  });

  const status = statusQuery.data;
  const stats = statsQuery.data;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Monitor and control the content pipeline</p>
        </div>
        <button
          data-testid="button-run-pipeline"
          onClick={() => runMutation.mutate()}
          disabled={runMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Play className="w-4 h-4" />
          {runMutation.isPending ? "Starting..." : "Run Pipeline"}
        </button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-card-border rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Status</p>
          {status ? (
            <div className={cn("flex items-center gap-2 text-sm font-semibold", status.enabled ? "text-emerald-400" : "text-slate-400")}>
              <span className={cn("w-2 h-2 rounded-full", status.running ? "bg-blue-400 animate-pulse" : status.enabled ? "bg-emerald-400" : "bg-slate-400")} />
              {status.running ? "Running" : status.enabled ? "Idle" : "Disabled"}
            </div>
          ) : <div className="h-5 bg-muted rounded animate-pulse w-16" />}
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Pending</p>
          <p className="text-2xl font-bold font-mono text-foreground">{status?.pending_count ?? "—"}</p>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Processing</p>
          <p className="text-2xl font-bold font-mono text-blue-400">{status?.processing_count ?? "—"}</p>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Avg Duration</p>
          <p className="text-2xl font-bold font-mono text-foreground">{stats ? formatDuration(stats.avg_duration_ms) : "—"}</p>
        </div>
      </div>

      {/* Stage Performance */}
      <div className="bg-card border border-card-border rounded-lg">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <Zap className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Stage Performance</h2>
        </div>
        {statsQuery.isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}
          </div>
        ) : !stats?.stages?.length ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No pipeline data yet. Run the pipeline to see stage performance.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {stats.stages.map((stage) => {
              const total = stage.success_count + stage.failure_count;
              const successRate = total > 0 ? Math.round((stage.success_count / total) * 100) : 0;
              return (
                <div key={stage.stage} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/5 transition-colors" data-testid={`stage-${stage.stage}`}>
                  <div className="w-40 flex-shrink-0">
                    <p className="text-sm font-medium text-foreground">{STAGE_LABELS[stage.stage] ?? stage.stage}</p>
                    <p className="text-xs font-mono text-muted-foreground">{stage.stage}</p>
                  </div>
                  <div className="flex-1">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${successRate}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0 text-xs">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle className="w-3 h-3" /> {stage.success_count}
                    </span>
                    <span className="flex items-center gap-1 text-rose-400">
                      <XCircle className="w-3 h-3" /> {stage.failure_count}
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="w-3 h-3" /> {formatDuration(stage.avg_duration_ms)}
                    </span>
                    <span className="w-10 text-right font-mono text-foreground">{successRate}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
