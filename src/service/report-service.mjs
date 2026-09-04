import {
  assertValidReport,
  buildVersionLineage,
  compareClinicalReports,
  createAmendmentDraft,
  createSupersessionAuditEvent,
  finalizeDraft,
  replaceDraftPayload,
  reportVersionKey,
  validateReport,
} from '../domain/index.mjs';
import { ConcurrencyConflictError, MissingReferenceError, ReferenceValidationError } from './errors.mjs';
import { immutableCopy, requireNonEmptyString, requireRevision } from './internal.mjs';
import { assertServicePorts } from './ports.mjs';

/** @param {import('./ports.mjs').Clock} clock */
function readClock(clock) {
  const timestamp = requireNonEmptyString(clock.now(), 'clock.now()');
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp) ||
    !Number.isFinite(Date.parse(timestamp))
  ) {
    throw new TypeError('clock.now() must return an ISO-8601 timestamp');
  }
  return timestamp;
}

/** @param {import('./ports.mjs').IdGenerator} idGenerator @param {'report' | 'audit-event'} namespace */
async function nextId(idGenerator, namespace) {
  return requireNonEmptyString(await idGenerator.nextId(namespace), `idGenerator.nextId('${namespace}')`);
}

/** @param {string} reportId @param {number} expectedRevision @param {number | null} actualRevision */
function assertExpectedRevision(reportId, expectedRevision, actualRevision) {
  const actual = actualRevision ?? 0;
  if (actual !== expectedRevision) throw new ConcurrencyConflictError(reportId, expectedRevision, actual);
}

/**
 * @param {import('./ports.mjs').ReportRepository} repository
 * @param {import('../domain/contracts.mjs').ReportVersionIdentity} identity
 */
async function requireVersion(repository, identity) {
  const reportVersion = await repository.findVersion(identity);
  if (!reportVersion) throw new MissingReferenceError('report version', reportVersionKey(identity));
  return reportVersion;
}

/**
 * @param {import('./ports.mjs').ReferenceRepository} references
 * @param {import('../domain/contracts.mjs').ReportVersion} reportVersion
 * @param {import('../domain/contracts.mjs').ReportVersion} [baseline]
 */
async function requireValidReferences(references, reportVersion, baseline) {
  const issues = await references.inspect(reportVersion, baseline);
  if (issues.length > 0) throw new ReferenceValidationError(issues);
}

/**
 * Replace a domain-created deterministic event id with an adapter-generated stable id.
 * @param {import('./ports.mjs').ServiceAuditEvent | import('../domain/contracts.mjs').AuditEvent} event
 * @param {import('./ports.mjs').IdGenerator} idGenerator
 * @returns {Promise<Readonly<import('./ports.mjs').ServiceAuditEvent>>}
 */
async function identifyEvent(event, idGenerator) {
  return immutableCopy({ ...event, event_id: await nextId(idGenerator, 'audit-event') });
}

/**
 * Policy-neutral application boundary. Authorization, retention, durable storage,
 * and external-system coordination intentionally remain adapter responsibilities.
 * @param {import('./ports.mjs').ServicePorts} ports
 */
export function createReportService(ports) {
  assertServicePorts(ports);
  const { reportRepository, auditRepository, unitOfWork, referenceRepository, clock, idGenerator } = ports;

  return Object.freeze({
    /**
     * @param {{sourceCatalogVersion: string, resolvedPayload: import('../domain/contracts.mjs').ResolvedPayload, actor: string, reportId?: string}} command
     */
    async createDraft(command) {
      const actor = requireNonEmptyString(command.actor, 'actor');
      const reportId = command.reportId
        ? requireNonEmptyString(command.reportId, 'reportId')
        : await nextId(idGenerator, 'report');
      const occurredAt = readClock(clock);
      /** @type {import('../domain/contracts.mjs').ReportVersion} */
      const draft = {
        report_id: reportId,
        version: 1,
        lifecycle_state: 'draft',
        supersedes: null,
        source_catalog_version: requireNonEmptyString(command.sourceCatalogVersion, 'sourceCatalogVersion'),
        resolved_payload: command.resolvedPayload,
      };
      assertValidReport(draft, 'report draft');
      await requireValidReferences(referenceRepository, draft);

      return unitOfWork.execute(reportId, async ({ reports, audit }) => {
        const actualRevision = await reports.getRevision(reportId);
        assertExpectedRevision(reportId, 0, actualRevision);
        const auditEvent = immutableCopy({
          event_id: await nextId(idGenerator, 'audit-event'),
          event_type: /** @type {const} */ ('report_draft_created'),
          report_version: { report_id: reportId, version: 1 },
          actor,
          occurred_at: occurredAt,
          details: { source_catalog_version: draft.source_catalog_version },
        });
        const storedDraft = /** @type {import('../domain/contracts.mjs').ReportVersion} */ (immutableCopy(draft));
        await reports.putVersion(storedDraft);
        await audit.append(auditEvent);
        await reports.setRevision(reportId, 1);
        return immutableCopy({ reportVersion: storedDraft, revision: 1, auditEvent });
      });
    },

    /** @param {{identity: import('../domain/contracts.mjs').ReportVersionIdentity}} query */
    async validate(query) {
      const reportVersion = await requireVersion(reportRepository, query.identity);
      const domainIssues = validateReport(reportVersion);
      let baseline;
      if (reportVersion.supersedes) baseline = await requireVersion(reportRepository, reportVersion.supersedes);
      const referenceIssues = await referenceRepository.inspect(reportVersion, baseline);
      return immutableCopy({
        valid: domainIssues.length === 0 && referenceIssues.length === 0,
        domainIssues,
        referenceIssues,
      });
    },

    /**
     * @param {{identity: import('../domain/contracts.mjs').ReportVersionIdentity, expectedRevision: number, issueNumber: string, issueDate: string, actor: string}} command
     */
    async finalize(command) {
      const reportId = requireNonEmptyString(command.identity.report_id, 'identity.report_id');
      const expectedRevision = requireRevision(command.expectedRevision);
      const actor = requireNonEmptyString(command.actor, 'actor');
      const occurredAt = readClock(clock);

      return unitOfWork.execute(reportId, async ({ reports, audit }) => {
        const actualRevision = await reports.getRevision(reportId);
        assertExpectedRevision(reportId, expectedRevision, actualRevision);
        const draft = await requireVersion(reports, command.identity);
        let baseline;
        if (draft.supersedes) baseline = await requireVersion(reports, draft.supersedes);
        await requireValidReferences(referenceRepository, draft, baseline);
        const finalized = finalizeDraft(draft, {
          issueNumber: requireNonEmptyString(command.issueNumber, 'issueNumber'),
          issueDate: requireNonEmptyString(command.issueDate, 'issueDate'),
          actor,
          occurredAt,
        });
        const finalizationEvent = await identifyEvent(finalized.auditEvent, idGenerator);
        /** @type {Readonly<import('./ports.mjs').ServiceAuditEvent> | undefined} */
        let supersessionEvent;
        if (baseline) {
          supersessionEvent = await identifyEvent(
            createSupersessionAuditEvent(baseline, finalized.reportVersion, {
              actor,
              occurredAt,
              reason: String(finalized.reportVersion.amendment_reason),
            }),
            idGenerator,
          );
        }
        await reports.putVersion(finalized.reportVersion);
        await audit.append(finalizationEvent);
        if (supersessionEvent) await audit.append(supersessionEvent);
        const revision = expectedRevision + 1;
        await reports.setRevision(reportId, revision);
        return immutableCopy({
          reportVersion: finalized.reportVersion,
          revision,
          auditEvents: supersessionEvent ? [finalizationEvent, supersessionEvent] : [finalizationEvent],
        });
      });
    },

    /** @param {{reportId: string}} query */
    async retrieveHistory(query) {
      const reportId = requireNonEmptyString(query.reportId, 'reportId');
      const [revision, versions, auditEvents] = await Promise.all([
        reportRepository.getRevision(reportId),
        reportRepository.listVersions(reportId),
        auditRepository.listForReport(reportId),
      ]);
      if (revision === null || versions.length === 0) throw new MissingReferenceError('report', reportId);
      return immutableCopy({
        reportId,
        revision,
        versions,
        lineage: buildVersionLineage(/** @type {import('../domain/contracts.mjs').ReportVersion[]} */ (versions)),
        auditEvents,
      });
    },

    /**
     * @param {{left: import('../domain/contracts.mjs').ReportVersionIdentity, right: import('../domain/contracts.mjs').ReportVersionIdentity}} query
     */
    async compare(query) {
      const [left, right] = await Promise.all([
        requireVersion(reportRepository, query.left),
        requireVersion(reportRepository, query.right),
      ]);
      return immutableCopy(compareClinicalReports(left, right));
    },

    /**
     * @param {{baseline: import('../domain/contracts.mjs').ReportVersionIdentity, expectedRevision: number, actor: string, amendmentReason: string, amendmentType?: string, resolvedPayload?: import('../domain/contracts.mjs').ResolvedPayload}} command
     */
    async amend(command) {
      const reportId = requireNonEmptyString(command.baseline.report_id, 'baseline.report_id');
      const expectedRevision = requireRevision(command.expectedRevision);
      const actor = requireNonEmptyString(command.actor, 'actor');
      const occurredAt = readClock(clock);
      const amendmentReason = requireNonEmptyString(command.amendmentReason, 'amendmentReason');

      return unitOfWork.execute(reportId, async ({ reports, audit }) => {
        const actualRevision = await reports.getRevision(reportId);
        assertExpectedRevision(reportId, expectedRevision, actualRevision);
        const baseline = await requireVersion(reports, command.baseline);
        const versions = await reports.listVersions(reportId);
        const version = versions.reduce((highest, candidate) => Math.max(highest, candidate.version), 0) + 1;
        const created = createAmendmentDraft(baseline, {
          version,
          actor,
          occurredAt,
          amendmentReason,
          ...(command.amendmentType === undefined ? {} : { amendmentType: command.amendmentType }),
        });
        const draft = command.resolvedPayload
          ? replaceDraftPayload(created.reportVersion, command.resolvedPayload)
          : created.reportVersion;
        await requireValidReferences(referenceRepository, draft, baseline);
        const auditEvent = await identifyEvent(created.auditEvent, idGenerator);
        await reports.putVersion(draft);
        await audit.append(auditEvent);
        const revision = expectedRevision + 1;
        await reports.setRevision(reportId, revision);
        return immutableCopy({ reportVersion: draft, revision, auditEvent });
      });
    },
  });
}
