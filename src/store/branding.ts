export interface LaboratoryProfile {
  laboratoryName: string;
  shortName: string;
  logoDataUrl: string;
  reportSubtitle: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  phone: string;
  alternatePhone: string;
  email: string;
  website: string;
  registrationNumber: string;
  accreditationName: string;
  accreditationNumber: string;
  workingHours: string;
  footerNote: string;
  technologistName: string;
  technologistDesignation: string;
  pathologistName: string;
  pathologistQualifications: string;
  pathologistDesignation: string;
}

export const DEFAULT_LABORATORY_PROFILE: LaboratoryProfile = {
  laboratoryName: "PathForge Clinical Laboratory", shortName: "PathForge", logoDataUrl: "", reportSubtitle: "Clinical Pathology Report",
  addressLine1: "", addressLine2: "", city: "", state: "", postcode: "", country: "India", phone: "", alternatePhone: "", email: "", website: "",
  registrationNumber: "", accreditationName: "", accreditationNumber: "", workingHours: "", footerNote: "",
  technologistName: "", technologistDesignation: "Lab technologist", pathologistName: "", pathologistQualifications: "", pathologistDesignation: "Consultant pathologist",
};

const PROFILE_KEYS = Object.keys(DEFAULT_LABORATORY_PROFILE) as Array<keyof LaboratoryProfile>;
const LOGO_DATA_URL_RE = /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/]+={0,2}$/i;

/** Return only raster image data that the upload flow can produce. */
export function getUsableLogoDataUrl(value: unknown): string {
  const candidate = typeof value === "string" ? value.trim() : "";
  return LOGO_DATA_URL_RE.test(candidate) ? candidate : "";
}

function normalizeLaboratoryProfile(value: unknown): LaboratoryProfile {
  const stored = value && typeof value === "object" ? value as Partial<LaboratoryProfile> : {};
  const profile = { ...DEFAULT_LABORATORY_PROFILE, ...stored } as LaboratoryProfile;
  for (const key of PROFILE_KEYS) {
    if (typeof profile[key] !== "string") profile[key] = DEFAULT_LABORATORY_PROFILE[key];
  }
  return profile;
}

const PROFILE_KEY = "pathforge.laboratory-profile.v1";
const SNAPSHOT_KEY = "pathforge.laboratory-branding-snapshots.v1";

export function loadLaboratoryProfile(): LaboratoryProfile {
  try { return normalizeLaboratoryProfile(JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "{}")); }
  catch { return { ...DEFAULT_LABORATORY_PROFILE }; }
}
export function saveLaboratoryProfile(profile: LaboratoryProfile): void { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); }
export function snapshotLaboratoryProfile(reportId: string, version: number, profile = loadLaboratoryProfile()): void {
  let snapshots: Record<string, LaboratoryProfile> = {};
  try { snapshots = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) ?? "{}"); } catch { snapshots = {}; }
  snapshots[`${reportId}::${version}`] = structuredClone(profile);
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots));
}
export function loadLaboratorySnapshot(reportId: string, version: number): LaboratoryProfile | undefined {
  try { return JSON.parse(localStorage.getItem(SNAPSHOT_KEY) ?? "{}")[`${reportId}::${version}`]; } catch { return undefined; }
}
