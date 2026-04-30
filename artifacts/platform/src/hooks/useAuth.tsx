import { useContext } from "react";
import { AuthContext } from "../contexts/auth";
import { useLocation } from "wouter";

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // Fallback or throw error if not within provider
    // Given the current state, throwing is safer to identify issues
    throw new Error("useAuth must be used within AuthProvider");
  }

  const [, setLocation] = useLocation();

  return {
    user: ctx.user,
    loading: ctx.isLoading,
    isLoading: ctx.isLoading, // provide both for compatibility
    isAdmin: ctx.user?.isAdmin ?? false,
    isAuthenticated: ctx.isAuthenticated,
    logout: () => {
      ctx.logout();
      setLocation("/login");
    },
    refreshUser: ctx.refreshUser,
  };
}

export { AuthProvider } from "../contexts/auth";
