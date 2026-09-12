import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  LaboratoryTest,
  TestParameter,
} from "../domain/types";
import { loadWorkspaceTests, saveWorkspaceTests } from "../database/db";
import { notifyError } from "../lib/dialog";

// ========================================
// CONTEXT TYPES
// ========================================

interface TestContextType {
  tests: LaboratoryTest[];

  addTest: (test: LaboratoryTest) => void;

  updateTest: (
    id: string,
    updates: Partial<LaboratoryTest>
  ) => void;

  deleteTest: (id: string) => void;

  addParameter: (
    testId: string,
    parameter: TestParameter
  ) => void;

  updateParameter: (
    testId: string,
    parameterId: string,
    updates: Partial<TestParameter>
  ) => void;

  deleteParameter: (
    testId: string,
    parameterId: string
  ) => void;

  getTest: (
    id: string
  ) => LaboratoryTest | undefined;

  getTestsByDepartment: (
    department: string
  ) => LaboratoryTest[];

  getDepartments: () => string[];
}

// ========================================
// CREATE CONTEXT
// ========================================

const TestContext = createContext<
  TestContextType | undefined
>(undefined);

// ========================================
// DEFAULT TEST DATA
// ========================================

const initialTests: LaboratoryTest[] = [
  {
    id: "cbc",
    name: "Complete Blood Count (CBC)",
    department: "Hematology",
    specimen: "Whole Blood EDTA",

    parameters: [
      {
        id: "rbc",
        name: "RBC Count",
        type: "number",
        unit: "million/mm³",
        referenceRange: {
          min: 3.8,
          max: 4.8,
        },
      },
      {
        id: "hemoglobin",
        name: "Hemoglobin",
        type: "number",
        unit: "g/dL",
        referenceRange: {
          min: 12,
          max: 15,
        },
      },
      {
        id: "hematocrit",
        name: "Hematocrit (HCT / PCV)",
        type: "number",
        unit: "%",
        referenceRange: {
          min: 36,
          max: 46,
        },
      },
      {
        id: "mcv",
        name: "MCV",
        type: "number",
        unit: "fL",
        referenceRange: {
          min: 83,
          max: 101,
        },
      },
      {
        id: "wbc",
        name: "Total WBC Count",
        type: "number",
        unit: "cells/mm³",
        referenceRange: {
          min: 4000,
          max: 10000,
        },
      },
      {
        id: "platelet",
        name: "Platelet Count",
        type: "number",
        unit: "10³/µL",
        referenceRange: {
          min: 150,
          max: 450,
        },
      },
    ],

    createdAt: new Date().toISOString(),
  },

  {
    id: "lft",
    name: "Liver Function Test (LFT)",
    department: "Biochemistry",
    specimen: "Serum",

    parameters: [
      {
        id: "bilirubin-total",
        name: "Total Bilirubin",
        type: "number",
        unit: "mg/dL",
        referenceRange: {
          min: 0.3,
          max: 1.2,
        },
      },
      {
        id: "alt",
        name: "ALT (SGPT)",
        type: "number",
        unit: "U/L",
        referenceRange: {
          min: 7,
          max: 56,
        },
      },
      {
        id: "ast",
        name: "AST (SGOT)",
        type: "number",
        unit: "U/L",
        referenceRange: {
          min: 10,
          max: 40,
        },
      },
      {
        id: "alp",
        name: "Alkaline Phosphatase (ALP)",
        type: "number",
        unit: "U/L",
        referenceRange: {
          min: 44,
          max: 147,
        },
      },
    ],

    createdAt: new Date().toISOString(),
  },

  {
    id: "tft",
    name: "Thyroid Function Test (TFT)",
    department: "Immunology",
    specimen: "Serum",

    parameters: [
      {
        id: "t3",
        name: "T3",
        type: "number",
        unit: "ng/mL",
        referenceRange: {
          min: 0.8,
          max: 2,
        },
      },
      {
        id: "t4",
        name: "T4",
        type: "number",
        unit: "µg/dL",
        referenceRange: {
          min: 5,
          max: 12,
        },
      },
      {
        id: "tsh",
        name: "TSH",
        type: "number",
        unit: "mIU/L",
        referenceRange: {
          min: 0.4,
          max: 4,
        },
      },
    ],

    createdAt: new Date().toISOString(),
  },

  {
    id: "urine-analysis",
    name: "Urine Complete Analysis",
    department: "Clinical Pathology",
    specimen: "Urine",

    parameters: [
      {
        id: "color",
        name: "Color",
        type: "text",
        unit: "",
      },
      {
        id: "appearance",
        name: "Appearance",
        type: "text",
        unit: "",
      },
      {
        id: "protein",
        name: "Protein",
        type: "text",
        unit: "",
        referenceRange: {
          text: "Negative",
        },
      },
      {
        id: "glucose",
        name: "Glucose",
        type: "text",
        unit: "",
        referenceRange: {
          text: "Negative",
        },
      },
      {
        id: "ph",
        name: "pH",
        type: "number",
        unit: "",
        referenceRange: {
          min: 4.5,
          max: 8,
        },
      },
    ],

    createdAt: new Date().toISOString(),
  },
];

// ========================================
// PROVIDER
// ========================================

export function TestProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [tests, setTests] =
    useState<LaboratoryTest[]>(initialTests);

  // Mirrors `tests` so mutators derive the next catalog from the latest value
  // rather than the value captured when the handler was created. Without this,
  // two edits in the same render batch would drop the first one.
  const testsRef = useRef<LaboratoryTest[]>(initialTests);

  // `saveWorkspaceTests` runs its own BEGIN/COMMIT transaction on the one
  // shared SQLite connection. Firing two saves without waiting for the first
  // fails the second's BEGIN ("transaction within a transaction") and rolls
  // that commit back — silently discarding an edit that had already applied
  // in the UI. Chaining every save onto this ref serializes them so only one
  // is ever in flight.
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  function commitTests(next: LaboratoryTest[]) {
    const previous = testsRef.current;
    testsRef.current = next;
    setTests(next);

    saveQueueRef.current = saveQueueRef.current
      .catch(() => {
        // A prior failure was already reported; do not let it break the chain.
      })
      .then(() => saveWorkspaceTests(next))
      .catch((error) => {
        // Only roll back if nothing newer has been committed since — otherwise
        // this would stomp a later, already-queued edit.
        if (testsRef.current === next) {
          testsRef.current = previous;
          setTests(previous);
        }

        console.error("Failed to save laboratory tests:", error);
        void notifyError({
          title: "Could not save the test catalog",
          text:
            error instanceof Error
              ? error.message
              : "Your change was reverted. Please try again.",
        });
      });
  }

  useEffect(() => {
    let active = true;

    async function hydrate() {
      try {
        const saved = await loadWorkspaceTests();
        if (!active) return;

        if (saved.initialized) {
          testsRef.current = saved.tests;
          setTests(saved.tests);
        } else {
          await saveWorkspaceTests(initialTests);
        }
      } catch (error) {
        console.error("Failed to load saved laboratory tests:", error);
      }
    }

    void hydrate();
    return () => {
      active = false;
    };
  }, []);

  /** Apply an update to the freshest catalog, then persist it. */
  function replaceTests(
    update: (previous: LaboratoryTest[]) => LaboratoryTest[]
  ) {
    commitTests(update(testsRef.current));
  }

  function addTest(test: LaboratoryTest) {
    replaceTests((previous) => [...previous, test]);
  }

  function updateTest(
    id: string,
    updates: Partial<LaboratoryTest>
  ) {
    replaceTests((previous) =>
      previous.map((test) =>
        test.id === id
          ? {
              ...test,
              ...updates,
              updatedAt: new Date().toISOString(),
            }
          : test
      )
    );
  }

  function deleteTest(id: string) {
    replaceTests((previous) =>
      previous.filter((test) => test.id !== id)
    );
  }

  function addParameter(
    testId: string,
    parameter: TestParameter
  ) {
    replaceTests((previous) =>
      previous.map((test) =>
        test.id === testId
          ? {
              ...test,
              parameters: [
                ...test.parameters,
                parameter,
              ],
              updatedAt: new Date().toISOString(),
            }
          : test
      )
    );
  }

  function updateParameter(
    testId: string,
    parameterId: string,
    updates: Partial<TestParameter>
  ) {
    replaceTests((previous) =>
      previous.map((test) =>
        test.id === testId
          ? {
              ...test,
              parameters: test.parameters.map(
                (parameter) =>
                  parameter.id === parameterId
                    ? {
                        ...parameter,
                        ...updates,
                      }
                    : parameter
              ),
              updatedAt: new Date().toISOString(),
            }
          : test
      )
    );
  }

  function deleteParameter(
    testId: string,
    parameterId: string
  ) {
    replaceTests((previous) =>
      previous.map((test) =>
        test.id === testId
          ? {
              ...test,
              parameters: test.parameters.filter(
                (parameter) =>
                  parameter.id !== parameterId
              ),
              updatedAt: new Date().toISOString(),
            }
          : test
      )
    );
  }

  function getTest(id: string) {
    return tests.find((test) => test.id === id);
  }

  function getTestsByDepartment(
    department: string
  ) {
    return tests.filter(
      (test) => test.department === department
    );
  }

  function getDepartments() {
    return [
      ...new Set(
        tests.map((test) => test.department)
      ),
    ];
  }

  return (
    <TestContext.Provider
      value={{
        tests,
        addTest,
        updateTest,
        deleteTest,
        addParameter,
        updateParameter,
        deleteParameter,
        getTest,
        getTestsByDepartment,
        getDepartments,
      }}
    >
      {children}
    </TestContext.Provider>
  );
}

// ========================================
// HOOK
// ========================================

export function useTests() {
  const context = useContext(TestContext);

  if (!context) {
    throw new Error(
      "useTests must be used inside TestProvider"
    );
  }

  return context;
}
