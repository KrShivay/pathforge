/**
 * Validate a result against the type declared by its laboratory parameter.
 * Empty values are valid while a report is still being drafted.
 * @param {unknown} value
 * @param {"number" | "text"} type
 * @returns {string}
 */
export function resultTypeError(value, type) {
  const text = String(value ?? '').trim();
  if (!text || type !== 'number') return '';
  return Number.isFinite(Number(text)) ? '' : 'Enter a numeric value for this parameter.';
}
