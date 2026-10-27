import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import bcrypt from "bcryptjs";

// ─── Connection / Database Instance ──────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __sqliteDb: DatabaseSync | undefined;
}

export function getDb(): DatabaseSync {
  if (!global.__sqliteDb) {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = path.join(dataDir, "dvla_attendance.db");
    const db = new DatabaseSync(dbPath);

    // Concurrency, speed and referential integrity
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA synchronous = NORMAL;");
    db.exec("PRAGMA foreign_keys = ON;");

    // SQL Helper functions for compatibility
    db.function("NOW", () => new Date().toISOString().slice(0, 19).replace("T", " "));
    db.function("CURDATE", () => new Date().toISOString().slice(0, 10));

    global.__sqliteDb = db;
  }
  return global.__sqliteDb;
}

// Backward compatibility helper
export function getPool(): any {
  return getDb();
}

// ─── Query Helpers ───────────────────────────────────────────────────────────

/** Run a SELECT query that returns many rows */
export async function queryAll<T = any>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const db = getDb();
  const stmt = db.prepare(sql);
  return stmt.all(...params) as T[];
}

/** Run a SELECT query that returns one row (or undefined) */
export async function queryOne<T = any>(
  sql: string,
  params: any[] = []
): Promise<T | undefined> {
  const db = getDb();
  const stmt = db.prepare(sql);
  const row = stmt.get(...params);
  return row !== undefined ? (row as T) : undefined;
}

/** Run INSERT / UPDATE / DELETE statement */
export async function run(
  sql: string,
  params: any[] = []
): Promise<{ changes: number | bigint; lastInsertRowid: number | bigint }> {
  const db = getDb();
  const stmt = db.prepare(sql);
  return stmt.run(...params);
}

// ─── Schema Bootstrap ────────────────────────────────────────────────────────

let _schemaReady = false;

export async function ensureSchema(): Promise<void> {
  if (_schemaReady) return;
  _schemaReady = true;

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      country TEXT NOT NULL,
      address TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      logoUrl TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS attendance_settings (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      work_start_time TEXT NOT NULL DEFAULT '08:00',
      work_end_time TEXT NOT NULL DEFAULT '17:00',
      late_grace_minutes INTEGER NOT NULL DEFAULT 15,
      half_day_hours REAL NOT NULL DEFAULT 4.0,
      require_location INTEGER NOT NULL DEFAULT 0,
      allow_overtime INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      code TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('ADMIN', 'SUPERVISOR', 'STAFF')),
      phone TEXT,
      avatar TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS supervisors (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      department_id TEXT,
      title TEXT NOT NULL DEFAULT 'Contract Supervisor',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS contract_staff (
      id TEXT PRIMARY KEY,
      staff_id TEXT UNIQUE NOT NULL,
      user_id TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      ghana_card TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      gender TEXT NOT NULL CHECK(gender IN ('MALE', 'FEMALE', 'OTHER')),
      dob TEXT,
      address TEXT,
      department_id TEXT NOT NULL,
      position TEXT NOT NULL,
      contract_start TEXT NOT NULL,
      contract_end TEXT NOT NULL,
      supervisor_id TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE', 'TERMINATED', 'ON_LEAVE')),
      avatar TEXT,
      biometric_data TEXT,
      biometric_captured_at TEXT,
      face_features TEXT,
      is_new_registration INTEGER DEFAULT 0,
      emergency_contact TEXT,
      emergency_phone TEXT,
      registration_notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
      FOREIGN KEY (supervisor_id) REFERENCES supervisors(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL,
      date TEXT NOT NULL,
      check_in_time TEXT,
      check_out_time TEXT,
      working_minutes INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'PRESENT' CHECK(status IN ('PRESENT', 'LATE', 'EARLY', 'ABSENT', 'ON_LEAVE', 'HALF_DAY')),
      check_in_location TEXT,
      check_out_location TEXT,
      biometric_verified INTEGER DEFAULT 1,
      biometric_photo TEXT,
      is_corrected INTEGER NOT NULL DEFAULT 0,
      corrected_by TEXT,
      correction_reason TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(staff_id, date),
      FOREIGN KEY (staff_id) REFERENCES contract_staff(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS leave_requests (
      id TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL,
      leave_type TEXT NOT NULL CHECK(leave_type IN ('ANNUAL', 'SICK', 'CASUAL', 'MATERNITY', 'BEREAVEMENT', 'STUDY')),
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
      approved_by TEXT,
      rejection_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (staff_id) REFERENCES contract_staff(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'INFO',
      is_read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_name TEXT NOT NULL,
      user_role TEXT NOT NULL,
      action TEXT NOT NULL,
      description TEXT NOT NULL,
      ip_address TEXT NOT NULL DEFAULT '127.0.0.1',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  // Ensure admin name is set and not empty
  await run(
    "UPDATE users SET name = 'DVLA Administrator' WHERE id = 'user-admin' AND (name = '' OR name IS NULL)"
  );

  // Seed initial data if empty
  await seedInitialData();
}

// ─── Seed ────────────────────────────────────────────────────────────────────

async function seedInitialData() {
  const existing = await queryOne("SELECT id FROM organizations LIMIT 1");
  if (existing) return;

  const orgId = "org-dvla-gh";
  await run(
    `INSERT INTO organizations (id, name, code, country, address, email, phone, logoUrl)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orgId,
      "Driver and Vehicle Licensing Authority (DVLA)",
      "DVLA-GH",
      "Ghana",
      "1 Jawahar Lal Nehru Road, Cantonments, Accra, Ghana",
      "info@dvla.gov.gh",
      "+233 30 274 6760",
      "/dvla-logo.png",
    ]
  );

  await run(
    `INSERT INTO attendance_settings (id, organization_id, work_start_time, work_end_time, late_grace_minutes, half_day_hours, require_location, allow_overtime)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ["settings-default", orgId, "08:00", "17:00", 15, 4.0, 0, 1]
  );

  const depts = [
    ["dept-dtt", "Driver Training & Testing", "DTT", "Testing of drivers and compliance with national driving standards"],
    ["dept-vir", "Vehicle Inspection & Registration", "VIR", "Technical vehicle roadworthiness and licensing records"],
    ["dept-it", "Information Technology", "IT", "Digital infrastructure, biometric enrollment, and network operations"],
    ["dept-csl", "Customer Service & Licensing", "CSL", "Front-desk counter services, card printing, and client advisory"],
    ["dept-hr", "Human Resource Management", "HR", "Personnel management, contract staff affairs, and training"],
  ];
  for (const d of depts) {
    await run("INSERT INTO departments (id, name, code, description) VALUES (?, ?, ?, ?)", d);
  }

  const adminPassHash = bcrypt.hashSync("Admin@123", 10);
  const adminUserId = "user-admin";

  await run(
    "INSERT INTO users (id, email, password_hash, name, role, phone, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)",
    [adminUserId, "admin@dvla.gov.gh", adminPassHash, "DVLA Administrator", "ADMIN", "+233 24 100 2000"]
  );

  await run(
    `INSERT INTO notifications (id, user_id, title, message, type, is_read, link) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      "notif-1",
      adminUserId,
      "DVLA Attendance System Ready",
      "Real-time attendance system is operational. Register staff details and biometrics to begin.",
      "SUCCESS",
      0,
      "/staff",
    ]
  );

  await run(
    `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, description, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      "audit-1",
      adminUserId,
      "DVLA Administrator",
      "ADMIN",
      "SYSTEM_INITIALIZED",
      "DVLA Contract Staff Attendance Management System initialized for live operations.",
      "127.0.0.1",
    ]
  );
}

// ─── Utility Functions ───────────────────────────────────────────────────────

export async function logAudit(
  userId: string | null,
  userName: string,
  userRole: string,
  action: string,
  description: string,
  ipAddress = "127.0.0.1"
) {
  try {
    await ensureSchema();
    const id = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    await run(
      `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, description, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, userName, userRole, action, description, ipAddress]
    );
  } catch (err) {
    console.error("Failed to log audit action:", err);
  }
}

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type = "INFO",
  link: string | null = null
) {
  try {
    await ensureSchema();
    const id = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    await run(
      `INSERT INTO notifications (id, user_id, title, message, type, link) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, userId, title, message, type, link]
    );
  } catch (err) {
    console.error("Failed to create notification:", err);
  }
}
