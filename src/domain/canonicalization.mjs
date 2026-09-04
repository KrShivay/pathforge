import { createHash } from 'node:crypto';

import { cloneDomainValue, isPlainObject } from './internal.mjs';
import { DomainValidationError, validateResolvedPayload } from './validation.mjs';

const NON_CLINICAL_PAYLOAD_ANNOTATIONS = new Set(['_comment', 'changed_in_this_version']);

/**
 * @param {unknown} value
 * @returns {import('./contracts.mjs').JsonValue}
 */
function canonicalizeValue(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new DomainValidationError('resolved payload', ['numeric values must be finite']);
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => canonicalizeValue(item));
  if (!isPlainObject(value)) throw new DomainValidationError('resolved payload', ['values must be JSON-compatible']);

  /** @type {Record<string, import('./contracts.mjs').JsonValue>} */
  const canonical = {};
  for (const key of Object.keys(value).sort()) {
    if (NON_CLINICAL_PAYLOAD_ANNOTATIONS.has(key) || key === 'source_catalog_version') continue;
    const child = value[key];
    if (child !== undefined) canonical[key] = canonicalizeValue(child);
  }
  return canonical;
}

/**
 * Build the authoritative clinical form. Object keys are sorted, arrays retain
 * their order, and only explicit annotation/provenance keys are omitted.
 * @param {unknown} payload
 * @returns {Readonly<import('./contracts.mjs').CanonicalClinicalPayload>}
 */
export function canonicalizeResolvedPayload(payload) {
  const issues = validateResolvedPayload(payload);
  if (issues.length > 0) throw new DomainValidationError('resolved payload', issues);
  return /** @type {Readonly<import('./contracts.mjs').CanonicalClinicalPayload>} */ (
    /** @type {unknown} */ (canonicalizeValue(cloneDomainValue(payload)))
  );
}

/**
 * Report-envelope metadata is intentionally excluded by selecting only the
 * self-contained resolved payload (ADR-0001).
 * @param {unknown} report
 */
export function canonicalizeReport(report) {
  if (!isPlainObject(report) || !Object.hasOwn(report, 'resolved_payload')) {
    throw new DomainValidationError('report', ['resolved_payload is required']);
  }
  return canonicalizeResolvedPayload(report.resolved_payload);
}

/** @param {unknown} reportOrPayload */
export function stableClinicalSerialization(reportOrPayload) {
  const canonical =
    isPlainObject(reportOrPayload) && Object.hasOwn(reportOrPayload, 'resolved_payload')
      ? canonicalizeReport(reportOrPayload)
      : canonicalizeResolvedPayload(reportOrPayload);
  return JSON.stringify(canonical);
}

/**
 * Diagnostic only; compareClinicalReports remains authoritative (INV-7).
 * @param {unknown} reportOrPayload
 */
export function semanticFingerprint(reportOrPayload) {
  return createHash('sha256').update(stableClinicalSerialization(reportOrPayload)).digest('hex');
}
