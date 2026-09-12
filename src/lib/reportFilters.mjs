/** Parse an ISO local date or timestamp safely. Date-only strings use local-day boundaries. */
export function parseDate(value, endOfDay = false) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
  }
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function formatDate(value, includeTime = false) {
  const date = parseDate(value);
  if (!date) return "—";
  return date.toLocaleString(undefined, includeTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
}

function inRange(value, from, to) {
  const date = parseDate(value);
  const start = parseDate(from);
  const end = parseDate(to, true);
  if (!date || (start && end && start > end)) return false;
  return (!start || date >= start) && (!end || date <= end);
}

function stableSort(values, compare) {
  return values.map((value, index) => ({ value, index })).sort((a, b) => compare(a.value, b.value) || a.index - b.index).map(({ value }) => value);
}

export function filterWorklistReports(reports, patients, filters = {}) {
  const patientById = new Map(patients.map((patient) => [patient.id, patient]));
  const query = String(filters.search ?? "").trim().toLocaleLowerCase();
  const filtered = reports.filter((report) => {
    if (filters.status === "attention") {
      if (report.status !== "draft" || !filters.needsAttention?.(report)) return false;
    } else if (filters.status && filters.status !== "all" && report.status !== filters.status) return false;
    if ((filters.from || filters.to) && !inRange(report.createdAt, filters.from, filters.to)) return false;
    if (!query) return true;
    const patient = patientById.get(report.patientId) ?? {};
    return [patient.name, patient.patientId, report.id, report.testName, ...(report.specimens ?? []), report.specimenType].filter(Boolean).join(" ").toLocaleLowerCase().includes(query);
  });
  const sort = filters.sort ?? "newest";
  return stableSort(filtered, (a, b) => {
    if (sort === "oldest") return (parseDate(a.createdAt)?.getTime() ?? 0) - (parseDate(b.createdAt)?.getTime() ?? 0);
    if (sort === "patient") return String(patientById.get(a.patientId)?.name ?? "").localeCompare(String(patientById.get(b.patientId)?.name ?? ""));
    if (sort === "test") return String(a.testName ?? "").localeCompare(String(b.testName ?? ""));
    if (sort === "status") return String(a.status).localeCompare(String(b.status));
    return (parseDate(b.createdAt)?.getTime() ?? 0) - (parseDate(a.createdAt)?.getTime() ?? 0);
  });
}

export function filterHistoryReports(reports, patients, filters = {}) {
  const lifecycle = filters.lifecycle ?? "all";
  const subset = reports.filter((report) => lifecycle === "all" || (lifecycle === "amended" ? Boolean(report.supersedesReportId) : report.status === lifecycle));
  return filterWorklistReports(subset, patients, { search: filters.search, from: filters.from, to: filters.to, sort: filters.sort ?? "newest", status: "all" });
}
