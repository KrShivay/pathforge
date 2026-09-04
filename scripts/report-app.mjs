#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { assertValidReport } from '../src/domain/index.mjs';
import { buildPrototypeDocumentConfig, buildReportDocumentModel } from '../src/rendering/index.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** @type {Readonly<Record<string, string>>} */
const SAMPLES = Object.freeze({
  initial: resolve(ROOT, 'docs/fixtures/report-initial.json'),
  amended: resolve(ROOT, 'docs/fixtures/report-amended.json'),
});
const MAX_BODY_BYTES = 1024 * 1024;

class RequestBodyTooLargeError extends Error {}

/** @param {import('node:http').IncomingMessage} request */
async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new RequestBodyTooLargeError('Report data must be smaller than 1 MB.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

/** @param {import('node:http').ServerResponse} response @param {number} status @param {string} body @param {string} type */
function send(response, status, body, type) {
  response.writeHead(status, {
    'content-type': type,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(body);
}

/** @param {import('node:http').ServerResponse} response @param {number} status @param {unknown} value */
function sendJson(response, status, value) {
  send(response, status, JSON.stringify(value), 'application/json; charset=utf-8');
}

export function createReportApp() {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    try {
      if (request.method === 'GET' && url.pathname === '/') {
        send(response, 200, APP_HTML, 'text/html; charset=utf-8');
        return;
      }
      if (request.method === 'GET' && url.pathname === '/health') {
        sendJson(response, 200, { status: 'ok' });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/sample') {
        const name = url.searchParams.get('name') ?? 'initial';
        if (!Object.hasOwn(SAMPLES, name)) {
          sendJson(response, 404, { error: 'Unknown sample. Use initial or amended.' });
          return;
        }
        const samplePath = SAMPLES[name];
        if (samplePath === undefined) throw new Error('Sample path is unavailable.');
        send(response, 200, await readFile(samplePath, 'utf8'), 'application/json; charset=utf-8');
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/report-model') {
        const report = await readJsonBody(request);
        assertValidReport(report, 'report input');
        const config = buildPrototypeDocumentConfig(report);
        sendJson(response, 200, buildReportDocumentModel(report, config));
        return;
      }
      sendJson(response, 404, { error: 'Not found' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(response, error instanceof RequestBodyTooLargeError ? 413 : 400, { error: message });
    }
  });
}

/** @param {string[]} argv */
function parseArguments(argv) {
  /** @type {{host: string, port: number, help?: boolean}} */
  const options = { host: '127.0.0.1', port: Number(process.env.PORT ?? 4173) };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--host' || argument === '--port') {
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`${argument} requires a value`);
      index += 1;
      if (argument === '--host') options.host = value;
      else options.port = Number(value);
    } else if (argument === '--help' || argument === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535) {
    throw new Error('--port must be an integer from 0 to 65535');
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log('Usage: node scripts/report-app.mjs [--host HOST] [--port PORT]');
    return;
  }
  const server = createReportApp();
  server.listen(options.port, options.host, () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : options.port;
    console.log(`PathForge report prototype: http://${options.host}:${port}`);
  });
}

const APP_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PathForge report prototype</title>
<style>
:root{color-scheme:light;--ink:#17212b;--muted:#617080;--line:#cfd8df;--brand:#176b68;--paper:#fff;--wash:#edf3f2}*{box-sizing:border-box}body{margin:0;background:#dfe7e8;color:var(--ink);font:15px/1.45 system-ui,sans-serif}.shell{display:grid;grid-template-columns:minmax(320px,420px) minmax(600px,1fr);gap:20px;max-width:1500px;margin:auto;padding:20px}.controls,.report{background:var(--paper);border:1px solid var(--line);box-shadow:0 8px 25px #31424f1f}.controls{padding:22px;align-self:start;position:sticky;top:20px}.controls h1{font-size:24px;margin:0}.hint,.status{color:var(--muted)}.toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}button,.file-label{border:0;border-radius:7px;padding:10px 13px;background:var(--brand);color:white;font-weight:650;cursor:pointer}button.secondary,.file-label{background:#e4eeec;color:#174e4c}button:disabled{opacity:.45;cursor:not-allowed}input[type=file]{position:absolute;inline-size:1px;block-size:1px;opacity:0}textarea{width:100%;min-height:52vh;resize:vertical;border:1px solid var(--line);border-radius:7px;padding:12px;font:12px/1.5 ui-monospace,monospace}.status.error{color:#a32121;white-space:pre-wrap}.report{width:min(210mm,100%);min-height:297mm;margin:0 auto;padding:17mm 16mm}.report-header{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid var(--brand);padding-bottom:15px}.brand{font-size:25px;font-weight:800;color:var(--brand)}.report-meta{text-align:right}.report-meta strong{display:block}.section-title{font-size:16px;text-transform:uppercase;letter-spacing:.08em;margin:28px 0 8px;color:var(--brand)}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{text-align:left;padding:9px 7px;border-bottom:1px solid var(--line);vertical-align:top;overflow-wrap:anywhere}th{font-size:11px;text-transform:uppercase;color:var(--muted);background:var(--wash)}th:nth-child(1){width:35%}th:nth-child(2){width:17%}th:nth-child(3){width:14%}th:nth-child(4){width:22%}th:nth-child(5){width:12%}td:nth-child(2),td:nth-child(3),td:nth-child(5){white-space:nowrap}.flag-high,.flag-low{font-weight:750;color:#a32121}.empty{display:grid;place-items:center;min-height:250mm;color:var(--muted);text-align:center;padding:30px}@media(max-width:1000px){.shell{grid-template-columns:1fr}.controls{position:static}.report{min-height:auto}}@page{size:A4;margin:14mm}@media print{body{background:white}.shell{display:block;max-width:none;padding:0}.controls{display:none}.report{border:0;box-shadow:none;width:auto;min-height:0;margin:0;padding:0}.section-title{break-after:avoid}tr{break-inside:avoid}.report-header{break-after:avoid}}
</style>
</head>
<body><main class="shell"><section class="controls"><h1>PathForge</h1><p class="hint">Load report JSON, preview it, then print or save it as PDF.</p><div class="toolbar"><button id="initial" class="secondary">Initial sample</button><button id="amended" class="secondary">Amended sample</button><label class="file-label" for="file">Open JSON</label><input id="file" type="file" accept="application/json,.json"></div><textarea id="input" spellcheck="false" aria-label="Report JSON"></textarea><div class="toolbar"><button id="preview">Generate preview</button><button id="print" disabled>Print / Save PDF</button></div><p id="status" class="status" role="status"></p></section><section id="report" class="report empty"><p>Generate a preview to see the report.</p></section></main>
<script type="module">
const byId=id=>document.getElementById(id);const input=byId('input'),status=byId('status'),report=byId('report'),printButton=byId('print');
const text=(tag,value,className)=>{const node=document.createElement(tag);node.textContent=value;if(className)node.className=className;return node};
function displayValue(value){if(value===undefined||value===null)return '';if(typeof value==='object'){const low=value.low===undefined?'':value.low;const high=value.high===undefined?'':value.high;if(low!==''||high!=='')return low!==''&&high!==''?low+' - '+high:low!==''?'>= '+low:'<= '+high;return JSON.stringify(value)}return String(value)}
function fieldLabel(fieldId){const parts=fieldId.split('.');const words=parts[0]==='interpretation'?[...parts.slice(1),'interpretation']:parts;const label=words.join(' ').replaceAll('_',' ');return label.charAt(0).toUpperCase()+label.slice(1)}
function render(model){report.className='report';report.replaceChildren();const header=text('header','', 'report-header');const identity=text('div','');identity.append(text('div','PathForge','brand'),text('div','Clinical Pathology Report','hint'));const meta=text('div','', 'report-meta');meta.append(text('strong','Report '+model.report_version.report_id+' / V'+model.report_version.version),text('span','Issue '+model.issue.number+' · '+model.issue.date));header.append(identity,meta);report.append(header);for(const section of model.sections){report.append(text('h2',section.heading??section.semantic_role,'section-title'));const table=document.createElement('table'),head=document.createElement('thead'),headRow=document.createElement('tr');for(const label of ['Test','Result','Unit','Reference','Flag'])headRow.append(text('th',label));head.append(headRow);const body=document.createElement('tbody');for(const field of section.fields){const content=field.content,row=document.createElement('tr');const hasValue=Object.hasOwn(content,'value');const label=hasValue?content.display:fieldLabel(field.field_id);const value=hasValue?content.value:content.display;row.append(text('td',displayValue(label)),text('td',displayValue(value)),text('td',displayValue(content.unit)),text('td',displayValue(content.reference_range)),text('td',displayValue(content.flag),content.flag?'flag-'+String(content.flag).toLowerCase():''));body.append(row)}table.append(head,body);report.append(table)}printButton.disabled=false}
async function loadSample(name){const response=await fetch('/api/sample?name='+name);if(!response.ok)throw new Error((await response.json()).error);input.value=JSON.stringify(await response.json(),null,2);await preview()}
async function preview(){try{status.className='status';status.textContent='Validating…';const value=JSON.parse(input.value);const response=await fetch('/api/report-model',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)});const body=await response.json();if(!response.ok)throw new Error(body.error);render(body);status.textContent='Preview ready.'}catch(error){printButton.disabled=true;status.className='status error';status.textContent=error.message}}
byId('initial').onclick=()=>loadSample('initial').catch(showError);byId('amended').onclick=()=>loadSample('amended').catch(showError);byId('preview').onclick=preview;byId('print').onclick=()=>window.print();byId('file').onchange=async event=>{const file=event.target.files?.[0];if(file){input.value=await file.text();await preview()}};function showError(error){status.className='status error';status.textContent=error.message}loadSample('initial').catch(showError);
</script></body></html>`;

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectRun)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
