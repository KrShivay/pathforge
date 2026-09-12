import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  buildResolvedPayload,
  checkClinicalCompleteness,
  generateIssueNumber,
  issueDateFromIso,
  readWorkspaceContent,
  WORKSPACE_CATALOG_VERSION,
  type WorkspaceReportContent,
} from "../domain/report-bridge.mjs";
import {
  createReportService,
  createWorkspaceServiceAdapter,
} from "../service/index.mjs";

import {
  loadReportWorkspaceMeta,
  loadReportWorkspaceState,
  saveReportWorkspaceMeta,
  saveReportWorkspaceState,
} from "../database/db";
import type { ValidationError, ValidationResult } from "../domain/types";
import { loadLaboratorySnapshot, snapshotLaboratoryProfile, type LaboratoryProfile } from "./branding";

// ========================================
// PUBLIC SHAPES (unchanged for pages)
// ========================================

export interface ReferenceRange {
  min?: number;
  max?: number;
  text?: string;
}

export interface TestResult {
  parameterId: string;
  parameterName: string;

  // Which laboratory test this parameter belongs to. A report can include
  // several tests, so results are grouped by these.
  testId: string;
  testName: string;

  // Always stored as a string, even if the parameter has no unit
  unit: string;

  referenceRange?: ReferenceRange;

  // Value entered by employee
  value: string;
}

export interface Report {
  id: string;

  patientId: string;

  specimens: string[];
  referringClinician: string;
  clinicalHistory: string;
  findings: string;
  diagnosis: string;
  interpretation: string;

  // Summary of the laboratory tests included in this report. When several tests
  // are present these are comma-joined; per-result grouping lives on testResults.
  testId?: string;
  testName?: string;
  department?: string;

  // Results entered across every test in the report
  testResults: TestResult[];

  status: "draft" | "finalized";

  version: number;

  createdAt: string;
  updatedAt?: string;
  finalizedAt?: string;

  // Issue identity assigned at finalization. Per the amendment spec this is
  // the visible surface change between a report and its amendment.
  issueNumber?: string;
  issueDate?: string;

  // Finalization / amendment provenance recorded by the domain. A finalized
  // version is invalid without it, so it must survive the trip into React.
  finalizedBy?: string;
  amendedAt?: string;
  amendedBy?: string;
  amendmentType?: string;
  amendmentReason?: string;
  supersedesVersion?: number;

  supersedesReportId?: string;
  brandingSnapshot?: LaboratoryProfile;
}

export interface AuditEntry {
  id: string;
  type: string;
  actor: string;
  occurredAt: string;
  version: number;
}

export interface FinalizeOutcome extends ValidationResult {
  /** The finalized version, present only when `valid` is true. */
  report?: Report;
}

interface ReportContextType {
  reports: Report[];
  hydrated: boolean;

  /** Create a new report draft. Returns the stored draft. */
  addReport: (report: Report) => Promise<Report | undefined>;

  /** Save edits to a draft version. No-op for finalized versions. */
  updateReport: (id: string, updates: Partial<Report>) => Promise<void>;

  getReport: (id: string) => Report | undefined;

  /**
   * Validate and finalize a draft version. When validation fails the report is
   * left untouched and the failing checks are returned; on success the finalized
   * version (with issue number and finalized-at) is returned too.
   */
  finalizeReport: (id: string) => Promise<FinalizeOutcome>;

  /** Create a draft amendment of a finalized version. */
  createAmendment: (
    id: string,
    amendmentReason: string,
  ) => Promise<Report | undefined>;

  getReportVersions: (id: string) => Report[];

  getAuditTrail: (id: string) => AuditEntry[];
}

const ReportContext = createContext<ReportContextType | undefined>(undefined);

// ========================================
// INTERNAL MODEL
// ========================================

interface ReportMeta {
  reportId: string;
  patientId: string;
  testId?: string;
  testName?: string;
  department?: string;
  createdAt: string;
}

interface VersionSnapshot {
  version: number;
  status: "draft" | "finalized";
  createdAt: string;
  finalizedAt?: string;
  issueNumber?: string;
  issueDate?: string;
  finalizedBy?: string;
  amendedAt?: string;
  amendedBy?: string;
  amendmentType?: string;
  amendmentReason?: string;
  supersedesVersion: number | null;
  content: WorkspaceReportContent;
}

interface ReportRecord {
  reportId: string;
  revision: number;
  versions: VersionSnapshot[];
  audit: AuditEntry[];
}

const ID_SEPARATOR = "::";

function makeId(reportId: string, version: number): string {
  return `${reportId}${ID_SEPARATOR}${version}`;
}

function parseId(id: string): { reportId: string; version: number } {
  const index = id.lastIndexOf(ID_SEPARATOR);
  if (index === -1) return { reportId: id, version: 1 };
  return {
    reportId: id.slice(0, index),
    version: Number(id.slice(index + ID_SEPARATOR.length)) || 1,
  };
}

function contentFromReport(
  source: Partial<Report>,
  base?: WorkspaceReportContent,
): WorkspaceReportContent {
  return {
    specimens: source.specimens ?? base?.specimens ?? [],
    referringClinician:
      source.referringClinician ?? base?.referringClinician ?? "",
    clinicalHistory: source.clinicalHistory ?? base?.clinicalHistory ?? "",
    findings: source.findings ?? base?.findings ?? "",
    diagnosis: source.diagnosis ?? base?.diagnosis ?? "",
    interpretation: source.interpretation ?? base?.interpretation ?? "",
    testResults: (source.testResults ?? base?.testResults ?? []).map(
      (result) => ({
        parameterId: result.parameterId,
        parameterName: result.parameterName,
        testId: result.testId,
        testName: result.testName,
        unit: result.unit,
        value: result.value,
        referenceRange: result.referenceRange,
      }),
    ),
  };
}

// ========================================
// PROVIDER
// ========================================

// No accounts in this prototype (SCOPE.md: no identity providers) — every
// change is attributed to the shared local workspace for the audit trail.
const WORKSPACE_ACTOR = "workspace";

export function ReportProvider({ children }: { children: ReactNode }) {
  const actorRef = useRef(WORKSPACE_ACTOR);

  const adapter = useMemo(
    () =>
      createWorkspaceServiceAdapter({
        onCommit: saveReportWorkspaceState,
      }),
    [],
  );

  const service = useMemo(
    () =>
      createReportService({
        ...adapter,
        clock: { now: () => new Date().toISOString() },
        idGenerator: { nextId: () => crypto.randomUUID() },
      }),
    [adapter],
  );

  const metaRef = useRef<Map<string, ReportMeta>>(new Map());
  const recordsRef = useRef<Map<string, ReportRecord>>(new Map());
  const [records, setRecords] = useState<Map<string, ReportRecord>>(new Map());
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(async () => {
    const next = new Map<string, ReportRecord>();

    for (const meta of metaRef.current.values()) {
      try {
        const history = await service.retrieveHistory({
          reportId: meta.reportId,
        });

        const draftTimes = new Map<number, string>();
        for (const event of history.auditEvents) {
          if (
            event.event_type === "report_draft_created" ||
            event.event_type === "amendment_draft_created"
          ) {
            draftTimes.set(event.report_version.version, event.occurred_at);
          }
        }

        next.set(meta.reportId, {
          reportId: meta.reportId,
          revision: history.revision,
          versions: history.versions.map((version) => ({
            version: version.version,
            status:
              version.lifecycle_state === "finalized" ? "finalized" : "draft",
            createdAt: draftTimes.get(version.version) ?? meta.createdAt,
            finalizedAt: version.finalized_at ?? version.amended_at,
            issueNumber: version.issue_number,
            issueDate: version.issue_date,
            finalizedBy: version.finalized_by,
            amendedAt: version.amended_at,
            amendedBy: version.amended_by,
            amendmentType: version.amendment_type,
            amendmentReason: version.amendment_reason,
            supersedesVersion: version.supersedes
              ? version.supersedes.version
              : null,
            content: readWorkspaceContent(version),
          })),
          audit: history.auditEvents.map((event, index) => ({
            id: event.event_id || `${meta.reportId}-audit-${index}`,
            type: event.event_type,
            actor: event.actor,
            occurredAt: event.occurred_at,
            version: event.report_version.version,
          })),
        });
      } catch {
        // Report is no longer retrievable; drop it from the view.
      }
    }

    recordsRef.current = next;
    setRecords(next);
  }, [service]);

  useEffect(() => {
    let active = true;

    async function hydrate() {
      try {
        const [state, metadata] = await Promise.all([
          loadReportWorkspaceState(),
          loadReportWorkspaceMeta(),
        ]);

        adapter.restore(state ?? {});
        metaRef.current = new Map(
          metadata.map((meta) => [meta.reportId, meta]),
        );

        const demoEnabled =
          import.meta.env.DEV &&
          import.meta.env.VITE_DEMO_WORKSPACE === "true" &&
          metadata.length === 0 &&
          state == null;
        const missingDemoReports = demoEnabled
          ? (await import("./demoData")).DEMO_REPORTS
          : [];

        if (missingDemoReports.length > 0) {
          for (const demo of missingDemoReports) {
            const created = await service.createDraft({
              reportId: demo.id,
              sourceCatalogVersion: WORKSPACE_CATALOG_VERSION,
              resolvedPayload: buildResolvedPayload(demo),
              actor: actorRef.current,
            });

            metaRef.current.set(demo.id, {
              reportId: demo.id,
              patientId: demo.patientId,
              testId: demo.testId,
              testName: demo.testName,
              department: demo.department,
              createdAt: created.auditEvent.occurred_at,
            });
            await saveReportWorkspaceMeta({
              reportId: demo.id,
              patientId: demo.patientId,
              testId: demo.testId,
              testName: demo.testName,
              department: demo.department,
              createdAt: created.auditEvent.occurred_at,
            });

            if (demo.finalize) {
              await service.finalize({
                identity: { report_id: demo.id, version: 1 },
                expectedRevision: 1,
                issueNumber: `PF-DEMO-${demo.id.slice(-3)}`,
                issueDate: "2026-09-12",
                actor: actorRef.current,
              });
            }

            if (demo.amend) {
              await service.amend({
                baseline: { report_id: demo.id, version: 1 },
                expectedRevision: 2,
                actor: actorRef.current,
                amendmentReason: "Demonstration of an amendment workflow.",
                amendmentType: "correction",
              });
            }
          }
          await saveReportWorkspaceState(adapter.snapshot());
        }

        if (active) await refresh();
      } catch (error) {
        console.error("Failed to load saved reports:", error);
      } finally {
        if (active) setHydrated(true);
      }
    }

    void hydrate();
    return () => {
      active = false;
    };
  }, [adapter, refresh]);

  const addReport = useCallback(
    async (report: Report): Promise<Report | undefined> => {
      const created = await service.createDraft({
        sourceCatalogVersion: WORKSPACE_CATALOG_VERSION,
        resolvedPayload: buildResolvedPayload(contentFromReport(report)),
        actor: actorRef.current,
      });
      const reportId = created.reportVersion.report_id;

      metaRef.current.set(reportId, {
        reportId,
        patientId: report.patientId,
        testId: report.testId,
        testName: report.testName,
        department: report.department,
        createdAt: created.auditEvent.occurred_at,
      });

      await saveReportWorkspaceMeta({
        reportId,
        patientId: report.patientId,
        testId: report.testId,
        testName: report.testName,
        department: report.department,
        createdAt: created.auditEvent.occurred_at,
      });

      await refresh();
      return toReport(recordsRef.current, metaRef.current, makeId(reportId, 1));
    },
    [service, refresh],
  );

  const updateReport = useCallback(
    async (id: string, updates: Partial<Report>): Promise<void> => {
      const { reportId, version } = parseId(id);
      const record = recordsRef.current.get(reportId);
      const snapshot = record?.versions.find(
        (entry) => entry.version === version,
      );
      if (!record || !snapshot || snapshot.status !== "draft") return;

      const nextPayload = buildResolvedPayload(
        contentFromReport(updates, snapshot.content),
      );
      const currentPayload = buildResolvedPayload(snapshot.content);
      if (JSON.stringify(nextPayload) === JSON.stringify(currentPayload))
        return;

      await service.updateDraft({
        identity: { report_id: reportId, version },
        expectedRevision: record.revision,
        resolvedPayload: nextPayload,
        actor: actorRef.current,
      });
      await refresh();
    },
    [service, refresh],
  );

  const finalizeReport = useCallback(
    async (id: string): Promise<FinalizeOutcome> => {
      const { reportId, version } = parseId(id);
      const record = recordsRef.current.get(reportId);
      const snapshot = record?.versions.find(
        (entry) => entry.version === version,
      );

      if (!record || !snapshot) {
        return {
          valid: false,
          errors: [
            {
              field: "report",
              code: "REPORT_NOT_FOUND",
              message: "Report not found.",
            },
          ],
        };
      }

      const errors: ValidationError[] = checkClinicalCompleteness(
        snapshot.content,
      ).map((issue) => ({
        field: issue.field,
        code: "REQUIRED",
        message: issue.message,
      }));

      const domain = await service.validate({
        identity: { report_id: reportId, version },
      });
      for (const issue of domain.domainIssues) {
        errors.push({ field: "report", code: "DOMAIN", message: issue });
      }
      for (const issue of domain.referenceIssues) {
        errors.push({
          field: issue.path,
          code: issue.code,
          message: issue.message,
        });
      }

      if (errors.length > 0) return { valid: false, errors };

      try {
        await service.finalize({
          identity: { report_id: reportId, version },
          expectedRevision: record.revision,
          issueNumber: generateIssueNumber(),
          issueDate: issueDateFromIso(new Date().toISOString()),
          actor: actorRef.current,
        });
        snapshotLaboratoryProfile(reportId, version);
      } catch (error) {
        return {
          valid: false,
          errors: [
            {
              field: "report",
              code: "FINALIZE_FAILED",
              message: error instanceof Error ? error.message : String(error),
            },
          ],
        };
      }

      await refresh();
      return {
        valid: true,
        errors: [],
        report: toReport(
          recordsRef.current,
          metaRef.current,
          makeId(reportId, version),
        ),
      };
    },
    [service, refresh],
  );

  const createAmendment = useCallback(
    async (
      id: string,
      amendmentReason: string,
    ): Promise<Report | undefined> => {
      const { reportId, version } = parseId(id);
      const record = recordsRef.current.get(reportId);
      const snapshot = record?.versions.find(
        (entry) => entry.version === version,
      );
      if (!record || !snapshot || snapshot.status !== "finalized")
        return undefined;

      const amended = await service.amend({
        baseline: { report_id: reportId, version },
        expectedRevision: record.revision,
        actor: actorRef.current,
        amendmentReason,
        amendmentType: "correction",
      });
      await refresh();
      return toReport(
        recordsRef.current,
        metaRef.current,
        makeId(reportId, amended.reportVersion.version),
      );
    },
    [service, refresh],
  );

  const reports = useMemo(() => {
    const list: Report[] = [];
    for (const record of records.values()) {
      const meta = metaRef.current.get(record.reportId);
      for (const snapshot of record.versions) {
        list.push(buildReport(record.reportId, snapshot, meta));
      }
    }
    return list.sort(
      (left, right) =>
        new Date(left.createdAt).getTime() -
        new Date(right.createdAt).getTime(),
    );
  }, [records]);

  const getReport = useCallback(
    (id: string) => reports.find((report) => report.id === id),
    [reports],
  );

  const getReportVersions = useCallback(
    (id: string): Report[] => {
      const { reportId } = parseId(id);
      return reports
        .filter((report) => parseId(report.id).reportId === reportId)
        .sort((left, right) => left.version - right.version);
    },
    [reports],
  );

  const getAuditTrail = useCallback(
    (id: string): AuditEntry[] => {
      const { reportId } = parseId(id);
      return records.get(reportId)?.audit ?? [];
    },
    [records],
  );

  return (
    <ReportContext.Provider
      value={{
        reports,
        hydrated,
        addReport,
        updateReport,
        getReport,
        finalizeReport,
        createAmendment,
        getReportVersions,
        getAuditTrail,
      }}
    >
      {children}
    </ReportContext.Provider>
  );
}

// ========================================
// DERIVATION HELPERS
// ========================================

function buildReport(
  reportId: string,
  snapshot: VersionSnapshot,
  meta: ReportMeta | undefined,
): Report {
  return {
    id: makeId(reportId, snapshot.version),
    patientId: meta?.patientId ?? "",
    specimens: snapshot.content.specimens ?? [],
    referringClinician: snapshot.content.referringClinician ?? "",
    clinicalHistory: snapshot.content.clinicalHistory ?? "",
    findings: snapshot.content.findings ?? "",
    diagnosis: snapshot.content.diagnosis ?? "",
    interpretation: snapshot.content.interpretation ?? "",
    testId: meta?.testId,
    testName: meta?.testName,
    department: meta?.department,
    testResults: (snapshot.content.testResults ?? []).map((result) => ({
      parameterId: result.parameterId,
      parameterName: result.parameterName,
      testId: result.testId ?? "",
      testName: result.testName ?? meta?.testName ?? "",
      unit: result.unit ?? "",
      referenceRange: result.referenceRange,
      value: result.value ?? "",
    })),
    status: snapshot.status,
    version: snapshot.version,
    createdAt: snapshot.createdAt,
    finalizedAt: snapshot.finalizedAt,
    issueNumber: snapshot.issueNumber,
    issueDate: snapshot.issueDate,
    finalizedBy: snapshot.finalizedBy,
    amendedAt: snapshot.amendedAt,
    amendedBy: snapshot.amendedBy,
    amendmentType: snapshot.amendmentType,
    amendmentReason: snapshot.amendmentReason,
    supersedesVersion: snapshot.supersedesVersion ?? undefined,
    supersedesReportId:
      snapshot.supersedesVersion != null
        ? makeId(reportId, snapshot.supersedesVersion)
        : undefined,
    brandingSnapshot:
      snapshot.status === "finalized"
        ? loadLaboratorySnapshot(reportId, snapshot.version)
        : undefined,
  };
}

function toReport(
  records: Map<string, ReportRecord>,
  metas: Map<string, ReportMeta>,
  id: string,
): Report | undefined {
  const { reportId, version } = parseId(id);
  const snapshot = records
    .get(reportId)
    ?.versions.find((entry) => entry.version === version);
  if (!snapshot) return undefined;
  return buildReport(reportId, snapshot, metas.get(reportId));
}

// ========================================
// HOOK
// ========================================

export function useReports() {
  const context = useContext(ReportContext);

  if (!context) {
    throw new Error("useReports must be used inside ReportProvider");
  }

  return context;
}
