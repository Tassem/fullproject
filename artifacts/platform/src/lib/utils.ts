import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "done":
    case "success":
      return "text-emerald-400 bg-emerald-400/10 border border-emerald-400/20";
    case "failed":
    case "error":
      return "text-rose-400 bg-rose-400/10 border border-rose-400/20";
    case "pending":
    case "skipped":
      return "text-slate-400 bg-slate-400/10 border border-slate-400/20";
    case "running":
    case "processing":
      return "text-blue-400 bg-blue-400/10 border border-blue-400/20";
    default:
      return "text-amber-400 bg-amber-400/10 border border-amber-400/20";
  }
}
