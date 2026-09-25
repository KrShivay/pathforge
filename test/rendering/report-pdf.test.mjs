import assert from 'node:assert/strict';
import test from 'node:test';

import { buildReportPdf } from '../../src/components/report/reportPdf.ts';
import { DEFAULT_PRINT_LAYOUT, REPORT_TYPE_SCALE_PT, pxToMm } from '../../src/components/report/printLayout.ts';
import { buildReportModel } from '../../src/components/report/reportModel.ts';
import { DEFAULT_LABORATORY_PROFILE } from '../../src/store/branding.ts';

/** @type {import('../../src/components/report/reportModel.ts').ReportModel} */
function baseModel(overrides = {}) {
  return {
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

const PT_TO_MM = 25.4 / 72;
const PAGE_H_PT = 841.89;

function unescapePdfString(value) {
  return value
    .replace(/\\([()\\])/g, '$1')
    .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)));
}

/** Parse the uncompressed jsPDF page streams into text, font, rectangle, and rule records. */
function parsePdf(pdf) {
  const objects = new Map([...pdf.matchAll(/(\d+) 0 obj([\s\S]*?)endobj/g)].map(([, id, body]) => [Number(id), body]));
  const streams = new Map(
    [...objects].flatMap(([id, body]) => {
      const match = body.match(/stream\r?\n([\s\S]*?)\r?\nendstream/);
      return match ? [[id, match[1]]] : [];
    }),
  );
  const pages = [...objects.values()]
    .filter((body) => /\/Type \/Page(?:\s|\n)/.test(body))
    .map((body) => {
      const contentId = Number(body.match(/\/Contents\s+(\d+)\s+0\s+R/)?.[1]);
      const stream = streams.get(contentId) ?? '';
      const texts = [];
      let fontSize = 0;
      let leading = 0;
      let x = 0;
      let y = 0;
      const token =
        /\/F\d+\s+([\d.]+)\s+Tf|([\d.]+)\s+TL|([+-]?[\d.]+)\s+([+-]?[\d.]+)\s+Td|T\*\s*\(((?:\\.|[^\\)])*)\)\s*Tj|\(((?:\\.|[^\\)])*)\)\s*Tj/g;
      for (const match of stream.matchAll(token)) {
        if (match[1]) fontSize = Number(match[1]);
        else if (match[2]) leading = Number(match[2]);
        else if (match[3]) {
          x = Number(match[3]);
          y = Number(match[4]);
        } else if (match[5]) {
          y -= leading;
          texts.push({ text: unescapePdfString(match[5]), x, y, fontSize });
        } else if (match[6]) {
          texts.push({ text: unescapePdfString(match[6]), x, y, fontSize });
        }
      }
      const rectangles = [
        ...stream.matchAll(/([+-]?[\d.]+)\s+([+-]?[\d.]+)\s+([+-]?[\d.]+)\s+([+-]?[\d.]+)\s+re/g),
      ].map(([, x, y, w, h]) => ({
        x: Number(x),
        y: Number(y),
        w: Number(w),
        h: Number(h),
      }));
      const rules = [
        ...stream.matchAll(/([+-]?[\d.]+)\s+([+-]?[\d.]+)\s+m\s+([+-]?[\d.]+)\s+([+-]?[\d.]+)\s+l\s+S/g),
      ].map(([, x1, y1, x2, y2]) => ({
        x1: Number(x1),
        y1: Number(y1),
        x2: Number(x2),
        y2: Number(y2),
      }));
      return { stream, texts, rectangles, rules };
    });
  return pages;
}

function textValue(pages) {
  return pages.flatMap((page) => page.texts.map(({ text }) => text)).join('\n');
}

function textTopMm(item) {
  // With jsPDF's verified `baseline: "top"`, the glyph top is close to the
  // supplied point; Helvetica's upper extent is conservatively 0.8 em.
  return (PAGE_H_PT - item.y - item.fontSize * 0.8) * PT_TO_MM;
}

function rectTopMm(rect) {
  return (PAGE_H_PT - rect.y) * PT_TO_MM;
}

function lineTopMm(line) {
  return (PAGE_H_PT - line.y1) * PT_TO_MM;
}

async function assertPdfOperationsStayInContent(pages, margins, label) {
  const left = margins.left;
  const right = 210 - margins.right;
  const bottom = 297 - margins.bottom;
  const { jsPDF } = await import('jspdf');
  const measure = new jsPDF({ unit: 'mm', format: 'a4' });
  for (const [pageIndex, page] of pages.entries()) {
    for (const item of page.texts) {
      const top = textTopMm(item);
      if (top >= bottom - 0.02) continue; // footer text is deliberately inside the bottom margin
      assert.ok(
        top >= margins.top - 0.1,
        `${label}: page ${pageIndex + 1} text starts below top margin: ${item.text.slice(0, 40)} (${top})`,
      );
      assert.ok(
        top + item.fontSize * 1.3 * PT_TO_MM <= bottom + 0.2,
        `${label}: page ${pageIndex + 1} text crosses content bottom: ${item.text.slice(0, 40)}`,
      );
      const x = item.x * PT_TO_MM;
      measure.setFont('helvetica', 'normal').setFontSize(item.fontSize);
      const normalWidth = measure.getTextWidth(item.text);
      measure.setFont('helvetica', 'bold');
      const boldWidth = measure.getTextWidth(item.text);
      measure.setFont('helvetica', 'italic');
      const width = Math.max(normalWidth, boldWidth, measure.getTextWidth(item.text));
      const isRightAligned = x >= right - 0.2;
      const textLeft = isRightAligned ? x - width : x;
      const textRight = isRightAligned ? x : x + width;
      assert.ok(
        textLeft >= left - 0.1 && textRight <= right + 0.2,
        `${label}: text crosses horizontal content bounds: ${item.text.slice(0, 40)} (${textLeft}–${textRight})`,
      );
    }
    for (const rect of page.rectangles) {
      const x = rect.x * PT_TO_MM;
      const rectRight = (rect.x + rect.w) * PT_TO_MM;
      const top = rectTopMm(rect);
      const rectBottom = top + Math.abs(rect.h) * PT_TO_MM;
      assert.ok(x >= left - 0.1 && rectRight <= right + 0.1, `${label}: rectangle crosses horizontal content bounds`);
      assert.ok(
        top >= margins.top - 0.1 && rectBottom <= bottom + 0.1,
        `${label}: rectangle crosses vertical content bounds`,
      );
    }
    for (const rule of page.rules) {
      const top = lineTopMm(rule);
      if (top >= bottom - 0.02) continue; // footer rule
      assert.ok(Math.min(rule.x1, rule.x2) * PT_TO_MM >= left - 0.1, `${label}: rule starts left of content`);
      assert.ok(Math.max(rule.x1, rule.x2) * PT_TO_MM <= right + 0.1, `${label}: rule ends right of content`);
      assert.ok(top >= margins.top - 0.1 && top <= bottom + 0.1, `${label}: rule is outside vertical content bounds`);
    }
  }
}

test('oversized PDF items paginate without clipping content or dropping clinical text', async () => {
  const marginsList = [
    { top: 60, right: 40, bottom: 60, left: 40 },
    { top: 16, right: 16, bottom: 16, left: 16 },
  ];
  const longBandTail = 'BAND_VALUE_DISTINCTIVE_TAIL';
  const rowTail = 'RESULT_NAME_DISTINCTIVE_TAIL';
  const noticeTail = 'DRAFT_NOTICE_DISTINCTIVE_TAIL';
  const signoffTail = 'SIGNOFF_NOTE_DISTINCTIVE_TAIL';
  const cases = [
    {
      name: '60 patient-band entries',
      model: (layout) =>
        baseModel({
          layout,
          band: Array.from({ length: 60 }, (_, i) => ({
            label: `Band ${i}`,
            value:
              i === 59
                ? `Value 59 ${'clinical detail '.repeat(6)} BAND_59_TAIL`
                : `Value ${i} ${'clinical detail '.repeat(6)}`,
          })),
        }),
      tail: 'BAND_59_TAIL',
      chars: 60 * 100,
    },
    {
      name: '3000-character unbroken band value',
      model: (layout) =>
        baseModel({ layout, band: [{ label: 'Patient Name', value: `${'Y'.repeat(3000)}${longBandTail}` }] }),
      tail: 'DISTINCTIVE_TAIL',
      chars: 3050,
    },
    {
      name: '2000-word result row name',
      model: (layout) =>
        baseModel({
          layout,
          resultGroups: [
            {
              key: 'g',
              testName: 'Results',
              rows: [
                {
                  key: 'r',
                  name: `${'word '.repeat(2000)}${rowTail}`,
                  value: '1',
                  numeric: true,
                  unit: 'u',
                  reference: 'ref',
                  flag: '',
                  flagLabel: '',
                },
              ],
            },
          ],
        }),
      tail: rowTail,
      chars: 11000,
    },
    {
      name: 'long draft notice',
      model: (layout) => baseModel({ layout, draftNotice: `${'draft notice text '.repeat(1500)}${noticeTail}` }),
      tail: noticeTail,
      chars: 27050,
    },
    {
      name: 'long amendment notice',
      model: (layout) =>
        baseModel({ layout, amendmentNotice: `${'amendment notice text '.repeat(1500)}${noticeTail}` }),
      tail: noticeTail,
      chars: 33050,
    },
    {
      name: 'long sign-off note',
      model: (layout) =>
        baseModel({ layout, signoff: [{ role: 'Authorised by', note: `${'note '.repeat(3000)}${signoffTail}` }] }),
      tail: signoffTail,
      chars: 15050,
    },
  ];

  for (const marginsMm of marginsList) {
    const layout = { showLetterhead: true, marginsMm };
    const available = 297 - marginsMm.top - marginsMm.bottom;
    for (const item of cases) {
      const pages = parsePdf(await renderPdfText(item.model(layout)));
      const content = textValue(pages);
      assert.ok(content.includes(item.tail), `${item.name} tail survives at margins ${JSON.stringify(marginsMm)}`);
      assert.ok(
        pages.length <= Math.ceil(item.chars / 2000) + 2,
        `${item.name} has bounded pagination: ${pages.length} pages for ${available} mm content height`,
      );
      await assertPdfOperationsStayInContent(pages, marginsMm, item.name);
    }
  }
});

test('PDF does not truncate a long patient/specimen band value to its first wrapped line', async () => {
  const longSpecimen = 'Left breast core biopsy, ultrasound-guided, three cores, site marked with clip';
  const model = baseModel({
    band: [
      { label: 'Patient Name', value: 'Jane Doe' },
      { label: 'Specimen', value: longSpecimen },
    ],
  });

  const pages = parsePdf(await renderPdfText(model));

  // The tail of the wrapped value must survive into the PDF stream, not just
  // the words that fit on the first line.
  assert.match(textValue(pages), /site\nmarked with clip/);
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

  const pages = parsePdf(await renderPdfText(model));

  // Wrapped lines are drawn as separate Tj/T* operators, so check the final
  // wrapped line's word survives rather than the whole phrase as one string.
  assert.match(textValue(pages), /clinically/);
});

test('long narratives start with the preceding content and continue without an orphan heading', async () => {
  const priorContent = `${'Prior section content. '.repeat(240)}PRIOR CONTENT END`;
  const longBody = `NARRATIVE START ${'Continuation material. '.repeat(680)}`;
  const pages = parsePdf(
    await renderPdfText(
      baseModel({
        layout: { showLetterhead: false, marginsMm: { top: 16, right: 16, bottom: 16, left: 16 } },
        narratives: [
          { heading: 'Prior Section', body: priorContent, emphasis: false },
          { heading: 'Long Narrative', body: longBody, emphasis: false },
        ],
      }),
    ),
  );

  const startPageIndex = pages.findIndex((page) => page.texts.some(({ text }) => text === 'LONG NARRATIVE'));
  assert.notEqual(startPageIndex, -1, 'narrative heading is present');
  const startPage = pages[startPageIndex];
  assert.ok(startPage.texts.some(({ text }) => text.includes('PRIOR CONTENT END')));
  assert.ok(startPage.texts.some(({ text }) => text.includes('NARRATIVE START')));
  assert.ok(
    pages
      .slice(startPageIndex + 1)
      .some((page) => page.texts.some(({ text }) => text.includes('Continuation material.'))),
    'long narrative continues on a following page',
  );

  for (const page of pages) {
    for (const [index, item] of page.texts.entries()) {
      if (item.text !== 'LONG NARRATIVE') continue;
      assert.ok(
        page.texts
          .slice(index + 1)
          .some(({ text }) => text.includes('NARRATIVE START') || text.includes('Continuation material.')),
        'narrative heading has body text on the same page',
      );
    }
  }
});

test('PDF table cell lines stay inside their columns with default and maximum margins', async () => {
  const { jsPDF } = await import('jspdf');
  const testCells = [
    { marker: 'PARAMETERX', value: 'PARAMETERX '.repeat(12) },
    { marker: 'RESULTX', value: 'RESULTX '.repeat(8) },
    { marker: 'UNITX', value: 'UNITX '.repeat(7) },
    { marker: 'REFERENCEX', value: 'REFERENCEX '.repeat(12) },
  ];

  for (const horizontalMargin of [16, 40]) {
    const contentWidth = 210 - horizontalMargin * 2;
    const columnWidths = [0.38, 0.17, 0.13, 0.24, 0.08].map((portion) => contentWidth * portion);
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pages = parsePdf(
      await renderPdfText(
        baseModel({
          layout: {
            showLetterhead: false,
            marginsMm: { top: 16, right: horizontalMargin, bottom: 16, left: horizontalMargin },
          },
          resultGroups: [
            {
              key: 'unique-table-group',
              testName: 'Unique table group',
              rows: [
                {
                  key: 'unique-long-row',
                  name: testCells[0].value,
                  value: testCells[1].value,
                  numeric: false,
                  unit: testCells[2].value,
                  reference: testCells[3].value,
                  flag: 'H',
                  flagLabel: 'High',
                },
              ],
            },
          ],
        }),
      ),
    );
    const rowLines = pages
      .flatMap((page) => page.texts)
      .filter(({ text }) => /(?:PARAMETERX|RESULTX|UNITX|REFERENCEX)/.test(text) || text === 'H');
    assert.ok(rowLines.length > testCells.length, 'long row wraps to multiple drawn lines');

    for (const item of rowLines) {
      const columnIndex = item.text === 'H' ? 4 : testCells.findIndex(({ marker }) => item.text.includes(marker));
      assert.notEqual(columnIndex, -1, `recognized row cell line: ${item.text}`);
      const availableWidth = columnWidths[columnIndex] - (columnIndex === 4 ? 0 : 1.5);
      doc.setFont('helvetica', 'normal').setFontSize(REPORT_TYPE_SCALE_PT.table);
      const normalWidth = doc.getTextWidth(item.text);
      doc.setFont('helvetica', 'bold').setFontSize(REPORT_TYPE_SCALE_PT.table);
      const boldWidth = doc.getTextWidth(item.text);
      assert.ok(
        Math.max(normalWidth, boldWidth) <= availableWidth + 0.01,
        `${item.text} is ${Math.max(normalWidth, boldWidth).toFixed(2)}mm, column permits ${availableWidth.toFixed(2)}mm`,
      );
    }

    const headers = ['PARAMETER', 'RESULT', 'UNIT', 'REFERENCE RANGE', 'FLAG'];
    for (const page of pages) {
      for (const item of page.texts.filter(({ text }) => headers.includes(text))) {
        const columnIndex = headers.indexOf(item.text);
        const availableWidth = columnWidths[columnIndex] - (columnIndex === 4 ? 0 : 1.5);
        doc.setFont('helvetica', 'bold').setFontSize(REPORT_TYPE_SCALE_PT.tableHeader);
        assert.ok(
          doc.getTextWidth(item.text) <= availableWidth + 0.01,
          `header ${item.text} exceeds ${availableWidth.toFixed(2)}mm`,
        );
      }
    }
  }
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

test('default laboratory letterhead text stays clear of the title and metadata at supported margins', async () => {
  const { jsPDF } = await import('jspdf');
  for (const horizontalMargin of [40, 30, 16]) {
    const model = buildReportModel({
      patientName: 'Jane Doe',
      patientCode: 'P-100',
      reportId: 'R-100',
      version: 1,
      isFinalized: false,
      laboratoryProfile: {
        ...DEFAULT_LABORATORY_PROFILE,
        printLayout: {
          showLetterhead: true,
          marginsMm: {
            top: 16,
            right: horizontalMargin,
            bottom: 16,
            left: horizontalMargin,
          },
        },
      },
      content: {
        specimens: ['Whole Blood'],
        referringClinician: '',
        clinicalHistory: '',
        findings: '',
        diagnosis: '',
        interpretation: '',
        testResults: [],
      },
    });
    const page = parsePdf(await renderPdfText(model))[0];
    const firstRuleTop = Math.min(...page.rules.map(lineTopMm));
    const letterheadTexts = page.texts.filter((item) => textTopMm(item) < firstRuleTop);
    const contentMidpoint = 105;
    const brandTexts = letterheadTexts.filter((item) => item.x * PT_TO_MM < contentMidpoint);
    const titleMetaTexts = letterheadTexts.filter((item) => item.x * PT_TO_MM >= contentMidpoint);
    const measure = (item) => {
      const font = new jsPDF({ unit: 'mm', format: 'a4' }).setFont('helvetica', 'bold').setFontSize(item.fontSize);
      const x = item.x * PT_TO_MM;
      return { left: x, right: x + font.getTextWidth(item.text) };
    };

    assert.ok(brandTexts.length > 0, 'brand and laboratory details are present');
    assert.ok(titleMetaTexts.length > 0, 'title and metadata are present');
    for (const brand of brandTexts) {
      const brandY = textTopMm(brand);
      const brandBottom = brandY + brand.fontSize * 0.8 * PT_TO_MM;
      const brandX = measure(brand);
      for (const titleMeta of titleMetaTexts) {
        const titleMetaY = textTopMm(titleMeta);
        const titleMetaBottom = titleMetaY + titleMeta.fontSize * 0.8 * PT_TO_MM;
        if (brandY >= titleMetaBottom || titleMetaY >= brandBottom) continue;
        const titleMetaX = measure(titleMeta);
        assert.ok(
          brandX.right <= titleMetaX.left + 0.01 || titleMetaX.right <= brandX.left + 0.01,
          `letterhead text '${brand.text}' intersects '${titleMeta.text}' at ${horizontalMargin} mm margins`,
        );
      }
    }
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

test('default layout keeps the letterhead, top glyphs, footer, and report type scale in bounds', async () => {
  const pdf = await renderPdfText(
    baseModel({
      resultGroups: [
        {
          key: 'g',
          testName: 'Chemistry',
          rows: [
            {
              key: 'r',
              name: 'Glucose',
              value: '5.2',
              numeric: true,
              unit: 'mmol/L',
              reference: '3.9–6.1',
              flag: 'none',
              flagLabel: '',
            },
          ],
        },
      ],
      narratives: [{ heading: 'Interpretation', body: 'Within expected limits.', emphasis: false }],
    }),
  );
  const pages = parsePdf(pdf);
  const allText = textValue(pages);
  assert.match(allText, /PathForge/);
  assert.match(allText, /TAGLINE/);
  assert.match(allText, /PATHOLOGY REPORT/);
  assert.ok(Math.min(...pages[0].texts.map(textTopMm)) >= 15.5);

  const footerRule = pages[0].rules.find(
    (rule) =>
      Math.abs(rule.x1 * PT_TO_MM - 16) < 0.1 &&
      Math.abs(rule.x2 * PT_TO_MM - 194) < 0.1 &&
      Math.abs(rule.y1 - rule.y2) < 0.1 &&
      lineTopMm(rule) > 280,
  );
  assert.ok(footerRule, 'footer rule spans the default content width');
  const footerLineH = REPORT_TYPE_SCALE_PT.footer * PT_TO_MM * 1.3;
  const expectedFooterRuleY = 297 - 16 + (16 - footerLineH - 1.5) / 2;
  assert.ok(Math.abs(lineTopMm(footerRule) - expectedFooterRuleY) < 0.2);
  const footer = pages[0].texts.find((item) => item.text === 'Page 1 of 1');
  assert.ok(footer);
  const footerTop = textTopMm(footer);
  assert.ok(footerTop > 281 && footerTop < 297, `footer glyph top ${footerTop}mm stays in the bottom margin`);
  const contentFontSizes = pages
    .flatMap((page) => page.texts)
    .filter(
      ({ text }) =>
        !['PathForge', 'TAGLINE', 'PATHOLOGY REPORT', 'LABORATORY RESULTS', 'INTERPRETATION'].includes(text),
    )
    .map(({ fontSize }) => fontSize);
  assert.ok(contentFontSizes.every((size) => size >= 6 && size <= 7.5));
  assert.equal(REPORT_TYPE_SCALE_PT.body, 7.5);
});

test('footer block stays inside the page and below the content bottom for tall bottom margins', async () => {
  for (const bottom of [10, 16, 60]) {
    const pages = parsePdf(
      await renderPdfText(
        baseModel({
          layout: { showLetterhead: false, marginsMm: { top: 16, right: 16, bottom, left: 16 } },
        }),
      ),
    );
    const contentBottom = 297 - bottom;
    for (const page of pages) {
      const footerRule = page.rules.find(
        (rule) =>
          Math.abs(rule.x1 * PT_TO_MM - 16) < 0.1 &&
          Math.abs(rule.x2 * PT_TO_MM - 194) < 0.1 &&
          lineTopMm(rule) > contentBottom,
      );
      const footerItems = page.texts.filter(
        ({ text }) => text.startsWith('PathForge ·') || text.startsWith('Report date ') || text.startsWith('Page '),
      );
      assert.ok(footerRule);
      assert.ok(lineTopMm(footerRule) > contentBottom, 'footer rule is below the content bottom');
      assert.equal(footerItems.length, 3);
      for (const item of footerItems) {
        const glyphTop = textTopMm(item);
        const glyphBottom = glyphTop + item.fontSize * 0.8 * PT_TO_MM;
        assert.ok(glyphTop >= 0, `${item.text} begins on the page`);
        assert.ok(297 - glyphBottom >= 3, `${item.text} stays at least 3 mm from the paper edge`);
      }
    }
  }
});

test('hidden letterhead starts the patient band at the configured top and retains clinical content', async () => {
  const pages = parsePdf(
    await renderPdfText(
      baseModel({
        layout: { showLetterhead: false, marginsMm: { ...DEFAULT_PRINT_LAYOUT.marginsMm } },
        brand: {
          name: 'HiddenLabName',
          tagline: 'HiddenTagline',
          strapline: '',
          proprietor: '',
          address: '',
          contact: '',
          hours: '',
          logoDataUrl: '',
        },
        band: [
          { label: 'Patient Name', value: 'Jane Doe' },
          { label: 'Patient ID', value: 'PF-20260101-001' },
        ],
        resultGroups: [
          {
            key: 'g',
            testName: 'Chemistry',
            rows: [
              {
                key: 'r',
                name: 'Glucose',
                value: '5.2',
                numeric: true,
                unit: 'mmol/L',
                reference: '3.9–6.1',
                flag: 'none',
                flagLabel: '',
              },
            ],
          },
        ],
        narratives: [{ heading: 'Diagnosis', body: 'No abnormality detected.', emphasis: true }],
      }),
    ),
  );
  const allText = textValue(pages);
  assert.doesNotMatch(allText, /HiddenLabName|HIDDENTAGLINE|PATHOLOGY REPORT/);
  assert.match(allText, /Jane Doe/);
  assert.match(allText, /PF-20260101-001/);
  assert.match(allText, /Glucose/);
  assert.match(allText, /No abnormality detected/);
  assert.ok(Math.abs(rectTopMm(pages[0].rectangles[0]) - 16) < 0.2);
});

test('120 CSS px top margin maps to the exact hidden-letterhead PDF band position', async () => {
  const top = pxToMm(120);
  const pages = parsePdf(
    await renderPdfText(
      baseModel({
        layout: { showLetterhead: false, marginsMm: { ...DEFAULT_PRINT_LAYOUT.marginsMm, top } },
      }),
    ),
  );
  assert.ok(Math.abs(rectTopMm(pages[0].rectangles[0]) - 31.75) < 0.2);
});

test('120 CSS px survives profile normalization through the report model into the PDF', async () => {
  const model = buildReportModel({
    patientName: 'Jane Doe',
    patientCode: 'P-100',
    reportId: 'R-100',
    version: 1,
    isFinalized: false,
    laboratoryProfile: {
      ...DEFAULT_LABORATORY_PROFILE,
      printLayout: {
        showLetterhead: false,
        marginsMm: { ...DEFAULT_PRINT_LAYOUT.marginsMm, top: pxToMm(120) },
      },
    },
    content: {
      specimens: ['Whole Blood'],
      referringClinician: '',
      clinicalHistory: '',
      findings: '',
      diagnosis: '',
      interpretation: '',
      testResults: [],
    },
  });

  assert.equal(model.layout.marginsMm.top, 31.75);
  const pages = parsePdf(await renderPdfText(model));
  assert.ok(Math.abs(rectTopMm(pages[0].rectangles[0]) - 31.75) <= 0.05);
});

test('hidden-letterhead draft and amendment notices begin at the top margin', async () => {
  for (const override of [{ draftNotice: 'Draft content notice.' }, { amendmentNotice: 'Amendment content notice.' }]) {
    const pages = parsePdf(
      await renderPdfText(
        baseModel({
          layout: { showLetterhead: false, marginsMm: { ...DEFAULT_PRINT_LAYOUT.marginsMm } },
          ...override,
        }),
      ),
    );
    assert.ok(Math.abs(rectTopMm(pages[0].rectangles[0]) - 16) < 0.2);
  }
});

test('independent margins constrain text, content, footer, and right alignment', async () => {
  const margins = { top: 30, right: 12, bottom: 25, left: 20 };
  const pages = parsePdf(
    await renderPdfText(
      baseModel({
        layout: { showLetterhead: false, marginsMm: margins },
        resultGroups: [
          {
            key: 'g',
            testName: 'Chemistry',
            rows: [
              {
                key: 'r',
                name: 'Glucose',
                value: '5.2',
                numeric: true,
                unit: 'mmol/L',
                reference: '3.9–6.1',
                flag: 'none',
                flagLabel: '',
              },
            ],
          },
        ],
      }),
    ),
  );
  const footerTexts = new Set(['PathForge · PF-000001', 'Report date 2026-01-01, 12:00 PM', 'Page 1 of 1']);
  for (const page of pages) {
    for (const item of page.texts) {
      const xMm = item.x * PT_TO_MM;
      assert.ok(xMm >= margins.left - 0.1, `${item.text} begins at ${xMm}mm`);
      const conservativeWidth = item.text.length * item.fontSize * PT_TO_MM * 0.45;
      assert.ok(xMm + conservativeWidth <= 210 - margins.right + 1.5, `${item.text} ends within right margin`);
      if (!footerTexts.has(item.text)) {
        const anchorTop = (PAGE_H_PT - item.y) * PT_TO_MM;
        assert.ok(anchorTop <= 297 - margins.bottom + 1, `${item.text} stays above the content bottom`);
      }
    }
    for (const rect of page.rectangles) {
      assert.ok(rect.x * PT_TO_MM >= margins.left - 0.1);
      assert.ok((rect.x + rect.w) * PT_TO_MM <= 210 - margins.right + 0.1);
      assert.ok(rectTopMm(rect) <= 297 - margins.bottom + 0.1);
    }
  }
  const footerRule = pages[0].rules.find(
    (rule) =>
      Math.abs(rule.x1 * PT_TO_MM - margins.left) < 0.1 && Math.abs(rule.y1 - rule.y2) < 0.1 && lineTopMm(rule) > 272,
  );
  assert.ok(footerRule);
  const footerLineH = REPORT_TYPE_SCALE_PT.footer * PT_TO_MM * 1.3;
  const expectedFooterRuleY = 297 - margins.bottom + (margins.bottom - footerLineH - 1.5) / 2;
  assert.ok(Math.abs(lineTopMm(footerRule) - expectedFooterRuleY) < 0.2);
});

test('zero top, left, and right margins with the minimum bottom margin produce an on-page PDF', async () => {
  const marginsMm = { top: 0, left: 0, right: 0, bottom: 10 };
  const pages = parsePdf(
    await renderPdfText(
      baseModel({
        layout: { showLetterhead: false, marginsMm },
      }),
    ),
  );
  assert.equal(pages.length, 1);
  for (const item of pages[0].texts) {
    assert.ok(item.x >= -0.1);
    assert.ok(item.x <= 210 / PT_TO_MM);
    const anchorTop = (PAGE_H_PT - item.y) * PT_TO_MM;
    assert.ok(anchorTop >= -0.1 && anchorTop <= 297.1);
  }
  assert.ok(Math.abs(rectTopMm(pages[0].rectangles[0])) < 0.2);
});

test('maximum margins paginate long results without splitting rows or orphaning section headings', async () => {
  const rows = Array.from({ length: 72 }, (_, index) => ({
    key: `row-${index}`,
    name: `ANALYTE_${index.toString().padStart(3, '0')} extended descriptive name for result ${index}`,
    value: `${(index + 1) / 7}`,
    numeric: true,
    unit: 'micromoles per litre',
    reference: `Reference ${index}: expected interval 2.5 to 8.5 depending on age, collection conditions, and clinical context`,
    flag: 'none',
    flagLabel: '',
  }));
  const marginsMm = { top: 60, right: 40, bottom: 60, left: 40 };
  const pages = parsePdf(
    await renderPdfText(
      baseModel({
        layout: { showLetterhead: false, marginsMm },
        resultGroups: [{ key: 'long', testName: 'Comprehensive chemistry panel', rows }],
        showGroupHeadings: true,
        narratives: [{ heading: 'Clinical interpretation', body: 'Clinical details '.repeat(180), emphasis: true }],
      }),
    ),
  );
  assert.ok(pages.length >= 2, 'the long report spans pages');
  for (const [index, page] of pages.entries()) {
    const pageText = page.texts.map((item) => item.text).join('\n');
    assert.match(pageText, new RegExp(`Page ${index + 1} of ${pages.length}`));
    const pageHasRows = page.texts.some(({ text }) => /ANALYTE_\d{3}/.test(text));
    if (pageHasRows) assert.match(pageText, /PARAMETER/);
    for (const item of page.texts) {
      const xMm = item.x * PT_TO_MM;
      assert.ok(xMm >= marginsMm.left - 0.1, `${item.text} is inside the left content edge`);
      assert.ok(
        xMm + item.text.length * item.fontSize * PT_TO_MM * 0.45 <= 210 - marginsMm.right + 1.5,
        `${item.text} is inside the right content edge`,
      );
      const isFooter =
        item.text.startsWith('PathForge ·') || item.text.startsWith('Report date ') || item.text.startsWith('Page ');
      if (!isFooter) assert.ok((PAGE_H_PT - item.y) * PT_TO_MM <= 237 + 1, `${item.text} is above the content bottom`);
    }
    const tableHeaders = page.texts.filter(({ text }) => text === 'PARAMETER');
    if (pageHasRows) assert.ok(tableHeaders.length >= 1, `page ${index + 1} repeats the results header`);
    for (const row of rows) {
      if (page.texts.some(({ text }) => text.includes(`ANALYTE_${row.key.slice(-3)}`))) {
        assert.ok(page.texts.some(({ text }) => text.includes(`Reference ${Number(row.key.slice(-3))}:`)));
      }
    }
  }
  const rowOccurrences = new Map();
  pages.forEach((page, pageIndex) => {
    for (const item of page.texts) {
      const match = item.text.match(/ANALYTE_(\d{3})/);
      if (match) rowOccurrences.set(Number(match[1]), (rowOccurrences.get(Number(match[1])) ?? 0) + 1);
    }
    const headings = page.texts.filter(({ text }) => ['Laboratory Results', 'Clinical interpretation'].includes(text));
    for (const heading of headings) {
      const at = page.texts.indexOf(heading);
      assert.ok(page.texts[at + 1], `heading on page ${pageIndex + 1} has following content`);
      assert.doesNotMatch(page.texts[at + 1].text, /^Page /);
    }
  });
  assert.equal(rowOccurrences.size, rows.length);
  assert.ok([...rowOccurrences.values()].every((count) => count === 1));
});

test('results section heading reserves its first group heading, header, and row', async () => {
  const row = {
    key: 'r',
    name: 'Haemoglobin',
    value: '13.5',
    numeric: true,
    unit: 'g/dL',
    reference: '12-16',
    flag: '',
    flagLabel: '',
  };
  const pages = parsePdf(
    await renderPdfText(
      baseModel({
        draftNotice: 'x '.repeat(5360),
        showGroupHeadings: true,
        resultGroups: [{ key: 'g', testName: 'Complete Blood Count', rows: [row] }],
      }),
    ),
  );
  const headingPage = pages.findIndex((page) => page.texts.some(({ text }) => text === 'LABORATORY RESULTS'));
  const groupPage = pages.findIndex((page) => page.texts.some(({ text }) => text === 'Complete Blood Count'));
  assert.notEqual(headingPage, -1, 'results heading is present');
  assert.equal(groupPage, headingPage, 'the first group heading stays with the results heading');
});

test('wrapped first result row stays with its group heading and results header', async () => {
  const firstRowName = `LONG_RESULT_FIRST_ROW ${'clinical descriptor '.repeat(24)}`;
  assert.ok(firstRowName.length > 400, 'first result row is long enough to wrap to at least four lines');
  const pages = parsePdf(
    await renderPdfText(
      baseModel({
        draftNotice: 'x '.repeat(5360),
        showGroupHeadings: true,
        resultGroups: [
          {
            key: 'g',
            testName: 'Comprehensive first panel',
            rows: [
              {
                key: 'r',
                name: firstRowName,
                value: '13.5',
                numeric: true,
                unit: 'g/dL',
                reference: '12-16',
                flag: '',
                flagLabel: '',
              },
            ],
          },
        ],
      }),
    ),
  );
  const groupPage = pages.findIndex((page) => page.texts.some(({ text }) => text === 'Comprehensive first panel'));
  assert.notEqual(groupPage, -1, 'group heading is present');
  const page = pages[groupPage];
  assert.ok(
    page.texts.some(({ text }) => text === 'PARAMETER'),
    'results header is on the group page',
  );
  assert.ok(
    page.texts.some(({ text }) => text.startsWith('LONG_RESULT_FIRST_ROW')),
    'first result row starts on the group page',
  );
  const rowStartIndex = page.texts.findIndex(({ text }) => text.startsWith('LONG_RESULT_FIRST_ROW'));
  const rowStart = page.texts[rowStartIndex];
  let renderedNameLines = 0;
  for (const item of page.texts.slice(rowStartIndex)) {
    if (item.x !== rowStart.x || item.fontSize !== rowStart.fontSize) break;
    renderedNameLines += 1;
  }
  assert.ok(renderedNameLines >= 4, 'the first result name wraps to at least four rendered lines');
  if (groupPage > 0) {
    const previousPageText = pages[groupPage - 1].texts.map(({ text }) => text);
    assert.ok(!previousPageText.includes('Comprehensive first panel'), 'previous page has no orphaned group heading');
    assert.ok(!previousPageText.includes('PARAMETER'), 'previous page has no orphaned results header');
  }
});

test('continuation headers retain patient identity and omit the brand when the letterhead is hidden', async () => {
  const rows = Array.from({ length: 72 }, (_, index) => ({
    key: `r-${index}`,
    name: `Marker ${index}`,
    value: `${index}`,
    numeric: true,
    unit: 'unit',
    reference: '0–100',
    flag: 'none',
    flagLabel: '',
  }));
  const pages = parsePdf(
    await renderPdfText(
      baseModel({
        layout: { showLetterhead: false, marginsMm: { top: 60, right: 40, bottom: 60, left: 40 } },
        resultGroups: [{ key: 'g', testName: 'Panel', rows }],
      }),
    ),
  );
  assert.ok(pages.length > 1);
  const continued = pages[1].texts.map(({ text }) => text).join('\n');
  assert.match(continued, /Patient Jane Doe/);
  assert.ok(!pages[1].texts.some(({ text }) => text === 'PathForge'));
});
