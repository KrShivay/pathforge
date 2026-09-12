import { Search, UserCheck, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";

import { usePatients } from "../../../store/PatientContext";
import PatientForm from "../../patients/PatientForm";

interface PatientStepProps {
  selectedPatientId: string;
  onSelect: (patientId: string) => void;
  /** Move to the next step (Test & specimen). */
  onAdvance: () => void;
}

type Mode = "existing" | "new";

export default function PatientStep({
  selectedPatientId,
  onSelect,
  onAdvance,
}: PatientStepProps) {
  const { patients } = usePatients();
  const [mode, setMode] = useState<Mode>(
    patients.length > 0 ? "existing" : "new",
  );
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const allMatches = useMemo(() => {
    if (!query) return patients;
    return patients.filter((patient) =>
      `${patient.name} ${patient.patientId} ${patient.phone}`
        .toLowerCase()
        .includes(query),
    );
  }, [patients, query]);
  const matchLimit = query ? 12 : 8;
  const matches = useMemo(
    () => allMatches.slice(0, matchLimit),
    [allMatches, matchLimit],
  );
  const hiddenMatchCount = allMatches.length - matches.length;

  const selected = patients.find((patient) => patient.id === selectedPatientId);

  return (
    <div className="wizard-panel">
      <h2>Patient</h2>
      <p className="wizard-panel-hint">
        Choose an existing patient, or register a new one. A report always
        belongs to a patient.
      </p>

      <div className="choice-row">
        <button
          type="button"
          className={`choice-card${mode === "existing" ? " is-selected" : ""}`}
          onClick={() => setMode("existing")}
        >
          <UserCheck size={18} />
          <span>
            <strong>Use an existing patient</strong>
            Search by name or phone
          </span>
        </button>

        <button
          type="button"
          className={`choice-card${mode === "new" ? " is-selected" : ""}`}
          onClick={() => setMode("new")}
        >
          <UserPlus size={18} />
          <span>
            <strong>Create a new patient</strong>
            Patient record is created automatically
          </span>
        </button>
      </div>

      {mode === "existing" ? (
        <div className="existing-patient">
          <div className="patients-search">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search patients…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              autoFocus
            />
          </div>

          {patients.length === 0 ? (
            <p className="form-hint">
              No patients yet — switch to “Create a new patient”.
            </p>
          ) : (
            <ul className="patient-pick-list">
              {matches.map((patient) => (
                <li key={patient.id}>
                  <button
                    type="button"
                    className={`patient-pick${
                      patient.id === selectedPatientId ? " is-selected" : ""
                    }`}
                    onClick={() => onSelect(patient.id)}
                  >
                    <span className="patient-pick-name">{patient.name}</span>
                    <span className="patient-pick-meta">
                      {patient.age}y · {patient.gender}
                      {patient.phone ? ` · ${patient.phone}` : ""}
                    </span>
                  </button>
                </li>
              ))}
              {matches.length === 0 ? (
                <li className="form-hint">No patient matches “{search}”.</li>
              ) : null}
              {hiddenMatchCount > 0 ? (
                <li className="form-hint">
                  {hiddenMatchCount} more{" "}
                  {hiddenMatchCount === 1 ? "match" : "matches"} — refine your
                  search to narrow the list.
                </li>
              ) : null}
            </ul>
          )}

          {selected ? (
            <p className="selection-confirm">
              Selected: <strong>{selected.name}</strong>
            </p>
          ) : null}
        </div>
      ) : (
        <div className="new-patient">
          <PatientForm
            submitLabel="Save patient & continue"
            onSaved={(patientId) => {
              // A freshly registered patient goes straight into the report
              // (spec: "directly redirected to the report making page").
              onSelect(patientId);
              onAdvance();
            }}
          />
        </div>
      )}
    </div>
  );
}
