import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { parseCatalogFixture, parseReportFixture } from '../../src/domain/index.mjs';
import {
  ConcurrencyConflictError,
  createFixedClock,
  createInMemoryServiceAdapter,
  createReportService,
  createSequentialIdGenerator,
  MissingReferenceError,
  ReferenceValidationError,
} from '../../src/service/index.mjs';

/** @param {string} name */
const fixtureUrl = (name) => new URL(`../../docs/fixtures/${name}`, import.meta.url);
/** @param {string} name */
const loadReport = async (name) => parseReportFixture(await readFile(fixtureUrl(name), 'utf8'), name);
/** @param {string} name */
const loadCatalog = async (name) => parseCatalogFixture(await readFile(fixtureUrl(name), 'utf8'), name);

async function fixtures() {
  const [catalogV1, catalogV2, initial] = await Promise.all([
    loadCatalog('catalog-v1.json'),
    loadCatalog('catalog-v2.json'),
    loadReport('report-initial.json'),
  ]);
  return { catalogV1, catalogV2, initial };
}

/**
 * @param {Awaited<ReturnType<typeof fixtures>>} values
 * @param {{clock?: import('../../src/service/ports.mjs').Clock, idGenerator?: import('../../src/service/ports.mjs').IdGenerator}} [overrides]
 */
function harness(values, overrides = {}) {
  const adapter = createInMemoryServiceAdapter({ catalogs: [values.catalogV1, values.catalogV2] });
  const service = createReportService({
    ...adapter,
    clock: overrides.clock ?? createFixedClock('2026-07-02T14:10:00Z'),
    idGenerator: overrides.idGenerator ?? createSequentialIdGenerator('test'),
  });
  return { adapter, service };
}

/** @param {Awaited<ReturnType<typeof fixtures>>} values @param {string} reportId */
async function createInitialDraft(values, reportId = 'R100') {
  const setup = harness(values);
  const created = await setup.service.createDraft({
    reportId,
    sourceCatalogVersion: 'V1',
    resolvedPayload: structuredClone(values.initial.resolved_payload),
    actor: 'pathologist:kk',
  });
  return { ...setup, created };
}

test('create draft uses injected identity/time ports and stores detached frozen payload plus audit evidence', async () => {
  const values = await fixtures();
  const payload = structuredClone(values.initial.resolved_payload);
  const { service } = harness(values);

  const created = await service.createDraft({
    sourceCatalogVersion: 'V1',
    resolvedPayload: payload,
    actor: 'pathologist:kk',
  });
  payload['test.fasting_glucose'].value = 999;

  assert.equal(created.reportVersion.report_id, 'test-report-1');
  assert.equal(created.auditEvent.event_id, 'test-audit-event-2');
  assert.equal(created.auditEvent.event_type, 'report_draft_created');
  assert.equal(created.auditEvent.occurred_at, '2026-07-02T14:10:00Z');
  assert.equal(created.revision, 1);
  assert.equal(created.reportVersion.resolved_payload['test.fasting_glucose'].value, 92);
  assert.ok(Object.isFrozen(created));
  assert.ok(Object.isFrozen(created.reportVersion.resolved_payload['test.fasting_glucose']));

  const history = await service.retrieveHistory({ reportId: created.reportVersion.report_id });
  assert.equal(history.versions[0]?.resolved_payload['test.fasting_glucose'].value, 92);
  assert.equal(history.auditEvents.length, 1);
  assert.ok(Object.isFrozen(history));
  assert.ok(Object.isFrozen(history.auditEvents[0]));
});

test('new missing and deprecated catalog references fail visibly without partial persistence (INV-8/INV-9)', async () => {
  const values = await fixtures();
  const { adapter, service } = harness(values);
  const missingPayload = structuredClone(values.initial.resolved_payload);
  const missingEntry = missingPayload['test.fasting_glucose'];
  delete missingPayload['test.fasting_glucose'];
  missingPayload['test.deleted_glucose'] = {
    ...missingEntry,
    field_id: 'test.deleted_glucose',
  };

  await assert.rejects(
    service.createDraft({
      reportId: 'R-MISSING',
      sourceCatalogVersion: 'V1',
      resolvedPayload: missingPayload,
      actor: 'pathologist:kk',
    }),
    (error) => {
      assert.ok(error instanceof ReferenceValidationError);
      assert.equal(error.code, 'INVALID_REFERENCE');
      assert.equal(error.issues[0]?.code, 'field_missing');
      return true;
    },
  );
  assert.equal(await adapter.reportRepository.getRevision('R-MISSING'), null);
  assert.deepEqual(await adapter.auditRepository.listForReport('R-MISSING'), []);

  const deprecatedPayload = structuredClone(values.initial.resolved_payload);
  const interpretation = deprecatedPayload['interpretation.glucose'];
  interpretation.source_catalog_version = 'V2';
  interpretation.option_id = 'glu_prediabetes';
  interpretation.display = 'Pre-diabetes';
  await assert.rejects(
    service.createDraft({
      reportId: 'R-DEPRECATED',
      sourceCatalogVersion: 'V2',
      resolvedPayload: deprecatedPayload,
      actor: 'pathologist:kk',
    }),
    (error) => {
      assert.ok(error instanceof ReferenceValidationError);
      assert.equal(error.issues[0]?.code, 'option_deprecated');
      return true;
    },
  );
  assert.equal(await adapter.reportRepository.getRevision('R-DEPRECATED'), null);
});

test('validate and retrieval expose missing version/report references instead of empty success', async () => {
  const values = await fixtures();
  const { service } = harness(values);

  await assert.rejects(service.validate({ identity: { report_id: 'absent', version: 1 } }), MissingReferenceError);
  await assert.rejects(service.retrieveHistory({ reportId: 'absent' }), MissingReferenceError);

  const created = await service.createDraft({
    reportId: 'R-VALID',
    sourceCatalogVersion: 'V1',
    resolvedPayload: values.initial.resolved_payload,
    actor: 'pathologist:kk',
  });
  const validation = await service.validate({
    identity: { report_id: created.reportVersion.report_id, version: created.reportVersion.version },
  });
  assert.deepEqual(validation, { valid: true, domainIssues: [], referenceIssues: [] });
  assert.ok(Object.isFrozen(validation));
});

test('finalize is append-audited, immutable, and guarded by a per-report optimistic revision', async () => {
  const values = await fixtures();
  const { service, created } = await createInitialDraft(values, 'R-FINAL');

  const finalized = await service.finalize({
    identity: { report_id: 'R-FINAL', version: 1 },
    expectedRevision: created.revision,
    issueNumber: 'ISSUE-1',
    issueDate: '2026-07-02',
    actor: 'pathologist:kk',
  });

  assert.equal(finalized.reportVersion.lifecycle_state, 'finalized');
  assert.equal(finalized.revision, 2);
  assert.equal(finalized.auditEvents.length, 1);
  assert.equal(finalized.auditEvents[0]?.event_type, 'report_version_finalized');
  assert.ok(Object.isFrozen(finalized.reportVersion.resolved_payload));

  await assert.rejects(
    service.finalize({
      identity: { report_id: 'R-FINAL', version: 1 },
      expectedRevision: 1,
      issueNumber: 'ISSUE-DUPLICATE',
      issueDate: '2026-07-02',
      actor: 'pathologist:kk',
    }),
    (error) => {
      assert.ok(error instanceof ConcurrencyConflictError);
      assert.equal(error.expectedRevision, 1);
      assert.equal(error.actualRevision, 2);
      return true;
    },
  );

  const history = await service.retrieveHistory({ reportId: 'R-FINAL' });
  assert.equal(history.revision, 2);
  assert.equal(history.versions.length, 1);
  assert.equal(history.auditEvents.length, 2);
});

test('two concurrent finalizers using one revision produce one success and one explicit conflict', async () => {
  const values = await fixtures();
  const { service } = await createInitialDraft(values, 'R-RACE');
  const command = {
    identity: { report_id: 'R-RACE', version: 1 },
    expectedRevision: 1,
    issueNumber: 'ISSUE-RACE',
    issueDate: '2026-07-02',
    actor: 'pathologist:kk',
  };

  const outcomes = await Promise.allSettled([service.finalize(command), service.finalize(command)]);
  const successful = outcomes.filter((outcome) => outcome.status === 'fulfilled');
  const rejected = outcomes.filter((outcome) => outcome.status === 'rejected');
  assert.equal(successful.length, 1);
  assert.equal(rejected.length, 1);
  assert.ok(rejected[0]?.status === 'rejected' && rejected[0].reason instanceof ConcurrencyConflictError);

  const history = await service.retrieveHistory({ reportId: 'R-RACE' });
  assert.equal(history.revision, 2);
  assert.equal(history.auditEvents.filter((event) => event.event_type === 'report_version_finalized').length, 1);
});

test('amendment starts from the selected historical snapshot and finalization records bidirectional lineage (INV-4/INV-10)', async () => {
  const values = await fixtures();
  const { service } = await createInitialDraft(values, 'R-AMEND');
  await service.finalize({
    identity: { report_id: 'R-AMEND', version: 1 },
    expectedRevision: 1,
    issueNumber: 'ISSUE-1',
    issueDate: '2026-02-01',
    actor: 'pathologist:kk',
  });
  const correctedPayload = structuredClone(values.initial.resolved_payload);
  correctedPayload['test.fasting_glucose'].value = 129;
  correctedPayload['test.fasting_glucose'].flag = 'high';

  const amended = await service.amend({
    baseline: { report_id: 'R-AMEND', version: 1 },
    expectedRevision: 2,
    actor: 'pathologist:kk',
    amendmentReason: 'Corrected after analyser-log review.',
    amendmentType: 'correction',
    resolvedPayload: correctedPayload,
  });
  assert.deepEqual(amended.reportVersion.supersedes, { report_id: 'R-AMEND', version: 1 });
  assert.equal(amended.reportVersion.source_catalog_version, 'V1');
  assert.equal(amended.reportVersion.resolved_payload['test.hba1c'].display, 'HbA1c');

  const comparison = await service.compare({
    left: { report_id: 'R-AMEND', version: 1 },
    right: { report_id: 'R-AMEND', version: 2 },
  });
  assert.deepEqual(comparison.changedClinicalFields, ['test.fasting_glucose']);

  const finalizedAmendment = await service.finalize({
    identity: { report_id: 'R-AMEND', version: 2 },
    expectedRevision: 3,
    issueNumber: 'ISSUE-2',
    issueDate: '2026-07-02',
    actor: 'pathologist:kk',
  });
  assert.deepEqual(
    finalizedAmendment.auditEvents.map((event) => event.event_type),
    ['report_version_finalized', 'report_version_superseded'],
  );

  const history = await service.retrieveHistory({ reportId: 'R-AMEND' });
  assert.equal(history.revision, 4);
  assert.equal(history.versions.length, 2);
  assert.equal(history.lineage.byIdentity['R-AMEND@2']?.supersedes, 'R-AMEND@1');
  assert.deepEqual(history.lineage.byIdentity['R-AMEND@1']?.supersededBy, ['R-AMEND@2']);
  assert.deepEqual(
    history.auditEvents.map((event) => event.event_type),
    [
      'report_draft_created',
      'report_version_finalized',
      'amendment_draft_created',
      'report_version_finalized',
      'report_version_superseded',
    ],
  );
});

test('amend and compare fail visibly when a referenced version is absent and leave state unchanged', async () => {
  const values = await fixtures();
  const { service } = await createInitialDraft(values, 'R-REFERENCES');

  await assert.rejects(
    service.amend({
      baseline: { report_id: 'R-REFERENCES', version: 99 },
      expectedRevision: 1,
      actor: 'pathologist:kk',
      amendmentReason: 'Cannot amend an absent baseline.',
    }),
    (error) => error instanceof MissingReferenceError && error.reference === 'R-REFERENCES@99',
  );
  await assert.rejects(
    service.compare({
      left: { report_id: 'R-REFERENCES', version: 1 },
      right: { report_id: 'R-REFERENCES', version: 99 },
    }),
    MissingReferenceError,
  );

  const history = await service.retrieveHistory({ reportId: 'R-REFERENCES' });
  assert.equal(history.revision, 1);
  assert.equal(history.versions.length, 1);
  assert.equal(history.auditEvents.length, 1);
});

test('transaction rolls back version and audit writes when finalization cannot allocate an event id', async () => {
  const values = await fixtures();
  let calls = 0;
  const idGenerator = {
    nextId(namespace) {
      calls += 1;
      if (calls === 2) throw new Error('simulated id provider failure');
      return `controlled-${namespace}-${calls}`;
    },
  };
  const { service } = harness(values, { idGenerator });
  await service.createDraft({
    reportId: 'R-ROLLBACK',
    sourceCatalogVersion: 'V1',
    resolvedPayload: values.initial.resolved_payload,
    actor: 'pathologist:kk',
  });

  await assert.rejects(
    service.finalize({
      identity: { report_id: 'R-ROLLBACK', version: 1 },
      expectedRevision: 1,
      issueNumber: 'ISSUE-ROLLBACK',
      issueDate: '2026-07-02',
      actor: 'pathologist:kk',
    }),
    /simulated id provider failure/,
  );

  const history = await service.retrieveHistory({ reportId: 'R-ROLLBACK' });
  assert.equal(history.revision, 1);
  assert.equal(history.versions[0]?.lifecycle_state, 'draft');
  assert.deepEqual(
    history.auditEvents.map((event) => event.event_type),
    ['report_draft_created'],
  );
});
