/**
 * Formateadores compartidos de moneda, fechas y horas.
 */
import dayjs from "dayjs";
import "dayjs/locale/es";

dayjs.locale("es");

/** Formatea un monto con la moneda configurada (Bs. por defecto). */
export function money(amount: number, currency = "Bs."): string {
  return `${currency} ${amount.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Fecha corta: 16 jul 2026 */
export function shortDate(date: string | Date): string {
  return dayjs(date).format("DD MMM YYYY");
}

/** Fecha para inputs type="date": 2026-07-16 */
export function inputDate(date: string | Date = new Date()): string {
  return dayjs(date).format("YYYY-MM-DD");
}

/** Horas con 2 decimales máximo: "7.5 h" */
export function hours(h: number): string {
  return `${Number(h.toFixed(2))} h`;
}
