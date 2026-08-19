"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type AuthUser = {
  id: string;
  name: string;
  headline: string;
  avatarHue: number;
  avatarUrl?: string;
  callerId?: string;
  onboarded: boolean;
};

type Auth = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const CACHE = "cp_me";

const Ctx = createContext<Auth>({
  user: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});

function readCache(): AuthUser | null {
  try {
    const raw = localStorage.getItem(CACHE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (!parsed?.id || !parsed?.name) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(user: AuthUser | null) {
  try {
    if (user) localStorage.setItem(CACHE, JSON.stringify(user));
    else localStorage.removeItem(CACHE);
  } catch {
    /* ignore quota */
  }
}

function pickUser(raw: AuthUser): AuthUser {
  return {
    id: raw.id,
    name: raw.name,
    headline: raw.headline,
    avatarHue: raw.avatarHue,
    avatarUrl: raw.avatarUrl?.startsWith("data:") ? `/api/users/${raw.id}/photo` : raw.avatarUrl,
    callerId: raw.callerId,
    onboarded: raw.onboarded,
  };
}

export function AuthProvider({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser: AuthUser | null;
}) {
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [loading, setLoading] = useState(!initialUser);

  async function refresh() {
    const res = await fetch("/api/me", { credentials: "include" });
    if (!res.ok) {
      if (!initialUser) {
        writeCache(null);
        setUser(null);
      }
      setLoading(false);
      return;
    }
    const d = await res.json();
    const next = d.user ? pickUser(d.user) : null;
    if (next) {
      setUser(next);
      writeCache(next);
    } else {
      writeCache(null);
      setUser(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!initialUser) {
      const cached = readCache();
      if (cached) {
        setUser(cached);
        setLoading(false);
      }
    } else {
      writeCache(initialUser);
    }
    refresh();
  }, [initialUser]);

  async function logout() {
    writeCache(null);
    setUser(null);
    await fetch("/api/auth/logout", { method: "POST" });
    localStorage.removeItem("cp_token");
    window.location.href = "/login";
  }

  return <Ctx.Provider value={{ user, loading, refresh, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}

export function SignOutButton({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const { logout } = useAuth();
  return (
    <button type="button" className={className} onClick={() => void logout()}>
      {children ?? "Sign out"}
    </button>
  );
}
