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
