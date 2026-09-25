import { sha256Hex } from "../domain/sha256.mjs";
import { DEFAULT_LOGO_DATA_URL } from "./defaultLogo.ts";
import { DEFAULT_PRINT_LAYOUT, normalizePrintLayout, type PrintLayout } from "../components/report/printLayout.ts";

export interface LaboratoryProfile {
  laboratoryName: string;
  shortName: string;
  logoDataUrl: string;
  reportSubtitle: string;
  /** Proprietor / owner line printed under the laboratory name. */
  proprietorName: string;
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
  printLayout: PrintLayout;
}

export type LaboratoryProfileTextKey = Exclude<keyof LaboratoryProfile, "printLayout">;

/**
 * The laboratory this workspace ships for. Only the identity the owner supplied
 * is prefilled; every other field stays blank and is optional, and each one is
 * printed on the report as soon as it is filled in.
 */
export const DEFAULT_LABORATORY_PROFILE: LaboratoryProfile = {
  laboratoryName: "Adarsh Diagnostics Center", shortName: "Adarsh Diagnostics", logoDataUrl: DEFAULT_LOGO_DATA_URL, reportSubtitle: "Clinical Pathology Report",
  proprietorName: "Kapil Kumar Porwal",
  addressLine1: "Collectry Road", addressLine2: "Dibiyapur", city: "Auraiya", state: "", postcode: "", country: "India", phone: "", alternatePhone: "", email: "", website: "",
  registrationNumber: "ETW/ALO/0002/05", accreditationName: "", accreditationNumber: "", workingHours: "", footerNote: "",
  technologistName: "", technologistDesignation: "Lab technologist", pathologistName: "", pathologistQualifications: "", pathologistDesignation: "Consultant pathologist",
  printLayout: normalizePrintLayout(DEFAULT_PRINT_LAYOUT),
};

const PROFILE_KEYS = Object.keys(DEFAULT_LABORATORY_PROFILE).filter((key) => key !== "printLayout") as LaboratoryProfileTextKey[];
const LOGO_DATA_URL_RE = /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/]+={0,2}$/i;

/** Return only raster image data that the upload flow can produce. */
export function getUsableLogoDataUrl(value: unknown): string {
  const candidate = typeof value === "string" ? value.trim() : "";
  return LOGO_DATA_URL_RE.test(candidate) ? candidate : "";
}

export function normalizeLaboratoryProfile(value: unknown): LaboratoryProfile {
  const stored = value && typeof value === "object" ? value as Partial<LaboratoryProfile> : {};
  const profile = { ...DEFAULT_LABORATORY_PROFILE, ...stored } as LaboratoryProfile;
  for (const key of PROFILE_KEYS) {
    if (typeof profile[key] !== "string") profile[key] = DEFAULT_LABORATORY_PROFILE[key];
  }
  profile.printLayout = normalizePrintLayout(stored.printLayout);
  return profile;
}

const PROFILE_KEY = "pathforge.laboratory-profile.v1";
const SNAPSHOT_KEY = "pathforge.laboratory-branding-snapshots.v1";
const LOGO_STORE_KEY = "pathforge.laboratory-logos.v1";
const LOGO_REFERENCE_PREFIX = "logo:";

/**
 * Snapshots keep an embedded logo out of every finalized version's copy.
 *
 * Each finalized version freezes the whole profile, and the logo is by far its
 * largest field (tens of KB). Written inline, a few dozen reports would fill the
 * browser's storage quota and the next finalization would fail. The image is
 * instead written once under a hash of its own bytes, and each snapshot keeps a
 * reference — identical branding costs one copy no matter how many reports
 * freeze it, and the frozen image is still exactly the one that was printed.
 */
function storeSnapshotLogo(dataUrl: string): string {
  if (!getUsableLogoDataUrl(dataUrl)) return "";

  const reference = `${LOGO_REFERENCE_PREFIX}${sha256Hex(dataUrl)}`;
  let logos: Record<string, string> = {};
  try { logos = JSON.parse(localStorage.getItem(LOGO_STORE_KEY) ?? "{}"); } catch { logos = {}; }
  if (logos[reference] !== dataUrl) {
    logos[reference] = dataUrl;
    localStorage.setItem(LOGO_STORE_KEY, JSON.stringify(logos));
  }
  return reference;
}

/** Resolve a stored reference. Snapshots written before this held the image inline. */
function resolveSnapshotLogo(value: string): string {
  if (!value.startsWith(LOGO_REFERENCE_PREFIX)) return value;
  try {
    const logos = JSON.parse(localStorage.getItem(LOGO_STORE_KEY) ?? "{}") as Record<string, string>;
    return typeof logos[value] === "string" ? logos[value] : "";
  } catch {
    return "";
  }
}

/**
 * The identity this workspace shipped with before it was set up for the
 * laboratory. A stored profile still carrying it was never configured by
 * anyone — it is the old default sitting in browser storage — so it is
 * replaced by the current default rather than shadowing it forever.
 */
const SUPERSEDED_DEFAULT_NAME = "PathForge Clinical Laboratory";

export function loadLaboratoryProfile(): LaboratoryProfile {
  try {
    const profile = normalizeLaboratoryProfile(JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "{}"));
    if (profile.laboratoryName.trim() === SUPERSEDED_DEFAULT_NAME) {
      return normalizeLaboratoryProfile(DEFAULT_LABORATORY_PROFILE);
    }
    return profile;
  } catch {
    return normalizeLaboratoryProfile(DEFAULT_LABORATORY_PROFILE);
  }
}
export function saveLaboratoryProfile(profile: LaboratoryProfile): void { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); }
export function snapshotLaboratoryProfile(reportId: string, version: number, profile = loadLaboratoryProfile()): void {
  let snapshots: Record<string, LaboratoryProfile> = {};
  try { snapshots = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) ?? "{}"); } catch { snapshots = {}; }
  snapshots[`${reportId}::${version}`] = {
    ...structuredClone(profile),
    logoDataUrl: storeSnapshotLogo(profile.logoDataUrl),
  };
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots));
}
export function loadLaboratorySnapshot(reportId: string, version: number): LaboratoryProfile | undefined {
  try {
    const snapshot = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) ?? "{}")[`${reportId}::${version}`] as
      | LaboratoryProfile
      | undefined;
    if (!snapshot) return undefined;
    return normalizeLaboratoryProfile({ ...snapshot, logoDataUrl: resolveSnapshotLogo(snapshot.logoDataUrl ?? "") });
  } catch {
    return undefined;
  }
}
