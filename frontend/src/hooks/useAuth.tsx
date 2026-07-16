import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createUser,
  getCurrentSession,
  listUsers,
  loginUser,
  logoutUser,
  switchActiveOwner,
  type AuthSession,
  type LocalUser,
} from "@/lib/auth";

interface AuthContextValue {
  ready: boolean;
  session: AuthSession | null;
  hasUsers: boolean;
  users: LocalUser[];
  refreshUsers: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (input: { username: string; displayName?: string; password: string }) => Promise<void>;
  switchOwner: (ownerUserId: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [hasUsers, setHasUsers] = useState(false);
  const [users, setUsers] = useState<LocalUser[]>([]);

  useEffect(() => {
    void Promise.all([getCurrentSession(), listUsers()]).then(([current, users]) => {
      setSession(current);
      setHasUsers(users.length > 0);
      setUsers(users);
      setReady(true);
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      session,
      hasUsers,
      users,
      refreshUsers: async () => {
        const nextUsers = await listUsers();
        setUsers(nextUsers);
        setHasUsers(nextUsers.length > 0);
      },
      login: async (username, password) => {
        queryClient.clear();
        const nextSession = await loginUser(username, password);
        setSession(nextSession);
        setUsers(await listUsers());
      },
      register: async (input) => {
        queryClient.clear();
        setSession(await createUser(input));
        setHasUsers(true);
        setUsers(await listUsers());
      },
      switchOwner: async (ownerUserId) => {
        queryClient.clear();
        setSession(await switchActiveOwner(ownerUserId));
      },
      logout: async () => {
        await logoutUser();
        queryClient.clear();
        setSession(null);
        const nextUsers = await listUsers();
        setUsers(nextUsers);
        setHasUsers(nextUsers.length > 0);
      },
    }),
    [hasUsers, queryClient, ready, session, users],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return value;
}
