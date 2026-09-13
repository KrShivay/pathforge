import assert from 'node:assert/strict';
import test from 'node:test';

import { containsInvalidChars, invalidCharsIn, sanitizePhone, sanitizeText } from '../../src/domain/textRules.mjs';

const VALID_GENERAL = ['Hemoglobin', 'Hb-1', 'Blood (EDTA)', 'Trace, positive', 'RBC & WBC', '10.5', '50%'];

const VALID_RESULT_ONLY = ['+', '++', '+++', '++++'];

const INVALID = ['!@#$%^&*()_', '<script>', '<img>', '{}', '[]', '<>', '|', '\\', '`'];

test('general text: approved clinical strings pass through unchanged', () => {
  for (const value of VALID_GENERAL) {
    assert.equal(sanitizeText(value), value, value);
    assert.equal(containsInvalidChars(value), false, value);
  }
});

test('general text: accented names are preserved', () => {
  assert.equal(sanitizeText('José Müller'), 'José Müller');
  assert.equal(containsInvalidChars('José Müller'), false);
});

test('general text: arbitrary symbols are rejected and stripped', () => {
  for (const value of INVALID) {
    assert.equal(containsInvalidChars(value), true, `should reject ${JSON.stringify(value)}`);
    assert.equal(
      containsInvalidChars(sanitizeText(value)),
      false,
      `sanitized ${JSON.stringify(value)} still had invalid chars`,
    );
    // No angle brackets survive into anything that could be rendered as markup.
    assert.ok(!/[<>]/.test(sanitizeText(value)));
  }
});

test('general text: + is not allowed', () => {
  for (const value of VALID_RESULT_ONLY) {
    assert.equal(containsInvalidChars(value, 'general'), true, value);
    assert.equal(sanitizeText(value, 'general'), '');
  }
});

test('result text: + notation is allowed, plus everything general allows', () => {
  for (const value of [...VALID_RESULT_ONLY, ...VALID_GENERAL]) {
    assert.equal(sanitizeText(value, 'result'), value, value);
    assert.equal(containsInvalidChars(value, 'result'), false, value);
  }
});

test('result text: arbitrary symbols are still rejected', () => {
  for (const value of INVALID) {
    assert.equal(containsInvalidChars(value, 'result'), true, value);
  }
  assert.equal(sanitizeText('1+ !@#', 'result'), '1+ ');
});

test('invalidCharsIn lists the distinct offending characters', () => {
  assert.deepEqual(invalidCharsIn('a<b>c<b>').sort(), ['<', '>']);
  assert.deepEqual(invalidCharsIn(''), []);
  assert.deepEqual(invalidCharsIn('Hemoglobin'), []);
});

test('sanitizePhone keeps digits and phone punctuation only', () => {
  assert.equal(sanitizePhone('+91 (98765) 43210-1'), '+91 (98765) 43210-1');
  assert.equal(sanitizePhone('+91-98765abc'), '+91-98765');
  assert.equal(sanitizePhone('call<script>'), '');
});

test('sanitizeText tolerates non-string input', () => {
  assert.equal(sanitizeText(undefined), '');
  assert.equal(sanitizeText(null), '');
  assert.equal(sanitizeText(10.5), '10.5');
});
