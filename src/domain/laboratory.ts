// ========================================
// PATHFORGE LABORATORY DOMAIN TYPES
// ========================================

// ----------------------------------------
// USER ROLES
// ----------------------------------------

export type UserRole = "admin" | "employee";

// ----------------------------------------
// RESULT TYPES
// ----------------------------------------

export type ResultType =
  | "number"
  | "text"
  | "positive_negative"
  | "custom";

// The result kinds the current UI can actually create and edit.
export type ParameterType = "number" | "text";

// ----------------------------------------
// REFERENCE RANGE
// ----------------------------------------

export interface ReferenceRange {
  min?: number;
  max?: number;
  text?: string;
}

// ----------------------------------------
// TEST PARAMETER
// ----------------------------------------

export interface TestParameter {
  id: string;
  name: string;

  // Kind of result field. Historically also written as `resultType`;
  // `type` is the single supported spelling.
  type: ParameterType;

  unit?: string;

  referenceRange?: ReferenceRange;

  symbol?: "<" | ">" | "<=" | ">=" | "=";

  // Whether a value must be entered before a report can be finalized.
  required?: boolean;
}

// ----------------------------------------
// LABORATORY TEST
// ----------------------------------------

export interface LaboratoryTest {
  id: string;

  name: string;

  department: string;

  specimen?: string;

  parameters: TestParameter[];

  createdAt: string;

  updatedAt?: string;
}

// Backwards-compatible alias for earlier code that used `LabTest`.
export type LabTest = LaboratoryTest;

// ----------------------------------------
// PATIENT PARAMETER RESULT
// ----------------------------------------

export interface ParameterResult {
  parameterId: string;

  value: string;

  enteredAt: string;

  enteredBy?: string;
}

// ----------------------------------------
// PATIENT TEST RESULT
// ----------------------------------------

export interface PatientTestResult {
  id: string;

  patientId: string;

  testId: string;

  results: ParameterResult[];

  status: "draft" | "completed" | "verified";

  createdAt: string;

  updatedAt?: string;
}

// ----------------------------------------
// USER
// ----------------------------------------

export interface User {
  id: string;

  name: string;

  role: UserRole;
}