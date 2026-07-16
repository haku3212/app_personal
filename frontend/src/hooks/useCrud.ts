/**
 * Hooks CRUD genéricos sobre TanStack Query.
 * Cada módulo los reutiliza con su clave y ruta — sin código repetido.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { api } from "@/lib/api";

/** GET genérico con clave de caché. */
export function useApiQuery<T>(key: QueryKey, path: string) {
  return useQuery({ queryKey: key, queryFn: () => api.get<T>(path) });
}

/**
 * Mutación que invalida claves relacionadas al terminar
 * (p. ej. crear un gasto refresca gastos, dashboard y notificaciones).
 */
export function useApiMutation<TInput, TOutput = unknown>(
  fn: (input: TInput) => Promise<TOutput>,
  invalidate: QueryKey[],
  onDone?: () => void,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of invalidate) void qc.invalidateQueries({ queryKey: key });
      onDone?.();
    },
  });
}

/** Claves compartidas que dependen de casi todos los módulos. */
export const GLOBAL_KEYS: QueryKey[] = [
  ["dashboard"],
  ["stats"],
  ["notifications"],
  ["accounts"],
  ["calendar"],
];
