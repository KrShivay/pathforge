import assert from 'node:assert/strict';
import test from 'node:test';

import { datePrefix, formatPatientId, nextPatientId, parsePatientId } from '../../src/domain/patientId.mjs';

test('datePrefix formats local date as YYYYMMDD', () => {
  assert.equal(datePrefix(new Date(2026, 8, 10)), '20260910');
  assert.equal(datePrefix(new Date(2026, 0, 1)), '20260101');
});

test('formatPatientId zero-pads the sequence to three digits', () => {
  assert.equal(formatPatientId('20260910', 1), 'PF-20260910-001');
  assert.equal(formatPatientId('20260910', 42), 'PF-20260910-042');
  assert.equal(formatPatientId('20260910', 1234), 'PF-20260910-1234');
});

test('parsePatientId round-trips a formatted id and rejects junk', () => {
  assert.deepEqual(parsePatientId('PF-20260910-007'), { date: '20260910', sequence: 7 });
  assert.deepEqual(parsePatientId('  PF-20260910-007  '), { date: '20260910', sequence: 7 });
  assert.equal(parsePatientId('PF-1003'), null);
  assert.equal(parsePatientId('20260910-007'), null);
  assert.equal(parsePatientId(''), null);
});

test('nextPatientId picks the first free sequence for the day', () => {
  const day = new Date(2026, 8, 10);
  assert.equal(nextPatientId([], day), 'PF-20260910-001');
  assert.equal(nextPatientId(['PF-20260910-001', 'PF-20260910-002'], day), 'PF-20260910-003');

  // Highest wins even when records are out of order or some were removed.
  assert.equal(nextPatientId(['PF-20260910-005', 'PF-20260910-001'], day), 'PF-20260910-006');

  // Other days and unparseable ids are ignored.
  assert.equal(nextPatientId(['PF-20260909-099', 'PF-1003', 'not-an-id'], day), 'PF-20260910-001');
});
