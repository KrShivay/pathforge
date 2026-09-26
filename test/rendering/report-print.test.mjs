import assert from 'node:assert/strict';
import test from 'node:test';

import { downloadReportPdf, printReportPdf } from '../../src/components/report/reportPdf.ts';
import { DEFAULT_PRINT_LAYOUT } from '../../src/components/report/printLayout.ts';

const model = {
  layout: DEFAULT_PRINT_LAYOUT,
  brand: {
    name: 'PathForge',
    tagline: 'Tagline',
    strapline: 'Strapline',
    proprietor: '',
    address: '',
    contact: '',
    hours: '',
    logoDataUrl: '',
  },
  documentTitle: 'Pathology Report',
  reportNo: 'PF-000001',
  version: 1,
  statusLabel: 'Final',
  isFinalized: true,
  draftNotice: null,
  amendmentNotice: null,
  band: [{ label: 'Patient Name', value: 'Jane Doe' }],
  resultsHeading: 'Laboratory Results',
  resultGroups: [],
  showGroupHeadings: false,
  narratives: [],
  signoff: [],
  authorisationNote: '',
  endOfReport: '— End of Report —',
  footer: { reference: 'PF-000001', disclaimer: '' },
  generatedAt: '2026-01-01, 12:00 PM',
  specimenCollectionDate: '01 Jan 2026',
  qrPayload: '',
  fileBaseName: 'PathForge_Jane_Doe_PF-000001',
  sourceCatalogVersion: 'v1',
};

function installBrowserStubs({ print, open, load = true, picker } = {}) {
  let iframe;
  let createdBlob;
  const opened = [];
  const timeoutCallbacks = new Map();
  let timeoutId = 0;
  const body = {
    appendChild(element) {
      iframe = element;
      if (load) queueMicrotask(() => iframe.onload?.());
    },
  };
  const documentStub = {
    body,
    createElement(tag) {
      if (tag === 'iframe') {
        const printWindow = {
          focus() {},
          print: print ?? (() => {}),
          addEventListener() {},
        };
        return {
          title: '',
          style: {},
          contentWindow: printWindow,
          setAttribute() {},
          remove() {},
          set src(value) {
            this._src = value;
          },
          get src() {
            return this._src;
          },
        };
      }
      return { click() {} };
    },
  };
  const windowStub = {
    URL,
    atob: globalThis.atob,
    btoa: globalThis.btoa,
    open(url, target) {
      opened.push({ url, target });
      return open ? open(url, target) : {};
    },
    setTimeout(callback) {
      timeoutId += 1;
      timeoutCallbacks.set(timeoutId, callback);
      return timeoutId;
    },
    clearTimeout(id) {
      timeoutCallbacks.delete(id);
    },
    ...(picker ? { showSaveFilePicker: picker } : {}),
  };
  const original = {
    document: globalThis.document,
    window: globalThis.window,
    createObjectURL: URL.createObjectURL,
    revokeObjectURL: URL.revokeObjectURL,
  };
  globalThis.document = documentStub;
  globalThis.window = windowStub;
  URL.createObjectURL = (blob) => {
    createdBlob = blob;
    return 'blob:report-test';
  };
  URL.revokeObjectURL = () => {};

  return {
    opened,
    timeoutCallbacks,
    get iframe() {
      return iframe;
    },
    get createdBlob() {
      return createdBlob;
    },
    restore() {
      globalThis.document = original.document;
      globalThis.window = original.window;
      URL.createObjectURL = original.createObjectURL;
      URL.revokeObjectURL = original.revokeObjectURL;
    },
  };
}

function comparablePdfBytes(bytes) {
  return Buffer.from(bytes)
    .toString('latin1')
    .replace(/\/CreationDate\s*\([^)]*\)/g, '/CreationDate (NORMALIZED)')
    .replace(/\/ID\s*\[\s*<[^>]*>\s*<[^>]*>\s*\]/g, '/ID [<NORMALIZED><NORMALIZED>]');
}

test('print and download use the same PDF bytes', async (t) => {
  const env = installBrowserStubs({
    picker: async () => ({
      createWritable: async () => ({
        write: async (bytes) => {
          env.downloadBytes = bytes;
        },
        close: async () => {},
      }),
    }),
  });
  t.after(() => env.restore());
  await printReportPdf(model);
  const printBytes = await env.createdBlob.arrayBuffer();
  await downloadReportPdf(model);
  assert.deepEqual(comparablePdfBytes(printBytes), comparablePdfBytes(env.downloadBytes));
});

test('print loads the PDF blob in an iframe and prints it', async (t) => {
  let printCalls = 0;
  const env = installBrowserStubs({
    print: () => {
      printCalls += 1;
    },
  });
  t.after(() => env.restore());
  await printReportPdf(model);
  assert.equal(env.iframe.src, 'blob:report-test');
  assert.equal(env.createdBlob.type, 'application/pdf');
  assert.equal(printCalls, 1);
  assert.deepEqual(env.opened, []);
});

test('print falls back to opening the PDF when iframe printing throws', async (t) => {
  const env = installBrowserStubs({
    print: () => {
      throw new Error('print failed');
    },
  });
  t.after(() => env.restore());
  await printReportPdf(model);
  assert.deepEqual(env.opened, [{ url: 'blob:report-test', target: '_blank' }]);
});

test('print reports an actionable error when iframe and PDF viewer fail', async (t) => {
  const env = installBrowserStubs({
    print: () => {
      throw new Error('print failed');
    },
    open: () => null,
  });
  t.after(() => env.restore());
  await assert.rejects(
    printReportPdf(model),
    /Printing is not available here — use Download PDF and print the saved file\./,
  );
});
