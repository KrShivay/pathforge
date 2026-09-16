/** Short human-facing accession code derived from the internal report id. */
export function accession(
  reportId: string | undefined,
  version: number
): string {
  const base = ((reportId ?? "").split("::")[0] ?? "").replace(
    /[^a-zA-Z0-9]/g,
    ""
  );
  const code = base ? base.slice(0, 8).toUpperCase() : "UNASSIGNED";
  return `PF-${code}-V${version}`;
}

export function formatReportDate(value: string | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString();
}

/** Return a local-calendar date suitable for a date input. */
export function isoDateFromLocalDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Format a date-only report value without introducing a midnight time. */
export function formatReportDay(value: string | undefined): string {
  if (!value) return "—";
  const datePart = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return "—";
  const [year, month, day] = datePart.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return "—";
  }
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
