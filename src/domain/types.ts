// ========================================
// PATHFORGE CORE DOMAIN TYPES
// ========================================

// ----------------------------------------
// REPORT TYPES
// ----------------------------------------

export type ReportStatus =
  | "draft"
  | "final"
  | "amended";

export type ReportVersionStatus =
  | "draft"
  | "final";

export interface Patient {
  id: string;
  patientId: string;
  name: string;
  age?: number;
  gender?: string;
}

export interface Specimen {
  id: string;
  type: string;
  site?: string;
  description?: string;
}

export interface ClinicalHistory {
  text: string;
}

export interface ReportContent {
  specimens: Specimen[];
  clinicalHistory?: ClinicalHistory;
  findings: string;
  diagnosis: string;
  comments?: string;
}

export interface Report {
  id: string;
  reportNumber: string;
  patient: Patient;
  status: ReportStatus;
  currentVersion: number;
  createdAt: string;
  updatedAt?: string;
  finalizedAt?: string;
}

export interface ReportVersion {
  id: string;
  reportId: string;
  version: number;
  content: ReportContent;
  status: ReportVersionStatus;
  createdAt: string;
  finalizedAt?: string;
  createdBy?: string;
}

export interface Amendment {
  id: string;
  reportId: string;
  previousVersion: number;
  newVersion: number;
  reason: string;
  createdAt: string;
  createdBy?: string;
}


// ========================================
// VALIDATION TYPES
// ========================================

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}


// ========================================
// TEST RESULT TYPES
// ========================================

import type {
  ReferenceRange,
} from "./laboratory";

export interface TestResult {
  parameterId: string;
  parameterName: string;
  value: string;
  unit?: string;
  referenceRange?: ReferenceRange;
}


// ========================================
// RE-EXPORT LABORATORY TYPES
// ========================================

export type {
  UserRole,
  ResultType,
  ParameterType,
  ReferenceRange,
  TestParameter,
  LaboratoryTest,
  LabTest,
  ParameterResult,
  PatientTestResult,
  User,
} from "./laboratory";