import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";

interface PlanDetails {
  monthly_credits?: number;
  rate_limit_daily?: number;
  max_templates?: number;
  max_saved_designs?: number;
  max_sites?: number;
  has_blog_automation?: boolean;
  has_image_generator?: boolean;
  has_telegram_bot?: boolean;
  has_api_access?: boolean;
  has_overlay_upload?: boolean;
  has_custom_watermark?: boolean;
  has_priority_support?: boolean;
  has_priority_processing?: boolean;
}

interface UserCredits {
  monthly?: number;
  purchased?: number;
  total?: number;
  daily_usage?: number;
  daily_limit?: number;
}

interface User {
  id: number;
  name: string;
  email: string;
  plan: string;
  apiKey?: string;
  botCode?: string;
  isAdmin: boolean;
  credits?: UserCredits;
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

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("pro_token"));
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
        localStorage.removeItem("pro_token");
        setToken(null);
        setUser(null);
      }
    }
  }, [isError, token]);

  const login = useCallback((newToken: string, newUser: User) => {
    localStorage.setItem("pro_token", newToken);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("pro_token");
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
