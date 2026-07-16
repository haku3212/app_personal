/**
 * Cálculos de jornadas de trabajo (única fuente de verdad).
 */
import { ApiError, round2 } from "../lib/http";

/** Horas de jornada estándar; por encima se considera hora extra. */
const STANDARD_HOURS = 8;

/** Convierte "HH:mm" a minutos desde medianoche. */
function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) {
    throw new ApiError(400, `Hora inválida: ${time}`);
  }
  return h * 60 + m;
}

export interface WorkComputation {
  hours: number;
  overtime: number;
  expectedPay: number;
}

/**
 * Calcula horas reales, horas extra y pago esperado de una jornada.
 * Si la hora fin es menor que la de inicio se asume turno nocturno (+24h).
 */
export function computeWork(input: {
  startTime: string;
  endTime: string;
  breakMinutes: number;
  hourlyRate?: number | null;
  fixedPay?: number | null;
}): WorkComputation {
  const start = toMinutes(input.startTime);
  let end = toMinutes(input.endTime);
  if (end <= start) end += 24 * 60; // turno que cruza medianoche

  const worked = end - start - input.breakMinutes;
  if (worked <= 0) {
    throw new ApiError(400, "La jornada resulta en 0 horas o menos");
  }

  const hours = round2(worked / 60);
  const overtime = round2(Math.max(0, hours - STANDARD_HOURS));
  const expectedPay = round2(hours * (input.hourlyRate ?? 0) + (input.fixedPay ?? 0));
  return { hours, overtime, expectedPay };
}
