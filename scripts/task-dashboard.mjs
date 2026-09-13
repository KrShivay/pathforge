#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DATA_FILE = resolve(ROOT, 'docs/tasks/tasks.json');
const DEFAULT_TASK_STATUSES = ['todo', 'in_progress', 'blocked', 'done'];

export async function loadTaskBoard(file = DEFAULT_DATA_FILE) {
  let board;
  try {
    board = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read task data at ${file}: ${error.message}`);
  }

  board = normalizeTaskBoard(board);
  const errors = validateTaskBoard(board);
  if (errors.length > 0) {
    throw new Error(`Invalid task data:\n- ${errors.join('\n- ')}`);
  }
  return board;
}

export function normalizeTaskBoard(board) {
  if (!board || typeof board !== 'object' || Array.isArray(board)) return board;
  const tasks = Array.isArray(board.tasks)
    ? board.tasks.map((task) => ({
        ...task,
        phase: task.phase ?? task.area,
        acceptance: task.acceptance ?? task.acceptanceCriteria,
      }))
    : board.tasks;
  const unique = (field) => [...new Set((tasks ?? []).map((task) => task?.[field]).filter(Boolean))];
  return {
    ...board,
    schemaVersion: board.schemaVersion ?? board.version,
    updatedAt: board.updatedAt ?? null,
    statuses: board.statuses ?? DEFAULT_TASK_STATUSES,
    phases: board.phases ?? board.areas ?? unique('phase'),
    tasks,
  };
}

export function validateTaskBoard(board) {
  const errors = [];
  if (!board || typeof board !== 'object' || Array.isArray(board)) {
    return ['root must be an object'];
  }
  if (board.schemaVersion === undefined) errors.push('schemaVersion is required');
  if (!Array.isArray(board.statuses)) errors.push('statuses must be an array');
  if (!Array.isArray(board.phases)) errors.push('phases must be an array');
  if (!Array.isArray(board.tasks)) return [...errors, 'tasks must be an array'];

  const definitionIds = (definitions) =>
    new Set((definitions ?? []).map((item) => (typeof item === 'string' ? item : item?.id)).filter(Boolean));
  const statuses = definitionIds(board.statuses);
  const phases = definitionIds(board.phases);

  const ids = new Set();
  board.tasks.forEach((task, index) => {
    const at = `tasks[${index}]`;
    if (!task || typeof task !== 'object' || Array.isArray(task)) {
      errors.push(`${at} must be an object`);
      return;
    }
    for (const field of ['id', 'title', 'phase', 'status', 'priority']) {
      if (typeof task[field] !== 'string' || task[field].trim() === '')
        errors.push(`${at}.${field} must be a non-empty string`);
    }
    if (typeof task.id === 'string') {
      if (ids.has(task.id)) errors.push(`${at}.id duplicates ${task.id}`);
      ids.add(task.id);
    }
    if (!Array.isArray(task.dependsOn)) errors.push(`${at}.dependsOn must be an array`);
    if (!Array.isArray(task.acceptance)) errors.push(`${at}.acceptance must be an array`);
    if (Array.isArray(task.dependsOn) && task.dependsOn.some((item) => typeof item !== 'string'))
      errors.push(`${at}.dependsOn must contain only task IDs`);
    if (
      Array.isArray(task.acceptance) &&
      task.acceptance.some((item) => typeof item !== 'string' || item.trim() === '')
    )
      errors.push(`${at}.acceptance must contain non-empty strings`);
    if (typeof task.status === 'string' && statuses.size > 0 && !statuses.has(task.status))
      errors.push(`${at}.status is not declared in statuses`);
    if (typeof task.phase === 'string' && phases.size > 0 && !phases.has(task.phase))
      errors.push(`${at}.phase is not declared in phases`);
  });

  board.tasks.forEach((task, index) => {
    if (!Array.isArray(task?.dependsOn)) return;
    for (const dependency of task.dependsOn) {
      if (!ids.has(dependency)) errors.push(`tasks[${index}].dependsOn references unknown task ${dependency}`);
      if (dependency === task.id) errors.push(`tasks[${index}] cannot depend on itself`);
    }
  });

  const tasksById = new Map(board.tasks.filter((task) => typeof task?.id === 'string').map((task) => [task.id, task]));
  const visiting = new Set();
  const visited = new Set();
  function visit(id, path) {
    if (visiting.has(id)) {
      errors.push(`dependency cycle detected: ${[...path, id].join(' -> ')}`);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of tasksById.get(id)?.dependsOn ?? []) {
      if (tasksById.has(dependency)) visit(dependency, [...path, id]);
    }
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of tasksById.keys()) visit(id, []);
  return errors;
}

export function summarizeTasks(tasks) {
  const countBy = (field) =>
    tasks.reduce((counts, task) => {
      counts[task[field]] = (counts[task[field]] ?? 0) + 1;
      return counts;
    }, {});
  const done = tasks.filter((task) => task.status === 'done').length;
  return {
    total: tasks.length,
    done,
    remaining: tasks.length - done,
    percentComplete: tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100),
    byStatus: countBy('status'),
    byPhase: countBy('phase'),
    byPriority: countBy('priority'),
  };
}

export function createTaskServer({ dataFile = DEFAULT_DATA_FILE } = {}) {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    try {
      if (request.method === 'GET' && url.pathname === '/') {
        send(response, 200, DASHBOARD_HTML, 'text/html; charset=utf-8');
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/tasks') {
        const board = await loadTaskBoard(dataFile);
        send(
          response,
          200,
          JSON.stringify({ ...board, summary: summarizeTasks(board.tasks) }),
          'application/json; charset=utf-8',
        );
        return;
      }
      if (request.method === 'GET' && url.pathname === '/health') {
        await loadTaskBoard(dataFile);
        send(response, 200, JSON.stringify({ status: 'ok' }), 'application/json; charset=utf-8');
        return;
      }
      send(response, 404, JSON.stringify({ error: 'Not found' }), 'application/json; charset=utf-8');
    } catch (error) {
      send(response, 500, JSON.stringify({ error: error.message }), 'application/json; charset=utf-8');
    }
  });
}

function send(response, status, body, contentType) {
  response.writeHead(status, {
    'content-type': contentType,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(body);
}

function parseArguments(argv) {
  const options = {
    host: '127.0.0.1',
    port: Number(process.env.PORT ?? 4173),
    dataFile: DEFAULT_DATA_FILE,
    check: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--check') options.check = true;
    else if (argument === '--help' || argument === '-h') options.help = true;
    else if (argument === '--host') options.host = argv[++index];
    else if (argument === '--port') options.port = Number(argv[++index]);
    else if (argument === '--data') options.dataFile = resolve(argv[++index]);
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535)
    throw new Error('--port must be an integer from 0 to 65535');
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log('Usage: node scripts/task-dashboard.mjs [--check] [--data FILE] [--host HOST] [--port PORT]');
    return;
  }
  const board = await loadTaskBoard(options.dataFile);
  if (options.check) {
    const summary = summarizeTasks(board.tasks);
    console.log(`Task data valid: ${summary.total} tasks, ${summary.done} done, ${summary.remaining} remaining.`);
    return;
  }
  const server = createTaskServer({ dataFile: options.dataFile });
  server.listen(options.port, options.host, () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : options.port;
    console.log(`PathForge task dashboard: http://${options.host}:${port}`);
    console.log(`Data: ${options.dataFile}`);
  });
}

const DASHBOARD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PathForge tasks</title>
<style>
:root{color-scheme:dark;--bg:#0b1020;--panel:#151c31;--soft:#222c48;--text:#eef2ff;--muted:#9ca9c7;--accent:#67e8b5;--warn:#fbbf70;--line:#2d3857}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top left,#182548,var(--bg) 42%);color:var(--text);font:15px/1.5 system-ui,sans-serif;min-height:100vh}main{max-width:1200px;margin:auto;padding:38px 24px}h1{font-size:clamp(28px,5vw,48px);margin:0}.kicker,.meta{color:var(--muted)}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:12px;margin:28px 0}.card,.task,.details{background:color-mix(in srgb,var(--panel) 92%,transparent);border:1px solid var(--line);border-radius:14px}.card{padding:18px}.card strong{display:block;font-size:27px;color:var(--accent)}.progress{height:8px;background:var(--soft);border-radius:9px;overflow:hidden}.progress i{display:block;height:100%;background:var(--accent)}.toolbar{display:grid;grid-template-columns:2fr repeat(2,1fr);gap:10px;margin-bottom:18px}input,select{width:100%;padding:11px 12px;border-radius:9px;border:1px solid var(--line);background:var(--panel);color:var(--text)}.layout{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(300px,1fr);gap:18px}.tasks{display:grid;gap:9px}.task{padding:14px;cursor:pointer;text-align:left;color:inherit;width:100%}.task:hover,.task[aria-current=true]{border-color:var(--accent);transform:translateY(-1px)}.task-top{display:flex;justify-content:space-between;gap:12px}.badge{font-size:12px;border-radius:99px;padding:3px 8px;background:var(--soft);white-space:nowrap}.details{padding:22px;position:sticky;top:20px;align-self:start}.details h2{margin-top:4px}.details ul{padding-left:19px}.empty{color:var(--muted);padding:30px;text-align:center;border:1px dashed var(--line);border-radius:14px}.error{color:#fecaca;background:#431b25;padding:16px;border-radius:10px}@media(max-width:760px){.toolbar,.layout{grid-template-columns:1fr}.details{position:static}}
</style>
</head><body><main>
<div class="kicker">PATHFORGE / DELIVERY</div><h1>Task dashboard</h1><p id="updated" class="meta">Loading task data…</p>
<section class="stats" id="stats"></section>
<section class="toolbar"><input id="search" type="search" placeholder="Search ID, title, or notes"><select id="status"><option value="">All statuses</option></select><select id="phase"><option value="">All phases</option></select></section>
<div class="layout"><section class="tasks" id="tasks"></section><aside class="details" id="details"><p class="meta">Select a task to see its details.</p></aside></div>
</main><script type="module">
const state={board:null,selected:null};const el=id=>document.getElementById(id);const text=(tag,value,cls)=>{const node=document.createElement(tag);node.textContent=value;if(cls)node.className=cls;return node};
function option(value){const node=text('option',value);node.value=value;return node}
function renderStats(summary){const label=value=>value.replaceAll('_',' ');const cards=[['Total',summary.total],['Remaining',summary.remaining],['Progress',summary.percentComplete+'%'],...Object.entries(summary.byStatus).map(([status,count])=>[label(status),count])];el('stats').replaceChildren(...cards.map(([name,value])=>{const c=text('article','', 'card');c.append(text('span',name),text('strong',value));if(name==='Progress'){const p=text('div','','progress');const i=document.createElement('i');i.style.width=summary.percentComplete+'%';p.append(i);c.append(p)}return c}))}
function renderDetails(task){const box=el('details');box.replaceChildren();if(!task){box.append(text('p','Select a task to see its details.','meta'));return}box.append(text('div',task.id+' · '+task.priority,'kicker'),text('h2',task.title),text('p','Status: '+task.status+' · Phase: '+task.phase));const deps=task.dependsOn.length?task.dependsOn.join(', '):'None';box.append(text('p','Depends on: '+deps));box.append(text('h3','Acceptance criteria'));const list=document.createElement('ul');for(const item of task.acceptance)list.append(text('li',item));box.append(list);if(task.notes)box.append(text('h3','Notes'),text('p',task.notes))}
function renderTasks(){const query=el('search').value.trim().toLowerCase(),status=el('status').value,phase=el('phase').value;const tasks=state.board.tasks.filter(t=>(!status||t.status===status)&&(!phase||t.phase===phase)&&(!query||[t.id,t.title,t.notes].some(v=>String(v??'').toLowerCase().includes(query))));const box=el('tasks');box.replaceChildren();if(!tasks.length){box.append(text('div','No tasks match these filters.','empty'));return}for(const task of tasks){const button=text('button','','task');button.type='button';button.setAttribute('aria-current',String(state.selected?.id===task.id));const top=text('div','','task-top');top.append(text('strong',task.id+' — '+task.title),text('span',task.status,'badge'));button.append(top,text('div',task.phase+' · '+task.priority,'meta'));button.onclick=()=>{state.selected=task;renderDetails(task);renderTasks()};box.append(button)}}
async function init(){try{const response=await fetch('/api/tasks');const body=await response.json();if(!response.ok)throw new Error(body.error);state.board=body;el('updated').textContent=(body.updatedAt?'Updated '+body.updatedAt:'Update date not recorded')+' · schema '+body.schemaVersion;renderStats(body.summary);for(const status of body.statuses)el('status').append(option(typeof status==='string'?status:status.id));for(const phase of body.phases)el('phase').append(option(typeof phase==='string'?phase:phase.id));renderTasks()}catch(error){el('tasks').replaceChildren(text('div',error.message,'error'))}}
for(const id of ['search','status','phase'])el(id).addEventListener('input',renderTasks);init();
</script></body></html>`;

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectRun)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
