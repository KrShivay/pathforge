import assert from 'node:assert/strict';
import test from 'node:test';

import {
  A4_MM,
  DEFAULT_PRINT_LAYOUT,
  MAX_HORIZONTAL_MARGINS_MM,
  MIN_PRINTED_FONT_PT,
  MARGIN_LIMITS_MM,
  REPORT_TYPE_SCALE_PT,
  mmToPx,
  normalizePrintLayout,
  ptToPx,
  pxToMm,
  validatePrintLayout,
} from '../../src/components/report/printLayout.ts';
import { buildReportModel } from '../../src/components/report/reportModel.ts';
import { DEFAULT_LABORATORY_PROFILE } from '../../src/store/branding.ts';

test('print layout publishes A4 defaults, limits, and exact unit conversions', () => {
  assert.deepEqual(DEFAULT_PRINT_LAYOUT, {
    showLetterhead: true,
    marginsMm: { top: 16, right: 16, bottom: 16, left: 16 },
  });
  assert.deepEqual(A4_MM, { width: 210, height: 297 });
  assert.deepEqual(MARGIN_LIMITS_MM, {
    top: { min: 0, max: 60 },
    right: { min: 0, max: 60 },
    bottom: { min: 10, max: 60 },
    left: { min: 0, max: 60 },
  });
  assert.equal(MAX_HORIZONTAL_MARGINS_MM, 80);
  assert.equal(pxToMm(120), 31.75);
  assert.ok(Math.abs(mmToPx(pxToMm(120)) - 120) < 1e-12);
});

test('print layout validation rejects malformed values and accepts valid margins', () => {
  const invalid = validatePrintLayout({
    showLetterhead: 'yes',
    marginsMm: { top: -1, right: '12', bottom: 9, left: Number.POSITIVE_INFINITY },
  });
  assert.equal(invalid.length, 5);
  assert.match(invalid.join(' '), /Show letterhead must be a boolean/);
  assert.match(invalid.join(' '), /top margin must be from 0 to 60 mm/);
  assert.match(invalid.join(' '), /right margin must be a finite number from 0 to 60 mm/);
  assert.match(invalid.join(' '), /bottom margin must be from 10 to 60 mm/);
  assert.match(invalid.join(' '), /left margin must be a finite number from 0 to 60 mm/);
  assert.ok(
    validatePrintLayout({
      showLetterhead: true,
      marginsMm: { top: Number.NaN, right: 61, bottom: 10, left: 41 },
    }).some((error) => /top margin/.test(error)),
  );
  assert.ok(
    validatePrintLayout({
      showLetterhead: true,
      marginsMm: { top: 10, right: 10, bottom: 10 },
    }).some((error) => /left margin must be a finite number/.test(error)),
  );
  assert.ok(
    validatePrintLayout({
      showLetterhead: true,
      marginsMm: { top: 10, right: 41, bottom: 10, left: 40 },
    }).some((error) => /left and right margins together/.test(error)),
  );
  assert.deepEqual(validatePrintLayout(DEFAULT_PRINT_LAYOUT), []);
});

test('print layout normalization defaults, clamps, rounds, and constrains horizontal margins', () => {
  assert.deepEqual(normalizePrintLayout(undefined), DEFAULT_PRINT_LAYOUT);
  assert.deepEqual(normalizePrintLayout('invalid'), DEFAULT_PRINT_LAYOUT);

  const normalized = normalizePrintLayout({
    showLetterhead: false,
    marginsMm: { top: 3.26, right: 60, bottom: 8, left: 60 },
  });
  assert.equal(normalized.showLetterhead, false);
  assert.deepEqual(normalized.marginsMm, { top: 3.5, right: 40, bottom: 10, left: 40 });
  assert.ok(normalized.marginsMm.left + normalized.marginsMm.right <= MAX_HORIZONTAL_MARGINS_MM);

  const odd = normalizePrintLayout({ marginsMm: { top: 16.24, right: 16.26, bottom: Infinity, left: 'bad' } });
  assert.deepEqual(odd.marginsMm, { top: 16, right: 16.5, bottom: 16, left: 16 });
  assert.notEqual(normalizePrintLayout(DEFAULT_PRINT_LAYOUT), DEFAULT_PRINT_LAYOUT);
  const copy = normalizePrintLayout(DEFAULT_PRINT_LAYOUT);
  copy.marginsMm.top = 20;
  assert.equal(DEFAULT_PRINT_LAYOUT.marginsMm.top, 16);
});

function reportInput(laboratoryProfile) {
  return {
    patientName: 'Jane Doe',
    patientCode: 'P-100',
    version: 1,
    isFinalized: false,
    reportId: 'R-100',
    laboratoryProfile,
    content: {
      specimens: ['Whole Blood'],
      referringClinician: 'Dr Example',
      clinicalHistory: 'Routine check',
      findings: 'No significant finding',
      diagnosis: 'Within normal limits',
      interpretation: 'No further action',
      testResults: [
        {
          testId: 'cbc',
          testName: 'CBC',
          parameterId: 'hb',
          parameterName: 'Haemoglobin',
          value: '13',
          unit: 'g/dL',
          referenceRange: { min: 12, max: 16 },
        },
      ],
    },
  };
}

test('report model carries presentation layout without changing clinical fields', () => {
  const shown = buildReportModel(reportInput({ ...DEFAULT_LABORATORY_PROFILE, printLayout: DEFAULT_PRINT_LAYOUT }));
  const hidden = buildReportModel(
    reportInput({
      ...DEFAULT_LABORATORY_PROFILE,
      printLayout: { showLetterhead: false, marginsMm: { top: 20, right: 18, bottom: 14, left: 19 } },
    }),
  );

  assert.deepEqual(shown.layout, DEFAULT_PRINT_LAYOUT);
  assert.equal(hidden.layout.showLetterhead, false);
  assert.deepEqual(hidden.layout.marginsMm, { top: 20, right: 18, bottom: 14, left: 19 });
  for (const field of ['band', 'resultGroups', 'narratives', 'signoff', 'reportNo', 'qrPayload']) {
    assert.deepEqual(hidden[field], shown[field], `${field} is independent of letterhead visibility`);
  }
});

test('report type scale stays within the compact body size and readable floor', () => {
  assert.ok(REPORT_TYPE_SCALE_PT.body <= 7.5);
  assert.ok(ptToPx(REPORT_TYPE_SCALE_PT.body) <= 10);
  assert.ok(Object.values(REPORT_TYPE_SCALE_PT).every((size) => size >= MIN_PRINTED_FONT_PT));
});
