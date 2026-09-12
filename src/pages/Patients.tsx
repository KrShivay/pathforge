import { Plus, Search, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import PageHeading from "../components/layout/PageHeading";
import PatientForm from "../components/patients/PatientForm";
import { confirmDestructive } from "../lib/dialog";
import { usePatients } from "../store/PatientContext";

export default function Patients() {
  const { patients, loading } = usePatients();

  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formDirty, setFormDirty] = useState(false);

  // An accidental close (backdrop click, Escape) while the form has input
  // would otherwise silently discard it with no way to recover.
  async function requestCloseModal() {
    if (formDirty) {
      const proceed = await confirmDestructive({
        title: "Discard this patient?",
        text: "The information you entered has not been saved.",
        confirmText: "Discard",
        cancelText: "Keep editing",
      });
      if (!proceed) return;
    }
    setIsModalOpen(false);
  }

  useEffect(() => {
    if (!isModalOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") void requestCloseModal();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen, formDirty]);

  const query = search.trim().toLowerCase();
  const filteredPatients = query
    ? patients.filter((patient) =>
        `${patient.name} ${patient.patientId} ${patient.phone}`
          .toLowerCase()
          .includes(query),
      )
    : patients;

  return (
    <div className="patients-page viewport-page">
      <div className="patients-header-bar">
        <PageHeading
          title="Patients Directory"
          subtitle="Search patient records or register a new patient for pathology reporting."
          actions={
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                setFormDirty(false);
                setIsModalOpen(true);
              }}
            >
              <Plus size={16} />
              Add Patient
            </button>
          }
        />

        <div className="page-toolbar patients-toolbar">
          <div className="patients-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search by name or phone…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search ? (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          <div className="toolbar-counter">
            <span>
              {loading
                ? "Loading…"
                : `${filteredPatients.length} patient ${
                    filteredPatients.length === 1 ? "record" : "records"
                  }`}
            </span>
          </div>
        </div>
      </div>

      <div className="patients-card content-card-fill">
        <div className="patients-table-header">
          <span className="col-p-name">Patient</span>
          <span className="col-p-age">Age / Sex</span>
          <span className="col-p-phone">Phone</span>
        </div>

        <div className="patients-table-body scrollable-container">
          {loading ? (
            <div className="no-results">
              <p>Loading patient records…</p>
            </div>
          ) : filteredPatients.length > 0 ? (
            filteredPatients.map((patient) => (
              <div className="table-row patients-row" key={patient.id}>
                <div className="patient-name col-p-name">
                  <div className="patient-avatar">
                    <Users size={16} />
                  </div>
                  <div>
                    <strong className="patient-display-name">
                      {patient.name}
                    </strong>
                  </div>
                </div>

                <div className="col-p-age">
                  <span className="demographics-pill">
                    {patient.age} yrs · {patient.gender}
                  </span>
                </div>

                <div className="col-p-phone">
                  <span className="phone-text">{patient.phone || "—"}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="no-results">
              <Users size={32} />
              <h3>No patients found</h3>
              <p>
                {query
                  ? "No patient matches your search."
                  : "Add your first patient record to begin."}
              </p>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => void requestCloseModal()}>
          <div
            className="patient-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>Add Patient</h2>
                <p>Register a new patient record</p>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => void requestCloseModal()}
              >
                <X size={18} />
              </button>
            </div>

            <PatientForm
              onSaved={() => setIsModalOpen(false)}
              onCancel={() => setIsModalOpen(false)}
              onDirtyChange={setFormDirty}
            />
          </div>
        </div>
      )}
    </div>
  );
}
