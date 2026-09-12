import { ArrowLeft, Lock, Unlock, X } from "lucide-react";
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
  const [isShortcutHelpOpen, setIsShortcutHelpOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const newReportDirtyRef = useRef(false);
  const editorDirtyRef = useRef(false);
  const shortcutDialogRef = useRef<HTMLElement>(null);
  const shortcutCloseRef = useRef<HTMLButtonElement>(null);
  const shortcutReturnFocusRef = useRef<HTMLElement | null>(null);

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

  function openShortcutHelp() {
    shortcutReturnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setIsShortcutHelpOpen(true);
  }

  function closeShortcutHelp() {
    setIsShortcutHelpOpen(false);
    requestAnimationFrame(() => shortcutReturnFocusRef.current?.focus());
  }

  useEffect(() => {
    if (!isShortcutHelpOpen) return;
    shortcutCloseRef.current?.focus();
  }, [isShortcutHelpOpen]);

  useEffect(() => {
    function isTextEntryTarget(target: EventTarget | null) {
      return (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      );
    }

    function handleShortcut(event: KeyboardEvent) {
      if (event.key === "Escape" && isShortcutHelpOpen) {
        event.preventDefault();
        closeShortcutHelp();
        return;
      }
      if (isShortcutHelpOpen) return;
      if (isLocked) return;
      if (isTextEntryTarget(event.target)) return;

      if (
        event.key === "?" ||
        (event.key === "/" && (event.metaKey || event.ctrlKey))
      ) {
        event.preventDefault();
        openShortcutHelp();
        return;
      }

      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) {
        return;
      }

      const pageByKey: Record<string, Page> = {
        "1": "dashboard",
        "2": "worklist",
        "3": "patients",
        "4": "history",
        "5": "test-management",
        "6": "lab-profile",
      };
      const page = pageByKey[event.key];
      if (page) {
        event.preventDefault();
        void handleNavigate(page);
      } else if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        void handleNavigate("new-report");
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [isLocked, isShortcutHelpOpen]);

  function trapShortcutDialogFocus(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const focusable = [
      ...event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

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
      onShowShortcuts={openShortcutHelp}
      onLock={() => setIsLocked(true)}
    />
    <main className="main-content">
      <div className="page-content">
        {!selectedReportId && activePage !== "dashboard" && <nav className="page-breadcrumb-bar" aria-label="Breadcrumb"><button type="button" className="back-to-dashboard" onClick={() => void handleNavigate("dashboard")}><ArrowLeft size={13} aria-hidden="true" />Dashboard</button><span className="breadcrumb-separator" aria-hidden="true">/</span><span className="breadcrumb-current">{{ patients: "Patients", worklist: "Report Worklist", "new-report": "New Report", history: "Version History", "test-management": "Laboratory Tests", "lab-profile": "Laboratory Profile" }[activePage]}</span></nav>}
        {page}
      </div>
    </main>
    {isShortcutHelpOpen && (
      <div
        className="shortcut-help-backdrop"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeShortcutHelp();
        }}
      >
        <section
          ref={shortcutDialogRef}
          className="shortcut-help"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shortcut-help-title"
          onKeyDown={trapShortcutDialogFocus}
        >
          <div className="shortcut-help-heading">
            <div>
              <p className="shortcut-help-kicker">PathForge controls</p>
              <h2 id="shortcut-help-title">Keyboard shortcuts</h2>
            </div>
            <button
              ref={shortcutCloseRef}
              type="button"
              className="shortcut-help-close"
              onClick={closeShortcutHelp}
              aria-label="Close keyboard shortcuts"
              title="Close (Escape)"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="shortcut-list">
            {[
              ["New report", "N"],
              ["Dashboard", "1"],
              ["Worklist", "2"],
              ["Patients", "3"],
              ["Version history", "4"],
              ["Laboratory tests", "5"],
              ["Laboratory profile", "6"],
            ].map(([label, key]) => (
              <div key={label}>
                <span>{label}</span>
                <kbd>{/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl"} {key}</kbd>
              </div>
            ))}
            <div>
              <span>Show shortcuts</span>
              <kbd>{/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl"} /</kbd>
            </div>
          </div>
          <p className="shortcut-help-footer">
            Press <kbd>Esc</kbd> to close this window.
          </p>
        </section>
      </div>
    )}
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
