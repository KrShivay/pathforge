import { reportVersionKey } from '../domain/index.mjs';
import { immutableCopy } from './internal.mjs';

/** @typedef {{revision: number, versions: Map<string, import('../domain/contracts.mjs').ReportVersion>}} StoredReport */

/** @param {StoredReport | undefined} stored */
function copyStoredReport(stored) {
  /** @type {StoredReport} */
  const copy = { revision: stored?.revision ?? 0, versions: new Map() };
  for (const [key, version] of stored?.versions ?? []) {
    copy.versions.set(key, /** @type {import('../domain/contracts.mjs').ReportVersion} */ (immutableCopy(version)));
  }
  return copy;
}

/**
 * @param {StoredReport} stored
 * @param {string} reportId
 * @returns {import('./ports.mjs').ReportRepository}
 */
function createTransactionalReportRepository(stored, reportId) {
  return {
    async getRevision(candidateReportId) {
      return candidateReportId === reportId && stored.versions.size > 0 ? stored.revision : null;
    },
    async findVersion(identity) {
      if (identity.report_id !== reportId) return null;
      const value = stored.versions.get(reportVersionKey(identity));
      return value ? immutableCopy(value) : null;
    },
    async listVersions(candidateReportId) {
      if (candidateReportId !== reportId) return [];
      return [...stored.versions.values()]
        .sort((left, right) => left.version - right.version)
        .map((version) => immutableCopy(version));
    },
    async putVersion(reportVersion) {
      if (reportVersion.report_id !== reportId) throw new Error('transaction cannot write another logical report');
      stored.versions.set(
        reportVersionKey(reportVersion),
        /** @type {import('../domain/contracts.mjs').ReportVersion} */ (immutableCopy(reportVersion)),
      );
    },
    async setRevision(candidateReportId, revision) {
      if (candidateReportId !== reportId) throw new Error('transaction cannot revise another logical report');
      stored.revision = revision;
    },
  };
}

/**
 * Exact catalog-version lookup only. It never falls forward to a current catalog
 * or rewrites the caller's resolved snapshot (INV-8).
 * @param {ReadonlyArray<import('../domain/contracts.mjs').Catalog>} catalogs
 * @returns {import('./ports.mjs').ReferenceRepository}
 */
function createReferenceRepository(catalogs) {
  const byVersion = new Map(catalogs.map((catalog) => [catalog.catalog_version, immutableCopy(catalog)]));
  return {
    async inspect(reportVersion, baseline) {
      /** @type {import('./ports.mjs').ReferenceIssue[]} */
      const issues = [];
      for (const [payloadKey, entry] of Object.entries(reportVersion.resolved_payload)) {
        const baselineEntry = baseline?.resolved_payload[payloadKey];
        const inheritedReference =
          baselineEntry?.field_id === entry.field_id &&
          baselineEntry.source_catalog_version === entry.source_catalog_version &&
          baselineEntry.option_id === entry.option_id;
        if (inheritedReference) continue;

        const catalog = byVersion.get(entry.source_catalog_version);
        const base = {
          path: `resolved_payload.${payloadKey}`,
          catalogVersion: entry.source_catalog_version,
          fieldId: entry.field_id,
          ...(entry.option_id === undefined ? {} : { optionId: entry.option_id }),
        };
        if (!catalog) {
          issues.push({
            ...base,
            code: 'catalog_version_missing',
            message: `catalog version ${entry.source_catalog_version} is unavailable`,
          });
          continue;
        }
        const field = catalog.fields[entry.field_id];
        if (!field) {
          issues.push({ ...base, code: 'field_missing', message: `field ${entry.field_id} is unavailable` });
          continue;
        }
        if (field.deprecated === true) {
          issues.push({ ...base, code: 'field_deprecated', message: `field ${entry.field_id} is deprecated` });
        }
        if (entry.option_id !== undefined) {
          const option = field.options?.find((candidate) => candidate.option_id === entry.option_id);
          if (!option) {
            issues.push({ ...base, code: 'option_missing', message: `option ${entry.option_id} is unavailable` });
          } else if (option.deprecated === true) {
            issues.push({ ...base, code: 'option_deprecated', message: `option ${entry.option_id} is deprecated` });
          }
        }
      }
      return immutableCopy(issues);
    },
  };
}

/**
 * Transactional memory adapter for contract tests and local development only.
 * It deliberately makes no durability or restart/recovery guarantee.
 * @param {{catalogs?: ReadonlyArray<import('../domain/contracts.mjs').Catalog>}} [options]
 */
export function createInMemoryServiceAdapter(options = {}) {
  /** @type {Map<string, StoredReport>} */
  const storedReports = new Map();
  /** @type {Map<string, import('./ports.mjs').ServiceAuditEvent[]>} */
  const storedAudit = new Map();
  /** @type {Map<string, Promise<void>>} */
  const transactionTails = new Map();

  /** @type {import('./ports.mjs').ReportRepository} */
  const reportRepository = {
    async getRevision(reportId) {
      return storedReports.get(reportId)?.revision ?? null;
    },
    async findVersion(identity) {
      const value = storedReports.get(identity.report_id)?.versions.get(reportVersionKey(identity));
      return value ? immutableCopy(value) : null;
    },
    async listVersions(reportId) {
      return [...(storedReports.get(reportId)?.versions.values() ?? [])]
        .sort((left, right) => left.version - right.version)
        .map((version) => immutableCopy(version));
    },
    async putVersion() {
      throw new Error('writes require unitOfWork.execute');
    },
    async setRevision() {
      throw new Error('writes require unitOfWork.execute');
    },
  };

  /** @type {import('./ports.mjs').AuditRepository} */
  const auditRepository = {
    async append() {
      throw new Error('writes require unitOfWork.execute');
    },
    async listForReport(reportId) {
      return (storedAudit.get(reportId) ?? []).map((event) => immutableCopy(event));
    },
  };

  /** @type {import('./ports.mjs').UnitOfWork} */
  const unitOfWork = {
    async execute(reportId, work) {
      const previous = transactionTails.get(reportId) ?? Promise.resolve();
      /** @type {() => void} */
      let release = () => {};
      /** @type {Promise<void>} */
      const current = new Promise((resolve) => {
        release = resolve;
      });
      const tail = previous.then(() => current);
      transactionTails.set(reportId, tail);
      await previous;
      try {
        const workingReport = copyStoredReport(storedReports.get(reportId));
        const workingAudit = (storedAudit.get(reportId) ?? []).map(
          (event) => /** @type {import('./ports.mjs').ServiceAuditEvent} */ (immutableCopy(event)),
        );
        const transactionalReports = createTransactionalReportRepository(workingReport, reportId);
        /** @type {import('./ports.mjs').AuditRepository} */
        const transactionalAudit = {
          async append(event) {
            if (event.report_version.report_id !== reportId) {
              throw new Error('transaction cannot append audit for another logical report');
            }
            workingAudit.push(/** @type {import('./ports.mjs').ServiceAuditEvent} */ (immutableCopy(event)));
          },
          async listForReport(candidateReportId) {
            return candidateReportId === reportId ? workingAudit.map((event) => immutableCopy(event)) : [];
          },
        };
        const result = await work({ reports: transactionalReports, audit: transactionalAudit });
        storedReports.set(reportId, workingReport);
        storedAudit.set(reportId, workingAudit);
        return result;
      } finally {
        release();
        if (transactionTails.get(reportId) === tail) transactionTails.delete(reportId);
      }
    },
  };

  return Object.freeze({
    reportRepository,
    auditRepository,
    unitOfWork,
    referenceRepository: createReferenceRepository(options.catalogs ?? []),
  });
}

/** @param {string} timestamp @returns {import('./ports.mjs').Clock} */
export function createFixedClock(timestamp) {
  return Object.freeze({ now: () => timestamp });
}

/** @param {string} [prefix] @returns {import('./ports.mjs').IdGenerator} */
export function createSequentialIdGenerator(prefix = 'memory') {
  let sequence = 0;
  return Object.freeze({
    nextId(namespace) {
      sequence += 1;
      return `${prefix}-${namespace}-${sequence}`;
    },
  });
}
