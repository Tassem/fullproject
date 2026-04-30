import { useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { useGlobalError } from "@/contexts/globalError";
import { UpgradePrompt } from "@/components/layout/UpgradePrompt";

const FEATURE_LABELS: Record<string, string> = {
  has_blog_automation: "Blog Automation",
  has_image_generator: "Image Generator",
  has_telegram_bot: "Telegram Bot",
  has_api_access: "API Access",
  has_overlay_upload: "Overlay Upload",
  has_custom_watermark: "Custom Watermark",
  has_ai_image_generation: "AI Image Generation",
  has_priority_processing: "Priority Processing",
  has_priority_support: "Priority Support",
  max_sites: "Additional Sites",
  max_templates: "Additional Templates",
};

export function UpgradeModal() {
  const { upgradeModal, closeUpgradeModal } = useGlobalError();
  const { open, feature, requiredPlan, message } = upgradeModal;

  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") closeUpgradeModal();
  }, [closeUpgradeModal]);

  useEffect(() => {
    if (open) {
      window.addEventListener("keydown", handleEsc);
      // Prevent scrolling of background
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "unset";
    };
  }, [open, handleEsc]);

  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeUpgradeModal();
      }}
    >
      <div className="relative w-full max-w-lg bg-card border rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
        {/* Close Button */}
        <button 
          onClick={closeUpgradeModal}
          className="absolute right-4 top-4 p-2 rounded-full hover:bg-muted transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>

        <div className="p-1">
          <UpgradePrompt 
            requiredPlan={requiredPlan || "pro"}
            featureName={feature ? (FEATURE_LABELS[feature] || feature) : undefined}
            title={feature ? `Unlock ${FEATURE_LABELS[feature] || feature}` : "Upgrade Required"}
            description={message}
          />
        </div>
      </div>
    </div>
  );
}
