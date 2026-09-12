import test from 'node:test';
import assert from 'node:assert/strict';

import { filterPatients } from '../../src/components/report/wizard/patientSearch.mjs';

const patients = [
  {
    name: 'Om Prakash',
    patientId: 'PF-20260912-101',
    age: 42,
    gender: 'Male',
    phone: '+91 98765 43210',
    address: '14 MG Road Bengaluru',
  },
  {
    name: 'Ananya Sharma',
    patientId: 'PF-20260912-102',
    age: 35,
    gender: 'Female',
    phone: '+91 98123 45678',
    address: '88 Nehru Place Delhi',
  },
];

test('patient search matches names case-insensitively', () => {
  assert.deepEqual(filterPatients(patients, 'prakash'), [patients[0]]);
});

test('patient search matches RMN/patient IDs', () => {
  assert.deepEqual(filterPatients(patients, 'pf-20260912-101'), [patients[0]]);
});

test('patient search matches supported phone numbers', () => {
  assert.deepEqual(filterPatients(patients, '9812345678'), [patients[1]]);
  assert.deepEqual(filterPatients(patients, '919812345678'), [patients[1]]);
});

test('patient search matches any displayed patient detail', () => {
  assert.deepEqual(filterPatients(patients, '14 mg road'), [patients[0]]);
  assert.deepEqual(filterPatients(patients, 'female'), [patients[1]]);
  assert.deepEqual(filterPatients(patients, '42'), [patients[0]]);
});

test('patient search returns an empty result when nothing matches', () => {
  assert.deepEqual(filterPatients(patients, 'no such patient'), []);
});
