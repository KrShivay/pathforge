import {
  Users,
  FileText,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Plus,
  ClipboardList,
  History,
} from "lucide-react";
import { usePatients } from "../store/PatientContext";
import { useReports } from "../store/ReportContext";
import { checkClinicalCompleteness } from "../domain/report-bridge.mjs";
import type { Page } from "../components/layout/TopNav";

interface DashboardProps {
  onNavigate: (page: Page) => void;
}

function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { patients } = usePatients();
  const { reports } = useReports();

  const draftReports = reports.filter((report) => report.status === "draft");
  const finalizedReports = reports.filter(
    (report) => report.status === "finalized"
  );
  const needsAttentionReports = draftReports.filter(
    (report) => checkClinicalCompleteness(report).length > 0
  );

  const recentReports = [...reports]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 6);

  function getPatientName(patientId: string) {
    return (
      patients.find((patient) => patient.id === patientId)?.name ??
      "Unknown Patient"
    );
  }

  const stats: {
    label: string;
    value: number;
    icon: typeof Users;
    onClick?: () => void;
  }[] = [
    {
      label: "Total Patients",
      value: patients.length,
      icon: Users,
      onClick: () => onNavigate("patients"),
    },
    { label: "Draft Reports", value: draftReports.length, icon: FileText },
    { label: "Finalized", value: finalizedReports.length, icon: CheckCircle2 },
    {
      label: "Needs Attention",
      value: needsAttentionReports.length,
      icon: AlertCircle,
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="dashboard-greeting">
        <h1>
          {greetingFor(new Date())} <span aria-hidden="true">👋</span>
        </h1>
        <p>Here's what's happening in your pathology workspace today.</p>
      </div>

      <div className="stats-grid">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const clickable = Boolean(stat.onClick);
          return (
            <button
              key={stat.label}
              type="button"
              className={`stat-card${clickable ? " is-clickable" : ""}`}
              onClick={stat.onClick}
              disabled={!clickable}
            >
              <div className="stat-icon">
                <Icon size={20} />
              </div>
              <div>
                <p>{stat.label}</p>
                <h2>{stat.value}</h2>
              </div>
              {clickable ? (
                <ArrowRight size={16} className="stat-card-arrow" />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-card recent-reports-card">
          <div className="dashboard-card-header">
            <div>
              <h3>Recent Reports</h3>
              <p>Your latest pathology reports</p>
            </div>
            <button
              className="view-all-button"
              onClick={() => onNavigate("worklist")}
            >
              View all
              <ArrowRight size={16} />
            </button>
          </div>

          {recentReports.length > 0 ? (
            <div className="recent-report-list">
              {recentReports.map((report) => (
                <div className="recent-report-item" key={report.id}>
                  <div className="recent-report-icon">
                    <FileText size={18} />
                  </div>
                  <div className="recent-report-info">
                    <strong>{getPatientName(report.patientId)}</strong>
                    <span>
                      {report.testName || report.specimenType || "Report"}
                    </span>
                  </div>
                  <span className={`dashboard-status ${report.status}`}>
                    {report.status === "draft" ? "Draft" : "Finalized"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="dashboard-empty">
              <FileText size={36} />
              <p>No reports created yet.</p>
              <button
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
            <p>Common workspace actions</p>
          </div>

          <button
            className="quick-action"
            onClick={() => onNavigate("new-report")}
          >
            <span className="quick-action-icon">
              <Plus size={18} />
            </span>
            <span>
              <strong>Create Report</strong>
              Start a new pathology report
            </span>
          </button>

          <button
            className="quick-action"
            onClick={() => onNavigate("patients")}
          >
            <span className="quick-action-icon">
              <Users size={18} />
            </span>
            <span>
              <strong>Manage Patients</strong>
              View and add patient records
            </span>
          </button>

          <button
            className="quick-action"
            onClick={() => onNavigate("worklist")}
          >
            <span className="quick-action-icon">
              <ClipboardList size={18} />
            </span>
            <span>
              <strong>Open Worklist</strong>
              Continue working on reports
            </span>
          </button>

          <button
            className="quick-action"
            onClick={() => onNavigate("history")}
          >
            <span className="quick-action-icon">
              <History size={18} />
            </span>
            <span>
              <strong>Version History</strong>
              View report versions and changes
            </span>
          </button>
        </section>
      </div>
    </div>
  );
}
