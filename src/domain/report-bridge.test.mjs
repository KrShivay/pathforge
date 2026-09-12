import assert from 'node:assert/strict';
import test from 'node:test';

import { createFixedClock, createReportService, createSequentialIdGenerator } from '../service/index.mjs';
import { createWorkspaceServiceAdapter } from '../service/workspace-adapter.mjs';
import {
  buildResolvedPayload,
  checkClinicalCompleteness,
  generateIssueNumber,
  groupForPreview,
  readWorkspaceContent,
  WORKSPACE_CATALOG_VERSION,
} from './report-bridge.mjs';
import { validateReport } from './index.mjs';

/** @returns {import('./report-bridge.mjs').WorkspaceReportContent} */
function sampleContent() {
  return {
    specimenType: 'Whole Blood EDTA',
    clinicalHistory: 'Routine screening.',
    findings: 'Unremarkable red cell morphology.',
    diagnosis: 'Within normal limits.',
    testResults: [
      {
        parameterId: 'hemoglobin',
        parameterName: 'Hemoglobin',
        unit: 'g/dL',
        value: '13.4',
        referenceRange: { min: 12, max: 15 },
      },
      {
        parameterId: 'protein',
        parameterName: 'Protein',
        value: 'Negative',
        referenceRange: { text: 'Negative' },
      },
    ],
  };
}

test('buildResolvedPayload produces a domain-valid payload with narrative + result fields', () => {
  const payload = buildResolvedPayload(sampleContent());

  assert.deepEqual(Object.keys(payload).sort(), [
    'narrative.clinical_history',
    'narrative.diagnosis',
    'narrative.findings',
    'narrative.specimen_type',
    'result.hemoglobin',
    'result.protein',
  ]);
  for (const [key, entry] of Object.entries(payload)) {
    assert.equal(entry.field_id, key);
    assert.equal(entry.source_catalog_version, WORKSPACE_CATALOG_VERSION);
  }
  assert.deepEqual(payload['result.hemoglobin']?.reference_range, { low: 12, high: 15 });
  assert.equal(payload['result.protein']?.reference_text, 'Negative');

  // A full report version built from this payload passes domain validation.
  const issues = validateReport({
    report_id: 'R1',
    version: 1,
    lifecycle_state: 'draft',
    supersedes: null,
    source_catalog_version: WORKSPACE_CATALOG_VERSION,
    resolved_payload: payload,
  });
  assert.deepEqual(issues, []);
});

test('readWorkspaceContent is the inverse of buildResolvedPayload', () => {
  const content = sampleContent();
  const round = readWorkspaceContent({ resolved_payload: buildResolvedPayload(content) });

  assert.equal(round.specimenType, content.specimenType);
  assert.equal(round.findings, content.findings);
  assert.equal(round.diagnosis, content.diagnosis);
  assert.equal(round.testResults.length, 2);
  assert.deepEqual(round.testResults[0]?.referenceRange, { min: 12, max: 15 });
  assert.deepEqual(round.testResults[1]?.referenceRange, { text: 'Negative' });
});

test('a report can carry results from more than one laboratory test', () => {
  /** @type {import('./report-bridge.mjs').WorkspaceReportContent} */
  const content = {
    specimenType: 'Serum',
    findings: 'See individual panels.',
    diagnosis: 'Normal biochemistry and haematology.',
    testResults: [
      { testId: 't-cbc', testName: 'CBC', parameterId: 'hb', parameterName: 'Haemoglobin', value: '13.4' },
      { testId: 't-lft', testName: 'LFT', parameterId: 'alt', parameterName: 'ALT', value: '22' },
      // Same parameter id in a different panel must not collide.
      { testId: 't-kft', testName: 'KFT', parameterId: 'alt', parameterName: 'Albumin', value: '4.1' },
    ],
  };

  const payload = buildResolvedPayload(content);
  assert.deepEqual(
    Object.keys(payload)
      .filter((key) => key.startsWith('result.'))
      .sort(),
    ['result.t-cbc::hb', 'result.t-kft::alt', 'result.t-lft::alt'],
  );

  const round = readWorkspaceContent({ resolved_payload: payload });
  assert.equal(round.testResults.length, 3);
  assert.deepEqual(
    round.testResults.map((result) => [result.testName, result.parameterId, result.value]),
    [
      ['CBC', 'hb', '13.4'],
      ['LFT', 'alt', '22'],
      ['KFT', 'alt', '4.1'],
    ],
  );

  const preview = groupForPreview({ resolved_payload: payload });
  assert.deepEqual(
    preview.resultGroups.map((group) => [group.testName, group.rows.length]),
    [
      ['CBC', 1],
      ['LFT', 1],
      ['KFT', 1],
    ],
  );
});

test('a blank draft still builds a structurally valid payload', () => {
  const issues = validateReport({
    report_id: 'R1',
    version: 1,
    lifecycle_state: 'draft',
    supersedes: null,
    source_catalog_version: WORKSPACE_CATALOG_VERSION,
    resolved_payload: buildResolvedPayload({ testResults: [] }),
  });
  assert.deepEqual(issues, []);
});

test('checkClinicalCompleteness flags missing required content and blank results', () => {
  const issues = checkClinicalCompleteness({
    specimenType: '',
    findings: 'x',
    diagnosis: '',
    testResults: [{ parameterId: 'hb', parameterName: 'Hemoglobin', value: '' }],
  });
  assert.deepEqual(issues.map((issue) => issue.field).sort(), ['diagnosis', 'result.hb', 'specimenType']);
});

test('checkClinicalCompleteness flags two results that collapse onto the same payload key', () => {
  // buildResolvedPayload keys results by test+parameter; two rows sharing that
  // key would silently overwrite each other with no validation error unless
  // this is caught up front.
  const duplicate = [
    { parameterId: 'glucose', parameterName: 'Glucose', testId: 'lft', testName: 'LFT', value: '90' },
    { parameterId: 'glucose', parameterName: 'Glucose', testId: 'lft', testName: 'LFT', value: '150' },
  ];
  const issues = checkClinicalCompleteness({
    specimenType: 'Serum',
    findings: 'x',
    diagnosis: 'x',
    testResults: duplicate,
  });
  assert.deepEqual(
    issues.map((issue) => issue.field),
    ['result.lft::glucose'],
  );
  assert.match(issues[0]?.message ?? '', /entered more than once/);

  const distinctTests = [
    { parameterId: 'glucose', parameterName: 'Glucose', testId: 'lft', testName: 'LFT', value: '90' },
    { parameterId: 'glucose', parameterName: 'Glucose', testId: 'rft', testName: 'RFT', value: '150' },
  ];
  assert.deepEqual(
    checkClinicalCompleteness({
      specimenType: 'Serum',
      findings: 'x',
      diagnosis: 'x',
      testResults: distinctTests,
    }),
    [],
  );
});

test('groupForPreview yields a stable narrative/results shape for drafts and finalized', () => {
  const preview = groupForPreview({
    resolved_payload: buildResolvedPayload(sampleContent()),
    version: 2,
    lifecycle_state: 'finalized',
    issue_number: 'INV-2026-000001',
    issue_date: '2026-02-01',
  });
  assert.equal(preview.version, 2);
  assert.equal(preview.lifecycleState, 'finalized');
  assert.equal(preview.issueNumber, 'INV-2026-000001');
  assert.deepEqual(
    preview.narrative.map((row) => row.label),
    ['Specimen Type', 'Clinical History', 'Microscopic Findings', 'Diagnosis'],
  );
  assert.deepEqual(preview.results[0], {
    name: 'Hemoglobin',
    value: '13.4',
    unit: 'g/dL',
    reference: '12 – 15',
  });
});

test('generateIssueNumber is deterministic given a fixed clock and rng', () => {
  const value = generateIssueNumber(new Date('2026-05-01T00:00:00Z'), () => 0.123456);
  assert.equal(value, 'INV-2026-123456');
});

test('bridge output round-trips through the report service create → update → finalize flow', async () => {
  const service = createReportService({
    ...createWorkspaceServiceAdapter(),
    clock: createFixedClock('2026-07-02T14:10:00Z'),
    idGenerator: createSequentialIdGenerator('bridge'),
  });

  const created = await service.createDraft({
    reportId: 'R-BRIDGE',
    sourceCatalogVersion: WORKSPACE_CATALOG_VERSION,
    resolvedPayload: buildResolvedPayload({ testResults: [] }),
    actor: 'employee:sam',
  });
  assert.equal(created.reportVersion.lifecycle_state, 'draft');

  const updated = await service.updateDraft({
    identity: { report_id: 'R-BRIDGE', version: 1 },
    expectedRevision: created.revision,
    resolvedPayload: buildResolvedPayload(sampleContent()),
    actor: 'employee:sam',
  });

  const validation = await service.validate({ identity: { report_id: 'R-BRIDGE', version: 1 } });
  assert.deepEqual(validation, { valid: true, domainIssues: [], referenceIssues: [] });

  const finalized = await service.finalize({
    identity: { report_id: 'R-BRIDGE', version: 1 },
    expectedRevision: updated.revision,
    issueNumber: 'INV-2026-000001',
    issueDate: '2026-07-02',
    actor: 'employee:sam',
  });
  assert.equal(finalized.reportVersion.lifecycle_state, 'finalized');
  assert.equal(readWorkspaceContent(finalized.reportVersion).findings, 'Unremarkable red cell morphology.');

  const history = await service.retrieveHistory({ reportId: 'R-BRIDGE' });
  assert.deepEqual(
    history.auditEvents.map((event) => event.event_type),
    ['report_draft_created', 'report_draft_updated', 'report_version_finalized'],
  );
});

test('a workspace adapter snapshot restores report versions and audit history after restart', async () => {
  const firstAdapter = createWorkspaceServiceAdapter();
  const firstService = createReportService({
    ...firstAdapter,
    clock: createFixedClock('2026-07-03T14:10:00Z'),
    idGenerator: createSequentialIdGenerator('restart'),
  });

  await firstService.createDraft({
    reportId: 'R-RESTART',
    sourceCatalogVersion: WORKSPACE_CATALOG_VERSION,
    resolvedPayload: buildResolvedPayload(sampleContent()),
    actor: 'employee:sam',
  });

  const secondAdapter = createWorkspaceServiceAdapter({
    initialState: firstAdapter.snapshot(),
  });
  const secondService = createReportService({
    ...secondAdapter,
    clock: createFixedClock('2026-07-03T14:11:00Z'),
    idGenerator: createSequentialIdGenerator('restart'),
  });

  const history = await secondService.retrieveHistory({ reportId: 'R-RESTART' });
  assert.equal(history.versions.length, 1);
  assert.equal(history.versions[0]?.report_id, 'R-RESTART');
  assert.equal(history.auditEvents[0]?.event_type, 'report_draft_created');
});
