import assert from 'node:assert/strict';
import test from 'node:test';

import { buildReportPdf } from '../../src/components/report/reportPdf.ts';

/** @type {import('../../src/components/report/reportModel.ts').ReportModel} */
function baseModel(overrides = {}) {
  return {
    brand: { name: 'PathForge', tagline: 'Tagline', strapline: 'Strapline', address: '', contact: '', logoDataUrl: '' },
    documentTitle: 'Pathology Report',
    reportNo: 'PF-000001',
    version: 1,
    statusLabel: 'Final',
    isFinalized: true,
    draftNotice: null,
    band: [
      { label: 'Patient Name', value: 'Jane Doe' },
      { label: 'Patient ID', value: 'PF-20260101-001' },
    ],
    resultsHeading: 'Laboratory Results',
    resultGroups: [],
    showGroupHeadings: false,
    narratives: [],
    signoff: [
      { role: 'Performed & reported by', note: 'PathForge Clinical Pathology Workspace' },
      { role: 'Verified & authorised by', note: 'Electronically verified' },
    ],
    authorisationNote: 'Authorised.',
    endOfReport: '— End of Report —',
    footer: { reference: 'PathForge · PF-000001', disclaimer: 'Disclaimer' },
    generatedAt: '2026-01-01, 12:00 PM',
    specimenCollectionDate: '01 Jan 2026',
    qrPayload: '{"type":"pathforge-report","reportNo":"PF-000001"}',
    fileBaseName: 'PathForge_Jane_Doe_PF-000001',
    sourceCatalogVersion: 'v1',
    ...overrides,
  };
}

/** Renders the PDF and returns its raw (uncompressed) byte content as latin1 text. */
async function renderPdfText(model) {
  const doc = await buildReportPdf(model);
  const bytes = Buffer.from(doc.output('arraybuffer'));
  return bytes.toString('latin1');
}

test('PDF does not truncate a long patient/specimen band value to its first wrapped line', async () => {
  const longSpecimen = 'Left breast core biopsy, ultrasound-guided, three cores, site marked with clip';
  const model = baseModel({
    band: [
      { label: 'Patient Name', value: 'Jane Doe' },
      { label: 'Specimen', value: longSpecimen },
    ],
  });

  const pdfText = await renderPdfText(model);

  // The tail of the wrapped value must survive into the PDF stream, not just
  // the words that fit on the first line.
  assert.match(pdfText, /site marked with clip/);
});

test('PDF does not truncate a long reference-range note to its first wrapped line', async () => {
  const longReference = 'Negative; if positive, repeat in two weeks and correlate clinically';
  const model = baseModel({
    resultGroups: [
      {
        key: 'group-1',
        testName: 'Urinalysis',
        rows: [
          {
            key: 'protein',
            name: 'Protein',
            value: 'Trace',
            numeric: false,
            unit: '—',
            reference: longReference,
            flag: 'none',
            flagLabel: '',
          },
        ],
      },
    ],
  });

  const pdfText = await renderPdfText(model);

  // Wrapped lines are drawn as separate Tj/T* operators, so check the final
  // wrapped line's word survives rather than the whole phrase as one string.
  assert.match(pdfText, /\(clinically\) Tj/);
});

test('PDF omits invalid legacy logo data instead of reserving logo space', async () => {
  const pdfText = await renderPdfText(
    baseModel({
      brand: { name: 'PathForge', tagline: 'Tagline', strapline: 'Strapline', logoDataUrl: 'not-an-image' },
    }),
  );

  assert.equal((pdfText.match(/\/Subtype \/Image/g) ?? []).length, 1);
});

test('PDF embeds a valid uploaded logo data URL', async () => {
  const onePixelPng =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const pdfText = await renderPdfText(
    baseModel({
      brand: { name: 'PathForge', tagline: 'Tagline', strapline: 'Strapline', logoDataUrl: onePixelPng },
    }),
  );

  assert.ok((pdfText.match(/\/Subtype \/Image/g) ?? []).length >= 2);
});
