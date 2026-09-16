/**
 * Single source of truth for result flags.
 *
 * Every surface that shows a laboratory result — the wizard results table, the
 * review step, the report editor, the printable report and the PDF — must derive
 * the H/L flag from here so they can never disagree.
 */

export type ResultFlag = "" | "H" | "L";

/**
 * @param value  the entered result, as typed (may be non-numeric)
 * @param low    lower bound of the reference range, if any
 * @param high   upper bound of the reference range, if any
 */
export function computeFlag(
  value: string,
  low: number | undefined,
  high: number | undefined
): ResultFlag {
  const numeric = Number(value);
  if (value.trim() === "" || Number.isNaN(numeric)) return "";
  if (typeof high === "number" && numeric > high) return "H";
  if (typeof low === "number" && numeric < low) return "L";
  return "";
}

/** "H" → "High", "L" → "Low", "" → "". */
export function flagLabel(flag: ResultFlag): string {
  if (flag === "H") return "High";
  if (flag === "L") return "Low";
  return "";
}
