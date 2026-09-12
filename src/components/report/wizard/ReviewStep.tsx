import { useMemo } from "react";

import type { LaboratoryTest } from "../../../domain/types";
import { usePatients } from "../../../store/PatientContext";
import { useTests } from "../../../store/TestContext";
import { computeFlag } from "../flags";
import { formatReferenceRange } from "../referenceRange";
import type { ClinicalDetails } from "./ClinicalStep";
import { resultKey } from "./ResultsStep";

interface ReviewStepProps {
  patientId: string;
  selectedTestIds: string[];
  specimenType: string;
  results: Record<string, string>;
  clinical: ClinicalDetails;
}

export default function ReviewStep({
  patientId,
  selectedTestIds,
  specimenType,
  results,
  clinical,
}: ReviewStepProps) {
  const { getPatient } = usePatients();
  const { tests } = useTests();

  const patient = getPatient(patientId);
  const selectedTests = useMemo(
    () =>
      selectedTestIds
        .map((id) => tests.find((test) => test.id === id))
        .filter((test): test is LaboratoryTest => test !== undefined),
    [selectedTestIds, tests],
  );

  return (
    <div className="wizard-panel">
      <h2>Review</h2>
      <p className="wizard-panel-hint">
        Check everything below, then save as a draft or continue to finalize.
      </p>

      <div className="review-grid">
        <div className="review-item">
          <span>Patient</span>
          <strong>{patient?.name ?? "—"}</strong>
          <em>{patient ? `${patient.age}y · ${patient.gender}` : ""}</em>
        </div>
        <div className="review-item">
          <span>Specimen</span>
          <strong>{specimenType || "—"}</strong>
        </div>
        <div className="review-item">
          <span>Tests</span>
          <strong>
            {selectedTests.map((test) => test.name).join(", ") || "—"}
          </strong>
          <em>
            {[...new Set(selectedTests.map((test) => test.department))].join(
              ", ",
            )}
          </em>
        </div>
      </div>

      {selectedTests.map((test) => (
        <section key={test.id} className="review-results">
          <h3>{test.name}</h3>
          <table className="results-table is-readonly">
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Result</th>
                <th>Unit</th>
                <th>Reference Range</th>
                <th>Flag</th>
              </tr>
            </thead>
            <tbody>
              {test.parameters.map((parameter) => {
                const value = results[resultKey(test.id, parameter.id)] ?? "";
                const flag = computeFlag(
                  value,
                  parameter.referenceRange?.min,
                  parameter.referenceRange?.max,
                );
                return (
                  <tr key={parameter.id}>
                    <td>{parameter.name}</td>
                    <td>{value || "—"}</td>
                    <td>{parameter.unit || "—"}</td>
                    <td>{formatReferenceRange(parameter.referenceRange)}</td>
                    <td className="flag-cell">
                      {flag ? (
                        <span className={`result-flag is-${flag}`}>{flag}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}

      <div className="review-narrative">
        <div>
          <span>Clinical History</span>
          <p>{clinical.clinicalHistory || "Not provided"}</p>
        </div>
        <div>
          <span>Findings</span>
          <p>{clinical.findings || "Not provided"}</p>
        </div>
        <div>
          <span>Diagnosis</span>
          <p>{clinical.diagnosis || "Not provided"}</p>
        </div>
      </div>
    </div>
  );
}
