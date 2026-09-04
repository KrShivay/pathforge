/** @param {unknown} value @returns {value is Record<string, unknown>} */
export function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Clone JSON-shaped domain data without retaining caller-owned references.
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function cloneDomainValue(value) {
  if (Array.isArray(value)) {
    return /** @type {T} */ (value.map((item) => cloneDomainValue(item)));
  }
  if (isPlainObject(value)) {
    /** @type {Record<string, unknown>} */
    const clone = {};
    for (const [key, child] of Object.entries(value)) clone[key] = cloneDomainValue(child);
    return /** @type {T} */ (clone);
  }
  return value;
}

/**
 * @template T
 * @param {T} value
 * @returns {Readonly<T>}
 */
export function deepFreeze(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(/** @type {Record<string, unknown>} */ (value))) deepFreeze(child);
    Object.freeze(value);
  }
  return /** @type {Readonly<T>} */ (value);
}

/** @param {unknown} left @param {unknown} right @returns {boolean} */
export function domainValuesEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => domainValuesEqual(value, right[index]));
  }
  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every((key, index) => key === rightKeys[index] && domainValuesEqual(left[key], right[key]))
    );
  }
  return false;
}
