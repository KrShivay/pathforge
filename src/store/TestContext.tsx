import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { loadWorkspaceTests, saveWorkspaceTests } from "../database/db";
import type { LaboratoryTest, TestParameter } from "../domain/types";
import { notifyError } from "../lib/dialog";

// ========================================
// CONTEXT TYPES
// ========================================

interface TestContextType {
  tests: LaboratoryTest[];
  hydrated: boolean;

  addTest: (test: LaboratoryTest) => void;

  updateTest: (id: string, updates: Partial<LaboratoryTest>) => void;

  deleteTest: (id: string) => void;

  addParameter: (testId: string, parameter: TestParameter) => void;

  updateParameter: (
    testId: string,
    parameterId: string,
    updates: Partial<TestParameter>,
  ) => void;

  deleteParameter: (testId: string, parameterId: string) => void;

  getTest: (id: string) => LaboratoryTest | undefined;

  getTestsByDepartment: (department: string) => LaboratoryTest[];

  getDepartments: () => string[];
}

// ========================================
// CREATE CONTEXT
// ========================================

const TestContext = createContext<TestContextType | undefined>(undefined);

// ========================================
// DEFAULT TEST DATA
// ========================================

function createSeedTest(
  id: string,
  name: string,
  department: string,
  specimen: string,
  parameters: TestParameter[],
): LaboratoryTest {
  return {
    id,
    name,
    department,
    specimen,
    parameters,
    createdAt: new Date().toISOString(),
  };
}

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

  {
    id: "renal-function",
    name: "Renal Function Test (RFT)",
    department: "Biochemistry",
    specimen: "Serum",

    parameters: [
      {
        id: "urea",
        name: "Urea",
        type: "number",
        unit: "mg/dL",
        referenceRange: {
          min: 15,
          max: 45,
        },
      },
      {
        id: "creatinine",
        name: "Creatinine",
        type: "number",
        unit: "mg/dL",
        referenceRange: {
          min: 0.6,
          max: 1.2,
        },
      },
      {
        id: "uric-acid",
        name: "Uric Acid",
        type: "number",
        unit: "mg/dL",
        referenceRange: {
          min: 3.5,
          max: 7.2,
        },
      },
    ],

    createdAt: new Date().toISOString(),
  },

  {
    id: "lipid-profile",
    name: "Lipid Profile",
    department: "Biochemistry",
    specimen: "Serum",

    parameters: [
      {
        id: "total-cholesterol",
        name: "Total Cholesterol",
        type: "number",
        unit: "mg/dL",
        referenceRange: {
          max: 200,
        },
      },
      {
        id: "triglycerides",
        name: "Triglycerides",
        type: "number",
        unit: "mg/dL",
        referenceRange: {
          max: 150,
        },
      },
      {
        id: "hdl-cholesterol",
        name: "HDL Cholesterol",
        type: "number",
        unit: "mg/dL",
        referenceRange: {
          min: 40,
        },
      },
      {
        id: "ldl-cholesterol",
        name: "LDL Cholesterol",
        type: "number",
        unit: "mg/dL",
        referenceRange: {
          max: 100,
        },
      },
    ],

    createdAt: new Date().toISOString(),
  },

  {
    id: "hba1c",
    name: "Glycated Hemoglobin (HbA1c)",
    department: "Biochemistry",
    specimen: "Whole Blood EDTA",

    parameters: [
      {
        id: "hba1c-percent",
        name: "HbA1c",
        type: "number",
        unit: "%",
        referenceRange: {
          min: 4,
          max: 5.6,
        },
      },
      {
        id: "estimated-average-glucose",
        name: "Estimated Average Glucose",
        type: "number",
        unit: "mg/dL",
        referenceRange: {
          min: 68,
          max: 114,
        },
      },
    ],

    createdAt: new Date().toISOString(),
  },

  {
    id: "electrolytes",
    name: "Serum Electrolytes",
    department: "Biochemistry",
    specimen: "Serum",

    parameters: [
      {
        id: "sodium",
        name: "Sodium",
        type: "number",
        unit: "mmol/L",
        referenceRange: {
          min: 135,
          max: 145,
        },
      },
      {
        id: "potassium",
        name: "Potassium",
        type: "number",
        unit: "mmol/L",
        referenceRange: {
          min: 3.5,
          max: 5.1,
        },
      },
      {
        id: "chloride",
        name: "Chloride",
        type: "number",
        unit: "mmol/L",
        referenceRange: {
          min: 98,
          max: 107,
        },
      },
    ],

    createdAt: new Date().toISOString(),
  },

  {
    id: "crp",
    name: "C-Reactive Protein (CRP)",
    department: "Immunology",
    specimen: "Serum",

    parameters: [
      {
        id: "crp-value",
        name: "CRP",
        type: "number",
        unit: "mg/L",
        referenceRange: {
          max: 5,
        },
      },
    ],

    createdAt: new Date().toISOString(),
  },

  createSeedTest(
    "esr",
    "Erythrocyte Sedimentation Rate (ESR)",
    "Hematology",
    "Whole Blood EDTA",
    [
      {
        id: "esr-value",
        name: "ESR",
        type: "number",
        unit: "mm/hr",
        referenceRange: { max: 20 },
      },
    ],
  ),

  createSeedTest(
    "reticulocyte-count",
    "Reticulocyte Count",
    "Hematology",
    "Whole Blood EDTA",
    [
      {
        id: "reticulocyte-percent",
        name: "Reticulocyte Count",
        type: "number",
        unit: "%",
        referenceRange: { min: 0.5, max: 2.5 },
      },
    ],
  ),

  createSeedTest(
    "peripheral-smear",
    "Peripheral Blood Smear",
    "Hematology",
    "Whole Blood EDTA",
    [
      {
        id: "smear-findings",
        name: "Morphology Findings",
        type: "text",
        unit: "",
      },
    ],
  ),

  createSeedTest(
    "blood-group-rh",
    "Blood Group and Rh Typing",
    "Hematology",
    "Whole Blood EDTA",
    [
      {
        id: "abo-group",
        name: "ABO Group",
        type: "text",
        unit: "",
      },
      {
        id: "rh-factor",
        name: "Rh Factor",
        type: "text",
        unit: "",
      },
    ],
  ),

  createSeedTest(
    "pt-inr",
    "Prothrombin Time (PT/INR)",
    "Coagulation",
    "Plasma",
    [
      {
        id: "prothrombin-time",
        name: "Prothrombin Time",
        type: "number",
        unit: "seconds",
        referenceRange: { min: 11, max: 14 },
      },
      {
        id: "inr",
        name: "INR",
        type: "number",
        unit: "ratio",
        referenceRange: { min: 0.8, max: 1.2 },
      },
    ],
  ),

  createSeedTest(
    "aptt",
    "Activated Partial Thromboplastin Time (aPTT)",
    "Coagulation",
    "Plasma",
    [
      {
        id: "aptt-value",
        name: "aPTT",
        type: "number",
        unit: "seconds",
        referenceRange: { min: 25, max: 35 },
      },
    ],
  ),

  createSeedTest("d-dimer", "D-Dimer", "Coagulation", "Plasma", [
    {
      id: "d-dimer-value",
      name: "D-Dimer",
      type: "number",
      unit: "mg/L FEU",
      referenceRange: { max: 0.5 },
    },
  ]),

  createSeedTest("iron-studies", "Iron Studies", "Biochemistry", "Serum", [
    {
      id: "ferritin",
      name: "Ferritin",
      type: "number",
      unit: "ng/mL",
      referenceRange: { min: 15, max: 150 },
    },
    {
      id: "serum-iron",
      name: "Serum Iron",
      type: "number",
      unit: "µg/dL",
      referenceRange: { min: 50, max: 170 },
    },
    {
      id: "tibc",
      name: "Total Iron-Binding Capacity",
      type: "number",
      unit: "µg/dL",
      referenceRange: { min: 240, max: 450 },
    },
  ]),

  createSeedTest(
    "bone-mineral-profile",
    "Calcium, Magnesium and Phosphate",
    "Biochemistry",
    "Serum",
    [
      {
        id: "calcium",
        name: "Calcium",
        type: "number",
        unit: "mg/dL",
        referenceRange: { min: 8.5, max: 10.5 },
      },
      {
        id: "magnesium",
        name: "Magnesium",
        type: "number",
        unit: "mg/dL",
        referenceRange: { min: 1.7, max: 2.2 },
      },
      {
        id: "phosphate",
        name: "Phosphate",
        type: "number",
        unit: "mg/dL",
        referenceRange: { min: 2.5, max: 4.5 },
      },
    ],
  ),

  createSeedTest(
    "amylase-lipase",
    "Amylase and Lipase",
    "Biochemistry",
    "Serum",
    [
      {
        id: "amylase",
        name: "Amylase",
        type: "number",
        unit: "U/L",
        referenceRange: { min: 30, max: 110 },
      },
      {
        id: "lipase",
        name: "Lipase",
        type: "number",
        unit: "U/L",
        referenceRange: { min: 13, max: 60 },
      },
    ],
  ),

  createSeedTest("troponin", "Cardiac Troponin", "Biochemistry", "Serum", [
    {
      id: "troponin-value",
      name: "Troponin I/T",
      type: "number",
      unit: "ng/L",
      referenceRange: { max: 14 },
    },
  ]),

  createSeedTest(
    "urine-microscopy",
    "Urine Microscopy",
    "Clinical Pathology",
    "Urine",
    [
      {
        id: "urine-rbc",
        name: "RBCs",
        type: "text",
        unit: "/HPF",
      },
      {
        id: "urine-wbc",
        name: "WBCs",
        type: "text",
        unit: "/HPF",
      },
      {
        id: "urine-crystals",
        name: "Crystals and Casts",
        type: "text",
        unit: "",
      },
    ],
  ),

  createSeedTest(
    "urine-pregnancy",
    "Urine Pregnancy Test (hCG)",
    "Clinical Pathology",
    "Urine",
    [
      {
        id: "urine-hcg",
        name: "hCG",
        type: "text",
        unit: "",
        referenceRange: { text: "Negative" },
      },
    ],
  ),

  createSeedTest("urine-culture", "Urine Culture", "Microbiology", "Urine", [
    {
      id: "urine-culture-result",
      name: "Culture Result",
      type: "text",
      unit: "",
    },
    {
      id: "urine-sensitivity",
      name: "Antibiotic Sensitivity",
      type: "text",
      unit: "",
    },
  ]),

  createSeedTest(
    "blood-culture",
    "Blood Culture",
    "Microbiology",
    "Blood Culture Bottle",
    [
      {
        id: "blood-culture-result",
        name: "Culture Result",
        type: "text",
        unit: "",
      },
      {
        id: "blood-sensitivity",
        name: "Antibiotic Sensitivity",
        type: "text",
        unit: "",
      },
    ],
  ),

  createSeedTest(
    "wound-swab-culture",
    "Wound Swab Culture",
    "Microbiology",
    "Swab",
    [
      {
        id: "wound-organism",
        name: "Organism Isolated",
        type: "text",
        unit: "",
      },
      {
        id: "wound-sensitivity",
        name: "Antibiotic Sensitivity",
        type: "text",
        unit: "",
      },
    ],
  ),

  createSeedTest("hiv-screen", "HIV 1 and 2 Screening", "Immunology", "Serum", [
    {
      id: "hiv-result",
      name: "HIV Screening Result",
      type: "text",
      unit: "",
      referenceRange: { text: "Non-reactive" },
    },
  ]),

  createSeedTest(
    "hepatitis-b-screen",
    "Hepatitis B Surface Antigen (HBsAg)",
    "Immunology",
    "Serum",
    [
      {
        id: "hbsag-result",
        name: "HBsAg",
        type: "text",
        unit: "",
        referenceRange: { text: "Non-reactive" },
      },
    ],
  ),

  createSeedTest(
    "hepatitis-c-screen",
    "Hepatitis C Antibody (Anti-HCV)",
    "Immunology",
    "Serum",
    [
      {
        id: "anti-hcv-result",
        name: "Anti-HCV",
        type: "text",
        unit: "",
        referenceRange: { text: "Non-reactive" },
      },
    ],
  ),

  createSeedTest("dengue-screen", "Dengue Screening", "Immunology", "Serum", [
    {
      id: "dengue-ns1",
      name: "Dengue NS1 Antigen",
      type: "text",
      unit: "",
      referenceRange: { text: "Negative" },
    },
    {
      id: "dengue-igm",
      name: "Dengue IgM",
      type: "text",
      unit: "",
      referenceRange: { text: "Negative" },
    },
  ]),

  createSeedTest(
    "malaria-screen",
    "Malaria Antigen and Smear",
    "Microbiology",
    "Whole Blood EDTA",
    [
      {
        id: "malaria-antigen",
        name: "Malaria Antigen",
        type: "text",
        unit: "",
        referenceRange: { text: "Negative" },
      },
      {
        id: "malaria-parasite",
        name: "Parasite Findings",
        type: "text",
        unit: "",
      },
    ],
  ),

  createSeedTest("insulin", "Fasting Insulin", "Endocrinology", "Serum", [
    {
      id: "fasting-insulin",
      name: "Fasting Insulin",
      type: "number",
      unit: "µIU/mL",
      referenceRange: { min: 2, max: 25 },
    },
  ]),

  createSeedTest("cortisol", "Serum Cortisol", "Endocrinology", "Serum", [
    {
      id: "cortisol-value",
      name: "Cortisol",
      type: "number",
      unit: "µg/dL",
      referenceRange: { min: 5, max: 25 },
    },
  ]),

  createSeedTest("prolactin", "Prolactin", "Endocrinology", "Serum", [
    {
      id: "prolactin-value",
      name: "Prolactin",
      type: "number",
      unit: "ng/mL",
      referenceRange: { min: 4, max: 23 },
    },
  ]),

  createSeedTest("gonadotropins", "FSH and LH", "Endocrinology", "Serum", [
    {
      id: "fsh",
      name: "FSH",
      type: "number",
      unit: "mIU/mL",
    },
    {
      id: "lh",
      name: "LH",
      type: "number",
      unit: "mIU/mL",
    },
  ]),

  createSeedTest("testosterone", "Testosterone", "Endocrinology", "Serum", [
    {
      id: "testosterone-value",
      name: "Testosterone",
      type: "number",
      unit: "ng/dL",
    },
  ]),

  createSeedTest("vitamin-d", "Vitamin D (25-OH)", "Biochemistry", "Serum", [
    {
      id: "vitamin-d-value",
      name: "25-OH Vitamin D",
      type: "number",
      unit: "ng/mL",
      referenceRange: { min: 30, max: 100 },
    },
  ]),

  createSeedTest(
    "biopsy-examination",
    "Biopsy Examination",
    "Histopathology",
    "Tissue",
    [
      {
        id: "biopsy-findings",
        name: "Microscopic Findings",
        type: "text",
        unit: "",
      },
      {
        id: "biopsy-diagnosis",
        name: "Diagnosis",
        type: "text",
        unit: "",
      },
    ],
  ),

  createSeedTest("pap-smear", "Pap Smear", "Cytology", "Cervical Swab", [
    {
      id: "pap-adequacy",
      name: "Specimen Adequacy",
      type: "text",
      unit: "",
    },
    {
      id: "pap-interpretation",
      name: "Cytology Interpretation",
      type: "text",
      unit: "",
    },
  ]),

  createSeedTest(
    "fnac",
    "Fine-Needle Aspiration Cytology (FNAC)",
    "Cytology",
    "Aspirate",
    [
      {
        id: "fnac-findings",
        name: "Cytology Findings",
        type: "text",
        unit: "",
      },
      {
        id: "fnac-diagnosis",
        name: "Diagnosis",
        type: "text",
        unit: "",
      },
    ],
  ),
];

const ORIGINAL_TEST_IDS = ["cbc", "lft", "tft", "urine-analysis"];

// ========================================
// PROVIDER
// ========================================

export function TestProvider({ children }: { children: ReactNode }) {
  const [tests, setTests] = useState<LaboratoryTest[]>(initialTests);
  const [hydrated, setHydrated] = useState(false);

  // Mirrors `tests` so mutators derive the next catalog from the latest value
  // rather than the value captured when the handler was created. Without this,
  // two edits in the same render batch would drop the first one.
  const testsRef = useRef<LaboratoryTest[]>(initialTests);

  // Keep rapid catalog edits ordered so the rollback for a failed save cannot
  // overwrite a newer UI edit. The database module also serializes all SQLite
  // operations because the Tauri SQL plugin uses a connection pool.
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
          const savedIds = new Set(saved.tests.map((test) => test.id));
          const isOriginalSeedCatalog = ORIGINAL_TEST_IDS.every((id) =>
            savedIds.has(id),
          );
          const hydratedTests = isOriginalSeedCatalog
            ? [
                ...saved.tests,
                ...initialTests.filter((test) => !savedIds.has(test.id)),
              ]
            : saved.tests;

          testsRef.current = hydratedTests;
          setTests(hydratedTests);
          if (hydratedTests.length !== saved.tests.length) {
            await saveWorkspaceTests(hydratedTests);
          }
        } else {
          await saveWorkspaceTests(initialTests);
        }
      } catch (error) {
        console.error("Failed to load saved laboratory tests:", error);
      } finally {
        if (active) setHydrated(true);
      }
    }

    void hydrate();
    return () => {
      active = false;
    };
  }, []);

  /** Apply an update to the freshest catalog, then persist it. */
  function replaceTests(
    update: (previous: LaboratoryTest[]) => LaboratoryTest[],
  ) {
    commitTests(update(testsRef.current));
  }

  function addTest(test: LaboratoryTest) {
    replaceTests((previous) => [...previous, test]);
  }

  function updateTest(id: string, updates: Partial<LaboratoryTest>) {
    replaceTests((previous) =>
      previous.map((test) =>
        test.id === id
          ? {
              ...test,
              ...updates,
              updatedAt: new Date().toISOString(),
            }
          : test,
      ),
    );
  }

  function deleteTest(id: string) {
    replaceTests((previous) => previous.filter((test) => test.id !== id));
  }

  function addParameter(testId: string, parameter: TestParameter) {
    replaceTests((previous) =>
      previous.map((test) =>
        test.id === testId
          ? {
              ...test,
              parameters: [...test.parameters, parameter],
              updatedAt: new Date().toISOString(),
            }
          : test,
      ),
    );
  }

  function updateParameter(
    testId: string,
    parameterId: string,
    updates: Partial<TestParameter>,
  ) {
    replaceTests((previous) =>
      previous.map((test) =>
        test.id === testId
          ? {
              ...test,
              parameters: test.parameters.map((parameter) =>
                parameter.id === parameterId
                  ? {
                      ...parameter,
                      ...updates,
                    }
                  : parameter,
              ),
              updatedAt: new Date().toISOString(),
            }
          : test,
      ),
    );
  }

  function deleteParameter(testId: string, parameterId: string) {
    replaceTests((previous) =>
      previous.map((test) =>
        test.id === testId
          ? {
              ...test,
              parameters: test.parameters.filter(
                (parameter) => parameter.id !== parameterId,
              ),
              updatedAt: new Date().toISOString(),
            }
          : test,
      ),
    );
  }

  function getTest(id: string) {
    return tests.find((test) => test.id === id);
  }

  function getTestsByDepartment(department: string) {
    return tests.filter((test) => test.department === department);
  }

  function getDepartments() {
    return [...new Set(tests.map((test) => test.department))];
  }

  return (
    <TestContext.Provider
      value={{
        tests,
        hydrated,
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
    throw new Error("useTests must be used inside TestProvider");
  }

  return context;
}
