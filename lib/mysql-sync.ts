import mysql from "mysql2/promise";
import type { DatabaseSync } from "node:sqlite";

declare global {
  // eslint-disable-next-line no-var
  var __mysqlPool: mysql.Pool | undefined;
}

export function getMySQLPool(): mysql.Pool {
  if (!global.__mysqlPool) {
    const dbUrl = process.env.DATABASE_URL || "mysql://root@localhost:3306/dvla_contract_attendance";
    global.__mysqlPool = mysql.createPool({
      uri: dbUrl,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      multipleStatements: true
    });
  }
  return global.__mysqlPool;
}

/**
 * Synchronizes all records from SQLite to MySQL in XAMPP phpMyAdmin
 */
export async function syncAllFromSQLite(db: DatabaseSync) {
  try {
    const pool = getMySQLPool();

    // 1. Organizations
    const orgs = db.prepare("SELECT * FROM organizations").all() as any[];
    for (const o of orgs) {
      await pool.query(
        `INSERT INTO organization (id, name, code, country, address, email, phone, logoUrl, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), address=VALUES(address), email=VALUES(email), phone=VALUES(phone), logoUrl=VALUES(logoUrl), updatedAt=VALUES(updatedAt)`,
        [o.id, o.name, o.code, o.country, o.address, o.email, o.phone, o.logoUrl, new Date(o.created_at || Date.now()), new Date()]
      );
    }

    // 2. Settings
    const settings = db.prepare("SELECT * FROM attendance_settings").all() as any[];
    for (const s of settings) {
      await pool.query(
        `INSERT INTO attendancesettings (id, organizationId, workStartTime, workEndTime, lateGraceMinutes, halfDayHours, requireLocation, allowOvertime, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE workStartTime=VALUES(workStartTime), workEndTime=VALUES(workEndTime), lateGraceMinutes=VALUES(lateGraceMinutes), halfDayHours=VALUES(halfDayHours), requireLocation=VALUES(requireLocation), allowOvertime=VALUES(allowOvertime), updatedAt=VALUES(updatedAt)`,
        [s.id, s.organization_id, s.work_start_time, s.work_end_time, s.late_grace_minutes, s.half_day_hours, s.require_location ? 1 : 0, s.allow_overtime ? 1 : 0, new Date()]
      );
    }

    // 3. Departments
    const depts = db.prepare("SELECT * FROM departments").all() as any[];
    for (const d of depts) {
      await pool.query(
        `INSERT INTO department (id, name, code, description, createdAt)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), code=VALUES(code), description=VALUES(description)`,
        [d.id, d.name, d.code, d.description, new Date(d.created_at || Date.now())]
      );
    }

    // 4. Users
    const users = db.prepare("SELECT * FROM users").all() as any[];
    for (const u of users) {
      await pool.query(
        `INSERT INTO user (id, email, passwordHash, name, role, phone, avatar, isActive, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE email=VALUES(email), passwordHash=VALUES(passwordHash), name=VALUES(name), role=VALUES(role), phone=VALUES(phone), avatar=VALUES(avatar), isActive=VALUES(isActive), updatedAt=VALUES(updatedAt)`,
        [u.id, u.email, u.password_hash, u.name, u.role, u.phone, u.avatar, u.is_active ? 1 : 0, new Date(u.created_at || Date.now()), new Date(u.updated_at || Date.now())]
      );
    }

    const userIds = new Set(users.map(u => u.id));

    // 6. Contract Staff
    const staff = db.prepare("SELECT * FROM contract_staff").all() as any[];
    for (const cs of staff) {
      if (!userIds.has(cs.user_id)) continue;
      await pool.query(
        `INSERT INTO contractstaff (id, staffId, userId, fullName, ghanaCard, phone, email, gender, dob, address, departmentId, position, contractStart, contractEnd, status, avatar, biometricData, biometricCapturedAt, faceFeatures, isNewRegistration, emergencyContact, emergencyPhone, registrationNotes, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE fullName=VALUES(fullName), phone=VALUES(phone), email=VALUES(email), position=VALUES(position), status=VALUES(status), avatar=VALUES(avatar), biometricData=VALUES(biometricData), faceFeatures=VALUES(faceFeatures), updatedAt=VALUES(updatedAt)`,
        [
          cs.id, cs.staff_id, cs.user_id, cs.full_name, cs.ghana_card, cs.phone, cs.email, cs.gender || "MALE",
          cs.dob ? new Date(cs.dob) : null, cs.address, cs.department_id, cs.position,
          new Date(cs.contract_start || Date.now()), new Date(cs.contract_end || Date.now()),
          cs.status || "ACTIVE", cs.avatar, cs.biometric_data,
          cs.biometric_captured_at ? new Date(cs.biometric_captured_at) : null,
          cs.face_features, cs.is_new_registration ? 1 : 0, cs.emergency_contact, cs.emergency_phone,
          cs.registration_notes, new Date(cs.created_at || Date.now()), new Date(cs.updated_at || Date.now())
        ]
      );
    }

    const staffIds = new Set(staff.map(cs => cs.id));

    // 7. Attendance
    const atts = db.prepare("SELECT * FROM attendance").all() as any[];
    for (const a of atts) {
      if (!staffIds.has(a.staff_id)) continue;
      await pool.query(
        `INSERT INTO attendance (id, staffId, date, checkInTime, checkOutTime, workingMinutes, status, checkInLocation, checkOutLocation, biometricVerified, biometricPhoto, isCorrected, correctedBy, correctionReason, notes, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE checkInTime=VALUES(checkInTime), checkOutTime=VALUES(checkOutTime), workingMinutes=VALUES(workingMinutes), status=VALUES(status), biometricPhoto=VALUES(biometricPhoto), updatedAt=VALUES(updatedAt)`,
        [
          a.id, a.staff_id, a.date, a.check_in_time, a.check_out_time, a.working_minutes || 0,
          a.status || "PRESENT", a.check_in_location, a.check_out_location, a.biometric_verified ? 1 : 0,
          a.biometric_photo, a.is_corrected ? 1 : 0, a.corrected_by, a.correction_reason, a.notes,
          new Date(a.created_at || Date.now()), new Date(a.updated_at || Date.now())
        ]
      );
    }

    // 8. Leave Requests
    const leaves = db.prepare("SELECT * FROM leave_requests").all() as any[];
    for (const l of leaves) {
      if (!staffIds.has(l.staff_id)) continue;
      await pool.query(
        `INSERT INTO leaverequest (id, staffId, leaveType, startDate, endDate, reason, status, approvedBy, rejectionReason, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status=VALUES(status), approvedBy=VALUES(approvedBy), rejectionReason=VALUES(rejectionReason), updatedAt=VALUES(updatedAt)`,
        [
          l.id, l.staff_id, l.leave_type, l.start_date, l.end_date, l.reason, l.status,
          l.approved_by, l.rejection_reason, new Date(l.created_at || Date.now()), new Date(l.updated_at || Date.now())
        ]
      );
    }

    // 9. Notifications
    const notifs = db.prepare("SELECT * FROM notifications").all() as any[];
    for (const n of notifs) {
      if (!userIds.has(n.user_id)) continue;
      await pool.query(
        `INSERT INTO notification (id, userId, title, message, type, isRead, link, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE isRead=VALUES(isRead)`,
        [
          n.id, n.user_id, n.title, n.message, n.type || "INFO", n.is_read ? 1 : 0,
          n.link, new Date(n.created_at || Date.now())
        ]
      );
    }

    // 10. Audit Logs
    const logs = db.prepare("SELECT * FROM audit_logs").all() as any[];
    for (const l of logs) {
      const validUserId = l.user_id && userIds.has(l.user_id) ? l.user_id : null;
      await pool.query(
        `INSERT INTO auditlog (id, userId, userName, userRole, action, description, ipAddress, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE action=VALUES(action)`,
        [
          l.id, validUserId, l.user_name, l.user_role, l.action, l.description,
          l.ip_address || "127.0.0.1", new Date(l.created_at || Date.now())
        ]
      );
    }
  } catch (err: any) {
    console.warn("[MySQL-Sync] Sync warning:", err?.message || err);
  }
}

/**
 * Syncs a specific table modification to MySQL in real-time
 */
export function triggerTableSync(db: DatabaseSync, tableName: string) {
  setImmediate(async () => {
    try {
      const pool = getMySQLPool();
      const lower = tableName.toLowerCase();

      if (lower.includes("contract_staff") || lower.includes("contractstaff")) {
        const staff = db.prepare("SELECT * FROM contract_staff").all() as any[];
        for (const cs of staff) {
          await pool.query(
            `INSERT INTO contractstaff (id, staffId, userId, fullName, ghanaCard, phone, email, gender, dob, address, departmentId, position, contractStart, contractEnd, status, avatar, biometricData, biometricCapturedAt, faceFeatures, isNewRegistration, emergencyContact, emergencyPhone, registrationNotes, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE fullName=VALUES(fullName), phone=VALUES(phone), email=VALUES(email), position=VALUES(position), status=VALUES(status), avatar=VALUES(avatar), biometricData=VALUES(biometricData), faceFeatures=VALUES(faceFeatures), updatedAt=VALUES(updatedAt)`,
            [
              cs.id, cs.staff_id, cs.user_id, cs.full_name, cs.ghana_card, cs.phone, cs.email, cs.gender || "MALE",
              cs.dob ? new Date(cs.dob) : null, cs.address, cs.department_id, cs.position,
              new Date(cs.contract_start || Date.now()), new Date(cs.contract_end || Date.now()),
              cs.status || "ACTIVE", cs.avatar, cs.biometric_data,
              cs.biometric_captured_at ? new Date(cs.biometric_captured_at) : null,
              cs.face_features, cs.is_new_registration ? 1 : 0, cs.emergency_contact, cs.emergency_phone,
              cs.registration_notes, new Date(cs.created_at || Date.now()), new Date(cs.updated_at || Date.now())
            ]
          );
        }
      }

      if (lower.includes("users") || lower.includes("user")) {
        const users = db.prepare("SELECT * FROM users").all() as any[];
        for (const u of users) {
          await pool.query(
            `INSERT INTO user (id, email, passwordHash, name, role, phone, avatar, isActive, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE email=VALUES(email), passwordHash=VALUES(passwordHash), name=VALUES(name), role=VALUES(role), phone=VALUES(phone), avatar=VALUES(avatar), isActive=VALUES(isActive), updatedAt=VALUES(updatedAt)`,
            [u.id, u.email, u.password_hash, u.name, u.role, u.phone, u.avatar, u.is_active ? 1 : 0, new Date(u.created_at || Date.now()), new Date(u.updated_at || Date.now())]
          );
        }
      }

      if (lower.includes("attendance") && !lower.includes("attendance_settings")) {
        const atts = db.prepare("SELECT * FROM attendance").all() as any[];
        for (const a of atts) {
          await pool.query(
            `INSERT INTO attendance (id, staffId, date, checkInTime, checkOutTime, workingMinutes, status, checkInLocation, checkOutLocation, biometricVerified, biometricPhoto, isCorrected, correctedBy, correctionReason, notes, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE checkInTime=VALUES(checkInTime), checkOutTime=VALUES(checkOutTime), workingMinutes=VALUES(workingMinutes), status=VALUES(status), biometricPhoto=VALUES(biometricPhoto), updatedAt=VALUES(updatedAt)`,
            [
              a.id, a.staff_id, a.date, a.check_in_time, a.check_out_time, a.working_minutes || 0,
              a.status || "PRESENT", a.check_in_location, a.check_out_location, a.biometric_verified ? 1 : 0,
              a.biometric_photo, a.is_corrected ? 1 : 0, a.corrected_by, a.correction_reason, a.notes,
              new Date(a.created_at || Date.now()), new Date(a.updated_at || Date.now())
            ]
          );
        }
      }

      if (lower.includes("audit_logs") || lower.includes("auditlog")) {
        const logs = db.prepare("SELECT * FROM audit_logs").all() as any[];
        const userRows = db.prepare("SELECT id FROM users").all() as any[];
        const userIds = new Set(userRows.map(u => u.id));
        for (const l of logs) {
          const validUserId = l.user_id && userIds.has(l.user_id) ? l.user_id : null;
          await pool.query(
            `INSERT INTO auditlog (id, userId, userName, userRole, action, description, ipAddress, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE action=VALUES(action)`,
            [
              l.id, validUserId, l.user_name, l.user_role, l.action, l.description,
              l.ip_address || "127.0.0.1", new Date(l.created_at || Date.now())
            ]
          );
        }
      }

      if (lower.includes("leave_requests") || lower.includes("leaverequest")) {
        const leaves = db.prepare("SELECT * FROM leave_requests").all() as any[];
        for (const l of leaves) {
          await pool.query(
            `INSERT INTO leaverequest (id, staffId, leaveType, startDate, endDate, reason, status, approvedBy, rejectionReason, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE status=VALUES(status), approvedBy=VALUES(approvedBy), rejectionReason=VALUES(rejectionReason), updatedAt=VALUES(updatedAt)`,
            [
              l.id, l.staff_id, l.leave_type, l.start_date, l.end_date, l.reason, l.status,
              l.approved_by, l.rejection_reason, new Date(l.created_at || Date.now()), new Date(l.updated_at || Date.now())
            ]
          );
        }
      }

      if (lower.includes("notifications") || lower.includes("notification")) {
        const notifs = db.prepare("SELECT * FROM notifications").all() as any[];
        for (const n of notifs) {
          await pool.query(
            `INSERT INTO notification (id, userId, title, message, type, isRead, link, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE isRead=VALUES(isRead)`,
            [
              n.id, n.user_id, n.title, n.message, n.type || "INFO", n.is_read ? 1 : 0,
              n.link, new Date(n.created_at || Date.now())
            ]
          );
        }
      }

      if (lower.includes("attendance_settings") || lower.includes("attendancesettings")) {
        const settings = db.prepare("SELECT * FROM attendance_settings").all() as any[];
        for (const s of settings) {
          await pool.query(
            `INSERT INTO attendancesettings (id, organizationId, workStartTime, workEndTime, lateGraceMinutes, halfDayHours, requireLocation, allowOvertime, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE workStartTime=VALUES(workStartTime), workEndTime=VALUES(workEndTime), lateGraceMinutes=VALUES(lateGraceMinutes), halfDayHours=VALUES(halfDayHours), requireLocation=VALUES(requireLocation), allowOvertime=VALUES(allowOvertime), updatedAt=VALUES(updatedAt)`,
            [s.id, s.organization_id, s.work_start_time, s.work_end_time, s.late_grace_minutes, s.half_day_hours, s.require_location ? 1 : 0, s.allow_overtime ? 1 : 0, new Date()]
          );
        }
      }

      if (lower.includes("organizations") || lower.includes("organization")) {
        const orgs = db.prepare("SELECT * FROM organizations").all() as any[];
        for (const o of orgs) {
          await pool.query(
            `INSERT INTO organization (id, name, code, country, address, email, phone, logoUrl, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE name=VALUES(name), address=VALUES(address), email=VALUES(email), phone=VALUES(phone), logoUrl=VALUES(logoUrl), updatedAt=VALUES(updatedAt)`,
            [o.id, o.name, o.code, o.country, o.address, o.email, o.phone, o.logoUrl, new Date(o.created_at || Date.now()), new Date()]
          );
        }
      }
    } catch (err: any) {
      console.warn("[MySQL-Sync] triggerTableSync warning:", err?.message || err);
    }
  });
}
