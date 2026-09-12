import assert from 'node:assert/strict';
import test from 'node:test';

import { buildResolvedPayload } from '../../src/domain/report-bridge.mjs';
import { buildReportDocumentModel, buildWorkspaceDocumentConfig } from '../../src/rendering/index.mjs';

function workspaceReport(overrides = {}) {
  const content = {
    specimenType: 'Serum',
    clinicalHistory: 'Annual review.',
    findings: 'Unremarkable.',
    diagnosis: 'Within normal limits.',
    testResults: [
      {
        testId: 't-cbc',
        testName: 'CBC',
        parameterId: 'hb',
        parameterName: 'Haemoglobin',
        unit: 'g/dL',
        value: '13.4',
        referenceRange: { min: 12, max: 15 },
      },
      { testId: 't-cbc', testName: 'CBC', parameterId: 'wbc', parameterName: 'WBC', value: '6.2' },
      { testId: 't-lft', testName: 'LFT', parameterId: 'alt', parameterName: 'ALT', value: '22' },
    ],
  };

  return {
    report_id: 'R-WS',
    version: 1,
    lifecycle_state: 'draft',
    supersedes: null,
    source_catalog_version: 'workspace',
    resolved_payload: buildResolvedPayload(content),
    ...overrides,
  };
}

test('the workspace config maps every payload field exactly once, in house-format order', () => {
  const report = workspaceReport();
  const config = buildWorkspaceDocumentConfig(report);

  assert.deepEqual(
    config.sections.map((section) => section.semantic_role),
    [
      'specimen-details',
      'clinical-results',
      'clinical-results',
      'clinical-history',
      'microscopic-findings',
      'diagnosis',
    ],
  );

  const mapped = config.sections.flatMap((section) => section.fields.map((field) => field.field_id));
  assert.equal(new Set(mapped).size, mapped.length, 'no field is mapped twice');
  assert.deepEqual(mapped.slice().sort(), Object.keys(report.resolved_payload).sort());
});

test('results are grouped into one section per originating test, headed by its name', () => {
  const report = workspaceReport();
  const model = buildReportDocumentModel(report, buildWorkspaceDocumentConfig(report));

  const groups = model.sections.filter((section) => section.semantic_role === 'clinical-results');
  assert.deepEqual(
    groups.map((section) => [section.heading, section.fields.length]),
    [
      ['CBC', 2],
      ['LFT', 1],
    ],
  );
});

test('two tests without a test_id but with different test_names stay in separate sections', () => {
  // groupResultsByTest (src/components/report/groupResults.ts), which drives
  // the live editor table, falls back to test_name when test_id is absent.
  // The document-model config must group results the same way, or the
  // printed report/PDF can silently merge and mislabel what the editor shows
  // as two distinct tests.
  const report = workspaceReport({
    resolved_payload: buildResolvedPayload({
      specimenType: 'Serum',
      clinicalHistory: '',
      findings: '',
      diagnosis: '',
      testResults: [
        { testName: 'Urinalysis', parameterId: 'color', parameterName: 'Color', value: 'Yellow' },
        { testName: 'Stool Exam', parameterId: 'consistency', parameterName: 'Consistency', value: 'Formed' },
      ],
    }),
  });

  const model = buildReportDocumentModel(report, buildWorkspaceDocumentConfig(report));
  const groups = model.sections.filter((section) => section.semantic_role === 'clinical-results');

  assert.deepEqual(
    groups.map((section) => [section.heading, section.fields.length]),
    [
      ['Urinalysis', 1],
      ['Stool Exam', 1],
    ],
  );
});

test('a draft is modeled with no issue identity; finalizing supplies it', () => {
  const draft = workspaceReport();
  const draftModel = buildReportDocumentModel(draft, buildWorkspaceDocumentConfig(draft));
  assert.equal(draftModel.lifecycle_state, 'draft');
  assert.equal(draftModel.issue, null);

  const finalized = workspaceReport({
    lifecycle_state: 'finalized',
    issue_number: 'INV-2026-000042',
    issue_date: '2026-09-09',
    finalized_at: '2026-09-09T10:00:00Z',
    finalized_by: 'employee:sam',
  });
  const finalModel = buildReportDocumentModel(finalized, buildWorkspaceDocumentConfig(finalized));
  assert.equal(finalModel.lifecycle_state, 'finalized');
  assert.deepEqual(finalModel.issue, { number: 'INV-2026-000042', date: '2026-09-09' });
});

test('INV-2: a document model keeps the catalog version its payload was resolved under', () => {
  const report = workspaceReport();
  const model = buildReportDocumentModel(report, buildWorkspaceDocumentConfig(report));

  assert.equal(model.provenance.source_catalog_version, 'workspace');
  for (const section of model.sections) {
    for (const field of section.fields) {
      assert.equal(field.provenance.source_catalog_version, 'workspace');
    }
  }
});
