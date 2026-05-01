import { useState } from "react";
import { X, Loader2, Key, ShieldCheck, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface OpenRouterKeyModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentHint?: string | null;
}

export function OpenRouterKeyModal({ open, onClose, onSuccess, currentHint }: OpenRouterKeyModalProps) {
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/me/provider-keys", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("pro_token")}`,
        },
        body: JSON.stringify({
          provider: "openrouter",
          key: key.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save key");
      }

      setKey("");
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div 
        className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
              <Key className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight">OpenRouter API Key</h3>
              <p className="text-xs text-zinc-500">Configure your own key for article generation</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                API Key
              </label>
              <a 
                href="https://openrouter.ai/keys" 
                target="_blank" 
                rel="noreferrer"
                className="text-[10px] font-bold text-orange-400 hover:text-orange-300 flex items-center gap-1 transition-colors"
              >
                Get Key <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            
            <div className="relative">
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={currentHint ? `Current key ends in ...${currentHint}` : "sk-or-v1-..."}
                className={cn(
                  "w-full h-12 bg-black/40 border rounded-xl px-4 text-sm text-white placeholder:text-zinc-700 focus:outline-none transition-all",
                  error ? "border-rose-500/50 focus:border-rose-500" : "border-white/10 focus:border-orange-500/50"
                )}
                autoFocus
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
          </div>

          <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10 space-y-2">
            <div className="flex items-center gap-2 text-orange-400">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-[11px] font-black uppercase tracking-wider">Secure Storage</span>
            </div>
            <p className="text-[10px] text-zinc-500 leading-relaxed">
              Your key is encrypted using <strong>AES-256-GCM</strong> and is only decrypted when generating articles. We never log your full API key.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="flex-1 h-11 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 font-bold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !key.trim()}
              className="flex-1 h-11 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black uppercase tracking-widest transition-all"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {currentHint ? "Update Key" : "Save Key"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
