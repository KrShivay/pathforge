/** @typedef {{text: string, compact: string, digits: string}} LookupValue */

/**
 * @param {unknown} value
 * @returns {LookupValue}
 */
function normalizeLookupValue(value) {
  const text = String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  return {
    text,
    compact: text.replace(/[^a-z0-9]+/g, ''),
    digits: text.replace(/\D+/g, ''),
  };
}

/**
 * @param {LookupValue} value
 * @param {LookupValue} query
 */
function matchesLookupValue(value, query) {
  if (!value.text) return false;

  if (value.text.includes(query.text) || (query.compact && value.compact.includes(query.compact))) {
    return true;
  }

  // This lets a ten-digit phone search match a stored number with a country
  // prefix (and vice versa) without making users enter formatting characters.
  return Boolean(
    query.digits && value.digits && (value.digits.includes(query.digits) || query.digits.includes(value.digits)),
  );
}

/**
 * Return patients matching the report wizard search query.
 *
 * Matching is intentionally forgiving: it is case-insensitive, supports
 * partial values, ignores punctuation, and searches every patient detail
 * shown in the selection card.
 *
 * @template {{name?: string, patientId?: string, phone?: string, age?: number, gender?: string, address?: string}} T
 * @param {ReadonlyArray<T>} patients
 * @param {string} search
 * @returns {T[]}
 */
export function filterPatients(patients, search) {
  const query = normalizeLookupValue(search);
  if (!query.text) return [...patients];

  return patients.filter((patient) =>
    [patient.name, patient.patientId, patient.phone, patient.age, patient.gender, patient.address].some((value) =>
      matchesLookupValue(normalizeLookupValue(value), query),
    ),
  );
}
