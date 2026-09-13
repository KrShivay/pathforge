import { Plus, Search, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import PageHeading from "../components/layout/PageHeading";
import { SkeletonList } from "../components/common/Skeleton";
import SortableHeader, {
  type SortDirection,
} from "../components/common/SortableHeader";
import PatientForm from "../components/patients/PatientForm";
import { confirmDestructive } from "../lib/dialog";
import { usePatients } from "../store/PatientContext";

type PatientSortField = "name" | "age" | "phone";

export default function Patients() {
  const { patients, loading } = usePatients();

  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<PatientSortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const formDirtyRef = useRef(false);
  const addPatientButtonRef = useRef<HTMLButtonElement>(null);
  const patientDialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // An accidental close (backdrop click, Escape) while the form has input
  // would otherwise silently discard it with no way to recover.
  async function requestCloseModal() {
    if (formDirtyRef.current) {
      const proceed = await confirmDestructive({
        title: "Discard this patient?",
        text: "The information you entered has not been saved.",
        confirmText: "Discard",
        cancelText: "Keep editing",
      });
      if (!proceed) return;
    }
    formDirtyRef.current = false;
    setIsModalOpen(false);
  }

  useEffect(() => {
    if (!isModalOpen) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") void requestCloseModal();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      requestAnimationFrame(() => (returnFocusRef.current ?? addPatientButtonRef.current)?.focus());
    };
  }, [isModalOpen]);

  function trapDialogFocus(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const focusable = [...(patientDialogRef.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href]",
    ) ?? [])];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const query = search.trim().toLowerCase();
  const filteredPatients = query
    ? patients.filter((patient) =>
        `${patient.name} ${patient.patientId} ${patient.phone}`
          .toLowerCase()
          .includes(query),
      )
    : patients;

  const sortedPatients = [...filteredPatients].sort((a, b) => {
    const comparison =
      sortField === "age"
        ? a.age - b.age
        : sortField === "phone"
          ? a.phone.localeCompare(b.phone, undefined, { numeric: true })
          : a.name.localeCompare(b.name);
    return sortDirection === "asc" ? comparison : -comparison;
  });

  function handleSort(field: PatientSortField) {
    if (field === sortField) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortDirection("asc");
  }

  return (
    <div className="patients-page viewport-page">
      <div className="patients-header-bar">
        <PageHeading
            title="Patients Directory"
          subtitle="Search patient records or register a new patient for pathology reporting."
          actions={
            <button
              ref={addPatientButtonRef}
              type="button"
              className="primary-button"
              onClick={() => {
                formDirtyRef.current = false;
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
              aria-label="Search patients"
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

      <div className="pf-card content-card-fill">
        <div className="patients-table-header">
          <SortableHeader
            className="col-p-name"
            label="Patient"
            active={sortField === "name"}
            direction={sortDirection}
            onClick={() => handleSort("name")}
          />
          <SortableHeader
            className="col-p-age"
            label="Age / Sex"
            active={sortField === "age"}
            direction={sortDirection}
            onClick={() => handleSort("age")}
          />
          <SortableHeader
            className="col-p-phone"
            label="Phone"
            active={sortField === "phone"}
            direction={sortDirection}
            onClick={() => handleSort("phone")}
          />
        </div>

        <div className="patients-table-body scrollable-container">
          {loading ? (
            <SkeletonList count={5} />
          ) : sortedPatients.length > 0 ? (
            sortedPatients.map((patient) => (
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
            ref={patientDialogRef}
            className="patient-modal"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={trapDialogFocus}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-patient-title"
          >
            <div className="modal-header">
              <div>
                <h2 id="add-patient-title">Add Patient</h2>
                <p>Register a new patient record</p>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => void requestCloseModal()}
                aria-label="Close add patient dialog"
              >
                <X size={18} />
              </button>
            </div>

            <PatientForm
              onSaved={() => setIsModalOpen(false)}
              onCancel={() => void requestCloseModal()}
              onDirtyChange={(dirty) => {
                formDirtyRef.current = dirty;
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
