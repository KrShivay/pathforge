import { useEffect, useMemo, useState } from "react";

import { sanitizePhone, sanitizeText } from "../../domain/textRules.mjs";
import { notifySuccess } from "../../lib/dialog";
import { usePatients, type NewPatientInput } from "../../store/PatientContext";

interface PatientFormProps {
  onSaved: (patientId: string) => void;
  onCancel?: () => void;
  cancelLabel?: string;
  submitLabel?: string;
  busy?: boolean;
  /** Reports whether the form has any entered value, so a host modal can
   * confirm before an accidental close (backdrop click, Escape) discards it. */
  onDirtyChange?: (dirty: boolean) => void;
}

const SEX_OPTIONS = ["Female", "Male", "Other"] as const;

/**
 * Register-a-patient form. Used by the Patients page and by the New Report
 * wizard's "create new patient" step, so both paths generate the Patient ID and
 * persist the record through exactly the same code.
 */
export default function PatientForm({
  onSaved,
  onCancel,
  cancelLabel = "Cancel",
  submitLabel = "Save Patient",
  busy = false,
  onDirtyChange,
}: PatientFormProps) {
  const { addPatient, previewPatientId } = usePatients();

  const emptyForm = {
    name: "",
    age: "",
    gender: "",
    phone: "",
    address: "",
  };

  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    onDirtyChange?.(Object.values(form).some((value) => value.trim() !== ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  // Shown for information only. The real ID is generated at save time so it can
  // never drift or be edited (spec §6).
  const idPreview = useMemo(() => previewPatientId(), [previewPatientId]);

  const disabled = busy || saving;

  // Filter as the user types — invalid characters never enter the field, and a
  // paste is stripped rather than accepted.
  function update<K extends keyof typeof form>(key: K, value: string) {
    const clean =
      key === "phone"
        ? sanitizePhone(value)
        : key === "name" || key === "address"
          ? sanitizeText(value, "general")
          : value;
    setForm((previous) => ({ ...previous, [key]: clean }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;

    const name = sanitizeText(form.name, "general").trim();
    const phone = sanitizePhone(form.phone).trim();
    const age = Number(form.age);

    if (!name) return setError("Patient name is required.");
    if (!form.age || Number.isNaN(age) || age < 0 || age > 150) {
      return setError("Enter a valid age.");
    }
    if (!form.gender) return setError("Select the patient's sex.");
    if (!phone) return setError("Phone number is required.");

    const input: NewPatientInput = {
      name,
      age,
      gender: form.gender,
      phone,
      address: sanitizeText(form.address, "general").trim() || undefined,
    };

    setSaving(true);
    setError("");
    try {
      const patient = await addPatient(input);
      setForm(emptyForm);
      void notifySuccess({
        title: "Patient created",
        text: `${patient.name} is ready for reporting.`,
      });
      onSaved(patient.id);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? `Could not save the patient: ${saveError.message}`
          : "Could not save the patient.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="patient-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <div className="form-group full-width">
          <label htmlFor="pf-name">Name *</label>
          <input
            id="pf-name"
            type="text"
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder="Full name"
            disabled={disabled}
            autoFocus
          />
        </div>

        <div className="form-group">
          <label htmlFor="pf-age">Age *</label>
          <input
            id="pf-age"
            type="number"
            min="0"
            max="150"
            value={form.age}
            onChange={(event) => update("age", event.target.value)}
            placeholder="Years"
            disabled={disabled}
          />
        </div>

        <div className="form-group">
          <label htmlFor="pf-sex">Gender *</label>
          <select
            id="pf-sex"
            value={form.gender}
            onChange={(event) => update("gender", event.target.value)}
            disabled={disabled}
          >
            <option value="">Select</option>
            {SEX_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group full-width">
          <label htmlFor="pf-phone">Phone Number *</label>
          <input
            id="pf-phone"
            type="tel"
            value={form.phone}
            onChange={(event) => {
              const value = event.target.value.replace(/\D/g, "").slice(0, 10);
              update("phone", value);
            }}
            placeholder="987XXXX321"
            inputMode="numeric"
            maxLength={10}
            pattern="[0-9]{10}"
            disabled={disabled}
          />
        </div>

        <div className="form-group full-width">
          <label htmlFor="pf-address">Address (Optional)</label>
          <textarea
            id="pf-address"
            rows={2}
            value={form.address}
            onChange={(event) => update("address", event.target.value)}
            placeholder="123 Main St, Springfield"
            disabled={disabled}
          />
        </div>

        <div style={{ display: "none" }}>
          <label>Patient ID</label>
          <div className="patient-id-preview">
            <strong>{idPreview}</strong>
            <span>Automatically generated</span>
          </div>
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="modal-actions">
        {onCancel ? (
          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
            disabled={disabled}
          >
            {cancelLabel}
          </button>
        ) : null}
        <button type="submit" className="primary-button" disabled={disabled}>
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
