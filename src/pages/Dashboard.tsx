import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  History,
  Plus,
  Users,
} from "lucide-react";
import type { Page } from "../components/layout/TopNav";
import { checkClinicalCompleteness } from "../domain/report-bridge.mjs";
import { usePatients } from "../store/PatientContext";
import { useReports } from "../store/ReportContext";

interface DashboardProps {
  onNavigate: (
    page: Page,
    filter?: "all" | "draft" | "finalized" | "attention",
  ) => void;
  onSelectReport: (reportId: string) => void;
}

function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatTodayDate(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatReportDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export default function Dashboard({
  onNavigate,
  onSelectReport,
}: DashboardProps) {
  const { patients } = usePatients();
  const { reports } = useReports();

  const draftReports = reports.filter((report) => report.status === "draft");
  const finalizedReports = reports.filter(
    (report) => report.status === "finalized",
  );
  const needsAttentionReports = draftReports.filter(
    (report) => checkClinicalCompleteness(report).length > 0,
  );

  const recentReports = [...reports]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 6);

  function getPatient(patientId: string) {
    return patients.find((patient) => patient.id === patientId);
  }

  const stats: {
    label: string;
    value: number;
    description: string;
    icon: typeof Users;
    tone: string;
    onClick?: () => void;
  }[] = [
    {
      label: "Total Patients",
      value: patients.length,
      description: "Registered in clinic",
      icon: Users,
      tone: "patients",
      onClick: () => onNavigate("patients"),
    },
    {
      label: "Draft Reports",
      value: draftReports.length,
      description: "In preparation",
      icon: FileText,
      tone: "drafts",
      onClick: () => onNavigate("worklist", "draft"),
    },
    {
      label: "Finalized",
      value: finalizedReports.length,
      description: "Locked & verified",
      icon: CheckCircle2,
      tone: "finalized",
      onClick: () => onNavigate("worklist", "finalized"),
    },
    {
      label: "Needs Attention",
      value: needsAttentionReports.length,
      description: "Incomplete items",
      icon: AlertCircle,
      tone: "attention",
      onClick: () => onNavigate("worklist", "attention"),
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="dashboard-greeting">
        <div className="greeting-text">
          <h1>
            {greetingFor(new Date())} <span aria-hidden="true">👋</span>
          </h1>
          <p>Here's what's happening in your pathology workspace today.</p>
        </div>
        <div className="greeting-meta">
          <span className="greeting-date">
            <Calendar size={14} />
            {formatTodayDate()}
          </span>
          <span className="greeting-pill">
            <span className="live-dot" /> Pathology Lab Active
          </span>
        </div>
      </div>

      <div className="stats-grid">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const clickable = Boolean(stat.onClick);
          return (
            <button
              key={stat.label}
              type="button"
              className={`stat-card tone-${stat.tone}${clickable ? " is-clickable" : ""}`}
              onClick={stat.onClick}
              disabled={!clickable}
            >
              <div className="stat-icon">
                <Icon size={18} />
              </div>
              <div className="stat-card-body">
                <h2>{stat.value}</h2>
                <p className="stat-label">{stat.label}</p>
                <span className="stat-desc">{stat.description}</span>
              </div>
              <ArrowRight
                className="stat-card-arrow"
                size={16}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-card recent-reports-card">
          <div className="dashboard-card-header">
            <div>
              <h3>Recent Reports</h3>
              <p>Latest active pathology records</p>
            </div>
            <button
              type="button"
              className="view-all-button"
              onClick={() => onNavigate("worklist")}
            >
              View all
              <ArrowRight size={15} />
            </button>
          </div>

          {recentReports.length > 0 ? (
            <div className="recent-report-list">
              {recentReports.map((report) => {
                const pt = getPatient(report.patientId);
                const isFinalized = report.status === "finalized";
                return (
                  <button
                    type="button"
                    className="recent-report-item"
                    key={report.id}
                    onClick={() => onSelectReport(report.id)}
                  >
                    <div className="recent-report-icon">
                      <FileText size={16} />
                    </div>
                    <div className="recent-report-info">
                      <div className="recent-report-primary">
                        <strong>{pt?.name ?? "Unknown Patient"}</strong>
                      </div>
                      <span className="recent-report-test">
                        {report.testName ||
                          report.specimens.join(", ") ||
                          "Pathology Report"}
                      </span>
                    </div>
                    <div className="recent-report-meta">
                      <span
                        className={`status-pill ${isFinalized ? "finalized" : "draft"}`}
                      >
                        {isFinalized ? (
                          <>
                            <CheckCircle2 size={12} />
                            Finalized
                          </>
                        ) : (
                          <>
                            <Clock size={12} />
                            Draft
                          </>
                        )}
                      </span>
                      <span className="recent-report-date">
                        {formatReportDate(report.createdAt)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="dashboard-empty">
              <FileText size={32} />
              <p>No reports created yet.</p>
              <button
                type="button"
                className="secondary-button"
                onClick={() => onNavigate("new-report")}
              >
                Create your first report
              </button>
            </div>
          )}
        </section>

        <section className="quick-actions-panel">
          <div className="quick-actions-panel-header">
            <h3>Quick Actions</h3>
            <p>Common clinical operations</p>
          </div>

          <div className="quick-actions-grid">
            <button
              type="button"
              className="quick-action"
              onClick={() => onNavigate("new-report")}
            >
              <span className="quick-action-icon action-new">
                <Plus size={17} />
              </span>
              <span className="quick-action-text">
                <strong>Create Report</strong>
                <span>New pathology case</span>
              </span>
            </button>

            <button
              type="button"
              className="quick-action"
              onClick={() => onNavigate("worklist")}
            >
              <span className="quick-action-icon action-worklist">
                <ClipboardList size={17} />
              </span>
              <span className="quick-action-text">
                <strong>Open Worklist</strong>
                <span>Active drafts & cases</span>
              </span>
            </button>

            <button
              type="button"
              className="quick-action"
              onClick={() => onNavigate("patients")}
            >
              <span className="quick-action-icon action-patients">
                <Users size={17} />
              </span>
              <span className="quick-action-text">
                <strong>Patients</strong>
                <span>Registry & search</span>
              </span>
            </button>

            <button
              type="button"
              className="quick-action"
              onClick={() => onNavigate("history")}
            >
              <span className="quick-action-icon action-history">
                <History size={17} />
              </span>
              <span className="quick-action-text">
                <strong>Version History</strong>
                <span>Audit & amendments</span>
              </span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
