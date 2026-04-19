import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";

export function useAuth() {
  const token = localStorage.getItem("pro_token");
  const { data: me, isLoading } = useGetMe({
    query: {
      enabled: !!token,
      queryKey: getGetMeQueryKey(),
      retry: false,
    },
  });
  const [, setLocation] = useLocation();

  return {
    user: me ?? null,
    loading: isLoading,
    isAdmin: me?.isAdmin ?? false,
    logout: () => {
      localStorage.removeItem("pro_token");
      setLocation("/login");
    },
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
