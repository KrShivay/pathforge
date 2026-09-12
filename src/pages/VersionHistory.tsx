import {
  CheckCircle2,
  Clock,
  FileText,
  GitBranch,
  History,
} from "lucide-react";
import { useMemo, useState } from "react";
import PageHeading from "../components/layout/PageHeading";
import { usePatients } from "../store/PatientContext";
import { useReports } from "../store/ReportContext";
import { filterHistoryReports, formatDate, historyEventDate, parseDate } from "../lib/reportFilters.mjs";

interface VersionHistoryProps {
  onSelectReport: (reportId: string) => void;
  onCreateReport?: () => void;
}

export default function VersionHistory({
  onSelectReport,
  onCreateReport,
}: VersionHistoryProps) {
  const { reports } = useReports();
  const { patients } = usePatients();

  function getPatient(patientId: string) {
    return patients.find((p) => p.id === patientId);
  }

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [lifecycle, setLifecycle] = useState("all");
  const [sort, setSort] = useState("newest");
  const versionedReports = useMemo(() => filterHistoryReports(reports, patients, { search, from: dateFrom, to: dateTo, lifecycle, sort }), [reports, patients, search, dateFrom, dateTo, lifecycle, sort]);
  const invalidRange = Boolean(dateFrom && dateTo && (!parseDate(dateFrom) || !parseDate(dateTo) || dateFrom > dateTo));

  return (
    <div className="version-history-page viewport-page">
      <div className="version-history-header-bar">
        <PageHeading
          title="Report Version History"
          subtitle="Audit and track version lineage, clinical amendments, and finalized pathology records."
        />
      </div>

      <div className="pf-card version-history-card content-card-fill">
        <div className="version-history-card-header">
          <div>
            <h3>Report Lineage Records</h3>
            <p>
              {versionedReports.length} recorded{" "}
              {versionedReports.length === 1 ? "version" : "versions"}
            </p>
          </div>
          <div className="report-filter-row">
            <label>Search<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Patient or report…" /></label>
            <label>Event from<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} aria-invalid={invalidRange} aria-describedby={invalidRange ? "history-date-error" : undefined} /></label>
            <label>Event to<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} aria-invalid={invalidRange} aria-describedby={invalidRange ? "history-date-error" : undefined} /></label>
            <label>Lifecycle<select value={lifecycle} onChange={(event) => setLifecycle(event.target.value)}><option value="all">All</option><option value="draft">Draft</option><option value="finalized">Finalized</option><option value="amended">Amendments</option></select></label>
            <label>Sort<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest</option><option value="oldest">Oldest</option></select></label>
            <button type="button" className="text-button" onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); setLifecycle("all"); setSort("newest"); }}>Clear filters</button>
          </div>
          {invalidRange && <p id="history-date-error" className="form-error" role="alert">Choose an event range where the end date is on or after the start date.</p>}
        </div>

        {versionedReports.length > 0 ? (
          <div className="version-list scrollable-container">
            {versionedReports.map((report) => {
              const pt = getPatient(report.patientId);
              const isFinalized = report.status === "finalized";
              return (
                <button type="button" className="version-item" key={report.id} onClick={() => onSelectReport(report.id)} aria-label={`Open ${pt?.name ?? "patient"} report version ${report.version}`}>
                  <div className="version-icon">
                    <History size={17} />
                  </div>

                  <div className="version-main">
                    <div className="version-title-row">
                      <div className="version-patient-block">
                        <strong>{pt?.name ?? "Unknown Patient"}</strong>
                        <span className="version-specimen">
                          {report.testName ||
                            report.specimens.join(", ") ||
                            "No specimen"}
                        </span>
                      </div>

                      <div className="version-badges">
                        <span className="version-number-pill">
                          v{report.version}
                        </span>

                        {isFinalized ? (
                          <span className="status-badge finalized">
                            <CheckCircle2 size={12} />
                            Finalized
                          </span>
                        ) : (
                          <span className="status-badge draft">
                            <Clock size={12} />
                            Draft
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="version-meta">
                      <span>
                        <FileText size={13} />
                        Event {formatDate(historyEventDate(report), true)}
                      </span>

                      {report.supersedesReportId && (
                        <span className="amendment-label">
                          <GitBranch size={12} />
                          Amendment of previous version
                        </span>
                      )}
                    </div>
                  </div>

                </button>
              );
            })}
          </div>
        ) : (
          <div className="version-history-empty">
            <History size={36} />
            <h3>No version history yet</h3>
            <p>
              Report versions and amendments will appear here as you create and
              finalize reports.
            </p>
            <button
              type="button"
              className="secondary-button"
              onClick={onCreateReport}
            >
              Create Report
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
