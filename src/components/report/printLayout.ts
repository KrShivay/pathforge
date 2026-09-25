export interface PageMarginsMm {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PrintLayout {
  showLetterhead: boolean;
  marginsMm: PageMarginsMm;
}

export const DEFAULT_PRINT_LAYOUT: PrintLayout = {
  showLetterhead: true,
  marginsMm: { top: 16, right: 16, bottom: 16, left: 16 },
};

export const MARGIN_LIMITS_MM = {
  top: { min: 0, max: 60 },
  right: { min: 0, max: 60 },
  bottom: { min: 10, max: 60 },
  left: { min: 0, max: 60 },
} as const;

export const MAX_HORIZONTAL_MARGINS_MM = 80;
export const A4_MM = { width: 210, height: 297 } as const;
export const CSS_PX_PER_INCH = 96;
export const MM_PER_INCH = 25.4;

export function mmToPx(mm: number): number {
  return (mm * CSS_PX_PER_INCH) / MM_PER_INCH;
}

export function pxToMm(px: number): number {
  return (px * MM_PER_INCH) / CSS_PX_PER_INCH;
}

const SIDES = ["top", "right", "bottom", "left"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validatePrintLayout(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value) || typeof value.showLetterhead !== "boolean") {
    errors.push("Show letterhead must be a boolean.");
  }

  const margins = isRecord(value) && isRecord(value.marginsMm) ? value.marginsMm : {};
  for (const side of SIDES) {
    const margin = margins[side];
    const { min, max } = MARGIN_LIMITS_MM[side];
    const label = `${side[0].toUpperCase()}${side.slice(1)}`;
    if (typeof margin !== "number" || !Number.isFinite(margin)) {
      errors.push(`${label} margin must be a finite number from ${min} to ${max} mm.`);
    } else if (margin < min || margin > max) {
      errors.push(`${label} margin must be from ${min} to ${max} mm.`);
    }
  }

  const left = margins.left;
  const right = margins.right;
  if (typeof left === "number" && Number.isFinite(left) && typeof right === "number" && Number.isFinite(right) && left + right > MAX_HORIZONTAL_MARGINS_MM) {
    errors.push(`Left and right margins together must be no more than ${MAX_HORIZONTAL_MARGINS_MM} mm.`);
  }
  return errors;
}

export function normalizePrintLayout(value: unknown): PrintLayout {
  const source = isRecord(value) ? value : {};
  const sourceMargins = isRecord(source.marginsMm) ? source.marginsMm : {};
  const marginsMm = {} as PageMarginsMm;

  for (const side of SIDES) {
    const candidate = sourceMargins[side];
    const { min, max } = MARGIN_LIMITS_MM[side];
    const finite = typeof candidate === "number" && Number.isFinite(candidate);
    const clamped = Math.min(max, Math.max(min, finite ? candidate : DEFAULT_PRINT_LAYOUT.marginsMm[side]));
    marginsMm[side] = Math.round(clamped * 100) / 100;
  }

  if (marginsMm.left + marginsMm.right > MAX_HORIZONTAL_MARGINS_MM) {
    const scale = MAX_HORIZONTAL_MARGINS_MM / (marginsMm.left + marginsMm.right);
    marginsMm.left = Math.floor(marginsMm.left * scale * 100) / 100;
    marginsMm.right = Math.floor(marginsMm.right * scale * 100) / 100;
  }

  return {
    showLetterhead: typeof source.showLetterhead === "boolean" ? source.showLetterhead : DEFAULT_PRINT_LAYOUT.showLetterhead,
    marginsMm,
  };
}

/** Body text is 7.5pt = 10px (at most 10px); nothing prints below 6pt (8px). */
export const REPORT_TYPE_SCALE_PT = {
  body: 7.5,
  table: 7.5,
  bandValue: 7.5,
  diagnosis: 8,
  label: 6,
  tableHeader: 6,
  sectionHeading: 8.5,
  groupHeading: 7.5,
  signoffRole: 7,
  signoffNote: 6.5,
  notice: 7,
  footer: 6,
  brandName: 16,
  documentTitle: 10,
  letterheadDetail: 6.5,
  continuation: 6.5,
} as const;

export const MIN_PRINTED_FONT_PT = 6;

export function ptToPx(pt: number): number {
  return (pt * 4) / 3;
}
