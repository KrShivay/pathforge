import { z } from 'zod';

const rangeSchema = z.object({ low: z.number().optional(), high: z.number().optional() });

const resolvedEntrySchema = z.object({
  display: z.string().min(1),
  value: z.union([z.string(), z.number()]).optional(),
  unit: z.string().optional(),
  reference_range: rangeSchema.optional(),
  flag: z.string().optional(),
});

export const reportSchema = z.object({
  report_id: z.string().min(1, 'Report ID is required'),
  version: z.number().int().positive(),
  lifecycle_state: z.literal('finalized'),
  issue_number: z.string().min(1, 'Issue number is required'),
  issue_date: z.iso.date(),
  resolved_payload: z.record(z.string(), resolvedEntrySchema),
});

export type ReportSnapshot = z.infer<typeof reportSchema>;

export interface ReportListItem {
  reportId: string;
  issueNumber: string;
  version: number;
  state: 'Finalized';
  issueDate: string;
  supersedes?: number;
}

export const initialReportJson = `{
  "report_id": "R100",
  "version": 1,
  "lifecycle_state": "finalized",
  "issue_number": "INV-2026-004512",
  "issue_date": "2026-02-01",
  "resolved_payload": {
    "test.fasting_glucose": {
      "display": "Fasting Blood Sugar",
      "value": 92,
      "unit": "mg/dL",
      "reference_range": { "low": 70, "high": 100 },
      "flag": "normal"
    },
    "test.hba1c": {
      "display": "HbA1c",
      "value": 5.4,
      "unit": "%",
      "reference_range": { "high": 5.7 },
      "flag": "normal"
    },
    "interpretation.glucose": {
      "display": "Normal"
    }
  }
}`;

export const amendedReportJson = initialReportJson
  .replace('"version": 1', '"version": 2')
  .replace('INV-2026-004512', 'INV-2026-004887')
  .replace('"issue_date": "2026-02-01"', '"issue_date": "2026-02-14"')
  .replace('"value": 92', '"value": 108');

export const reports: ReportListItem[] = [
  { reportId: 'R100', issueNumber: 'INV-2026-004887', version: 2, state: 'Finalized', issueDate: '14 Feb 2026', supersedes: 1 },
  { reportId: 'R101', issueNumber: 'INV-2026-004913', version: 1, state: 'Finalized', issueDate: '18 Feb 2026' },
];
