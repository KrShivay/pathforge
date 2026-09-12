import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createFixedClock,
  createReportService,
  createSequentialIdGenerator,
  createWorkspaceServiceAdapter,
} from '../../src/service/index.mjs';
import {
  buildResolvedPayload,
  checkClinicalCompleteness,
  generateIssueNumber,
  groupForPreview,
  issueDateFromIso,
  readWorkspaceContent,
  WORKSPACE_CATALOG_VERSION,
} from '../../src/domain/report-bridge.mjs';

/**
 * End-to-end exercise of the report workspace the React app drives through
 * `src/store/ReportContext.tsx`. It composes the real modules the provider uses
 * (`createWorkspaceServiceAdapter` + `createReportService` + the report bridge)
 * and walks the full clinician workflow: draft -> enter results -> finalize
 * (with the completeness gate) -> preview -> amend -> persistence restart.
 *
 * The finalize gate below mirrors `ReportContext.finalizeReport`: it must reject
 * when either the workspace completeness check or the domain validator complains,
 * and only then call `service.finalize`.
 */

function makeService(initialState) {
  const adapter = createWorkspaceServiceAdapter(initialState ? { initialState } : {});
  const service = createReportService({
    ...adapter,
    clock: createFixedClock('2026-09-08T09:00:00Z'),
    idGenerator: createSequentialIdGenerator('workflow'),
  });
  return { adapter, service };
}

/** Mirrors ReportContext.finalizeReport's validation gate. */
async function finalizeWithGate(service, identity, revision, content) {
  const errors = checkClinicalCompleteness(content).map((issue) => ({
    field: issue.field,
    message: issue.message,
  }));
  const domain = await service.validate({ identity });
  for (const issue of domain.domainIssues) errors.push({ field: 'report', message: issue });
  for (const issue of domain.referenceIssues) {
    errors.push({ field: issue.path, message: issue.message });
  }
  if (errors.length > 0) return { valid: false, errors };

  const finalized = await service.finalize({
    identity,
    expectedRevision: revision,
    issueNumber: generateIssueNumber(new Date('2026-09-08T09:00:00Z'), () => 0.5),
    issueDate: issueDateFromIso('2026-09-08T09:00:00Z'),
    actor: 'employee:sam',
  });
  return { valid: true, errors: [], finalized };
}

/** @returns {import('../../src/domain/report-bridge.mjs').WorkspaceReportContent} */
function completeContent() {
  return {
    specimens: ['Whole Blood EDTA'],
    clinicalHistory: 'Routine screening.',
    findings: 'Normal red cell morphology, no atypical cells.',
    diagnosis: 'Within normal limits.',
    testResults: [
      {
        parameterId: 'hemoglobin',
        parameterName: 'Hemoglobin',
        unit: 'g/dL',
        value: '13.4',
        referenceRange: { min: 12, max: 15 },
      },
    ],
  };
}

test('a draft cannot be finalized while required clinical content is missing', async () => {
  const { service } = makeService();
  const identity = { report_id: 'R-GATE', version: 1 };

  await service.createDraft({
    reportId: identity.report_id,
    sourceCatalogVersion: WORKSPACE_CATALOG_VERSION,
    resolvedPayload: buildResolvedPayload({ testResults: [] }),
    actor: 'employee:sam',
  });

  // Findings + diagnosis still blank, one result field left empty.
  const incomplete = {
    specimens: ['Whole Blood EDTA'],
    clinicalHistory: '',
    findings: '',
    diagnosis: '',
    testResults: [{ parameterId: 'hb', parameterName: 'Hemoglobin', unit: 'g/dL', value: '' }],
  };
  const created = await service.retrieveHistory({ reportId: identity.report_id });
  await service.updateDraft({
    identity,
    expectedRevision: created.revision,
    resolvedPayload: buildResolvedPayload(incomplete),
    actor: 'employee:sam',
  });

  const result = await finalizeWithGate(service, identity, created.revision + 1, incomplete);
  assert.equal(result.valid, false);
  assert.deepEqual(result.errors.map((error) => error.field).sort(), ['diagnosis', 'findings', 'result.hb']);

  const history = await service.retrieveHistory({ reportId: identity.report_id });
  assert.equal(history.versions[0]?.lifecycle_state, 'draft', 'report stays a draft when the gate fails');
});

test('entered lab results survive finalization and appear in the preview/PDF grouping', async () => {
  const { service } = makeService();
  const identity = { report_id: 'R-RESULTS', version: 1 };
  const content = completeContent();

  await service.createDraft({
    reportId: identity.report_id,
    sourceCatalogVersion: WORKSPACE_CATALOG_VERSION,
    resolvedPayload: buildResolvedPayload(content),
    actor: 'employee:sam',
  });

  const before = await service.retrieveHistory({ reportId: identity.report_id });
  const result = await finalizeWithGate(service, identity, before.revision, content);
  assert.equal(result.valid, true);
  assert.equal(result.finalized.reportVersion.lifecycle_state, 'finalized');

  const preview = groupForPreview(result.finalized.reportVersion);
  assert.equal(preview.lifecycleState, 'finalized');
  assert.deepEqual(
    preview.narrative.map((row) => row.label),
    [
      'Specimens',
      'Referring Clinician',
      'Clinical History',
      'Microscopic Findings',
      'Diagnosis',
      'Interpretation / Remarks',
    ],
  );
  assert.equal(preview.narrative.find((row) => row.label === 'Diagnosis')?.value, 'Within normal limits.');
  assert.deepEqual(preview.results, [{ name: 'Hemoglobin', value: '13.4', unit: 'g/dL', reference: '12 – 15' }]);
});

test('finalized versions are immutable: updateDraft is rejected', async () => {
  const { service } = makeService();
  const identity = { report_id: 'R-IMMUT', version: 1 };
  const content = completeContent();

  await service.createDraft({
    reportId: identity.report_id,
    sourceCatalogVersion: WORKSPACE_CATALOG_VERSION,
    resolvedPayload: buildResolvedPayload(content),
    actor: 'employee:sam',
  });
  const before = await service.retrieveHistory({ reportId: identity.report_id });
  const result = await finalizeWithGate(service, identity, before.revision, content);
  assert.equal(result.valid, true);

  await assert.rejects(
    () =>
      service.updateDraft({
        identity,
        expectedRevision: result.finalized.revision,
        resolvedPayload: buildResolvedPayload({ ...content, diagnosis: 'Tampered.' }),
        actor: 'employee:sam',
      }),
    'a finalized version cannot be edited in place',
  );

  const history = await service.retrieveHistory({ reportId: identity.report_id });
  assert.equal(readWorkspaceContent(history.versions[0]).diagnosis, 'Within normal limits.');
});

test('amending an older finalized version never reuses a version number', async () => {
  const { service } = makeService();
  const reportId = 'R-AMEND';
  const content = completeContent();

  await service.createDraft({
    reportId,
    sourceCatalogVersion: WORKSPACE_CATALOG_VERSION,
    resolvedPayload: buildResolvedPayload(content),
    actor: 'employee:sam',
  });

  // v1 finalized
  let history = await service.retrieveHistory({ reportId });
  const v1 = await finalizeWithGate(service, { report_id: reportId, version: 1 }, history.revision, content);
  assert.equal(v1.valid, true);

  // amend from v1 -> v2 draft, then finalize v2
  history = await service.retrieveHistory({ reportId });
  const a2 = await service.amend({
    baseline: { report_id: reportId, version: 1 },
    expectedRevision: history.revision,
    actor: 'employee:sam',
    amendmentReason: 'Corrected hemoglobin units.',
    amendmentType: 'correction',
  });
  assert.equal(a2.reportVersion.version, 2);
  history = await service.retrieveHistory({ reportId });
  const v2 = await finalizeWithGate(
    service,
    { report_id: reportId, version: 2 },
    history.revision,
    readWorkspaceContent(a2.reportVersion),
  );
  assert.equal(v2.valid, true);

  // amend from the ORIGINAL v1 again -> must be v3, not a duplicate v2
  history = await service.retrieveHistory({ reportId });
  const a3 = await service.amend({
    baseline: { report_id: reportId, version: 1 },
    expectedRevision: history.revision,
    actor: 'employee:sam',
    amendmentReason: 'Second correction from the original.',
    amendmentType: 'correction',
  });
  assert.equal(a3.reportVersion.version, 3, 'new amendment gets max(version)+1, not baseline+1');

  history = await service.retrieveHistory({ reportId });
  assert.deepEqual(
    history.versions.map((version) => version.version),
    [1, 2, 3],
  );
});

test('the workspace survives a restart: a persisted snapshot restores versions and audit', async () => {
  const first = makeService();
  const reportId = 'R-RESTART';
  const content = completeContent();

  await first.service.createDraft({
    reportId,
    sourceCatalogVersion: WORKSPACE_CATALOG_VERSION,
    resolvedPayload: buildResolvedPayload(content),
    actor: 'employee:sam',
  });
  const before = await first.service.retrieveHistory({ reportId });
  await finalizeWithGate(first.service, { report_id: reportId, version: 1 }, before.revision, content);

  // Simulate a fresh process loading the saved adapter state (what db.ts does).
  const persisted = first.adapter.snapshot();
  const second = makeService(persisted);

  const history = await second.service.retrieveHistory({ reportId });
  assert.equal(history.versions.length, 1);
  assert.equal(history.versions[0]?.lifecycle_state, 'finalized');
  assert.equal(readWorkspaceContent(history.versions[0]).findings, content.findings);
  assert.deepEqual(
    history.auditEvents.map((event) => event.event_type),
    ['report_draft_created', 'report_version_finalized'],
  );
});

test('a report with several tests finalizes and keeps results grouped per test', async () => {
  const { service } = makeService();
  const identity = { report_id: 'R-MULTI', version: 1 };

  /** @type {import('../../src/domain/report-bridge.mjs').WorkspaceReportContent} */
  const content = {
    specimens: ['Serum'],
    clinicalHistory: 'Annual review.',
    findings: 'Biochemistry and haematology reviewed together.',
    diagnosis: 'No abnormality detected.',
    testResults: [
      { testId: 't-cbc', testName: 'CBC', parameterId: 'hb', parameterName: 'Haemoglobin', value: '13.9' },
      { testId: 't-cbc', testName: 'CBC', parameterId: 'wbc', parameterName: 'WBC', value: '6.2' },
      { testId: 't-lft', testName: 'LFT', parameterId: 'alt', parameterName: 'ALT', value: '19' },
    ],
  };

  await service.createDraft({
    reportId: identity.report_id,
    sourceCatalogVersion: WORKSPACE_CATALOG_VERSION,
    resolvedPayload: buildResolvedPayload(content),
    actor: 'employee:sam',
  });

  const before = await service.retrieveHistory({ reportId: identity.report_id });
  const result = await finalizeWithGate(service, identity, before.revision, content);
  assert.equal(result.valid, true);

  const preview = groupForPreview(result.finalized.reportVersion);
  assert.deepEqual(
    preview.resultGroups.map((group) => [group.testName, group.rows.map((row) => row.name)]),
    [
      ['CBC', ['Haemoglobin', 'WBC']],
      ['LFT', ['ALT']],
    ],
  );
});
