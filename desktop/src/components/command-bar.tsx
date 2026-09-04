import { FolderOpen, Plus, Printer } from 'lucide-react';

import { useReports } from '../state/report-context';
import { Button } from './ui/button';

export function CommandBar() {
  const { setView, startNew } = useReports();

  return (
    <div className="commandbar" role="toolbar" aria-label="Report commands">
      <Button onClick={startNew} variant="default"><Plus />New report</Button>
      <Button onClick={() => setView('worklist')}><FolderOpen />Open report</Button>
      <span className="mx-1 h-6 w-px bg-[var(--pf-stroke)]" />
      <Button onClick={() => window.print()}><Printer />Print report</Button>
      <span className="ml-auto hidden text-[11px] text-[var(--pf-text-secondary)] xl:block">Ctrl+N New &nbsp; Ctrl+O Open &nbsp; Ctrl+P Print</span>
      <label className="operator-select"><span>Operator</span><select aria-label="Active operator"><option>Dr. Kavita Rao - Pathologist</option><option>Neha Singh - Technician</option></select></label>
    </div>
  );
}
