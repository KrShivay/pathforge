import { zodResolver } from '@hookform/resolvers/zod';
import { Check, ChevronLeft, ChevronRight, FileCheck2, Printer } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Dispatch, KeyboardEvent, ReactNode, SetStateAction } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';

import type { ReportSnapshot } from '../domain/report';
import { cn } from '../lib/utils';
import { useReports } from '../state/report-context';
import { Button } from './ui/button';
import { ReportPreview } from './report-preview';

const patientSchema = z.object({
  accession: z.string().min(1, 'Accession number is required'),
  patientName: z.string().min(2, 'Patient name is required'),
  age: z.number().int().min(0).max(120),
  sex: z.enum(['Male', 'Female', 'Other']),
  referringDoctor: z.string().min(2, 'Referring doctor is required'),
});

type PatientForm = z.infer<typeof patientSchema>;
type Step = 'patient' | 'tests' | 'results' | 'review';

interface TestDefinition {
  id: string;
  name: string;
  shortName: string;
  unit: string;
  low?: number;
  high?: number;
  value: string;
}

const availableTests: TestDefinition[] = [
  { id: 'glucose', name: 'Fasting Blood Sugar', shortName: 'FBS', unit: 'mg/dL', low: 70, high: 100, value: '92' },
  { id: 'hba1c', name: 'Glycated Haemoglobin', shortName: 'HbA1c', unit: '%', high: 5.7, value: '5.4' },
  { id: 'haemoglobin', name: 'Haemoglobin', shortName: 'Hb', unit: 'g/dL', low: 12, high: 16, value: '13.4' },
  { id: 'wbc', name: 'Total Leukocyte Count', shortName: 'WBC', unit: '/cumm', low: 4000, high: 11000, value: '7200' },
  { id: 'platelets', name: 'Platelet Count', shortName: 'PLT', unit: '/cumm', low: 150000, high: 450000, value: '240000' },
];

const stepOrder: Step[] = ['patient', 'tests', 'results', 'review'];

function rangeLabel(test: TestDefinition) {
  if (test.low !== undefined && test.high !== undefined) return `${test.low}-${test.high}`;
  if (test.low !== undefined) return `>= ${test.low}`;
  if (test.high !== undefined) return `<= ${test.high}`;
  return '';
}

function resultFlag(test: TestDefinition) {
  const value = Number(test.value);
  if (!Number.isFinite(value)) return 'Invalid';
  if (test.low !== undefined && value < test.low) return 'Low';
  if (test.high !== undefined && value > test.high) return 'High';
  return 'Normal';
}

export function ReportEditor() {
  const { editorMode, setView } = useReports();
  const [step, setStep] = useState<Step>('patient');
  const [selectedIds, setSelectedIds] = useState(() => new Set(['glucose', 'hba1c', 'haemoglobin']));
  const [tests, setTests] = useState(availableTests);
  const [workflowMessage, setWorkflowMessage] = useState('Patient details loaded for this prototype.');
  const form = useForm<PatientForm>({
    resolver: zodResolver(patientSchema),
    mode: 'onBlur',
    defaultValues: {
      accession: editorMode === 'amend' ? 'ACC-2026-00104' : 'ACC-2026-00127',
      patientName: 'Ananya Sharma',
      age: 42,
      sex: 'Female',
      referringDoctor: 'Dr. Meera Iyer',
    },
  });

  const selectedTests = useMemo(() => tests.filter(test => selectedIds.has(test.id)), [tests, selectedIds]);
  const preview = useMemo<ReportSnapshot>(() => ({
    report_id: editorMode === 'amend' ? 'R100' : 'R127',
    version: editorMode === 'amend' ? 3 : 1,
    lifecycle_state: 'finalized',
    issue_number: editorMode === 'amend' ? 'INV-2026-005101' : 'INV-2026-005144',
    issue_date: '2026-02-21',
    resolved_payload: Object.fromEntries(selectedTests.map(test => [`test.${test.id}`, {
      display: test.name,
      value: Number(test.value),
      unit: test.unit,
      reference_range: { low: test.low, high: test.high },
      flag: resultFlag(test).toLowerCase(),
    }])),
  }), [editorMode, selectedTests]);

  const goNext = async () => {
    if (step === 'patient') {
      const valid = await form.trigger();
      if (!valid) { setWorkflowMessage('Correct the highlighted patient fields.'); return; }
    }
    if (step === 'results' && selectedTests.some(test => resultFlag(test) === 'Invalid')) {
      setWorkflowMessage('Enter a numeric result for every selected test.');
      return;
    }
    const index = stepOrder.indexOf(step);
    if (index < stepOrder.length - 1) setStep(stepOrder[index + 1]);
  };

  const updateResult = (id: string, value: string) => {
    setTests(current => current.map(test => test.id === id ? { ...test, value } : test));
  };

  const handleResultKey = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const inputs = document.querySelectorAll<HTMLInputElement>('[data-result-input]');
    inputs[index + 1]?.focus();
  };

  return (
    <section className="page-grid">
      <header className="pane-titlebar">
        <div className="flex min-w-0 items-baseline gap-2"><h1>{editorMode === 'amend' ? 'Amend report R100 / V2' : 'New pathology report'}</h1><span>{editorMode === 'amend' ? 'Derived from the frozen V2 snapshot' : 'Accession ACC-2026-00127'}</span></div>
        <Button onClick={() => setView('worklist')}>Close</Button>
      </header>

      <div className="entry-workspace">
        <nav className="workflow-rail" aria-label="Report workflow">
          {stepOrder.map((item, index) => <button className={cn('workflow-step', step === item && 'active', stepOrder.indexOf(step) > index && 'complete')} key={item} onClick={() => setStep(item)} type="button"><span>{stepOrder.indexOf(step) > index ? <Check /> : index + 1}</span><strong>{item === 'patient' ? 'Patient' : item === 'tests' ? 'Tests' : item === 'results' ? 'Result entry' : 'Review & print'}</strong></button>)}
        </nav>

        <main className="entry-main">
          {step === 'patient' && <PatientStep form={form} />}
          {step === 'tests' && <TestsStep selectedIds={selectedIds} setSelectedIds={setSelectedIds} />}
          {step === 'results' && <ResultsStep tests={selectedTests} updateResult={updateResult} onResultKey={handleResultKey} />}
          {step === 'review' && <ReviewStep patient={form.getValues()} preview={preview} />}
        </main>

        <footer className="entry-footer">
          <span>{workflowMessage}</span>
          <div className="flex gap-2">
            <Button disabled={step === 'patient'} onClick={() => setStep(stepOrder[stepOrder.indexOf(step) - 1])}><ChevronLeft />Back</Button>
            {step !== 'review' ? <Button onClick={() => void goNext()} variant="default">Next<ChevronRight /></Button> : <><Button><FileCheck2 />Finalize</Button><Button onClick={() => window.print()} variant="default"><Printer />Generate PDF / Print</Button></>}
          </div>
        </footer>
      </div>
    </section>
  );
}

function PatientStep({ form }: { form: UseFormReturn<PatientForm> }) {
  return <form className="entry-section" onSubmit={event => event.preventDefault()}><div className="entry-heading"><h2>Patient registration</h2><p>Confirm patient and accession details before choosing tests.</p></div><div className="form-grid"><Field label="Accession number" error={form.formState.errors.accession?.message}><input {...form.register('accession')} /></Field><Field label="Patient name" error={form.formState.errors.patientName?.message}><input {...form.register('patientName')} /></Field><Field label="Age" error={form.formState.errors.age?.message}><input inputMode="numeric" {...form.register('age', { valueAsNumber: true })} /></Field><Field label="Sex" error={form.formState.errors.sex?.message}><select {...form.register('sex')}><option>Female</option><option>Male</option><option>Other</option></select></Field><Field label="Referring doctor" error={form.formState.errors.referringDoctor?.message}><input {...form.register('referringDoctor')} /></Field></div></form>;
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return <label className="form-field"><span>{label}</span>{children}{error && <small>{error}</small>}</label>;
}

function TestsStep({ selectedIds, setSelectedIds }: { selectedIds: Set<string>; setSelectedIds: Dispatch<SetStateAction<Set<string>>> }) {
  const toggle = (id: string) => setSelectedIds(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  return <section className="entry-section"><div className="entry-heading"><h2>Select tests and profiles</h2><p>Choose the investigations that should appear in this report.</p></div><div className="test-picker"><div className="test-picker-head"><span>Test / profile</span><span>Department</span><span>Selected</span></div>{availableTests.map(test => <label className="test-picker-row" key={test.id}><span><strong>{test.name}</strong><small>{test.shortName}</small></span><span>Clinical pathology</span><input checked={selectedIds.has(test.id)} onChange={() => toggle(test.id)} type="checkbox" /></label>)}</div></section>;
}

function ResultsStep({ tests, updateResult, onResultKey }: { tests: TestDefinition[]; updateResult: (id: string, value: string) => void; onResultKey: (event: KeyboardEvent<HTMLInputElement>, index: number) => void }) {
  return <section className="entry-section result-entry"><div className="entry-heading"><h2>Result entry</h2><p>Enter values down the Result column. Press Enter to move to the next test.</p></div><div className="result-summary"><span>Accession ACC-2026-00127</span><span>{tests.length} tests</span><span>0 pending after entry</span></div><div className="result-grid-wrap"><table className="result-grid"><thead><tr><th className="w-10">#</th><th>Test</th><th className="w-36">Result</th><th className="w-24">Unit</th><th className="w-28">Reference</th><th className="w-20">Flag</th></tr></thead><tbody>{tests.map((test, index) => { const flag = resultFlag(test); return <tr key={test.id}><td>{index + 1}</td><td><strong>{test.name}</strong><small>{test.shortName}</small></td><td><input aria-label={`${test.name} result`} data-result-input onChange={event => updateResult(test.id, event.target.value)} onKeyDown={event => onResultKey(event, index)} value={test.value} /></td><td>{test.unit}</td><td>{rangeLabel(test)}</td><td><span className={cn('result-flag', flag.toLowerCase())}>{flag}</span></td></tr>; })}</tbody></table></div><div className="function-bar"><span><kbd>Enter</kbd> Next result</span><span><kbd>F4</kbd> Previous result</span><span><kbd>F6</kbd> Mark reviewed</span><span><kbd>Ctrl+S</kbd> Save draft</span></div></section>;
}

function ReviewStep({ patient, preview }: { patient: PatientForm; preview: ReportSnapshot }) {
  return <section className="review-layout"><aside className="review-summary"><h2>Review before finalizing</h2><dl><dt>Accession</dt><dd>{patient.accession}</dd><dt>Patient</dt><dd>{patient.patientName}</dd><dt>Age / sex</dt><dd>{patient.age} / {patient.sex}</dd><dt>Referring doctor</dt><dd>{patient.referringDoctor}</dd><dt>Tests</dt><dd>{Object.keys(preview.resolved_payload).length}</dd></dl><div className="review-check"><Check /><span>All selected tests have results.</span></div><div className="review-check"><Check /><span>Reference ranges and units are present.</span></div></aside><div className="review-canvas"><ReportPreview report={preview} compact /></div></section>;
}
