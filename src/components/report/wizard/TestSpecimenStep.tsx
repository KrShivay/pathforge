import { useMemo } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";

import { useTests } from "../../../store/TestContext";
import type { LaboratoryTest } from "../../../domain/types";

interface TestSpecimenStepProps {
  selectedTestIds: string[];
  specimenCollectionDate: string;
  onChangeTests: (testIds: string[]) => void;
  onChangeSpecimenCollectionDate: (value: string) => void;
}

export default function TestSpecimenStep({
  selectedTestIds,
  specimenCollectionDate,
  onChangeTests,
  onChangeSpecimenCollectionDate,
}: TestSpecimenStepProps) {
  const { tests } = useTests();

  const selectedTests = useMemo(
    () =>
      selectedTestIds
        .map((id) => tests.find((test) => test.id === id))
        .filter((test): test is LaboratoryTest => test !== undefined),
    [selectedTestIds, tests]
  );

  return (
    <div className="wizard-panel">
      <h2>Tests</h2>
      <p className="wizard-panel-hint">
        Pick one or more laboratory tests. Each brings its own parameters, units
        and reference ranges.
      </p>

      <div className="wizard-field">
        <label htmlFor="nr-laboratory-tests">Laboratory tests</label>
        <Autocomplete
          id="nr-laboratory-tests"
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
        <label htmlFor="nr-specimen-collection-date">Collection date</label>
        <input
          id="nr-specimen-collection-date"
          type="date"
          value={specimenCollectionDate}
          onChange={(event) => onChangeSpecimenCollectionDate(event.target.value)}
        />
        <p className="wizard-field-hint">
          Defaults to the report creation date.
        </p>
      </div>

    </div>
  );
}
