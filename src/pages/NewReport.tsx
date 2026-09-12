import { ArrowLeft, ArrowRight, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { notifyError, notifySuccess } from "../lib/dialog";

import type { LaboratoryTest } from "../domain/types";
import { usePatients } from "../store/PatientContext";
import {
  useReports,
  type Report,
  type TestResult,
} from "../store/ReportContext";
import { useTests } from "../store/TestContext";

import {
  buildReportModel,
  type ReportModel,
} from "../components/report/reportModel";
import ReportPreviewModal from "../components/report/ReportPreviewModal";
import ClinicalStep, {
  type ClinicalDetails,
} from "../components/report/wizard/ClinicalStep";
import PatientStep from "../components/report/wizard/PatientStep";
import ResultsStep, {
  resultKey,
} from "../components/report/wizard/ResultsStep";
import ReviewStep from "../components/report/wizard/ReviewStep";
import Stepper from "../components/report/wizard/Stepper";
import TestSpecimenStep from "../components/report/wizard/TestSpecimenStep";

interface NewReportProps {
  onOpenReport: (reportId: string) => void;
  /** Reports whether the wizard has any unsaved progress, so the host app can
   * confirm before navigating away discards it. */
  onDirtyChange?: (dirty: boolean) => void;
}

const STEPS = [
  "Patient",
  "Test & specimen",
  "Results",
  "Clinical details",
  "Review",
];

function distinct(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim() !== ""))];
}

export default function NewReport({
  onOpenReport,
  onDirtyChange,
}: NewReportProps) {
  const { addReport } = useReports();
  const { tests } = useTests();
  const { getPatient } = usePatients();

  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [saving, setSaving] = useState(false);
  const [draftPreview, setDraftPreview] = useState<{
    model: ReportModel;
    reportId: string;
  } | null>(null);

  const [patientId, setPatientId] = useState("");
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [specimenType, setSpecimenType] = useState("");
  const [results, setResults] = useState<Record<string, string>>({});
  const [clinical, setClinical] = useState<ClinicalDetails>({
    clinicalHistory: "",
    findings: "",
    diagnosis: "",
  });

  useEffect(() => {
    const hasProgress =
      patientId !== "" ||
      selectedTestIds.length > 0 ||
      specimenType.trim() !== "" ||
      Object.values(results).some((value) => value.trim() !== "") ||
      clinical.clinicalHistory.trim() !== "" ||
      clinical.findings.trim() !== "" ||
      clinical.diagnosis.trim() !== "";
    onDirtyChange?.(hasProgress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, selectedTestIds, specimenType, results, clinical]);

  const selectedTests = useMemo(
    () =>
      selectedTestIds
        .map((id) => tests.find((test) => test.id === id))
        .filter((test): test is LaboratoryTest => test !== undefined),
    [selectedTestIds, tests],
  );

  const stepValid = [
    getPatient(patientId) !== undefined,
    selectedTests.length > 0 && specimenType.trim() !== "",
    true,
    true,
    true,
  ];

  const canSave = stepValid[0] && stepValid[1];

  function goTo(next: number) {
    setStep(next);
    setFurthest((current) => Math.max(current, next));
  }

  function next() {
    if (step < STEPS.length - 1 && stepValid[step]) goTo(step + 1);
  }

  function jumpTo(nextStep: number) {
    // Reached steps remain revisitable, but the stepper must not bypass a
    // cleared patient or an incomplete test/specimen step.
    if (nextStep > 0 && !stepValid[0]) return;
    if (nextStep > 1 && !stepValid[1]) return;
    setStep(nextStep);
  }

  function back() {
    if (step > 0) setStep(step - 1);
  }

  function buildReport(): Report {
    const testResults: TestResult[] = selectedTests.flatMap((test) =>
      test.parameters.map((parameter) => ({
        parameterId: parameter.id,
        parameterName: parameter.name,
        testId: test.id,
        testName: test.name,
        unit: parameter.unit ?? "",
        referenceRange: parameter.referenceRange,
        value: results[resultKey(test.id, parameter.id)] ?? "",
      })),
    );

    return {
      id: crypto.randomUUID(),
      patientId,
      specimenType: specimenType.trim(),
      clinicalHistory: clinical.clinicalHistory,
      findings: clinical.findings,
      diagnosis: clinical.diagnosis,
      testId: selectedTests.map((test) => test.id).join(","),
      testName: selectedTests.map((test) => test.name).join(", "),
      department: distinct(selectedTests.map((test) => test.department)).join(
        ", ",
      ),
      testResults,
      status: "draft",
      version: 1,
      createdAt: new Date().toISOString(),
    };
  }

  function modelForDraft(draft: Report): ReportModel {
    const patient = getPatient(draft.patientId);
    return buildReportModel({
      patientName: patient?.name ?? "Unknown Patient",
      patientCode: patient?.patientId ?? "Unknown ID",
      patientAge: patient?.age,
      patientSex: patient?.gender,
      patientPhone: patient?.phone,
      reportId: draft.id,
      version: draft.version,
      isFinalized: false,
      panelName: draft.testName,
      department: draft.department,
      reportDate: draft.createdAt,
      content: {
        specimenType: draft.specimenType,
        clinicalHistory: draft.clinicalHistory,
        findings: draft.findings,
        diagnosis: draft.diagnosis,
        testResults: draft.testResults,
      },
    });
  }

  async function save(proceed: boolean) {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const draft = await addReport(buildReport());
      if (!draft) throw new Error("The report could not be created.");

      if (proceed) {
        onOpenReport(draft.id);
        return;
      }

      // Save as Draft: confirm, then show the draft preview before the editor
      // (spec §18). Closing the preview opens the actual draft.
      await notifySuccess({ title: "Draft saved" });
      setDraftPreview({ model: modelForDraft(draft), reportId: draft.id });
    } catch (error) {
      await notifyError({
        title: "Could not save the report",
        text: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="wizard-page viewport-page">
      <div className="wizard-header">
        <div>
          <h1>New Report</h1>
          <p>Follow the steps to create and configure a pathology report.</p>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => void save(false)}
          disabled={!canSave || saving}
          title={
            canSave
              ? "Save current progress as a draft"
              : "Choose a patient, at least one test and a specimen first"
          }
        >
          <Save size={15} />
          Save as Draft
        </button>
      </div>
      {!canSave ? (
        <p className="wizard-prerequisite">
          To save a draft, choose a patient, at least one test, and a specimen.
        </p>
      ) : null}

      <Stepper
        steps={STEPS}
        current={step}
        furthest={furthest}
        onJump={jumpTo}
      />

      <div className="wizard-body content-card-fill scrollable-container">
        {step === 0 && (
          <PatientStep
            selectedPatientId={patientId}
            onSelect={(id) => {
              setPatientId(id);
              if (id) {
                setFurthest((current) => Math.max(current, 1));
              }
            }}
            onAdvance={() => goTo(1)}
          />
        )}

        {step === 1 && (
          <TestSpecimenStep
            selectedTestIds={selectedTestIds}
            specimenType={specimenType}
            onChangeTests={setSelectedTestIds}
            onChangeSpecimen={setSpecimenType}
          />
        )}

        {step === 2 && (
          <ResultsStep
            selectedTestIds={selectedTestIds}
            results={results}
            onChange={(key, value) =>
              setResults((previous) => ({ ...previous, [key]: value }))
            }
          />
        )}

        {step === 3 && (
          <ClinicalStep
            value={clinical}
            onChange={(patch) =>
              setClinical((previous) => ({ ...previous, ...patch }))
            }
          />
        )}

        {step === 4 && (
          <ReviewStep
            patientId={patientId}
            selectedTestIds={selectedTestIds}
            specimenType={specimenType}
            results={results}
            clinical={clinical}
          />
        )}
      </div>

      <div className="wizard-nav">
        <button
          type="button"
          className="secondary-button"
          onClick={back}
          disabled={step === 0 || saving}
        >
          <ArrowLeft size={16} />
          Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            className="primary-button"
            onClick={next}
            disabled={!stepValid[step] || saving}
          >
            Next
            <ArrowRight size={16} />
          </button>
        ) : (
          <div className="wizard-nav-final">
            <button
              type="button"
              className="secondary-button"
              onClick={() => void save(false)}
              disabled={!canSave || saving}
            >
              <Save size={16} />
              Save as Draft
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => void save(true)}
              disabled={!canSave || saving}
            >
              Save &amp; Proceed to Finalize
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>

      {draftPreview && (
        <ReportPreviewModal
          model={draftPreview.model}
          label="DRAFT PREVIEW"
          onClose={() => {
            const { reportId } = draftPreview;
            setDraftPreview(null);
            onOpenReport(reportId);
          }}
        />
      )}
    </div>
  );
}
