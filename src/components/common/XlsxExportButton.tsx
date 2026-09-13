import { FileSpreadsheet, Loader2 } from "lucide-react";
import { useState } from "react";
import { notifyError } from "../../lib/dialog";
import { exportRecordsToXlsx, type SpreadsheetRow } from "../../lib/xlsxExport";

interface XlsxExportButtonProps {
  rows: SpreadsheetRow[];
  fileName: string;
  label?: string;
  className?: string;
}

export default function XlsxExportButton({
  rows,
  fileName,
  label = "Export XLSX",
  className = "secondary-button",
}: XlsxExportButtonProps) {
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    if (busy || rows.length === 0) return;
    setBusy(true);
    try {
      await exportRecordsToXlsx({ fileName, rows });
    } catch (error) {
      void notifyError({
        title: "Could not export XLSX",
        text: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => void handleExport()}
      disabled={busy || rows.length === 0}
      title={rows.length === 0 ? "There are no displayed records to export" : undefined}
    >
      {busy ? <Loader2 size={16} className="spin" /> : <FileSpreadsheet size={16} />}
      {busy ? "Exporting…" : label}
    </button>
  );
}
