import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { sha256Hex } from '../../src/domain/sha256.mjs';

/** @param {string} value */
const reference = (value) => createHash('sha256').update(value).digest('hex');

test('sha256Hex matches published known-answer vectors', () => {
  assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(
    sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
  );
});

test('sha256Hex matches node:crypto across payload shapes and lengths', () => {
  const samples = [
    'a',
    'The quick brown fox jumps over the lazy dog',
    JSON.stringify({ b: 2, a: [1, 2, 3], nested: { z: null } }),
    'x'.repeat(55),
    'y'.repeat(56),
    'z'.repeat(64),
    'w'.repeat(1000),
    'café → résumé — 数据',
  ];
  for (const sample of samples) {
    assert.equal(sha256Hex(sample), reference(sample), `digest mismatch for ${JSON.stringify(sample.slice(0, 20))}`);
  }
});
