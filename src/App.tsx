import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import TopNav, { type Page } from "./components/layout/TopNav";
import WorkspaceGate, {
  type WorkspaceGateKind,
} from "./components/layout/WorkspaceGate";
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
  const [workspaceGate, setWorkspaceGate] =
    useState<WorkspaceGateKind | null>("entry");
  type DirtyScope = "new-report" | "report-editor" | "test-management" | "lab-profile";
  const dirtyScopesRef = useRef<Record<DirtyScope, boolean>>({
    "new-report": false,
    "report-editor": false,
    "test-management": false,
    "lab-profile": false,
  });
  const updateDirtyScope = useCallback((scope: DirtyScope, dirty: boolean) => {
    dirtyScopesRef.current[scope] = dirty;
  }, []);
  const onNewReportDirtyChange = useCallback((dirty: boolean) => updateDirtyScope("new-report", dirty), [updateDirtyScope]);
  const onReportEditorDirtyChange = useCallback((dirty: boolean) => updateDirtyScope("report-editor", dirty), [updateDirtyScope]);
  const onTestManagementDirtyChange = useCallback((dirty: boolean) => updateDirtyScope("test-management", dirty), [updateDirtyScope]);
  const onLabProfileDirtyChange = useCallback((dirty: boolean) => updateDirtyScope("lab-profile", dirty), [updateDirtyScope]);
  const entryButtonRef = useRef<HTMLButtonElement>(null);
  const lockButtonRef = useRef<HTMLButtonElement>(null);
  const unlockButtonRef = useRef<HTMLButtonElement>(null);

  async function confirmExit(): Promise<boolean> {
    if (!Object.values(dirtyScopesRef.current).some(Boolean)) return true;
    return confirmDestructive({ title: "Discard unsaved changes?", text: "Leaving now will discard changes that have not been saved.", confirmText: "Discard", cancelText: "Keep editing" });
  }

  async function handleNavigate(page: Page, filter: "all" | "draft" | "finalized" | "attention" = "all") {
    if (!(await confirmExit())) return;
    for (const scope of Object.keys(dirtyScopesRef.current) as DirtyScope[]) {
      dirtyScopesRef.current[scope] = false;
    }
    setSelectedReportId(null);
    if (page === "worklist") setWorklistFilter(filter);
    setActivePage(page);
  }

  async function handleSelectReport(reportId: string) {
    if (!(await confirmExit())) return;
    if (!selectedReportId) setReportOrigin(activePage);
    for (const scope of Object.keys(dirtyScopesRef.current) as DirtyScope[]) {
      dirtyScopesRef.current[scope] = false;
    }
    setSelectedReportId(reportId);
  }

  useEffect(() => {
    function guardUnsavedChanges(event: BeforeUnloadEvent) {
      if (!Object.values(dirtyScopesRef.current).some(Boolean)) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", guardUnsavedChanges);
    return () => window.removeEventListener("beforeunload", guardUnsavedChanges);
  }, []);

  useEffect(() => {
    if (workspaceGate === "entry") entryButtonRef.current?.focus();
    if (workspaceGate === "locked") unlockButtonRef.current?.focus();
  }, [workspaceGate]);

  const page = selectedReportId ? (
    <ReportEditor reportId={selectedReportId} onBack={() => void handleNavigate(reportOrigin)} onOpenReport={(reportId) => void handleSelectReport(reportId)} onDirtyChange={onReportEditorDirtyChange} />
  ) : activePage === "dashboard" ? (
    <Dashboard onNavigate={handleNavigate} onSelectReport={handleSelectReport} />
  ) : activePage === "patients" ? <Patients />
    : activePage === "worklist" ? <Worklist onSelectReport={handleSelectReport} initialFilter={worklistFilter} />
    : activePage === "new-report" ? <NewReport onOpenReport={handleSelectReport} onDirtyChange={onNewReportDirtyChange} />
    : activePage === "history" ? <VersionHistory onSelectReport={handleSelectReport} />
    : activePage === "test-management" ? <TestManagement onDirtyChange={onTestManagementDirtyChange} />
    : <LaboratoryProfilePage onDirtyChange={onLabProfileDirtyChange} />;

  return <div className="app-shell">
    <TopNav
      activePage={activePage}
      onNavigate={handleNavigate}
      onLock={() => setWorkspaceGate("locked")}
      lockButtonRef={lockButtonRef}
    />
    <main className="main-content">
      <div className="page-content">
        {!selectedReportId && activePage !== "dashboard" && <nav className="page-breadcrumb-bar" aria-label="Breadcrumb"><button type="button" className="back-to-dashboard" onClick={() => void handleNavigate("dashboard")}><ArrowLeft size={13} aria-hidden="true" />Dashboard</button><span className="breadcrumb-separator" aria-hidden="true">/</span><span className="breadcrumb-current" aria-current="page">{{ patients: "Patients", worklist: "Report Worklist", "new-report": "New Report", history: "Version History", "test-management": "Laboratory Tests", "lab-profile": "Laboratory Profile" }[activePage]}</span></nav>}
        {page}
      </div>
    </main>
    {workspaceGate ? (
      <WorkspaceGate
        kind={workspaceGate}
        actionRef={
          workspaceGate === "entry" ? entryButtonRef : unlockButtonRef
        }
        onAction={() => {
          setWorkspaceGate(null);
          if (workspaceGate === "locked") {
            requestAnimationFrame(() => lockButtonRef.current?.focus());
          }
        }}
      />
    ) : null}
  </div>;
}
