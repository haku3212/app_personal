export const DEFAULT_API_PORT = 4311;

export function readPortEnv(names: string[], fallback: number): number {
  for (const name of names) {
    const raw = process.env[name];
    if (!raw) continue;

    const value = Number(raw);
    if (Number.isInteger(value) && value > 0 && value <= 65535) {
      return value;
    }

    console.warn(`[api] Puerto ignorado en ${name}: "${raw}" no es valido.`);
  }

  return fallback;
}
