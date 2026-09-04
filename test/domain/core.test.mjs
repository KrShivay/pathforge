import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildVersionLineage,
  canonicalizeReport,
  compareClinicalPayloads,
  compareClinicalReports,
  createAmendmentDraft,
  createSupersessionAuditEvent,
  DomainValidationError,
  finalizeDraft,
  parseCatalogFixture,
  parseReportFixture,
  replaceDraftPayload,
  reportVersionKey,
  semanticFingerprint,
} from '../../src/domain/index.mjs';

/** @param {string} name */
const fixtureUrl = (name) => new URL(`../../docs/fixtures/${name}`, import.meta.url);
/** @param {string} name */
const loadReport = async (name) => parseReportFixture(await readFile(fixtureUrl(name), 'utf8'), name);
/** @param {string} name */
const loadCatalog = async (name) => parseCatalogFixture(await readFile(fixtureUrl(name), 'utf8'), name);

test('CMP-1: comparison explains exactly the fixture-backed clinical correction', async () => {
  const [initial, amended] = await Promise.all([loadReport('report-initial.json'), loadReport('report-amended.json')]);
  const comparison = compareClinicalReports(initial, amended);

  assert.equal(comparison.result, 'DIFFERENT');
  assert.equal(comparison.clinicalDiff, true);
  assert.deepEqual(
    comparison.changes.map(({ path, before, after }) => ({ path, before, after })),
    [
      { path: 'test.fasting_glucose.flag', before: 'normal', after: 'high' },
      { path: 'test.fasting_glucose.value', before: 92, after: 129 },
    ],
  );
  assert.deepEqual(comparison.changedClinicalFields, ['test.fasting_glucose']);
  assert.deepEqual(comparison.unchangedClinicalFields, ['interpretation.glucose', 'test.hba1c']);
  assert.match(comparison.explanation, /test\.fasting_glucose\.value/);
  assert.deepEqual(compareClinicalPayloads(initial.resolved_payload, amended.resolved_payload), comparison);
});

test('CMP-2/CMP-3: catalog, issue, audit, renderer, and annotation metadata are not clinical changes', async () => {
  const initial = await loadReport('report-initial.json');
  const viewedAfterCatalogV2 = structuredClone(initial);
  viewedAfterCatalogV2.issue_number = 'ANOTHER-ISSUE';
  viewedAfterCatalogV2.issue_date = '2026-08-01';
  viewedAfterCatalogV2.version = 99;
  viewedAfterCatalogV2.renderer = { version: 'r2', font: 'Different Font', pagination: 'different' };
  const viewedGlucose = viewedAfterCatalogV2.resolved_payload['test.fasting_glucose'];
  assert.ok(viewedGlucose);
  viewedGlucose.changed_in_this_version = true;

  const comparison = compareClinicalReports(initial, viewedAfterCatalogV2);
  assert.equal(comparison.result, 'EQUAL');
  assert.deepEqual(comparison.changes, []);
  assert.equal(semanticFingerprint(initial), semanticFingerprint(viewedAfterCatalogV2));
  assert.deepEqual(canonicalizeReport(initial), canonicalizeReport(viewedAfterCatalogV2));
});

test('INV-2/INV-5: Catalog V2 cannot rewrite a finalized V1 resolved snapshot', async () => {
  const [catalogV2, initial] = await Promise.all([loadCatalog('catalog-v2.json'), loadReport('report-initial.json')]);
  const before = structuredClone(initial.resolved_payload);

  assert.equal(catalogV2.fields['test.fasting_glucose']?.display, 'Fasting Plasma Glucose');
  assert.equal(initial.resolved_payload['test.fasting_glucose']?.display, 'Fasting Blood Sugar');
  assert.deepEqual(initial.resolved_payload, before);
});

test('INV-8: later deprecation leaves a historical option readable from its snapshot', async () => {
  const [catalogV2, initial] = await Promise.all([loadCatalog('catalog-v2.json'), loadReport('report-initial.json')]);
  const historical = structuredClone(initial);
  const interpretation = historical.resolved_payload['interpretation.glucose'];
  assert.ok(interpretation);
  interpretation.option_id = 'glu_prediabetes';
  interpretation.display = 'Pre-diabetes';
  const afterDeprecation = structuredClone(historical);
  afterDeprecation.renderer = { current_catalog_version: catalogV2.catalog_version };

  assert.equal(catalogV2.fields['interpretation.glucose']?.options?.[1]?.deprecated, true);
  assert.equal(compareClinicalReports(historical, afterDeprecation).result, 'EQUAL');
  assert.equal(canonicalizeReport(afterDeprecation)['interpretation.glucose']?.display, 'Pre-diabetes');
});

test('INV-1/INV-3/INV-9: finalization is immutable, stable, auditable, and one-way', async () => {
  const initial = await loadReport('report-initial.json');
  const draft = structuredClone(initial);
  draft.lifecycle_state = 'draft';
  draft.supersedes = null;
  delete draft.issue_number;
  delete draft.issue_date;
  delete draft.finalized_at;
  delete draft.finalized_by;

  const result = finalizeDraft(draft, {
    issueNumber: 'INV-2026-004512',
    issueDate: '2026-02-01',
    actor: 'pathologist:kk',
    occurredAt: '2026-02-01T09:30:00Z',
  });

  assert.equal(reportVersionKey(result.reportVersion), 'R100@1');
  assert.equal(result.auditEvent.event_type, 'report_version_finalized');
  assert.deepEqual(result.auditEvent.report_version, { report_id: 'R100', version: 1 });
  assert.ok(Object.isFrozen(result.reportVersion));
  assert.ok(Object.isFrozen(result.reportVersion.resolved_payload['test.fasting_glucose']));
  assert.throws(
    () =>
      finalizeDraft(result.reportVersion, {
        issueNumber: 'duplicate',
        issueDate: '2026-02-02',
        actor: 'pathologist:kk',
        occurredAt: '2026-02-02T00:00:00Z',
      }),
    DomainValidationError,
  );
  assert.throws(
    () => replaceDraftPayload(result.reportVersion, result.reportVersion.resolved_payload),
    DomainValidationError,
  );
});

test('INV-4/INV-10: amendment clones the selected frozen baseline and lineage is bidirectional', async () => {
  const [initial, fixtureAmended] = await Promise.all([
    loadReport('report-initial.json'),
    loadReport('report-amended.json'),
  ]);
  const baselineBefore = structuredClone(initial.resolved_payload);
  const created = createAmendmentDraft(initial, {
    version: 2,
    actor: 'pathologist:kk',
    occurredAt: '2026-07-02T13:50:00Z',
    amendmentReason: 'Fasting glucose value corrected after re-check of the analyser log.',
    amendmentType: 'correction',
  });

  assert.deepEqual(created.reportVersion.resolved_payload, initial.resolved_payload);
  assert.notEqual(created.reportVersion.resolved_payload, initial.resolved_payload);
  assert.deepEqual(initial.resolved_payload, baselineBefore);
  assert.deepEqual(created.reportVersion.supersedes, { report_id: 'R100', version: 1 });
  assert.equal(created.auditEvent.event_type, 'amendment_draft_created');

  const correctedPayload = structuredClone(created.reportVersion.resolved_payload);
  const glucose = correctedPayload['test.fasting_glucose'];
  assert.ok(glucose);
  glucose.value = 129;
  glucose.flag = 'high';
  const correctedDraft = replaceDraftPayload(created.reportVersion, correctedPayload);
  const finalized = finalizeDraft(correctedDraft, {
    issueNumber: 'INV-2026-006801',
    issueDate: '2026-07-02',
    actor: 'pathologist:kk',
    occurredAt: '2026-07-02T14:10:00Z',
  });

  assert.deepEqual(canonicalizeReport(finalized.reportVersion), canonicalizeReport(fixtureAmended));
  const lineage = buildVersionLineage([initial, finalized.reportVersion]);
  assert.equal(lineage.byIdentity['R100@2']?.supersedes, 'R100@1');
  assert.deepEqual(lineage.byIdentity['R100@1']?.supersededBy, ['R100@2']);

  const supersession = createSupersessionAuditEvent(initial, finalized.reportVersion, {
    actor: 'pathologist:kk',
    occurredAt: '2026-07-02T14:10:00Z',
    reason: String(correctedDraft.amendment_reason),
  });
  assert.equal(supersession.event_type, 'report_version_superseded');
  assert.equal(supersession.details.superseded_by_version, 2);
  assert.ok(Object.isFrozen(supersession));
});

test('lineage fails visibly for a missing historical predecessor', async () => {
  const amended = await loadReport('report-amended.json');
  assert.throws(() => buildVersionLineage([amended]), /references missing predecessor/);
});
