import { assertValidReport } from '../domain/index.mjs';

/**
 * Minimal explicit mapping for the prototype. Every payload field is included
 * exactly once, in payload order, so the preview cannot silently drop data.
 * @param {unknown} reportInput
 * @returns {import('./contracts.mjs').DocumentModelConfig}
 */
export function buildPrototypeDocumentConfig(reportInput) {
  assertValidReport(reportInput, 'prototype report');
  const report = /** @type {import('../domain/contracts.mjs').ReportVersion} */ (reportInput);

  return {
    config_id: 'pathforge-prototype-house-format',
    config_version: '1',
    locale: 'en-IN',
    sections: [
      {
        section_id: 'results',
        semantic_role: 'clinical-results',
        heading: 'Results',
        fields: Object.keys(report.resolved_payload).map((field_id) => ({
          field_id,
          semantic_role: 'report-field',
        })),
      },
    ],
    unresolved_inputs: [],
  };
}
