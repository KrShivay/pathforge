/**
 * Shared, pure filtering / date / sort helpers for Worklist and Version History.
 *
 * Every public function is side-effect-free and works on plain arrays.
 */

/**
 * Parse an ISO local date or timestamp safely.
 * Date-only strings use local-day boundaries.
 * @param {string | null | undefined} value
 * @param {boolean} [endOfDay]
 * @returns {Date | null}
 */
export function parseDate(value, endOfDay = false) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parts = value.split('-').map(Number);
    const year = /** @type {number} */ (parts[0]);
    const month = /** @type {number} */ (parts[1]);
    const day = /** @type {number} */ (parts[2]);
    const date = new Date(
      year,
      month - 1,
      day,
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0,
    );
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
  }
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

/**
 * @param {string | null | undefined} value
 * @param {boolean} [includeTime]
 * @returns {string}
 */
export function formatDate(value, includeTime = false) {
  const date = parseDate(value);
  if (!date) return '—';
  return date.toLocaleString(
    undefined,
    includeTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' },
  );
}

/**
 * @param {string | null | undefined} value
 * @param {string | null | undefined} from
 * @param {string | null | undefined} to
 * @returns {boolean}
 */
function inRange(value, from, to) {
  const date = parseDate(value);
  const start = parseDate(from);
  const end = parseDate(to, true);
  if (!date || (start && end && start > end)) return false;
  return (!start || date >= start) && (!end || date <= end);
}

/** The timestamp represented by a Version History row. */
/** @param {WorklistReport & { amendedAt?: string, finalizedAt?: string }} report */
export function historyEventDate(report) {
  return report.amendedAt ?? report.finalizedAt ?? report.createdAt;
}

/**
 * @param {string | undefined} sort
 * @returns {string}
 */
export function sortField(sort = 'newest') {
  if (sort === 'newest' || sort === 'oldest') return 'created';
  return sort.endsWith('-desc') ? sort.slice(0, -5) : sort;
}

/**
 * @param {string | undefined} sort
 * @returns {'asc' | 'desc'}
 */
export function sortDirection(sort = 'newest') {
  return sort === 'newest' || sort.endsWith('-desc') ? 'desc' : 'asc';
}

/**
 * @param {string | undefined} currentSort
 * @param {'created' | 'patient' | 'test' | 'status' | 'version'} field
 * @returns {string}
 */
export function toggleSort(currentSort = 'newest', field) {
  if (sortField(currentSort) !== field) return field === 'created' ? 'newest' : field;
  if (field === 'created') return currentSort === 'newest' ? 'oldest' : 'newest';
  return currentSort.endsWith('-desc') ? field : `${field}-desc`;
}

/**
 * @template T
 * @param {T[]} values
 * @param {(a: T, b: T) => number} compare
 * @returns {T[]}
 */
function stableSort(values, compare) {
  return values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => compare(a.value, b.value) || a.index - b.index)
    .map(({ value }) => value);
}

/**
 * @typedef {object} WorklistReport
 * @property {string} id
 * @property {string} patientId
 * @property {string} status
 * @property {string} createdAt
 * @property {string} [specimenCollectionDate]
 * @property {string} [finalizedAt]
 * @property {string} [amendedAt]
 * @property {string} [issueDate]
 * @property {string} [testName]
 * @property {string[]} specimens
 * @property {number} [version]
 * @property {string} [supersedesReportId]
 * @property {string} referringClinician
 * @property {string} clinicalHistory
 * @property {string} findings
 * @property {string} diagnosis
 * @property {string} interpretation
 * @property {unknown[]} testResults
 */

/**
 * @typedef {object} WorklistPatient
 * @property {string} id
 * @property {string} [name]
 * @property {string} [patientId]
 */

/**
 * @typedef {object} WorklistFilters
 * @property {string | undefined} [search]
 * @property {string | undefined} [status]
 * @property {string | undefined} [from]
 * @property {string | undefined} [to]
 * @property {string | undefined} [sort]
 * @property {((report: any) => boolean) | undefined} [needsAttention]
 */

/**
 * @param {WorklistReport[]} reports
 * @param {WorklistPatient[]} patients
 * @param {WorklistFilters} [filters]
 * @returns {WorklistReport[]}
 */
export function filterWorklistReports(reports, patients, filters = {}) {
  const patientById = new Map(patients.map((patient) => [patient.id, patient]));
  const query = String(filters.search ?? '')
    .trim()
    .toLocaleLowerCase();
  const filtered = reports.filter((report) => {
    if (filters.status === 'attention') {
      if (report.status !== 'draft' || !filters.needsAttention?.(report)) return false;
    } else if (filters.status && filters.status !== 'all' && report.status !== filters.status) return false;
    if ((filters.from || filters.to) && !inRange(report.createdAt, filters.from, filters.to)) return false;
    if (!query) return true;
    const patient = patientById.get(report.patientId);
    return [patient?.name, patient?.patientId, report.id, report.testName, ...(report.specimens ?? [])]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase()
      .includes(query);
  });
  const sort = filters.sort ?? 'newest';
  const descending = sortDirection(sort) === 'desc';
  const field = sortField(sort);
  return stableSort(filtered, (a, b) => {
    let comparison = 0;
    if (field === 'created') {
      comparison = (parseDate(a.createdAt)?.getTime() ?? 0) - (parseDate(b.createdAt)?.getTime() ?? 0);
    } else if (field === 'patient') {
      comparison = String(patientById.get(a.patientId)?.name ?? '').localeCompare(
        String(patientById.get(b.patientId)?.name ?? ''),
      );
    } else if (field === 'test') {
      comparison = String(a.testName ?? '').localeCompare(String(b.testName ?? ''));
    } else if (field === 'status') {
      comparison = String(a.status).localeCompare(String(b.status));
    } else if (field === 'version') {
      comparison = Number(a.version ?? 0) - Number(b.version ?? 0);
    }
    return descending ? -comparison : comparison;
  });
}

/**
 * @typedef {object} HistoryFilters
 * @property {string} [search]
 * @property {string} [from]
 * @property {string} [to]
 * @property {string} [lifecycle]
 * @property {string} [sort]
 */

/**
 * @param {WorklistReport[]} reports
 * @param {WorklistPatient[]} patients
 * @param {HistoryFilters} [filters]
 * @returns {WorklistReport[]}
 */
export function filterHistoryReports(reports, patients, filters = {}) {
  const lifecycle = filters.lifecycle ?? 'all';
  const subset = reports.filter(
    (report) =>
      lifecycle === 'all' ||
      (lifecycle === 'amended' ? Boolean(report.supersedesReportId) : report.status === lifecycle),
  );
  const withEventDate = subset.map((report) => ({ ...report, createdAt: historyEventDate(report) }));
  return filterWorklistReports(withEventDate, patients, {
    search: filters.search,
    from: filters.from,
    to: filters.to,
    sort: filters.sort ?? 'newest',
    status: 'all',
  });
}
