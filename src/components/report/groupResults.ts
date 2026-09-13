import type { TestResult } from "../../store/ReportContext";

export interface ResultGroup {
  /** Stable key for React lists. */
  key: string;
  /** Display heading; empty when the results predate multi-test reports. */
  testName: string;
  results: TestResult[];
}

/**
 * Group a flat list of results by their originating laboratory test, preserving
 * first-seen order. Reports authored before multi-test support have no testId /
 * testName and collapse into a single unnamed group.
 */
export function groupResultsByTest(results: TestResult[]): ResultGroup[] {
  const groups: ResultGroup[] = [];
  const index = new Map<string, ResultGroup>();

  for (const result of results) {
    const key = result.testId || result.testName || "";
    let group = index.get(key);
    if (!group) {
      group = { key: key || "ungrouped", testName: result.testName ?? "", results: [] };
      index.set(key, group);
      groups.push(group);
    }
    group.results.push(result);
  }

  return groups;
}
