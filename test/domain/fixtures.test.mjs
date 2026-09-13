import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  DomainValidationError,
  parseCatalogFixture,
  parseExpectedComparisonFixture,
  parseReportFixture,
  validateCatalog,
  validateReport,
} from '../../src/domain/index.mjs';

/** @param {string} name */
const fixtureUrl = (name) => new URL(`../../docs/fixtures/${name}`, import.meta.url);
/** @param {string} name */
const readFixture = (name) => readFile(fixtureUrl(name), 'utf8');

test('all Phase 2 JSON fixtures satisfy their typed domain contracts', async () => {
  const [catalogV1Text, catalogV2Text, initialText, amendedText, expectedText] = await Promise.all([
    readFixture('catalog-v1.json'),
    readFixture('catalog-v2.json'),
    readFixture('report-initial.json'),
    readFixture('report-amended.json'),
    readFixture('expected-comparison.json'),
  ]);

  const catalogV1 = parseCatalogFixture(catalogV1Text, 'catalog-v1.json');
  const catalogV2 = parseCatalogFixture(catalogV2Text, 'catalog-v2.json');
  const initial = parseReportFixture(initialText, 'report-initial.json');
  const amended = parseReportFixture(amendedText, 'report-amended.json');
  const expected = parseExpectedComparisonFixture(expectedText, 'expected-comparison.json');

  assert.equal(catalogV1.catalog_version, 'V1');
  assert.equal(catalogV2.supersedes, 'V1');
  assert.equal(initial.report_id, amended.report_id);
  assert.equal(expected.comparisons.length, 4);
});

test('catalog validation reports all relevant paths instead of failing silently', () => {
  const issues = validateCatalog({
    catalog_version: '',
    published_at: 'not-a-date',
    fields: {
      'test.glucose': {
        field_id: 'wrong-key',
        display: 'Glucose',
        reference_range: { low: 100, high: 70 },
        options: [
          { option_id: 'duplicate', label: 'One' },
          { option_id: 'duplicate', label: '' },
        ],
      },
    },
  });

  assert.match(issues.join('\n'), /catalog_version/);
  assert.match(issues.join('\n'), /published_at/);
  assert.match(issues.join('\n'), /field_id must match/);
  assert.match(issues.join('\n'), /low must not exceed/);
  assert.match(issues.join('\n'), /option_id must be unique/);
  assert.match(issues.join('\n'), /label must be a non-empty string/);
});

test('report validation rejects an incomplete historical snapshot and invalid lineage', () => {
  const issues = validateReport({
    report_id: 'R1',
    version: 1,
    lifecycle_state: 'finalized',
    supersedes: { report_id: 'R2', version: 2 },
    source_catalog_version: 'V1',
    issue_number: 'I1',
    issue_date: '2026-02-30',
    resolved_payload: {
      'test.glucose': {
        field_id: 'test.glucose',
        value: Number.NaN,
      },
    },
  });

  assert.match(issues.join('\n'), /display/);
  assert.match(issues.join('\n'), /source_catalog_version/);
  assert.match(issues.join('\n'), /value must be finite/);
  assert.match(issues.join('\n'), /supersedes\.report_id must match/);
  assert.match(issues.join('\n'), /supersedes\.version must precede/);
  assert.match(issues.join('\n'), /issue_date/);
});

test('fixture parsing wraps malformed JSON and schema errors with actionable paths', () => {
  assert.throws(
    () => parseCatalogFixture('{', 'broken.json'),
    (error) => {
      assert.ok(error instanceof DomainValidationError);
      assert.equal(error.subject, 'broken.json');
      assert.match(error.message, /valid JSON/);
      return true;
    },
  );

  assert.throws(
    () => parseReportFixture('{}', 'empty-report.json'),
    (error) => {
      assert.ok(error instanceof DomainValidationError);
      assert.match(error.message, /report_id/);
      assert.match(error.message, /resolved_payload/);
      return true;
    },
  );
});
