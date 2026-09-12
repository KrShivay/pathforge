import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getDatabase,
  normalizePatientLookupKey,
  patientHasDuplicateRecord,
} from "../database/db";
import { nextPatientId } from "../domain/patientId.mjs";
import { DEMO_PATIENTS } from "./demoData";

export interface Patient {
  id: string;
  /** Human-facing identifier, `PF-YYYYMMDD-NNN`, generated once at registration. */
  patientId: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  address?: string;
}

/** Fields the user supplies when registering a patient. */
export type NewPatientInput = Omit<Patient, "id" | "patientId">;

interface PatientContextType {
  patients: Patient[];
  loading: boolean;
  /** Register a patient. The Patient ID is generated here, never by the caller. */
  addPatient: (input: NewPatientInput) => Promise<Patient>;
  getPatient: (id: string) => Patient | undefined;
  /** Preview the next Patient ID (for display before the form is submitted). */
  previewPatientId: () => string;
}

/** True when `error` is a SQLite UNIQUE constraint violation on insert. */
function isUniqueConstraintError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  return /UNIQUE constraint failed/i.test(message);
}

const PatientContext = createContext<PatientContextType | undefined>(undefined);

export function PatientProvider({ children }: { children: ReactNode }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadPatients();
  }, []);

  async function loadPatients() {
    try {
      const db = await getDatabase();

      const rows = await db.select<
        {
          id: string;
          patient_id: string;
          name: string;
          age: number;
          gender: string;
          phone: string | null;
          address: string | null;
        }[]
      >(
        `
        SELECT id, patient_id, name, age, gender, phone, address
        FROM patients
        ORDER BY created_at DESC
        `,
      );

      const dedupedRows = [] as typeof rows;
      const seenPatientKeys = new Set<string>();
      for (const row of rows) {
        const key = normalizePatientLookupKey(row.name, row.phone ?? "");
        if (seenPatientKeys.has(key)) continue;
        seenPatientKeys.add(key);
        dedupedRows.push(row);
      }

      const existingPatientIds = new Set(dedupedRows.map((row) => row.id));
      const existingPatientCodes = new Set(
        dedupedRows.map((row) => row.patient_id),
      );
      const missingDemoPatients = DEMO_PATIENTS.filter(
        (patient) =>
          !existingPatientIds.has(patient.id) &&
          !existingPatientCodes.has(patient.patientId),
      );

      if (missingDemoPatients.length > 0) {
        for (const patient of missingDemoPatients) {
          await db.execute(
            `
            INSERT INTO patients (
              id, patient_id, name, age, gender, phone, address, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
            [
              patient.id,
              patient.patientId,
              patient.name,
              patient.age,
              patient.gender,
              patient.phone,
              patient.address,
              new Date("2026-09-12T09:00:00.000Z").toISOString(),
            ],
          );
        }
        setPatients([
          ...missingDemoPatients,
          ...dedupedRows.map((row) => ({
            id: row.id,
            patientId: row.patient_id,
            name: row.name,
            age: row.age,
            gender: row.gender,
            phone: row.phone ?? "",
            address: row.address ?? undefined,
          })),
        ]);
        return;
      }

      setPatients(
        dedupedRows.map((row) => ({
          id: row.id,
          patientId: row.patient_id,
          name: row.name,
          age: row.age,
          gender: row.gender,
          phone: row.phone ?? "",
          address: row.address ?? undefined,
        })),
      );
    } catch (error) {
      console.error("Failed to load patients:", error);
    } finally {
      setLoading(false);
    }
  }

  const previewPatientId = useCallback(
    () => nextPatientId(patients.map((patient) => patient.patientId)),
    [patients],
  );

  const addPatient = useCallback(
    async (input: NewPatientInput): Promise<Patient> => {
      const db = await getDatabase();

      // The in-memory `patients` list can be stale relative to the database
      // (e.g. a second window, or a record inserted since this list last
      // loaded), so the computed patientId can collide with the UNIQUE
      // constraint on patients.patient_id. Re-read the day's IDs from the
      // database and retry once with the next free sequence rather than
      // failing the whole registration.
      const name = input.name.trim();
      const phone = input.phone.trim();

      if (
        patientHasDuplicateRecord(
          await db.select<{ name: string; phone: string }[]>(
            "SELECT name, phone FROM patients",
          ),
          name,
          phone,
        )
      ) {
        throw new Error(
          "A patient with this name and phone number already exists.",
        );
      }

      async function insertWithNextId(): Promise<Patient> {
        const rows = await db.select<{ patient_id: string }[]>(
          "SELECT patient_id FROM patients",
        );

        const patient: Patient = {
          id: crypto.randomUUID(),
          patientId: nextPatientId(rows.map((row) => row.patient_id)),
          name,
          age: input.age,
          gender: input.gender,
          phone,
          address: input.address,
        };

        await db.execute(
          `
          INSERT INTO patients (
            id, patient_id, name, age, gender, phone, address, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            patient.id,
            patient.patientId,
            patient.name,
            patient.age,
            patient.gender,
            patient.phone,
            patient.address ?? null,
            new Date().toISOString(),
          ],
        );

        return patient;
      }

      try {
        let patient: Patient;
        try {
          patient = await insertWithNextId();
        } catch (error) {
          if (!isUniqueConstraintError(error)) throw error;
          // Someone else took that sequence between our read and our insert;
          // recompute against the latest data and try exactly once more.
          patient = await insertWithNextId();
        }

        setPatients((previous) => [patient, ...previous]);
        return patient;
      } catch (error) {
        console.error("Failed to save patient:", error);
        throw error;
      }
    },
    [],
  );

  const getPatient = useCallback(
    (id: string) => patients.find((patient) => patient.id === id),
    [patients],
  );

  const value = useMemo(
    () => ({
      patients,
      loading,
      addPatient,
      getPatient,
      previewPatientId,
    }),
    [patients, loading, addPatient, getPatient, previewPatientId],
  );

  return (
    <PatientContext.Provider value={value}>{children}</PatientContext.Provider>
  );
}

export function usePatients(): PatientContextType {
  const context = useContext(PatientContext);

  if (!context) {
    throw new Error("usePatients must be used inside PatientProvider");
  }

  return context;
}
