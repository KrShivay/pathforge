import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { REPORT_TYPE_SCALE_PT } from '../../src/components/report/printLayout.ts';
import { buildReportModel } from '../../src/components/report/reportModel.ts';
import { DEFAULT_LABORATORY_PROFILE } from '../../src/store/branding.ts';

const css = fs.readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8');
const vite = await createServer({
  configFile: false,
  esbuild: { jsx: 'automatic' },
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  logLevel: 'error',
});
after(async () => vite.close());

const { default: PrintableReport } = await vite.ssrLoadModule('/src/components/report/PrintableReport.tsx');
const { default: LaboratoryProfilePage } = await vite.ssrLoadModule('/src/pages/LaboratoryProfile.tsx');
const { BrandingProvider } = await vite.ssrLoadModule('/src/store/BrandingContext.tsx');

function reportModel(showLetterhead, marginsMm = { top: 31.75, right: 12, bottom: 14.5, left: 10 }) {
  return buildReportModel({
    patientName: 'Jane Doe',
    patientCode: 'P-100',
    reportId: 'R-100',
    version: 1,
    isFinalized: false,
    laboratoryProfile: {
      ...DEFAULT_LABORATORY_PROFILE,
      logoDataUrl: '',
      printLayout: { showLetterhead, marginsMm },
    },
    content: {
      specimens: ['Whole Blood'],
      referringClinician: 'Dr Example',
      clinicalHistory: 'Routine history narrative',
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
  });
}

function firstRule(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `Expected CSS rule for ${selector}`);
  return match[1];
}

test('form dialogs are fixed overlays with a bounded modal surface', () => {
  const overlay = firstRule('.modal-overlay');
  const modal = firstRule('.patient-modal');

  assert.match(overlay, /position:\s*fixed/);
  assert.match(overlay, /display:\s*flex/);
  assert.match(overlay, /z-index:\s*1000/);
  assert.match(modal, /max-width:\s*560px/);
  assert.match(modal, /max-height:\s*calc\(100vh - 40px\)/);
  assert.match(modal, /overflow-y:\s*auto/);
});

test('printable report headers stay on one line and all five columns have room', () => {
  const header = firstRule('.pr-results thead th');
  const columns = [1, 2, 3, 4, 5].map((index) =>
    firstRule(`.pr-results th:nth-child(${index}),\n.pr-results td:nth-child(${index})`),
  );

  assert.match(header, /white-space:\s*nowrap/);
  assert.match(header, /overflow-wrap:\s*normal/);
  for (const [column, width] of columns.map((rule, index) => [rule, [38, 17, 13, 24, 8][index]])) {
    assert.match(column, new RegExp(`width:\\s*${width}%`));
  }
  assert.match(firstRule('.pr-results'), /width:\s*100%/);
});

test('static A4 page rule leaves margins to the report model', () => {
  const pageRule = css.match(/@page\s*\{([^}]*)\}/)?.[1];
  assert.ok(pageRule);
  assert.match(pageRule, /size:\s*A4/);
  assert.doesNotMatch(pageRule, /margin\s*:/);
});

test('report type sizes in CSS match the shared report scale', () => {
  const scaleRules = [
    ['.pr-band dt', 'label'],
    ['.pr-band dd', 'bandValue'],
    ['.pr-results', 'table'],
    ['.pr-results thead th', 'tableHeader'],
    ['.pr-section > h2', 'sectionHeading'],
    ['.pr-results-heading', 'groupHeading'],
    ['.pr-narrative', 'body'],
    ['.pr-diagnosis .pr-narrative', 'diagnosis'],
    ['.pr-sigrole', 'signoffRole'],
    ['.pr-signote', 'signoffNote'],
    ['.pr-authnote', 'footer'],
    ['.pr-endmark', 'footer'],
    ['.pr-footer', 'footer'],
    ['.pr-brand h1', 'brandName'],
    ['.pr-doctitle', 'documentTitle'],
    ['.pr-tagline', 'letterheadDetail'],
    ['.pr-proprietor', 'letterheadDetail'],
    ['.pr-address', 'letterheadDetail'],
    ['.pr-contact', 'letterheadDetail'],
    ['.pr-docmeta-regnum', 'letterheadDetail'],
    ['.pr-docmeta dt', 'letterheadDetail'],
    ['.pr-docmeta dd', 'letterheadDetail'],
    ['.pr-draftbanner', 'notice'],
    ['.pr-amendmentbanner', 'notice'],
  ];
  for (const [selector, key] of scaleRules) {
    const rule = firstRule(selector);
    const size = Number(rule.match(/font-size:\s*([\d.]+)pt/)?.[1]);
    assert.equal(size, REPORT_TYPE_SCALE_PT[key], `${selector} uses ${key}`);
  }
  const reportRules = [...css.matchAll(/([^{}]*\.pr-[^{}]*)\{([^}]*)\}/g)];
  for (const [, selector, declarations] of reportRules) {
    for (const [, raw] of declarations.matchAll(/font-size:\s*([\d.]+)pt/g)) {
      const size = Number(raw);
      assert.ok(size >= 6, `${selector.trim()} has report text no smaller than 6pt`);
      if (/\.pr-diagnosis/.test(selector)) {
        assert.ok(size <= REPORT_TYPE_SCALE_PT.diagnosis, `${selector.trim()} stays within diagnosis emphasis`);
      } else if (
        /\.pr-(?:results|band dd|narrative)/.test(selector) ||
        /\.pr-(?:sigrole|signote|authnote|endmark|footer)/.test(selector)
      ) {
        assert.ok(size <= 7.5, `${selector.trim()} stays within the body text scale`);
      }
    }
  }
});

test('PrintableReport renders configured margins and hides only its letterhead', () => {
  const margins = { top: 31.75, right: 12, bottom: 14.5, left: 10 };
  const shown = renderToStaticMarkup(React.createElement(PrintableReport, { model: reportModel(true, margins) }));
  const hidden = renderToStaticMarkup(React.createElement(PrintableReport, { model: reportModel(false, margins) }));
  assert.match(shown, /<header class="pr-letterhead">/);
  assert.match(shown, /@page \{ size: A4; margin: 31\.75mm 12\.00mm 14\.50mm 10\.00mm; \}/);
  for (const [side, value] of Object.entries(margins)) {
    assert.match(shown, new RegExp(`--pr-margin-${side}:${value.toFixed(2)}mm`));
  }
  assert.match(hidden, /class="print-report pr-draft pr-no-letterhead"/);
  assert.doesNotMatch(hidden, /<header class="pr-letterhead">/);
  for (const content of ['Patient details', 'Haemoglobin', 'Routine history narrative', 'pr-footer']) {
    assert.ok(hidden.includes(content), `hidden letterhead retains ${content}`);
  }
});

test('hidden-letterhead CSS removes top margin only from the first visible block', () => {
  assert.match(css, /\.print-report\.pr-no-letterhead\s*>\s*\.pr-draftbanner\s*,/);
  assert.match(css, /\.print-report\.pr-no-letterhead\s*>\s*\.pr-amendmentbanner:not\(\.pr-draftbanner ~ \*\)\s*,/);
  assert.match(
    css,
    /\.print-report\.pr-no-letterhead\s*>\s*\.pr-band:not\(\.pr-draftbanner ~ \*\):not\(\.pr-amendmentbanner ~ \*\)\s*\{/,
  );

  // A band that follows either banner must keep its normal top margin.
  assert.doesNotMatch(css, /\.pr-no-letterhead\s*>\s*\.pr-band:first-of-type/);
  assert.match(css, /\.pr-band:not\(\.pr-draftbanner ~ \*\):not\(\.pr-amendmentbanner ~ \*\)/);
});

test('Laboratory Profile renders the print layout controls and converted margin hints', () => {
  const html = renderToStaticMarkup(
    React.createElement(BrandingProvider, null, React.createElement(LaboratoryProfilePage)),
  );
  assert.match(html, /<legend>Print layout<\/legend>/);
  assert.match(html, /Print laboratory header \(letterhead\)/);
  for (const [side, min, max] of [
    ['top', 0, 60],
    ['right', 0, 60],
    ['bottom', 10, 60],
    ['left', 0, 60],
  ]) {
    const label = `${side[0].toUpperCase()}${side.slice(1)} margin (mm)`;
    assert.ok(html.includes(label), `renders the ${side} margin label`);
    assert.match(html, new RegExp(`<input type="number"[^>]*min="${min}"[^>]*max="${max}"[^>]*value="16"`));
  }
  assert.equal([...html.matchAll(/<small>≈ \d+ px<\/small>/g)].length, 4);
  assert.match(html, /120 px = 31\.75 mm/);
});

test('preview modal uses the print report line height', () => {
  assert.match(firstRule('.preview-modal-sheet .print-report'), /line-height:\s*1\.35/);
  assert.match(css, /\.form-group textarea\s*\{\s*resize:\s*vertical;\s*line-height:\s*1\.5;/);
});
