import { REPORT_STATES } from './contracts.mjs';
import { cloneDomainValue, deepFreeze } from './internal.mjs';
import { assertValidReport, DomainValidationError } from './validation.mjs';

/** @param {import('./contracts.mjs').ReportVersionIdentity} identity */
export function reportVersionKey(identity) {
  if (
    !identity ||
    typeof identity.report_id !== 'string' ||
    !Number.isInteger(identity.version) ||
    identity.version < 1
  ) {
    throw new DomainValidationError('report-version identity', [
      'report_id and a positive integer version are required',
    ]);
  }
  return `${encodeURIComponent(identity.report_id)}@${identity.version}`;
}

/** @param {import('./contracts.mjs').ReportVersion} report */
export function reportVersionIdentity(report) {
  assertValidReport(report);
  return deepFreeze({ report_id: report.report_id, version: report.version });
}

/**
 * Start from the exact historical resolved payload. No catalog input is
 * accepted, making silent re-resolution impossible in this operation (INV-10).
 * @param {import('./contracts.mjs').ReportVersion} supersededVersion
 * @param {{version?: number, actor: string, occurredAt: string, amendmentReason: string, amendmentType?: string}} options
 */
export function createAmendmentDraft(supersededVersion, options) {
  assertValidReport(supersededVersion, 'superseded report version');
  if (supersededVersion.lifecycle_state !== REPORT_STATES.FINALIZED) {
    throw new DomainValidationError('superseded report version', ['only a finalized version can be amended']);
  }
  const version = options.version ?? supersededVersion.version + 1;
  const draft = {
    report_id: supersededVersion.report_id,
    version,
    lifecycle_state: REPORT_STATES.DRAFT,
    supersedes: reportVersionIdentity(supersededVersion),
    source_catalog_version: supersededVersion.source_catalog_version,
    amendment_type: options.amendmentType ?? 'correction',
    amendment_reason: options.amendmentReason,
    resolved_payload: cloneDomainValue(supersededVersion.resolved_payload),
  };
  assertValidReport(draft, 'amendment draft');
  const identity = reportVersionIdentity(draft);
  /** @type {import('./contracts.mjs').AuditEvent} */
  const auditEvent = {
    event_id: `${reportVersionKey(identity)}:amendment_draft_created`,
    event_type: 'amendment_draft_created',
    report_version: identity,
    actor: options.actor,
    occurred_at: options.occurredAt,
    details: {
      supersedes_report_id: supersededVersion.report_id,
      supersedes_version: supersededVersion.version,
      amendment_reason: options.amendmentReason,
    },
  };
  assertAuditInputs(auditEvent.actor, auditEvent.occurred_at, 'amendment draft');
  return deepFreeze({ reportVersion: draft, auditEvent });
}

/**
 * Copy-on-write draft editing. The prior draft remains unchanged and finalized
 * versions are rejected rather than edited in place.
 * @param {import('./contracts.mjs').ReportVersion} draft
 * @param {import('./contracts.mjs').ResolvedPayload} resolvedPayload
 */
export function replaceDraftPayload(draft, resolvedPayload) {
  assertValidReport(draft, 'report draft');
  if (draft.lifecycle_state !== REPORT_STATES.DRAFT) {
    throw new DomainValidationError('report draft', ['only a draft payload can be replaced']);
  }
  const next = { ...cloneDomainValue(draft), resolved_payload: cloneDomainValue(resolvedPayload) };
  assertValidReport(next, 'report draft');
  return deepFreeze(next);
}

/** @param {string} actor @param {string} occurredAt @param {string} subject */
function assertAuditInputs(actor, occurredAt, subject) {
  const issues = [];
  if (typeof actor !== 'string' || !actor.trim()) issues.push('actor must be a non-empty string');
  if (
    typeof occurredAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(occurredAt) ||
    !Number.isFinite(Date.parse(occurredAt))
  ) {
    issues.push('occurredAt must be an ISO-8601 timestamp');
  }
  if (issues.length) throw new DomainValidationError(subject, issues);
}

/**
 * @param {import('./contracts.mjs').ReportVersion} draft
 * @param {{issueNumber: string, issueDate: string, actor: string, occurredAt: string}} options
 */
export function finalizeDraft(draft, options) {
  assertValidReport(draft, 'report draft');
  if (draft.lifecycle_state !== REPORT_STATES.DRAFT) {
    throw new DomainValidationError('report draft', ['finalization is allowed only from draft']);
  }
  assertAuditInputs(options.actor, options.occurredAt, 'finalization');

  const reportVersion = cloneDomainValue(draft);
  reportVersion.lifecycle_state = REPORT_STATES.FINALIZED;
  reportVersion.issue_number = options.issueNumber;
  reportVersion.issue_date = options.issueDate;
  if (reportVersion.supersedes) {
    reportVersion.amended_at = options.occurredAt;
    reportVersion.amended_by = options.actor;
  } else {
    reportVersion.finalized_at = options.occurredAt;
    reportVersion.finalized_by = options.actor;
  }
  assertValidReport(reportVersion, 'finalized report version');

  const identity = reportVersionIdentity(reportVersion);
  /** @type {import('./contracts.mjs').AuditEvent} */
  const auditEvent = {
    event_id: `${reportVersionKey(identity)}:report_version_finalized`,
    event_type: 'report_version_finalized',
    report_version: identity,
    actor: options.actor,
    occurred_at: options.occurredAt,
    details: {
      from_state: REPORT_STATES.DRAFT,
      to_state: REPORT_STATES.FINALIZED,
      source_catalog_version: reportVersion.source_catalog_version,
    },
  };
  return deepFreeze({ reportVersion, auditEvent });
}
