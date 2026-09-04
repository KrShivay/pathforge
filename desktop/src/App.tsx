import { useEffect, useState } from 'react';

import { CommandBar } from './components/command-bar';
import { Home } from './components/home';
import { NavPane } from './components/nav-pane';
import { Patients } from './components/patients';
import { ReportEditor } from './components/report-editor';
import { Settings } from './components/settings';
import { TitleBar } from './components/title-bar';
import { Worklist } from './components/worklist';
import { useReports } from './state/report-context';

export function App() {
  const { selectedReport, setView, startNew, status, view } = useReports();
  const [detailTab, setDetailTab] = useState('preview');

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!event.ctrlKey) return;
      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        startNew();
      }
      if (event.key.toLowerCase() === 'p') {
        event.preventDefault();
        window.print();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [startNew]);

  const showHistory = () => {
    setView('worklist');
    setDetailTab('versions');
  };

  return (
    <div className="desktop-window">
      <TitleBar />
      <nav className="menubar" aria-label="Application menu"><button type="button">File</button><button type="button">View</button><button type="button">Help</button></nav>
      <CommandBar />
      <div className="workspace">
        <NavPane onShowHistory={showHistory} />
        <main className="page-host">
          {view === 'home' && <Home />}
          {view === 'patients' && <Patients />}
          {view === 'worklist' && <Worklist onTabChange={setDetailTab} requestedTab={detailTab} />}
          {view === 'editor' && <ReportEditor />}
          {view === 'settings' && <Settings />}
        </main>
      </div>
      <footer className="statusbar"><span className="status-ready">{status}</span><span>{selectedReport.reportId} / V{selectedReport.version} selected</span><span className="ml-auto">Local prototype &nbsp; | &nbsp; House format 1</span></footer>
    </div>
  );
}
