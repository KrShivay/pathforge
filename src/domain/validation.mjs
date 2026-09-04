import { REPORT_STATES } from './contracts.mjs';
import { isPlainObject } from './internal.mjs';

export class DomainValidationError extends Error {
  /** @param {string} subject @param {string[]} issues */
  constructor(subject, issues) {
    super(`${subject} is invalid:\n${issues.map((issue) => `- ${issue}`).join('\n')}`);
    this.name = 'DomainValidationError';
    this.subject = subject;
    this.issues = Object.freeze([...issues]);
  }
}

/** @param {unknown} value @returns {value is string} */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** @param {unknown} value */
function isIsoTimestamp(value) {
  return (
    isNonEmptyString(value) &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

/** @param {unknown} value */
function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** @param {string[]} issues @param {string} path @param {unknown} value */
function requireString(issues, path, value) {
  if (!isNonEmptyString(value)) issues.push(`${path} must be a non-empty string`);
}

/** @param {unknown} value @param {string} path @param {string[]} issues */
function validateReferenceRange(value, path, issues) {
  if (!isPlainObject(value)) {
    issues.push(`${path} must be an object`);
    return;
  }
  const keys = Object.keys(value);
  if (!keys.includes('low') && !keys.includes('high')) issues.push(`${path} must contain low or high`);
  for (const bound of ['low', 'high']) {
    if (value[bound] !== undefined && (typeof value[bound] !== 'number' || !Number.isFinite(value[bound]))) {
      issues.push(`${path}.${bound} must be a finite number`);
    }
  }
  if (
    typeof value.low === 'number' &&
    typeof value.high === 'number' &&
    Number.isFinite(value.low) &&
    Number.isFinite(value.high) &&
    value.low > value.high
  ) {
    issues.push(`${path}.low must not exceed ${path}.high`);
  }
}

/**
 * Validate the fixture-backed catalog contract without changing the input.
 * Unknown fields are retained for forward-compatible catalog evolution.
 * @param {unknown} catalog
 * @returns {string[]}
 */
export function validateCatalog(catalog) {
  /** @type {string[]} */
  const issues = [];
  if (!isPlainObject(catalog)) return ['catalog must be an object'];
  requireString(issues, 'catalog_version', catalog.catalog_version);
  if (!isIsoTimestamp(catalog.published_at)) issues.push('published_at must be an ISO-8601 timestamp');
  if (catalog.supersedes !== undefined) requireString(issues, 'supersedes', catalog.supersedes);
  if (!isPlainObject(catalog.fields) || Object.keys(catalog.fields).length === 0) {
    issues.push('fields must be a non-empty object');
    return issues;
  }

  for (const [fieldKey, field] of Object.entries(catalog.fields)) {
    const path = `fields.${fieldKey}`;
    if (!isPlainObject(field)) {
      issues.push(`${path} must be an object`);
      continue;
    }
    requireString(issues, `${path}.field_id`, field.field_id);
    if (field.field_id !== undefined && field.field_id !== fieldKey)
      issues.push(`${path}.field_id must match its field key`);
    if (field.display !== undefined) requireString(issues, `${path}.display`, field.display);
    if (field.unit !== undefined) requireString(issues, `${path}.unit`, field.unit);
    if (field.reference_range !== undefined)
      validateReferenceRange(field.reference_range, `${path}.reference_range`, issues);

    if (field.options !== undefined) {
      if (!Array.isArray(field.options) || field.options.length === 0) {
        issues.push(`${path}.options must be a non-empty array`);
      } else {
        const optionIds = new Set();
        for (const [index, option] of field.options.entries()) {
          const optionPath = `${path}.options[${index}]`;
          if (!isPlainObject(option)) {
            issues.push(`${optionPath} must be an object`);
            continue;
          }
          requireString(issues, `${optionPath}.option_id`, option.option_id);
          requireString(issues, `${optionPath}.label`, option.label);
          if (isNonEmptyString(option.option_id)) {
            if (optionIds.has(option.option_id)) issues.push(`${optionPath}.option_id must be unique within the field`);
            optionIds.add(option.option_id);
          }
          if (option.deprecated !== undefined && typeof option.deprecated !== 'boolean') {
            issues.push(`${optionPath}.deprecated must be a boolean`);
          }
        }
      }
    }
    if (field.display === undefined && field.options === undefined) {
      issues.push(`${path} must provide display or options`);
    }
  }
  return issues;
}

/** @param {unknown} payload @param {string} [rootPath] */
export function validateResolvedPayload(payload, rootPath = 'resolved_payload') {
  /** @type {string[]} */
  const issues = [];
  if (!isPlainObject(payload) || Object.keys(payload).length === 0) return [`${rootPath} must be a non-empty object`];

  for (const [fieldKey, entry] of Object.entries(payload)) {
    const path = `${rootPath}.${fieldKey}`;
    if (!isPlainObject(entry)) {
      issues.push(`${path} must be an object`);
      continue;
    }
    requireString(issues, `${path}.field_id`, entry.field_id);
    if (entry.field_id !== undefined && entry.field_id !== fieldKey)
      issues.push(`${path}.field_id must match its payload key`);
    requireString(issues, `${path}.display`, entry.display);
    requireString(issues, `${path}.source_catalog_version`, entry.source_catalog_version);
    if (entry.option_id !== undefined) requireString(issues, `${path}.option_id`, entry.option_id);
    if (!Object.hasOwn(entry, 'value') && entry.option_id === undefined) {
      issues.push(`${path} must contain value or option_id`);
    }
    if (typeof entry.value === 'number' && !Number.isFinite(entry.value)) issues.push(`${path}.value must be finite`);
    if (entry.unit !== undefined) requireString(issues, `${path}.unit`, entry.unit);
    if (entry.flag !== undefined) requireString(issues, `${path}.flag`, entry.flag);
    if (entry.interpretation !== undefined) requireString(issues, `${path}.interpretation`, entry.interpretation);
    if (entry.changed_in_this_version !== undefined && typeof entry.changed_in_this_version !== 'boolean') {
      issues.push(`${path}.changed_in_this_version must be a boolean`);
    }
    if (entry.reference_range !== undefined)
      validateReferenceRange(entry.reference_range, `${path}.reference_range`, issues);
  }
  return issues;
}

/**
 * @param {unknown} report
 * @returns {string[]}
 */
export function validateReport(report) {
  /** @type {string[]} */
  const issues = [];
  if (!isPlainObject(report)) return ['report must be an object'];
  requireString(issues, 'report_id', report.report_id);
  if (!Number.isInteger(report.version) || Number(report.version) < 1)
    issues.push('version must be a positive integer');
  if (report.lifecycle_state !== REPORT_STATES.DRAFT && report.lifecycle_state !== REPORT_STATES.FINALIZED) {
    issues.push(`lifecycle_state must be ${REPORT_STATES.DRAFT} or ${REPORT_STATES.FINALIZED}`);
  }
  requireString(issues, 'source_catalog_version', report.source_catalog_version);
  issues.push(...validateResolvedPayload(report.resolved_payload));

  if (report.supersedes !== null && report.supersedes !== undefined) {
    if (!isPlainObject(report.supersedes)) {
      issues.push('supersedes must be null or a report-version identity');
    } else {
      requireString(issues, 'supersedes.report_id', report.supersedes.report_id);
      if (!Number.isInteger(report.supersedes.version) || Number(report.supersedes.version) < 1) {
        issues.push('supersedes.version must be a positive integer');
      }
      if (report.supersedes.report_id !== report.report_id) issues.push('supersedes.report_id must match report_id');
      if (Number.isInteger(report.version) && Number(report.supersedes.version) >= Number(report.version)) {
        issues.push('supersedes.version must precede version');
      }
    }
  }

  if (report.lifecycle_state === REPORT_STATES.FINALIZED) {
    requireString(issues, 'issue_number', report.issue_number);
    if (!isIsoDate(report.issue_date)) issues.push('issue_date must be a valid YYYY-MM-DD date');
    if (report.supersedes) {
      requireString(issues, 'amendment_type', report.amendment_type);
      requireString(issues, 'amendment_reason', report.amendment_reason);
      requireString(issues, 'amended_by', report.amended_by);
      if (!isIsoTimestamp(report.amended_at)) issues.push('amended_at must be an ISO-8601 timestamp');
    } else {
      requireString(issues, 'finalized_by', report.finalized_by);
      if (!isIsoTimestamp(report.finalized_at)) issues.push('finalized_at must be an ISO-8601 timestamp');
    }
  }
  return issues;
}

/** @param {unknown} expected */
export function validateExpectedComparison(expected) {
  /** @type {string[]} */
  const issues = [];
  if (!isPlainObject(expected)) return ['expected comparison fixture must be an object'];
  if (!Array.isArray(expected.comparisons) || expected.comparisons.length === 0) {
    return ['comparisons must be a non-empty array'];
  }
  const ids = new Set();
  for (const [index, comparison] of expected.comparisons.entries()) {
    const path = `comparisons[${index}]`;
    if (!isPlainObject(comparison)) {
      issues.push(`${path} must be an object`);
      continue;
    }
    for (const key of ['id', 'left', 'right', 'expected_clinical_result', 'note']) {
      requireString(issues, `${path}.${key}`, comparison[key]);
    }
    if (isNonEmptyString(comparison.id)) {
      if (ids.has(comparison.id)) issues.push(`${path}.id must be unique`);
      ids.add(comparison.id);
    }
    if (!['EQUAL', 'DIFFERENT'].includes(String(comparison.expected_clinical_result))) {
      issues.push(`${path}.expected_clinical_result must be EQUAL or DIFFERENT`);
    }
    if (typeof comparison.clinical_diff !== 'boolean') issues.push(`${path}.clinical_diff must be a boolean`);
    for (const key of [
      'changed_clinical_fields',
      'unchanged_clinical_fields',
      'non_clinical_fields_that_differ_by_design',
    ]) {
      if (
        comparison[key] !== undefined &&
        (!Array.isArray(comparison[key]) || !comparison[key].every(isNonEmptyString))
      ) {
        issues.push(`${path}.${key} must be an array of non-empty strings`);
      }
    }
    if (
      ['EQUAL', 'DIFFERENT'].includes(String(comparison.expected_clinical_result)) &&
      comparison.clinical_diff === (comparison.expected_clinical_result === 'EQUAL')
    ) {
      issues.push(`${path}.clinical_diff contradicts expected_clinical_result`);
    }
  }
  return issues;
}

/**
 * @template T
 * @param {string} subject
 * @param {T} value
 * @param {(input: unknown) => string[]} validator
 * @returns {T}
 */
function assertValid(subject, value, validator) {
  const issues = validator(value);
  if (issues.length > 0) throw new DomainValidationError(subject, issues);
  return value;
}

/** @template T @param {string} text @param {string} source @returns {T} */
function parseJson(text, source) {
  try {
    return /** @type {T} */ (JSON.parse(text));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new DomainValidationError(source, [`must contain valid JSON (${message})`]);
  }
}

/** @param {string} text @param {string} [source] @returns {import('./contracts.mjs').Catalog} */
export function parseCatalogFixture(text, source = 'catalog fixture') {
  return assertValid(source, parseJson(text, source), validateCatalog);
}

/** @param {string} text @param {string} [source] @returns {import('./contracts.mjs').ReportVersion} */
export function parseReportFixture(text, source = 'report fixture') {
  return assertValid(source, parseJson(text, source), validateReport);
}

/** @param {string} text @param {string} [source] @returns {import('./contracts.mjs').ExpectedComparisonFixture} */
export function parseExpectedComparisonFixture(text, source = 'comparison fixture') {
  return assertValid(source, parseJson(text, source), validateExpectedComparison);
}

/** @param {unknown} report @param {string} [subject] */
export function assertValidReport(report, subject = 'report') {
  return assertValid(subject, report, validateReport);
}
