import { ArrowLeft } from "lucide-react";
import { useRef, useState } from "react";

import TopNav, { type Page } from "./components/layout/TopNav";
import { confirmDestructive } from "./lib/dialog";

import Dashboard from "./pages/Dashboard";
import NewReport from "./pages/NewReport";
import Patients from "./pages/Patients";
import ReportEditor from "./pages/ReportEditor";
import TestManagement from "./pages/TestManagement";
import VersionHistory from "./pages/VersionHistory";
import Worklist from "./pages/Worklist";

function App() {
  const [activePage, setActivePage] = useState<Page>("dashboard");
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [worklistFilter, setWorklistFilter] = useState<
    "all" | "draft" | "finalized" | "attention"
  >("all");

  // Set by NewReport while it has unsaved progress. Read (not state) because
  // it changes on every keystroke and should never itself trigger a render.
  const newReportDirtyRef = useRef(false);

  async function handleNavigate(
    page: Page,
    filter: "all" | "draft" | "finalized" | "attention" = "all",
  ) {
    if (
      activePage === "new-report" &&
      !selectedReportId &&
      newReportDirtyRef.current
    ) {
      const proceed = await confirmDestructive({
        title: "Discard this report?",
        text: "This report has not been saved. Leaving now will discard everything entered so far.",
        confirmText: "Discard",
        cancelText: "Keep editing",
      });
      if (!proceed) return;
    }
    newReportDirtyRef.current = false;
    setSelectedReportId(null);
    if (page === "worklist") setWorklistFilter(filter);
    setActivePage(page);
  }

  function handleSelectReport(reportId: string) {
    newReportDirtyRef.current = false;
    setSelectedReportId(reportId);
  }

  function renderPage() {
    // A selected report takes over the workspace with its own editor chrome.
    if (selectedReportId) {
      return (
        <ReportEditor
          reportId={selectedReportId}
          onBack={() => {
            setSelectedReportId(null);
            setActivePage("worklist");
          }}
          onOpenReport={(reportId) => setSelectedReportId(reportId)}
        />
      );
    }

    switch (activePage) {
      case "dashboard":
        return (
          <Dashboard
            onNavigate={handleNavigate}
            onSelectReport={handleSelectReport}
          />
        );
      case "patients":
        return <Patients />;
      case "worklist":
        return (
          <Worklist
            onSelectReport={handleSelectReport}
            onCreateReport={() => void handleNavigate("new-report")}
            initialFilter={worklistFilter}
          />
        );
      case "new-report":
        return (
          <NewReport
            onOpenReport={handleSelectReport}
            onDirtyChange={(dirty) => {
              newReportDirtyRef.current = dirty;
            }}
          />
        );
      case "history":
        return (
          <VersionHistory
            onSelectReport={handleSelectReport}
            onCreateReport={() => void handleNavigate("new-report")}
          />
        );
      case "test-management":
        return <TestManagement />;
      default:
        return (
          <Dashboard
            onNavigate={handleNavigate}
            onSelectReport={handleSelectReport}
          />
        );
    }
  }

  // Every screen except the dashboard and the report editor (which has its own
  // "Back to Worklist") gets an explicit way back to the dashboard, since the
  // header no longer carries page navigation.
  const showBackToDashboard = !selectedReportId && activePage !== "dashboard";

  return (
    <div className="app-shell">
      <TopNav onNavigate={handleNavigate} />

      <main className="main-content">
        <div className="page-content">
          {showBackToDashboard && (
            <div className="page-breadcrumb-bar">
              <button
                type="button"
                className="back-to-dashboard"
                onClick={() => void handleNavigate("dashboard")}
                title="Return to Dashboard"
              >
                <ArrowLeft size={13} />
                <span>Dashboard</span>
              </button>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-current">
                {activePage === "worklist" && "Report Worklist"}
                {activePage === "patients" && "Patients"}
                {activePage === "new-report" && "New Report"}
                {activePage === "history" && "Version History"}
                {activePage === "test-management" && "Laboratory Tests"}
              </span>
            </div>
          )}
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

export default App;
