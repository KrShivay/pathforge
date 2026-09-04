import { FilePlus2, Search } from 'lucide-react';

import { reports } from '../domain/report';
import { useReports } from '../state/report-context';
import { Button } from './ui/button';

export function Home() {
  const { selectReport, setView, startNew } = useReports();
  const openReport = (report: (typeof reports)[number]) => { selectReport(report); setView('worklist'); };

  return <section className="home-page"><header className="home-header"><div><h1>PathForge</h1><p>Clinical pathology reporting</p></div><div className="flex gap-2"><Button onClick={startNew} variant="default"><FilePlus2 />New report</Button><Button onClick={() => setView('worklist')}><Search />Search reports</Button></div></header><div className="home-body"><section className="home-section"><div className="home-section-title"><h2>Recent reports</h2><Button onClick={() => setView('worklist')} variant="ghost">View all</Button></div><table className="recent-table"><thead><tr><th>Reference</th><th>Patient</th><th>Report date</th><th>Version</th><th>Status</th></tr></thead><tbody>{reports.map((report, index) => <tr key={report.reportId} onClick={() => openReport(report)}><td><strong>{report.reportId === 'R100' ? '26348194527' : '26349111703'}</strong><small>{report.issueNumber}</small></td><td>{index === 0 ? 'Ananya Sharma' : 'Rohan Mehta'}</td><td>{report.issueDate}</td><td>V{report.version}</td><td><span className="inline-flex items-center gap-1.5"><span className="size-[7px] rounded-full bg-[#107c10]" />Finalized</span></td></tr>)}</tbody></table></section><aside className="home-side"><h2>External backup</h2><p>Last completed: 20 Feb 2026, 18:42</p><strong>USB_BACKUP (E:)</strong><Button onClick={() => setView('settings')}>Open backup settings</Button></aside></div></section>;
}
