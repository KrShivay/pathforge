import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

test('production workspace has no runtime demo-data seed path', async () => {
  const [patientContext, reportContext] = await Promise.all([
    readFile(new URL('src/store/PatientContext.tsx', root), 'utf8'),
    readFile(new URL('src/store/ReportContext.tsx', root), 'utf8'),
  ]);

  assert.doesNotMatch(patientContext, /demoData|VITE_DEMO_WORKSPACE|DEMO_PATIENTS/);
  assert.doesNotMatch(reportContext, /demoData|VITE_DEMO_WORKSPACE|DEMO_REPORTS/);
  await assert.rejects(access(new URL('src/store/demoData.ts', root)));
});

test('laboratory test catalog seed remains available', async () => {
  const testContext = await readFile(new URL('src/store/TestContext.tsx', root), 'utf8');

  assert.match(testContext, /const initialTests: LaboratoryTest\[\] = \[/);
  assert.match(testContext, /Complete Blood Count \(CBC\)/);
});
