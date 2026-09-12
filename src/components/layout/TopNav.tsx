import {
  ChevronDown,
  ClipboardList,
  FlaskConical,
  History,
  Keyboard,
  LayoutDashboard,
  LockKeyhole,
  Plus,
  Stethoscope,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Every destination the app can navigate to. Kept here (not in a page) so the
 * router in App.tsx and any page that needs to navigate share one source.
 */
export type Page =
  | "dashboard"
  | "patients"
  | "worklist"
  | "new-report"
  | "history"
  | "test-management";

interface TopNavProps {
  activePage: Page;
  onNavigate: (page: Page) => void | Promise<void>;
  onLock: () => void;
  onShowShortcuts: () => void;
}

/**
 * Branding header. It carries no primary page navigation — workflows are
 * started from the Dashboard. The only navigational element is a secondary
 * menu that exposes Test Management.
 */
export default function TopNav({
  activePage,
  onNavigate,
  onLock,
  onShowShortcuts,
}: TopNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  return (
    <header className="top-nav">
      <button
        type="button"
        className="top-nav-brand"
        onClick={() => void onNavigate("dashboard")}
        title="PathForge — go to dashboard"
      >
        <span className="top-nav-brand-icon">
          <Stethoscope size={19} />
        </span>
        <span className="top-nav-brand-text">
          <strong>PathForge</strong>
          <span>Clinical Pathology</span>
        </span>
      </button>

      <nav className="top-nav-links" aria-label="Primary navigation">
        {[
          {
            page: "dashboard" as const,
            label: "Dashboard",
            icon: LayoutDashboard,
          },
          { page: "worklist" as const, label: "Worklist", icon: ClipboardList },
          { page: "patients" as const, label: "Patients", icon: Users },
          { page: "history" as const, label: "History", icon: History },
        ].map(({ page, label, icon: Icon }) => (
          <button
            type="button"
            className={`top-nav-link${activePage === page ? " is-active" : ""}`}
            aria-current={activePage === page ? "page" : undefined}
            key={page}
            onClick={() => void onNavigate(page)}
            title={label}
          >
            <Icon size={15} />
            <span className="top-nav-link-label">{label}</span>
          </button>
        ))}
      </nav>

      <div className="top-nav-spacer" />

      <div className="top-nav-user">
        <button
          type="button"
          className="top-nav-new-report"
          onClick={() => void onNavigate("new-report")}
          title="Create a new report"
        >
          <Plus size={15} />
          <span className="top-nav-new-report-label">New report</span>
        </button>
        <div className="top-nav-menu" ref={menuRef}>
          <button
            type="button"
            className="top-nav-menu-trigger"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            title="Catalog & Settings Menu"
          >
            <FlaskConical size={15} />
            <span className="top-nav-menu-label">Lab Catalog</span>
            <ChevronDown size={13} />
          </button>

          {menuOpen && (
            <div className="top-nav-menu-list" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  void onNavigate("test-management");
                }}
              >
                <FlaskConical size={15} />
                Laboratory Tests
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          className="top-nav-lock"
          onClick={onLock}
          title="Lock app"
          aria-label="Lock app"
        >
          <LockKeyhole size={15} />
          <span className="top-nav-menu-label">Lock app</span>
        </button>
        <button
          type="button"
          className="top-nav-shortcuts"
          onClick={onShowShortcuts}
          title="Keyboard shortcuts (Command+/)"
          aria-label="Keyboard shortcuts"
          aria-keyshortcuts="Meta+/"
        >
          <Keyboard size={15} />
          <span className="top-nav-menu-label">Shortcuts</span>
        </button>
      </div>
    </header>
  );
}
