import { ImagePlus, RotateCcw, Save, Trash2, Upload } from "lucide-react";
import { useState, type ChangeEvent } from "react";
import PageHeading from "../components/layout/PageHeading";
import { confirmDestructive, notifyError, notifySuccess } from "../lib/dialog";
import { useBranding } from "../store/BrandingContext";
import type { LaboratoryProfile } from "../store/branding";

const PROFILE_FIELDS: Array<{
  key: keyof LaboratoryProfile;
  label: string;
  placeholder: string;
  required?: boolean;
  type?: "email" | "text";
}> = [
  { key: "laboratoryName", label: "Laboratory name", placeholder: "PathForge Clinical Laboratory", required: true },
  { key: "shortName", label: "Short display name", placeholder: "PathForge", required: true },
  { key: "reportSubtitle", label: "Report subtitle", placeholder: "Clinical Pathology Report", required: true },
  { key: "addressLine1", label: "Address", placeholder: "Street address" },
  { key: "city", label: "City", placeholder: "City" },
  { key: "country", label: "Country", placeholder: "Country" },
  { key: "phone", label: "Phone", placeholder: "+91 …" },
  { key: "email", label: "Email", placeholder: "reports@example.com", type: "email" },
  { key: "pathologistName", label: "Consultant pathologist", placeholder: "Dr. …" },
  { key: "pathologistQualifications", label: "Pathologist qualifications", placeholder: "MD, DNB …" },
];

export default function LaboratoryProfilePage() {
  const { profile, updateProfile, restoreDefault } = useBranding();
  const [draft, setDraft] = useState(profile);
  const [processingLogo, setProcessingLogo] = useState(false);
  const hasLogo = Boolean(draft.logoDataUrl?.trim());

  async function saveProfile() {
    const missing = PROFILE_FIELDS.slice(0, 3)
      .filter(({ key }) => !draft[key].trim())
      .map(({ label }) => label.toLowerCase());
    if (missing.length > 0) {
      await notifyError({ title: "Complete the report identity", text: `Enter ${missing.join(", ")} before saving.` });
      return;
    }
    updateProfile(draft);
    void notifySuccess({ title: "Laboratory profile saved" });
  }

  async function onLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!new Set(["image/png", "image/jpeg", "image/webp"]).has(file.type) || file.size > 1_000_000) {
      await notifyError({ title: "Logo not accepted", text: "Choose a PNG, JPEG or WebP image no larger than 1 MB." }); return;
    }
    setProcessingLogo(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
      const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = dataUrl; });
      if (dimensions.width > 1200 || dimensions.height > 1200 || dimensions.width < 32 || dimensions.height < 32) throw new Error("Logo dimensions must be between 32 and 1200 pixels.");
      setDraft((value) => ({ ...value, logoDataUrl: dataUrl }));
    } catch (error) { await notifyError({ title: "Logo not accepted", text: error instanceof Error ? error.message : "The image could not be read." }); }
    finally { setProcessingLogo(false); event.target.value = ""; }
  }

  return <section className="viewport-page lab-profile-page" aria-busy={processingLogo}>
    <PageHeading
      title="Laboratory Profile"
      subtitle="Set the identity and sign-off details that appear on new reports."
      actions={<button type="button" className="primary-button" onClick={() => void saveProfile()}><Save size={16} />Save profile</button>}
    />
    <div className="pf-card lab-profile-layout">
      <div className="card-body lab-profile-form">
        <fieldset>
          <legend>Report identity</legend>
          <p className="fieldset-hint">These details appear in the report header and footer.</p>
          <div className="profile-fields">
            {PROFILE_FIELDS.slice(0, 3).map(({ key, label, placeholder, required }) => <label key={key}><span>{label}{required && <em>Required</em>}</span><input value={draft[key]} placeholder={placeholder} aria-required={required} required={required} onChange={(event) => setDraft((value) => ({ ...value, [key]: event.target.value }))} /></label>)}
          </div>
        </fieldset>
        <fieldset>
          <legend>Contact and sign-off</legend>
          <p className="fieldset-hint">Only the contact and consultant details needed for a clear report are shown here.</p>
          <div className="profile-fields">
            {PROFILE_FIELDS.slice(3).map(({ key, label, placeholder, type }) => <label key={key}><span>{label}</span><input type={type ?? "text"} value={draft[key]} placeholder={placeholder} onChange={(event) => setDraft((value) => ({ ...value, [key]: event.target.value }))} /></label>)}
          </div>
        </fieldset>
        <fieldset>
          <legend>Laboratory logo <span className="fieldset-optional">Optional</span></legend>
          <div className="logo-editor">
            {hasLogo ? <img src={draft.logoDataUrl} alt="Laboratory logo preview" /> : <div className="logo-placeholder" aria-label="No laboratory logo added"><ImagePlus size={22} aria-hidden="true" /><span>No logo added</span></div>}
            <div>
              <label className="secondary-button logo-upload"><Upload size={16} />{processingLogo ? "Processing…" : hasLogo ? "Replace logo" : "Choose logo"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={onLogo} disabled={processingLogo} /></label>
              {hasLogo && <button type="button" className="secondary-button" onClick={() => setDraft((value) => ({ ...value, logoDataUrl: "" }))}><Trash2 size={16} />Remove</button>}
              <p className="helper-text">Shown on the report only when you add one. PNG, JPEG or WebP; 32–1200 px; maximum 1 MB.</p>
            </div>
          </div>
        </fieldset>
        <button type="button" className="secondary-button" onClick={async () => { const accepted = await confirmDestructive({ title: "Restore default profile?", text: "This replaces the current laboratory profile. Finalized report snapshots are not changed.", confirmText: "Restore defaults", cancelText: "Keep profile" }); if (accepted) { restoreDefault(); location.reload(); } }}><RotateCcw size={16} />Restore defaults</button>
      </div>
      <aside className="profile-preview" aria-label="Laboratory identity preview">{hasLogo && <img src={draft.logoDataUrl} alt="" />}<span className="profile-preview-kicker">Report header preview</span><strong>{draft.laboratoryName || "Laboratory name"}</strong><span>{draft.reportSubtitle || "Report subtitle"}</span><small>{[draft.city, draft.phone, draft.email].filter(Boolean).join(" · ") || "Contact details will appear here"}</small></aside>
    </div>
  </section>;
}
