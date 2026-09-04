export class ServiceConfigurationError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'ServiceConfigurationError';
    this.code = 'SERVICE_CONFIGURATION_ERROR';
  }
}

export class ConcurrencyConflictError extends Error {
  /** @param {string} reportId @param {number} expectedRevision @param {number} actualRevision */
  constructor(reportId, expectedRevision, actualRevision) {
    super(
      `report ${reportId} changed concurrently: expected revision ${expectedRevision}, actual revision ${actualRevision}`,
    );
    this.name = 'ConcurrencyConflictError';
    this.code = 'OPTIMISTIC_CONCURRENCY_CONFLICT';
    this.reportId = reportId;
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

export class MissingReferenceError extends Error {
  /** @param {string} referenceType @param {string} reference */
  constructor(referenceType, reference) {
    super(`${referenceType} not found: ${reference}`);
    this.name = 'MissingReferenceError';
    this.code = 'MISSING_REFERENCE';
    this.referenceType = referenceType;
    this.reference = reference;
  }
}

export class ReferenceValidationError extends Error {
  /** @param {ReadonlyArray<import('./ports.mjs').ReferenceIssue>} issues */
  constructor(issues) {
    super(
      `resolved payload contains invalid references:\n${issues.map((issue) => `- ${issue.path}: ${issue.message}`).join('\n')}`,
    );
    this.name = 'ReferenceValidationError';
    this.code = 'INVALID_REFERENCE';
    this.issues = Object.freeze(issues.map((issue) => Object.freeze({ ...issue })));
  }
}
