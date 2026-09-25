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
  normalizeLaboratoryProfile,
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

test('branding: the shipped default profile carries the laboratory identity', () => {
  assert.equal(DEFAULT_LABORATORY_PROFILE.laboratoryName, 'Adarsh Diagnostics Center');
  assert.equal(DEFAULT_LABORATORY_PROFILE.proprietorName, 'Kapil Kumar Porwal');
  assert.equal(DEFAULT_LABORATORY_PROFILE.registrationNumber, 'ETW/ALO/0002/05');
  assert.deepEqual(
    [DEFAULT_LABORATORY_PROFILE.addressLine1, DEFAULT_LABORATORY_PROFILE.addressLine2, DEFAULT_LABORATORY_PROFILE.city],
    ['Collectry Road', 'Dibiyapur', 'Auraiya'],
  );
});

test('branding: every profile detail beyond the supplied identity is optional', () => {
  // Nothing else is prefilled, so the rest of the profile is free to stay blank
  // and the report simply leaves those lines out.
  const prefilled = Object.entries(DEFAULT_LABORATORY_PROFILE)
    .filter(([, value]) => typeof value === 'string' && value !== '')
    .map(([key]) => key)
    .sort();

  assert.deepEqual(prefilled, [
    'addressLine1',
    'addressLine2',
    'city',
    'country',
    'laboratoryName',
    'logoDataUrl',
    'pathologistDesignation',
    'proprietorName',
    'registrationNumber',
    'reportSubtitle',
    'shortName',
    'technologistDesignation',
  ]);
});

test('branding: a legacy stored profile gains the new optional keys as blanks', () => {
  global.localStorage.clear();
  global.localStorage.setItem('pathforge.laboratory-profile.v1', JSON.stringify({ laboratoryName: 'Older Lab' }));

  const loaded = loadLaboratoryProfile();
  assert.equal(loaded.laboratoryName, 'Older Lab');
  assert.equal(typeof loaded.proprietorName, 'string');
  assert.equal(loaded.workingHours, '');
});

test('branding: the shipped logo is a renderable image the report can print', () => {
  // The renderers only accept data: image URLs, so a path here would silently
  // drop the logo from both the printed page and the PDF.
  assert.equal(getUsableLogoDataUrl(DEFAULT_LABORATORY_PROFILE.logoDataUrl), DEFAULT_LABORATORY_PROFILE.logoDataUrl);
  assert.match(DEFAULT_LABORATORY_PROFILE.logoDataUrl, /^data:image\/png;base64,/);
});

test('branding: snapshots share one copy of the logo instead of embedding it each time', () => {
  global.localStorage.clear();
  const profile = { ...DEFAULT_LABORATORY_PROFILE };

  for (let version = 1; version <= 40; version += 1) {
    snapshotLaboratoryProfile('report-quota', version, profile);
  }

  // Forty frozen versions must not carry forty copies of the image, or the
  // browser's storage quota ends the ability to finalize a report.
  const snapshotBytes = global.localStorage.getItem('pathforge.laboratory-branding-snapshots.v1').length;
  assert.ok(
    snapshotBytes < profile.logoDataUrl.length,
    `40 snapshots took ${snapshotBytes} bytes, more than a single logo (${profile.logoDataUrl.length})`,
  );

  // The frozen branding still resolves to exactly the image that was printed.
  assert.equal(loadLaboratorySnapshot('report-quota', 17).logoDataUrl, profile.logoDataUrl);
});

test('branding: a snapshot written with an inline logo still loads', () => {
  global.localStorage.clear();
  const inline = 'data:image/png;base64,AA==';
  global.localStorage.setItem(
    'pathforge.laboratory-branding-snapshots.v1',
    JSON.stringify({ 'legacy::1': { ...DEFAULT_LABORATORY_PROFILE, logoDataUrl: inline } }),
  );

  assert.equal(loadLaboratorySnapshot('legacy', 1).logoDataUrl, inline);
});

test('branding: a profile still holding the superseded default adopts the current one', () => {
  global.localStorage.clear();
  global.localStorage.setItem(
    'pathforge.laboratory-profile.v1',
    JSON.stringify({ laboratoryName: 'PathForge Clinical Laboratory', shortName: 'PathForge', logoDataUrl: '' }),
  );

  // Nobody configured that profile — it is the identity the workspace shipped
  // with — so it must not shadow the laboratory's own details.
  const loaded = loadLaboratoryProfile();
  assert.equal(loaded.laboratoryName, 'Adarsh Diagnostics Center');
  assert.equal(loaded.logoDataUrl, DEFAULT_LABORATORY_PROFILE.logoDataUrl);
});

test('branding: a profile the laboratory configured is never overwritten', () => {
  global.localStorage.clear();
  saveLaboratoryProfile({ ...DEFAULT_LABORATORY_PROFILE, laboratoryName: 'Some Other Lab', phone: '123' });

  const loaded = loadLaboratoryProfile();
  assert.equal(loaded.laboratoryName, 'Some Other Lab');
  assert.equal(loaded.phone, '123');
});

test('branding: normalize backfills string fields missing from a legacy snapshot', () => {
  // A report finalized before proprietorName/workingHours existed freezes a
  // snapshot without them. buildReportModel later calls `.trim()` on these, so
  // normalize must replace any non-string field with its default (Bug: crash).
  const legacy = { ...DEFAULT_LABORATORY_PROFILE };
  delete legacy.proprietorName;
  delete legacy.workingHours;

  const normalized = normalizeLaboratoryProfile(legacy);
  assert.equal(typeof normalized.proprietorName, 'string');
  assert.equal(typeof normalized.workingHours, 'string');
  assert.equal(normalized.proprietorName, DEFAULT_LABORATORY_PROFILE.proprietorName);
  assert.doesNotThrow(() => normalized.proprietorName.trim());
});

test('branding: legacy profiles and snapshots default print layout', () => {
  global.localStorage.clear();
  const legacyProfile = { laboratoryName: 'Older Lab' };
  global.localStorage.setItem('pathforge.laboratory-profile.v1', JSON.stringify(legacyProfile));
  assert.deepEqual(loadLaboratoryProfile().printLayout, DEFAULT_LABORATORY_PROFILE.printLayout);

  global.localStorage.setItem(
    'pathforge.laboratory-branding-snapshots.v1',
    JSON.stringify({ 'legacy-layout::1': { ...legacyProfile, logoDataUrl: '' } }),
  );
  assert.deepEqual(loadLaboratorySnapshot('legacy-layout', 1).printLayout, DEFAULT_LABORATORY_PROFILE.printLayout);
});

test('branding: print layout survives save and freezes in finalized profile snapshots', () => {
  global.localStorage.clear();
  const printLayout = {
    showLetterhead: false,
    marginsMm: { top: 22.5, right: 18, bottom: 12, left: 20 },
  };
  const profile = { ...DEFAULT_LABORATORY_PROFILE, printLayout };
  const frozenLayout = structuredClone(printLayout);
  saveLaboratoryProfile(profile);
  assert.deepEqual(loadLaboratoryProfile().printLayout, printLayout);

  snapshotLaboratoryProfile('layout-freeze', 2, profile);
  profile.printLayout.marginsMm.top = 30;
  saveLaboratoryProfile(profile);

  assert.deepEqual(loadLaboratorySnapshot('layout-freeze', 2).printLayout, frozenLayout);
  assert.equal(loadLaboratoryProfile().printLayout.marginsMm.top, 30);
});

test('branding: default profile copies own independent print layout objects', () => {
  const copy = normalizeLaboratoryProfile(DEFAULT_LABORATORY_PROFILE);
  copy.printLayout.marginsMm.top = 25;
  assert.equal(DEFAULT_LABORATORY_PROFILE.printLayout.marginsMm.top, 16);
});
