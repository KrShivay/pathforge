import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterHistoryReports,
  filterWorklistReports,
  historyEventDate,
  parseDate,
  formatDate,
} from '../../src/lib/reportFilters.mjs';

test('parseDate safely handles empty and ISO date strings', () => {
  assert.equal(parseDate(null), null);
  assert.equal(parseDate(''), null);

  const d1 = parseDate('2026-09-12');
  assert.ok(d1);
  assert.equal(d1.getFullYear(), 2026);
  assert.equal(d1.getMonth(), 8); // September is 8
  assert.equal(d1.getDate(), 12);
});

test('formatDate safely formats local dates', () => {
  assert.equal(formatDate(null), '—');
  const formatted = formatDate('2026-09-12');
  // the exact output depends on system locale but it should not throw and be a string
  assert.ok(typeof formatted === 'string');
  assert.notEqual(formatted, '—');
});

test('filterWorklistReports filters by status', () => {
  const reports = [
    { id: '1', status: 'draft', createdAt: '2026-09-10' },
    { id: '2', status: 'finalized', createdAt: '2026-09-11' },
  ];
  const patients = [];

  const drafts = filterWorklistReports(reports, patients, { status: 'draft' });
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].id, '1');

  const finalized = filterWorklistReports(reports, patients, { status: 'finalized' });
  assert.equal(finalized.length, 1);
  assert.equal(finalized[0].id, '2');
});

test('filterWorklistReports searches across patient and report details', () => {
  const reports = [
    { id: 'R1', patientId: 'P1', status: 'draft', createdAt: '2026-09-10', testName: 'CBC', specimens: ['Blood'] },
    {
      id: 'R2',
      patientId: 'P2',
      status: 'finalized',
      createdAt: '2026-09-11',
      testName: 'Lipid Panel',
      specimens: ['Serum'],
    },
  ];
  const patients = [
    { id: 'P1', name: 'John Doe', patientId: 'PT-100' },
    { id: 'P2', name: 'Jane Smith', patientId: 'PT-200' },
  ];

  const searchJohn = filterWorklistReports(reports, patients, { search: 'john' });
  assert.equal(searchJohn.length, 1);
  assert.equal(searchJohn[0].id, 'R1');

  const searchSerum = filterWorklistReports(reports, patients, { search: 'serum' });
  assert.equal(searchSerum.length, 1);
  assert.equal(searchSerum[0].id, 'R2');
});

test('Version History uses amendment, then finalization, then creation as its event date', () => {
  const reports = [
    { id: 'created', status: 'draft', createdAt: '2026-09-01', specimens: [] },
    { id: 'finalized', status: 'finalized', createdAt: '2026-09-01', finalizedAt: '2026-09-04', specimens: [] },
    {
      id: 'amended',
      status: 'finalized',
      createdAt: '2026-09-01',
      finalizedAt: '2026-09-04',
      amendedAt: '2026-09-08',
      specimens: [],
    },
  ];
  assert.equal(historyEventDate(reports[2]), '2026-09-08');
  assert.deepEqual(
    filterHistoryReports(reports, [], { from: '2026-09-04', to: '2026-09-04' }).map((report) => report.id),
    ['finalized'],
  );
  assert.deepEqual(
    filterHistoryReports(reports, [], { sort: 'newest' }).map((report) => report.id),
    ['amended', 'finalized', 'created'],
  );
});
