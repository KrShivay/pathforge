/**
 * Patient identifier: `PF-YYYYMMDD-NNN`.
 *
 * - `YYYYMMDD` is the registration date.
 * - `NNN` is a per-day sequence, zero-padded to at least three digits.
 *
 * The ID is generated once, at registration, and then stored — it must never be
 * recomputed on a re-render or change when the same patient is reused.
 */

/** @typedef {{ date: string, sequence: number }} PatientIdParts */

const PATIENT_ID_PATTERN = /^PF-(\d{8})-(\d{3,})$/;

/**
 * `Date` -> `YYYYMMDD` in local time.
 * @param {Date} date
 * @returns {string}
 */
export function datePrefix(date) {
  const year = date.getFullYear().toString().padStart(4, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * @param {string} prefix `YYYYMMDD`
 * @param {number} sequence
 * @returns {string}
 */
export function formatPatientId(prefix, sequence) {
  return `PF-${prefix}-${sequence.toString().padStart(3, '0')}`;
}

/**
 * @param {string} value
 * @returns {PatientIdParts | null}
 */
export function parsePatientId(value) {
  const match = PATIENT_ID_PATTERN.exec(value.trim());
  if (!match) return null;
  return { date: /** @type {string} */ (match[1]), sequence: Number(match[2]) };
}

/**
 * Next free patient ID for `date`, given every ID already in use. Scans existing
 * IDs for the same day and takes the highest sequence + 1, so it stays correct
 * even if records were added out of order or some were deleted.
 * @param {Iterable<string>} existingIds
 * @param {Date} [date]
 * @returns {string}
 */
export function nextPatientId(existingIds, date = new Date()) {
  const prefix = datePrefix(date);
  let highest = 0;

  for (const id of existingIds) {
    const parts = parsePatientId(id);
    if (parts && parts.date === prefix && parts.sequence > highest) {
      highest = parts.sequence;
    }
  }

  return formatPatientId(prefix, highest + 1);
}
