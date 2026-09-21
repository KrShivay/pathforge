import {
  CheckCircle2,
  Download,
  Eye,
  FileText,
  FlaskConical,
  GitBranchPlus,
  Loader2,
  Lock,
  MoreHorizontal,
  Printer,
  Save,
  Stethoscope,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import CardHeading from "../components/common/CardHeading";
import PrintableReport from "../components/report/PrintableReport";
import ReportPreviewModal from "../components/report/ReportPreviewModal";
import ResultsTable from "../components/report/ResultsTable";
import { resultTypeError } from "../components/report/resultValidation.mjs";
import { formatReportDate, isoDateFromLocalDate } from "../components/report/reportMeta";
import { buildReportModel } from "../components/report/reportModel";
import { sanitizeText } from "../domain/textRules.mjs";
import {
  confirmDestructive,
  notifyError,
  notifyErrorList,
  notifySuccess,
  promptText,
  showFinalizedDialog,
} from "../lib/dialog";
import { usePatients } from "../store/PatientContext";
import { useReports, type TestResult } from "../store/ReportContext";
import { useBranding } from "../store/BrandingContext";
import { useTests } from "../store/TestContext";

interface ReportEditorProps {
  reportId: string;
  onBack: () => void;
  onOpenReport: (reportId: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

function ReportEditor({ reportId, onBack, onOpenReport, onDirtyChange }: ReportEditorProps) {
  const { getReport, updateReport, finalizeReport, createAmendment } =
    useReports();

  const [busy, setBusy] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Screen preview of the exact document that prints. Same component, same
  // canonical model - never a second layout.
  const [showPreview, setShowPreview] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const { patients } = usePatients();
  const { profile } = useBranding();
  const { tests } = useTests();

  const foundReport = getReport(reportId);

  const [formData, setFormData] = useState({
    specimens: [] as string[],
    specimenCollectionDate: "",
    referringClinician: "",
    clinicalHistory: "",
    findings: "",
    diagnosis: "",
    interpretation: "",
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
        specimens: foundReport.specimens,
        specimenCollectionDate:
          foundReport.specimenCollectionDate || foundReport.createdAt.slice(0, 10),
        referringClinician: foundReport.referringClinician,
        clinicalHistory: foundReport.clinicalHistory,
        findings: foundReport.findings,
        diagnosis: foundReport.diagnosis,
        interpretation: foundReport.interpretation,
        testResults: foundReport.testResults,
      })}`
    : null;

  useEffect(() => {
    if (!foundReport) return;

    setFormData({
      specimens: foundReport.specimens ?? [],
      specimenCollectionDate:
        foundReport.specimenCollectionDate || foundReport.createdAt.slice(0, 10),
      referringClinician: foundReport.referringClinician ?? "",
      clinicalHistory: foundReport.clinicalHistory ?? "",
      findings: foundReport.findings ?? "",
      diagnosis: foundReport.diagnosis ?? "",
      interpretation: foundReport.interpretation ?? "",
      testResults: foundReport.testResults ?? [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedContentSignature]);

  const patient = patients.find(
    (candidate) => candidate.id === foundReport?.patientId,
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
            specimenCollectionDate: formData.specimenCollectionDate,
            laboratoryProfile: foundReport.brandingSnapshot ?? profile,
            content: {
              specimens: formData.specimens,
              specimenCollectionDate: formData.specimenCollectionDate,
              referringClinician: formData.referringClinician,
              clinicalHistory: formData.clinicalHistory,
              findings: formData.findings,
              diagnosis: formData.diagnosis,
              interpretation: formData.interpretation,
              testResults: formData.testResults,
            },
          })
        : null,
    [foundReport, patient, formData, profile],
  );

  const isDirty = Boolean(
    foundReport &&
      foundReport.status !== "finalized" &&
      JSON.stringify(formData) !==
        JSON.stringify({
          specimens: foundReport.specimens ?? [],
          specimenCollectionDate:
            foundReport.specimenCollectionDate || foundReport.createdAt.slice(0, 10),
          referringClinician: foundReport.referringClinician ?? "",
          clinicalHistory: foundReport.clinicalHistory ?? "",
          findings: foundReport.findings ?? "",
          diagnosis: foundReport.diagnosis ?? "",
          interpretation: foundReport.interpretation ?? "",
          testResults: foundReport.testResults ?? [],
        }),
  );
  useEffect(() => onDirtyChange?.(isDirty), [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!showExportMenu) return;

    const closeOutside = (event: PointerEvent) => {
      if (!exportMenuRef.current?.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setShowExportMenu(false);
      exportMenuRef.current
        ?.querySelector<HTMLButtonElement>(".editor-export-trigger")
        ?.focus();
    };

    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [showExportMenu]);

  // ========================================
  // REPORT NOT FOUND
  // ========================================

  if (!foundReport || !reportModel) {
    return (
      <div className="report-not-found">
        <h2>Report not found</h2>

        <button className="secondary-button" onClick={onBack}>
          Back to Worklist
        </button>
      </div>
    );
  }

  const report = foundReport;
  const model = reportModel;

  const isFinalized = report.status === "finalized";

  // ========================================
  // HANDLE FORM CHANGE
  // ========================================

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    if (isFinalized) return;

    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: sanitizeText(value, "general"),
    }));
    if (value.trim()) setValidationErrors((previous) => { const next = { ...previous }; delete next[name]; return next; });
  }

  function handleResultChange(
    testId: string,
    parameterId: string,
    value: string,
  ) {
    if (isFinalized) return;

    const clean = sanitizeText(value, "result");
    setFormData((previous) => ({
      ...previous,
      testResults: previous.testResults.map((result) =>
        result.testId === testId && result.parameterId === parameterId
          ? { ...result, value: clean }
          : result,
      ),
    }));
    if (clean.trim()) setValidationErrors((previous) => { const next = { ...previous }; delete next[`result.${testId}::${parameterId}`]; return next; });
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
        specimens: formData.specimens,
        specimenCollectionDate:
          formData.specimenCollectionDate || isoDateFromLocalDate(new Date(report.createdAt)),
        referringClinician: formData.referringClinician,
        clinicalHistory: formData.clinicalHistory,
        findings: formData.findings,
        diagnosis: formData.diagnosis,
        interpretation: formData.interpretation,
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

    const resultTypeErrors = formData.testResults.flatMap((result) => {
      const parameterType =
        tests
          .find((test) => test.id === result.testId)
          ?.parameters.find((parameter) => parameter.id === result.parameterId)
          ?.type ?? "text";
      const message = resultTypeError(result.value, parameterType);
      return message
        ? [{ field: `result.${result.testId}::${result.parameterId}`, message }]
        : [];
    });
    if (resultTypeErrors.length > 0) {
      setValidationErrors((previous) => ({
        ...previous,
        ...Object.fromEntries(resultTypeErrors.map((issue) => [issue.field, issue.message])),
      }));
      void notifyErrorList(
        "Cannot finalize this report",
        resultTypeErrors.map((issue) => issue.message),
      );
      return;
    }

    const confirmed = await confirmDestructive({
      title: "Finalize this report?",
      text: "This version will become finalized and locked. Any later corrections will require an amendment.",
      confirmText: "Finalize",
      cancelText: "Cancel",
    });
    if (!confirmed) return;

    setBusy(true);
    let result;
    try {
      // Persist the current edits first, then validate + finalize.
      await updateReport(report.id, {
        specimens: formData.specimens,
        specimenCollectionDate:
          formData.specimenCollectionDate || isoDateFromLocalDate(new Date(report.createdAt)),
        referringClinician: formData.referringClinician,
        clinicalHistory: formData.clinicalHistory,
        findings: formData.findings,
        diagnosis: formData.diagnosis,
        interpretation: formData.interpretation,
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
      const nextErrors = Object.fromEntries(result.errors.map((issue) => [issue.field, issue.message]));
      setValidationErrors(nextErrors);
      requestAnimationFrame(() => {
        const first = result.errors[0]?.field;
        const id = first === "specimens" ? "ed-specimens" : first === "findings" ? "ed-findings" : first === "diagnosis" ? "ed-diagnosis" : undefined;
        if (id) document.getElementById(id)?.focus();
      });
      void notifyErrorList(
        "Cannot finalize this report",
        result.errors.map((issue) => issue.message),
      );
      return;
    }

    // Finalized — let the user choose what happens next (spec §19). Nothing
    // prints or downloads on its own; the X just closes. Read the freshly
    // finalized version from the finalize result, not getReport(): the hook's
    // reports array has not re-rendered yet inside this handler.
    const finalized = result.report;
    await showFinalizedDialog({
      reportNo: finalized?.issueNumber ?? model.reportNo,
      version: finalized?.version ?? report.version,
      finalizedOn: formatReportDate(
        finalized?.finalizedAt ?? new Date().toISOString(),
      ),
    });
    setValidationErrors({});
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

  function handleExportMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const items = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]',
      ),
    ];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      items[(index + delta + items.length) % items.length]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      items[event.key === "Home" ? 0 : items.length - 1]?.focus();
    } else if (event.key === "Tab") {
      setShowExportMenu(false);
    }
  }

  async function handleDownloadPdf() {
    setBusy(true);
    try {
      const { downloadReportPdf } = await import("../components/report/reportPdf");
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
    <div className="report-editor-page viewport-page">
      {/* ========================================
          EDITOR TOP BAR
      ======================================== */}

      <div className="editor-topbar print-hide">
        <div className="editor-topbar-left">
          <button
            type="button"
            className="back-button"
            onClick={onBack}
          >
            ← Back to Worklist
          </button>

          <div className="report-title-row">
            <div>
              <h2>Report Editor</h2>
              <p>
                <strong>{patient?.name ?? "Unknown Patient"}</strong>
                {patient?.gender ? (
                  <span>
                    {" "}
                    · {patient.age}y / {patient.gender}
                  </span>
                ) : null}
              </p>
            </div>

            <span
              className={`version-badge ${isFinalized ? "finalized" : "draft"}`}
            >
              Version {report.version}
            </span>
          </div>

          {isFinalized && (
            <div className="finalized-notice">
              <Lock size={15} />
              <span>
                Finalized &amp; locked. Create an amendment to modify.
              </span>
            </div>
          )}
        </div>

        <div className="editor-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => setShowPreview(true)}
          >
            <Eye size={16} />
            Preview
          </button>

          <div className="editor-export-menu" ref={exportMenuRef}>
            <button
              type="button"
              className="secondary-button editor-export-trigger"
              aria-haspopup="menu"
              aria-expanded={showExportMenu}
              aria-controls="report-export-menu"
              onClick={() => {
                const nextOpen = !showExportMenu;
                setShowExportMenu(nextOpen);
                if (nextOpen) {
                  requestAnimationFrame(() =>
                    exportMenuRef.current
                      ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
                      ?.focus(),
                  );
                }
              }}
            >
              <MoreHorizontal size={16} aria-hidden="true" />
              Export
            </button>

            {showExportMenu ? (
              <div
                id="report-export-menu"
                className="editor-export-list"
                role="menu"
                aria-label="Report export actions"
                onKeyDown={handleExportMenuKeyDown}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setShowExportMenu(false);
                    handlePrint();
                  }}
                  disabled={busy}
                >
                  <Printer size={16} aria-hidden="true" />
                  Print
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setShowExportMenu(false);
                    void handleDownloadPdf();
                  }}
                  disabled={busy}
                >
                  <Download size={16} aria-hidden="true" />
                  Download PDF
                </button>
              </div>
            ) : null}
          </div>

          {!isFinalized ? (
            <>
              <button
                type="button"
                className="secondary-button"
                onClick={saveChanges}
                disabled={busy}
              >
                <Save size={16} />
                Save Changes
              </button>

              <button
                type="button"
                className="primary-button"
                onClick={handleFinalize}
                disabled={busy}
              >
                {busy ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                {busy ? "Finalizing…" : "Finalize Report"}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="primary-button"
              onClick={handleCreateAmendment}
              disabled={busy}
            >
              <GitBranchPlus size={16} />
              Create Amendment
            </button>
          )}
        </div>
      </div>

      {/* ========================================
          DUAL-PANEL CLINICAL WORKSTATION
      ======================================== */}

      <div
        className={`report-editor-workspace print-hide ${
          isFinalized ? "read-only" : ""
        }`}
      >
        {/* LEFT COLUMN: Collection details & Results Table */}
        <div className="editor-left-column">
          <div className="editor-card specimen-card">
            <div className="editor-card-header">
              <CardHeading
                icon={FileText}
                title="Collection Details"
                subtitle="When the sample was collected"
              />
            </div>

            <div className="editor-card-body">
              <div className="form-group specimen-date-form-group">
                <label htmlFor="ed-specimen-collection-date">Collection date</label>
                <input
                  id="ed-specimen-collection-date"
                  name="specimenCollectionDate"
                  type="date"
                  value={formData.specimenCollectionDate}
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      specimenCollectionDate: event.target.value,
                    }))
                  }
                  disabled={isFinalized || busy}
                  aria-invalid={Boolean(validationErrors.specimenCollectionDate)}
                />
                <span className="form-hint">Defaults to the report creation date.</span>
              </div>
            </div>
          </div>

          <div className="editor-card results-card">
            <div className="editor-card-header">
              <CardHeading
                icon={FlaskConical}
                title="Laboratory Results"
                subtitle={`${formData.testResults.length} ${
                  formData.testResults.length === 1 ? "parameter" : "parameters"
                } measured`}
              />
            </div>

            <div className="editor-card-body results-card-body">
              <ResultsTable
                results={formData.testResults}
                disabled={isFinalized || busy}
                onResultChange={handleResultChange}
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Clinical Narrative & Findings */}
        <div className="editor-right-column">
          <div className="editor-card narrative-card">
            <div className="editor-card-header">
              <CardHeading
                icon={Stethoscope}
                title="Clinical Narrative & Diagnosis"
                subtitle="History, observations, and final pathological diagnosis"
              />
            </div>

            <div className="editor-card-body narrative-card-body">
              <div className="narrative-field">
                <div className="narrative-label-row"><label htmlFor="ed-referrer">Referring Clinician</label><span className="field-pill optional">Optional</span></div>
                <input id="ed-referrer" name="referringClinician" value={formData.referringClinician} onChange={handleChange} disabled={isFinalized || busy} placeholder="Clinician name…" />
              </div>
              <div className="narrative-field">
                <div className="narrative-label-row">
                  <label htmlFor="ed-clinical-history">Clinical History</label>
                  <span className="field-pill optional">Optional</span>
                </div>
                <textarea
                  id="ed-clinical-history"
                  name="clinicalHistory"
                  value={formData.clinicalHistory}
                  onChange={handleChange}
                  rows={3}
                  disabled={isFinalized || busy}
                  placeholder="Enter patient history, symptoms, or indications provided with the request…"
                />
              </div>

              <div className="narrative-field">
                <div className="narrative-label-row">
                  <label htmlFor="ed-findings">Microscopic Findings</label>
                  <span className="field-pill required">
                    Needed for finalization
                  </span>
                </div>
                <textarea
                  id="ed-findings"
                  name="findings"
                  value={formData.findings}
                  onChange={handleChange}
                  rows={5}
                  disabled={isFinalized || busy}
                  placeholder="Describe gross and microscopic pathological findings and morphology…"
                  aria-invalid={Boolean(validationErrors.findings)}
                  aria-describedby={validationErrors.findings ? "ed-findings-error" : undefined}
                />
                {validationErrors.findings && <p id="ed-findings-error" className="field-error">{validationErrors.findings}</p>}
              </div>

              <div className="narrative-field">
                <div className="narrative-label-row">
                  <label htmlFor="ed-diagnosis">Diagnosis</label>
                  <span className="field-pill required">
                    Needed for finalization
                  </span>
                </div>
                <textarea
                  id="ed-diagnosis"
                  name="diagnosis"
                  value={formData.diagnosis}
                  onChange={handleChange}
                  rows={4}
                  disabled={isFinalized || busy}
                  placeholder="Enter final clinical and pathological diagnosis / impression…"
                  aria-invalid={Boolean(validationErrors.diagnosis)}
                  aria-describedby={validationErrors.diagnosis ? "ed-diagnosis-error" : undefined}
                />
                {validationErrors.diagnosis && <p id="ed-diagnosis-error" className="field-error">{validationErrors.diagnosis}</p>}
              </div>
              <div className="narrative-field">
                <div className="narrative-label-row"><label htmlFor="ed-interpretation">Interpretation / Remarks</label><span className="field-pill optional">Optional</span></div>
                <textarea id="ed-interpretation" name="interpretation" value={formData.interpretation} onChange={handleChange} rows={4} disabled={isFinalized || busy} placeholder="Report-level interpretation or remarks…" />
              </div>
            </div>
          </div>
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
