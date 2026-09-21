import { useEffect, useRef } from "react";
import { X, Printer, Download } from "lucide-react";

import A4PreviewSheet from "./A4PreviewSheet";
import PrintableReport from "./PrintableReport";
import type { ReportModel } from "./reportModel";

interface ReportPreviewModalProps {
  model: ReportModel;
  /** Header label, e.g. "DRAFT PREVIEW" or "REPORT PREVIEW". */
  label: string;
  onClose: () => void;
  onPrint?: () => void;
  onDownloadPdf?: () => void;
  busy?: boolean;
}

/**
 * Full-screen preview of the house-format report. Renders the same
 * {@link PrintableReport} (one layout, spec §21) on a white A4 sheet against a
 * dark backdrop. The header — with the close button — is a flex child that never
 * scrolls away, so the X is always reachable however long the report is (§20).
 */
export default function ReportPreviewModal({
  model,
  label,
  onClose,
  onPrint,
  onDownloadPdf,
  busy = false,
}: ReportPreviewModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      returnFocusRef.current?.focus();
    };
  }, [onClose]);

  function trapFocus(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const focusable = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
        "button:not([disabled])",
      ),
    ];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="preview-modal-backdrop print-hide"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
    >
      <div
        className="preview-modal"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={trapFocus}
      >
        <div className="preview-modal-head">
          <span className="preview-modal-label">{label}</span>

          <div className="preview-modal-actions">
            {onPrint ? (
              <button
                type="button"
                className="secondary-button"
                onClick={onPrint}
                disabled={busy}
              >
                <Printer size={16} />
                Print
              </button>
            ) : null}
            {onDownloadPdf ? (
              <button
                type="button"
                className="secondary-button"
                onClick={onDownloadPdf}
                disabled={busy}
              >
                <Download size={16} />
                Download PDF
              </button>
            ) : null}
            <button
              ref={closeRef}
              type="button"
              className="preview-modal-close"
              onClick={onClose}
              aria-label="Close preview"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="preview-modal-body">
          <A4PreviewSheet className="preview-modal-sheet">
            <PrintableReport model={model} />
          </A4PreviewSheet>
        </div>
      </div>
    </div>
  );
}
