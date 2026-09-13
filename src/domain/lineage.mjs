import { deepFreeze } from './internal.mjs';
import { reportVersionIdentity, reportVersionKey } from './lifecycle.mjs';
import { assertValidReport, DomainValidationError } from './validation.mjs';

/**
 * Produce a bidirectional, immutable projection without mutating either report.
 * Multiple successors are representable while Q9c remains unresolved.
 * @param {import('./contracts.mjs').ReportVersion[]} versions
 */
export function buildVersionLineage(versions) {
  if (!Array.isArray(versions) || versions.length === 0) {
    throw new DomainValidationError('version lineage', ['at least one report version is required']);
  }
  /** @type {Map<string, {identity: import('./contracts.mjs').ReportVersionIdentity, supersedes: string | null, supersededBy: string[]}>} */
  const nodes = new Map();
  for (const version of versions) {
    assertValidReport(version, 'lineage report version');
    const identity = reportVersionIdentity(version);
    const key = reportVersionKey(identity);
    if (nodes.has(key)) throw new DomainValidationError('version lineage', [`duplicate version identity ${key}`]);
    nodes.set(key, {
      identity,
      supersedes: version.supersedes ? reportVersionKey(version.supersedes) : null,
      supersededBy: [],
    });
  }

  for (const [key, node] of nodes) {
    if (!node.supersedes) continue;
    const predecessor = nodes.get(node.supersedes);
    if (!predecessor)
      throw new DomainValidationError('version lineage', [`${key} references missing predecessor ${node.supersedes}`]);
    predecessor.supersededBy.push(key);
  }

  /** @type {Record<string, {identity: import('./contracts.mjs').ReportVersionIdentity, supersedes: string | null, supersededBy: string[]}>} */
  const byIdentity = {};
  for (const [key, node] of [...nodes].sort(([left], [right]) => left.localeCompare(right))) {
    node.supersededBy.sort();
    byIdentity[key] = node;
  }
  return deepFreeze({ byIdentity });
}

/**
 * Append-only supersession evidence for persistence/audit layers.
 * @param {import('./contracts.mjs').ReportVersion} oldVersion
 * @param {import('./contracts.mjs').ReportVersion} newVersion
 * @param {{actor: string, occurredAt: string, reason: string}} options
 * @returns {Readonly<import('./contracts.mjs').AuditEvent>}
 */
export function createSupersessionAuditEvent(oldVersion, newVersion, options) {
  assertValidReport(oldVersion, 'superseded report version');
  assertValidReport(newVersion, 'superseding report version');
  const oldIdentity = reportVersionIdentity(oldVersion);
  const newIdentity = reportVersionIdentity(newVersion);
  if (!newVersion.supersedes || reportVersionKey(newVersion.supersedes) !== reportVersionKey(oldIdentity)) {
    throw new DomainValidationError('supersession', ['new version must explicitly supersede old version']);
  }
  if (typeof options.actor !== 'string' || !options.actor.trim()) {
    throw new DomainValidationError('supersession', ['actor must be a non-empty string']);
  }
  if (typeof options.reason !== 'string' || !options.reason.trim()) {
    throw new DomainValidationError('supersession', ['reason must be a non-empty string']);
  }
  if (typeof options.occurredAt !== 'string' || !Number.isFinite(Date.parse(options.occurredAt))) {
    throw new DomainValidationError('supersession', ['occurredAt must be an ISO-8601 timestamp']);
  }
  return deepFreeze({
    event_id: `${reportVersionKey(oldIdentity)}:superseded_by:${reportVersionKey(newIdentity)}`,
    event_type: 'report_version_superseded',
    report_version: oldIdentity,
    actor: options.actor,
    occurred_at: options.occurredAt,
    details: {
      superseded_by_report_id: newIdentity.report_id,
      superseded_by_version: newIdentity.version,
      reason: options.reason,
    },
  });
}
