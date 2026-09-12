import { assertValidReport } from '../domain/index.mjs';
import { NARRATIVE_FIELDS, RESULT_FIELD_PREFIX } from '../domain/report-bridge.mjs';

/**
 * Semantic mapping for the workspace house format.
 *
 * It names *what each section means*, never how it looks: no fonts, no
 * coordinates, no page rules. Every payload field is included exactly once, in
 * report order, so `buildReportDocumentModel` can prove the renderer cannot
 * silently drop or invent a clinical row.
 *
 * Section order is the approved house-format order: specimen, laboratory
 * results (one section per test), clinical history, findings, diagnosis.
 *
 * @param {unknown} reportInput a domain ReportVersion
 * @returns {import('./contracts.mjs').DocumentModelConfig}
 */
export function buildWorkspaceDocumentConfig(reportInput) {
  assertValidReport(reportInput, 'workspace report');
  const report = /** @type {import('../domain/contracts.mjs').ReportVersion} */ (reportInput);
  const payload = report.resolved_payload;

  /** @type {import('./contracts.mjs').DocumentSectionConfig[]} */
  const sections = [];

  /** @param {string} fieldId @param {string} role */
  const field = (fieldId, role) => ({ field_id: fieldId, semantic_role: role });

  /**
   * @param {string} fieldId @param {string} sectionId @param {string} role @param {string} heading
   * @returns {import('./contracts.mjs').DocumentSectionConfig | null}
   */
  const narrativeSection = (fieldId, sectionId, role, heading) =>
    payload[fieldId] === undefined
      ? null
      : { section_id: sectionId, semantic_role: role, heading, fields: [field(fieldId, role)] };

  const specimen = narrativeSection('narrative.specimen_type', 'specimen', 'specimen-details', 'Specimen Details');
  if (specimen) sections.push(specimen);

  // Laboratory results, grouped per originating test in payload order.
  /** @type {Map<string, import('./contracts.mjs').DocumentSectionConfig>} */
  const byTest = new Map();
  for (const [fieldId, entry] of Object.entries(payload)) {
    if (!fieldId.startsWith(RESULT_FIELD_PREFIX)) continue;
    const testId = typeof entry.test_id === 'string' && entry.test_id ? entry.test_id : '';
    const testName = typeof entry.test_name === 'string' && entry.test_name ? entry.test_name : '';
    // Must match groupResultsByTest's (src/components/report/groupResults.ts)
    // fallback exactly: two tests without a test_id but with different
    // test_names are distinct groups in the live editor table, and grouping
    // them here by test_id alone would silently merge and mislabel them in
    // the printed report/PDF.
    const groupKey = testId || testName || 'unassigned';
    let section = byTest.get(groupKey);
    if (!section) {
      section = {
        section_id: `results.${groupKey}`,
        semantic_role: 'clinical-results',
        ...(typeof entry.test_name === 'string' && entry.test_name ? { heading: entry.test_name } : {}),
        fields: [],
      };
      byTest.set(groupKey, section);
      sections.push(section);
    }
    section.fields.push(field(fieldId, 'result-value'));
  }

  for (const [fieldId, , key] of NARRATIVE_FIELDS) {
    if (key === 'specimens') continue;
    const roleByKey = {
      referringClinician: ['referring-clinician', 'referring-clinician', 'Referring Clinician'],
      clinicalHistory: ['clinical-history', 'clinical-history', 'Clinical History'],
      findings: ['findings', 'microscopic-findings', 'Microscopic Findings'],
      diagnosis: ['diagnosis', 'diagnosis', 'Diagnosis'],
      interpretation: ['interpretation', 'interpretation', 'Interpretation / Remarks'],
    };
    const entry2 = roleByKey[key];
    if (!entry2) continue;
    const [sectionId = '', role = '', heading = ''] = entry2;
    const section = narrativeSection(fieldId, sectionId, role, heading);
    if (section) sections.push(section);
  }

  return {
    config_id: 'pathforge-workspace-house-format',
    config_version: '1',
    locale: 'en-IN',
    sections,
    unresolved_inputs: [],
  };
}
