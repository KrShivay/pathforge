import assert from 'node:assert/strict';
import test from 'node:test';

import { buildReportPdf } from '../../src/components/report/reportPdf.ts';

/** @type {import('../../src/components/report/reportModel.ts').ReportModel} */
function baseModel(overrides = {}) {
  return {
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

  // The letterhead carries no QR, so a rejected logo leaves no image at all.
  assert.equal((pdfText.match(/\/Subtype \/Image/g) ?? []).length, 0);
});

test('PDF embeds a valid uploaded logo data URL', async () => {
  const onePixelPng =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const pdfText = await renderPdfText(
    baseModel({
      brand: { name: 'PathForge', tagline: 'Tagline', strapline: 'Strapline', logoDataUrl: onePixelPng },
    }),
  );

  assert.ok((pdfText.match(/\/Subtype \/Image/g) ?? []).length >= 1);
});

test('PDF prints optional laboratory details only once the profile carries them', async () => {
  const blank = await renderPdfText(baseModel());
  assert.doesNotMatch(blank, /Prop\./);
  assert.doesNotMatch(blank, /Mon-Sat/);

  const filled = await renderPdfText(
    baseModel({
      brand: {
        name: 'Adarsh Diagnostics Center',
        tagline: 'Clinical Pathology Report',
        strapline: 'Reg. No. ETW/ALO/0002/05',
        proprietor: 'Prop. Kapil Kumar Porwal',
        address: 'Collectry Road, Dibiyapur, Auraiya, India',
        contact: '+91 99999 00000',
        hours: 'Mon-Sat, 8 AM - 8 PM',
        logoDataUrl: '',
      },
    }),
  );

  for (const expected of [
    /Prop\. Kapil Kumar Porwal/,
    /Reg\. No\. ETW\/ALO\/0002\/05/,
    /Collectry Road, Dibiyapur, Auraiya, India/,
    /Mon-Sat, 8 AM - 8 PM/,
  ]) {
    assert.match(filled, expected);
  }
});

test('PDF draws the laboratory logo at its own aspect ratio', async () => {
  // A 2:1 box with a 1:1 image must stay 1:1 on the page — the letterhead
  // scales the logo into its box instead of stretching it to fill one.
  const squarePng =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const pdfText = await renderPdfText(
    // Draft, so the only image drawn is the letterhead logo — a finalized
    // report also stamps a centred watermark (covered by its own test below).
    baseModel({
      isFinalized: false,
      brand: {
        name: 'Lab',
        tagline: 'T',
        strapline: 'S',
        proprietor: '',
        address: '',
        contact: '',
        hours: '',
        logoDataUrl: squarePng,
      },
    }),
  );

  const drawn = [...pdfText.matchAll(/q\s+([\d.]+) 0 0 ([\d.]+) [\d.]+ [\d.]+ cm/g)].map(
    ([, width, height]) => Number(width) / Number(height),
  );

  assert.equal(drawn.length, 1, 'the letterhead draws exactly one image');
  assert.ok(Math.abs(drawn[0] - 1) < 0.01, `expected a square logo to stay square, drew ${drawn[0]}`);
});

test('finalized PDF stamps a faint logo watermark, drafts do not', async () => {
  const squarePng =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const brand = {
    name: 'Lab',
    tagline: 'T',
    strapline: 'S',
    proprietor: '',
    address: '',
    contact: '',
    hours: '',
    logoDataUrl: squarePng,
  };

  const countImages = (text) => [...text.matchAll(/q\s+[\d.]+ 0 0 [\d.]+ [\d.]+ [\d.]+ cm/g)].length;

  const finalText = await renderPdfText(baseModel({ isFinalized: true, brand }));
  const draftText = await renderPdfText(baseModel({ isFinalized: false, brand }));

  // Letterhead only for a draft; letterhead + watermark once finalized.
  assert.equal(countImages(draftText), 1, 'a draft draws only the letterhead logo');
  assert.equal(countImages(finalText), 2, 'a finalized report adds the logo watermark');
  // The watermark is drawn at reduced opacity via an ExtGState.
  assert.match(finalText, /\/ca 0\.06/, 'watermark uses ~6% opacity');
});
