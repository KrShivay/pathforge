export interface ReferenceRangeLike {
  min?: number;
  max?: number;
  text?: string;
}

/**
 * Human-readable reference range for a lab result, shared by the report editor
 * table and the printable report. Returns an em dash when nothing is set.
 */
export function formatReferenceRange(
  referenceRange: ReferenceRangeLike | undefined
): string {
  if (!referenceRange) return "—";
  if (referenceRange.text) return referenceRange.text;

  const { min, max } = referenceRange;
  if (min !== undefined && max !== undefined) return `${min} – ${max}`;
  // A one-sided range needs its direction marked — a bare "40" reads as a
  // fixed value or an unspecified-direction bound, not "must be under 40".
  if (min !== undefined) return `≥ ${min}`;
  if (max !== undefined) return `≤ ${max}`;
  return "—";
}
