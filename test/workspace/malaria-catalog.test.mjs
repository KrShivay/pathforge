import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

test('malaria seed catalog matches the report rows', async () => {
  const [testContext, parameterHelp] = await Promise.all([
    readFile(new URL('src/store/TestContext.tsx', root), 'utf8'),
    readFile(new URL('src/components/report/parameterHelp.ts', root), 'utf8'),
  ]);

  assert.match(testContext, /"malaria-screen",\s*"Malaria Parasite Test by Card Method \(Antigen\)"/);
  assert.match(
    testContext,
    /id: "malaria-antigen",\s*name: "Malaria Parasite Test by Card Method \(Antigen\)",[\s\S]*?referenceRange: \{ text: "Negative" \}/,
  );
  assert.doesNotMatch(testContext, /malaria-parasite|Parasite Findings/);

  assert.match(testContext, /id: "mp-card-test",\s*name: "MP Card Test \(Serology Test\)",\s*department: "Immunology"/);
  const pvIndex = testContext.indexOf('id: "mp-card-pv"');
  const pfIndex = testContext.indexOf('id: "mp-card-pf"');
  assert.ok(pvIndex >= 0 && pvIndex < pfIndex);
  assert.match(testContext, /id: "mp-card-pv",\s*name: "Rapid ELISA Qualitative Method for PV"/);
  assert.match(testContext, /id: "mp-card-pf",\s*name: "Rapid ELISA Qualitative Method for PF"/);
  const mpCardTest = testContext.slice(testContext.indexOf('id: "mp-card-test"'), testContext.indexOf('id: "insulin"'));
  assert.doesNotMatch(mpCardTest, /specimen/);

  assert.match(parameterHelp, /"mp-card-pv"/);
  assert.match(parameterHelp, /"mp-card-pf"/);
  assert.doesNotMatch(parameterHelp, /"malaria-parasite"/);
});
