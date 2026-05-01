import { useState, useEffect } from "react";
import { AlertTriangle, X, Key, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OpenRouterKeyModal } from "../OpenRouterKeyModal";
import { useGetMe } from "@workspace/api-client-react";

export function ByokBanner() {
  const { data: user } = useGetMe();
  const [isVisible, setIsVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const isDismissed = sessionStorage.getItem("byok_banner_dismissed") === "true";
    if (!isDismissed && user?.plan_mode === "byok" && !user?.has_openrouter_key) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [user]);

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem("byok_banner_dismissed", "true");
  };

  if (!isVisible) return null;

  return (
    <>
      <div className="bg-violet-600 text-white px-4 py-2 flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-500 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-1.5 rounded-lg">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
            <p className="text-sm font-bold">Action Required</p>
            <p className="text-xs text-violet-100 opacity-90">
              Your BYOK plan is active! Add your OpenRouter API key to unlock AI features.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            variant="ghost" 
            className="text-white hover:bg-white/10 h-8 text-xs font-bold gap-1"
            onClick={() => setModalOpen(true)}
          >
            Add OpenRouter Key <ArrowRight className="h-3 w-3" />
          </Button>
          <button 
            onClick={handleDismiss}
            className="p-1 hover:bg-white/10 rounded-md transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <OpenRouterKeyModal 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
        onSuccess={() => setModalOpen(false)}
      />
    </>
  );
}
