import { ArrowLeft } from "lucide-react";
import { useRef, useState } from "react";
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

  const page = selectedReportId ? (
    <ReportEditor reportId={selectedReportId} onBack={() => void handleNavigate(reportOrigin)} onOpenReport={setSelectedReportId} onDirtyChange={(dirty) => { editorDirtyRef.current = dirty; }} />
  ) : activePage === "dashboard" ? (
    <Dashboard onNavigate={handleNavigate} onSelectReport={handleSelectReport} />
  ) : activePage === "patients" ? <Patients />
    : activePage === "worklist" ? <Worklist onSelectReport={handleSelectReport} onCreateReport={() => void handleNavigate("new-report")} initialFilter={worklistFilter} />
    : activePage === "new-report" ? <NewReport onOpenReport={handleSelectReport} onDirtyChange={(dirty) => { newReportDirtyRef.current = dirty; }} />
    : activePage === "history" ? <VersionHistory onSelectReport={handleSelectReport} onCreateReport={() => void handleNavigate("new-report")} />
    : activePage === "test-management" ? <TestManagement />
    : <LaboratoryProfilePage />;

  return <div className="app-shell">
    <TopNav activePage={activePage} onNavigate={handleNavigate} />
    <main className="main-content">
      <div className="page-content">
        {!selectedReportId && activePage !== "dashboard" && <div className="page-breadcrumb-bar"><button type="button" className="back-to-dashboard" onClick={() => void handleNavigate("dashboard")}><ArrowLeft size={13} />Dashboard</button><span className="breadcrumb-separator">/</span><span className="breadcrumb-current">{{ patients: "Patients", worklist: "Report Worklist", "new-report": "New Report", history: "Version History", "test-management": "Laboratory Tests", "lab-profile": "Laboratory Profile" }[activePage]}</span></div>}
        {page}
      </div>
    </main>
  </div>;
}
