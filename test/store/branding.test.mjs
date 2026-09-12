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
  getUsableLogoDataUrl,
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

test('branding: invalid stored fields fall back without dropping legacy profile keys', () => {
  global.localStorage.clear();
  global.localStorage.setItem(
    'pathforge.laboratory-profile.v1',
    JSON.stringify({
      laboratoryName: null,
      phone: 123,
      accreditationName: 'Legacy accreditation',
    }),
  );

  const loaded = loadLaboratoryProfile();
  assert.equal(loaded.laboratoryName, DEFAULT_LABORATORY_PROFILE.laboratoryName);
  assert.equal(loaded.phone, DEFAULT_LABORATORY_PROFILE.phone);
  assert.equal(loaded.accreditationName, 'Legacy accreditation');
});

test('branding: only supported uploaded image data URLs are renderable', () => {
  const valid = 'data:image/png;base64,AA==';
  assert.equal(getUsableLogoDataUrl(valid), valid);
  assert.equal(getUsableLogoDataUrl(''), '');
  assert.equal(getUsableLogoDataUrl('not-an-image'), '');
  assert.equal(getUsableLogoDataUrl('data:image/svg+xml;base64,AA=='), '');
});
