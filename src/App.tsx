import { ArrowLeft, Lock, Unlock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import TopNav, { type Page } from "./components/layout/TopNav";
import { confirmDestructive } from "./lib/dialog";
import Dashboard from "./pages/Dashboard";
import LaboratoryProfilePage from "./pages/LaboratoryProfile";
import NewReport from "./pages/NewReport";
import Patients from "./pages/Patients";
import ReportEditor from "./pages/ReportEditor";
import TestManagement from "./pages/TestManagement";
import VersionHistory from "./pages/VersionHistory";
import Worklist from "./pages/Worklist";

export default function App() {
  const [activePage, setActivePage] = useState<Page>("dashboard");
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [reportOrigin, setReportOrigin] = useState<Page>("worklist");
  const [worklistFilter, setWorklistFilter] = useState<"all" | "draft" | "finalized" | "attention">("all");
  const [isLocked, setIsLocked] = useState(false);
  const newReportDirtyRef = useRef(false);
  const editorDirtyRef = useRef(false);

  async function confirmExit(): Promise<boolean> {
    const dirtyNew = activePage === "new-report" && !selectedReportId && newReportDirtyRef.current;
    if (!dirtyNew && !editorDirtyRef.current) return true;
    return confirmDestructive({ title: "Discard unsaved changes?", text: "Leaving now will discard changes that have not been saved.", confirmText: "Discard", cancelText: "Keep editing" });
  }

  async function handleNavigate(page: Page, filter: "all" | "draft" | "finalized" | "attention" = "all") {
    if (!(await confirmExit())) return;
    newReportDirtyRef.current = false;
    editorDirtyRef.current = false;
    setSelectedReportId(null);
    if (page === "worklist") setWorklistFilter(filter);
    setActivePage(page);
  }

  function handleSelectReport(reportId: string) {
    setReportOrigin(activePage);
    editorDirtyRef.current = false;
    setSelectedReportId(reportId);
  }

  useEffect(() => {
    if (isLocked) return;

    function lockOnKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("button, a, input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      setIsLocked(true);
    }

    window.addEventListener("keydown", lockOnKeyDown);
    return () => window.removeEventListener("keydown", lockOnKeyDown);
  }, [isLocked]);

  const page = selectedReportId ? (
    <ReportEditor reportId={selectedReportId} onBack={() => void handleNavigate(reportOrigin)} onOpenReport={setSelectedReportId} onDirtyChange={(dirty) => { editorDirtyRef.current = dirty; }} />
  ) : activePage === "dashboard" ? (
    <Dashboard onNavigate={handleNavigate} onSelectReport={handleSelectReport} />
  ) : activePage === "patients" ? <Patients />
    : activePage === "worklist" ? <Worklist onSelectReport={handleSelectReport} initialFilter={worklistFilter} />
    : activePage === "new-report" ? <NewReport onOpenReport={handleSelectReport} onDirtyChange={(dirty) => { newReportDirtyRef.current = dirty; }} />
    : activePage === "history" ? <VersionHistory onSelectReport={handleSelectReport} />
    : activePage === "test-management" ? <TestManagement />
    : <LaboratoryProfilePage />;

  return <div className="app-shell">
    <TopNav
      activePage={activePage}
      onNavigate={handleNavigate}
      onLock={() => setIsLocked(true)}
    />
    <main className="main-content">
      <div className="page-content">
        {!selectedReportId && activePage !== "dashboard" && <nav className="page-breadcrumb-bar" aria-label="Breadcrumb"><button type="button" className="back-to-dashboard" onClick={() => void handleNavigate("dashboard")}><ArrowLeft size={13} aria-hidden="true" />Dashboard</button><span className="breadcrumb-separator" aria-hidden="true">/</span><span className="breadcrumb-current">{{ patients: "Patients", worklist: "Report Worklist", "new-report": "New Report", history: "Version History", "test-management": "Laboratory Tests", "lab-profile": "Laboratory Profile" }[activePage]}</span></nav>}
        {page}
      </div>
    </main>
    {isLocked && (
      <section
        className="quiet-mode"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quiet-mode-title"
      >
        <div className="quiet-mode-stars" aria-hidden="true" />
        <div className="quiet-mode-orbit quiet-mode-orbit-one" aria-hidden="true" />
        <div className="quiet-mode-orbit quiet-mode-orbit-two" aria-hidden="true" />
        <div className="quiet-mode-content">
          <span className="quiet-mode-mark" aria-hidden="true">
            <Lock size={21} />
          </span>
          <p className="quiet-mode-kicker">PathForge workspace</p>
          <h1 id="quiet-mode-title">Workspace locked</h1>
          <p className="quiet-mode-copy">
            Report work is paused while the workspace is locked. Unlock to return to your local report workflow.
          </p>
          <button type="button" className="quiet-mode-open" onClick={() => setIsLocked(false)}>
            <span className="quiet-mode-open-icon" aria-hidden="true">
              <Unlock size={17} />
            </span>
            Unlock workspace
          </button>
          <p className="quiet-mode-hint">Local prototype · no sign-in required</p>
        </div>
      </section>
    )}
  </div>;
}
