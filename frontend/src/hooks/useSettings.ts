/**
 * Ajustes globales: lectura, actualización y aplicación del tema.
 */
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Setting } from "@/types";

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<Setting>("/settings"),
    staleTime: 60_000,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Setting>) => api.put<Setting>("/settings", patch),
    onSuccess: (data) => qc.setQueryData(["settings"], data),
  });
}

/** Aplica la clase `dark` al <html> según el tema configurado. */
export function useApplyTheme(theme: Setting["theme"] | undefined) {
  useEffect(() => {
    if (!theme) return;
    const root = document.documentElement;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && prefersDark.matches);
      root.classList.toggle("dark", dark);
    };
    apply();
    prefersDark.addEventListener("change", apply);
    return () => prefersDark.removeEventListener("change", apply);
  }, [theme]);
}
