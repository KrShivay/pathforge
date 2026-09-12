import { useEffect, useRef, useState } from "react";
import {
  FlaskConical,
  Stethoscope,
  ChevronDown,
} from "lucide-react";

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
  onNavigate: (page: Page) => void;
}

/**
 * Branding header. It carries no primary page navigation — workflows are
 * started from the Dashboard. The only navigational element is a secondary
 * menu that exposes Test Management.
 */
export default function TopNav({ onNavigate }: TopNavProps) {
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
        onClick={() => onNavigate("dashboard")}
        title="PathForge — go to dashboard"
      >
        <span className="top-nav-brand-icon">
          <Stethoscope size={22} />
        </span>
        <span className="top-nav-brand-text">
          <strong>PathForge</strong>
          <span>Clinical Pathology</span>
        </span>
      </button>

      <div className="top-nav-spacer" />

      <div className="top-nav-user">
        <div className="top-nav-menu" ref={menuRef}>
          <button
            type="button"
            className="top-nav-menu-trigger"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            title="Menu"
          >
            <FlaskConical size={16} />
            <ChevronDown size={14} />
          </button>

          {menuOpen && (
            <div className="top-nav-menu-list" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onNavigate("test-management");
                }}
              >
                <FlaskConical size={15} />
                Test Management
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
