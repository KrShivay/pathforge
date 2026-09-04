import { FilePlus2, Files, History, Home, Settings, Users } from 'lucide-react';

import { useReports } from '../state/report-context';

export function NavPane({ onShowHistory }: { onShowHistory: () => void }) {
  const { setView, startNew, view } = useReports();

  return (
    <aside className="navpane" aria-label="Navigation">
      <div className="nav-heading">PathForge</div>
      <button className="nav-item" aria-current={view === 'home' ? 'page' : undefined} aria-label="Home" onClick={() => setView('home')} title="Home" type="button"><Home /><span>Home</span></button>
      <button className="nav-item" aria-current={view === 'patients' ? 'page' : undefined} aria-label="Patients" onClick={() => setView('patients')} title="Patients" type="button"><Users /><span>Patients</span></button>
      <button className="nav-item" aria-current={view === 'worklist' ? 'page' : undefined} aria-label="Report worklist" onClick={() => setView('worklist')} title="Report worklist" type="button"><Files /><span>Report worklist</span></button>
      <button className="nav-item" aria-current={view === 'editor' ? 'page' : undefined} aria-label="New report" onClick={startNew} title="New report" type="button"><FilePlus2 /><span>New report</span></button>
      <div className="mx-2 my-2 h-px bg-[var(--pf-stroke)]" />
      <button className="nav-item" aria-label="Version history" onClick={onShowHistory} title="Version history" type="button"><History /><span>Version history</span></button>
      <button className="nav-item mt-1" aria-current={view === 'settings' ? 'page' : undefined} aria-label="Settings and backup" onClick={() => setView('settings')} title="Settings & backup" type="button"><Settings /><span>Settings & backup</span></button>
      <div className="nav-info"><span className="size-[7px] rounded-full bg-[#107c10]" /><span>Local workspace</span><small>2 reports / 3 versions</small></div>
    </aside>
  );
}
