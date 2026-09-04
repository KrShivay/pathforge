import { assertValidReport, REPORT_STATES } from '../domain/index.mjs';

import { DOCUMENT_MODEL_SCHEMA } from './contracts.mjs';

const UNRESOLVED_CATEGORIES = new Set(['layout', 'pagination', 'typography', 'renderer-version', 'other']);
const UNRESOLVED_STATUSES = new Set(['UNKNOWN', 'ASSUMPTION']);
const FIELD_PROVENANCE_KEYS = new Set(['field_id', 'source_catalog_version', 'option_id']);
const FIELD_ANNOTATION_KEYS = new Set(['_comment', 'changed_in_this_version']);

export class DocumentModelValidationError extends Error {
  /** @param {string[]} issues */
  constructor(issues) {
    super(`document model configuration is invalid:\n- ${issues.join('\n- ')}`);
    this.name = 'DocumentModelValidationError';
    this.issues = Object.freeze([...issues]);
  }
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** @param {unknown} value @returns {value is string} */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Copy JSON-shaped values into deterministic object-key order. Array order is
 * semantic and therefore retained.
 * @param {unknown} value
 * @param {string} path
 * @returns {import('../domain/contracts.mjs').JsonValue}
 */
function stableJsonCopy(value, path) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return value;
    throw new DocumentModelValidationError([`${path} must contain only finite numbers`]);
  }
  if (Array.isArray(value)) return value.map((child, index) => stableJsonCopy(child, `${path}[${index}]`));
  if (!isPlainObject(value)) {
    throw new DocumentModelValidationError([`${path} must contain only JSON-compatible values`]);
  }

  /** @type {Record<string, import('../domain/contracts.mjs').JsonValue>} */
  const copy = {};
  for (const key of Object.keys(value).sort()) {
    if (value[key] !== undefined) copy[key] = stableJsonCopy(value[key], `${path}.${key}`);
  }
  return copy;
}

/** @template T @param {T} value @returns {Readonly<T>} */
function deepFreeze(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(/** @type {Record<string, unknown>} */ (value))) deepFreeze(child);
    Object.freeze(value);
  }
  return /** @type {Readonly<T>} */ (value);
}

/**
 * Validate the complete semantic mapping. Exact payload coverage prevents a
 * future renderer from silently dropping or inventing clinical rows.
 * @param {unknown} config
 * @param {Readonly<import('../domain/contracts.mjs').ResolvedPayload>} payload
 * @returns {asserts config is import('./contracts.mjs').DocumentModelConfig}
 */
function assertValidConfig(config, payload) {
  /** @type {string[]} */
  const issues = [];
  if (!isPlainObject(config)) throw new DocumentModelValidationError(['config must be an object']);

  for (const key of ['config_id', 'config_version', 'locale']) {
    if (!isNonEmptyString(config[key])) issues.push(`${key} must be a non-empty string`);
  }
  if (!Array.isArray(config.sections) || config.sections.length === 0) {
    issues.push('sections must be a non-empty array');
  }
  if (!Array.isArray(config.unresolved_inputs)) {
    issues.push('unresolved_inputs must be an array (use [] when every input is resolved)');
  }

  const sectionIds = new Set();
  const configuredFieldIds = new Set();
  if (Array.isArray(config.sections)) {
    for (const [sectionIndex, section] of config.sections.entries()) {
      const sectionPath = `sections[${sectionIndex}]`;
      if (!isPlainObject(section)) {
        issues.push(`${sectionPath} must be an object`);
        continue;
      }
      if (!isNonEmptyString(section.section_id)) issues.push(`${sectionPath}.section_id must be a non-empty string`);
      else if (sectionIds.has(section.section_id)) issues.push(`${sectionPath}.section_id must be unique`);
      else sectionIds.add(section.section_id);
      if (!isNonEmptyString(section.semantic_role)) {
        issues.push(`${sectionPath}.semantic_role must be a non-empty string`);
      }
      if (section.heading !== undefined && !isNonEmptyString(section.heading)) {
        issues.push(`${sectionPath}.heading must be a non-empty string when provided`);
      }
      if (!Array.isArray(section.fields) || section.fields.length === 0) {
        issues.push(`${sectionPath}.fields must be a non-empty array`);
        continue;
      }
      for (const [fieldIndex, field] of section.fields.entries()) {
        const fieldPath = `${sectionPath}.fields[${fieldIndex}]`;
        if (!isPlainObject(field)) {
          issues.push(`${fieldPath} must be an object`);
          continue;
        }
        if (!isNonEmptyString(field.field_id)) {
          issues.push(`${fieldPath}.field_id must be a non-empty string`);
        } else if (!Object.hasOwn(payload, field.field_id)) {
          issues.push(`${fieldPath}.field_id references unknown payload field ${field.field_id}`);
        } else if (configuredFieldIds.has(field.field_id)) {
          issues.push(`${fieldPath}.field_id must appear exactly once`);
        } else {
          configuredFieldIds.add(field.field_id);
        }
        if (!isNonEmptyString(field.semantic_role)) {
          issues.push(`${fieldPath}.semantic_role must be a non-empty string`);
        }
      }
    }
  }

  for (const fieldId of Object.keys(payload).sort()) {
    if (!configuredFieldIds.has(fieldId)) issues.push(`sections must include payload field ${fieldId}`);
  }

  const unresolvedIds = new Set();
  if (Array.isArray(config.unresolved_inputs)) {
    for (const [index, input] of config.unresolved_inputs.entries()) {
      const path = `unresolved_inputs[${index}]`;
      if (!isPlainObject(input)) {
        issues.push(`${path} must be an object`);
        continue;
      }
      if (!isNonEmptyString(input.input_id)) issues.push(`${path}.input_id must be a non-empty string`);
      else if (unresolvedIds.has(input.input_id)) issues.push(`${path}.input_id must be unique`);
      else unresolvedIds.add(input.input_id);
      if (!UNRESOLVED_CATEGORIES.has(String(input.category))) {
        issues.push(`${path}.category is not supported`);
      }
      if (!UNRESOLVED_STATUSES.has(String(input.status))) issues.push(`${path}.status must be UNKNOWN or ASSUMPTION`);
      if (!isNonEmptyString(input.reason)) issues.push(`${path}.reason must be a non-empty string`);
      if (input.reference !== undefined && !isNonEmptyString(input.reference)) {
        issues.push(`${path}.reference must be a non-empty string when provided`);
      }
    }
  }

  if (issues.length > 0) throw new DocumentModelValidationError(issues);
}

/**
 * @param {import('../domain/contracts.mjs').ResolvedPayloadEntry} entry
 * @param {string} fieldId
 * @returns {Record<string, import('../domain/contracts.mjs').JsonValue>}
 */
function buildFieldContent(entry, fieldId) {
  /** @type {Record<string, import('../domain/contracts.mjs').JsonValue>} */
  const content = {};
  for (const key of Object.keys(entry).sort()) {
    if (FIELD_PROVENANCE_KEYS.has(key) || FIELD_ANNOTATION_KEYS.has(key) || entry[key] === undefined) continue;
    content[key] = stableJsonCopy(entry[key], `resolved_payload.${fieldId}.${key}`);
  }
  return content;
}

/** @param {import('./contracts.mjs').UnresolvedRenderInput} input */
function copyUnresolvedInput(input) {
  /** @type {import('./contracts.mjs').UnresolvedRenderInput} */
  const copy = {
    input_id: input.input_id,
    category: input.category,
    status: input.status,
    reason: input.reason,
  };
  if (input.reference !== undefined) copy.reference = input.reference;
  return copy;
}

/**
 * Build an immutable, presentation-neutral document model. Clinical content is
 * copied only from the finalized version's resolved snapshot; this function has
 * no catalog/provider parameter and performs no current-catalog lookup.
 * @param {unknown} reportInput
 * @param {unknown} configInput
 * @returns {Readonly<import('./contracts.mjs').ReportDocumentModel>}
 */
export function buildReportDocumentModel(reportInput, configInput) {
  assertValidReport(reportInput, 'document model report');
  const report = /** @type {import('../domain/contracts.mjs').ReportVersion} */ (reportInput);
  if (report.lifecycle_state !== REPORT_STATES.FINALIZED) {
    throw new DocumentModelValidationError(['report must be finalized before document modeling']);
  }
  if (report.issue_number === undefined || report.issue_date === undefined) {
    throw new DocumentModelValidationError(['finalized report must have issue identity']);
  }

  assertValidConfig(configInput, report.resolved_payload);
  const config = configInput;

  /** @type {import('./contracts.mjs').DocumentSection[]} */
  const sections = config.sections.map((section) => {
    /** @type {import('./contracts.mjs').DocumentSection} */
    const modeledSection = {
      section_id: section.section_id,
      semantic_role: section.semantic_role,
      fields: section.fields.map((fieldConfig) => {
        const entry = report.resolved_payload[fieldConfig.field_id];
        if (entry === undefined) {
          throw new DocumentModelValidationError([`resolved_payload.${fieldConfig.field_id} is unavailable`]);
        }
        /** @type {import('./contracts.mjs').DocumentField} */
        const field = {
          field_id: fieldConfig.field_id,
          semantic_role: fieldConfig.semantic_role,
          content: buildFieldContent(entry, fieldConfig.field_id),
          provenance: { source_catalog_version: entry.source_catalog_version },
        };
        if (entry.option_id !== undefined) field.provenance.option_id = entry.option_id;
        return field;
      }),
    };
    if (section.heading !== undefined) modeledSection.heading = section.heading;
    return modeledSection;
  });

  /** @type {import('./contracts.mjs').ReportDocumentModel['provenance']} */
  const provenance = { source_catalog_version: report.source_catalog_version };
  if (report.finalized_at !== undefined) provenance.finalized_at = report.finalized_at;
  if (report.finalized_by !== undefined) provenance.finalized_by = report.finalized_by;
  if (report.amended_at !== undefined) provenance.amended_at = report.amended_at;
  if (report.amended_by !== undefined) provenance.amended_by = report.amended_by;

  const model = {
    model_schema: DOCUMENT_MODEL_SCHEMA,
    report_version: { report_id: report.report_id, version: report.version },
    issue: { number: report.issue_number, date: report.issue_date },
    lineage: {
      supersedes:
        report.supersedes === null
          ? null
          : { report_id: report.supersedes.report_id, version: report.supersedes.version },
    },
    provenance,
    render_configuration: {
      config_id: config.config_id,
      config_version: config.config_version,
      locale: config.locale,
      unresolved_inputs: config.unresolved_inputs.map(copyUnresolvedInput),
    },
    sections,
  };

  return /** @type {Readonly<import('./contracts.mjs').ReportDocumentModel>} */ (deepFreeze(model));
}
