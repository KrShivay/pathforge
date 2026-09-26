import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

const expectedParameterIds = [
  'rbc',
  'hemoglobin',
  'hematocrit',
  'mcv',
  'wbc',
  'platelet',
  'neutrophils',
  'lymphocytes',
  'monocytes',
  'eosinophils',
  'basophils',
  'mch',
  'mchc',
  'widal-typhi-o-1-20',
  'widal-typhi-o-1-40',
  'widal-typhi-o-1-80',
  'widal-typhi-o-1-160',
  'widal-typhi-o-1-320',
  'widal-typhi-h-1-20',
  'widal-typhi-h-1-40',
  'widal-typhi-h-1-80',
  'widal-typhi-h-1-160',
  'widal-typhi-h-1-320',
  'widal-paratyphi-a-h-1-20',
  'widal-paratyphi-a-h-1-40',
  'widal-paratyphi-a-h-1-80',
  'widal-paratyphi-a-h-1-160',
  'widal-paratyphi-a-h-1-320',
  'widal-paratyphi-b-h-1-20',
  'widal-paratyphi-b-h-1-40',
  'widal-paratyphi-b-h-1-80',
  'widal-paratyphi-b-h-1-160',
  'widal-paratyphi-b-h-1-320',
  'widal-interpretation',
  'blood-sugar-fasting',
  'blood-sugar-postprandial',
  'blood-sugar-random',
  'blood-sugar-random-standalone',
  'esr-value',
  'bilirubin-total',
  'bilirubin-direct',
  'bilirubin-indirect',
  'hbsag-result',
  'malaria-antigen',
  'hemoglobin-screen-value',
  'sputum-afb-result',
  'mantoux-ppd-dose',
  'abo-group',
  'rh-factor',
  'rheumatoid-factor-result',
  'uric-acid',
  'mantoux-dose',
  'mantoux-route',
  'mantoux-time',
  'mantoux-induration',
  'mantoux-remark',
  'mantoux-interpretation-notes',
  'serochek-mtb-igg',
  'serochek-mtb-igm',
  'mp-card-pv',
  'mp-card-pf',
  'hiv-result',
  'signal-mf-result',
  'signal-tp-vdrl-result',
  'serum-bilirubin-total',
  'serum-bilirubin-direct',
  'serum-bilirubin-indirect',
  'serum-uric-acid-value',
  'urea',
  'creatinine',
  'bun',
  'total-cholesterol',
  'hdl-cholesterol',
  'ldl-cholesterol',
  'triglycerides',
  'sodium',
  'potassium',
  'chloride',
  'electrolyte-calcium',
  'alt',
  'ast',
  'alp',
  'total-protein',
  'albumin',
  'globulin',
  'ag-ratio',
  'chest-mediastinum',
  'chest-hilar-lymph-nodes',
  'chest-lungs-right',
  'chest-lungs-left',
  'chest-heart-shadow',
  'chest-costophrenic-right',
  'chest-costophrenic-left',
  'chest-diaphragm-right',
  'chest-diaphragm-left',
  'chest-ribs-right',
  'chest-ribs-left',
  'chest-impression',
];

const expectedTestIds = [
  'cbc',
  'widal',
  'blood-sugar-profile',
  'blood-sugar',
  'serum-bilirubin',
  'serum-uric-acid',
  'esr',
  'lft',
  'hepatitis-b-screen',
  'malaria-screen',
  'hemoglobin-screen',
  'sputum-afb',
  'mantoux-ppd-10tu',
  'blood-group-rh',
  'rheumatoid-factor',
  'renal-function',
  'mantoux-dose-route',
  'serochek-mtb',
  'mp-card-test',
  'hiv-screen',
  'signal-mf',
  'signal-tp-vdrl',
  'lipid-profile',
  'electrolytes',
  'skiagram-chest-pa',
];

test('MALERIA_REPORT panels, parameters, ranges, and report text exist in the default seed', async () => {
  const [testContext, parameterHelp] = await Promise.all([
    readFile(new URL('src/store/TestContext.tsx', root), 'utf8'),
    readFile(new URL('src/components/report/parameterHelp.ts', root), 'utf8'),
  ]);
  const seed = testContext.slice(
    testContext.indexOf('const initialTests:'),
    testContext.indexOf('const ORIGINAL_TEST_IDS'),
  );
  const parameterIds = [...seed.matchAll(/\bid:\s*"([^"]+)"/g)].map((match) => match[1]);
  const helperTestIds = [...seed.matchAll(/createSeedTest\(\s*"([^"]+)"/g)].map((match) => match[1]);
  const allSeedIds = [...parameterIds, ...helperTestIds];

  for (const id of expectedParameterIds) assert.ok(parameterIds.includes(id), `missing parameter ${id}`);
  for (const id of expectedTestIds) assert.ok(allSeedIds.includes(id), `missing test ${id}`);
  assert.equal(new Set(allSeedIds).size, allSeedIds.length, 'seed test and parameter IDs must be unique');

  for (const dilution of ['1:20', '1:40', '1:80', '1:160', '1:320']) {
    assert.ok(seed.includes(`unit: "${dilution}"`), `Widal screening dilution ${dilution} is missing`);
  }
  for (const range of [
    'Male 0 to 10 mm/1 hr; Female 0 to 20 mm/1 hr',
    '0.1 ml of 5 IU P.P.D',
    'Injected Intradermally',
    '48Hrs.',
    'NO INDURATION SEEN',
    '5 mm or more is positive',
    '10 mm or more is positive',
    '15 mm or more is positive',
    'CHEST X-RAY NORMAL',
  ])
    assert.ok(seed.includes(range), `missing report text or range: ${range}`);

  assert.match(seed, /id: "blood-sugar-fasting"[\s\S]*?referenceRange: \{ min: 60, max: 100 \}/);
  assert.match(seed, /id: "electrolyte-calcium"[\s\S]*?referenceRange: \{ min: 8\.5, max: 11 \}/);
  assert.match(seed, /id: "albumin"[\s\S]*?referenceRange: \{ min: 3\.5, max: 5 \}/);
  assert.match(seed, /id: "chest-hilar-lymph-nodes"[\s\S]*?referenceRange: \{ text: "Prominent" \}/);
  assert.match(parameterHelp, /"mantoux-interpretation-notes"/);
  assert.match(parameterHelp, /"chest-impression"/);
});
