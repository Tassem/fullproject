import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type UpgradeModalState = {
  open: boolean;
  feature?: string;
  requiredPlan?: "pro" | "business";
  currentPlan?: string;
  message?: string;
  upgradeUrl?: string;
};

interface GlobalErrorContextValue {
  openUpgradeModal: (payload: Omit<UpgradeModalState, "open">) => void;
  closeUpgradeModal: () => void;
  upgradeModal: UpgradeModalState;
}

const GlobalErrorContext = createContext<GlobalErrorContextValue | null>(null);

export function GlobalErrorProvider({ children }: { children: ReactNode }) {
  const [upgradeModal, setUpgradeModal] = useState<UpgradeModalState>({
    open: false,
  });

  const openUpgradeModal = useCallback((payload: Omit<UpgradeModalState, "open">) => {
    // Prevent spam: if already open, don't update unless it's a different feature
    setUpgradeModal((prev) => {
      if (prev.open && prev.feature === payload.feature) return prev;
      return { ...payload, open: true };
    });
  }, []);

  const closeUpgradeModal = useCallback(() => {
    setUpgradeModal((prev) => ({ ...prev, open: false }));
  }, []);

  return (
    <GlobalErrorContext.Provider value={{
      openUpgradeModal,
      closeUpgradeModal,
      upgradeModal,
    }}>
      {children}
    </GlobalErrorContext.Provider>
  );
}

export function useGlobalError() {
  const ctx = useContext(GlobalErrorContext);
  if (!ctx) throw new Error("useGlobalError must be used within GlobalErrorProvider");
  return ctx;
}
