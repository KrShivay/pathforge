import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildResolvedPayload,
  checkClinicalCompleteness,
  readWorkspaceContent,
} from '../../src/domain/report-bridge.mjs';

/**
 * Persistence-side character allowlisting: whatever a client sends, disallowed
 * characters never reach the stored report payload. Results still keep "+".
 */

const dirtyContent = {
  specimens: ['Whole Blood (EDTA) <script>'],
  specimenCollectionDate: '2026-02-03',
  clinicalHistory: 'History: fever & chills {note}',
  findings: 'Normocytic anaemia. No atypical cells </img>',
  diagnosis: 'Mild anaemia — correlate | clinically',
  testResults: [
    {
      testId: 'cbc',
      testName: 'CBC',
      parameterId: 'hemoglobin',
      parameterName: 'Hemoglobin',
      unit: 'g/dL',
      referenceRange: { min: 12, max: 15 },
      value: '11.2 `DROP TABLE`',
    },
    {
      testId: 'ua',
      testName: 'Urine',
      parameterId: 'protein',
      parameterName: 'Protein',
      value: '+++ !@#',
    },
  ],
};

test('buildResolvedPayload strips disallowed characters before storage', () => {
  const payload = buildResolvedPayload(dirtyContent);

  assert.equal(payload['narrative.specimen_type'].value, 'Whole Blood (EDTA) script');
  assert.equal(payload['narrative.specimen_type'].specimen_collection_date, '2026-02-03');
  assert.equal(payload['narrative.clinical_history'].value, 'History fever & chills note');
  assert.equal(payload['narrative.findings'].value, 'Normocytic anaemia. No atypical cells img');
  assert.equal(payload['narrative.diagnosis'].value, 'Mild anaemia — correlate  clinically');

  // Results keep "+" but lose the arbitrary symbols.
  assert.equal(payload['result.cbc::hemoglobin'].value, '11.2 DROP TABLE');
  assert.equal(payload['result.ua::protein'].value, '+++ ');

  for (const entry of Object.values(payload)) {
    assert.ok(!/[<>{}|`!@#$^*_=[\]~\\]/.test(String(entry.value)), entry.field_id);
  }
});

test('reading a stored version back yields already-clean text', () => {
  const version = { resolved_payload: buildResolvedPayload(dirtyContent) };
  const content = readWorkspaceContent(version);
  assert.equal(content.specimenCollectionDate, '2026-02-03');
  assert.equal(content.findings, 'Normocytic anaemia. No atypical cells img');
  assert.equal(
    checkClinicalCompleteness(content).filter((i) => /not allowed/.test(i.message)).length,
    0,
    'clean content raises no character issues',
  );
});

test('checkClinicalCompleteness flags disallowed characters at finalize time', () => {
  const issues = checkClinicalCompleteness({
    specimens: ['Serum'],
    clinicalHistory: '',
    findings: 'ok <script>',
    diagnosis: 'ok',
    testResults: [
      { parameterId: 'x', parameterName: 'X', value: 'good' },
      { parameterId: 'y', parameterName: 'Y', value: 'bad|value' },
    ],
  });
  const fields = issues.filter((i) => /not allowed/.test(i.message)).map((i) => i.field);
  assert.deepEqual(fields.sort(), ['findings', 'result.y']);
});

test('checkClinicalCompleteness rejects an invalid specimen collection date', () => {
  const issues = checkClinicalCompleteness({
    specimens: ['Serum'],
    specimenCollectionDate: '2026-02-31',
    findings: 'ok',
    diagnosis: 'ok',
    testResults: [],
  });

  assert.deepEqual(issues, [
    {
      field: 'specimenCollectionDate',
      message: 'Specimen collection date must be a valid date.',
    },
  ]);
});
