import assert from 'node:assert/strict';
import test from 'node:test';
import { strFromU8, unzipSync } from 'fflate';

import { buildXlsxBytes } from '../../src/lib/xlsxExport.ts';

test('XLSX export builds a readable workbook for displayed rows', () => {
  const bytes = buildXlsxBytes(
    [
      {
        Patient: 'Jane Doe',
        Status: 'draft',
        Count: 2,
        Active: true,
        Created: new Date('2026-09-13T10:30:00Z'),
      },
    ],
    'Worklist',
  );
  const files = unzipSync(bytes);
  const workbook = strFromU8(files['xl/workbook.xml']);
  const sheet = strFromU8(files['xl/worksheets/sheet1.xml']);
  const styles = strFromU8(files['xl/styles.xml']);

  assert.match(workbook, /name="Worklist"/);
  assert.match(sheet, /Jane Doe/);
  assert.match(sheet, /<v>2<\/v>/);
  assert.match(sheet, /t="b"><v>1<\/v>/);
  assert.match(styles, /yyyy-mm-dd hh:mm/);
});

test('XLSX export escapes cell text and provides a header for empty workbooks', () => {
  const bytes = buildXlsxBytes([{ Value: '<script>&"' }]);
  const files = unzipSync(bytes);
  const sheet = strFromU8(files['xl/worksheets/sheet1.xml']);
  assert.match(sheet, /&lt;script&gt;&amp;&quot;/);
  const emptySheet = strFromU8(unzipSync(buildXlsxBytes([]))['xl/worksheets/sheet1.xml']);
  assert.match(emptySheet, /Records/);
});
