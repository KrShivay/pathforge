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
  let pageContentTop = top;

  const drawText = (value: string | string[], x: number, topY: number, options: TextOptionsLight = {}) => {
    // `top` is the page-edge distance to first content. Text is top-aligned so
    // no glyph rises above it; rectangles use that y coordinate exactly.
    doc.text(value, x, topY, { baseline: "top", ...options });
  };

  const splitToSize = (value: string, width: number): string[] => {
    const lines = doc.splitTextToSize(value, width) as string[];
    return lines.flatMap((line) => {
      if (doc.getTextWidth(line) <= width) return [line];
      const pieces: string[] = [];
      let piece = "";
      for (const character of Array.from(line)) {
        if (piece && doc.getTextWidth(piece + character) > width) {
          pieces.push(piece);
          piece = character;
        } else {
          piece += character;
        }
      }
      if (piece) pieces.push(piece);
      return pieces;
    });
  };

  const continuationHeader = () => {
    const patient = model.band.find((entry) => entry.label === "Patient Name")?.value ?? "—";
    if (model.layout.showLetterhead) {
      doc.setFont("helvetica", "bold").setFontSize(REPORT_TYPE_SCALE_PT.continuation).setTextColor(...NAVY);
      drawText(model.brand.name, contentLeft, y);
    }
    doc.setFont("helvetica", "normal").setFontSize(REPORT_TYPE_SCALE_PT.continuation).setTextColor(...MUTED);
    // The continuation label is a compact duplicate; the patient band carries
    // the complete name and paginates it line by line when needed.
    const patientLines = splitToSize(`Patient ${patient}`, Math.max(1, contentWidth - 2)).slice(0, 1);
    drawText(patientLines, contentRight - 1.5, y, { align: "right" });
    y += patientLines.length * lineMm(REPORT_TYPE_SCALE_PT.continuation);
    doc.setDrawColor(...HAIRLINE).setLineWidth(0.2).line(contentLeft, y, contentRight, y);
    y += lineMm(REPORT_TYPE_SCALE_PT.continuation);
    pageContentTop = y;
  };

  const nextPage = () => {
    doc.addPage();
    y = top;
    pageContentTop = top;
    continuationHeader();
  };

  const need = (h: number) => {
    if (y + h > contentBottom) {
      nextPage();
    }
  };

  const availablePageHeight = () => contentBottom - pageContentTop;

  const drawLinesAcrossPages = (
    lines: string[],
    lineHeight: number,
    drawLine: (line: string, lineY: number) => void,
  ) => {
    let index = 0;
    while (index < lines.length) {
      if (y + lineHeight > contentBottom) nextPage();
      const capacity = Math.max(1, Math.floor((contentBottom - y + 1e-8) / lineHeight));
      const count = Math.min(lines.length - index, capacity);
      for (let offset = 0; offset < count; offset += 1) {
        drawLine(lines[index + offset] ?? "", y);
        y += lineHeight;
      }
      index += count;
      if (index < lines.length) nextPage();
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
      const lines = splitToSize(text, brandColumnWidth);
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
      ...(model.brand.address ? splitToSize(model.brand.address, brandColumnWidth) : []),
      ...(model.brand.contact ? splitToSize(model.brand.contact, brandColumnWidth) : []),
      ...(model.brand.hours ? splitToSize(model.brand.hours, brandColumnWidth) : []),
    ];
    if (detailLines.length > 0) {
      doc.setFont("helvetica", "bold").setFontSize(REPORT_TYPE_SCALE_PT.letterheadDetail).setTextColor(...INK);
      const addressCount = model.brand.address
        ? splitToSize(model.brand.address, brandColumnWidth).length
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
    drawText(model.documentTitle.toUpperCase(), contentRight - 1.5, y, {
      align: "right",
    });
    doc.setFont("helvetica", "normal").setFontSize(REPORT_TYPE_SCALE_PT.letterheadDetail).setTextColor(...INK);
    drawText(metaLines, contentRight - 1.5, y + lineMm(REPORT_TYPE_SCALE_PT.documentTitle), { align: "right" });

    // Without the QR block the letterhead is only as tall as its text.
    const metaBlockHeight = lineMm(REPORT_TYPE_SCALE_PT.documentTitle) + metaLines.length * lineMm(REPORT_TYPE_SCALE_PT.letterheadDetail);
    y += Math.max(brandY - y, metaBlockHeight);
    doc.setDrawColor(...NAVY).setLineWidth(0.7).line(contentLeft, y, contentRight, y);
    y += lineMm(REPORT_TYPE_SCALE_PT.body);
  }

  if (model.draftNotice) {
    doc.setFont("helvetica", "bold").setFontSize(REPORT_TYPE_SCALE_PT.notice);
    const lines = splitToSize(model.draftNotice, contentWidth - 6);
    const noticeLineH = lineMm(REPORT_TYPE_SCALE_PT.notice);
    let index = 0;
    while (index < lines.length) {
      const pad = noticeLineH;
      if (contentBottom - y < noticeLineH * 2) nextPage();
      const maxCount = Math.max(1, Math.floor((contentBottom - y - pad) / noticeLineH));
      const count = Math.min(lines.length - index, maxCount);
      const boxH = count * noticeLineH + pad;
      doc.setFillColor(255, 247, 237);
      doc.setDrawColor(194, 65, 12).setLineWidth(0.3);
      doc.rect(contentLeft, y, contentWidth, boxH, "FD");
      doc.setTextColor(154, 52, 18);
      drawText(lines.slice(index, index + count), contentLeft + 3, y + noticeLineH / 2);
      y += boxH;
      index += count;
      if (index < lines.length) nextPage();
    }
    y += lineMm(REPORT_TYPE_SCALE_PT.body);
  }
  if (model.amendmentNotice) {
    doc.setFont("helvetica", "bold").setFontSize(REPORT_TYPE_SCALE_PT.notice);
    const lines = splitToSize(model.amendmentNotice, contentWidth - 6);
    const noticeLineH = lineMm(REPORT_TYPE_SCALE_PT.notice);
    let index = 0;
    while (index < lines.length) {
      const pad = noticeLineH;
      if (contentBottom - y < noticeLineH * 2) nextPage();
      const maxCount = Math.max(1, Math.floor((contentBottom - y - pad) / noticeLineH));
      const count = Math.min(lines.length - index, maxCount);
      const boxH = count * noticeLineH + pad;
      doc.setFillColor(239, 246, 255).setDrawColor(...NAVY).rect(contentLeft, y, contentWidth, boxH, "FD");
      doc.setTextColor(...NAVY);
      drawText(lines.slice(index, index + count), contentLeft + 3, y + noticeLineH / 2);
      y += boxH;
      index += count;
      if (index < lines.length) nextPage();
    }
    y += lineMm(REPORT_TYPE_SCALE_PT.body);
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
    lines: splitToSize(entry.value, bandCellW),
  }));
  const bandRows: (typeof bandCells)[number][][] = [];
  for (let i = 0; i < bandCells.length; i += 2) {
    bandRows.push(bandCells.slice(i, i + 2));
  }
  const bandRowHeights = bandRows.map((row) => {
    const maxLines = Math.max(1, ...row.map((cell) => cell.lines.length));
    return Math.max(bandRowMinH, bandLabelLineH + maxLines * bandValueLineH + 2);
  });
  const drawBandRowPiece = (
    row: (typeof bandCells)[number][],
    lineStart: number,
    lineCount: number,
  ) => {
    const rowH = bandLabelLineH + lineCount * bandValueLineH + 2;
    const rowTop = y;
    doc.setDrawColor(...HAIRLINE).setLineWidth(0.2);
    doc.rect(contentLeft, rowTop, contentWidth, rowH);
    doc.line(contentLeft + contentWidth / 2, rowTop, contentLeft + contentWidth / 2, rowTop + rowH);
    row.forEach((cell, col) => {
      const cx = contentLeft + 3 + col * (contentWidth / 2);
      doc.setFont("helvetica", "bold").setFontSize(REPORT_TYPE_SCALE_PT.label).setTextColor(...MUTED);
      drawText(cell.entry.label.toUpperCase(), cx, rowTop + 1);
      doc.setFont("helvetica", "bold").setFontSize(REPORT_TYPE_SCALE_PT.bandValue).setTextColor(...INK);
      drawText(cell.lines.slice(lineStart, lineStart + lineCount), cx, rowTop + 1 + bandLabelLineH);
    });
    y += rowH;
  };
  bandRows.forEach((row, rowIndex) => {
    const maxLines = Math.max(1, ...row.map((cell) => cell.lines.length));
    const fullHeight = bandRowHeights[rowIndex] ?? bandRowMinH;
    if (fullHeight <= availablePageHeight() && y + fullHeight > contentBottom) nextPage();
    let lineStart = 0;
    while (lineStart < maxLines) {
      const room = contentBottom - y - bandLabelLineH - 2;
      if (room < bandValueLineH) nextPage();
      const lineCapacity = Math.max(1, Math.floor((contentBottom - y - bandLabelLineH - 2) / bandValueLineH));
      const count = Math.min(maxLines - lineStart, lineCapacity);
      drawBandRowPiece(row, lineStart, count);
      lineStart += count;
      if (lineStart < maxLines) nextPage();
    }
  });
  y += lineMm(REPORT_TYPE_SCALE_PT.body);

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
    for (const line of splitToSize(paragraphText, contentWidth)) {
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

  const resultRowHeight = (row: (typeof model.resultGroups)[number]["rows"][number]) => {
    doc.setFont("helvetica", "normal").setFontSize(REPORT_TYPE_SCALE_PT.table);
    const cells = [row.name, row.value, row.unit, row.reference, row.flag].map((value, index) => {
      const cellWidth = widths[index] ?? 12;
      return splitToSize(value, index === 4 ? cellWidth : Math.max(1, cellWidth - TABLE_COLUMN_GUTTER_MM));
    });
    const rowLineH = lineMm(REPORT_TYPE_SCALE_PT.table);
    const rowH = Math.max(rowLineH, ...cells.map((lines) => lines.length * rowLineH));
    return { cells, rowH, rowLineH };
  };

  const firstResultsBlockHeight = (
    group: (typeof model.resultGroups)[number] | undefined,
    prefixHeight = 0,
  ) => {
    const headerHeight = lineMm(REPORT_TYPE_SCALE_PT.tableHeader) + lineMm(REPORT_TYPE_SCALE_PT.label);
    const firstRowHeight = group?.rows[0] ? resultRowHeight(group.rows[0]).rowH : lineMm(REPORT_TYPE_SCALE_PT.table);
    return Math.min(prefixHeight + headerHeight + firstRowHeight, availablePageHeight());
  };

  const drawResultsHeader = () => {
    const headerLineH = lineMm(REPORT_TYPE_SCALE_PT.tableHeader);
    need(headerLineH + lineMm(REPORT_TYPE_SCALE_PT.label));
    doc.setFont("helvetica", "bold").setFontSize(REPORT_TYPE_SCALE_PT.tableHeader).setTextColor(...MUTED);
    ["PARAMETER", "RESULT", "UNIT", "REFERENCE RANGE", "FLAG"].forEach((label, i) => {
      const labelWidth = i === 4 ? (widths[i] ?? 0) : Math.max(1, (widths[i] ?? 0) - TABLE_COLUMN_GUTTER_MM);
      drawText(splitToSize(label, labelWidth), cols[i] ?? contentLeft, y);
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
      firstResultsBlockHeight(model.resultGroups[0], firstGroupHeight),
    );

    for (const group of model.resultGroups) {
      if (model.showGroupHeadings && group.testName) {
        const groupLineH = lineMm(REPORT_TYPE_SCALE_PT.groupHeading);
        need(firstResultsBlockHeight(group, groupLineH));
        doc.setFont("helvetica", "bold").setFontSize(REPORT_TYPE_SCALE_PT.groupHeading).setTextColor(...INK);
        drawText(group.testName, contentLeft, y);
        y += groupLineH;
      }

      drawResultsHeader();

      for (const row of group.rows) {
        // Measure at the size actually drawn below so the
        // wrapped line count matches what's rendered.
        const { cells, rowH, rowLineH } = resultRowHeight(row);
        const rowGap = lineMm(REPORT_TYPE_SCALE_PT.label) / 2;
        const moveTogetherHeight = rowH + lineMm(REPORT_TYPE_SCALE_PT.label);
        if (moveTogetherHeight <= availablePageHeight() && y + moveTogetherHeight > contentBottom) {
          nextPage();
          drawResultsHeader();
        }
        let lineStart = 0;
        const maxLines = Math.max(1, ...cells.map((lines) => lines.length));
        while (lineStart < maxLines) {
          const remaining = contentBottom - y - rowGap;
          if (remaining < rowLineH) {
            nextPage();
            drawResultsHeader();
          }
          const lineCapacity = Math.max(1, Math.floor((contentBottom - y - rowGap) / rowLineH));
          const count = Math.min(maxLines - lineStart, lineCapacity);
          const rowTop = y;
          const partHeight = count * rowLineH;
          doc.setFont("helvetica", "normal").setFontSize(REPORT_TYPE_SCALE_PT.table).setTextColor(...INK);
          drawText((cells[0] ?? []).slice(lineStart, lineStart + count), cols[0] ?? contentLeft, rowTop);
          doc.setFont("helvetica", "bold");
          drawText((cells[1] ?? []).slice(lineStart, lineStart + count), cols[1] ?? contentLeft, rowTop);
          doc.setFont("helvetica", "normal");
          drawText((cells[2] ?? []).slice(lineStart, lineStart + count), cols[2] ?? contentLeft, rowTop);
          drawText((cells[3] ?? []).slice(lineStart, lineStart + count), cols[3] ?? contentLeft, rowTop);
          if (row.flag) {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...(row.flag === "H" ? FLAG_HIGH : FLAG_LOW));
            drawText((cells[4] ?? []).slice(lineStart, lineStart + count), cols[4] ?? contentLeft, rowTop);
            doc.setFont("helvetica", "normal").setTextColor(...INK);
          }
          y += partHeight;
          doc.setDrawColor(...HAIRLINE).setLineWidth(0.15).line(contentLeft, y, contentRight, y);
          y += rowGap;
          lineStart += count;
          if (lineStart < maxLines) {
            nextPage();
            drawResultsHeader();
          }
        }
      }
      y += lineMm(REPORT_TYPE_SCALE_PT.label);
    }
  }

  for (const narrative of model.narratives) {
    const narrativeFont = narrative.emphasis ? REPORT_TYPE_SCALE_PT.diagnosis : REPORT_TYPE_SCALE_PT.body;
    doc.setFont("helvetica", narrative.emphasis ? "bold" : "normal").setFontSize(narrativeFont);
    const narrativeLines = splitToSize(narrative.body, contentWidth);
    sectionHeading(narrative.heading, lineMm(narrativeFont) * Math.min(2, Math.max(1, narrativeLines.length)));
    paragraph(narrative.body, narrative.emphasis);
  }

  // ---- sign-off ----
  const sigGap = 8;
  const sigW = (contentWidth - sigGap) / 2;
  const signoffBlocks = model.signoff.map((entry) => {
    doc.setFont("helvetica", "bold").setFontSize(REPORT_TYPE_SCALE_PT.signoffRole);
    const roleLines = splitToSize(entry.role, sigW);
    doc.setFont("helvetica", "normal").setFontSize(REPORT_TYPE_SCALE_PT.signoffNote);
    const noteLines = entry.note.trim() ? splitToSize(entry.note, sigW) : [];
    return { entry, roleLines, noteLines };
  });
  const sigTopGap = lineMm(REPORT_TYPE_SCALE_PT.body);
  const sigRoleLineH = lineMm(REPORT_TYPE_SCALE_PT.signoffRole);
  const sigNoteLineH = lineMm(REPORT_TYPE_SCALE_PT.signoffNote);
  const sigBlocksH = Math.max(
    0,
    ...signoffBlocks.map(({ roleLines, noteLines }) => roleLines.length * sigRoleLineH + noteLines.length * sigNoteLineH),
  );
  if (signoffBlocks.length > 0) {
    const wholeSignoffH = sigTopGap + sigBlocksH;
    if (wholeSignoffH <= availablePageHeight() && y + wholeSignoffH > contentBottom) nextPage();
    y += sigTopGap;
    if (wholeSignoffH <= contentBottom - y) {
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
      y += sigBlocksH;
    } else {
      const content = signoffBlocks.map(({ roleLines, noteLines }) => [
        ...roleLines.map((text) => ({ text, height: sigRoleLineH, role: true })),
        ...noteLines.map((text) => ({ text, height: sigNoteLineH, role: false })),
      ]);
      const indexes = content.map(() => 0);
      while (indexes.some((index, i) => index < (content[i]?.length ?? 0))) {
        if (y + Math.min(sigRoleLineH, sigNoteLineH) > contentBottom) nextPage();
        const chunkTop = y;
        let chunkHeight = 0;
        content.forEach((lines, i) => {
          const x = contentLeft + i * (sigW + sigGap);
          let lineY = chunkTop;
          const start = indexes[i] ?? 0;
          if (start >= lines.length) return;
          if (start === 0) doc.setDrawColor(...INK).setLineWidth(0.2).line(x, chunkTop, x + sigW, chunkTop);
          while (indexes[i] < lines.length) {
            const line = lines[indexes[i] ?? 0];
            if (!line || lineY + line.height > contentBottom) break;
            if (line.role) {
              doc.setFont("helvetica", "bold").setFontSize(REPORT_TYPE_SCALE_PT.signoffRole).setTextColor(...INK);
            } else {
              doc.setFont("helvetica", "normal").setFontSize(REPORT_TYPE_SCALE_PT.signoffNote).setTextColor(...MUTED);
            }
            drawText(line.text, x, lineY);
            lineY += line.height;
            indexes[i] = (indexes[i] ?? 0) + 1;
          }
          chunkHeight = Math.max(chunkHeight, lineY - chunkTop);
        });
        // Every page consumes at least one role or note line.
        y = chunkTop + chunkHeight;
        if (indexes.some((index, i) => index < (content[i]?.length ?? 0))) nextPage();
      }
    }
    y += lineMm(REPORT_TYPE_SCALE_PT.body);
  }

  if (model.authorisationNote.trim()) {
    doc.setFont("helvetica", "italic").setFontSize(REPORT_TYPE_SCALE_PT.footer).setTextColor(...MUTED);
    const authLines = splitToSize(model.authorisationNote, contentWidth);
    const authLineH = lineMm(REPORT_TYPE_SCALE_PT.footer);
    drawLinesAcrossPages(authLines, authLineH, (line, lineY) => drawText(line, contentLeft, lineY));
  }
  doc.setFont("helvetica", "normal").setFontSize(REPORT_TYPE_SCALE_PT.footer).setTextColor(...MUTED);
  const endLines = splitToSize(model.endOfReport, contentWidth);
  drawLinesAcrossPages(endLines, lineMm(REPORT_TYPE_SCALE_PT.footer), (line, lineY) =>
    drawText(line, (contentLeft + contentRight) / 2, lineY, { align: "center" }),
  );

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

async function reportPdfBlob(model: ReportModel): Promise<Blob> {
  const doc = await buildReportPdf(model);
  return new Blob([doc.output("arraybuffer")], { type: "application/pdf" });
}

const PRINT_UNAVAILABLE_MESSAGE =
  "Printing is not available here — use Download PDF and print the saved file.";

/** Print the same PDF bytes produced by the Download PDF action. */
export async function printReportPdf(model: ReportModel): Promise<void> {
  const blob = await reportPdfBlob(model);
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement("iframe");
  iframe.title = "Report PDF print document";
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = "1px";
  iframe.style.height = "1px";
  iframe.style.border = "0";

  let settled = false;
  let loadTimer = 0;
  let cleanupTimer = 0;
  const cleanup = () => {
    window.clearTimeout(loadTimer);
    window.clearTimeout(cleanupTimer);
    iframe.remove();
    URL.revokeObjectURL(url);
  };
  const scheduleCleanup = () => {
    if (!cleanupTimer) cleanupTimer = window.setTimeout(cleanup, 60_000);
  };

  return new Promise<void>((resolve, reject) => {
    const openPdfViewer = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(loadTimer);
      try {
        const popup = window.open(url, "_blank");
        if (!popup) throw new Error(PRINT_UNAVAILABLE_MESSAGE);
        scheduleCleanup();
        resolve();
      } catch {
        cleanup();
        reject(new Error(PRINT_UNAVAILABLE_MESSAGE));
      }
    };

    iframe.onload = () => {
      if (settled) return;
      window.clearTimeout(loadTimer);
      try {
        const printWindow = iframe.contentWindow;
        if (!printWindow || typeof printWindow.print !== "function") {
          openPdfViewer();
          return;
        }
        if (typeof printWindow.addEventListener === "function") {
          printWindow.addEventListener("afterprint", cleanup, { once: true });
        } else {
          printWindow.onafterprint = cleanup;
        }
        printWindow.focus();
        printWindow.print();
        settled = true;
        scheduleCleanup();
        resolve();
      } catch {
        openPdfViewer();
      }
    };

    loadTimer = window.setTimeout(openPdfViewer, 10_000);
    document.body.appendChild(iframe);
    iframe.src = url;
  });
}

/**
 * Save the report PDF to disk, prompting for a location.
 * - Tauri: native save dialog + filesystem write.
 * - Browser with File System Access API: native "Save As" picker.
 * - Otherwise: falls back to a normal download into the Downloads folder.
 */
export async function downloadReportPdf(model: ReportModel): Promise<void> {
  const blob = await reportPdfBlob(model);
  const fileName = `${model.fileBaseName}.pdf`;
  const bytes = await blob.arrayBuffer();

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

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
