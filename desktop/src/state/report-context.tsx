import { createContext, type ReactNode, useContext, useState } from 'react';

import {
  amendedReportJson,
  initialReportJson,
  reportSchema,
  reports,
  type ReportListItem,
  type ReportSnapshot,
} from '../domain/report';

type View = 'home' | 'patients' | 'worklist' | 'editor' | 'settings';
type EditorMode = 'new' | 'amend';

interface ReportContextValue {
  view: View;
  editorMode: EditorMode;
  selectedReport: ReportListItem;
  preview: ReportSnapshot;
  status: string;
  setView: (view: View) => void;
  selectReport: (report: ReportListItem) => void;
  startNew: () => void;
  startAmendment: () => void;
}

const ReportContext = createContext<ReportContextValue | null>(null);

function parseKnownReport(json: string): ReportSnapshot {
  return reportSchema.parse(JSON.parse(json));
}

export function ReportProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>('home');
  const [editorMode, setEditorMode] = useState<EditorMode>('new');
  const [selectedReport, setSelectedReport] = useState(reports[0]);
  const [preview, setPreview] = useState(() => parseKnownReport(amendedReportJson));
  const [status, setStatus] = useState('Ready');

  const selectReport = (report: ReportListItem) => {
    setSelectedReport(report);
    setPreview(parseKnownReport(report.version === 2 ? amendedReportJson : initialReportJson));
    setStatus(`${report.reportId} / V${report.version} selected`);
  };

  const startNew = () => {
    setEditorMode('new');
    setPreview(parseKnownReport(initialReportJson));
    setStatus('Editing new report');
    setView('editor');
  };

  const startAmendment = () => {
    setEditorMode('amend');
    setPreview(parseKnownReport(amendedReportJson));
    setStatus('Editing amendment');
    setView('editor');
  };

  const value = {
    view,
    editorMode,
    selectedReport,
    preview,
    status,
    setView,
    selectReport,
    startNew,
    startAmendment,
  };

  return <ReportContext.Provider value={value}>{children}</ReportContext.Provider>;
}

export function useReports() {
  const value = useContext(ReportContext);
  if (!value) throw new Error('useReports must be used within ReportProvider');
  return value;
}
