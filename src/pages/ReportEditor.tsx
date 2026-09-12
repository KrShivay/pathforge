import { useEffect, useMemo, useState } from "react";
import {
  Save,
  CheckCircle2,
  FileText,
  GitBranchPlus,
  Lock,
  Printer,
  Download,
  Eye,
  Loader2,
} from "lucide-react";

import { useReports, type TestResult } from "../store/ReportContext";
import { usePatients } from "../store/PatientContext";
import { sanitizeText } from "../domain/textRules.mjs";
import PrintableReport from "../components/report/PrintableReport";
import ReportPreviewModal from "../components/report/ReportPreviewModal";
import ResultsTable from "../components/report/ResultsTable";
import { downloadReportPdf } from "../components/report/reportPdf";
import { buildReportModel } from "../components/report/reportModel";
import { formatReportDate } from "../components/report/reportMeta";
import {
  confirmAction,
  notifyError,
  notifyErrorList,
  notifySuccess,
  promptText,
  showFinalizedDialog,
} from "../lib/dialog";

interface ReportEditorProps {
  reportId: string;
  onBack: () => void;
  onOpenReport: (reportId: string) => void;
}

function ReportEditor({
  reportId,
  onBack,
  onOpenReport,
}: ReportEditorProps) {
  const {
    getReport,
    updateReport,
    finalizeReport,
    createAmendment,
  } = useReports();

  const [busy, setBusy] = useState(false);

  // Screen preview of the exact document that prints. Same component, same
  // canonical model - never a second layout.
  const [showPreview, setShowPreview] = useState(false);

  const { patients } = usePatients();

  const foundReport = getReport(reportId);

  const [formData, setFormData] = useState({
    specimenType: "",
    clinicalHistory: "",
    findings: "",
    diagnosis: "",
    testResults: [] as TestResult[],
  });

  // ========================================
  // LOAD REPORT DATA
  // ========================================

  // `foundReport` is a brand-new object on every context refresh (ReportContext
  // rebuilds its `reports` array whenever *any* report changes), even when this
  // report's own saved content is unchanged. Depending on the object itself
  // would re-hydrate the form — and stomp whatever the user is typing — on every
  // unrelated refresh. Depending on a signature of the actual saved fields means
  // this effect only fires when the content this report was loaded/saved with
  // actually changes.
  const savedContentSignature = foundReport
    ? `${foundReport.id}::${JSON.stringify({
        specimenType: foundReport.specimenType,
        clinicalHistory: foundReport.clinicalHistory,
        findings: foundReport.findings,
        diagnosis: foundReport.diagnosis,
        testResults: foundReport.testResults,
      })}`
    : null;

  useEffect(() => {
    if (!foundReport) return;

    setFormData({
      specimenType: foundReport.specimenType ?? "",
      clinicalHistory:
        foundReport.clinicalHistory ?? "",
      findings: foundReport.findings ?? "",
      diagnosis: foundReport.diagnosis ?? "",
      testResults: foundReport.testResults ?? [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedContentSignature]);

  const patient = patients.find(
    (candidate) => candidate.id === foundReport?.patientId
  );

  // Single source of truth for the report's printable / PDF content. Built here
  // (before the not-found early return) so the hook order stays stable, and
  // memoized so unrelated re-renders do not regroup results or hand
  // PrintableReport a fresh object.
  const reportModel = useMemo(
    () =>
      foundReport
        ? buildReportModel({
            patientName: patient?.name ?? "Unknown Patient",
            patientCode: patient?.patientId ?? "Unknown ID",
            patientAge: patient?.age,
            patientSex: patient?.gender,
            patientPhone: patient?.phone,
            reportId: foundReport.id,
            version: foundReport.version,
            isFinalized: foundReport.status === "finalized",
            finalizedAt: foundReport.finalizedAt,
            issueNumber: foundReport.issueNumber,
            issueDate: foundReport.issueDate,
            finalizedBy: foundReport.finalizedBy,
            amendedAt: foundReport.amendedAt,
            amendedBy: foundReport.amendedBy,
            amendmentType: foundReport.amendmentType,
            amendmentReason: foundReport.amendmentReason,
            supersedesVersion: foundReport.supersedesVersion,
            panelName: foundReport.testName,
            department: foundReport.department,
            reportDate: foundReport.createdAt,
            content: {
              specimenType: formData.specimenType,
              clinicalHistory: formData.clinicalHistory,
              findings: formData.findings,
              diagnosis: formData.diagnosis,
              testResults: formData.testResults,
            },
          })
        : null,
    [foundReport, patient, formData]
  );

  // ========================================
  // REPORT NOT FOUND
  // ========================================

  if (!foundReport || !reportModel) {
    return (
      <div className="report-not-found">
        <h2>Report not found</h2>

        <button
          className="secondary-button"
          onClick={onBack}
        >
          Back to Worklist
        </button>
      </div>
    );
  }

  const report = foundReport;
  const model = reportModel;

  const isFinalized =
    report.status === "finalized";

  // ========================================
  // HANDLE FORM CHANGE
  // ========================================

  function handleChange(
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement
    >
  ) {
    if (isFinalized) return;

    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: sanitizeText(value, "general"),
    }));
  }

  function handleResultChange(
    testId: string,
    parameterId: string,
    value: string
  ) {
    if (isFinalized) return;

    const clean = sanitizeText(value, "result");
    setFormData((previous) => ({
      ...previous,
      testResults: previous.testResults.map((result) =>
        result.testId === testId && result.parameterId === parameterId
          ? { ...result, value: clean }
          : result
      ),
    }));
  }

  // ========================================
  // SAVE REPORT
  // ========================================

  /** Report a failed write instead of leaving the clinician to assume success. */
  function reportWriteFailure(title: string, error: unknown) {
    console.error(title, error);
    void notifyError({
      title,
      text:
        error instanceof Error
          ? error.message
          : "The report was not saved. Please try again.",
    });
  }

  async function saveChanges() {
    if (isFinalized || busy) return;

    setBusy(true);
    try {
      await updateReport(report.id, {
        specimenType: formData.specimenType,
        clinicalHistory: formData.clinicalHistory,
        findings: formData.findings,
        diagnosis: formData.diagnosis,
        testResults: formData.testResults,
      });
    } catch (error) {
      reportWriteFailure("Could not save the report", error);
      return;
    } finally {
      setBusy(false);
    }

    void notifySuccess({
      title: "Changes saved",
      text: "Report changes have been saved.",
    });
  }

  // ========================================
  // FINALIZE REPORT
  // ========================================

  async function handleFinalize() {
    if (isFinalized || busy) return;

    // Soft confirmation: microscopic findings and/or diagnosis missing (spec §17).
    const missing: string[] = [];
    if (!formData.findings.trim()) missing.push("microscopic findings");
    if (!formData.diagnosis.trim()) missing.push("diagnosis");
    if (missing.length > 0) {
      const proceed = await confirmAction({
        icon: "warning",
        title: "Finalize without complete clinical detail?",
        text: `No ${missing.join(" and/or ")} ${
          missing.length === 1 ? "has" : "have"
        } been entered. Do you want to proceed?`,
        confirmText: "Proceed",
        cancelText: "Go back",
      });
      if (!proceed) return;
    }

    setBusy(true);
    let result;
    try {
      // Persist the current edits first, then validate + finalize.
      await updateReport(report.id, {
        specimenType: formData.specimenType,
        clinicalHistory: formData.clinicalHistory,
        findings: formData.findings,
        diagnosis: formData.diagnosis,
        testResults: formData.testResults,
      });
      result = await finalizeReport(report.id);
    } catch (error) {
      reportWriteFailure("Could not finalize the report", error);
      return;
    } finally {
      setBusy(false);
    }

    if (!result.valid) {
      void notifyErrorList(
        "Cannot finalize this report",
        result.errors.map((issue) => issue.message)
      );
      return;
    }

    // Finalized — let the user choose what happens next (spec §19). Nothing
    // prints or downloads on its own; the X just closes. Read the freshly
    // finalized version from the finalize result, not getReport(): the hook's
    // reports array has not re-rendered yet inside this handler.
    const finalized = result.report;
    const choice = await showFinalizedDialog({
      reportNo: finalized?.issueNumber ?? model.reportNo,
      version: finalized?.version ?? report.version,
      finalizedOn: formatReportDate(
        finalized?.finalizedAt ?? new Date().toISOString()
      ),
    });
    if (choice === "download") await handleDownloadPdf();
    else if (choice === "print") handlePrint();
  }

  // ========================================
  // CREATE AMENDMENT
  // ========================================

  async function handleCreateAmendment() {
    if (!isFinalized || busy) return;

    const reason = await promptText({
      title: "Create amendment",
      label: "Reason for amendment",
      placeholder: "Describe why this version is being corrected…",
      confirmText: "Create amendment",
      multiline: true,
      requiredMessage: "An amendment reason is required.",
    });

    if (!reason) return;

    setBusy(true);
    let amendment;
    try {
      amendment = await createAmendment(report.id, reason);
    } catch (error) {
      reportWriteFailure("Could not create the amendment", error);
      return;
    } finally {
      setBusy(false);
    }

    if (!amendment) {
      void notifyError({
        title: "Could not create amendment",
        text: "Please try again.",
      });
      return;
    }

    await notifySuccess({
      title: "Amendment created",
      text: `Version ${amendment.version} created as a draft amendment.`,
    });

    onOpenReport(amendment.id);
  }

  // ========================================
  // PRINT  /  DOWNLOAD PDF
  //
  // "Print" sends the on-screen `.print-report` layout to the OS print dialog.
  // "Download PDF" builds a PDF file from the same report data and prompts for a
  // save location (native dialog in Tauri, "Save As" picker in the browser).
  // ========================================

  function handlePrint() {
    window.print();
  }

  async function handleDownloadPdf() {
    setBusy(true);
    try {
      await downloadReportPdf(model);
    } catch (error) {
      void notifyError({
        title: "Could not create the PDF",
        text: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(false);
    }
  }

  // ========================================
  // UI
  // ========================================

  return (
    <div className="report-editor-page">

      {/* ========================================
          EDITOR TOP BAR
      ======================================== */}

      <div className="editor-topbar print-hide">

        <div>

          <button
            className="back-button"
            onClick={onBack}
          >
            ← Back to Worklist
          </button>

          <div className="report-title-row">

            <div>
              <h2>Report Editor</h2>

              <p>
                {patient?.name ??
                  "Unknown Patient"}{" "}
                ·{" "}
                {patient?.patientId ??
                  "Unknown ID"}
              </p>
            </div>

            <span
              className={`version-badge ${
                isFinalized
                  ? "finalized"
                  : "draft"
              }`}
            >
              Version {report.version}
            </span>

          </div>

          {isFinalized && (
            <div className="finalized-notice">

              <Lock size={16} />

              <span>
                This report is finalized and
                cannot be edited. Create an
                amendment to make changes.
              </span>

            </div>
          )}

        </div>

        <div className="editor-actions">

          <button
            className="secondary-button"
            onClick={() => setShowPreview(true)}
          >
            <Eye size={17} />
            Preview
          </button>

          <button
            className="secondary-button"
            onClick={handlePrint}
          >
            <Printer size={17} />
            Print
          </button>

          <button
            className="secondary-button"
            onClick={handleDownloadPdf}
            disabled={busy}
          >
            <Download size={17} />
            Download PDF
          </button>

          {!isFinalized ? (
            <>

              <button
                className="secondary-button"
                onClick={saveChanges}
                disabled={busy}
              >
                <Save size={17} />
                Save Changes
              </button>

              <button
                className="primary-button"
                onClick={handleFinalize}
                disabled={busy}
              >
                {busy ? (
                  <Loader2 size={17} className="spin" />
                ) : (
                  <CheckCircle2 size={17} />
                )}
                {busy ? "Finalizing…" : "Finalize Report"}
              </button>

            </>
          ) : (
            <button
              className="primary-button"
              onClick={handleCreateAmendment}
              disabled={busy}
            >
              <GitBranchPlus size={17} />
              Create Amendment
            </button>
          )}

        </div>

      </div>

      {/* ========================================
          NORMAL EDITOR
      ======================================== */}

      <div
        className={`report-editor-card print-hide ${
          isFinalized
            ? "read-only"
            : ""
        }`}
      >

        {/* SPECIMEN */}

        <div className="editor-section">

          <div className="editor-section-title">

            <FileText size={19} />

            <div>
              <h3>
                Specimen Details
              </h3>

              <p>
                Basic information about
                the specimen
              </p>
            </div>

          </div>

          <div className="form-group">

            <label>
              Specimen Type
            </label>

            <input
              type="text"
              name="specimenType"
              value={
                formData.specimenType
              }
              onChange={handleChange}
              disabled={isFinalized || busy}
              placeholder="Enter specimen type"
            />

          </div>

        </div>

        <ResultsTable
          results={formData.testResults}
          disabled={isFinalized || busy}
          onResultChange={handleResultChange}
        />

        {/* CLINICAL HISTORY */}

        <div className="editor-section">

          <div className="editor-section-title">

            <FileText size={19} />

            <div>
              <h3>
                Clinical History
              </h3>

              <p>
                Relevant patient history
              </p>
            </div>

          </div>

          <textarea
            name="clinicalHistory"
            value={
              formData.clinicalHistory
            }
            onChange={handleChange}
            rows={4}
            disabled={isFinalized || busy}
            placeholder="Enter clinical history"
          />

        </div>

        {/* FINDINGS */}

        <div className="editor-section">

          <div className="editor-section-title">

            <FileText size={19} />

            <div>
              <h3>
                Microscopic Findings
              </h3>

              <p>
                Detailed pathology
                observations
              </p>
            </div>

          </div>

          <textarea
            name="findings"
            value={formData.findings}
            onChange={handleChange}
            rows={7}
            disabled={isFinalized || busy}
            placeholder="Enter microscopic findings"
          />

        </div>

        {/* DIAGNOSIS */}

        <div className="editor-section">

          <div className="editor-section-title">

            <FileText size={19} />

            <div>
              <h3>
                Diagnosis
              </h3>

              <p>
                Final pathological
                diagnosis
              </p>
            </div>

          </div>

          <textarea
            name="diagnosis"
            value={formData.diagnosis}
            onChange={handleChange}
            rows={5}
            disabled={isFinalized || busy}
            placeholder="Enter final diagnosis"
          />

        </div>

      </div>

      {/* Hidden on screen; the only node @media print renders. The PDF and the
          preview modal below both project this same canonical model. */}
      <div className="report-output">
        <PrintableReport model={model} />
      </div>

      {showPreview && (
        <ReportPreviewModal
          model={model}
          label={isFinalized ? "REPORT PREVIEW" : "DRAFT PREVIEW"}
          onClose={() => setShowPreview(false)}
          onPrint={handlePrint}
          onDownloadPdf={handleDownloadPdf}
          busy={busy}
        />
      )}
    </div>
  );
}

export default ReportEditor;
