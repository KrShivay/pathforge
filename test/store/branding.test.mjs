import test from 'node:test';
import assert from 'node:assert/strict';

// Simple polyfill for localStorage in Node tests
if (!global.localStorage) {
  const store = new Map();
  global.localStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

import {
  DEFAULT_LABORATORY_PROFILE,
  snapshotLaboratoryProfile,
  loadLaboratorySnapshot,
  loadLaboratoryProfile,
  saveLaboratoryProfile,
} from '../../src/store/branding.ts';

test('branding: finalized reports freeze their branding via snapshot', () => {
  global.localStorage.clear();

  const profile = {
    ...DEFAULT_LABORATORY_PROFILE,
    laboratoryName: 'Test Lab',
    phone: '123-456',
  };

  saveLaboratoryProfile(profile);

  const loaded = loadLaboratoryProfile();
  assert.equal(loaded.laboratoryName, 'Test Lab');

  const reportId = 'test-report-1';
  const version = 1;

  // Snapshot is taken when a report is finalized
  snapshotLaboratoryProfile(reportId, version, profile);

  // Now the active profile changes
  saveLaboratoryProfile({
    ...profile,
    laboratoryName: 'New Test Lab',
  });

  const active = loadLaboratoryProfile();
  assert.equal(active.laboratoryName, 'New Test Lab');

  // But the finalized report should still load the snapshot (frozen) branding
  const snapshot = loadLaboratorySnapshot(reportId, version);
  assert.ok(snapshot, 'Snapshot must be loaded');
  assert.equal(
    snapshot.laboratoryName,
    'Test Lab',
    'Snapshot branding should be frozen to what it was at finalization',
  );
});
