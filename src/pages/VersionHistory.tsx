import {
  CheckCircle2,
  Clock,
  FileText,
  GitBranch,
  History,
} from "lucide-react";
import { useMemo, useState } from "react";
import CardHeading from "../components/common/CardHeading";
import DateRangeFilter from "../components/common/DateRangeFilter";
import XlsxExportButton from "../components/common/XlsxExportButton";
import SortableHeader from "../components/common/SortableHeader";
import PageHeading from "../components/layout/PageHeading";
import { usePatients } from "../store/PatientContext";
import { useReports } from "../store/ReportContext";
import {
  filterHistoryReports,
  formatDate,
  historyEventDate,
  parseDate,
  sortDirection,
  sortField,
  toggleSort,
} from "../lib/reportFilters.mjs";

interface VersionHistoryProps {
  onSelectReport: (reportId: string) => void;
}

export default function VersionHistory({
  onSelectReport,
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
  const exportRows = useMemo(
    () =>
      versionedReports.map((report) => ({
        Patient: getPatient(report.patientId)?.name ?? "Unknown Patient",
        "Patient ID": getPatient(report.patientId)?.patientId ?? "",
        Test: report.testName ?? "",
        Specimen: report.specimens.join(", "),
        Version: report.version,
        Status: report.status,
        Event: historyEventDate(report),
        "Report ID": report.id,
      })),
    [versionedReports, patients],
  );

  return (
    <div className="version-history-page viewport-page">
      <div className="version-history-header-bar">
        <PageHeading
          title="Report Version History"
          subtitle="Audit and track version lineage, clinical amendments, and finalized pathology records."
          actions={
            <XlsxExportButton
              rows={exportRows}
              fileName="PathForge_Version_History.xlsx"
              label="Export XLSX"
            />
          }
        />
      </div>

      <div className="pf-card version-history-card content-card-fill">
        <div className="version-history-card-header">
          <CardHeading
            icon={History}
            title="Report Lineage Records"
            subtitle={
              <>
              {versionedReports.length} recorded{" "}
              {versionedReports.length === 1 ? "version" : "versions"}
              </>
            }
          />
          <div className="report-filter-row">
            <label>Search<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Patient or report…" /></label>
            <DateRangeFilter
              id="history-date-range"
              from={dateFrom}
              to={dateTo}
              fromLabel="Event from"
              toLabel="Event to"
              onFromChange={setDateFrom}
              onToChange={setDateTo}
              invalid={invalidRange}
            />
            <label>Lifecycle<select value={lifecycle} onChange={(event) => setLifecycle(event.target.value)}><option value="all">All</option><option value="draft">Draft</option><option value="finalized">Finalized</option><option value="amended">Amendments</option></select></label>
            <button type="button" className="text-button" onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); setLifecycle("all"); setSort("newest"); }}>Clear filters</button>
          </div>
        </div>

        {versionedReports.length > 0 ? (
          <>
            <div className="version-list-header">
              <span className="version-list-icon-space" aria-hidden="true" />
              <SortableHeader
                className="version-col-patient"
                label="Patient"
                active={sortField(sort) === "patient"}
                direction={sortDirection(sort)}
                onClick={() => setSort(toggleSort(sort, "patient"))}
              />
              <SortableHeader
                className="version-col-version"
                label="Version"
                active={sortField(sort) === "version"}
                direction={sortDirection(sort)}
                onClick={() => setSort(toggleSort(sort, "version"))}
              />
              <SortableHeader
                className="version-col-status"
                label="Status"
                active={sortField(sort) === "status"}
                direction={sortDirection(sort)}
                onClick={() => setSort(toggleSort(sort, "status"))}
              />
              <SortableHeader
                className="version-col-event"
                label="Event"
                active={sortField(sort) === "created"}
                direction={sortDirection(sort)}
                onClick={() => setSort(toggleSort(sort, "created"))}
              />
            </div>
            <div className="version-list scrollable-container">
            {versionedReports.map((report) => {
              const pt = getPatient(report.patientId);
              const isFinalized = report.status === "finalized";
              return (
                <button type="button" className="version-item" key={report.id} onClick={() => onSelectReport(report.id)} aria-label={`Open ${pt?.name ?? "patient"} report version ${report.version}`}>
                  <div className="version-icon">
                    <History size={17} />
                  </div>

                  <div className="version-patient-block">
                    <strong>{pt?.name ?? "Unknown Patient"}</strong>
                    <span className="version-specimen">
                      {report.testName ||
                        report.specimens.join(", ") ||
                        "No specimen"}
                    </span>
                    <span className="version-specimen version-collection-date">
                      Collected {formatDate(report.specimenCollectionDate || report.createdAt, true)}
                    </span>
                  </div>

                  <div className="version-number-cell">
                    <span className="version-number-pill">v{report.version}</span>
                  </div>

                  <div className="version-status-cell">
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

                  <div className="version-event-cell">
                    <span>
                      <FileText size={13} />
                      {formatDate(historyEventDate(report), true)}
                    </span>

                    {report.supersedesReportId && (
                      <span className="amendment-label">
                        <GitBranch size={12} />
                        Amendment
                      </span>
                    )}
                  </div>

                </button>
              );
            })}
            </div>
          </>
        ) : (
          <div className="version-history-empty">
            <History size={36} />
            <h3>No version history yet</h3>
            <p>
              Report versions and amendments will appear here as you create and
              finalize reports.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
