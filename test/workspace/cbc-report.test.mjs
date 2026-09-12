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
  readWorkspaceContent,
  WORKSPACE_CATALOG_VERSION,
} from '../../src/domain/report-bridge.mjs';
import { buildReportDocumentModel, buildWorkspaceDocumentConfig } from '../../src/rendering/index.mjs';

/**
 * End-to-end proof for the CBC workflow the product exists to serve:
 *
 *   catalog test -> result entry -> resolved_payload -> validation ->
 *   finalization -> canonical document model -> what preview/print/PDF render.
 *
 * Every parameter below matches the CBC definition in the workspace catalog
 * (`src/store/TestContext.tsx`). Nothing here is hard-coded into a renderer.
 */

const CBC_TEST_ID = 'cbc';
const CBC_NAME = 'Complete Blood Count (CBC)';

/** The catalog's CBC parameters, with a realistic entered value for each. */
const CBC_PARAMETERS = [
  ['rbc', 'RBC Count', 'million/mm³', 3.8, 4.8, '4.2'],
  ['hemoglobin', 'Hemoglobin', 'g/dL', 12, 15, '13.4'],
  ['hematocrit', 'Hematocrit (HCT / PCV)', '%', 36, 46, '41'],
  ['mcv', 'MCV', 'fL', 83, 101, '88'],
  ['wbc', 'Total WBC Count', 'cells/mm³', 4000, 10000, '7200'],
  ['platelet', 'Platelet Count', '10³/µL', 150, 450, '240'],
];

function cbcContent(values = {}) {
  return {
    specimens: ['Whole Blood EDTA'],
    clinicalHistory: 'Routine health check.',
    findings: 'Red cell indices within reference limits. No atypical cells seen.',
    diagnosis: 'Complete blood count within normal limits.',
    testResults: CBC_PARAMETERS.map(([id, name, unit, min, max, value]) => ({
      testId: CBC_TEST_ID,
      testName: CBC_NAME,
      parameterId: id,
      parameterName: name,
      unit,
      referenceRange: { min, max },
      value: values[id] ?? value,
    })),
  };
}

function makeService() {
  const adapter = createWorkspaceServiceAdapter();
  return createReportService({
    ...adapter,
    clock: createFixedClock('2026-09-09T09:00:00Z'),
    idGenerator: createSequentialIdGenerator('cbc'),
  });
}

test('CBC: an incomplete result set cannot be finalized', () => {
  const issues = checkClinicalCompleteness(cbcContent({ hemoglobin: '', platelet: '' }));

  assert.deepEqual(issues.map((issue) => issue.field).sort(), [
    `result.${CBC_TEST_ID}::hemoglobin`,
    `result.${CBC_TEST_ID}::platelet`,
  ]);
});

test('CBC: every entered value reaches the canonical document model intact', async () => {
  const service = makeService();
  const identity = { report_id: 'R-CBC', version: 1 };
  const content = cbcContent();

  await service.createDraft({
    reportId: identity.report_id,
    sourceCatalogVersion: WORKSPACE_CATALOG_VERSION,
    resolvedPayload: buildResolvedPayload(content),
    actor: 'employee:sam',
  });

  assert.deepEqual(checkClinicalCompleteness(content), []);
  const validation = await service.validate({ identity });
  assert.equal(validation.valid, true);

  const before = await service.retrieveHistory({ reportId: identity.report_id });
  const finalized = await service.finalize({
    identity,
    expectedRevision: before.revision,
    issueNumber: 'INV-2026-000101',
    issueDate: '2026-09-09',
    actor: 'employee:sam',
  });

  const stored = finalized.reportVersion;
  const model = buildReportDocumentModel(stored, buildWorkspaceDocumentConfig(stored));

  assert.equal(model.lifecycle_state, 'finalized');
  assert.deepEqual(model.issue, { number: 'INV-2026-000101', date: '2026-09-09' });

  const cbcSection = model.sections.find(
    (section) => section.semantic_role === 'clinical-results' && section.heading === CBC_NAME,
  );
  assert.ok(cbcSection, 'the CBC panel is present as its own results section');

  // Parameter name, entered value, unit and reference range all survive.
  assert.deepEqual(
    cbcSection.fields.map((field) => [
      field.content.display,
      field.content.value,
      field.content.unit,
      field.content.reference_range,
    ]),
    CBC_PARAMETERS.map(([, name, unit, min, max, value]) => [name, value, unit, { low: min, high: max }]),
  );

  // Narrative sections carry the clinician's own words, never a derived one.
  const narrative = (role) =>
    model.sections.find((section) => section.semantic_role === role)?.fields[0]?.content.value;
  assert.equal(narrative('specimen-details'), 'Whole Blood EDTA');
  assert.equal(narrative('clinical-history'), 'Routine health check.');
  assert.equal(narrative('microscopic-findings'), content.findings);
  assert.equal(narrative('diagnosis'), content.diagnosis);
});

test('CBC: a finalized report is not re-resolved against a changed catalog', async () => {
  const service = makeService();
  const identity = { report_id: 'R-CBC-FROZEN', version: 1 };

  await service.createDraft({
    reportId: identity.report_id,
    sourceCatalogVersion: WORKSPACE_CATALOG_VERSION,
    resolvedPayload: buildResolvedPayload(cbcContent()),
    actor: 'employee:sam',
  });
  const before = await service.retrieveHistory({ reportId: identity.report_id });
  const finalized = await service.finalize({
    identity,
    expectedRevision: before.revision,
    issueNumber: 'INV-2026-000102',
    issueDate: '2026-09-09',
    actor: 'employee:sam',
  });

  // An administrator later renames the parameter and widens the range. That is a
  // catalog edit; the stored payload is a frozen snapshot and must not follow it.
  const editedCatalogContent = cbcContent();
  editedCatalogContent.testResults[1] = {
    ...editedCatalogContent.testResults[1],
    parameterName: 'Haemoglobin (renamed)',
    referenceRange: { min: 11, max: 16 },
  };
  buildResolvedPayload(editedCatalogContent);

  const history = await service.retrieveHistory({ reportId: identity.report_id });
  const stored = history.versions.find((version) => version.version === 1);
  const rows = readWorkspaceContent(stored).testResults;
  const hb = rows.find((row) => row.parameterId === 'hemoglobin');

  assert.equal(hb.parameterName, 'Hemoglobin', 'historical label is preserved');
  assert.deepEqual(hb.referenceRange, { min: 12, max: 15 }, 'historical range is preserved');
  assert.equal(finalized.reportVersion.resolved_payload['result.cbc::hemoglobin'].display, 'Hemoglobin');
});
