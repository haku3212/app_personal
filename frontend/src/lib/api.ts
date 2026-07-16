/**
 * Cliente HTTP hacia la API local.
 * En desarrollo Vite proxya /api → 127.0.0.1:4310.
 * En producción (Electron) el frontend se sirve desde el mismo servidor.
 */

const BASE = "/api";

/** Error de la API con mensaje legible para mostrar en la UI. */
export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: init?.body instanceof Blob ? undefined : { "Content-Type": "application/json" },
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
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body != null ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body != null ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),

  /** Descarga un archivo generado por la API (reportes, exportar base). */
  async download(path: string, fallbackName: string): Promise<void> {
    const res = await fetch(`${BASE}${path}`);
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
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: file,
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new ApiClientError(res.status, body.error ?? "Error al subir el archivo");
    }
    return (await res.json()) as T;
  },
};
