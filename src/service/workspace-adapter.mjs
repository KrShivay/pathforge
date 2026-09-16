import { createInMemoryServiceAdapter } from './in-memory-adapter.mjs';

/**
 * Locally-authored reports are not resolved against a published clinical catalog,
 * so there are no catalog/field/option references to check. This repository
 * therefore reports no issues rather than flagging every workspace field as an
 * unknown catalog reference.
 * @type {import('./ports.mjs').ReferenceRepository}
 */
const workspaceReferenceRepository = Object.freeze({
  async inspect() {
    return [];
  },
});

/**
 * Storage + coordination ports for the React workspace. Phase 1 keeps the
 * transactional in-memory store from {@link createInMemoryServiceAdapter}; only
 * the reference repository differs. A durable adapter can replace the storage
 * ports here without changing the service or the React layer.
 * @returns {Omit<import('./ports.mjs').ServicePorts, 'clock' | 'idGenerator'> & {
 *   snapshot: () => unknown,
 *   restore: (state: any) => void
 * }}
 */
export function createWorkspaceServiceAdapter(options = {}) {
  const base = createInMemoryServiceAdapter(options);
  return Object.freeze({
    reportRepository: base.reportRepository,
    auditRepository: base.auditRepository,
    unitOfWork: base.unitOfWork,
    referenceRepository: workspaceReferenceRepository,
    snapshot: base.snapshot,
    restore: base.restore,
  });
}
