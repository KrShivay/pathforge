import {
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Search,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import DateRangeFilter from "../components/common/DateRangeFilter";
import XlsxExportButton from "../components/common/XlsxExportButton";
import { SkeletonList } from "../components/common/Skeleton";
import SortableHeader from "../components/common/SortableHeader";
import PageHeading from "../components/layout/PageHeading";
import { checkClinicalCompleteness } from "../domain/report-bridge.mjs";
import {
  filterWorklistReports,
  formatDate as formatReportFilterDate,
  parseDate,
  sortDirection,
  sortField,
  toggleSort,
} from "../lib/reportFilters.mjs";
import { usePatients } from "../store/PatientContext";
import { useReports, type Report } from "../store/ReportContext";

interface WorklistProps {
  onSelectReport?: (reportId: string) => void;
  initialFilter?: StatusFilter;
}

type StatusFilter = "all" | "draft" | "finalized" | "attention";

export default function Worklist({
  onSelectReport,
  initialFilter = "all",
}: WorklistProps) {
  const { reports, hydrated } = useReports();
  const { patients } = usePatients();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialFilter);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState("newest");
  const invalidRange = Boolean(
    dateFrom &&
    dateTo &&
    (!parseDate(dateFrom) || !parseDate(dateTo) || dateFrom > dateTo),
  );

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
    return filterWorklistReports(reports, patients, {
      search,
      status: statusFilter,
      from: dateFrom,
      to: dateTo,
      sort,
      needsAttention: (report: Report) =>
        checkClinicalCompleteness(report).length > 0,
    });
  }, [reports, patients, search, statusFilter, dateFrom, dateTo, sort]);

  const exportRows = useMemo(
    () =>
      filteredReports.map((report) => {
        const patient = patients.find((candidate) => candidate.id === report.patientId);
        return {
          Patient: patient?.name ?? "Unknown Patient",
          "Patient ID": patient?.patientId ?? "",
          Test: report.testName ?? "",
          "Collection Date": report.specimenCollectionDate || report.createdAt.slice(0, 10),
          Status: report.status,
          Created: report.createdAt,
          Version: report.version,
          "Report ID": report.id,
        };
      }),
    [filteredReports, patients],
  );

  function getPatient(patientId: string) {
    return patients.find((patient) => patient.id === patientId);
  }

  return (
    <div className="worklist-page viewport-page">
      <div className="worklist-header-bar">
        <PageHeading
          title="Report Worklist"
          subtitle="Open drafts and finalized reports to continue pathology workflows."
          actions={
            <XlsxExportButton
              rows={exportRows}
              fileName="PathForge_Worklist.xlsx"
              label="Export XLSX"
            />
          }
        />

        <div className="worklist-toolbar">
          <div className="status-filter-group">
            <button
              type="button"
              className={`filter-tab ${statusFilter === "all" ? "is-active" : ""}`}
              aria-pressed={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
            >
              All
              <span className="tab-count">{counts.all}</span>
            </button>
            <button
              type="button"
              className={`filter-tab ${statusFilter === "draft" ? "is-active" : ""}`}
              aria-pressed={statusFilter === "draft"}
              onClick={() => setStatusFilter("draft")}
            >
              <Clock size={13} />
              Drafts
              <span className="tab-count">{counts.draft}</span>
            </button>
            <button
              type="button"
              className={`filter-tab ${statusFilter === "finalized" ? "is-active" : ""}`}
              aria-pressed={statusFilter === "finalized"}
              onClick={() => setStatusFilter("finalized")}
            >
              <CheckCircle2 size={13} />
              Finalized
              <span className="tab-count">{counts.finalized}</span>
            </button>
            <button
              type="button"
              className={`filter-tab ${statusFilter === "attention" ? "is-active" : ""}`}
              aria-pressed={statusFilter === "attention"}
              onClick={() => setStatusFilter("attention")}
            >
              Attention
              <span className="tab-count">{counts.attention}</span>
            </button>
          </div>
          <div
            className="worklist-filter-group"
            role="group"
            aria-label="Worklist filters"
          >
            <div className="report-filter-row">
              <DateRangeFilter
                id="worklist-date-range"
                from={dateFrom}
                to={dateTo}
                fromLabel="Created from"
                toLabel="Created to"
                onFromChange={setDateFrom}
                onToChange={setDateTo}
                invalid={invalidRange}
              />
              <span className="result-count" role="status">
                {filteredReports.length} result
                {filteredReports.length === 1 ? "" : "s"}
              </span>
              {(search ||
                statusFilter !== "all" ||
                dateFrom ||
                dateTo ||
                sort !== "newest") && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                    setDateFrom("");
                    setDateTo("");
                    setSort("newest");
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          <div className="patients-search worklist-search">
            <Search size={16} />
            <input
              aria-label="Search reports"
              type="text"
              placeholder="Search by patient or test…"
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

      <div className="pf-card worklist-card content-card-fill">
        <div className="worklist-table-header">
          <SortableHeader
            className="col-patient"
            label="Patient"
            active={sortField(sort) === "patient"}
            direction={sortDirection(sort)}
            onClick={() => setSort(toggleSort(sort, "patient"))}
          />
          <SortableHeader
            className="col-test"
            label="Test"
            active={sortField(sort) === "test"}
            direction={sortDirection(sort)}
            onClick={() => setSort(toggleSort(sort, "test"))}
          />
          <SortableHeader
            className="col-status"
            label="Status"
            active={sortField(sort) === "status"}
            direction={sortDirection(sort)}
            onClick={() => setSort(toggleSort(sort, "status"))}
          />
          <SortableHeader
            className="col-date"
            label="Created"
            active={sortField(sort) === "created"}
            direction={sortDirection(sort)}
            onClick={() => setSort(toggleSort(sort, "created"))}
          />
          <span className="col-action" />
        </div>

        <div className="worklist-table-body scrollable-container">
          {!hydrated ? (
            <SkeletonList count={5} />
          ) : filteredReports.length > 0 ? (
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
                    <span className="specimen-label report-collection-date">
                      Collected {formatReportFilterDate(report.specimenCollectionDate || report.createdAt)}
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
                    {formatReportFilterDate(report.createdAt)}
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
                {search ||
                statusFilter !== "all" ||
                dateFrom ||
                dateTo ||
                sort !== "newest"
                  ? "No pathology reports match your current filter criteria."
                  : "Use New Report in the top navigation to get started."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
