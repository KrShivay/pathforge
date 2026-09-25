import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { REPORT_TYPE_SCALE_PT } from '../../src/components/report/printLayout.ts';

const css = fs.readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8');

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

test('PrintableReport sources layout margins and conditionally renders its letterhead', () => {
  const source = fs.readFileSync(new URL('../../src/components/report/PrintableReport.tsx', import.meta.url), 'utf8');
  assert.match(source, /model\.layout\.showLetterhead\s*&&\s*<header className="pr-letterhead">/);
  assert.match(source, /@page \{ size: A4; margin: \$\{Number\(margins\.top\)\.toFixed\(2\)\}mm/);
  for (const side of ['top', 'right', 'bottom', 'left']) {
    assert.match(source, new RegExp(`margins\\.${side}\\)\\.toFixed\\(2\\)`));
  }
  assert.match(source, /pr-no-letterhead/);
  assert.match(source, /--pr-margin-top/);
});

test('hidden letterhead removes top margin only from the first visible block', () => {
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

test('Laboratory Profile exposes and validates configurable print margins', () => {
  const source = fs.readFileSync(new URL('../../src/pages/LaboratoryProfile.tsx', import.meta.url), 'utf8');
  assert.match(source, /<legend>Print layout<\/legend>/);
  assert.match(source, /Print laboratory header \(letterhead\)/);
  assert.match(source, /MARGIN_LABELS/);
  assert.match(source, /mmToPx\(draft\.printLayout\.marginsMm\[side\]\)/);

  const validation = source.indexOf('const layoutErrors = validatePrintLayout(candidateLayout)');
  const update = source.indexOf('updateProfile({ ...draft, printLayout: candidateLayout })');
  assert.ok(validation >= 0, 'save validates the candidate layout');
  assert.ok(update > validation, 'save validation runs before updating the profile');
});

test('preview modal uses the print report line height', () => {
  assert.match(firstRule('.preview-modal-sheet .print-report'), /line-height:\s*1\.35/);
  assert.match(css, /\.form-group textarea\s*\{\s*resize:\s*vertical;\s*line-height:\s*1\.5;/);
});
