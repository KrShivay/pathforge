import { Save, X } from "lucide-react";
import { sanitizeText } from "../../domain/textRules.mjs";

const g = (value: string) => sanitizeText(value, "general");

export interface ParameterDraft {
  name: string;
  type: "number" | "text";
  unit: string;
  min: string;
  max: string;
  referenceText: string;
}

interface AddParameterFormProps {
  value: ParameterDraft;
  onChange: (next: ParameterDraft) => void;
  onCancel: () => void;
  onSave: () => void;
}

/** Controlled "add parameter" form shown under an expanded test. */
export default function AddParameterForm({
  value,
  onChange,
  onCancel,
  onSave,
}: AddParameterFormProps) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave();
  }

  return (
    <div className="parameter-form-card">
      <div className="parameter-form-header">
        <div>
          <h4>Add Test Parameter</h4>
          <p>Configure measurement type, unit, and clinical reference ranges</p>
        </div>

        <button
          type="button"
          className="close-button"
          onClick={onCancel}
          aria-label="Cancel adding parameter"
        >
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="ap-name">Parameter Name *</label>
            <input
              id="ap-name"
              placeholder="e.g. Total Leukocyte Count"
              value={value.name}
              onChange={(event) =>
                onChange({ ...value, name: g(event.target.value) })
              }
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="ap-type">Result Type</label>
            <select
              id="ap-type"
              value={value.type}
              onChange={(event) => {
                const type = event.target.value as "number" | "text";
                onChange(
                  type === "text"
                    ? { ...value, type, min: "", max: "" }
                    : { ...value, type, referenceText: "" }
                );
              }}
            >
              <option value="number">Numeric</option>
              <option value="text">Text / Qualitative</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="ap-unit">Unit of Measurement</label>
            <input
              id="ap-unit"
              placeholder="e.g. mg/dL, g/dL, cells/mm³"
              value={value.unit}
              onChange={(event) =>
                onChange({ ...value, unit: g(event.target.value) })
              }
            />
          </div>

          {value.type === "number" ? (
            <>
              <div className="form-group">
                <label htmlFor="ap-min">Reference Range: Min</label>
                <input
                  id="ap-min"
                  type="number"
                  step="any"
                  placeholder="e.g. 4000"
                  value={value.min}
                  onChange={(event) =>
                    onChange({ ...value, min: event.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label htmlFor="ap-max">Reference Range: Max</label>
                <input
                  id="ap-max"
                  type="number"
                  step="any"
                  placeholder="e.g. 11000"
                  value={value.max}
                  onChange={(event) =>
                    onChange({ ...value, max: event.target.value })
                  }
                />
              </div>
            </>
          ) : (
            <div className="form-group">
              <label htmlFor="ap-reference-text">Text Reference / Expected Value</label>
              <input
                id="ap-reference-text"
                placeholder="e.g. Negative, Nil, Clear"
                value={value.referenceText}
                onChange={(event) =>
                  onChange({ ...value, referenceText: g(event.target.value) })
                }
              />
            </div>
          )}
        </div>

        <div className="parameter-form-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
          >
            Cancel
          </button>

          <button type="submit" className="primary-button">
            <Save size={16} />
            Add Parameter
          </button>
        </div>
      </form>
    </div>
  );
}
