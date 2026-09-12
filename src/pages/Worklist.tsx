import {
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Search,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import PageHeading from "../components/layout/PageHeading";
import { checkClinicalCompleteness } from "../domain/report-bridge.mjs";
import { usePatients } from "../store/PatientContext";
import { useReports } from "../store/ReportContext";

interface WorklistProps {
  onSelectReport?: (reportId: string) => void;
  onCreateReport?: () => void;
  initialFilter?: StatusFilter;
}

type StatusFilter = "all" | "draft" | "finalized" | "attention";

export default function Worklist({
  onSelectReport,
  onCreateReport,
  initialFilter = "all",
}: WorklistProps) {
  const { reports } = useReports();
  const { patients } = usePatients();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialFilter);

  const counts = useMemo(() => {
    const drafts = reports.filter((r) => r.status === "draft").length;
    const finalized = reports.filter((r) => r.status === "finalized").length;
    const attention = reports.filter(
      (report) =>
        report.status === "draft" &&
        checkClinicalCompleteness(report).length > 0,
    ).length;
    return { all: reports.length, draft: drafts, finalized, attention };
  }, [reports]);

  const filteredReports = useMemo(() => {
    const query = search.trim().toLowerCase();
    return reports.filter((report) => {
      if (statusFilter === "attention") {
        if (
          report.status !== "draft" ||
          checkClinicalCompleteness(report).length === 0
        )
          return false;
      } else if (statusFilter !== "all" && report.status !== statusFilter)
        return false;
      if (!query) return true;

      const patient = patients.find((p) => p.id === report.patientId);
      const patientName = patient?.name ?? "";
      const patientCode = patient?.patientId ?? "";
      const testName = report.testName ?? "";
      const specimen = report.specimenType ?? "";

      return `${patientName} ${patientCode} ${testName} ${specimen}`
        .toLowerCase()
        .includes(query);
    });
  }, [reports, patients, search, statusFilter]);

  function getPatient(patientId: string) {
    return patients.find((patient) => patient.id === patientId);
  }

  function formatDate(date: string) {
    try {
      return new Date(date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return date;
    }
  }

  return (
    <div className="worklist-page viewport-page">
      <div className="worklist-header-bar">
        <PageHeading
          title="Report Worklist"
          subtitle="Open drafts and finalized reports to continue pathology workflows."
        />

        <div className="worklist-toolbar">
          <div className="status-filter-group">
            <button
              type="button"
              className={`filter-tab ${statusFilter === "all" ? "is-active" : ""}`}
              onClick={() => setStatusFilter("all")}
            >
              All
              <span className="tab-count">{counts.all}</span>
            </button>
            <button
              type="button"
              className={`filter-tab ${statusFilter === "draft" ? "is-active" : ""}`}
              onClick={() => setStatusFilter("draft")}
            >
              <Clock size={13} />
              Drafts
              <span className="tab-count">{counts.draft}</span>
            </button>
            <button
              type="button"
              className={`filter-tab ${statusFilter === "finalized" ? "is-active" : ""}`}
              onClick={() => setStatusFilter("finalized")}
            >
              <CheckCircle2 size={13} />
              Finalized
              <span className="tab-count">{counts.finalized}</span>
            </button>
            <button
              type="button"
              className={`filter-tab ${statusFilter === "attention" ? "is-active" : ""}`}
              onClick={() => setStatusFilter("attention")}
            >
              Attention
              <span className="tab-count">{counts.attention}</span>
            </button>
          </div>

          <div className="patients-search worklist-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search by patient, ID, test, or specimen…"
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
        </div>
      </div>

      <div className="worklist-card content-card-fill">
        <div className="worklist-table-header">
          <span className="col-patient">Patient</span>
          <span className="col-test">Test / Specimen</span>
          <span className="col-status">Status</span>
          <span className="col-date">Created</span>
          <span className="col-action" />
        </div>

        <div className="worklist-table-body scrollable-container">
          {filteredReports.length > 0 ? (
            filteredReports.map((report) => {
              const pt = getPatient(report.patientId);
              const isFinalized = report.status === "finalized";
              return (
                <button
                  type="button"
                  className="worklist-row"
                  key={report.id}
                  onClick={() => onSelectReport?.(report.id)}
                >
                  <div className="report-patient col-patient">
                    <div className="report-avatar">
                      <FileText size={16} />
                    </div>
                    <div className="patient-cell-info">
                      <strong className="patient-name">
                        {pt?.name ?? "Unknown Patient"}
                      </strong>
                    </div>
                  </div>

                  <div className="col-test test-cell-info">
                    <strong className="test-name">
                      {report.testName || "Laboratory Test"}
                    </strong>
                    <span className="specimen-label">
                      {report.specimenType || "Unspecified"}
                    </span>
                  </div>

                  <div className="col-status">
                    {isFinalized ? (
                      <span className="status-badge finalized">
                        <CheckCircle2 size={13} />
                        Finalized
                      </span>
                    ) : (
                      <span className="status-badge draft">
                        <Clock size={13} />
                        Draft
                      </span>
                    )}
                  </div>

                  <div className="col-date date-text">
                    {formatDate(report.createdAt)}
                  </div>

                  <div className="col-action">
                    <ChevronRight size={17} className="worklist-arrow" />
                  </div>
                </button>
              );
            })
          ) : (
            <div className="worklist-empty">
              <FileText size={36} />
              <h3>No reports found</h3>
              <p>
                {search || statusFilter !== "all"
                  ? "No pathology reports match your current filter criteria."
                  : "Create a new pathology report to get started."}
              </p>
              {!search && statusFilter === "all" ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={onCreateReport}
                >
                  Create Report
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
