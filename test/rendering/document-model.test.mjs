import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { parseCatalogFixture, parseReportFixture } from '../../src/domain/index.mjs';
import { buildReportDocumentModel, DocumentModelValidationError } from '../../src/rendering/index.mjs';

/** @param {string} name */
const fixtureUrl = (name) => new URL(`../../docs/fixtures/${name}`, import.meta.url);
/** @param {string} name */
const loadReport = async (name) => parseReportFixture(await readFile(fixtureUrl(name), 'utf8'), name);
/** @param {string} name */
const loadCatalog = async (name) => parseCatalogFixture(await readFile(fixtureUrl(name), 'utf8'), name);

const renderConfig = {
  config_id: 'house-format-pending-evidence',
  config_version: '0',
  locale: 'en',
  sections: [
    {
      section_id: 'results',
      semantic_role: 'clinical-results',
      heading: 'Results',
      fields: [
        { field_id: 'test.fasting_glucose', semantic_role: 'measurement' },
        { field_id: 'test.hba1c', semantic_role: 'measurement' },
      ],
    },
    {
      section_id: 'interpretation',
      semantic_role: 'clinical-interpretation',
      fields: [{ field_id: 'interpretation.glucose', semantic_role: 'coded-interpretation' }],
    },
  ],
  unresolved_inputs: [
    {
      input_id: 'page-geometry',
      category: 'layout',
      status: 'UNKNOWN',
      reason: 'Sample PDF binaries are absent, so page geometry is not evidence-backed.',
      reference: 'docs/expected-analysis/pdf-evidence-gap.md',
    },
    {
      input_id: 'historical-renderer-retention',
      category: 'renderer-version',
      status: 'UNKNOWN',
      reason: 'Historical renderer retention policy is unresolved.',
      reference: 'Q7',
    },
  ],
};

test('document model is deterministic, immutable, and follows explicit section/field order', async () => {
  const report = await loadReport('report-initial.json');
  const reordered = structuredClone(report);
  reordered.resolved_payload = {
    'interpretation.glucose': {
      source_catalog_version: 'V1',
      display: 'Normal',
      option_id: 'glu_normal',
      field_id: 'interpretation.glucose',
    },
    'test.hba1c': reordered.resolved_payload['test.hba1c'],
    'test.fasting_glucose': reordered.resolved_payload['test.fasting_glucose'],
  };

  const first = buildReportDocumentModel(report, renderConfig);
  const second = buildReportDocumentModel(reordered, structuredClone(renderConfig));

  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.deepEqual(
    first.sections.map((section) => section.section_id),
    ['results', 'interpretation'],
  );
  assert.deepEqual(
    first.sections.flatMap((section) => section.fields.map((field) => field.field_id)),
    ['test.fasting_glucose', 'test.hba1c', 'interpretation.glucose'],
  );
  assert.deepEqual(first.report_version, { report_id: 'R100', version: 1 });
  assert.deepEqual(first.issue, { number: 'INV-2026-004512', date: '2026-02-01' });
  assert.equal(first.render_configuration.unresolved_inputs.length, 2);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.sections[0]?.fields[0]?.content));

  report.resolved_payload['test.fasting_glucose'].value = 999;
  assert.equal(first.sections[0]?.fields[0]?.content.value, 92);
});

test('INV-2/INV-5: current Catalog V2 cannot alter a Catalog V1 document model', async () => {
  const [report, catalogV2] = await Promise.all([loadReport('report-initial.json'), loadCatalog('catalog-v2.json')]);
  const afterCatalogPublish = structuredClone(report);
  afterCatalogPublish.current_catalog = catalogV2;

  const before = buildReportDocumentModel(report, renderConfig);
  const after = buildReportDocumentModel(afterCatalogPublish, renderConfig);
  const glucose = after.sections[0]?.fields[0];

  assert.deepEqual(after, before);
  assert.equal(glucose?.content.display, 'Fasting Blood Sugar');
  assert.deepEqual(glucose?.content.reference_range, { high: 100, low: 70 });
  assert.equal(glucose?.provenance.source_catalog_version, 'V1');
  assert.notEqual(glucose?.content.display, catalogV2.fields['test.fasting_glucose']?.display);
  assert.doesNotMatch(JSON.stringify(after), /Fasting Plasma Glucose|"low":74|"high":106/);
});

test('missing optional clinical values remain absent rather than being invented', async () => {
  const report = await loadReport('report-initial.json');
  const hba1c = report.resolved_payload['test.hba1c'];
  assert.ok(hba1c);
  delete hba1c.unit;
  delete hba1c.reference_range;
  delete hba1c.flag;

  const model = buildReportDocumentModel(report, renderConfig);
  const field = model.sections[0]?.fields[1];

  assert.deepEqual(field?.content, { display: 'HbA1c', value: 5.4 });
  assert.equal(Object.hasOwn(field?.content ?? {}, 'unit'), false);
  assert.equal(JSON.stringify(model).includes('undefined'), false);
});

test('amendment annotations do not become visible clinical section content', async () => {
  const report = await loadReport('report-amended.json');
  const model = buildReportDocumentModel(report, renderConfig);
  const sectionContent = JSON.stringify(model.sections);

  assert.deepEqual(model.report_version, { report_id: 'R100', version: 2 });
  assert.deepEqual(model.lineage.supersedes, { report_id: 'R100', version: 1 });
  assert.doesNotMatch(sectionContent, /changed_in_this_version|amendment_reason|amendment_type/);
  assert.equal(model.sections[0]?.fields[0]?.content.value, 129);
});

test('long content and multiple rows are retained without layout assumptions', async () => {
  const report = await loadReport('report-initial.json');
  const longText = 'Long clinical narrative. '.repeat(600);
  report.resolved_payload = Object.fromEntries(
    Array.from({ length: 24 }, (_, index) => {
      const fieldId = `narrative.row-${String(index).padStart(2, '0')}`;
      return [
        fieldId,
        {
          field_id: fieldId,
          display: index === 23 ? longText : `Narrative row ${index}`,
          value: index,
          source_catalog_version: 'V1',
        },
      ];
    }),
  );
  const expectedOrder = Object.keys(report.resolved_payload).reverse();
  const config = {
    ...renderConfig,
    sections: [
      {
        section_id: 'narrative',
        semantic_role: 'clinical-narrative',
        fields: expectedOrder.map((field_id) => ({ field_id, semantic_role: 'narrative-row' })),
      },
    ],
  };

  const model = buildReportDocumentModel(report, config);

  assert.deepEqual(
    model.sections[0]?.fields.map((field) => field.field_id),
    expectedOrder,
  );
  assert.equal(model.sections[0]?.fields[0]?.content.display, longText);
  assert.equal(model.sections[0]?.fields.length, 24);
  assert.equal(Object.hasOwn(model, 'pagination'), false);
});

test('invalid or incomplete semantic mappings fail visibly', async () => {
  const report = await loadReport('report-initial.json');
  const draft = structuredClone(report);
  draft.lifecycle_state = 'draft';
  delete draft.issue_number;
  delete draft.issue_date;
  delete draft.finalized_at;
  delete draft.finalized_by;

  assert.throws(() => buildReportDocumentModel(draft, renderConfig), DocumentModelValidationError);

  const incompleteConfig = structuredClone(renderConfig);
  incompleteConfig.sections[0].fields.pop();
  assert.throws(
    () => buildReportDocumentModel(report, incompleteConfig),
    (error) => {
      assert.ok(error instanceof DocumentModelValidationError);
      assert.match(error.message, /sections must include payload field test\.hba1c/);
      return true;
    },
  );
});
