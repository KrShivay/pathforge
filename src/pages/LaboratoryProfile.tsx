import { RotateCcw, Save, Trash2, Upload } from "lucide-react";
import { useState, type ChangeEvent } from "react";
import PageHeading from "../components/layout/PageHeading";
import { confirmDestructive, notifyError, notifySuccess } from "../lib/dialog";
import { useBranding } from "../store/BrandingContext";
import type { LaboratoryProfile } from "../store/branding";

const FIELDS: Array<[keyof LaboratoryProfile, string, string]> = [
  ["laboratoryName", "Laboratory name", "PathForge Clinical Laboratory"], ["shortName", "Short display name", "PathForge"], ["reportSubtitle", "Report subtitle", "Clinical Pathology Report"],
  ["addressLine1", "Address line 1", ""], ["addressLine2", "Address line 2", ""], ["city", "City", ""], ["state", "State", ""], ["postcode", "Postcode", ""], ["country", "Country", ""],
  ["phone", "Phone", ""], ["alternatePhone", "Alternate phone", ""], ["email", "Email", ""], ["website", "Website", ""], ["registrationNumber", "Registration number", ""],
  ["accreditationName", "Accreditation name", ""], ["accreditationNumber", "Accreditation number", ""], ["workingHours", "Working hours", ""], ["footerNote", "Footer / contact note", ""],
  ["technologistName", "Lab technologist name", ""], ["technologistDesignation", "Lab technologist designation", ""], ["pathologistName", "Consultant pathologist name", ""],
  ["pathologistQualifications", "Consultant pathologist qualifications", ""], ["pathologistDesignation", "Consultant pathologist designation", ""],
];

export default function LaboratoryProfilePage() {
  const { profile, updateProfile, restoreDefault } = useBranding();
  const [draft, setDraft] = useState(profile);
  const [processingLogo, setProcessingLogo] = useState(false);

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
      subtitle="Identity used by the fixed PathForge navbar and report design."
      actions={<button type="button" className="primary-button" onClick={() => { updateProfile(draft); void notifySuccess({ title: "Laboratory profile saved" }); }}><Save size={16} />Save profile</button>}
    />
    <div className="pf-card lab-profile-layout">
      <div className="card-body lab-profile-form">
        <fieldset><legend>Brand mark</legend><div className="logo-editor">{draft.logoDataUrl ? <img src={draft.logoDataUrl} alt="Laboratory logo preview" /> : <div className="logo-placeholder" aria-hidden="true">{draft.shortName.slice(0, 2).toUpperCase()}</div>}<div><label className="secondary-button logo-upload"><Upload size={16} />{processingLogo ? "Processing…" : "Choose logo"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={onLogo} disabled={processingLogo} /></label>{draft.logoDataUrl && <button type="button" className="secondary-button" onClick={() => setDraft((value) => ({ ...value, logoDataUrl: "" }))}><Trash2 size={16} />Remove</button>}<p className="helper-text">PNG, JPEG or WebP; 32–1200 px; maximum 1 MB.</p></div></div></fieldset>
        <fieldset><legend>Laboratory and report details</legend><div className="profile-fields">{FIELDS.map(([key, label, placeholder]) => <label key={key}>{label}<input value={draft[key]} placeholder={placeholder} onChange={(event) => setDraft((value) => ({ ...value, [key]: event.target.value }))} /></label>)}</div></fieldset>
        <button type="button" className="secondary-button" onClick={async () => { const accepted = await confirmDestructive({ title: "Restore default profile?", text: "This replaces the current laboratory profile. Finalized report snapshots are not changed.", confirmText: "Restore defaults", cancelText: "Keep profile" }); if (accepted) { restoreDefault(); location.reload(); } }}><RotateCcw size={16} />Restore defaults</button>
      </div>
      <aside className="profile-preview" aria-label="Laboratory identity preview">{draft.logoDataUrl && <img src={draft.logoDataUrl} alt="" />}<strong>{draft.laboratoryName || "Laboratory name"}</strong><span>{draft.reportSubtitle || "Report subtitle"}</span><small>{[draft.city, draft.phone, draft.email].filter(Boolean).join(" · ")}</small></aside>
    </div>
  </section>;
}
