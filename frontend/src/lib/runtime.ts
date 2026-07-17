export const REMOTE_API_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, "") as string | undefined;

export function isRemoteSyncEnabled(): boolean {
  return Boolean(REMOTE_API_URL);
}

