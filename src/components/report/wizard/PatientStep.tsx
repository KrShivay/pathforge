import {
  Check,
  MapPin,
  Phone,
  Search,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { confirmDestructive } from "../../../lib/dialog";
import { usePatients } from "../../../store/PatientContext";
import PatientForm from "../../patients/PatientForm";
import { filterPatients } from "./patientSearch.mjs";

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
  const { patients, loading } = usePatients();
  const [mode, setMode] = useState<Mode>("existing");
  const [search, setSearch] = useState("");
  const [newPatientDirty, setNewPatientDirty] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const allMatches = useMemo(
    () => filterPatients(patients, search),
    [patients, search],
  );
  const matchLimit = search.trim() ? 12 : 8;
  const matches = useMemo(
    () => allMatches.slice(0, matchLimit),
    [allMatches, matchLimit],
  );
  const hiddenMatchCount = allMatches.length - matches.length;

  const selected = patients.find((patient) => patient.id === selectedPatientId);

  useEffect(() => {
    if (mode === "existing") searchInputRef.current?.focus();
  }, [mode]);

  function startNewPatient() {
    // Registering a new patient replaces any current selection. This keeps the
    // report from proceeding with the old patient while the new form is open.
    onSelect("");
    setMode("new");
  }

  async function returnToSearch() {
    if (newPatientDirty) {
      const proceed = await confirmDestructive({
        title: "Discard this patient?",
        text: "The information you entered has not been saved.",
        confirmText: "Discard",
        cancelText: "Keep registering",
      });
      if (!proceed) return;
    }
    setNewPatientDirty(false);
    setMode("existing");
  }

  return (
    <div className="wizard-panel patient-selection-panel">
      <h2>Patient</h2>
      <p className="wizard-panel-hint">
        Choose an existing patient, or register a new one. A report always
        belongs to a patient.
      </p>

      {selected ? (
        <section
          className="selected-patient-summary"
          aria-label="Selected patient"
        >
          <div className="selected-patient-summary-main">
            <div className="selected-patient-icon" aria-hidden="true">
              <Check size={16} />
            </div>
            <div>
              <span className="selected-patient-label">Selected patient</span>
              <strong>{selected.name}</strong>
              <span className="selected-patient-meta">
                {selected.patientId} · {selected.age} years · {selected.gender}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="text-button patient-change-button"
            onClick={() => setMode("existing")}
          >
            Change patient
          </button>
        </section>
      ) : null}

      <div className="choice-row" role="group" aria-label="Patient record">
        <button
          type="button"
          className={`choice-card${mode === "existing" ? " is-selected" : ""}`}
          onClick={() => {
            if (mode === "new") void returnToSearch();
            else setMode("existing");
          }}
          aria-pressed={mode === "existing"}
        >
          <UserCheck size={18} />
          <span>
            <strong>Use an existing patient</strong>
            Search by name, RMN, or phone
          </span>
        </button>

        <button
          type="button"
          className={`choice-card${mode === "new" ? " is-selected" : ""}`}
          onClick={startNewPatient}
          aria-pressed={mode === "new"}
        >
          <UserPlus size={18} />
          <span>
            <strong>Register new patient</strong>
            Create a new record when there is no match
          </span>
        </button>
      </div>

      {mode === "existing" ? (
        <div className="existing-patient">
          <label htmlFor="patient-search-input" className="patient-search-label">
            Search patient
          </label>
          <div className="patients-search patient-search-primary">
            <Search size={19} aria-hidden="true" />
            <input
              ref={searchInputRef}
              id="patient-search-input"
              type="text"
              aria-label="Search patient"
              placeholder="Search by name or RMN"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <p className="patient-search-hint">
            Search by patient name, RMN/patient ID, or phone number.
          </p>

          {loading ? (
            <div className="patient-search-state" role="status">
              Loading patient records…
            </div>
          ) : patients.length === 0 ? (
            <div className="patient-search-empty">
              <h3>No patient records yet</h3>
              <p>Register a new patient to begin this report.</p>
              <button
                type="button"
                className="secondary-button"
                onClick={startNewPatient}
              >
                <UserPlus size={15} />
                Register new patient
              </button>
            </div>
          ) : matches.length === 0 ? (
            <div className="patient-search-empty" role="status">
              <h3>No matching patients</h3>
              <p>Try a different name, RMN/patient ID, or phone number.</p>
              <button
                type="button"
                className="secondary-button"
                onClick={startNewPatient}
              >
                <UserPlus size={15} />
                Register new patient
              </button>
            </div>
          ) : (
            <ul className="patient-pick-list" aria-label="Matching patients">
              {matches.map((patient) => {
                const isSelected = patient.id === selectedPatientId;
                return (
                  <li key={patient.id}>
                    <button
                      type="button"
                      className={`patient-pick${
                        isSelected ? " is-selected" : ""
                      }`}
                      onClick={() => onSelect(patient.id)}
                      aria-pressed={isSelected}
                    >
                      <div className="patient-pick-main">
                        <span className="patient-pick-name">
                          {patient.name}
                        </span>
                        <span className="patient-pick-id">
                          RMN / Patient ID: {patient.patientId}
                        </span>
                      </div>
                      <div className="patient-pick-details">
                        <span>{patient.age} years</span>
                        <span>{patient.gender}</span>
                        {patient.phone ? (
                          <span>
                            <Phone size={13} aria-hidden="true" />
                            {patient.phone}
                          </span>
                        ) : null}
                        {patient.address ? (
                          <span>
                            <MapPin size={13} aria-hidden="true" />
                            {patient.address}
                          </span>
                        ) : null}
                      </div>
                      <span className={`patient-pick-action${isSelected ? " is-selected" : ""}`}>
                        {isSelected ? (
                          <>
                            <Check size={14} />
                            Selected
                          </>
                        ) : (
                          "Select"
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
              {hiddenMatchCount > 0 ? (
                <li className="patient-list-hint">
                  {hiddenMatchCount} more{" "}
                  {hiddenMatchCount === 1 ? "match" : "matches"} — refine your
                  search to narrow the list.
                </li>
              ) : null}
            </ul>
          )}
        </div>
      ) : (
        <div className="new-patient">
          <div className="new-patient-heading">
            <div>
              <h3>Register new patient</h3>
              <p>Patient ID/RMN is generated automatically after saving.</p>
            </div>
          </div>
          <PatientForm
            submitLabel="Save patient & continue"
            cancelLabel="Back to patient search"
            onCancel={() => void returnToSearch()}
            onDirtyChange={setNewPatientDirty}
            onSaved={(patientId) => {
              setNewPatientDirty(false);
              setMode("existing");
              onSelect(patientId);
              onAdvance();
            }}
          />
        </div>
      )}
    </div>
  );
}
