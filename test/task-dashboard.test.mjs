import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createTaskServer, loadTaskBoard, normalizeTaskBoard, summarizeTasks, validateTaskBoard } from '../scripts/task-dashboard.mjs';

const board = {
  schemaVersion: 1,
  updatedAt: '2026-09-04',
  statuses: ['todo', 'doing', 'done'],
  phases: ['foundation'],
  tasks: [
    { id: 'PF-001', title: 'First', phase: 'foundation', status: 'done', priority: 'high', dependsOn: [], acceptance: ['Works'] },
    { id: 'PF-002', title: 'Second', phase: 'foundation', status: 'doing', priority: 'medium', dependsOn: ['PF-001'], acceptance: ['Tested'] },
  ],
};

test('validates task references and required fields', () => {
  assert.deepEqual(validateTaskBoard(board), []);
  const broken = structuredClone(board);
  broken.tasks[1].dependsOn = ['PF-999'];
  assert.match(validateTaskBoard(broken).join('\n'), /unknown task PF-999/);

  const cyclic = structuredClone(board);
  cyclic.tasks[0].dependsOn = ['PF-002'];
  assert.match(validateTaskBoard(cyclic).join('\n'), /dependency cycle detected/);
});

test('normalizes the compact documentation contract', () => {
  const compact = {
    version: 1,
    tasks: [{ id: 'PF-001', title: 'First', area: 'foundation', status: 'todo', priority: 'P1', dependsOn: [], acceptanceCriteria: ['Works'] }],
  };
  const normalized = normalizeTaskBoard(compact);
  assert.equal(normalized.schemaVersion, 1);
  assert.deepEqual(normalized.statuses, ['todo', 'in_progress', 'blocked', 'done']);
  assert.deepEqual(normalized.phases, ['foundation']);
  assert.deepEqual(normalized.tasks[0].acceptance, ['Works']);
});

test('rejects a status outside the compact contract', () => {
  const compact = normalizeTaskBoard({
    version: 1,
    tasks: [{ id: 'PF-001', title: 'First', area: 'foundation', status: 'started', priority: 'P1', dependsOn: [], acceptanceCriteria: ['Works'] }],
  });
  assert.match(validateTaskBoard(compact).join('\n'), /status is not declared/);
});

test('summarizes delivery progress', () => {
  assert.deepEqual(summarizeTasks(board.tasks), {
    total: 2,
    done: 1,
    remaining: 1,
    percentComplete: 50,
    byStatus: { done: 1, doing: 1 },
    byPhase: { foundation: 2 },
    byPriority: { high: 1, medium: 1 },
  });
});

test('loads the JSON contract and serves the dashboard API', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'pathforge-tasks-'));
  const dataFile = join(directory, 'tasks.json');
  await writeFile(dataFile, JSON.stringify(board));
  assert.deepEqual(await loadTaskBoard(dataFile), board);

  const server = createTaskServer({ dataFile });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(() => server.close());
  const { port } = server.address();

  const apiResponse = await fetch(`http://127.0.0.1:${port}/api/tasks`);
  assert.equal(apiResponse.status, 200);
  assert.equal((await apiResponse.json()).summary.percentComplete, 50);

  const pageResponse = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(pageResponse.status, 200);
  assert.match(await pageResponse.text(), /PathForge tasks/);
});
