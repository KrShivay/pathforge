/**
 * @typedef {null | boolean | number | string | JsonValue[] | {[key: string]: JsonValue}} JsonValue
 */

/**
 * @typedef {{report_id: string, version: number}} ReportVersionIdentity
 */

/**
 * @typedef {{
 *   field_id: string,
 *   display: string,
 *   source_catalog_version: string,
 *   option_id?: string,
 *   value?: JsonValue,
 *   unit?: string,
 *   reference_range?: {low?: number, high?: number},
 *   flag?: string,
 *   interpretation?: string,
 *   changed_in_this_version?: boolean,
 *   [key: string]: JsonValue | undefined
 * }} ResolvedPayloadEntry
 */

/** @typedef {Record<string, ResolvedPayloadEntry>} ResolvedPayload */

/**
 * Canonical clinical content after provenance/annotation keys are removed.
 * @typedef {Record<string, Record<string, JsonValue>>} CanonicalClinicalPayload
 */

/**
 * @typedef {{
 *   catalog_version: string,
 *   published_at: string,
 *   supersedes?: string,
 *   fields: Record<string, {
 *     field_id: string,
 *     display?: string,
 *     unit?: string,
 *     reference_range?: {low?: number, high?: number},
 *     options?: Array<{option_id: string, label: string, deprecated?: boolean}>,
 *     [key: string]: unknown
 *   }>,
 *   [key: string]: unknown
 * }} Catalog
 */

/**
 * @typedef {{
 *   report_id: string,
 *   version: number,
 *   lifecycle_state: string,
 *   supersedes: ReportVersionIdentity | null,
 *   source_catalog_version: string,
 *   resolved_payload: ResolvedPayload,
 *   issue_number?: string,
 *   issue_date?: string,
 *   finalized_at?: string,
 *   finalized_by?: string,
 *   amended_at?: string,
 *   amended_by?: string,
 *   amendment_type?: string,
 *   amendment_reason?: string,
 *   [key: string]: unknown
 * }} ReportVersion
 */

/**
 * @typedef {{
 *   event_id: string,
 *   event_type: 'report_version_finalized' | 'amendment_draft_created' | 'report_version_superseded',
 *   report_version: ReportVersionIdentity,
 *   actor: string,
 *   occurred_at: string,
 *   details: Record<string, JsonValue>
 * }} AuditEvent
 */

/**
 * @typedef {{
 *   path: string,
 *   kind: 'added' | 'removed' | 'changed',
 *   before?: JsonValue,
 *   after?: JsonValue
 * }} ClinicalChange
 */

/**
 * @typedef {{
 *   result: 'EQUAL' | 'DIFFERENT',
 *   equal: boolean,
 *   clinicalDiff: boolean,
 *   changes: ClinicalChange[],
 *   changedClinicalFields: string[],
 *   unchangedClinicalFields: string[],
 *   explanation: string
 * }} ClinicalComparison
 */

/**
 * @typedef {{
 *   comparisons: Array<{
 *     id: string,
 *     left: string,
 *     right: string,
 *     expected_clinical_result: 'EQUAL' | 'DIFFERENT',
 *     clinical_diff: boolean,
 *     note: string,
 *     changed_clinical_fields?: string[],
 *     unchanged_clinical_fields?: string[],
 *     non_clinical_fields_that_differ_by_design?: string[]
 *   }>,
 *   [key: string]: unknown
 * }} ExpectedComparisonFixture
 */

/** Minimal internal states accepted by the fixture-driven Phase 2 slice (ADR-0002). */
export const REPORT_STATES = Object.freeze({
  DRAFT: 'draft',
  FINALIZED: 'finalized',
});
