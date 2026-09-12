import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  GitBranch,
  History,
} from "lucide-react";
import PageHeading from "../components/layout/PageHeading";
import { usePatients } from "../store/PatientContext";
import { useReports } from "../store/ReportContext";

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

  function formatDate(date?: string) {
    if (!date) return "—";
    try {
      return new Date(date).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return date;
    }
  }

  const versionedReports = [...reports].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="version-history-page viewport-page">
      <div className="version-history-header-bar">
        <PageHeading
          title="Report Version History"
          subtitle="Audit and track version lineage, clinical amendments, and finalized pathology records."
        />
      </div>

      <div className="version-history-card content-card-fill">
        <div className="version-history-card-header">
          <div>
            <h3>Report Lineage Records</h3>
            <p>
              {versionedReports.length} recorded{" "}
              {versionedReports.length === 1 ? "version" : "versions"}
            </p>
          </div>
        </div>

        {versionedReports.length > 0 ? (
          <div className="version-list scrollable-container">
            {versionedReports.map((report) => {
              const pt = getPatient(report.patientId);
              const isFinalized = report.status === "finalized";
              return (
                <div className="version-item" key={report.id}>
                  <div className="version-icon">
                    <History size={17} />
                  </div>

                  <div className="version-main">
                    <div className="version-title-row">
                      <div className="version-patient-block">
                        <strong>{pt?.name ?? "Unknown Patient"}</strong>
                        <span className="version-specimen">
                          {report.testName ||
                            report.specimenType ||
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
                        Created {formatDate(report.createdAt)}
                      </span>

                      {report.supersedesReportId && (
                        <span className="amendment-label">
                          <GitBranch size={12} />
                          Amendment of previous version
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="version-open-button"
                    onClick={() => onSelectReport(report.id)}
                    title="Open report in editor"
                  >
                    <span>Open</span>
                    <ArrowRight size={15} />
                  </button>
                </div>
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
