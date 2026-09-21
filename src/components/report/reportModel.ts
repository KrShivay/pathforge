import type { TestResult } from "../../store/ReportContext";
import { buildWorkspaceReportVersion } from "../../domain/report-bridge.mjs";
import {
  buildReportDocumentModel,
  buildWorkspaceDocumentConfig,
} from "../../rendering/index.mjs";
import { accession, formatReportDate, formatReportDay } from "./reportMeta";
import { computeFlag, flagLabel, type ResultFlag } from "./flags";
import { formatReferenceRange } from "./referenceRange";
import { DEFAULT_LABORATORY_PROFILE, getUsableLogoDataUrl, normalizeLaboratoryProfile, type LaboratoryProfile } from "../../store/branding";

/**
 * House-format *presenter*. It owns the wording of the printed page — brand
 * copy, labels, sign-off text — and nothing structural.
 *
 * All clinical structure comes from the one presentation-neutral document model
 * (`src/rendering`), which is built from the frozen `resolved_payload`. That is
 * what keeps a finalized report reproducible: the printed page and the PDF are
 * both projections of the same immutable model, never of today's catalog.
 */

export interface ReportContent {
  specimens: string[];
  specimenCollectionDate?: string;
  referringClinician: string;
  clinicalHistory: string;
  findings: string;
  diagnosis: string;
  interpretation: string;
  testResults: TestResult[];
}

export interface ReportModelInput {
  patientName: string;
  patientCode: string;
  patientAge?: number | string;
  patientSex?: string;
  patientPhone?: string;
  reportId?: string;
  version: number;
  isFinalized: boolean;
  finalizedAt?: string;
  issueNumber?: string;
  issueDate?: string;
  finalizedBy?: string;
  amendedAt?: string;
  amendedBy?: string;
  amendmentType?: string;
  amendmentReason?: string;
  supersedesVersion?: number;
  panelName?: string;
  department?: string;
  reportDate?: string;
  specimenCollectionDate?: string;
  laboratoryProfile?: LaboratoryProfile;
  content: ReportContent;
}

export interface ReportResultRow {
  key: string;
  name: string;
  value: string;
  numeric: boolean;
  unit: string;
  reference: string;
  /** Derived once, in this model, from the value and the reference range. */
  flag: ResultFlag;
  flagLabel: string;
}

export interface ReportResultGroup {
  key: string;
  testName: string;
  rows: ReportResultRow[];
}

export interface ReportNarrative {
  heading: string;
  body: string;
  emphasis: boolean;
}

export interface ReportSignoff {
  role: string;
  note: string;
}

export interface ReportModel {
  brand: {
    name: string;
    tagline: string;
    strapline: string;
    logoDataUrl: string;
    /** "Prop. …" line, empty when the profile has no proprietor. */
    proprietor: string;
    address: string;
    contact: string;
    /** Opening hours line, empty when the profile has none. */
    hours: string;
  };
  documentTitle: string;
  reportNo: string;
  version: number;
  statusLabel: string;
  isFinalized: boolean;
  draftNotice: string | null;
  amendmentNotice: string | null;
  band: { label: string; value: string }[];
  resultsHeading: string;
  resultGroups: ReportResultGroup[];
  showGroupHeadings: boolean;
  narratives: ReportNarrative[];
  signoff: ReportSignoff[];
  authorisationNote: string;
  endOfReport: string;
  footer: { reference: string; disclaimer: string };
  generatedAt: string;
  specimenCollectionDate: string;
  qrPayload: string;
  fileBaseName: string;
  /** Catalog version the clinical snapshot was resolved under. */
  sourceCatalogVersion: string;
}

const BRAND = {
  name: "PathForge",
  tagline: "Clinical & Anatomic Pathology",
  strapline: "Diagnostic laboratory report",
};

const DRAFT_NOTICE =
  "Preliminary draft — not for clinical use. Findings are subject to review and may change before the report is finalized.";
const AUTH_NOTE_FINAL =
  "Recorded laboratory personnel are listed below for this finalized report.";
const AUTH_NOTE_DRAFT =
  "This preliminary report is not final and must not be used for clinical decisions.";
const DISCLAIMER =
  "Computer-generated report for the named patient and referring clinician only.";
const NOT_PROVIDED = "Not provided";
const DASH = "—";

const NARRATIVE_ROLES = [
  "clinical-history",
  "microscopic-findings",
  "diagnosis",
  "interpretation",
] as const;

interface DocumentSectionLike {
  section_id: string;
  semantic_role: string;
  heading?: string;
  fields: { field_id: string; content: unknown }[];
}

function isNumeric(value: string): boolean {
  return value.trim() !== "" && !Number.isNaN(Number(value));
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Domain reference shape (low/high or reference_text) to a printable label. */
function referenceLabel(content: Record<string, unknown>): string {
  const range = content.reference_range as
    | { low?: number; high?: number }
    | undefined;
  return formatReferenceRange({
    min: range?.low,
    max: range?.high,
    text: text(content.reference_text) || undefined,
  });
}

/** First field value of the section carrying the given semantic role. */
function valueForRole(
  sections: DocumentSectionLike[],
  role: string
): string {
  const section = sections.find(
    (candidate) => candidate.semantic_role === role
  );
  const field = section?.fields[0];
  return field ? text((field.content as Record<string, unknown>).value) : "";
}

export function buildReportModel(input: ReportModelInput): ReportModel {
  // Snapshots frozen into old reports predate later profile fields, so a stored
  // brandingSnapshot can be missing string keys. Normalize to backfill defaults
  // before any `.trim()` — otherwise those reports crash the editor.
  const profile = input.laboratoryProfile
    ? normalizeLaboratoryProfile(input.laboratoryProfile)
    : DEFAULT_LABORATORY_PROFILE;
  const specimenCollectionDate =
    input.specimenCollectionDate?.trim() || input.reportDate || input.issueDate || "";
  const patientSlug =
    input.patientName.trim().replace(/\s+/g, "_").replace(/[^\w-]/g, "") ||
    "Report";

  // A draft has no issue identity yet, so it is labelled with a provisional
  // accession derived from the report id. Once finalized the report prints the
  // real issue number: per docs/ARCHITECTURE.md ("Amendment behaviour") that
  // number is the visible surface change between a report and its amendment.
  const reportNo =
    input.isFinalized && input.issueNumber
      ? input.issueNumber
      : accession(input.reportId, input.version);

  // The domain owns what a valid finalized version looks like; the bridge
  // rebuilds it from the fields the workspace carries. Provenance recorded at
  // finalization must survive that trip or the version is rejected.
  const reportVersion = buildWorkspaceReportVersion({
    reportId: input.reportId ?? "",
    version: input.version,
    isFinalized: input.isFinalized,
    issueNumber: input.issueNumber ?? reportNo,
    issueDate: input.issueDate,
    finalizedAt: input.finalizedAt,
    finalizedBy: input.finalizedBy,
    amendedAt: input.amendedAt,
    amendedBy: input.amendedBy,
    amendmentType: input.amendmentType,
    amendmentReason: input.amendmentReason,
    supersedesVersion: input.supersedesVersion,
    content: input.content,
  });

  const document = buildReportDocumentModel(
    reportVersion,
    buildWorkspaceDocumentConfig(reportVersion)
  );
  const sections = document.sections as DocumentSectionLike[];

  const resultGroups: ReportResultGroup[] = sections
    .filter((section) => section.semantic_role === "clinical-results")
    .map((section) => ({
      key: section.section_id,
      testName: section.heading ?? "",
      rows: section.fields.map((field) => {
        const content = field.content as Record<string, unknown>;
        const value = text(content.value);
        const range = content.reference_range as
          | { low?: number; high?: number }
          | undefined;
        const flag = computeFlag(value, range?.low, range?.high);
        return {
          key: field.field_id,
          name: text(content.display),
          value: value || NOT_PROVIDED,
          numeric: isNumeric(value),
          unit: text(content.unit) || DASH,
          reference: referenceLabel(content),
          flag,
          flagLabel: flagLabel(flag),
        };
      }),
    }));

  const narratives: ReportNarrative[] = NARRATIVE_ROLES.map((role) => ({
    heading:
      sections.find((section) => section.semantic_role === role)?.heading ??
      role,
    body: valueForRole(sections, role) || NOT_PROVIDED,
    emphasis: role === "diagnosis",
  }));

  return {
    brand: {
      name: profile.laboratoryName || BRAND.name,
      tagline: profile.reportSubtitle || BRAND.tagline,
      // Every optional identity field the profile carries prints as soon as it
      // is filled in; a blank one simply drops out of its line.
      strapline:
        [
          profile.accreditationName,
          profile.accreditationNumber,
          profile.registrationNumber ? `Reg. No. ${profile.registrationNumber}` : "",
        ]
          .filter(Boolean)
          .join(" · ") || BRAND.strapline,
      logoDataUrl: getUsableLogoDataUrl(profile.logoDataUrl),
      proprietor: profile.proprietorName.trim() ? `Prop. ${profile.proprietorName.trim()}` : "",
      address: [profile.addressLine1, profile.addressLine2, profile.city, profile.state, profile.postcode, profile.country].filter(Boolean).join(", "),
      contact: [profile.phone, profile.alternatePhone, profile.email, profile.website].filter(Boolean).join(" · "),
      hours: profile.workingHours.trim(),
    },
    documentTitle: profile.reportSubtitle || "Pathology Report",
    reportNo,
    version: document.report_version.version,
    statusLabel: input.isFinalized ? "Final" : "Draft",
    isFinalized: input.isFinalized,
    draftNotice: input.isFinalized ? null : DRAFT_NOTICE,
    amendmentNotice:
      input.isFinalized && input.supersedesVersion
        ? `Amended Report - supersedes report version ${input.supersedesVersion}`
        : null,
    band: [
      { label: "Patient Name", value: input.patientName },
      { label: "Patient ID", value: input.patientCode },
      {
        // Paired in one cell so the band stays four even rows on paper.
        label: "Age / Sex",
        value: [
          input.patientAge !== undefined && `${input.patientAge}`.trim() !== ""
            ? `${input.patientAge}`
            : DASH,
          input.patientSex?.trim() || DASH,
        ].join(" / "),
      },
      { label: "Phone", value: input.patientPhone?.trim() || DASH },
      {
        label: "Referring Clinician",
        value: valueForRole(sections, "referring-clinician") || DASH,
      },
      { label: "Test(s)", value: input.panelName || DASH },
      {
        label: "Report date",
        value: formatReportDate(input.issueDate ?? input.reportDate),
      },
      {
        label: "Collection Date",
        value: formatReportDay(specimenCollectionDate),
      },
    ],
    resultsHeading: "Laboratory Results",
    resultGroups,
    showGroupHeadings: resultGroups.length > 1,
    narratives,
    signoff: [
      {
        role: "Lab technologist",
        note: [profile.technologistName, profile.technologistDesignation].filter(Boolean).join(", ") || "Lab technologist",
      },
      {
        role: "Consultant pathologist",
        note: [profile.pathologistName, profile.pathologistQualifications, profile.pathologistDesignation].filter(Boolean).join(", ") || "Consultant pathologist",
      },
    ],
    authorisationNote: input.isFinalized ? AUTH_NOTE_FINAL : AUTH_NOTE_DRAFT,
    endOfReport: "— End of Report —",
    footer: { reference: profile.shortName || BRAND.name, disclaimer: profile.footerNote || profile.phone || DISCLAIMER },
    generatedAt: formatReportDate(input.issueDate ?? input.reportDate),
    specimenCollectionDate: formatReportDay(specimenCollectionDate),
    qrPayload: JSON.stringify({
      type: "pathforge-report",
      reportNo,
      patientId: input.patientCode,
      version: document.report_version.version,
      issueDate: input.issueDate ?? input.reportDate?.slice(0, 10) ?? "",
      specimenCollectionDate: specimenCollectionDate.slice(0, 10),
    }),
    fileBaseName: `PathForge_${patientSlug}_${reportNo.replace(/[^\w-]/g, "_")}`,
    sourceCatalogVersion: document.provenance.source_catalog_version,
  };
}
