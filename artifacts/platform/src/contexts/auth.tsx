import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";

interface PlanDetails {
  cardsPerDay?: number;
  maxTemplates?: number;
  maxSavedDesigns?: number;
  maxSites?: number;
  articlesPerMonth?: number;
  hasTelegramBot?: boolean;
  hasBlogAutomation?: boolean;
  hasImageGenerator?: boolean;
  apiAccess?: boolean;
  telegramBot?: boolean;
  overlayUpload?: boolean;
  customWatermark?: boolean;
  credits?: number;
}

interface User {
  id: number;
  name: string;
  email: string;
  plan: string;
  apiKey?: string;
  botCode?: string;
  isAdmin: boolean;
  imagesToday?: number;
  credits?: number;
  articlesThisMonth?: number;
  emailVerified?: boolean;
  phone?: string;
  planDetails?: PlanDetails;
  createdAt?: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { data: meData, isError, refetch } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
      queryKey: getGetMeQueryKey(),
    }
  });

  useEffect(() => {
    if (meData) {
      setUser(meData as unknown as User);
      setIsLoading(false);
    }
  }, [meData]);

  useEffect(() => {
    if (isError || !token) {
      setIsLoading(false);
      if (isError) {
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
      }
    }
  }, [isError, token]);

  const login = useCallback((newToken: string, newUser: User) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      logout,
      isLoading,
      isAuthenticated: !!user,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
