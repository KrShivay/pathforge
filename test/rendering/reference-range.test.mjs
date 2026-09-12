import assert from 'node:assert/strict';
import test from 'node:test';

import { formatReferenceRange } from '../../src/components/report/referenceRange.ts';

// Shared by the editor table, wizard review/results steps, test management,
// and (via reportModel.ts) the print/PDF pipeline. A one-sided bound must
// carry its direction — a bare "40" is ambiguous between "must be under 40"
// and "must be at least 40".
test('formatReferenceRange marks the direction of a one-sided bound', () => {
  assert.equal(formatReferenceRange({ min: 12, max: 15 }), '12 – 15');
  assert.equal(formatReferenceRange({ min: 40 }), '≥ 40');
  assert.equal(formatReferenceRange({ max: 40 }), '≤ 40');
  assert.equal(formatReferenceRange({ text: 'Negative' }), 'Negative');
  assert.equal(formatReferenceRange(undefined), '—');
  assert.equal(formatReferenceRange({}), '—');
});
