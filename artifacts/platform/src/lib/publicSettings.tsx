import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface PublicSettings {
  googleClientId: string | null;
}

const PublicSettingsContext = createContext<PublicSettings>({ googleClientId: null });

export function PublicSettingsProvider({ children }: { children: ReactNode }) {
  const [googleClientId, setGoogleClientId] = useState<string | null>(
    import.meta.env.VITE_GOOGLE_CLIENT_ID || null
  );

  useEffect(() => {
    fetch("/api/settings/public")
      .then(r => r.json())
      .then(d => { if (d.googleClientId) setGoogleClientId(d.googleClientId); })
      .catch(() => {});
  }, []);

  return (
    <PublicSettingsContext.Provider value={{ googleClientId }}>
      {children}
    </PublicSettingsContext.Provider>
  );
}

export function usePublicSettings() {
  return useContext(PublicSettingsContext);
}
