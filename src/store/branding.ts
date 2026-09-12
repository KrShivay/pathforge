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

const PROFILE_KEY = "pathforge.laboratory-profile.v1";
const SNAPSHOT_KEY = "pathforge.laboratory-branding-snapshots.v1";

export function loadLaboratoryProfile(): LaboratoryProfile {
  try { return { ...DEFAULT_LABORATORY_PROFILE, ...JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "{}") }; }
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
