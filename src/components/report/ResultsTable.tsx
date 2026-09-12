import { FlaskConical } from "lucide-react";

import { sanitizeText } from "../../domain/textRules.mjs";
import type { TestResult } from "../../store/ReportContext";
import { computeFlag } from "./flags";
import { groupResultsByTest } from "./groupResults";
import { getParameterHelp } from "./parameterHelp";
import { formatReferenceRange } from "./referenceRange";

interface ResultsTableProps {
  results: TestResult[];
  disabled: boolean;
  onResultChange: (testId: string, parameterId: string, value: string) => void;
}

/** Editable laboratory-results grid, one sub-table per test in the report. */
export default function ResultsTable({
  results,
  disabled,
  onResultChange,
}: ResultsTableProps) {
  if (results.length === 0) return null;

  const groups = groupResultsByTest(results);

  return (
    <div className="editor-section test-results-section">
      <div className="editor-section-title">
        <FlaskConical size={19} />

        <div>
          <h3>Laboratory Results</h3>
          <p>
            {groups.length === 1
              ? groups[0].testName || "Selected laboratory test"
              : `${groups.length} tests`}
          </p>
          <p className="results-range-note">
            Ranges are typical adult guides; use the laboratory's own range when
            it differs.
          </p>
        </div>
      </div>

      {groups.map((group) => (
        <div key={group.key} className="results-test-group">
          {groups.length > 1 && group.testName && (
            <h4 className="results-test-heading">{group.testName}</h4>
          )}

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
                {group.results.map((result) => {
                  const flag = computeFlag(
                    result.value,
                    result.referenceRange?.min,
                    result.referenceRange?.max,
                  );
                  return (
                    <tr key={`${result.testId}::${result.parameterId}`}>
                      <td className="parameter-cell">
                        <strong>{result.parameterName}</strong>
                        <span className="parameter-help">
                          {getParameterHelp(result.parameterId)}
                        </span>
                      </td>
                      <td className="result-cell">
                        <input
                          aria-label={`${result.parameterName} result`}
                          type="text"
                          value={result.value}
                          onChange={(event) =>
                            onResultChange(
                              result.testId,
                              result.parameterId,
                              sanitizeText(event.target.value, "result"),
                            )
                          }
                          disabled={disabled}
                        />
                      </td>
                      <td className="unit-cell">{result.unit || "—"}</td>
                      <td className="reference-cell">
                        {formatReferenceRange(result.referenceRange)}
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
        </div>
      ))}
    </div>
  );
}
