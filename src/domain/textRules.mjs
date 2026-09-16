/**
 * Single source of truth for which characters a user may type into PathForge.
 *
 * There is deliberately no per-component regex anywhere else — every patient,
 * report, test, parameter, findings, diagnosis and result field runs through the
 * helpers here. Allowlisting is one layer only: values are still escaped when
 * rendered and always bound as SQL parameters, never concatenated.
 *
 *   general  letters, digits, spaces and  - . , ( ) & %
 *   result   general plus  +   (trace / 1+ / 2+ / 3+ qualitative notation)
 *   phone    digits, spaces and  + - ( )
 */

/** @typedef {'general' | 'result'} TextKind */

// Unicode letters are allowed so accented names ("José", "Müller") survive; the
// rejected set (! @ # $ ^ * _ = { } [ ] < > / \ | ~ ` …) contains no letters.
// En/em dashes join the ASCII hyphen because the app's own reference ranges and
// clinical prose use them ("12 – 15").
const GENERAL_DISALLOWED_SOURCE = '0-9\\s.,()&%\\-\\u2013\\u2014';
const RESULT_DISALLOWED_SOURCE = `${GENERAL_DISALLOWED_SOURCE}+`;

/** @param {TextKind} kind @returns {RegExp} a fresh regex (no shared lastIndex) */
function disallowed(kind) {
  const source = kind === 'result' ? RESULT_DISALLOWED_SOURCE : GENERAL_DISALLOWED_SOURCE;
  return new RegExp(`[^\\p{L}${source}]`, 'gu');
}

const PHONE_DISALLOWED = /[^\d+()\s-]/g;

/**
 * Remove every character that is not permitted for `kind`. Valid text is
 * returned unchanged — this never rewrites or reorders legitimate content.
 * @param {unknown} value
 * @param {TextKind} [kind]
 * @returns {string}
 */
export function sanitizeText(value, kind = 'general') {
  return String(value ?? '').replace(disallowed(kind), '');
}

/**
 * True when `value` contains at least one character not permitted for `kind`.
 * Used by the save/finalize path so UI filtering is not the only guard.
 * @param {unknown} value
 * @param {TextKind} [kind]
 * @returns {boolean}
 */
export function containsInvalidChars(value, kind = 'general') {
  return disallowed(kind).test(String(value ?? ''));
}

/**
 * The distinct disallowed characters found in `value`, for error messages.
 * @param {unknown} value
 * @param {TextKind} [kind]
 * @returns {string[]}
 */
export function invalidCharsIn(value, kind = 'general') {
  const found = String(value ?? '').match(disallowed(kind)) ?? [];
  return [...new Set(found)];
}

/**
 * Keep only characters valid in a phone number (digits, spaces, + - ( )).
 * @param {unknown} value
 * @returns {string}
 */
export function sanitizePhone(value) {
  return String(value ?? '').replace(PHONE_DISALLOWED, '');
}
