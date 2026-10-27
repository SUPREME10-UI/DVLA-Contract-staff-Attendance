import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureSchema, queryAll, queryOne, run, logAudit, createNotification } from "@/lib/db";

// Helper: parse HH:mm to minutes from midnight
function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + (m || 0);
}

// Helper: format today as YYYY-MM-DD in local time
function getTodayDateStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Helper: format current time as HH:mm:ss
function getCurrentTimeStr(): string {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export async function GET(req: NextRequest) {
  try {
    await ensureSchema();
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const departmentId = searchParams.get("departmentId");
    const status = searchParams.get("status");
    const staffIdParam = searchParams.get("staffId");
    const search = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "50"));
    const offset = (page - 1) * limit;

    const whereClauses: string[] = [];
    const params: any[] = [];

    if (session.role === "STAFF") {
      whereClauses.push("cs.user_id = ?");
      params.push(session.id);
    }

    if (date) { whereClauses.push("a.date = ?"); params.push(date); }
    if (startDate) { whereClauses.push("a.date >= ?"); params.push(startDate); }
    if (endDate) { whereClauses.push("a.date <= ?"); params.push(endDate); }
    if (departmentId && departmentId !== "ALL") { whereClauses.push("cs.department_id = ?"); params.push(departmentId); }
    if (status && status !== "ALL") { whereClauses.push("a.status = ?"); params.push(status); }
    if (staffIdParam) { whereClauses.push("(cs.staff_id = ? OR cs.id = ?)"); params.push(staffIdParam, staffIdParam); }
    if (search) {
      whereClauses.push("(cs.full_name LIKE ? OR cs.staff_id LIKE ? OR cs.email LIKE ?)");
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const countRow = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM attendance a
       JOIN contract_staff cs ON a.staff_id = cs.id
       JOIN departments d ON cs.department_id = d.id
       ${whereSql}`,
      params
    );

    const records = await queryAll(
      `SELECT a.id, a.date, a.check_in_time, a.check_out_time, a.working_minutes, a.status,
              a.check_in_location, a.check_out_location, a.is_corrected, a.corrected_by,
              a.correction_reason, a.notes,
              cs.id as contract_staff_id, cs.staff_id, cs.full_name, cs.ghana_card,
              cs.position, cs.status as staff_status,
              d.id as department_id, d.name as department_name, d.code as department_code
       FROM attendance a
       JOIN contract_staff cs ON a.staff_id = cs.id
       JOIN departments d ON cs.department_id = d.id
       ${whereSql}
       ORDER BY a.date DESC, a.check_in_time DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return NextResponse.json({
      records,
      total: countRow?.total ?? 0,
      page,
      limit,
      totalPages: Math.ceil((countRow?.total ?? 0) / limit),
    });
  } catch (err: any) {
    console.error("Attendance GET error:", err);
    return NextResponse.json({ error: "Failed to fetch attendance records" }, { status: 500 });
  }
}

// POST: Check In or Check Out
export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, staffId: targetStaffId, location, notes } = body;

    if (!action || !["CHECK_IN", "CHECK_OUT"].includes(action)) {
      return NextResponse.json({ error: "Invalid action. Must be CHECK_IN or CHECK_OUT." }, { status: 400 });
    }

    const today = getTodayDateStr();
    const nowTime = getCurrentTimeStr();

    let contractStaff: any = null;

    if (session.role === "STAFF") {
      contractStaff = await queryOne(
        `SELECT cs.*, u.is_active as user_active FROM contract_staff cs
         JOIN users u ON cs.user_id = u.id WHERE cs.user_id = ?`,
        [session.id]
      );
    } else {
      if (!targetStaffId) {
        return NextResponse.json({ error: "Target Staff ID is required" }, { status: 400 });
      }
      contractStaff = await queryOne(
        `SELECT cs.*, u.is_active as user_active FROM contract_staff cs
         JOIN users u ON cs.user_id = u.id WHERE cs.id = ? OR cs.staff_id = ?`,
        [targetStaffId, targetStaffId]
      );
    }

    if (!contractStaff) {
      return NextResponse.json({ error: "Contract staff record not found." }, { status: 404 });
    }

    if (contractStaff.status === "INACTIVE" || contractStaff.status === "TERMINATED" || contractStaff.user_active !== 1) {
      return NextResponse.json({
        error: `Staff member ${contractStaff.full_name} (${contractStaff.staff_id}) is currently deactivated/inactive. Attendance check-in is prohibited.`
      }, { status: 403 });
    }

    const existing = await queryOne(
      "SELECT * FROM attendance WHERE staff_id = ? AND date = ?",
      [contractStaff.id, today]
    );

    const approvedLeave = await queryOne(
      `SELECT * FROM leave_requests WHERE staff_id = ? AND status = 'APPROVED' AND ? BETWEEN start_date AND end_date`,
      [contractStaff.id, today]
    );

    if (approvedLeave && action === "CHECK_IN") {
      return NextResponse.json({
        error: `You have an approved leave for today. Check-in is not permitted.`
      }, { status: 400 });
    }

    const settings = await queryOne("SELECT * FROM attendance_settings LIMIT 1");
    const workStartTime = (settings as any)?.work_start_time || "08:00";
    const graceMinutes = (settings as any)?.late_grace_minutes ?? 15;
    const workStartMins = timeToMinutes(workStartTime);
    const lateThresholdMins = workStartMins + graceMinutes;
    const locString = location || "DVLA Official Terminal / Cantonments HQ";

    if (action === "CHECK_IN") {
      if (existing && (existing as any).check_in_time) {
        return NextResponse.json({
          error: `Check-in already completed today at ${(existing as any).check_in_time}. The system will not take attendance again today until check-out at 5:00 PM or tomorrow.`
        }, { status: 400 });
      }

      const currentMins = timeToMinutes(nowTime.substring(0, 5));
      const attStatus = currentMins > lateThresholdMins ? "LATE" : "PRESENT";
      const attId = existing ? (existing as any).id : `att-${Date.now()}`;

      if (existing) {
        await run(
          `UPDATE attendance SET check_in_time=?, status=?, check_in_location=?, notes=COALESCE(?,notes), updated_at=NOW() WHERE id=?`,
          [nowTime, attStatus, locString, notes || null, (existing as any).id]
        );
      } else {
        await run(
          `INSERT INTO attendance (id, staff_id, date, check_in_time, status, check_in_location, notes) VALUES (?,?,?,?,?,?,?)`,
          [attId, contractStaff.id, today, nowTime, attStatus, locString, notes || null]
        );
      }

      await logAudit(session.id, session.name, session.role, "ATTENDANCE_CHECK_IN",
        `Staff ${contractStaff.full_name} (${contractStaff.staff_id}) checked in at ${nowTime} (Status: ${attStatus}).`);
      await createNotification(contractStaff.user_id, "Check-in Successful",
        `Your check-in at ${nowTime} has been recorded successfully. Status: ${attStatus}.`,
        attStatus === "LATE" ? "WARNING" : "SUCCESS", "/staff/dashboard");

      return NextResponse.json({ success: true, message: `Check-in recorded at ${nowTime}`, status: attStatus, checkInTime: nowTime, date: today });
    }

    if (action === "CHECK_OUT") {
      if (!existing || !(existing as any).check_in_time) {
        return NextResponse.json({ error: "You cannot check out before checking in for today." }, { status: 400 });
      }
      if ((existing as any).check_out_time) {
        return NextResponse.json({
          error: `Check-out has already been completed today at ${(existing as any).check_out_time}. Attendance is complete for today. The system will not take attendance again until tomorrow.`
        }, { status: 400 });
      }

      const inMins = timeToMinutes((existing as any).check_in_time.substring(0, 5));
      const outMins = timeToMinutes(nowTime.substring(0, 5));
      const workingMinutes = Math.max(0, outMins - inMins);
      const halfDayLimit = ((settings as any)?.half_day_hours || 4) * 60;
      let finalStatus = (existing as any).status;
      if (workingMinutes < halfDayLimit) finalStatus = "HALF_DAY";

      await run(
        `UPDATE attendance SET check_out_time=?, working_minutes=?, status=?, check_out_location=?, updated_at=NOW() WHERE id=?`,
        [nowTime, workingMinutes, finalStatus, locString, (existing as any).id]
      );

      const hours = Math.floor(workingMinutes / 60);
      const minutes = workingMinutes % 60;
      const formattedDuration = `${hours}h ${minutes}m`;

      await logAudit(session.id, session.name, session.role, "ATTENDANCE_CHECK_OUT",
        `Staff ${contractStaff.full_name} (${contractStaff.staff_id}) checked out at ${nowTime}. Total hours: ${formattedDuration}.`);
      await createNotification(contractStaff.user_id, "Check-out Complete",
        `You checked out at ${nowTime}. Total duration logged today: ${formattedDuration}.`, "SUCCESS", "/staff/dashboard");

      return NextResponse.json({ success: true, message: `Check-out recorded at ${nowTime}`, checkOutTime: nowTime, workingMinutes, formattedDuration, status: finalStatus });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("Attendance POST error:", err);
    return NextResponse.json({ error: "Failed to record attendance: " + err.message }, { status: 500 });
  }
}

// PUT: Attendance Correction
export async function PUT(req: NextRequest) {
  try {
    await ensureSchema();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role === "STAFF") return NextResponse.json({ error: "Access denied. Contract staff cannot edit attendance records." }, { status: 403 });

    const body = await req.json();
    const { attendanceId, checkInTime, checkOutTime, status, reason, notes } = body;
    if (!attendanceId || !reason) {
      return NextResponse.json({ error: "Attendance ID and Correction Reason are required." }, { status: 400 });
    }

    const record = await queryOne<any>(
      `SELECT a.*, cs.staff_id, cs.full_name, cs.user_id FROM attendance a
       JOIN contract_staff cs ON a.staff_id = cs.id WHERE a.id = ?`,
      [attendanceId]
    );
    if (!record) return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });

    let workingMinutes = record.working_minutes;
    if (checkInTime && checkOutTime) {
      workingMinutes = Math.max(0, timeToMinutes(checkOutTime.substring(0, 5)) - timeToMinutes(checkInTime.substring(0, 5)));
    }

    const newStatus = status || record.status;
    await run(
      `UPDATE attendance SET
        check_in_time=COALESCE(?,check_in_time), check_out_time=COALESCE(?,check_out_time),
        working_minutes=?, status=?, is_corrected=1, corrected_by=?, correction_reason=?,
        notes=COALESCE(?,notes), updated_at=NOW()
       WHERE id=?`,
      [checkInTime || record.check_in_time, checkOutTime || record.check_out_time,
       workingMinutes, newStatus, session.name, reason, notes || null, attendanceId]
    );

    await logAudit(session.id, session.name, session.role, "ATTENDANCE_CORRECTION",
      `Attendance record for ${record.full_name} (${record.staff_id}) on ${record.date} was corrected by ${session.name}. Reason: "${reason}". Status: ${record.status} -> ${newStatus}.`);
    await createNotification(record.user_id, "Attendance Record Corrected",
      `Your attendance for ${record.date} was amended by administrator ${session.name}. Reason: ${reason}.`, "INFO", "/attendance");

    return NextResponse.json({ success: true, message: "Attendance record successfully corrected and logged." });
  } catch (err: any) {
    console.error("Attendance PUT error:", err);
    return NextResponse.json({ error: "Failed to correct attendance record" }, { status: 500 });
  }
}
