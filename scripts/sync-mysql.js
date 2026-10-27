const mysql = require("mysql2/promise");
const { DatabaseSync } = require("node:sqlite");
const path = require("node:path");

async function syncAllToMySQL() {
  const dbPath = path.join(process.cwd(), "data", "dvla_attendance.db");
  const db = new DatabaseSync(dbPath);
  const pool = mysql.createPool({
    uri: process.env.DATABASE_URL || "mysql://root@localhost:3306/dvla_contract_attendance"
  });

  console.log("Checking MySQL connection...");
  const [dbNameResult] = await pool.query("SELECT DATABASE() as db");
  console.log("Connected to database:", dbNameResult[0].db);

  console.log("1. Syncing organizations -> organization...");
  const orgs = db.prepare("SELECT * FROM organizations").all();
  for (const o of orgs) {
    await pool.query(
      `INSERT INTO organization (id, name, code, country, address, email, phone, logoUrl, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), address=VALUES(address), email=VALUES(email), phone=VALUES(phone), logoUrl=VALUES(logoUrl), updatedAt=VALUES(updatedAt)`,
      [o.id, o.name, o.code, o.country, o.address, o.email, o.phone, o.logoUrl, new Date(o.created_at || Date.now()), new Date()]
    );
  }

  console.log("2. Syncing attendance_settings -> attendancesettings...");
  const settings = db.prepare("SELECT * FROM attendance_settings").all();
  for (const s of settings) {
    await pool.query(
      `INSERT INTO attendancesettings (id, organizationId, workStartTime, workEndTime, lateGraceMinutes, halfDayHours, requireLocation, allowOvertime, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE workStartTime=VALUES(workStartTime), workEndTime=VALUES(workEndTime), lateGraceMinutes=VALUES(lateGraceMinutes), halfDayHours=VALUES(halfDayHours), requireLocation=VALUES(requireLocation), allowOvertime=VALUES(allowOvertime), updatedAt=VALUES(updatedAt)`,
      [s.id, s.organization_id, s.work_start_time, s.work_end_time, s.late_grace_minutes, s.half_day_hours, s.require_location ? 1 : 0, s.allow_overtime ? 1 : 0, new Date()]
    );
  }

  console.log("3. Syncing departments -> department...");
  const depts = db.prepare("SELECT * FROM departments").all();
  for (const d of depts) {
    await pool.query(
      `INSERT INTO department (id, name, code, description, createdAt)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), code=VALUES(code), description=VALUES(description)`,
      [d.id, d.name, d.code, d.description, new Date(d.created_at || Date.now())]
    );
  }

  console.log("4. Syncing users -> user...");
  const users = db.prepare("SELECT * FROM users").all();
  for (const u of users) {
    await pool.query(
      `INSERT INTO user (id, email, passwordHash, name, role, phone, avatar, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE email=VALUES(email), passwordHash=VALUES(passwordHash), name=VALUES(name), role=VALUES(role), phone=VALUES(phone), avatar=VALUES(avatar), isActive=VALUES(isActive), updatedAt=VALUES(updatedAt)`,
      [u.id, u.email, u.password_hash, u.name, u.role, u.phone, u.avatar, u.is_active ? 1 : 0, new Date(u.created_at || Date.now()), new Date(u.updated_at || Date.now())]
    );
  }

  const userIds = new Set(users.map(u => u.id));

  console.log("6. Syncing contract_staff -> contractstaff...");
  const staff = db.prepare("SELECT * FROM contract_staff").all();
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

  console.log("7. Syncing attendance -> attendance...");
  const atts = db.prepare("SELECT * FROM attendance").all();
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

  console.log("8. Syncing leave_requests -> leaverequest...");
  const leaves = db.prepare("SELECT * FROM leave_requests").all();
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

  console.log("9. Syncing notifications -> notification...");
  const notifs = db.prepare("SELECT * FROM notifications").all();
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

  console.log("10. Syncing audit_logs -> auditlog...");
  const logs = db.prepare("SELECT * FROM audit_logs").all();
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

  console.log("SUCCESS: All 10 MySQL tables synced from SQLite!");
  await pool.end();
}

syncAllToMySQL().catch(err => {
  console.error("Sync error message:", err.message);
  console.error("Sync error code:", err.code);
  process.exit(1);
});
