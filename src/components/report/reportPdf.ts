import type { jsPDF, TextOptionsLight } from "jspdf";
import { isTauri } from "@tauri-apps/api/core";

import type { ReportModel } from "./reportModel";
import { A4_MM, MM_PER_INCH, REPORT_TYPE_SCALE_PT } from "./printLayout.ts";
import { getUsableLogoDataUrl } from "../../store/branding.ts";

const NAVY: [number, number, number] = [31, 58, 95];
const INK: [number, number, number] = [26, 26, 26];
const MUTED: [number, number, number] = [90, 102, 115];
const HAIRLINE: [number, number, number] = [200, 206, 214];
const FLAG_HIGH: [number, number, number] = [185, 28, 28];
const FLAG_LOW: [number, number, number] = [29, 78, 216];
const TABLE_COLUMN_GUTTER_MM = 1.5;

const PAGE_W = A4_MM.width;
const PAGE_H = A4_MM.height;

const lineMm = (pt: number, factor = 1.3) => (pt * MM_PER_INCH * factor) / 72;

/**
 * Render a {@link ReportModel} to a jsPDF document. Content, order and wording
 * come from the model; this function only positions and styles it — the same
 * division of labour as {@link PrintableReport} for the print DOM.
 */
export async function buildReportPdf(model: ReportModel): Promise<jsPDF> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: [A4_MM.width, A4_MM.height] });
  const { top, right, bottom, left } = model.layout.marginsMm;
  const contentLeft = left;
  const contentRight = PAGE_W - right;
  const contentWidth = contentRight - contentLeft;
  const contentBottom = PAGE_H - bottom;
  const footerLineH = lineMm(REPORT_TYPE_SCALE_PT.footer);
  const footerRuleToTextGap = 1.5;
  const footerBlockHeight = footerLineH + footerRuleToTextGap;
  const footerRuleY = contentBottom + (bottom - footerBlockHeight) / 2;
  const footerTextY = footerRuleY + footerRuleToTextGap;
  let y = top;

  const drawText = (value: string | string[], x: number, topY: number, options: TextOptionsLight = {}) => {
    // `top` is the page-edge distance to first content. Text is top-aligned so
    // no glyph rises above it; rectangles use that y coordinate exactly.
    doc.text(value, x, topY, { baseline: "top", ...options });
  };

  const continuationHeader = () => {
    const patient = model.band.find((entry) => entry.label === "Patient Name")?.value ?? "—";
    if (model.layout.showLetterhead) {
      doc.setFont("helvetica", "bold").setFontSize(REPORT_TYPE_SCALE_PT.continuation).setTextColor(...NAVY);
      drawText(model.brand.name, contentLeft, y);
    }
    doc.setFont("helvetica", "normal").setFontSize(REPORT_TYPE_SCALE_PT.continuation).setTextColor(...MUTED);
    const patientLines = doc.splitTextToSize(`Patient ${patient}`, contentWidth) as string[];
    drawText(patientLines, contentRight, y, { align: "right" });
    y += patientLines.length * lineMm(REPORT_TYPE_SCALE_PT.continuation);
    doc.setDrawColor(...HAIRLINE).setLineWidth(0.2).line(contentLeft, y, contentRight, y);
    y += lineMm(REPORT_TYPE_SCALE_PT.continuation);
  };

  const need = (h: number) => {
    if (y + h > contentBottom) {
      doc.addPage();
      y = top;
      continuationHeader();
    }
  };

  // ---- letterhead ----
  // The logo is drawn at its own aspect ratio inside a fixed box, so a portrait
  // or square mark is never squashed into a landscape strip.
  const logoDataUrl = getUsableLogoDataUrl(model.brand.logoDataUrl);
  if (model.layout.showLetterhead) {
    const LOGO_BOX_W = 26;
    const LOGO_BOX_H = 18;
    let logoWidth = 0;
    if (logoDataUrl) {
      try {
        const properties = doc.getImageProperties(logoDataUrl);
        const scale = Math.min(
          LOGO_BOX_W / properties.width,
          LOGO_BOX_H / properties.height,
        );
        const drawnW = properties.width * scale;
        const drawnH = properties.height * scale;
        doc.addImage(logoDataUrl, contentLeft, y, drawnW, drawnH);
        logoWidth = drawnW;
      } catch {
        // Invalid image data is omitted, and reserves no letterhead space.
      }
    }
    const letterheadX = contentLeft + logoWidth + (logoWidth ? 3 : 0);
    doc.setFont("helvetica", "bold").setFontSize(REPORT_TYPE_SCALE_PT.documentTitle);
    const titleWidth = doc.getTextWidth(model.documentTitle.toUpperCase());
    doc.setFont("helvetica", "normal").setFontSize(REPORT_TYPE_SCALE_PT.letterheadDetail);
    const metaLines = model.isFinalized
      ? [`Issue Date  ${model.generatedAt}`]
      : [`Report Date  ${model.generatedAt}`, "DRAFT"];
    const titleBlockWidth = Math.max(
      titleWidth,
      ...metaLines.map((line) => doc.getTextWidth(line)),
    );
    const brandColumnWidth = contentRight - titleBlockWidth - 4 - letterheadX;
    const drawBrandLines = (
      text: string,
      font: "normal" | "bold",
      size: number,
      color: [number, number, number],
    ) => {
      doc.setFont("helvetica", font).setFontSize(size).setTextColor(...color);
      const lines = doc.splitTextToSize(text, brandColumnWidth) as string[];
      drawText(lines, letterheadX, brandY);
      brandY += lines.length * lineMm(size);
    };
    let brandY = y;
    drawBrandLines(model.brand.name, "bold", REPORT_TYPE_SCALE_PT.brandName, NAVY);
    drawBrandLines(model.brand.tagline.toUpperCase(), "normal", REPORT_TYPE_SCALE_PT.letterheadDetail, MUTED);
    if (model.brand.proprietor) {
      drawBrandLines(model.brand.proprietor, "bold", REPORT_TYPE_SCALE_PT.letterheadDetail, NAVY);
    }
    drawBrandLines(model.brand.strapline, "normal", REPORT_TYPE_SCALE_PT.letterheadDetail, MUTED);

    const detailLines = [
      ...(model.brand.address ? doc.splitTextToSize(model.brand.address, brandColumnWidth) as string[] : []),
      ...(model.brand.contact ? doc.splitTextToSize(model.brand.contact, brandColumnWidth) as string[] : []),
      ...(model.brand.hours ? doc.splitTextToSize(model.brand.hours, brandColumnWidth) as string[] : []),
    ];
    if (detailLines.length > 0) {
      doc.setFont("helvetica", "bold").setFontSize(REPORT_TYPE_SCALE_PT.letterheadDetail).setTextColor(...INK);
      const addressCount = model.brand.address
        ? (doc.splitTextToSize(model.brand.address, brandColumnWidth) as string[]).length
        : 0;
      if (addressCount > 0) {
        drawText(detailLines.slice(0, addressCount), letterheadX, brandY);
        brandY += addressCount * lineMm(REPORT_TYPE_SCALE_PT.letterheadDetail);
      }
      const contactDetailLines = detailLines.slice(addressCount);
      if (contactDetailLines.length > 0) {
        doc.setFont("helvetica", "normal").setFontSize(REPORT_TYPE_SCALE_PT.letterheadDetail).setTextColor(...MUTED);
        drawText(contactDetailLines, letterheadX, brandY);
        brandY += contactDetailLines.length * lineMm(REPORT_TYPE_SCALE_PT.letterheadDetail);
      }
    }

    doc.setFont("helvetica", "bold").setFontSize(REPORT_TYPE_SCALE_PT.documentTitle).setTextColor(...NAVY);
    drawText(model.documentTitle.toUpperCase(), contentRight, y, {
      align: "right",
    });
    doc.setFont("helvetica", "normal").setFontSize(REPORT_TYPE_SCALE_PT.letterheadDetail).setTextColor(...INK);
    drawText(metaLines, contentRight, y + lineMm(REPORT_TYPE_SCALE_PT.documentTitle), { align: "right" });

    // Without the QR block the letterhead is only as tall as its text.
    const metaBlockHeight = lineMm(REPORT_TYPE_SCALE_PT.documentTitle) + metaLines.length * lineMm(REPORT_TYPE_SCALE_PT.letterheadDetail);
    y += Math.max(brandY - y, metaBlockHeight);
    doc.setDrawColor(...NAVY).setLineWidth(0.7).line(contentLeft, y, contentRight, y);
    y += lineMm(REPORT_TYPE_SCALE_PT.body);
  }

  if (model.draftNotice) {
    const lines = doc
      .setFont("helvetica", "bold")
      .setFontSize(REPORT_TYPE_SCALE_PT.notice)
      .splitTextToSize(model.draftNotice, contentWidth - 6);
    const noticeLineH = lineMm(REPORT_TYPE_SCALE_PT.notice);
    const boxH = lines.length * noticeLineH + noticeLineH;
    need(boxH);
    doc.setFillColor(255, 247, 237);
    doc.setDrawColor(194, 65, 12).setLineWidth(0.3);
    doc.rect(contentLeft, y, contentWidth, boxH, "FD");
    doc.setTextColor(154, 52, 18);
    drawText(lines, contentLeft + 3, y + noticeLineH / 2);
    y += boxH + lineMm(REPORT_TYPE_SCALE_PT.body);
  }
  if (model.amendmentNotice) {
    const lines = doc.setFont("helvetica", "bold").setFontSize(REPORT_TYPE_SCALE_PT.notice).splitTextToSize(model.amendmentNotice, contentWidth - 6);
    const noticeLineH = lineMm(REPORT_TYPE_SCALE_PT.notice);
    const boxH = lines.length * noticeLineH + noticeLineH;
    need(boxH);
    doc.setFillColor(239, 246, 255).setDrawColor(...NAVY).rect(contentLeft, y, contentWidth, boxH, "FD");
    doc.setTextColor(...NAVY);
    drawText(lines, contentLeft + 3, y + noticeLineH / 2);
    y += boxH + lineMm(REPORT_TYPE_SCALE_PT.body);
  }

  // ---- patient / specimen band ----
  // Row height adapts to the longest wrapped value in that row so long
  // patient/specimen text is never cut down to its first line (it prints in
  // full in the on-screen preview, so the PDF must match).
  const bandLabelLineH = lineMm(REPORT_TYPE_SCALE_PT.label);
  const bandValueLineH = lineMm(REPORT_TYPE_SCALE_PT.bandValue);
  const bandCellW = contentWidth / 2 - 6;
  const bandRowMinH = bandLabelLineH + bandValueLineH + 2;
  doc.setFont("helvetica", "bold").setFontSize(REPORT_TYPE_SCALE_PT.bandValue);
  const bandCells = model.band.map((entry) => ({
    entry,
    lines: doc.splitTextToSize(entry.value, bandCellW) as string[],
  }));
  const bandRows: (typeof bandCells)[number][][] = [];
  for (let i = 0; i < bandCells.length; i += 2) {
    bandRows.push(bandCells.slice(i, i + 2));
  }
  const bandRowHeights = bandRows.map((row) => {
    const maxLines = Math.max(1, ...row.map((cell) => cell.lines.length));
    return Math.max(bandRowMinH, bandLabelLineH + maxLines * bandValueLineH + 2);
  });
  const bandH = bandRowHeights.reduce((sum, h) => sum + h, 0);
  need(bandH);
  doc.setDrawColor(...HAIRLINE).setLineWidth(0.2);
  doc.rect(contentLeft, y, contentWidth, bandH);
  doc.line(contentLeft + contentWidth / 2, y, contentLeft + contentWidth / 2, y + bandH);
  let bandCy = y;
  bandRows.forEach((row, rowIndex) => {
    if (rowIndex > 0) doc.line(contentLeft, bandCy, contentRight, bandCy);
    row.forEach((cell, col) => {
      const cx = contentLeft + 3 + col * (contentWidth / 2);
      doc.setFont("helvetica", "bold").setFontSize(REPORT_TYPE_SCALE_PT.label).setTextColor(...MUTED);
      drawText(cell.entry.label.toUpperCase(), cx, bandCy + 1);
      doc.setFont("helvetica", "bold").setFontSize(REPORT_TYPE_SCALE_PT.bandValue).setTextColor(...INK);
      drawText(cell.lines, cx, bandCy + 1 + bandLabelLineH);
    });
    bandCy += bandRowHeights[rowIndex] ?? bandRowMinH;
  });
  y += bandH + lineMm(REPORT_TYPE_SCALE_PT.body);

  const sectionHeading = (title: string, firstContentHeight: number) => {
    const headingLineH = lineMm(REPORT_TYPE_SCALE_PT.sectionHeading);
    const headingHeight = headingLineH + lineMm(REPORT_TYPE_SCALE_PT.label);
    need(headingHeight + firstContentHeight);
    doc.setFont("helvetica", "bold").setFontSize(REPORT_TYPE_SCALE_PT.sectionHeading).setTextColor(...NAVY);
    drawText(title.toUpperCase(), contentLeft, y);
    y += headingLineH;
    doc.setDrawColor(...NAVY).setLineWidth(0.3).line(contentLeft, y, contentRight, y);
    y += lineMm(REPORT_TYPE_SCALE_PT.label);
  };

  const paragraph = (paragraphText: string, emphasis: boolean) => {
    doc
      .setFont("helvetica", emphasis ? "bold" : "normal")
      .setFontSize(emphasis ? REPORT_TYPE_SCALE_PT.diagnosis : REPORT_TYPE_SCALE_PT.body)
      .setTextColor(...INK);
    const paragraphLineH = lineMm(emphasis ? REPORT_TYPE_SCALE_PT.diagnosis : REPORT_TYPE_SCALE_PT.body);
    for (const line of doc.splitTextToSize(paragraphText, contentWidth)) {
      need(paragraphLineH);
      drawText(line, contentLeft, y);
      y += paragraphLineH;
    }
    y += paragraphLineH;
  };

  // ---- results, grouped by test ----
  // Fixed five-column grid shared by headers and rows. The proportions mirror
  // the printable report CSS so normal result words and the FLAG header keep
  // enough room in both PDF export paths.
  const widths = [
    contentWidth * 0.38,
    contentWidth * 0.17,
    contentWidth * 0.13,
    contentWidth * 0.24,
    contentWidth * 0.08,
  ];
  let columnX = contentLeft;
  const cols = widths.map((width) => {
    const currentX = columnX;
    columnX += width;
    return currentX;
  });

  const drawResultsHeader = () => {
    const headerLineH = lineMm(REPORT_TYPE_SCALE_PT.tableHeader);
    need(headerLineH + lineMm(REPORT_TYPE_SCALE_PT.label));
    doc.setFont("helvetica", "bold").setFontSize(REPORT_TYPE_SCALE_PT.tableHeader).setTextColor(...MUTED);
    ["PARAMETER", "RESULT", "UNIT", "REFERENCE RANGE", "FLAG"].forEach((label, i) => {
      const labelWidth = i === 4 ? (widths[i] ?? 0) : Math.max(1, (widths[i] ?? 0) - TABLE_COLUMN_GUTTER_MM);
      drawText(doc.splitTextToSize(label, labelWidth) as string[], cols[i] ?? contentLeft, y);
    });
    y += headerLineH;
    doc.setDrawColor(...NAVY).setLineWidth(0.4).line(contentLeft, y, contentRight, y);
    y += lineMm(REPORT_TYPE_SCALE_PT.label);
  };

  if (model.resultGroups.length > 0) {
    const firstGroupHeight = model.showGroupHeadings && model.resultGroups[0]?.testName
      ? lineMm(REPORT_TYPE_SCALE_PT.groupHeading)
      : 0;
    sectionHeading(
      model.resultsHeading,
      firstGroupHeight +
        lineMm(REPORT_TYPE_SCALE_PT.tableHeader) +
        lineMm(REPORT_TYPE_SCALE_PT.label) +
        lineMm(REPORT_TYPE_SCALE_PT.table),
    );

    for (const group of model.resultGroups) {
      if (model.showGroupHeadings && group.testName) {
        const groupLineH = lineMm(REPORT_TYPE_SCALE_PT.groupHeading);
        const firstRow = group.rows[0];
        let firstRowLineH = lineMm(REPORT_TYPE_SCALE_PT.table);
        if (firstRow) {
          doc.setFont("helvetica", "normal").setFontSize(REPORT_TYPE_SCALE_PT.table);
          const firstRowCells = [firstRow.name, firstRow.value, firstRow.unit, firstRow.reference, firstRow.flag].map(
            (value, index) => {
              const cellWidth = widths[index] ?? 12;
              return doc.splitTextToSize(
                value,
                index === 4 ? cellWidth : Math.max(1, cellWidth - TABLE_COLUMN_GUTTER_MM),
              );
            },
          );
          firstRowLineH *= Math.max(1, ...firstRowCells.map((lines) => lines.length));
        }
        need(
          groupLineH +
            lineMm(REPORT_TYPE_SCALE_PT.tableHeader) +
            lineMm(REPORT_TYPE_SCALE_PT.label) +
            firstRowLineH,
        );
        doc.setFont("helvetica", "bold").setFontSize(REPORT_TYPE_SCALE_PT.groupHeading).setTextColor(...INK);
        drawText(group.testName, contentLeft, y);
        y += groupLineH;
      }

      drawResultsHeader();

      for (const row of group.rows) {
        // Measure at the size actually drawn below so the
        // wrapped line count matches what's rendered.
        doc.setFont("helvetica", "normal").setFontSize(REPORT_TYPE_SCALE_PT.table);
        const cells = [row.name, row.value, row.unit, row.reference, row.flag].map((value, index) => {
          const cellWidth = widths[index] ?? 12;
          return doc.splitTextToSize(value, index === 4 ? cellWidth : Math.max(1, cellWidth - TABLE_COLUMN_GUTTER_MM));
        });
        const rowLineH = lineMm(REPORT_TYPE_SCALE_PT.table);
        const rowH = Math.max(
          rowLineH,
          ...cells.map((lines) => lines.length * rowLineH),
        );
        if (y + rowH + lineMm(REPORT_TYPE_SCALE_PT.label) > contentBottom) {
          doc.addPage();
          y = top;
          continuationHeader();
          drawResultsHeader();
        }
        doc.setFont("helvetica", "normal").setFontSize(REPORT_TYPE_SCALE_PT.table).setTextColor(...INK);
        drawText(cells[0] ?? [], cols[0] ?? contentLeft, y);
        doc.setFont("helvetica", "bold");
        drawText(cells[1] ?? [], cols[1] ?? contentLeft, y);
        doc.setFont("helvetica", "normal");
        drawText(cells[2] ?? [], cols[2] ?? contentLeft, y);
        drawText(cells[3] ?? [], cols[3] ?? contentLeft, y);
        if (row.flag) {
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...(row.flag === "H" ? FLAG_HIGH : FLAG_LOW));
          drawText(cells[4] ?? [], cols[4] ?? contentLeft, y);
          doc.setFont("helvetica", "normal").setTextColor(...INK);
        }
        y += rowH;
        doc
          .setDrawColor(...HAIRLINE)
          .setLineWidth(0.15)
          .line(contentLeft, y, contentRight, y);
        y += lineMm(REPORT_TYPE_SCALE_PT.label) / 2;
      }
      y += lineMm(REPORT_TYPE_SCALE_PT.label);
    }
  }

  for (const narrative of model.narratives) {
    const narrativeFont = narrative.emphasis ? REPORT_TYPE_SCALE_PT.diagnosis : REPORT_TYPE_SCALE_PT.body;
    doc.setFont("helvetica", narrative.emphasis ? "bold" : "normal").setFontSize(narrativeFont);
    const narrativeLines = doc.splitTextToSize(narrative.body, contentWidth);
    sectionHeading(narrative.heading, lineMm(narrativeFont) * Math.min(2, Math.max(1, narrativeLines.length)));
    paragraph(narrative.body, narrative.emphasis);
  }

  // ---- sign-off ----
  const sigGap = 8;
  const sigW = (contentWidth - sigGap) / 2;
  const signoffBlocks = model.signoff.map((entry) => {
    doc.setFont("helvetica", "bold").setFontSize(REPORT_TYPE_SCALE_PT.signoffRole);
    const roleLines = doc.splitTextToSize(entry.role, sigW) as string[];
    doc.setFont("helvetica", "normal").setFontSize(REPORT_TYPE_SCALE_PT.signoffNote);
    const noteLines = entry.note.trim() ? (doc.splitTextToSize(entry.note, sigW) as string[]) : [];
    return { entry, roleLines, noteLines };
  });
  const sigTopGap = lineMm(REPORT_TYPE_SCALE_PT.body);
  const sigRoleLineH = lineMm(REPORT_TYPE_SCALE_PT.signoffRole);
  const sigNoteLineH = lineMm(REPORT_TYPE_SCALE_PT.signoffNote);
  const sigBlocksH = Math.max(
    0,
    ...signoffBlocks.map(({ roleLines, noteLines }) => roleLines.length * sigRoleLineH + noteLines.length * sigNoteLineH),
  );
  need(sigTopGap + sigBlocksH);
  y += sigTopGap;
  signoffBlocks.forEach(({ entry, roleLines, noteLines }, i) => {
    const x = contentLeft + i * (sigW + sigGap);
    doc.setDrawColor(...INK).setLineWidth(0.2).line(x, y, x + sigW, y);
    doc.setFont("helvetica", "bold").setFontSize(REPORT_TYPE_SCALE_PT.signoffRole).setTextColor(...INK);
    drawText(roleLines, x, y);
    if (entry.note.trim()) {
      doc.setFont("helvetica", "normal").setFontSize(REPORT_TYPE_SCALE_PT.signoffNote).setTextColor(...MUTED);
      drawText(noteLines, x, y + roleLines.length * sigRoleLineH);
    }
  });
  y += sigBlocksH + lineMm(REPORT_TYPE_SCALE_PT.body);

  if (model.authorisationNote.trim()) {
    doc.setFont("helvetica", "italic").setFontSize(REPORT_TYPE_SCALE_PT.footer).setTextColor(...MUTED);
    const authLines = doc.splitTextToSize(model.authorisationNote, contentWidth) as string[];
    const authLineH = lineMm(REPORT_TYPE_SCALE_PT.footer);
    need(authLines.length * authLineH);
    drawText(authLines, contentLeft, y);
    y += authLines.length * authLineH;
  }
  need(lineMm(REPORT_TYPE_SCALE_PT.footer));
  doc.setFont("helvetica", "normal").setFontSize(REPORT_TYPE_SCALE_PT.footer).setTextColor(...MUTED);
  drawText(model.endOfReport, (contentLeft + contentRight) / 2, y, { align: "center" });

  // ---- finalized logo watermark ----
  // Once the report is issued, a faint centred logo sits behind every page,
  // mirroring the DRAFT watermark that the print DOM shows while drafting.
  let watermark: { url: string; w: number; h: number } | null = null;
  if (model.isFinalized && logoDataUrl) {
    try {
      const properties = doc.getImageProperties(logoDataUrl);
      const WATERMARK_MAX = 110; // mm, longest side
      const scale = WATERMARK_MAX / Math.max(properties.width, properties.height);
      watermark = {
        url: logoDataUrl,
        w: properties.width * scale,
        h: properties.height * scale,
      };
    } catch {
      // Invalid image data prints without a watermark.
    }
  }

  // ---- footer on every page ----
  const reportDate = model.generatedAt;
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    if (watermark) {
      const gState = new (doc as unknown as {
        GState: new (options: { opacity: number }) => unknown;
      }).GState({ opacity: 0.06 });
      doc.setGState(gState);
      doc.addImage(
        watermark.url,
        (PAGE_W - watermark.w) / 2,
        (PAGE_H - watermark.h) / 2,
        watermark.w,
        watermark.h,
      );
      doc.setGState(new (doc as unknown as {
        GState: new (options: { opacity: number }) => unknown;
      }).GState({ opacity: 1 }));
    }
    doc.setDrawColor(...HAIRLINE).setLineWidth(0.15);
    doc.line(contentLeft, footerRuleY, contentRight, footerRuleY);
    doc.setFont("helvetica", "normal").setFontSize(REPORT_TYPE_SCALE_PT.footer).setTextColor(...MUTED);
    drawText(model.footer.reference, contentLeft, footerTextY);
    drawText(`Report date ${reportDate}`, contentRight, footerTextY, {
      align: "right",
    });
    drawText(`Page ${page} of ${pages}`, (contentLeft + contentRight) / 2, footerTextY, {
      align: "center",
    });
  }

  return doc;
}

/**
 * Save the report PDF to disk, prompting for a location.
 * - Tauri: native save dialog + filesystem write.
 * - Browser with File System Access API: native "Save As" picker.
 * - Otherwise: falls back to a normal download into the Downloads folder.
 */
export async function downloadReportPdf(model: ReportModel): Promise<void> {
  const doc = await buildReportPdf(model);
  const fileName = `${model.fileBaseName}.pdf`;
  const bytes = doc.output("arraybuffer");

  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({
      defaultPath: fileName,
      filters: [{ name: "PDF document", extensions: ["pdf"] }],
    });
    if (!path) return; // user cancelled

    // Let a write failure (e.g. a path outside the fs capability scope) reach
    // the caller. Falling back to doc.save() here would be a silent no-op:
    // browser downloads cannot start inside the Tauri webview.
    await writeFile(path, new Uint8Array(bytes));
    return;
  }

  const picker = (
    window as unknown as {
      showSaveFilePicker?: (options: unknown) => Promise<{
        createWritable: () => Promise<{
          write: (data: BufferSource) => Promise<void>;
          close: () => Promise<void>;
        }>;
      }>;
    }
  ).showSaveFilePicker;

  if (typeof picker === "function") {
    try {
      const handle = await picker({
        suggestedName: fileName,
        types: [
          {
            description: "PDF document",
            accept: { "application/pdf": [".pdf"] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(bytes);
      await writable.close();
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      // fall through to plain download
    }
  }

  doc.save(fileName);
}
