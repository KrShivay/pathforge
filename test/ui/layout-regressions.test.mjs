import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

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
