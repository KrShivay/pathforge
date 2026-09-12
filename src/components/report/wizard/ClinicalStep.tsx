import { sanitizeText } from "../../../domain/textRules.mjs";

interface ClinicalDetails {
  clinicalHistory: string;
  findings: string;
  diagnosis: string;
}

interface ClinicalStepProps {
  value: ClinicalDetails;
  onChange: (next: Partial<ClinicalDetails>) => void;
}

export default function ClinicalStep({ value, onChange }: ClinicalStepProps) {
  const clean = (text: string) => sanitizeText(text, "general");
  return (
    <div className="wizard-panel">
      <h2>Clinical details</h2>
      <p className="wizard-panel-hint">
        Narrative sections of the report. All optional for a draft; findings and
        diagnosis are required before a report can be finalized.
      </p>

      <div className="clinical-step-grid">
        <div className="wizard-field">
          <div className="wizard-field-header">
            <label htmlFor="cd-history">Clinical History</label>
            <span className="field-tag optional">Optional</span>
          </div>
          <textarea
            id="cd-history"
            rows={2}
            value={value.clinicalHistory}
            onChange={(event) =>
              onChange({ clinicalHistory: clean(event.target.value) })
            }
            placeholder="Relevant history provided with the request…"
            autoFocus
          />
        </div>

        <div className="wizard-field">
          <div className="wizard-field-header">
            <label htmlFor="cd-findings">Findings / Microscopic Findings</label>
            <span className="field-tag required">Required to finalize</span>
          </div>
          <textarea
            id="cd-findings"
            rows={4}
            value={value.findings}
            onChange={(event) =>
              onChange({ findings: clean(event.target.value) })
            }
            placeholder="Gross and microscopic findings…"
          />
        </div>

        <div className="wizard-field">
          <div className="wizard-field-header">
            <label htmlFor="cd-diagnosis">Final Diagnosis</label>
            <span className="field-tag required">Required to finalize</span>
          </div>
          <textarea
            id="cd-diagnosis"
            rows={3}
            value={value.diagnosis}
            onChange={(event) =>
              onChange({ diagnosis: clean(event.target.value) })
            }
            placeholder="Final impression / diagnosis…"
          />
        </div>
      </div>
    </div>
  );
}

export type { ClinicalDetails };
