import { ServiceConfigurationError } from './errors.mjs';

/**
 * @typedef {{
 *   getRevision(reportId: string): Promise<number | null>,
 *   findVersion(identity: import('../domain/contracts.mjs').ReportVersionIdentity): Promise<Readonly<import('../domain/contracts.mjs').ReportVersion> | null>,
 *   listVersions(reportId: string): Promise<ReadonlyArray<Readonly<import('../domain/contracts.mjs').ReportVersion>>>,
 *   putVersion(reportVersion: import('../domain/contracts.mjs').ReportVersion): Promise<void>,
 *   setRevision(reportId: string, revision: number): Promise<void>
 * }} ReportRepository
 */

/**
 * @typedef {{
 *   append(event: ServiceAuditEvent): Promise<void>,
 *   listForReport(reportId: string): Promise<ReadonlyArray<Readonly<ServiceAuditEvent>>>
 * }} AuditRepository
 */

/**
 * @typedef {{
 *   reports: ReportRepository,
 *   audit: AuditRepository
 * }} TransactionPorts
 */

/**
 * @typedef {{
 *   execute: <T>(reportId: string, work: (ports: TransactionPorts) => Promise<T>) => Promise<T>
 * }} UnitOfWork
 */

/** @typedef {{now(): string}} Clock */

/** @typedef {{nextId(namespace: 'report' | 'audit-event'): string | Promise<string>}} IdGenerator */

/**
 * @typedef {{
 *   code: 'catalog_version_missing' | 'field_missing' | 'field_deprecated' | 'option_missing' | 'option_deprecated',
 *   path: string,
 *   message: string,
 *   catalogVersion: string,
 *   fieldId: string,
 *   optionId?: string
 * }} ReferenceIssue
 */

/**
 * @typedef {{
 *   inspect(reportVersion: import('../domain/contracts.mjs').ReportVersion, baseline?: import('../domain/contracts.mjs').ReportVersion): Promise<ReadonlyArray<ReferenceIssue>>
 * }} ReferenceRepository
 */

/**
 * @typedef {{
 *   event_id: string,
 *   event_type: 'report_draft_created' | 'report_version_finalized' | 'amendment_draft_created' | 'report_version_superseded',
 *   report_version: import('../domain/contracts.mjs').ReportVersionIdentity,
 *   actor: string,
 *   occurred_at: string,
 *   details: Record<string, import('../domain/contracts.mjs').JsonValue>
 * }} ServiceAuditEvent
 */

/**
 * @typedef {{
 *   reportRepository: ReportRepository,
 *   auditRepository: AuditRepository,
 *   unitOfWork: UnitOfWork,
 *   referenceRepository: ReferenceRepository,
 *   clock: Clock,
 *   idGenerator: IdGenerator
 * }} ServicePorts
 */

/** @param {unknown} target @param {string} name @param {string[]} methods */
function requireMethods(target, name, methods) {
  if (target === null || typeof target !== 'object') {
    throw new ServiceConfigurationError(`${name} port is required`);
  }
  for (const method of methods) {
    if (typeof (/** @type {Record<string, unknown>} */ (target)[method]) !== 'function') {
      throw new ServiceConfigurationError(`${name}.${method} must be a function`);
    }
  }
}

/** @param {ServicePorts} ports */
export function assertServicePorts(ports) {
  requireMethods(ports.reportRepository, 'reportRepository', ['getRevision', 'findVersion', 'listVersions']);
  requireMethods(ports.auditRepository, 'auditRepository', ['listForReport']);
  requireMethods(ports.unitOfWork, 'unitOfWork', ['execute']);
  requireMethods(ports.referenceRepository, 'referenceRepository', ['inspect']);
  requireMethods(ports.clock, 'clock', ['now']);
  requireMethods(ports.idGenerator, 'idGenerator', ['nextId']);
}
