import { Columns3, Pencil, Printer, RefreshCw } from 'lucide-react';

import { reports } from '../domain/report';
import { useReports } from '../state/report-context';
import { Button } from './ui/button';
import { ReportPreview } from './report-preview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

export function Worklist({ requestedTab, onTabChange }: { requestedTab: string; onTabChange: (tab: string) => void }) {
  const { preview, selectedReport, selectReport, startAmendment } = useReports();

  return (
    <section className="page-grid">
      <header className="pane-titlebar"><div className="flex min-w-0 items-baseline gap-2"><h1>Report worklist</h1><span>Finalized clinical pathology reports</span></div><div className="flex gap-1"><Button aria-label="Refresh" size="icon" variant="ghost"><RefreshCw /></Button><Button aria-label="Choose columns" size="icon" variant="ghost"><Columns3 /></Button></div></header>
      <div className="list-detail">
        <section className="list-pane" aria-label="Reports">
          <div className="filterbar"><label htmlFor="state-filter">Show</label><select id="state-filter"><option>All reports</option><option>Finalized</option></select><span>2 items</span></div>
          <div className="min-h-0 overflow-auto">
            <table className="worklist-table">
              <thead><tr><th className="w-[18%]">Report</th><th className="w-[32%]">Issue number</th><th className="w-[12%]">Ver.</th><th className="w-[20%]">State</th><th className="w-[18%]">Issue date</th></tr></thead>
              <tbody>{reports.map(report => <tr aria-selected={selectedReport.reportId === report.reportId} key={report.reportId} onClick={() => selectReport(report)}><td>{report.reportId}</td><td>{report.issueNumber}</td><td>V{report.version}</td><td><span className="inline-flex items-center gap-1.5"><span className="size-[7px] rounded-full bg-[#107c10]" />{report.state}</span></td><td>{report.issueDate}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
        <div className="splitter" role="separator" aria-label="Resize report list and preview" />
        <section className="detail-pane" aria-label="Selected report">
          <header className="detail-header"><div className="flex min-w-0 items-baseline gap-2"><strong>{selectedReport.reportId} / V{selectedReport.version}</strong><span>{selectedReport.issueNumber} / {selectedReport.issueDate}</span></div><div className="flex gap-1"><Button aria-label="Amend report" onClick={startAmendment} size="icon" variant="ghost"><Pencil /></Button><Button aria-label="Print report" onClick={() => window.print()} size="icon" variant="ghost"><Printer /></Button></div></header>
          <Tabs className="flex min-h-0 flex-1 flex-col" onValueChange={onTabChange} value={requestedTab}>
            <TabsList><TabsTrigger value="preview">Preview</TabsTrigger><TabsTrigger value="properties">Properties</TabsTrigger><TabsTrigger value="versions">Versions</TabsTrigger></TabsList>
            <TabsContent className="overflow-auto bg-[#d8dce1] p-5" value="preview"><ReportPreview report={preview} compact /></TabsContent>
            <TabsContent className="overflow-auto bg-[var(--pf-layer)] p-3" value="properties"><Properties /></TabsContent>
            <TabsContent className="overflow-auto bg-[var(--pf-layer)] p-3" value="versions"><Versions /></TabsContent>
          </Tabs>
        </section>
      </div>
    </section>
  );
}

function Properties() {
  return <div className="property-sheet"><h2>Identity</h2><dl><dt>Report ID</dt><dd>R100</dd><dt>Version</dt><dd>V2</dd><dt>State</dt><dd>Finalized</dd></dl><h2>Issue</h2><dl><dt>Issue number</dt><dd>INV-2026-004887</dd><dt>Issue date</dt><dd>14 Feb 2026</dd><dt>Finalized by</dt><dd>pathologist:kk</dd></dl><h2>Provenance</h2><dl><dt>Catalog snapshot</dt><dd>V1</dd><dt>Supersedes</dt><dd>R100 / V1</dd></dl></div>;
}

function Versions() {
  return <div className="space-y-2"><Version number="V2" title="Current issue" meta="INV-2026-004887 / 14 Feb 2026" note="Supersedes V1. Clinical delta and audit evidence remain in the application; the printed report stays clean." /><Version number="V1" title="Initial issue" meta="INV-2026-004512 / 01 Feb 2026" /></div>;
}

function Version({ number, title, meta, note }: { number: string; title: string; meta: string; note?: string }) {
  return <article className="grid grid-cols-[42px_1fr] gap-2.5 rounded-[4px] border border-[var(--pf-stroke)] bg-[var(--pf-control)] p-2.5"><div className="grid h-8 place-items-center rounded-[3px] bg-[var(--pf-accent-soft)] font-semibold text-[var(--pf-accent)]">{number}</div><div><div className="font-semibold">{title}</div><div className="mt-0.5 text-[11px] text-[var(--pf-text-secondary)]">{meta}</div>{note && <p className="mt-1.5 text-[11px] text-[var(--pf-text-secondary)]">{note}</p>}</div></article>;
}
