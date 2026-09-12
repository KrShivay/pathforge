import { ChevronDown, ClipboardList, FlaskConical, History, Plus, Settings2, Stethoscope, Users } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

export type Page = "dashboard" | "patients" | "worklist" | "new-report" | "history" | "test-management" | "lab-profile";
interface TopNavProps { activePage: Page; onNavigate: (page: Page) => void | Promise<void>; }
type MenuName = "reports" | "manage";

export default function TopNav({ activePage, onNavigate }: TopNavProps) {
  const [openMenu, setOpenMenu] = useState<MenuName | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const reportsTrigger = useRef<HTMLButtonElement>(null);
  const manageTrigger = useRef<HTMLButtonElement>(null);
  const items = {
    reports: [
      { page: "worklist" as const, label: "Worklist", icon: ClipboardList },
      { page: "history" as const, label: "Version History", icon: History },
    ],
    manage: [
      { page: "patients" as const, label: "Patients", icon: Users },
      { page: "test-management" as const, label: "Laboratory Tests", icon: FlaskConical },
      { page: "lab-profile" as const, label: "Laboratory Profile", icon: Settings2 },
    ],
  };

  useEffect(() => {
    if (!openMenu) return;
    const closeOutside = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [openMenu]);

  function focusItem(menu: MenuName, index: number) {
    const nodes = navRef.current?.querySelectorAll<HTMLButtonElement>(`[data-menu="${menu}"] [role="menuitem"]`);
    nodes?.[Math.max(0, Math.min(index, nodes.length - 1))]?.focus();
  }
  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>, menu: MenuName) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    setOpenMenu(menu);
    requestAnimationFrame(() => focusItem(menu, event.key === "ArrowDown" ? 0 : items[menu].length - 1));
  }
  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>, menu: MenuName) {
    const nodes = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=menuitem]")];
    const index = nodes.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault(); setOpenMenu(null);
      (menu === "reports" ? reportsTrigger : manageTrigger).current?.focus();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      nodes[(index + delta + nodes.length) % nodes.length]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault(); nodes[event.key === "Home" ? 0 : nodes.length - 1]?.focus();
    }
  }

  const renderMenu = (name: MenuName, label: string, triggerRef: typeof reportsTrigger) => (
    <div className="top-nav-menu" data-menu={name}>
      <button ref={triggerRef} type="button" className={`top-nav-menu-trigger${items[name].some((item) => item.page === activePage) ? " is-active" : ""}`} aria-haspopup="menu" aria-expanded={openMenu === name} aria-controls={`${name}-menu`} onClick={() => setOpenMenu((value) => value === name ? null : name)} onKeyDown={(event) => onTriggerKeyDown(event, name)}>
        {label}<ChevronDown size={14} aria-hidden="true" />
      </button>
      {openMenu === name && <div id={`${name}-menu`} className="top-nav-menu-list" role="menu" aria-label={label} onKeyDown={(event) => onMenuKeyDown(event, name)}>
        {items[name].map(({ page, label: itemLabel, icon: Icon }) => <button type="button" role="menuitem" key={page} className={activePage === page ? "is-active" : ""} onClick={() => { setOpenMenu(null); void onNavigate(page); }}><Icon size={15} aria-hidden="true" />{itemLabel}</button>)}
      </div>}
    </div>
  );

  return <header className="top-nav">
    <button type="button" className="top-nav-brand" onClick={() => void onNavigate("dashboard")} aria-label="PathForge dashboard"><span className="top-nav-brand-icon"><Stethoscope size={19} aria-hidden="true" /></span><span className="top-nav-brand-text"><strong>PathForge</strong><span>Clinical Pathology</span></span></button>
    <nav ref={navRef} className="top-nav-links" aria-label="Primary navigation">
      <button type="button" className="top-nav-new-report" onClick={() => void onNavigate("new-report")}><Plus size={15} aria-hidden="true" />New Report</button>
      {renderMenu("reports", "Reports", reportsTrigger)}
      {renderMenu("manage", "Manage", manageTrigger)}
    </nav>
  </header>;
}
