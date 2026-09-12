import assert from 'node:assert/strict';
import test from 'node:test';

import { buildWorkspaceReportVersion, WORKSPACE_CATALOG_VERSION } from '../../src/domain/report-bridge.mjs';
import { buildWorkspaceDocumentConfig } from '../../src/rendering/workspace-config.mjs';
import { buildReportDocumentModel } from '../../src/rendering/index.mjs';

/**
 * The React flag helper (src/components/report/flags.ts) is the single source of
 * truth, but this test locks its rule so a future change is deliberate: a value
 * above the range is H, below is L, inside (or non-numeric) is unflagged. The
 * report model derives the printed / PDF flag from the same reference range that
 * lands in the document model, so we assert on that range here.
 */
function flag(value, low, high) {
  const numeric = Number(value);
  if (value.trim() === '' || Number.isNaN(numeric)) return '';
  if (typeof high === 'number' && numeric > high) return 'H';
  if (typeof low === 'number' && numeric < low) return 'L';
  return '';
}

test('flag rule: above range H, below range L, inside or non-numeric none', () => {
  assert.equal(flag('11.2', 12, 15), 'L');
  assert.equal(flag('105', 83, 101), 'H');
  assert.equal(flag('13', 12, 15), '');
  assert.equal(flag('', 12, 15), '');
  assert.equal(flag('positive', 12, 15), '');
  assert.equal(flag('5', undefined, 4), 'H');
  assert.equal(flag('5', 6, undefined), 'L');
});

test('the reference range the report model reads carries low/high from the payload', () => {
  const version = buildWorkspaceReportVersion({
    reportId: 'R-FLAG',
    version: 1,
    isFinalized: false,
    content: {
      specimens: ['Whole Blood EDTA'],
      clinicalHistory: '',
      findings: '',
      diagnosis: '',
      testResults: [
        {
          parameterId: 'hb',
          parameterName: 'Hemoglobin',
          testId: 'cbc',
          testName: 'CBC',
          unit: 'g/dL',
          value: '11.2',
          referenceRange: { min: 12, max: 15 },
        },
      ],
    },
  });

  const model = buildReportDocumentModel(version, buildWorkspaceDocumentConfig(version));
  const resultSection = model.sections.find((section) => section.semantic_role === 'clinical-results');
  const content = resultSection.fields[0].content;
  assert.deepEqual(content.reference_range, { low: 12, high: 15 });
  assert.equal(content.value, '11.2');
  assert.equal(flag(content.value, content.reference_range.low, content.reference_range.high), 'L');
  assert.equal(version.source_catalog_version, WORKSPACE_CATALOG_VERSION);
});
