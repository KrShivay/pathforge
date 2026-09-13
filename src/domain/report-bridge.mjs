/**
 * Bridge between the React workspace shapes (patient-facing narrative fields plus
 * a table of laboratory results) and the canonical domain `resolved_payload`
 * snapshot consumed by `src/domain` and `src/service`.
 *
 * The domain deliberately knows nothing about patients, catalogs of tests, or
 * UI form state. This module is the single place that maps between the two so the
 * React layer can delegate every lifecycle decision to `createReportService`
 * instead of re-implementing validation, immutability, lineage, and audit.
 */

/**
 * @typedef {{min?: number, max?: number, text?: string}} WorkspaceReferenceRange
 */

/**
 * @typedef {{
 *   parameterId: string,
 *   parameterName: string,
 *   testId?: string,
 *   testName?: string,
 *   unit?: string,
 *   value?: string,
 *   referenceRange?: WorkspaceReferenceRange
 * }} WorkspaceTestResult
 */

/**
 * @typedef {{
 *   specimens?: string[],
 *   specimenCollectionDate?: string,
 *   referringClinician?: string,
 *   interpretation?: string,
 *   clinicalHistory?: string,
 *   findings?: string,
 *   diagnosis?: string,
 *   testResults?: WorkspaceTestResult[]
 * }} WorkspaceReportContent
 */

import { containsInvalidChars, sanitizeText } from './textRules.mjs';

/** Catalog version stamped onto every locally-authored payload entry. */
export const WORKSPACE_CATALOG_VERSION = 'workspace';

/** Prefix marking a payload key that came from a laboratory-test parameter. */
export const RESULT_FIELD_PREFIX = 'result.';

/** @typedef {'specimens' | 'referringClinician' | 'clinicalHistory' | 'findings' | 'diagnosis' | 'interpretation'} NarrativeKey */

/**
 * Narrative sections, in report order. `[field_id, display, contentKey]`.
 * @type {ReadonlyArray<readonly [string, string, NarrativeKey]>}
 */
export const NARRATIVE_FIELDS = [
  ['narrative.specimen_type', 'Specimens', 'specimens'],
  ['narrative.referring_clinician', 'Referring Clinician', 'referringClinician'],
  ['narrative.clinical_history', 'Clinical History', 'clinicalHistory'],
  ['narrative.findings', 'Microscopic Findings', 'findings'],
  ['narrative.diagnosis', 'Diagnosis', 'diagnosis'],
  ['narrative.interpretation', 'Interpretation / Remarks', 'interpretation'],
];

/** Trim and case-insensitively deduplicate report-level specimen labels.
 * @param {unknown} values
 * @returns {string[]}
 */
export function normalizeSpecimens(values) {
  const input = Array.isArray(values) ? values : typeof values === 'string' ? [values] : [];
  const seen = new Set();
  const normalized = [];
  for (const value of input) {
    const clean = sanitizeText(asText(value).trim(), 'general');
    const key = clean.toLocaleLowerCase();
    if (clean && !seen.has(key)) {
      seen.add(key);
      normalized.push(clean);
    }
  }
  return normalized;
}

/** @param {unknown} value @returns {string} */
function specimenCollectionDateFromContent(value) {
  return asText(value).trim();
}

/** @param {string} value @returns {boolean} */
function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parts = value.split('-').map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 0;
  const day = parts[2] ?? 0;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** @param {WorkspaceReportContent} content @returns {string[]} */
function specimensFromContent(content) {
  return normalizeSpecimens(content.specimens);
}

/** @param {unknown} value @returns {string} */
function asText(value) {
  return typeof value === 'string' ? value : '';
}

/** @param {WorkspaceReferenceRange | undefined} range */
function toDomainReferenceRange(range) {
  if (!range) return undefined;
  /** @type {{low?: number, high?: number}} */
  const bounds = {};
  if (typeof range.min === 'number' && Number.isFinite(range.min)) bounds.low = range.min;
  if (typeof range.max === 'number' && Number.isFinite(range.max)) bounds.high = range.max;
  return bounds.low === undefined && bounds.high === undefined ? undefined : bounds;
}

/**
 * @param {Record<string, unknown> | undefined} entry
 * @returns {WorkspaceReferenceRange | undefined}
 */
function fromDomainReferenceRange(entry) {
  if (!entry) return undefined;
  const range = /** @type {{low?: number, high?: number} | undefined} */ (entry.reference_range);
  if (range && (typeof range.low === 'number' || typeof range.high === 'number')) {
    /** @type {WorkspaceReferenceRange} */
    const result = {};
    if (typeof range.low === 'number') result.min = range.low;
    if (typeof range.high === 'number') result.max = range.high;
    return result;
  }
  if (typeof entry.reference_text === 'string' && entry.reference_text.trim()) {
    return { text: entry.reference_text };
  }
  return undefined;
}

/**
 * Build a canonical `resolved_payload` from workspace content. Every value is a
 * string (empty when not yet entered) so a partial draft still validates
 * structurally; clinical completeness is checked separately at finalize time.
 * @param {WorkspaceReportContent} content
 * @returns {import('./contracts.mjs').ResolvedPayload}
 */
export function buildResolvedPayload(content) {
  /** @type {Record<string, Record<string, unknown>>} */
  const payload = {};

  for (const [fieldId, display, key] of NARRATIVE_FIELDS) {
    const specimens = key === 'specimens' ? specimensFromContent(content) : null;
    payload[fieldId] = {
      field_id: fieldId,
      display,
      kind: 'narrative',
      // Persistence-side allowlisting: even if a client skipped the input
      // filter, disallowed characters never reach the stored report.
      value: specimens ? specimens.join(', ') : sanitizeText(content[key], 'general'),
      ...(specimens ? { specimens } : {}),
      source_catalog_version: WORKSPACE_CATALOG_VERSION,
      ...(key === 'specimens' && specimenCollectionDateFromContent(content.specimenCollectionDate)
        ? { specimen_collection_date: specimenCollectionDateFromContent(content.specimenCollectionDate) }
        : {}),
    };
  }

  for (const result of content.testResults ?? []) {
    const testId = typeof result.testId === 'string' ? result.testId.trim() : '';
    const fieldId = testId
      ? `${RESULT_FIELD_PREFIX}${testId}::${result.parameterId}`
      : `${RESULT_FIELD_PREFIX}${result.parameterId}`;
    /** @type {Record<string, unknown>} */
    const entry = {
      field_id: fieldId,
      display: result.parameterName || result.parameterId,
      kind: 'result',
      // Results also permit "+" (trace / 1+ / 2+ / 3+).
      value: sanitizeText(result.value, 'result'),
      parameter_id: result.parameterId,
      source_catalog_version: WORKSPACE_CATALOG_VERSION,
    };
    if (testId) entry.test_id = testId;
    if (typeof result.testName === 'string' && result.testName.trim()) {
      entry.test_name = result.testName.trim();
    }
    if (typeof result.unit === 'string' && result.unit.trim()) entry.unit = result.unit;
    const range = toDomainReferenceRange(result.referenceRange);
    if (range) entry.reference_range = range;
    else if (result.referenceRange?.text?.trim()) {
      entry.reference_text = result.referenceRange.text;
    }
    payload[fieldId] = entry;
  }

  return /** @type {import('./contracts.mjs').ResolvedPayload} */ (payload);
}

/**
 * Reverse of {@link buildResolvedPayload}: recover editable workspace content
 * from a stored report version.
 * @param {{resolved_payload?: Record<string, Record<string, unknown>>}} reportVersion
 * @returns {Required<Omit<WorkspaceReportContent, 'testResults'>> & {testResults: WorkspaceTestResult[]}}
 */
export function readWorkspaceContent(reportVersion) {
  const payload = reportVersion.resolved_payload ?? {};

  const narrative = {
    /** @type {string[]} */
    specimens: [],
    specimenCollectionDate: '',
    referringClinician: '',
    clinicalHistory: '',
    findings: '',
    diagnosis: '',
    interpretation: '',
  };
  for (const [fieldId, , key] of NARRATIVE_FIELDS) {
    if (key === 'specimens') {
      const stored = payload[fieldId]?.specimens;
      narrative.specimens = normalizeSpecimens(Array.isArray(stored) ? stored : asText(payload[fieldId]?.value));
      narrative.specimenCollectionDate = asText(payload[fieldId]?.specimen_collection_date);
    } else {
      narrative[key] = asText(payload[fieldId]?.value);
    }
  }

  /** @type {WorkspaceTestResult[]} */
  const testResults = [];
  for (const [fieldId, entry] of Object.entries(payload)) {
    if (!fieldId.startsWith(RESULT_FIELD_PREFIX)) continue;
    const rest = fieldId.slice(RESULT_FIELD_PREFIX.length);
    const separator = rest.indexOf('::');
    const parsedParameterId = separator === -1 ? rest : rest.slice(separator + 2);
    /** @type {WorkspaceTestResult} */
    const result = {
      parameterId: asText(entry.parameter_id) || parsedParameterId,
      parameterName: asText(entry.display),
      value: asText(entry.value),
    };
    if (typeof entry.test_id === 'string' && entry.test_id) result.testId = entry.test_id;
    if (typeof entry.test_name === 'string' && entry.test_name) result.testName = entry.test_name;
    if (typeof entry.unit === 'string') result.unit = entry.unit;
    const range = fromDomainReferenceRange(entry);
    if (range) result.referenceRange = range;
    testResults.push(result);
  }

  return {
    specimens: narrative.specimens,
    specimenCollectionDate: narrative.specimenCollectionDate,

    referringClinician: narrative.referringClinician,
    interpretation: narrative.interpretation,
    clinicalHistory: narrative.clinicalHistory,
    findings: narrative.findings,
    diagnosis: narrative.diagnosis,
    testResults,
  };
}

/**
 * Clinical-completeness gate applied before finalization. This is intentionally
 * separate from the domain's structural validation: a draft is allowed to be
 * incomplete, a finalized report is not.
 * @param {WorkspaceReportContent} content
 * @returns {{field: string, message: string}[]}
 */
export function checkClinicalCompleteness(content) {
  /** @type {{field: string, message: string}[]} */
  const issues = [];

  // Character allowlist, re-checked here so it is enforced at finalize even if a
  // client wrote around the input filter (buildResolvedPayload also strips).
  /** @param {string} field @param {string} label @param {import('./textRules.mjs').TextKind} kind */
  const checkChars = (field, label, kind) => {
    const value = asText(/** @type {Record<string, unknown>} */ (content)[field]);
    if (containsInvalidChars(value, kind)) {
      issues.push({ field, message: `${label} contains characters that are not allowed.` });
    }
  };
  for (const specimen of specimensFromContent(content)) {
    if (containsInvalidChars(specimen, 'general')) {
      issues.push({ field: 'specimens', message: 'A specimen contains characters that are not allowed.' });
    }
  }
  const specimenCollectionDate = specimenCollectionDateFromContent(content.specimenCollectionDate);
  if (specimenCollectionDate && !isIsoDate(specimenCollectionDate)) {
    issues.push({ field: 'specimenCollectionDate', message: 'Specimen collection date must be a valid date.' });
  }
  checkChars('referringClinician', 'Referring clinician', 'general');
  checkChars('clinicalHistory', 'Clinical history', 'general');
  checkChars('findings', 'Findings', 'general');
  checkChars('diagnosis', 'Diagnosis', 'general');
  checkChars('interpretation', 'Interpretation / remarks', 'general');
  for (const result of content.testResults ?? []) {
    if (containsInvalidChars(asText(result.value), 'result')) {
      issues.push({
        field: `result.${result.parameterId}`,
        message: `Result for "${result.parameterName || result.parameterId}" contains characters that are not allowed.`,
      });
    }
  }

  if (specimensFromContent(content).length === 0) {
    issues.push({ field: 'specimens', message: 'At least one specimen is required.' });
  }
  if (!asText(content.findings).trim()) {
    issues.push({ field: 'findings', message: 'Microscopic findings are required.' });
  }
  if (!asText(content.diagnosis).trim()) {
    issues.push({ field: 'diagnosis', message: 'Diagnosis is required.' });
  }
  if (asText(content.clinicalHistory).length > 5000) {
    issues.push({ field: 'clinicalHistory', message: 'Clinical history cannot exceed 5000 characters.' });
  }

  // Two result rows that resolve to the same payload key (same test + same
  // parameter) collapse into one entry in buildResolvedPayload's plain-object
  // assignment — the second value silently overwrites the first. Flag this
  // before finalization instead of losing a clinical result with no trace.
  const seenFieldIds = new Set();
  for (const result of content.testResults ?? []) {
    const testId = typeof result.testId === 'string' ? result.testId.trim() : '';
    const fieldId = testId
      ? `${RESULT_FIELD_PREFIX}${testId}::${result.parameterId}`
      : `${RESULT_FIELD_PREFIX}${result.parameterId}`;
    if (seenFieldIds.has(fieldId)) {
      issues.push({
        field: fieldId,
        message: result.testName
          ? `Result for "${result.parameterName || result.parameterId}" (${result.testName}) is entered more than once; only one value would be kept.`
          : `Result for "${result.parameterName || result.parameterId}" is entered more than once; only one value would be kept.`,
      });
    }
    seenFieldIds.add(fieldId);
  }

  for (const result of content.testResults ?? []) {
    if (!asText(result.value).trim()) {
      const testId = typeof result.testId === 'string' ? result.testId.trim() : '';
      issues.push({
        field: testId ? `result.${testId}::${result.parameterId}` : `result.${result.parameterId}`,
        message: result.testName
          ? `Result for "${result.parameterName || result.parameterId}" (${result.testName}) is required.`
          : `Result for "${result.parameterName || result.parameterId}" is required.`,
      });
    }
  }
  return issues;
}

/**
 * A stable-shaped, presentation-neutral grouping for the report preview and PDF.
 * Works for drafts and finalized versions alike.
 * @param {{
 *   resolved_payload?: Record<string, Record<string, unknown>>,
 *   version?: number,
 *   lifecycle_state?: string,
 *   issue_number?: string,
 *   issue_date?: string
 * }} reportVersion
 */
export function groupForPreview(reportVersion) {
  const content = readWorkspaceContent(reportVersion);

  const results = content.testResults.map((result) => ({
    name: result.parameterName,
    value: result.value ?? '',
    unit: result.unit ?? '',
    reference: referenceLabel(result.referenceRange),
  }));

  /** @type {{testName: string | null, rows: typeof results}[]} */
  const resultGroups = [];
  const groupIndex = new Map();
  content.testResults.forEach((result, index) => {
    const key = result.testId || result.testName || '';
    let group = groupIndex.get(key);
    if (!group) {
      group = { testName: result.testName ?? null, rows: [] };
      groupIndex.set(key, group);
      resultGroups.push(group);
    }
    group.rows.push(results[index]);
  });

  return {
    version: reportVersion.version ?? 1,
    lifecycleState: reportVersion.lifecycle_state ?? 'draft',
    issueNumber: reportVersion.issue_number ?? null,
    issueDate: reportVersion.issue_date ?? null,
    narrative: NARRATIVE_FIELDS.map(([, label, key]) => ({ label, value: content[key] || '' })),
    results,
    resultGroups,
  };
}

/** @param {WorkspaceReferenceRange | undefined} range */
export function referenceLabel(range) {
  if (!range) return '';
  if (range.text) return range.text;
  const { min, max } = range;
  if (min !== undefined && max !== undefined) return `${min} – ${max}`;
  if (min !== undefined) return `≥ ${min}`;
  if (max !== undefined) return `≤ ${max}`;
  return '';
}

/** @param {string} isoDate `YYYY-MM-DD` */
export function issueDateFromIso(isoDate) {
  return isoDate.slice(0, 10);
}

/**
 * Generate a workspace issue/invoice number. Uniqueness only needs to hold for a
 * local single-workspace prototype.
 * @param {Date} [now]
 * @param {() => number} [random]
 */
export function generateIssueNumber(now = new Date(), random = Math.random) {
  const year = now.getUTCFullYear();
  const suffix = String(Math.floor(random() * 1_000_000)).padStart(6, '0');
  return `INV-${year}-${suffix}`;
}

/**
 * @typedef {{
 *   reportId: string,
 *   version: number,
 *   isFinalized: boolean,
 *   issueNumber?: string,
 *   issueDate?: string,
 *   finalizedAt?: string,
 *   finalizedBy?: string,
 *   amendedAt?: string,
 *   amendedBy?: string,
 *   amendmentType?: string,
 *   amendmentReason?: string,
 *   supersedesVersion?: number,
 *   content: WorkspaceReportContent
 * }} WorkspaceVersionInput
 */

/**
 * Rebuild the domain `ReportVersion` the workspace is currently showing, so the
 * canonical document model can be built from it.
 *
 * A finalized version is only valid with the provenance the domain recorded at
 * finalization — an original carries `finalized_by`/`finalized_at`, an amendment
 * carries `amended_by`/`amended_at` plus its amendment type and reason. Every one
 * of those must be carried through from the stored report; losing any of them
 * makes `assertValidReport` reject the version, which is what previously took the
 * report screen down after finalizing.
 *
 * @param {WorkspaceVersionInput} input
 * @param {string} [fallbackActor] actor used only when a stored report predates
 *   provenance propagation; matches AuthContext's default actor.
 * @returns {import('./contracts.mjs').ReportVersion}
 */
export function buildWorkspaceReportVersion(input, fallbackActor = 'workspace') {
  const reportId = String(input.reportId || '').split('::')[0] || 'unassigned';

  const supersedes =
    typeof input.supersedesVersion === 'number' ? { report_id: reportId, version: input.supersedesVersion } : null;

  /** @type {Record<string, unknown>} */
  const version = {
    report_id: reportId,
    version: input.version,
    lifecycle_state: input.isFinalized ? 'finalized' : 'draft',
    supersedes,
    source_catalog_version: WORKSPACE_CATALOG_VERSION,
    resolved_payload: buildResolvedPayload(input.content),
  };

  if (!input.isFinalized) {
    return /** @type {import('./contracts.mjs').ReportVersion} */ (version);
  }

  version.issue_number = input.issueNumber || `${reportId}-V${input.version}`;
  version.issue_date = String(input.issueDate || input.finalizedAt || '').slice(0, 10);

  if (supersedes) {
    version.amendment_type = input.amendmentType || 'correction';
    version.amendment_reason = input.amendmentReason || 'Amendment';
    version.amended_by = input.amendedBy || input.finalizedBy || fallbackActor;
    version.amended_at = input.amendedAt || input.finalizedAt || new Date().toISOString();
  } else {
    version.finalized_by = input.finalizedBy || fallbackActor;
    version.finalized_at = input.finalizedAt || new Date().toISOString();
  }

  return /** @type {import('./contracts.mjs').ReportVersion} */ (version);
}
