import { RotateCcw, Save, Trash2, Upload } from "lucide-react";
import { useEffect, useState, type ChangeEvent } from "react";
import PageHeading from "../components/layout/PageHeading";
import { confirmDestructive, notifyError, notifySuccess } from "../lib/dialog";
import { useBranding } from "../store/BrandingContext";
import { getUsableLogoDataUrl, type LaboratoryProfileTextKey } from "../store/branding";
import { MARGIN_LIMITS_MM, mmToPx, validatePrintLayout } from "../components/report/printLayout.ts";

const MARGIN_SIDES = ["top", "right", "bottom", "left"] as const;
type MarginSide = (typeof MARGIN_SIDES)[number];
const MARGIN_LABELS: Record<MarginSide, string> = {
  top: "Top margin (mm)",
  right: "Right margin (mm)",
  bottom: "Bottom margin (mm)",
  left: "Left margin (mm)",
};

interface ProfileField {
  key: LaboratoryProfileTextKey;
  label: string;
  placeholder: string;
  type?: "email" | "text";
}

interface ProfileGroup {
  legend: string;
  hint: string;
  fields: ProfileField[];
}

interface LaboratoryProfilePageProps {
  onDirtyChange?: (dirty: boolean) => void;
}

/**
 * Every profile detail is editable here. Only the laboratory name is required —
 * each of the others prints on the report exactly when it is filled in, and is
 * simply left off the page while it is blank.
 */
const REQUIRED_FIELD: ProfileField = {
  key: "laboratoryName",
  label: "Laboratory name",
  placeholder: "Adarsh Diagnostics Center",
};

const PROFILE_GROUPS: ProfileGroup[] = [
  {
    legend: "Report identity",
    hint: "The laboratory name heads every report. The rest print under it when filled.",
    fields: [
      { key: "shortName", label: "Short display name", placeholder: "Adarsh Diagnostics" },
      { key: "reportSubtitle", label: "Report subtitle", placeholder: "Clinical Pathology Report" },
      { key: "proprietorName", label: "Proprietor", placeholder: "Kapil Kumar Porwal" },
      { key: "registrationNumber", label: "Registration number", placeholder: "ETW/ALO/0002/05" },
      { key: "accreditationName", label: "Accreditation body", placeholder: "NABL" },
      { key: "accreditationNumber", label: "Accreditation number", placeholder: "MC-1234" },
    ],
  },
  {
    legend: "Address",
    hint: "Printed as one address line in the report letterhead.",
    fields: [
      { key: "addressLine1", label: "Address line 1", placeholder: "Collectry Road" },
      { key: "addressLine2", label: "Address line 2", placeholder: "Dibiyapur" },
      { key: "city", label: "City / district", placeholder: "Auraiya" },
      { key: "state", label: "State", placeholder: "Uttar Pradesh" },
      { key: "postcode", label: "PIN code", placeholder: "206244" },
      { key: "country", label: "Country", placeholder: "India" },
    ],
  },
  {
    legend: "Contact",
    hint: "Phone, email and website print together under the address; the footer note replaces the default footer line.",
    fields: [
      { key: "phone", label: "Phone", placeholder: "+91 …" },
      { key: "alternatePhone", label: "Alternate phone", placeholder: "+91 …" },
      { key: "email", label: "Email", placeholder: "reports@example.com", type: "email" },
      { key: "website", label: "Website", placeholder: "www.example.com" },
      { key: "workingHours", label: "Working hours", placeholder: "Mon–Sat, 8:00 AM – 8:00 PM" },
      { key: "footerNote", label: "Report footer note", placeholder: "Shown in the centre of the report footer" },
    ],
  },
  {
    legend: "Sign-off",
    hint: "These name the two signature blocks at the end of the report.",
    fields: [
      { key: "technologistName", label: "Lab technologist", placeholder: "Name" },
      { key: "technologistDesignation", label: "Technologist designation", placeholder: "Lab technologist" },
      { key: "pathologistName", label: "Consultant pathologist", placeholder: "Dr. …" },
      { key: "pathologistQualifications", label: "Pathologist qualifications", placeholder: "MD, DNB …" },
      { key: "pathologistDesignation", label: "Pathologist designation", placeholder: "Consultant pathologist" },
    ],
  },
];

export default function LaboratoryProfilePage({ onDirtyChange }: LaboratoryProfilePageProps) {
  const { profile, updateProfile, restoreDefault } = useBranding();
  const [draft, setDraft] = useState(profile);
  const [marginInputs, setMarginInputs] = useState<Record<MarginSide, string>>(() => ({
    top: String(profile.printLayout.marginsMm.top),
    right: String(profile.printLayout.marginsMm.right),
    bottom: String(profile.printLayout.marginsMm.bottom),
    left: String(profile.printLayout.marginsMm.left),
  }));
  const [processingLogo, setProcessingLogo] = useState(false);
  const logoDataUrl = getUsableLogoDataUrl(draft.logoDataUrl);
  const hasLogo = Boolean(logoDataUrl);
  const marginsChanged = MARGIN_SIDES.some((side) => marginInputs[side] !== String(profile.printLayout.marginsMm[side]));
  const isDirty = JSON.stringify(draft) !== JSON.stringify(profile) || marginsChanged;
  const candidateLayout = {
    ...draft.printLayout,
    marginsMm: Object.fromEntries(MARGIN_SIDES.map((side) => [side, marginInputs[side].trim() ? Number(marginInputs[side]) : Number.NaN])) as Record<MarginSide, number>,
  };
  const layoutErrors = validatePrintLayout(candidateLayout);

  useEffect(() => {
    onDirtyChange?.(isDirty);
    return () => onDirtyChange?.(false);
  }, [isDirty, onDirtyChange]);

  async function saveProfile() {
    const candidateLayout = {
      ...draft.printLayout,
      marginsMm: Object.fromEntries(MARGIN_SIDES.map((side) => [side, marginInputs[side].trim() ? Number(marginInputs[side]) : Number.NaN])) as Record<MarginSide, number>,
    };
    const layoutErrors = validatePrintLayout(candidateLayout);
    if (layoutErrors.length) {
      await notifyError({ title: "Print layout is not valid", text: layoutErrors.join(" ") });
      return;
    }
    if (!draft[REQUIRED_FIELD.key].trim()) {
      await notifyError({ title: "Laboratory name is required", text: "Every report is headed by the laboratory name. Enter one before saving." });
      return;
    }
    setMarginInputs({
      top: String(candidateLayout.marginsMm.top),
      right: String(candidateLayout.marginsMm.right),
      bottom: String(candidateLayout.marginsMm.bottom),
      left: String(candidateLayout.marginsMm.left),
    });
    updateProfile({ ...draft, printLayout: candidateLayout });
    onDirtyChange?.(false);
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
        {PROFILE_GROUPS.map((group, groupIndex) => <fieldset key={group.legend}>
          <legend>{group.legend}{groupIndex > 0 && <span className="fieldset-optional">Optional</span>}</legend>
          <p className="fieldset-hint">{group.hint}</p>
          <div className="profile-fields">
            {groupIndex === 0 && <label key={REQUIRED_FIELD.key}><span>{REQUIRED_FIELD.label}<em>Required</em></span><input value={draft[REQUIRED_FIELD.key]} placeholder={REQUIRED_FIELD.placeholder} aria-required required onChange={(event) => setDraft((value) => ({ ...value, [REQUIRED_FIELD.key]: event.target.value }))} /></label>}
            {group.fields.map(({ key, label, placeholder, type }) => <label key={key}><span>{label}</span><input type={type ?? "text"} value={draft[key]} placeholder={placeholder} onChange={(event) => setDraft((value) => ({ ...value, [key]: event.target.value }))} /></label>)}
          </div>
        </fieldset>)}
        <fieldset>
          <legend>Print layout</legend>
          <p className="fieldset-hint">Millimetres on A4; 1 mm ≈ 3.78 CSS px. The top margin is measured from the page top to the first printed line (for example, 120 px = 31.75 mm). Finalized reports keep the layout they were issued with.</p>
          <div className="profile-fields">
            <label className="print-layout-toggle">
              <input
                type="checkbox"
                checked={draft.printLayout.showLetterhead}
                onChange={(event) => setDraft((value) => ({ ...value, printLayout: { ...value.printLayout, showLetterhead: event.target.checked } }))}
              />
              <span>Print laboratory header (letterhead)</span>
            </label>
            <p className="helper-text print-layout-helper">Turn this off when printing on pre-printed letterhead stationery; patient details, results and footer always print.</p>
            {MARGIN_SIDES.map((side) => {
              const errorId = `print-layout-${side}-error`;
              const text = marginInputs[side];
              const sideLabel = `${side[0]?.toUpperCase()}${side.slice(1)} margin`;
              const error = layoutErrors.find((message) =>
                message.startsWith(sideLabel) ||
                ((side === "left" || side === "right") && message.startsWith("Left and right margins together")),
              ) ?? "";
              return <label key={side}>
                <span>{MARGIN_LABELS[side]}</span>
                <input
                  type="number"
                  step="0.01"
                  min={MARGIN_LIMITS_MM[side].min}
                  max={MARGIN_LIMITS_MM[side].max}
                  value={text}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? errorId : undefined}
                  onChange={(event) => {
                    const next = event.target.value;
                    setMarginInputs((value) => ({ ...value, [side]: next }));
                    const valueNumber = next.trim() ? Number(next) : Number.NaN;
                    if (Number.isFinite(valueNumber)) {
                      setDraft((value) => ({
                        ...value,
                        printLayout: { ...value.printLayout, marginsMm: { ...value.printLayout.marginsMm, [side]: valueNumber } },
                      }));
                    }
                  }}
                />
                <small>≈ {Math.round(mmToPx(draft.printLayout.marginsMm[side]))} px</small>
                {error && <small id={errorId} role="alert">{error}</small>}
              </label>;
            })}
          </div>
        </fieldset>
        <fieldset>
          <legend>Laboratory logo <span className="fieldset-optional">Optional</span></legend>
          <div className="logo-editor">
            {hasLogo ? <img src={logoDataUrl} alt="Laboratory logo preview" /> : <div className="logo-placeholder" aria-label="No laboratory logo uploaded"><span>No logo uploaded</span></div>}
            <div className="logo-actions" role="group" aria-label="Laboratory logo actions">
              <label className="secondary-button logo-upload"><Upload size={16} />{processingLogo ? "Processing…" : hasLogo ? "Replace logo" : "Choose logo"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={onLogo} disabled={processingLogo} /></label>
              {hasLogo && <button type="button" className="secondary-button" onClick={() => setDraft((value) => ({ ...value, logoDataUrl: "" }))}><Trash2 size={16} />Remove</button>}
              <p className="helper-text">Shown on the report only when you add one. PNG, JPEG or WebP; 32–1200 px; maximum 1 MB.</p>
            </div>
          </div>
        </fieldset>
        <div className="profile-reset-zone" role="group" aria-labelledby="profile-reset-title">
          <div>
            <h3 id="profile-reset-title">Reset profile</h3>
            <p>Restore the default laboratory identity and contact details.</p>
          </div>
          <button type="button" className="secondary-button destructive-secondary-button" onClick={async () => { const accepted = await confirmDestructive({ title: "Restore default profile?", text: "This replaces the current laboratory profile. Finalized report snapshots are not changed.", confirmText: "Restore defaults", cancelText: "Keep profile" }); if (accepted) { restoreDefault(); onDirtyChange?.(false); location.reload(); } }}><RotateCcw size={16} />Restore defaults</button>
        </div>
      </div>
      <aside className="profile-preview" aria-label="Laboratory identity preview">
          {hasLogo && <img src={logoDataUrl} alt="" />}
          <span className="profile-preview-kicker">Report header preview</span>
          <small>Header: {draft.printLayout.showLetterhead ? "shown" : "hidden"} · Margins T/R/B/L: {MARGIN_SIDES.map((side) => draft.printLayout.marginsMm[side].toFixed(2)).join("/")} mm</small>
          <strong>{draft.laboratoryName || "Laboratory name"}</strong>
          <span>{draft.reportSubtitle || "Report subtitle"}</span>
          {draft.proprietorName && <span>Prop. {draft.proprietorName}</span>}
          {(() => {
            const address = [draft.addressLine1, draft.addressLine2, draft.city, draft.state, draft.postcode, draft.country].filter(Boolean).join(", ");
            const contact = [draft.phone, draft.alternatePhone, draft.email, draft.website].filter(Boolean).join(" · ");
            const strapline = [draft.accreditationName, draft.accreditationNumber, draft.registrationNumber ? `Reg. No. ${draft.registrationNumber}` : ""].filter(Boolean).join(" · ");
            const hours = draft.workingHours.trim();
            const techLine = [draft.technologistName, draft.technologistDesignation].filter(Boolean).join(", ");
            const pathoLine = [draft.pathologistName, draft.pathologistQualifications, draft.pathologistDesignation].filter(Boolean).join(", ");
            const footer = draft.shortName || draft.laboratoryName || "";
            const footerNote = draft.footerNote || draft.phone || "";
            return <>
              {address && <small>{address}</small>}
              {contact && <small>{contact}</small>}
              {hours && <small>{hours}</small>}
              {strapline && <small>{strapline}</small>}
              {!address && !contact && !strapline && <small className="profile-preview-empty">Contact details will appear here</small>}
              {(techLine || pathoLine) && <span className="profile-preview-divider" />}
              {techLine && <small><em>Technologist:</em> {techLine}</small>}
              {pathoLine && <small><em>Pathologist:</em> {pathoLine}</small>}
              {(footer || footerNote) && <span className="profile-preview-divider" />}
              {footer && <small><em>Footer ref:</em> {footer}</small>}
              {footerNote && <small><em>Footer note:</em> {footerNote}</small>}
            </>;
          })()}
        </aside>
    </div>
  </section>;
}
