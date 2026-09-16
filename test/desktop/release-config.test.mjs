import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const configPath = new URL('../../src-tauri/tauri.conf.json', import.meta.url);
const capabilityPath = new URL('../../src-tauri/capabilities/default.json', import.meta.url);

test('desktop release configuration keeps webview protections and PDF writes scoped', async () => {
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const security = config.app.security;

  assert.notEqual(security.csp, null);
  assert.equal(security.csp['default-src'], "'self'");
  assert.match(security.csp['connect-src'], /ipc:/);
  assert.match(security.csp['img-src'], /data:/);

  const capabilities = JSON.parse(await readFile(capabilityPath, 'utf8'));
  const writeFile = capabilities.permissions.find((permission) => permission.identifier === 'fs:allow-write-file');
  const scopes = writeFile.allow.map(({ path }) => path);

  assert.deepEqual(scopes, ['$DESKTOP/**', '$DOCUMENT/**', '$DOWNLOAD/**']);
  assert.equal(
    scopes.some((scope) => scope.startsWith('$HOME')),
    false,
  );
});
