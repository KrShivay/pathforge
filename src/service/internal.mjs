import { ServiceConfigurationError } from './errors.mjs';

/**
 * Keep service results detached and immutable without depending on domain-private helpers.
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function cloneServiceValue(value) {
  if (Array.isArray(value)) {
    return /** @type {T} */ (value.map((item) => cloneServiceValue(item)));
  }
  if (value !== null && typeof value === 'object') {
    /** @type {Record<string, unknown>} */
    const clone = {};
    for (const [key, child] of Object.entries(value)) clone[key] = cloneServiceValue(child);
    return /** @type {T} */ (clone);
  }
  return value;
}

/** @template T @param {T} value @returns {Readonly<T>} */
export function freezeServiceValue(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(/** @type {Record<string, unknown>} */ (value))) freezeServiceValue(child);
    Object.freeze(value);
  }
  return /** @type {Readonly<T>} */ (value);
}

/** @template T @param {T} value @returns {Readonly<T>} */
export function immutableCopy(value) {
  return freezeServiceValue(cloneServiceValue(value));
}

/** @param {unknown} value @param {string} label @returns {string} */
export function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ServiceConfigurationError(`${label} must be a non-empty string`);
  }
  return value;
}

/** @param {unknown} value @param {string} label @returns {number} */
export function requireRevision(value, label = 'expectedRevision') {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new ServiceConfigurationError(`${label} must be a non-negative safe integer`);
  }
  return Number(value);
}
