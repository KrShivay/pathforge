import { canonicalizeReport, canonicalizeResolvedPayload } from './canonicalization.mjs';
import { domainValuesEqual, isPlainObject } from './internal.mjs';

/**
 * @param {unknown} left
 * @param {unknown} right
 * @param {string} path
 * @param {import('./contracts.mjs').ClinicalChange[]} changes
 */
function collectChanges(left, right, path, changes) {
  if (domainValuesEqual(left, right)) return;
  if (isPlainObject(left) && isPlainObject(right)) {
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
    for (const key of keys) {
      const childPath = path ? `${path}.${key}` : key;
      if (!Object.hasOwn(left, key)) {
        changes.push({
          path: childPath,
          kind: 'added',
          after: /** @type {import('./contracts.mjs').JsonValue} */ (right[key]),
        });
      } else if (!Object.hasOwn(right, key)) {
        changes.push({
          path: childPath,
          kind: 'removed',
          before: /** @type {import('./contracts.mjs').JsonValue} */ (left[key]),
        });
      } else {
        collectChanges(left[key], right[key], childPath, changes);
      }
    }
    return;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
      const childPath = `${path}[${index}]`;
      if (index >= left.length) changes.push({ path: childPath, kind: 'added', after: right[index] });
      else if (index >= right.length) changes.push({ path: childPath, kind: 'removed', before: left[index] });
      else collectChanges(left[index], right[index], childPath, changes);
    }
    return;
  }
  changes.push({
    path,
    kind: 'changed',
    before: /** @type {import('./contracts.mjs').JsonValue} */ (left),
    after: /** @type {import('./contracts.mjs').JsonValue} */ (right),
  });
}

/** @param {string} path @param {Set<string>} knownFields */
function owningField(path, knownFields) {
  let match = '';
  for (const field of knownFields) {
    if ((path === field || path.startsWith(`${field}.`) || path.startsWith(`${field}[`)) && field.length > match.length)
      match = field;
  }
  return match || path.split('.')[0] || path;
}

/**
 * Compare actual clinical content field-by-field. Fingerprints are deliberately
 * not consulted, so the result is independently explainable (INV-7).
 * @param {unknown} leftReport
 * @param {unknown} rightReport
 * @returns {import('./contracts.mjs').ClinicalComparison}
 */
export function compareClinicalReports(leftReport, rightReport) {
  const left = canonicalizeReport(leftReport);
  const right = canonicalizeReport(rightReport);
  return compareCanonicalPayloads(left, right);
}

/**
 * Raw-payload counterpart for callers that already separated the version
 * envelope. It applies the same canonical rules as report comparison.
 * @param {unknown} leftPayload
 * @param {unknown} rightPayload
 * @returns {import('./contracts.mjs').ClinicalComparison}
 */
export function compareClinicalPayloads(leftPayload, rightPayload) {
  return compareCanonicalPayloads(canonicalizeResolvedPayload(leftPayload), canonicalizeResolvedPayload(rightPayload));
}

/**
 * @param {Readonly<import('./contracts.mjs').CanonicalClinicalPayload>} left
 * @param {Readonly<import('./contracts.mjs').CanonicalClinicalPayload>} right
 * @returns {import('./contracts.mjs').ClinicalComparison}
 */
function compareCanonicalPayloads(left, right) {
  /** @type {import('./contracts.mjs').ClinicalChange[]} */
  const changes = [];
  collectChanges(left, right, '', changes);

  const knownFields = new Set([...Object.keys(left), ...Object.keys(right)]);
  const changedClinicalFields = [...new Set(changes.map((change) => owningField(change.path, knownFields)))].sort();
  const unchangedClinicalFields = [...knownFields].filter((field) => !changedClinicalFields.includes(field)).sort();
  const equal = changes.length === 0;

  return {
    result: equal ? 'EQUAL' : 'DIFFERENT',
    equal,
    clinicalDiff: !equal,
    changes,
    changedClinicalFields,
    unchangedClinicalFields,
    explanation: equal
      ? 'Clinical payloads are equal after explicit canonicalization.'
      : `Clinical payloads differ at ${changes.map((change) => change.path).join(', ')}.`,
  };
}
