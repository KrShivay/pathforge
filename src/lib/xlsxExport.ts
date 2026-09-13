import { zipSync, strToU8 } from "fflate";
import { isTauri } from "@tauri-apps/api/core";

export type SpreadsheetCell = string | number | boolean | Date | null | undefined;
export type SpreadsheetRow = Record<string, SpreadsheetCell>;

interface ExportRecordsOptions {
  fileName: string;
  rows: SpreadsheetRow[];
  sheetName?: string;
}

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function escapeXml(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[
        character
      ] ?? character,
  );
}

function columnName(index: number): string {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function excelSerial(date: Date): number {
  return date.getTime() / 86_400_000 + 25_569;
}

function cellXml(reference: string, value: SpreadsheetCell): string {
  if (value === null || value === undefined || value === "") {
    return `<c r="${reference}"/>`;
  }
  if (value instanceof Date) {
    return `<c r="${reference}" s="2"><v>${excelSerial(value)}</v></c>`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${reference}"><v>${value}</v></c>`;
  }
  if (typeof value === "boolean") {
    return `<c r="${reference}" t="b"><v>${value ? 1 : 0}</v></c>`;
  }
  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function workbookXml(sheetName: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
}

function worksheetXml(columns: string[], rows: SpreadsheetRow[]): string {
  const header = columns
    .map((column, index) => cellXml(`${columnName(index)}1`, column))
    .join("");
  const body = rows
    .map(
      (row, rowIndex) =>
        `<row r="${rowIndex + 2}">${columns
          .map((column, columnIndex) =>
            cellXml(`${columnName(columnIndex)}${rowIndex + 2}`, row[column]),
          )
          .join("")}</row>`,
    )
    .join("");
  const lastRow = Math.max(1, rows.length + 1);
  const lastColumn = columnName(Math.max(0, columns.length - 1));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastColumn}${lastRow}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${columns
    .map((column, index) => `<col min="${index + 1}" max="${index + 1}" width="${Math.min(42, Math.max(12, column.length + 2))}" customWidth="1"/>`)
    .join("")}</cols><sheetData><row r="1" customFormat="1" s="1">${header}</row>${body}</sheetData><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
}

/** Build a minimal standards-compliant XLSX workbook containing one data table. */
export function buildXlsxBytes(rows: SpreadsheetRow[], sheetName = "Records"): Uint8Array {
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  const safeColumns = columns.length > 0 ? columns : ["Records"];
  const safeRows = columns.length > 0 ? rows : [];
  return zipSync(
    {
      "[Content_Types].xml": strToU8(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
      ),
      "_rels/.rels": strToU8(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
      ),
      "xl/workbook.xml": strToU8(workbookXml(sheetName)),
      "xl/_rels/workbook.xml.rels": strToU8(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      ),
      "xl/worksheets/sheet1.xml": strToU8(worksheetXml(safeColumns, safeRows)),
      "xl/styles.xml": strToU8(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`,
      ),
      "docProps/core.xml": strToU8(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>PathForge records export</dc:title><dc:creator>PathForge</dc:creator></cp:coreProperties>`,
      ),
      "docProps/app.xml": strToU8(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>PathForge</Application></Properties>`,
      ),
    },
    { level: 6 },
  );
}

function normalizedFileName(value: string): string {
  const clean = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "_");
  return clean.toLowerCase().endsWith(".xlsx") ? clean : `${clean || "PathForge_records"}.xlsx`;
}

/** Save records through the native dialog in Tauri or a browser download. */
export async function exportRecordsToXlsx({
  fileName,
  rows,
  sheetName = "Records",
}: ExportRecordsOptions): Promise<void> {
  if (rows.length === 0) throw new Error("There are no displayed records to export.");
  const safeFileName = normalizedFileName(fileName);
  const bytes = buildXlsxBytes(rows, sheetName);

  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({
      defaultPath: safeFileName,
      filters: [{ name: "Excel workbook", extensions: ["xlsx"] }],
    });
    if (!path) return;
    await writeFile(path, bytes);
    return;
  }

  const blobBytes = bytes.slice();
  const url = URL.createObjectURL(
    new Blob([blobBytes.buffer as ArrayBuffer], { type: XLSX_MIME }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeFileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
