import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../../src/App.tsx');
const editor = read('../../src/pages/ReportEditor.tsx');
const newReport = read('../../src/pages/NewReport.tsx');
const profile = read('../../src/pages/LaboratoryProfile.tsx');
const catalog = read('../../src/pages/TestManagement.tsx');
const preview = read('../../src/components/report/ReportPreviewModal.tsx');
const a4Preview = read('../../src/components/report/A4PreviewSheet.tsx');
const reportModel = read('../../src/components/report/reportModel.ts');
const printableReport = read('../../src/components/report/PrintableReport.tsx');
const reportPdf = read('../../src/components/report/reportPdf.ts');
const css = read('../../src/index.css');

test('finalizing requires explicit confirmation immediately before writes', () => {
  const confirmation = editor.indexOf('title: "Finalize this report?"');
  const firstWrite = editor.indexOf('await updateReport(report.id, {', confirmation);
  const finalization = editor.indexOf('await finalizeReport(report.id)', confirmation);

  assert.notEqual(confirmation, -1);
  assert.ok(confirmation < firstWrite && confirmation < finalization);
  assert.match(editor.slice(confirmation, firstWrite), /finalized and locked/);
  assert.match(editor.slice(confirmation, firstWrite), /require an amendment/);
  assert.match(editor.slice(confirmation, firstWrite), /confirmText: "Finalize"/);
  assert.match(editor.slice(confirmation, firstWrite), /cancelText: "Cancel"/);
  assert.match(read('../../src/lib/dialog.ts'), /focusCancel: true/);
});

test('unsaved profile, catalog, report edits, and wizard data share the navigation guard', () => {
  assert.match(app, /dirtyScopesRef/);
  assert.match(app, /Object\.values\(dirtyScopesRef\.current\)\.some\(Boolean\)/);
  assert.match(app, /async function handleNavigate[\s\S]*?await confirmExit\(\)/);
  assert.match(app, /async function handleSelectReport[\s\S]*?await confirmExit\(\)/);
  assert.match(app, /addEventListener\("beforeunload"/);
  assert.match(profile, /JSON\.stringify\(draft\) !== JSON\.stringify\(profile\)/);
  assert.match(profile, /onDirtyChange\?\.\(false\)/);
  assert.match(catalog, /showAddTest \|\| editingTestId \|\| editingParameter \|\| showAddParameter/);
  assert.match(catalog, /onDirtyChange\?\.\(isDirty\)/);
  assert.match(newReport, /if \(!draft\) throw new Error[\s\S]*?onDirtyChange\?\.\(false\)/);
});

test('mobile worklist retains patient, test, status, and dates at 520px and below', () => {
  const worklistMobileRule = css.lastIndexOf(
    '.worklist-row {\n    grid-template-columns: minmax(0, 1fr) auto !important;',
  );
  const mobileStart = css.lastIndexOf('@media screen and (max-width: 520px)', worklistMobileRule);
  const mobileEnd = css.indexOf('@media screen and (max-width: 420px)', mobileStart);
  const mobileRules = css.slice(mobileStart, mobileEnd);

  assert.notEqual(mobileStart, -1);
  assert.match(mobileRules, /"patient status"\s+"test date"/);
  assert.match(mobileRules, /\.worklist-row \.col-test,[\s\S]*?display:\s*block/);
  assert.match(mobileRules, /\.worklist-row \.col-date\s*\{[^}]*display:\s*block/);
  assert.match(
    read('../../src/pages/Worklist.tsx'),
    /Collected \{formatReportFilterDate\(report\.specimenCollectionDate/,
  );
});

test('report preview uses a fixed A4 canvas and scales to the available width', () => {
  assert.match(a4Preview, /A4_WIDTH_PX = \(210 \* 96\) \/ 25\.4/);
  assert.match(a4Preview, /Math\.min\(1, viewport\.clientWidth \/ A4_WIDTH_PX\)/);
  assert.match(a4Preview, /new ResizeObserver\(updateScale\)/);
  assert.match(css, /\.a4-preview-sheet\s*\{[^}]*width:\s*210mm/);
  assert.match(css, /\.preview-modal-sheet \.print-report\s*\{[^}]*min-height:\s*297mm/);
  assert.match(preview, /<A4PreviewSheet className="preview-modal-sheet">/);
});

test('test catalog expansion is a standalone keyboard-operable button', () => {
  const headerStart = catalog.indexOf('className="test-item-header"');
  const expandStart = catalog.indexOf('className={`test-chevron-btn', headerStart);
  const expandButtonStart = catalog.lastIndexOf('<button', expandStart);
  const expandEnd = catalog.indexOf('</button>', expandStart);
  const header = catalog.slice(headerStart, expandStart);
  const expandButton = catalog.slice(expandButtonStart, expandEnd);

  assert.notEqual(headerStart, -1);
  assert.doesNotMatch(header, /role="button"|tabIndex=|onKeyDown=|onClick=/);
  assert.match(expandButton, /type="button"/);
  assert.match(expandButton, /aria-label=\{/);
  assert.match(expandButton, /toggleTest\(test\.id\)/);
  assert.match(expandButton, /disabled=\{isEditing\}/);
});

test('laboratory preview is content-sized on desktop and stacks under 1100px', () => {
  const previewRule = css.slice(css.indexOf('.profile-preview {', css.indexOf('lab-profile-layout')));
  const stackRule = css.slice(css.indexOf('@media screen and (max-width: 1100px)'));

  assert.match(previewRule, /height:\s*fit-content/);
  assert.match(previewRule, /align-self:\s*start/);
  assert.match(previewRule, /top:\s*var\(--pf-page-padding\)/);
  assert.match(stackRule, /\.lab-profile-layout\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(stackRule, /\.profile-preview\s*\{[^}]*position:\s*static/);
});

test('blank sign-off notes do not repeat the signatory role in HTML or PDF', () => {
  assert.match(reportModel, /function signoffNote\(role: string, values: string\[\]\)/);
  assert.match(reportModel, /value\.toLowerCase\(\) !== roleText/);
  assert.doesNotMatch(reportModel, /\|\| "Lab technologist"|\|\| "Consultant pathologist"/);
  assert.match(reportModel, /const hasSignatoryDetails = signoff\.some\(\(entry\) => entry\.note\.trim\(\)\)/);
  assert.match(reportModel, /hasSignatoryDetails[\s\S]*?AUTH_NOTE_FINAL[\s\S]*?: ""/);
  assert.match(printableReport, /entry\.note\.trim\(\) && <p className="pr-signote">/);
  assert.match(printableReport, /model\.authorisationNote\.trim\(\)/);
  assert.match(reportPdf, /if \(entry\.note\.trim\(\)\)/);
  assert.match(reportPdf, /if \(model\.authorisationNote\.trim\(\)\)/);
});

test('focus and elevation tokens distinguish controls, embedded cards, menus, and modals', () => {
  assert.match(css, /--pf-theme-brand-focus-soft:\s*rgba\(23, 105, 224, 0\.15\)/);
  assert.match(css, /box-shadow:\s*0 0 0 3px var\(--pf-theme-brand-focus-strong\)/);
  assert.match(
    css,
    /\.stat-card,[\s\S]*?\.test-item-card,[\s\S]*?\.profile-preview\s*\{\s*box-shadow:\s*var\(--pf-shadow-sm\)/,
  );
  assert.match(css, /\.top-nav-menu-list\s*\{[^}]*box-shadow:\s*var\(--pf-shadow-md\)/);
  assert.match(css, /\.preview-modal\s*\{[^}]*box-shadow:\s*0 24px 70px/);
});

test('PDF generator is loaded only when a print or download action runs', () => {
  assert.doesNotMatch(editor, /^import \{ downloadReportPdf \}/m);
  assert.match(editor, /await import\("\.\.\/components\/report\/reportPdf"\)/);
  assert.match(editor, /const \{ printReportPdf \} = await import\("\.\.\/components\/report\/reportPdf"\)/);
  assert.doesNotMatch(editor, /window\.print\(\)/);
});
