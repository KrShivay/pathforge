import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createReportApp } from '../scripts/report-app.mjs';

const fixtureUrl = new URL('../docs/fixtures/report-initial.json', import.meta.url);

test('prototype accepts report data and returns a complete printable document model', async (context) => {
  const server = createReportApp();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const origin = `http://127.0.0.1:${address.port}`;

  const [page, health, sample] = await Promise.all([
    fetch(origin),
    fetch(`${origin}/health`),
    fetch(`${origin}/api/sample?name=initial`),
  ]);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Print \/ Save PDF/);
  assert.deepEqual(await health.json(), { status: 'ok' });
  assert.equal(sample.status, 200);

  const report = JSON.parse(await readFile(fixtureUrl, 'utf8'));
  const response = await fetch(`${origin}/api/report-model`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(report),
  });
  assert.equal(response.status, 200);
  const model = await response.json();
  assert.deepEqual(model.report_version, { report_id: 'R100', version: 1 });
  assert.equal(model.sections.flatMap((section) => section.fields).length, 3);

  const invalid = await fetch(`${origin}/api/report-model`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ report_id: 'broken' }),
  });
  assert.equal(invalid.status, 400);
  assert.match((await invalid.json()).error, /resolved_payload must be a non-empty object/);
});
