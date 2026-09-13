import assert from 'node:assert/strict';
import test from 'node:test';

import { resultTypeError } from '../../src/components/report/resultValidation.mjs';

test('numeric result types accept finite numbers and blank draft values', () => {
  assert.equal(resultTypeError('13.4', 'number'), '');
  assert.equal(resultTypeError('', 'number'), '');
  assert.equal(resultTypeError('not a number', 'number'), 'Enter a numeric value for this parameter.');
});

test('text result types accept qualitative values', () => {
  assert.equal(resultTypeError('Reactive', 'text'), '');
});
