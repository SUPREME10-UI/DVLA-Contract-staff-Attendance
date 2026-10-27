"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { SessionUser } from "@/lib/auth";

interface AuthContextType {
  user: SessionUser | null;
  loading: boolean;
  login: (identifier: string, passwordPlain: string) => Promise<{ success: boolean; error?: string; redirectUrl?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({ success: false }),
  logout: async () => {},
  refreshUser: async () => {}
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Route protection
  useEffect(() => {
    if (loading) return;
    const isPublic =
      pathname === "/login" ||
      pathname === "/forgot-password" ||
      pathname === "/terminal" ||
      pathname.startsWith("/terminal/");

    if (!user && !isPublic) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
    } else if (user && (pathname === "/login" || pathname === "/forgot-password")) {
      if (user.role === "ADMIN") router.push("/admin/dashboard");
      else router.push("/staff/dashboard");
    }
  }, [user, loading, pathname, router]);

  const login = async (identifier: string, passwordPlain: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password: passwordPlain })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Login failed" };
      }
      setUser(data.user);
      return { success: true, redirectUrl: data.redirectUrl };
    } catch (err: any) {
      return { success: false, error: "Network error occurred" };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      router.push("/login");
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
