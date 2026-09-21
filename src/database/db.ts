import Database from "@tauri-apps/plugin-sql";
import type { LaboratoryTest, TestParameter } from "../domain/laboratory";

interface DatabaseLike {
  select<T>(query: string, bindValues?: unknown[]): Promise<T>;
  execute(query: string, bindValues?: unknown[]): Promise<unknown>;
}

interface BrowserDatabaseState {
  patients: Array<Record<string, unknown>>;
  reportWorkspaceState: string | null;
  reportWorkspaceMeta: Array<Record<string, unknown>>;
  workspaceTests: LaboratoryTest[];
  workspaceTestsInitialized: boolean;
}

const BROWSER_DATABASE_KEY = "pathforge.browser-database.v1";

function emptyBrowserDatabaseState(): BrowserDatabaseState {
  return {
    patients: [],
    reportWorkspaceState: null,
    reportWorkspaceMeta: [],
    workspaceTests: [],
    workspaceTestsInitialized: false,
  };
}

export function normalizePatientLookupKey(name: string, phone: string): string {
  const cleanName = String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const cleanPhone = String(phone ?? "").replace(/\D+/g, "");
  return `${cleanName}|${cleanPhone}`;
}

export function patientHasDuplicateRecord(
  existing: Array<{ name?: string; phone?: string }>,
  name: string,
  phone: string,
): boolean {
  const target = normalizePatientLookupKey(name, phone);
  return existing.some((record) => {
    const recordName = typeof record.name === "string" ? record.name : "";
    const recordPhone = typeof record.phone === "string" ? record.phone : "";
    return normalizePatientLookupKey(recordName, recordPhone) === target;
  });
}

function readBrowserDatabaseState(): BrowserDatabaseState {
  try {
    const raw = window.localStorage.getItem(BROWSER_DATABASE_KEY);
    if (!raw) return emptyBrowserDatabaseState();

    const parsed = JSON.parse(raw) as Partial<BrowserDatabaseState>;
    const state = emptyBrowserDatabaseState();

    state.patients = Array.isArray(parsed.patients) ? parsed.patients : [];
    state.reportWorkspaceMeta = Array.isArray(parsed.reportWorkspaceMeta)
      ? parsed.reportWorkspaceMeta
      : [];
    state.workspaceTests = Array.isArray(parsed.workspaceTests)
      ? parsed.workspaceTests
      : [];
    state.workspaceTestsInitialized = Boolean(parsed.workspaceTestsInitialized);
    state.reportWorkspaceState =
      typeof parsed.reportWorkspaceState === "string"
        ? parsed.reportWorkspaceState
        : null;

    return state;
  } catch {
    return emptyBrowserDatabaseState();
  }
}

class BrowserDatabase implements DatabaseLike {
  private state = readBrowserDatabaseState();

  private persist(): void {
    try {
      window.localStorage.setItem(
        BROWSER_DATABASE_KEY,
        JSON.stringify(this.state),
      );
    } catch {
      // Local persistence can fail under private mode, quota exhaustion, or a
      // browser security restriction. Fail closed by keeping the in-memory state
      // and letting the user continue without a silent crash.
    }
  }

  async select<T>(query: string): Promise<T> {
    const normalized = query.replace(/\s+/g, " ").trim().toLowerCase();

    if (
      normalized.includes("from patients") &&
      normalized.includes("patient_id")
    ) {
      if (normalized.includes("name, age, gender")) {
        return [...this.state.patients]
          .sort((a, b) =>
            String(b.created_at).localeCompare(String(a.created_at)),
          )
          .map((patient) => ({ ...patient })) as T;
      }
      return this.state.patients.map((patient) => ({
        patient_id: patient.patient_id,
      })) as T;
    }

    if (normalized.includes("from report_workspace_state")) {
      return this.state.reportWorkspaceState
        ? ([{ state_json: this.state.reportWorkspaceState }] as T)
        : ([] as T);
    }

    if (normalized.includes("from report_workspace_meta")) {
      return this.state.reportWorkspaceMeta.map((meta) => ({ ...meta })) as T;
    }

    if (normalized.includes("from workspace_test_catalog_state")) {
      if (normalized.includes("state_json")) {
        return this.state.workspaceTestsInitialized
          ? ([{ state_json: JSON.stringify(this.state.workspaceTests) }] as T)
          : ([] as T);
      }
      return this.state.workspaceTestsInitialized
        ? ([{ id: 1 }] as T)
        : ([] as T);
    }

    if (normalized.includes("from workspace_tests")) {
      return this.state.workspaceTests.map((test) => ({
        id: test.id,
        name: test.name,
        department: test.department,
        specimen: test.specimen ?? null,
        created_at: test.createdAt,
        updated_at: test.updatedAt ?? null,
      })) as T;
    }

    if (normalized.includes("from workspace_test_parameters")) {
      return this.state.workspaceTests.flatMap((test) =>
        test.parameters.map((parameter) => ({
          id: parameter.id,
          test_id: test.id,
          name: parameter.name,
          result_type: parameter.type,
          unit: parameter.unit ?? null,
          reference_min: parameter.referenceRange?.min ?? null,
          reference_max: parameter.referenceRange?.max ?? null,
          reference_text: parameter.referenceRange?.text ?? null,
          symbol: parameter.symbol ?? null,
        })),
      ) as T;
    }

    return [] as T;
  }

  async execute(query: string, values: unknown[] = []): Promise<unknown> {
    const normalized = query.replace(/\s+/g, " ").trim().toLowerCase();

    if (normalized.startsWith("insert into patients")) {
      const [id, patientId, name, age, gender, phone, address, createdAt] =
        values;

      if (
        this.state.patients.some(
          (patient) => patient.patient_id === patientId,
        ) ||
        patientHasDuplicateRecord(
          this.state.patients.map((patient) => ({
            name: typeof patient.name === "string" ? patient.name : "",
            phone: typeof patient.phone === "string" ? patient.phone : "",
          })),
          typeof name === "string" ? name : String(name ?? ""),
          typeof phone === "string" ? phone : String(phone ?? ""),
        )
      ) {
        throw new Error(
          "Duplicate patient record: a patient with the same name and phone already exists.",
        );
      }

      this.state.patients.push({
        id,
        patient_id: patientId,
        name,
        age,
        gender,
        phone,
        address,
        created_at: createdAt,
      });
    } else if (normalized.startsWith("delete from patients")) {
      const [id] = values;
      this.state.patients = this.state.patients.filter(
        (patient) => patient.id !== id,
      );
    } else if (normalized.startsWith("insert into report_workspace_state")) {
      this.state.reportWorkspaceState = String(values[0]);
    } else if (normalized.startsWith("insert into report_workspace_meta")) {
      const [reportId, patientId, testId, testName, department, createdAt] =
        values;
      const existing = this.state.reportWorkspaceMeta.find(
        (meta) => meta.report_id === reportId,
      );
      const next = {
        report_id: reportId,
        patient_id: patientId,
        test_id: testId,
        test_name: testName,
        department,
        created_at: createdAt,
      };
      if (existing) Object.assign(existing, next);
      else this.state.reportWorkspaceMeta.push(next);
    } else if (normalized === "delete from workspace_test_parameters") {
      for (const test of this.state.workspaceTests) test.parameters = [];
    } else if (normalized === "delete from workspace_tests") {
      this.state.workspaceTests = [];
    } else if (normalized.startsWith("insert into workspace_tests")) {
      const [id, name, department, specimen, createdAt, updatedAt] = values;
      this.state.workspaceTests.push({
        id: String(id),
        name: String(name),
        department: String(department),
        specimen: specimen == null ? undefined : String(specimen),
        parameters: [],
        createdAt: String(createdAt),
        updatedAt: updatedAt == null ? undefined : String(updatedAt),
      });
    } else if (normalized.startsWith("insert into workspace_test_parameters")) {
      const [id, testId, name, type, unit, min, max, text, symbol] = values;
      const test = this.state.workspaceTests.find(
        (entry) => entry.id === testId,
      );
      if (test) {
        test.parameters.push({
          id: String(id),
          name: String(name),
          type: type as TestParameter["type"],
          unit: unit == null ? undefined : String(unit),
          symbol:
            symbol == null ? undefined : (symbol as TestParameter["symbol"]),
          referenceRange:
            text != null
              ? { text: String(text) }
              : min != null || max != null
                ? {
                    min: min as number | undefined,
                    max: max as number | undefined,
                  }
                : undefined,
        });
      }
    } else if (
      normalized.startsWith("insert into workspace_test_catalog_state")
    ) {
      const stateJson = typeof values[0] === "string" ? values[0] : null;
      if (stateJson) {
        try {
          const parsed = JSON.parse(stateJson);
          if (Array.isArray(parsed)) this.state.workspaceTests = parsed;
        } catch {
          // The real database would reject malformed JSON only at read time;
          // keep the in-memory adapter permissive for its test-only use.
        }
      }
      this.state.workspaceTestsInitialized = true;
    }

    if (!/^begin$|^commit$|^rollback$/.test(normalized)) this.persist();
    return {};
  }
}

let database: DatabaseLike | null = null;
let databasePromise: Promise<DatabaseLike> | null = null;
let databaseOperationQueue = Promise.resolve();

const DATABASE_BUSY_RETRY_DELAYS_MS = [50, 100, 200, 400, 800];

function isDatabaseBusyError(error: unknown): boolean {
  let message: string;
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  } else {
    try {
      message = JSON.stringify(error);
    } catch {
      message = String(error);
    }
  }

  return /database is locked|database table is locked|SQLITE_BUSY|code:\s*5/i.test(
    message,
  );
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function withDatabaseBusyRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const delay = DATABASE_BUSY_RETRY_DELAYS_MS[attempt];
      if (!isDatabaseBusyError(error) || delay === undefined) throw error;
      await wait(delay);
    }
  }
}

function enqueueDatabaseOperation<T>(operation: () => Promise<T>): Promise<T> {
  const queued = databaseOperationQueue.then(operation, operation);
  databaseOperationQueue = queued.then(
    () => undefined,
    () => undefined,
  );
  return queued;
}

/**
 * The SQL plugin owns a connection pool, not one long-lived SQLite connection.
 * Serializing calls here prevents independent UI providers from contending for
 * the same local database, while retrying covers a short-lived external lock.
 */
class SerializedDatabase implements DatabaseLike {
  private readonly inner: DatabaseLike;

  constructor(inner: DatabaseLike) {
    this.inner = inner;
  }

  select<T>(query: string, bindValues?: unknown[]): Promise<T> {
    return enqueueDatabaseOperation(() =>
      withDatabaseBusyRetry(() => this.inner.select<T>(query, bindValues)),
    );
  }

  execute(query: string, bindValues?: unknown[]): Promise<unknown> {
    return enqueueDatabaseOperation(() =>
      withDatabaseBusyRetry(() => this.inner.execute(query, bindValues)),
    );
  }
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function getDatabase(): Promise<DatabaseLike> {
  if (database) {
    return database;
  }

  if (!databasePromise) {
    databasePromise = (
      isTauriRuntime()
        ? Database.load("sqlite:pathforge.db")
        : Promise.resolve(new BrowserDatabase())
    )
      .then(async (rawDb) => {
        if (isTauriRuntime()) await initializeDatabase(rawDb);
        const db = new SerializedDatabase(rawDb);
        database = db;
        return db;
      })
      .catch((error) => {
        databasePromise = null;
        throw error;
      });
  }

  return databasePromise;
}

/** Add `columnDdl` to `table` only when the column is not already present. */
async function ensureColumn(
  db: DatabaseLike,
  table: string,
  column: string,
  columnDdl: string,
): Promise<void> {
  const columns = await db.select<{ name: string }[]>(
    `PRAGMA table_info(${table})`,
  );
  if (!columns.some((entry) => entry.name === column)) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${columnDdl}`);
  }
}

async function initializeDatabase(db: DatabaseLike): Promise<void> {
  // ================================
  // PATIENTS
  // ================================

  await db.execute(`
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      age INTEGER,
      gender TEXT,
      phone TEXT,
      address TEXT,
      created_at TEXT NOT NULL
    )
  `);

  // Additive migration for databases created before phone/address existed.
  await ensureColumn(db, "patients", "phone", "phone TEXT");
  await ensureColumn(db, "patients", "address", "address TEXT");

  // Note: the UNIQUE constraint on patient_id above only applies to databases
  // created from this schema onward — SQLite can't ALTER TABLE to add a UNIQUE
  // constraint to an existing table, and this prototype has no migration
  // engine to rebuild it. A database file created before this change keeps
  // allowing duplicate patient_id values.

  // ================================
  // REPORTS
  // ================================

  await db.execute(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      specimen_type TEXT NOT NULL,
      clinical_history TEXT,
      findings TEXT,
      diagnosis TEXT,
      status TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      parent_report_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      finalized_at TEXT,
      FOREIGN KEY (patient_id) REFERENCES patients(id)
    )
  `);

  // ================================
  // TEST PANELS
  // Example:
  // Liver Function Test
  // Kidney Function Test
  // CBC
  // ================================

  await db.execute(`
    CREATE TABLE IF NOT EXISTS test_panels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    )
  `);

  // ================================
  // LABORATORY TESTS
  // Example:
  // ALT, AST, Hemoglobin, Creatinine
  // ================================

  await db.execute(`
    CREATE TABLE IF NOT EXISTS laboratory_tests (
      id TEXT PRIMARY KEY,
      panel_id TEXT NOT NULL,
      name TEXT NOT NULL,
      unit TEXT,
      reference_range TEXT,
      symbol TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      FOREIGN KEY (panel_id) REFERENCES test_panels(id)
    )
  `);

  // ================================
  // TEST RESULTS
  // Employee enters ONLY result_value
  // ================================

  await db.execute(`
    CREATE TABLE IF NOT EXISTS test_results (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      test_id TEXT NOT NULL,
      result_value TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_by TEXT,

      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (test_id) REFERENCES laboratory_tests(id)
    )
  `);

  // Canonical report-service state. The service owns the lifecycle rules; this
  // table only provides durable local storage for its immutable snapshots.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS report_workspace_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // UI-only report metadata deliberately stays separate from the canonical
  // clinical payload, which remains owned by the report service.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS report_workspace_meta (
      report_id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      test_id TEXT,
      test_name TEXT,
      department TEXT,
      created_at TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS workspace_tests (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      department TEXT NOT NULL,
      specimen TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS workspace_test_parameters (
      id TEXT PRIMARY KEY,
      test_id TEXT NOT NULL,
      name TEXT NOT NULL,
      result_type TEXT NOT NULL,
      unit TEXT,
      reference_min REAL,
      reference_max REAL,
      reference_text TEXT,
      symbol TEXT,
      FOREIGN KEY (test_id) REFERENCES workspace_tests(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS workspace_test_catalog_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      initialized_at TEXT NOT NULL
    )
  `);

  // A single snapshot makes catalog replacement one SQLite statement. The
  // normalized tables above remain readable for databases created by older
  // versions and are used as a one-time fallback during migration.
  await ensureColumn(
    db,
    "workspace_test_catalog_state",
    "state_json",
    "state_json TEXT",
  );
}

export interface PersistedReportMeta {
  reportId: string;
  patientId: string;
  testId?: string;
  testName?: string;
  department?: string;
  createdAt: string;
}

export async function loadReportWorkspaceState(): Promise<unknown | null> {
  const db = await getDatabase();
  const rows = await db.select<{ state_json: string }[]>(
    "SELECT state_json FROM report_workspace_state WHERE id = 1",
  );
  if (!rows[0]?.state_json) return null;

  try {
    return JSON.parse(rows[0].state_json) as unknown;
  } catch {
    return null;
  }
}

export async function saveReportWorkspaceState(state: unknown): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO report_workspace_state (id, state_json, updated_at)
     VALUES (1, $1, $2)
     ON CONFLICT(id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at`,
    [JSON.stringify(state), new Date().toISOString()],
  );
}

export async function loadReportWorkspaceMeta(): Promise<
  PersistedReportMeta[]
> {
  const db = await getDatabase();
  const rows = await db.select<
    {
      report_id: string;
      patient_id: string;
      test_id: string | null;
      test_name: string | null;
      department: string | null;
      created_at: string;
    }[]
  >(
    "SELECT report_id, patient_id, test_id, test_name, department, created_at FROM report_workspace_meta",
  );

  return rows.map((row) => ({
    reportId: row.report_id,
    patientId: row.patient_id,
    testId: row.test_id ?? undefined,
    testName: row.test_name ?? undefined,
    department: row.department ?? undefined,
    createdAt: row.created_at,
  }));
}

export async function saveReportWorkspaceMeta(
  meta: PersistedReportMeta,
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO report_workspace_meta (
       report_id, patient_id, test_id, test_name, department, created_at
     ) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT(report_id) DO UPDATE SET
       patient_id = excluded.patient_id,
       test_id = excluded.test_id,
       test_name = excluded.test_name,
       department = excluded.department,
       created_at = excluded.created_at`,
    [
      meta.reportId,
      meta.patientId,
      meta.testId ?? null,
      meta.testName ?? null,
      meta.department ?? null,
      meta.createdAt,
    ],
  );
}

export async function loadWorkspaceTests(): Promise<{
  initialized: boolean;
  tests: LaboratoryTest[];
}> {
  const db = await getDatabase();
  const snapshotRows = await db.select<{ state_json: string | null }[]>(
    "SELECT state_json FROM workspace_test_catalog_state WHERE id = 1",
  );
  const snapshot = snapshotRows[0]?.state_json;
  if (snapshot) {
    try {
      const tests = JSON.parse(snapshot) as unknown;
      if (Array.isArray(tests)) return { initialized: true, tests };
    } catch {
      // Fall through to the normalized legacy tables below.
    }
  }

  const state = await db.select<{ id: number }[]>(
    "SELECT id FROM workspace_test_catalog_state WHERE id = 1",
  );
  const testRows = await db.select<
    {
      id: string;
      name: string;
      department: string;
      specimen: string | null;
      created_at: string;
      updated_at: string | null;
    }[]
  >(
    "SELECT id, name, department, specimen, created_at, updated_at FROM workspace_tests ORDER BY name",
  );
  const parameterRows = await db.select<
    {
      id: string;
      test_id: string;
      name: string;
      result_type: "number" | "text";
      unit: string | null;
      reference_min: number | null;
      reference_max: number | null;
      reference_text: string | null;
      symbol: TestParameter["symbol"] | null;
    }[]
  >(
    `SELECT id, test_id, name, result_type, unit, reference_min, reference_max,
            reference_text, symbol
     FROM workspace_test_parameters
     ORDER BY rowid`,
  );

  const parametersByTest = new Map<string, TestParameter[]>();
  for (const row of parameterRows) {
    const parameter: TestParameter = {
      id: row.id,
      name: row.name,
      type: row.result_type,
      unit: row.unit ?? undefined,
      symbol: row.symbol ?? undefined,
    };
    if (row.reference_text) {
      parameter.referenceRange = { text: row.reference_text };
    } else if (row.reference_min !== null || row.reference_max !== null) {
      parameter.referenceRange = {
        min: row.reference_min ?? undefined,
        max: row.reference_max ?? undefined,
      };
    }
    const list = parametersByTest.get(row.test_id) ?? [];
    list.push(parameter);
    parametersByTest.set(row.test_id, list);
  }

  return {
    initialized: state.length > 0,
    tests: testRows.map((row) => ({
      id: row.id,
      name: row.name,
      department: row.department,
      specimen: row.specimen ?? undefined,
      parameters: parametersByTest.get(row.id) ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? undefined,
    })),
  };
}

/**
 * Replace the whole workspace test catalog with one atomic snapshot write.
 * Keeping this as one database statement is important because the SQL plugin
 * exposes a connection pool and cannot hold a transaction across JS calls.
 */
export async function saveWorkspaceTests(
  tests: LaboratoryTest[],
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO workspace_test_catalog_state (id, state_json, initialized_at)
     VALUES (1, $1, $2)
     ON CONFLICT(id) DO UPDATE SET
       state_json = excluded.state_json,
       initialized_at = excluded.initialized_at`,
    [JSON.stringify(tests), new Date().toISOString()],
  );
}
