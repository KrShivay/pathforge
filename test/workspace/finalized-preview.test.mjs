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
  buildWorkspaceReportVersion,
  readWorkspaceContent,
  WORKSPACE_CATALOG_VERSION,
} from '../../src/domain/report-bridge.mjs';
import { buildReportDocumentModel, buildWorkspaceDocumentConfig } from '../../src/rendering/index.mjs';

/**
 * Regression cover for the white-screen crash after Finalize:
 *
 *   DomainValidationError: workspace report is invalid:
 *     - finalized_by must be a non-empty string
 *
 * The finalized version reached the canonical document model without the
 * provenance the domain recorded at finalization. These tests pin that the
 * provenance survives the trip from the service into the report screen.
 */

const ACTOR = 'employee:sam@example.test';

function content() {
  return {
    specimens: ['Whole Blood EDTA'],
    clinicalHistory: 'Routine health check.',
    findings: 'Red cell indices within reference limits.',
    diagnosis: 'Complete blood count within normal limits.',
    testResults: [
      {
        testId: 'cbc',
        testName: 'Complete Blood Count (CBC)',
        parameterId: 'hemoglobin',
        parameterName: 'Hemoglobin',
        unit: 'g/dL',
        referenceRange: { min: 12, max: 15 },
        value: '13.4',
      },
    ],
  };
}

function makeService() {
  const adapter = createWorkspaceServiceAdapter();
  return createReportService({
    ...adapter,
    clock: createFixedClock('2026-09-09T09:00:00Z'),
    idGenerator: createSequentialIdGenerator('final'),
  });
}

/** Mirrors ReportContext's stored-version to React-snapshot mapping. */
function toWorkspaceFields(reportId, version) {
  return {
    reportId,
    version: version.version,
    isFinalized: version.lifecycle_state === 'finalized',
    issueNumber: version.issue_number,
    issueDate: version.issue_date,
    finalizedAt: version.finalized_at ?? version.amended_at,
    finalizedBy: version.finalized_by,
    amendedAt: version.amended_at,
    amendedBy: version.amended_by,
    amendmentType: version.amendment_type,
    amendmentReason: version.amendment_reason,
    supersedesVersion: version.supersedes ? version.supersedes.version : undefined,
    content: readWorkspaceContent(version),
  };
}

async function finalizedReport(reportId = 'R-FINAL') {
  const service = makeService();
  await service.createDraft({
    reportId,
    sourceCatalogVersion: WORKSPACE_CATALOG_VERSION,
    resolvedPayload: buildResolvedPayload(content()),
    actor: ACTOR,
  });
  const before = await service.retrieveHistory({ reportId });
  const finalized = await service.finalize({
    identity: { report_id: reportId, version: 1 },
    expectedRevision: before.revision,
    issueNumber: 'INV-2026-000200',
    issueDate: '2026-09-09',
    actor: ACTOR,
  });
  return { service, finalized };
}

test('finalizing records a non-empty finalized_by from the supplied actor', async () => {
  const { finalized } = await finalizedReport();

  assert.equal(finalized.reportVersion.lifecycle_state, 'finalized');
  assert.equal(finalized.reportVersion.finalized_by, ACTOR);
  assert.ok(finalized.reportVersion.finalized_at, 'finalized_at is recorded');
});

test('the stored finalized version still carries finalized_by when read back', async () => {
  const { service } = await finalizedReport('R-READBACK');
  const history = await service.retrieveHistory({ reportId: 'R-READBACK' });
  const stored = history.versions.find((version) => version.version === 1);

  assert.equal(stored.finalized_by, ACTOR);
});

test('REGRESSION: a finalized report reaching the report screen renders without throwing', async () => {
  const { service } = await finalizedReport('R-SCREEN');
  const history = await service.retrieveHistory({ reportId: 'R-SCREEN' });
  const stored = history.versions.find((version) => version.version === 1);

  // Exactly what ReportEditor and buildReportModel do with the stored version.
  const fields = toWorkspaceFields('R-SCREEN', stored);
  assert.equal(fields.finalizedBy, ACTOR, 'provenance survives the React mapping');

  const rebuilt = buildWorkspaceReportVersion(fields);
  assert.equal(rebuilt.finalized_by, ACTOR);

  // This is the call that previously threw and blanked the screen.
  const model = buildReportDocumentModel(rebuilt, buildWorkspaceDocumentConfig(rebuilt));

  assert.equal(model.lifecycle_state, 'finalized');
  assert.deepEqual(model.issue, { number: 'INV-2026-000200', date: '2026-09-09' });
  assert.equal(model.provenance.finalized_by, ACTOR);

  const results = model.sections.find((section) => section.semantic_role === 'clinical-results');
  assert.equal(results.fields[0].content.display, 'Hemoglobin');
  assert.equal(results.fields[0].content.value, '13.4');
});

test('REGRESSION: dropping finalized_by on the way to the screen is rejected, not rendered', () => {
  // The bug shape: a finalized version arrives without its finalization actor.
  const withoutActor = {
    report_id: 'R-BUG',
    version: 1,
    lifecycle_state: 'finalized',
    supersedes: null,
    source_catalog_version: WORKSPACE_CATALOG_VERSION,
    resolved_payload: buildResolvedPayload(content()),
    issue_number: 'INV-2026-000201',
    issue_date: '2026-09-09',
    finalized_at: '2026-09-09T09:00:00Z',
  };

  assert.throws(
    () => buildWorkspaceDocumentConfig(withoutActor),
    (error) => {
      assert.match(error.message, /finalized_by must be a non-empty string/);
      return true;
    },
    'the invariant stays strict: this must fail loudly rather than render',
  );

  // The bridge is what stops it ever reaching the model in that shape.
  const repaired = buildWorkspaceReportVersion({
    reportId: 'R-BUG',
    version: 1,
    isFinalized: true,
    issueNumber: 'INV-2026-000201',
    issueDate: '2026-09-09',
    finalizedAt: '2026-09-09T09:00:00Z',
    finalizedBy: ACTOR,
    content: content(),
  });
  assert.equal(repaired.finalized_by, ACTOR);
  assert.doesNotThrow(() => buildWorkspaceDocumentConfig(repaired));
});

test('a draft still needs no finalization provenance and no issue identity', () => {
  const draft = buildWorkspaceReportVersion({
    reportId: 'R-DRAFT',
    version: 1,
    isFinalized: false,
    content: content(),
  });

  assert.equal(draft.lifecycle_state, 'draft');
  assert.equal(draft.finalized_by, undefined);
  assert.equal(draft.issue_number, undefined);

  const model = buildReportDocumentModel(draft, buildWorkspaceDocumentConfig(draft));
  assert.equal(model.issue, null);
});

test('a finalized amendment carries amended_by instead of finalized_by', async () => {
  const reportId = 'R-AMEND-PROV';
  const { service } = await finalizedReport(reportId);

  let history = await service.retrieveHistory({ reportId });
  await service.amend({
    baseline: { report_id: reportId, version: 1 },
    expectedRevision: history.revision,
    actor: ACTOR,
    amendmentReason: 'Corrected haemoglobin.',
    amendmentType: 'correction',
  });

  history = await service.retrieveHistory({ reportId });
  await service.finalize({
    identity: { report_id: reportId, version: 2 },
    expectedRevision: history.revision,
    issueNumber: 'INV-2026-000202',
    issueDate: '2026-09-10',
    actor: ACTOR,
  });

  history = await service.retrieveHistory({ reportId });
  const v2 = history.versions.find((version) => version.version === 2);

  assert.equal(v2.amended_by, ACTOR, 'an amendment records amended_by, not finalized_by');
  assert.equal(v2.finalized_by, undefined);

  // The same screen path must work for an amendment too.
  const rebuilt = buildWorkspaceReportVersion(toWorkspaceFields(reportId, v2));
  assert.equal(rebuilt.amended_by, ACTOR);
  const model = buildReportDocumentModel(rebuilt, buildWorkspaceDocumentConfig(rebuilt));
  assert.equal(model.provenance.amended_by, ACTOR);
  assert.equal(model.lineage.supersedes.version, 1);

  // v1 is untouched by the amendment.
  const v1 = history.versions.find((version) => version.version === 1);
  assert.equal(v1.issue_number, 'INV-2026-000200');
  assert.equal(readWorkspaceContent(v1).diagnosis, content().diagnosis);
});
