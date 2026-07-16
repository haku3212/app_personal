/**
 * Cliente HTTP hacia la API local.
 * En desarrollo Vite proxya /api al backend local configurado.
 * En producción (Electron) el frontend se sirve desde el mismo servidor.
 */

import { ApiClientError } from "@/lib/apiError";
import { isMobileApiEnabled, mobileApi } from "@/lib/mobileApi";

const REMOTE_API = import.meta.env.VITE_API_URL?.replace(/\/$/, "") as string | undefined;
const BASE = REMOTE_API ? `${REMOTE_API}/api` : "/api";
const SESSION_KEY = "personal-control-session-v1";

export { ApiClientError };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as { token?: string } | null;
  const headers: Record<string, string> = init?.body instanceof Blob ? {} : { "Content-Type": "application/json" };
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;
  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...init,
  });
  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    throw new ApiClientError(res.status, message);
  }
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => (isMobileApiEnabled() && !REMOTE_API ? mobileApi.get<T>(path) : request<T>(path)),
  post: <T>(path: string, body?: unknown) =>
    isMobileApiEnabled() && !REMOTE_API
      ? mobileApi.post<T>(path, body)
      : request<T>(path, { method: "POST", body: body != null ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body: unknown) =>
    isMobileApiEnabled() && !REMOTE_API
      ? mobileApi.put<T>(path, body)
      : request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    isMobileApiEnabled() && !REMOTE_API
      ? mobileApi.patch<T>(path, body)
      : request<T>(path, { method: "PATCH", body: body != null ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) =>
    isMobileApiEnabled() && !REMOTE_API ? mobileApi.delete<T>(path) : request<T>(path, { method: "DELETE" }),

  /** Descarga un archivo generado por la API (reportes, exportar base). */
  async download(path: string, fallbackName: string): Promise<void> {
    if (isMobileApiEnabled() && !REMOTE_API) return mobileApi.download(path, fallbackName);
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as { token?: string } | null;
    const res = await fetch(`${BASE}${path}`, {
      headers: session?.token ? { Authorization: `Bearer ${session.token}` } : undefined,
    });
    if (!res.ok) throw new ApiClientError(res.status, "No se pudo generar el archivo");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const match = /filename="?([^";]+)"?/.exec(disposition);
    a.href = url;
    a.download = match?.[1] ?? fallbackName;
    a.click();
    URL.revokeObjectURL(url);
  },

  /** Sube un archivo binario crudo (importar base de datos). */
  async upload<T>(path: string, file: File): Promise<T> {
    if (isMobileApiEnabled() && !REMOTE_API) return mobileApi.upload<T>(path, file);
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as { token?: string } | null;
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      },
      body: file,
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new ApiClientError(res.status, body.error ?? "Error al subir el archivo");
    }
    return (await res.json()) as T;
  },
};
