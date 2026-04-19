import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import {
  Bot,
  CheckCircle,
  ChevronLeft,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { BASE_URL } from "@/lib/api";

const AGENT_KEYS = [
  "blog_manager",
  "seo_manager",
  "competitor_analysis",
  "keyword_research",
  "title_generator",
  "description_generator",
  "internal_linking",
  "external_linking",
  "image_analysis",
  "article_writer",
] as const;

const AGENT_COLORS: Record<string, string> = {
  blog_manager: "text-primary bg-primary/10",
  seo_manager: "text-emerald-400 bg-emerald-400/10",
  competitor_analysis: "text-amber-400 bg-amber-400/10",
  keyword_research: "text-sky-400 bg-sky-400/10",
  title_generator: "text-violet-400 bg-violet-400/10",
  description_generator: "text-pink-400 bg-pink-400/10",
  internal_linking: "text-orange-400 bg-orange-400/10",
  external_linking: "text-teal-400 bg-teal-400/10",
  image_analysis: "text-fuchsia-400 bg-fuchsia-400/10",
  article_writer: "text-rose-400 bg-rose-400/10",
};

interface AgentPrompt {
  id: number;
  site_id: number;
  agent_key: string;
  agent_name: string;
  system_message: string;
  description: string | null;
  is_active: boolean;
  updated_at: string;
}

interface Site {
  id: number;
  name: string;
  wp_url: string;
  global_instructions?: string;
}

async function fetchSite(id: number): Promise<Site> {
  const r = await fetch(`/api/sites/${id}`, { headers: { "Authorization": `Bearer ${localStorage.getItem("pro_token")}` } });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

async function updateSiteGlobalInstructions(id: number, global_instructions: string) {
  const r = await fetch(`/api/sites/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("pro_token")}` },
    body: JSON.stringify({ global_instructions }),
  });
  if (!r.ok) throw new Error("Failed to update");
  return r.json();
}

async function fetchAgents(siteId: number): Promise<{ prompts: AgentPrompt[] }> {
  const r = await fetch(`/api/sites/${siteId}/agents`, { headers: { "Authorization": `Bearer ${localStorage.getItem("pro_token")}` } });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

async function updateAgent(
  siteId: number,
  agentKey: string,
  data: { system_message?: string; is_active?: boolean }
) {
  const r = await fetch(`/api/sites/${siteId}/agents/${agentKey}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("pro_token")}` },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Failed to update");
  return r.json();
}

async function resetAgent(siteId: number, agentKey: string) {
  const r = await fetch(`/api/sites/${siteId}/agents/reset/${agentKey}`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${localStorage.getItem("pro_token")}` },
  });
  if (!r.ok) throw new Error("Failed to reset");
  return r.json();
}

async function resetAllAgents(siteId: number) {
  const r = await fetch(`/api/sites/${siteId}/agents/reset-all`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${localStorage.getItem("pro_token")}` },
  });
  if (!r.ok) throw new Error("Failed to reset all");
  return r.json();
}

export default function Agents() {
  const [, params] = useRoute("/sites/:id/agents");
  const siteId = params ? parseInt(params.id) : null;

  const qc = useQueryClient();
  const [expandedKey, setExpandedKey] = useState<string | null>("blog_manager");
  const [localPrompts, setLocalPrompts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState<string | null>(null);
  const [localGlobalInstructions, setLocalGlobalInstructions] = useState("");
  const [globalSaved, setGlobalSaved] = useState(false);

  const { data: site } = useQuery({
    queryKey: ["site", siteId],
    queryFn: () => fetchSite(siteId!),
    enabled: siteId !== null,
  });

  useEffect(() => {
    if (site) {
      setLocalGlobalInstructions(site.global_instructions ?? "");
    }
  }, [site]);

  const globalInstructionsMutation = useMutation({
    mutationFn: () => updateSiteGlobalInstructions(siteId!, localGlobalInstructions),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["site", siteId] });
      setGlobalSaved(true);
      setTimeout(() => setGlobalSaved(false), 2000);
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["agents", siteId],
    queryFn: () => fetchAgents(siteId!),
    enabled: siteId !== null,
  });

  const prompts = data?.prompts ?? [];
  const promptMap = Object.fromEntries(prompts.map((p) => [p.agent_key, p]));

  useEffect(() => {
    if (data && data.prompts.length > 0) {
      const map: Record<string, string> = {};
      data.prompts.forEach((p) => { map[p.agent_key] = p.system_message; });
      setLocalPrompts(map);
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: ({
      key,
      payload,
    }: {
      key: string;
      payload: { system_message?: string; is_active?: boolean };
    }) => updateAgent(siteId!, key, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents", siteId] }),
  });

  const resetMutation = useMutation({
    mutationFn: (key: string) => resetAgent(siteId!, key),
    onSuccess: (data) => {
      setLocalPrompts((prev) => ({
        ...prev,
        [data.agent_key]: data.system_message,
      }));
      qc.invalidateQueries({ queryKey: ["agents", siteId] });
      setResetKey(null);
    },
  });

  const resetAllMutation = useMutation({
    mutationFn: () => resetAllAgents(siteId!),
    onSuccess: (agents) => {
      const map: Record<string, string> = {};
      agents.forEach((a: AgentPrompt) => { map[a.agent_key] = a.system_message; });
      setLocalPrompts(map);
      qc.invalidateQueries({ queryKey: ["agents", siteId] });
    },
  });

  const handleSave = async (key: string) => {
    setSavingKey(key);
    await updateMutation.mutateAsync({
      key,
      payload: { system_message: localPrompts[key] },
    });
    setSavingKey(null);
  };

  const handleToggle = (key: string, value: boolean) => {
    updateMutation.mutate({ key, payload: { is_active: value } });
  };

  if (!siteId) return null;

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link
          href="/sites"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Sites
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bot className="w-6 h-6 text-primary" />
            AI Agents
          </h1>
          {site && (
            <p className="text-muted-foreground text-sm mt-0.5">
              {site.name} — {site.wp_url}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="bg-card/50 border border-border rounded-lg p-4 flex items-start gap-3 flex-1">
          <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            Each agent has a system message that defines its behavior. The agents run sequentially:{" "}
            <strong className="text-foreground">Blog Manager</strong> orchestrates{" "}
            <strong className="text-foreground">SEO Manager</strong> and{" "}
            <strong className="text-foreground">Image Analysis</strong>, which each run their
            sub-agents in order.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="flex-shrink-0 gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
          disabled={resetAllMutation.isPending}
          onClick={() => {
            if (confirm("Reset ALL agents to their default prompts? This will overwrite any custom changes.")) {
              resetAllMutation.mutate();
            }
          }}
        >
          <RotateCcw className={cn("w-3.5 h-3.5", resetAllMutation.isPending && "animate-spin")} />
          {resetAllMutation.isPending ? "Resetting..." : "Reset All"}
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">Master Instructions</h3>
              <p className="text-xs text-muted-foreground">
                Applied to ALL agents automatically — language, tone, style, etc.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="gap-2"
            disabled={globalInstructionsMutation.isPending || localGlobalInstructions === (site?.global_instructions ?? "")}
            onClick={() => globalInstructionsMutation.mutate()}
          >
            {globalSaved ? (
              <>
                <CheckCircle className="w-3.5 h-3.5" />
                Saved
              </>
            ) : globalInstructionsMutation.isPending ? (
              "Saving..."
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                Save
              </>
            )}
          </Button>
        </div>
        <div className="p-4">
          <Textarea
            value={localGlobalInstructions}
            onChange={(e) => setLocalGlobalInstructions(e.target.value)}
            placeholder="Example: Write all content in Arabic. Use a professional journalist/press style. Cover topics as an expert in the field..."
            className="min-h-[100px] bg-background border-border text-sm resize-y"
          />
          {localGlobalInstructions && (
            <p className="text-xs text-muted-foreground mt-2">
              These instructions will be prepended to every agent's prompt when articles are processed.
            </p>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {AGENT_KEYS.map((k) => (
            <div key={k} className="h-16 rounded-lg bg-card animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {AGENT_KEYS.map((key, idx) => {
            const prompt = promptMap[key];
            const isExpanded = expandedKey === key;
            const hasUnsavedChanges =
              prompt && localPrompts[key] !== undefined && localPrompts[key] !== prompt.system_message;

            return (
              <div
                key={key}
                className={cn(
                  "border border-border rounded-lg bg-card transition-all",
                  isExpanded && "border-primary/30"
                )}
              >
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  onClick={() => setExpandedKey(isExpanded ? null : key)}
                >
                  <div
                    className={cn(
                      "w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0",
                      AGENT_COLORS[key] ?? "text-muted-foreground bg-muted"
                    )}
                  >
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground text-sm">
                        {prompt?.agent_name ?? key}
                      </span>
                      {hasUnsavedChanges && (
                        <span className="text-xs text-amber-400 font-mono">unsaved</span>
                      )}
                    </div>
                    {prompt?.description && (
                      <p className="text-xs text-muted-foreground truncate">{prompt.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {prompt && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5"
                      >
                        <Switch
                          checked={prompt.is_active}
                          onCheckedChange={(v) => handleToggle(key, v)}
                          className="scale-75"
                        />
                        <Label className="text-xs text-muted-foreground">
                          {prompt.is_active ? "On" : "Off"}
                        </Label>
                      </div>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border pt-4">
                    <Textarea
                      className="font-mono text-xs bg-background/60 border-border min-h-[300px] resize-y"
                      value={localPrompts[key] ?? prompt?.system_message ?? ""}
                      onChange={(e) =>
                        setLocalPrompts((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      placeholder="Enter system message for this agent..."
                    />
                    <div className="flex justify-between items-center">
                      {prompt?.updated_at && (
                        <p className="text-xs text-muted-foreground">
                          Last updated:{" "}
                          {new Date(prompt.updated_at).toLocaleDateString("en", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      )}
                      <div className="flex gap-2 ml-auto">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5 text-xs h-8"
                          onClick={() => {
                            if (confirm("Reset to default prompt?")) {
                              setResetKey(key);
                              resetMutation.mutate(key);
                            }
                          }}
                          disabled={resetMutation.isPending && resetKey === key}
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reset
                        </Button>
                        <Button
                          size="sm"
                          className="gap-1.5 text-xs h-8"
                          onClick={() => handleSave(key)}
                          disabled={savingKey === key || !hasUnsavedChanges}
                        >
                          <Save className="w-3 h-3" />
                          {savingKey === key ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
