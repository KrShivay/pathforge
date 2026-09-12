import { useMemo } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";

import { useTests } from "../../../store/TestContext";
import type { LaboratoryTest } from "../../../domain/types";
import { normalizeSpecimens } from "../../../domain/report-bridge.mjs";

interface TestSpecimenStepProps {
  selectedTestIds: string[];
  specimens: string[];
  onChangeTests: (testIds: string[]) => void;
  onChangeSpecimens: (specimens: string[]) => void;
}

const COMMON_SPECIMENS = [
  "Whole Blood EDTA",
  "Serum",
  "Plasma",
  "Urine",
  "Stool",
  "CSF",
  "Sputum",
  "Swab",
  "Tissue",
];

export default function TestSpecimenStep({
  selectedTestIds,
  specimens,
  onChangeTests,
  onChangeSpecimens,
}: TestSpecimenStepProps) {
  const { tests } = useTests();

  const selectedTests = useMemo(
    () =>
      selectedTestIds
        .map((id) => tests.find((test) => test.id === id))
        .filter((test): test is LaboratoryTest => test !== undefined),
    [selectedTestIds, tests]
  );

  const specimenOptions = useMemo(() => {
    const fromTests = selectedTests
      .map((test) => test.specimen)
      .filter((value): value is string => Boolean(value));
    return [...new Set([...fromTests, ...COMMON_SPECIMENS])];
  }, [selectedTests]);

  return (
    <div className="wizard-panel">
      <h2>Test &amp; specimen</h2>
      <p className="wizard-panel-hint">
        Pick one or more laboratory tests. Each brings its own department,
        parameters, units and reference ranges.
      </p>

      <div className="wizard-field">
        <label>Laboratory tests</label>
        <Autocomplete
          multiple
          autoFocus
          disableCloseOnSelect
          options={[...tests].sort((a, b) =>
            a.department.localeCompare(b.department)
          )}
          groupBy={(option) => option.department}
          getOptionLabel={(option) => option.name}
          value={selectedTests}
          onChange={(_event, value) =>
            onChangeTests(value.map((test) => test.id))
          }
          isOptionEqualToValue={(option, value) => option.id === value.id}
          renderOption={(props, option) => {
            const { key, ...rest } = props;
            return (
              <li key={key} {...rest}>
                <div className="test-option">
                  <span>{option.name}</span>
                  <span className="test-option-meta">
                    {option.parameters.length}{" "}
                    {option.parameters.length === 1 ? "parameter" : "parameters"}
                  </span>
                </div>
              </li>
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder={
                selectedTests.length === 0 ? "Search tests…" : undefined
              }
            />
          )}
          noOptionsText="No tests configured — add tests under Test Management"
        />
      </div>

      <div className="wizard-field">
        <label>Specimen</label>
        <Autocomplete
          multiple
          freeSolo
          options={specimenOptions}
          value={specimens}
          onChange={(_event, value) => onChangeSpecimens(normalizeSpecimens(value))}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Select or type a specimen…"
            />
          )}
        />
        <p className="wizard-field-hint">
          Choose suggested specimens or type a custom value and press Enter.
        </p>
      </div>
    </div>
  );
}
