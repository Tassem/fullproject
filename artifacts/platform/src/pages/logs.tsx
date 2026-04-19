import { useState } from "react";
import { useListLogs, getListLogsQueryKey } from "@workspace/api-client-react";
import { ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import { cn, formatDate, formatDuration, getStatusColor } from "@/lib/utils";

const STAGES = ["", "rss_fetch", "scrape", "competitor_analysis", "keyword_research", "title_gen", "description_gen", "internal_links", "external_links", "image_analysis", "image_generation", "image_upload", "article_write", "wp_publish", "rank_math"];
const STATUSES = ["", "running", "success", "failed", "skipped"];

export function Logs() {
  const [page, setPage] = useState(1);
  const [stageFilter, setStageFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const limit = 50;
  const params = {
    page,
    limit,
    ...(stageFilter ? { stage: stageFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const query = useListLogs(params, { query: { queryKey: getListLogsQueryKey(params) } });
  const logs = query.data?.logs ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Logs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} log entries</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-card-border rounded-lg p-4 flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Stage</label>
          <select
            data-testid="select-stage-filter"
            value={stageFilter}
            onChange={(e) => { setStageFilter(e.target.value); setPage(1); }}
            className="bg-background border border-input rounded-md px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {STAGES.map((s) => (
              <option key={s} value={s}>{s || "All stages"}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</label>
          <select
            data-testid="select-status-filter"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-background border border-input rounded-md px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s || "All statuses"}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Log Table */}
      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <ScrollText className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Execution Logs</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Time</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Stage</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Article</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Message</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono">
              {query.isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-sm text-muted-foreground font-sans">
                    No logs found matching current filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/5 transition-colors" data-testid={`log-row-${log.id}`}>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-muted-foreground">{formatDate(log.created_at)}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-foreground">{log.stage}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn("px-2 py-0.5 rounded text-xs font-medium border", getStatusColor(log.status))}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-muted-foreground">{log.article_id ?? "—"}</span>
                    </td>
                    <td className="px-4 py-2.5 max-w-xs">
                      <p className="text-xs text-foreground truncate">{log.message ?? "—"}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-muted-foreground">{formatDuration(log.duration_ms)}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">Page {page} of {totalPages} ({total} entries)</p>
            <div className="flex gap-2">
              <button
                data-testid="button-logs-prev"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                data-testid="button-logs-next"
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
    </div>
  );
}
