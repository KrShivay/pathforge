import { useMemo } from "react";

import { sanitizeText } from "../../../domain/textRules.mjs";
import type { LaboratoryTest } from "../../../domain/types";
import { useTests } from "../../../store/TestContext";
import { computeFlag } from "../flags";
import { getParameterHelp } from "../parameterHelp";
import { formatReferenceRange } from "../referenceRange";

interface ResultsStepProps {
  selectedTestIds: string[];
  /** Keyed by `${testId}::${parameterId}`. */
  results: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export function resultKey(testId: string, parameterId: string): string {
  return `${testId}::${parameterId}`;
}

export default function ResultsStep({
  selectedTestIds,
  results,
  onChange,
}: ResultsStepProps) {
  const { tests } = useTests();

  const selectedTests = useMemo(
    () =>
      selectedTestIds
        .map((id) => tests.find((test) => test.id === id))
        .filter((test): test is LaboratoryTest => test !== undefined),
    [selectedTestIds, tests],
  );

  const firstResultKey = selectedTests[0]?.parameters[0]
    ? resultKey(selectedTests[0].id, selectedTests[0].parameters[0].id)
    : null;

  return (
    <div className="wizard-panel">
      <h2>Results</h2>
      <p className="wizard-panel-hint">
        Enter results for each parameter. Anything left blank can still be saved
        as a draft.
      </p>
      <p className="results-range-note">
        Reference ranges are typical adult guides. The laboratory's own range
        should be used when it differs, especially for children, pregnancy, or
        results affected by timing or treatment.
      </p>

      {selectedTests.map((test) => (
        <section key={test.id} className="results-block">
          <header className="results-block-header">
            <h3>{test.name}</h3>
            <span>
              {test.department}
              {test.specimen ? ` · ${test.specimen}` : ""}
            </span>
          </header>

          <div className="results-table-wrapper">
            <table className="results-table">
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
                  const key = resultKey(test.id, parameter.id);
                  const value = results[key] ?? "";
                  const flag = computeFlag(
                    value,
                    parameter.referenceRange?.min,
                    parameter.referenceRange?.max,
                  );
                  return (
                    <tr key={parameter.id}>
                      <td className="parameter-cell">
                        <strong>{parameter.name}</strong>
                        <span className="parameter-help">
                          {getParameterHelp(parameter.id)}
                        </span>
                      </td>
                      <td className="result-cell">
                        <input
                          aria-label={`${parameter.name} result`}
                          type="text"
                          inputMode={
                            parameter.type === "number" ? "decimal" : "text"
                          }
                          placeholder="Enter result"
                          value={value}
                          onChange={(event) =>
                            onChange(
                              key,
                              sanitizeText(event.target.value, "result"),
                            )
                          }
                          autoFocus={key === firstResultKey}
                        />
                      </td>
                      <td className="unit-cell">{parameter.unit || "—"}</td>
                      <td className="reference-cell">
                        {formatReferenceRange(parameter.referenceRange)}
                      </td>
                      <td className="flag-cell">
                        {flag ? (
                          <span className={`result-flag is-${flag}`}>
                            {flag}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
