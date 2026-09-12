import { useEffect, useRef } from "react";
import { Save, X } from "lucide-react";
import { sanitizeText } from "../../domain/textRules.mjs";

const g = (value: string) => sanitizeText(value, "general");

export interface TestDraft {
  name: string;
  department: string;
  specimen: string;
}

interface AddTestFormProps {
  value: TestDraft;
  departments: string[];
  onChange: (next: TestDraft) => void;
  onCancel: () => void;
  onSave: () => void;
}

/** Controlled "add laboratory test" modal dialog. State stays with the parent. */
export default function AddTestForm({
  value,
  departments,
  onChange,
  onCancel,
  onSave,
}: AddTestFormProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancelRef.current();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      requestAnimationFrame(() => returnFocusRef.current?.focus());
    };
  }, []);

  function trapDialogFocus(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href]",
    ) ?? [])];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave();
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        ref={dialogRef}
        className="patient-modal test-modal"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={trapDialogFocus}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-test-title"
      >
        <div className="modal-header">
          <div>
            <h2 id="add-test-title">Add Laboratory Test</h2>
            <p>Define a new test catalog entry and assign its department</p>
          </div>

          <button
            type="button"
            className="close-button"
            onClick={onCancel}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group full-width">
              <label htmlFor="at-name">Test Name *</label>
              <input
                id="at-name"
                type="text"
                placeholder="e.g. Complete Blood Count (CBC)"
                value={value.name}
                onChange={(event) =>
                  onChange({ ...value, name: g(event.target.value) })
                }
                autoFocus
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="at-department">Department *</label>
              <input
                id="at-department"
                type="text"
                list="department-options"
                placeholder="e.g. Hematology"
                value={value.department}
                onChange={(event) =>
                  onChange({ ...value, department: g(event.target.value) })
                }
                required
              />

              <datalist id="department-options">
                {departments.map((department) => (
                  <option key={department} value={department} />
                ))}
              </datalist>
            </div>

            <div className="form-group">
              <label htmlFor="at-specimen">Specimen Type</label>
              <input
                id="at-specimen"
                type="text"
                placeholder="e.g. Whole Blood EDTA, Serum"
                value={value.specimen}
                onChange={(event) =>
                  onChange({ ...value, specimen: g(event.target.value) })
                }
              />
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onCancel}
            >
              Cancel
            </button>

            <button type="submit" className="primary-button">
              <Save size={18} />
              Save Test
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
