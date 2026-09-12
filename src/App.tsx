import { ArrowLeft, ArrowRight, LockKeyhole, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import TopNav, { type Page } from "./components/layout/TopNav";
import { confirmDestructive } from "./lib/dialog";

import Dashboard from "./pages/Dashboard";
import NewReport from "./pages/NewReport";
import Patients from "./pages/Patients";
import ReportEditor from "./pages/ReportEditor";
import TestManagement from "./pages/TestManagement";
import VersionHistory from "./pages/VersionHistory";
import Worklist from "./pages/Worklist";

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

function App() {
  const [activePage, setActivePage] = useState<Page>("dashboard");
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [worklistFilter, setWorklistFilter] = useState<
    "all" | "draft" | "finalized" | "attention"
  >("all");
  const [isLocked, setIsLocked] = useState(false);
  const [isShortcutHelpOpen, setIsShortcutHelpOpen] = useState(false);
  const shortcutCloseRef = useRef<HTMLButtonElement>(null);

  // Set by NewReport while it has unsaved progress. Read (not state) because
  // it changes on every keystroke and should never itself trigger a render.
  const newReportDirtyRef = useRef(false);

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
      if (isLocked) return;

      if (event.key === "Escape" && isShortcutHelpOpen) {
        event.preventDefault();
        setIsShortcutHelpOpen(false);
        return;
      }

      if (isTextEntryTarget(event.target)) return;

      if (
        event.key === "?" ||
        (event.key === "/" && (event.metaKey || event.ctrlKey))
      ) {
        event.preventDefault();
        setIsShortcutHelpOpen(true);
        return;
      }

      const hasShortcutModifier = event.metaKey || event.ctrlKey || event.altKey;
      if (
        !hasShortcutModifier ||
        event.shiftKey ||
        (event.altKey && (event.ctrlKey || event.metaKey))
      ) {
        return;
      }

      const pageByShortcut: Record<string, Page> = {
        "1": "dashboard",
        "2": "worklist",
        "3": "patients",
        "4": "history",
      };
      const page = pageByShortcut[event.key];

      if (page) {
        event.preventDefault();
        void handleNavigate(page);
      } else if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        void handleNavigate("new-report");
      } else if (event.key.toLowerCase() === "l") {
        event.preventDefault();
        setIsLocked(true);
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [isLocked, isShortcutHelpOpen]);

  useEffect(() => {
    if (isLocked) return;

    let timeoutId: number | undefined;

    const scheduleLock = () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => setIsLocked(true), IDLE_TIMEOUT_MS);
    };

    const activityEvents = [
      "pointerdown",
      "keydown",
      "touchstart",
      "wheel",
      "focus",
    ] as const;
    activityEvents.forEach((eventName) =>
      window.addEventListener(eventName, scheduleLock, { passive: true }),
    );
    scheduleLock();

    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      activityEvents.forEach((eventName) =>
        window.removeEventListener(eventName, scheduleLock),
      );
    };
  }, [isLocked]);

  useEffect(() => {
    if (!isLocked) return;

    const unlockWithKeyboard = () => setIsLocked(false);
    document.addEventListener("keydown", unlockWithKeyboard, true);

    return () =>
      document.removeEventListener("keydown", unlockWithKeyboard, true);
  }, [isLocked]);

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
  const shortcutModifier = /Mac|iPhone|iPad/.test(navigator.platform)
    ? "⌘"
    : "Ctrl";

  return (
    <div className="app-shell">
      <TopNav
        activePage={activePage}
        onNavigate={handleNavigate}
        onLock={() => setIsLocked(true)}
        onShowShortcuts={() => setIsShortcutHelpOpen(true)}
      />

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

      {isLocked && (
        <div className="quiet-mode" role="dialog" aria-modal="true">
          <div className="quiet-mode-stars" aria-hidden="true" />
          <div className="quiet-mode-content">
            <div className="quiet-mode-mark" aria-hidden="true">
              <Sparkles size={18} />
            </div>
            <p className="quiet-mode-kicker">PathForge is resting</p>
            <h1>Welcome back</h1>
            <p className="quiet-mode-copy">
              Your workspace is paused and ready whenever you are.
            </p>
            <button
              type="button"
              className="quiet-mode-open"
              onClick={() => setIsLocked(false)}
            >
              <span className="quiet-mode-open-icon">
                <LockKeyhole size={18} />
              </span>
              Open PathForge
              <ArrowRight size={17} />
            </button>
            <p className="quiet-mode-hint">
              Press the button to open the shutter
            </p>
          </div>
          <div
            className="quiet-mode-orbit quiet-mode-orbit-one"
            aria-hidden="true"
          />
          <div
            className="quiet-mode-orbit quiet-mode-orbit-two"
            aria-hidden="true"
          />
        </div>
      )}

      {isShortcutHelpOpen && !isLocked && (
        <div
          className="shortcut-help-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsShortcutHelpOpen(false);
            }
          }}
        >
          <section
            className="shortcut-help"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcut-help-title"
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
                onClick={() => setIsShortcutHelpOpen(false)}
                aria-label="Close keyboard shortcuts"
                title="Close (Escape)"
              >
                <X size={18} />
              </button>
            </div>
            <div className="shortcut-list">
              <div>
                <span>New report</span>
                <kbd>{shortcutModifier} N</kbd>
              </div>
              <div>
                <span>Dashboard</span>
                <kbd>{shortcutModifier} 1</kbd>
              </div>
              <div>
                <span>Worklist</span>
                <kbd>{shortcutModifier} 2</kbd>
              </div>
              <div>
                <span>Patients</span>
                <kbd>{shortcutModifier} 3</kbd>
              </div>
              <div>
                <span>Version history</span>
                <kbd>{shortcutModifier} 4</kbd>
              </div>
              <div>
                <span>Lock app</span>
                <kbd>{shortcutModifier} L</kbd>
              </div>
              <div>
                <span>Show shortcuts</span>
                <kbd>{shortcutModifier} /</kbd>
              </div>
            </div>
            <p className="shortcut-help-footer">
              Press <kbd>Esc</kbd> to close this window.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
