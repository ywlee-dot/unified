"use client";

import { createContext, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";

export interface AuthUser {
  user_id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Check auth status on mount — try refresh if access token expired
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const data = await api.getMe();
        setUser(data.user);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          // Access token may be expired — try refresh
          try {
            const refreshed = await api.refresh();
            setUser(refreshed.user);
          } catch {
            // Refresh also failed — user must log in
          }
        }
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const data = await api.login(email, password);
        setUser(data.user);
        router.push("/");
      } catch (err) {
        if (err instanceof ApiError) {
          throw new Error(err.message);
        }
        throw new Error("로그인에 실패했습니다");
      }
    },
    [router]
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Proceed with client-side cleanup even if server call fails
    }
    setUser(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
