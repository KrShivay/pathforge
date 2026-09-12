export interface DemoPatient {
  id: string;
  patientId: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  address: string;
}

export interface DemoTestResult {
  parameterId: string;
  parameterName: string;
  testId: string;
  testName: string;
  unit: string;
  value: string;
  referenceRange?: { min?: number; max?: number; text?: string };
}

export interface DemoReport {
  id: string;
  patientId: string;
  specimens: string[];
  referringClinician: string;
  clinicalHistory: string;
  findings: string;
  diagnosis: string;
  interpretation: string;
  testId: string;
  testName: string;
  department: string;
  testResults: DemoTestResult[];
  finalize: boolean;
  amend: boolean;
}

export const DEMO_PATIENTS: DemoPatient[] = [
  {
    id: "demo-patient-001",
    patientId: "PF-20260912-101",
    name: "Om Prakash",
    age: 42,
    gender: "Male",
    phone: "9876543210",
    address: "14 MG Road Bengaluru",
  },
  {
    id: "demo-patient-002",
    patientId: "PF-20260912-102",
    name: "Ananya Sharma",
    age: 35,
    gender: "Female",
    phone: "9812345678",
    address: "88 Nehru Place Delhi",
  },
  {
    id: "demo-patient-003",
    patientId: "PF-20260912-103",
    name: "Rohan Verma",
    age: 67,
    gender: "Male",
    phone: "9898765432",
    address: "203 Marine Drive Mumbai",
  },
  {
    id: "demo-patient-004",
    patientId: "PF-20260912-104",
    name: "Kavya Iyer",
    age: 29,
    gender: "Female",
    phone: "9123456789",
    address: "6 Anna Salai Chennai",
  },
  {
    id: "demo-patient-005",
    patientId: "PF-20260912-105",
    name: "Arjun Nair",
    age: 51,
    gender: "Male",
    phone: "9765432109",
    address: "41 MG Road Kochi",
  },
];

const cbcResults: DemoTestResult[] = [
  {
    parameterId: "rbc",
    parameterName: "RBC Count",
    testId: "cbc",
    testName: "Complete Blood Count (CBC)",
    unit: "million/mm3",
    value: "4.6",
    referenceRange: { min: 3.8, max: 4.8 },
  },
  {
    parameterId: "hemoglobin",
    parameterName: "Hemoglobin",
    testId: "cbc",
    testName: "Complete Blood Count (CBC)",
    unit: "g/dL",
    value: "13.8",
    referenceRange: { min: 12, max: 15 },
  },
  {
    parameterId: "hematocrit",
    parameterName: "Hematocrit (HCT / PCV)",
    testId: "cbc",
    testName: "Complete Blood Count (CBC)",
    unit: "%",
    value: "41",
    referenceRange: { min: 36, max: 46 },
  },
  {
    parameterId: "mcv",
    parameterName: "MCV",
    testId: "cbc",
    testName: "Complete Blood Count (CBC)",
    unit: "fL",
    value: "89",
    referenceRange: { min: 83, max: 101 },
  },
  {
    parameterId: "wbc",
    parameterName: "Total WBC Count",
    testId: "cbc",
    testName: "Complete Blood Count (CBC)",
    unit: "cells/mm3",
    value: "7200",
    referenceRange: { min: 4000, max: 10000 },
  },
  {
    parameterId: "platelet",
    parameterName: "Platelet Count",
    testId: "cbc",
    testName: "Complete Blood Count (CBC)",
    unit: "10^3/uL",
    value: "268",
    referenceRange: { min: 150, max: 450 },
  },
];

const lftResults: DemoTestResult[] = [
  {
    parameterId: "bilirubin-total",
    parameterName: "Total Bilirubin",
    testId: "lft",
    testName: "Liver Function Test (LFT)",
    unit: "mg/dL",
    value: "0.8",
    referenceRange: { min: 0.3, max: 1.2 },
  },
  {
    parameterId: "alt",
    parameterName: "ALT (SGPT)",
    testId: "lft",
    testName: "Liver Function Test (LFT)",
    unit: "U/L",
    value: "32",
    referenceRange: { min: 7, max: 56 },
  },
  {
    parameterId: "ast",
    parameterName: "AST (SGOT)",
    testId: "lft",
    testName: "Liver Function Test (LFT)",
    unit: "U/L",
    value: "29",
    referenceRange: { min: 10, max: 40 },
  },
];

export const DEMO_REPORTS: DemoReport[] = [
  {
    id: "demo-report-001",
    patientId: "demo-patient-001",
    specimens: ["Whole blood EDTA", "Peripheral blood smear"],
    referringClinician: "Dr Mira Sen",
    clinicalHistory: "Routine annual health screening.",
    findings:
      "Red cells are normocytic and normochromic. White cell and platelet counts are within reference limits.",
    diagnosis: "CBC within reference limits.",
    interpretation: "Correlate with the clinical presentation.",
    testId: "cbc",
    testName: "Complete Blood Count (CBC)",
    department: "Hematology",
    testResults: cbcResults,
    finalize: true,
    amend: false,
  },
  {
    id: "demo-report-002",
    patientId: "demo-patient-002",
    specimens: ["Serum"],
    referringClinician: "Dr Neel Roy",
    clinicalHistory: "Follow-up testing for fatigue.",
    findings: "Liver enzymes are within the supplied reference intervals.",
    diagnosis: "No significant biochemical abnormality identified.",
    interpretation: "Results apply to the submitted specimen.",
    testId: "lft",
    testName: "Liver Function Test (LFT)",
    department: "Biochemistry",
    testResults: lftResults,
    finalize: true,
    amend: true,
  },
  {
    id: "demo-report-003",
    patientId: "demo-patient-003",
    specimens: ["Whole blood EDTA"],
    referringClinician: "",
    clinicalHistory: "Monitoring after medication change.",
    findings: "CBC values entered for clinician review.",
    diagnosis: "Pending review.",
    interpretation: "",
    testId: "cbc",
    testName: "Complete Blood Count (CBC)",
    department: "Hematology",
    testResults: cbcResults.map((result) => ({
      ...result,
      value: result.parameterId === "hemoglobin" ? "11.4" : result.value,
    })),
    finalize: false,
    amend: false,
  },
  {
    id: "demo-report-004",
    patientId: "demo-patient-004",
    specimens: ["Urine"],
    referringClinician: "",
    clinicalHistory: "Dysuria for three days.",
    findings: "Microscopy pending.",
    diagnosis: "",
    interpretation: "",
    testId: "urine-analysis",
    testName: "Urine Complete Analysis",
    department: "Clinical Pathology",
    testResults: [],
    finalize: false,
    amend: false,
  },
];
