import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, queryAll, queryOne, run, logAudit, createNotification } from "@/lib/db";
import { getUserDetails, setSession } from "@/lib/auth";
import { findBestFaceMatch, parseFaceFeatures } from "@/lib/face-matcher";

export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const body = await req.json();
    const {
      identifier,
      biometricImage,
      faceFeatures,
      location = "DVLA Cantonments Terminal",
    } = body;

    let staff: any = null;
    let matchConfidence = 0;
    const cleanId = typeof identifier === "string" ? identifier.trim() : "";
    const incomingFeatures = parseFaceFeatures(faceFeatures);

    // A supplied identifier narrows recognition to that staff member only.
    // Without one, the terminal searches the enrolled active staff directory.
    let candidates: any[] = [];
    if (cleanId) {
      const target = await queryOne<any>(
        `SELECT cs.*, u.id as user_id, u.name as user_name, u.email as user_email, u.is_active as user_active,
                d.name as department_name
         FROM contract_staff cs
         JOIN users u ON cs.user_id = u.id
         LEFT JOIN departments d ON cs.department_id = d.id
         WHERE UPPER(cs.staff_id) = UPPER(?)
            OR LOWER(cs.email) = LOWER(?)
            OR LOWER(u.email) = LOWER(?)
            OR UPPER(cs.ghana_card) = UPPER(?)`,
        [cleanId, cleanId, cleanId, cleanId]
      );
      if (target) candidates = [target];
    } else {
      candidates = await queryAll(
        `SELECT cs.*, u.id as user_id, u.name as user_name, u.email as user_email, u.is_active as user_active,
                d.name as department_name
         FROM contract_staff cs
         JOIN users u ON cs.user_id = u.id
         LEFT JOIN departments d ON cs.department_id = d.id
         WHERE cs.status = 'ACTIVE' AND u.is_active = 1 AND cs.face_features IS NOT NULL`
      );
    }

    const matchResult = findBestFaceMatch(incomingFeatures, candidates, 0.45);
    if (matchResult) {
      staff = matchResult.staff;
      matchConfidence = Math.round(matchResult.score * 100);
    }

    if (!staff) {
      const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
      await logAudit(null, "Unregistered Face / Stranger", "VISITOR",
        "BIOMETRIC_ATTENDANCE_REJECTED",
        `Unregistered face scan attempted at ${location}. Biometrics not enrolled or did not match any active staff member.`,
        ip
      );
      return NextResponse.json({
        success: false,
        notRecognised: true,
        message: "Sorry, your face was not recognised. Your biometrics may not be enrolled on the system. Please contact an administrator.",
      }, { status: 200 });
    }

    if (staff.status === "INACTIVE" || staff.status === "TERMINATED" || staff.user_active !== 1) {
      return NextResponse.json({
        success: false,
        error: `Staff account for ${staff.full_name} is currently inactive. Please contact administration.`
      }, { status: 403 });
    }

    const today = new Date().toISOString().substring(0, 10);
    const nowHours = String(new Date().getHours()).padStart(2, "0");
    const nowMins = String(new Date().getMinutes()).padStart(2, "0");
    const nowSecs = String(new Date().getSeconds()).padStart(2, "0");
    const nowTime = `${nowHours}:${nowMins}:${nowSecs}`;
    const currentMins = parseInt(nowHours) * 60 + parseInt(nowMins);

    // Check if staff has approved leave today
    const approvedLeave = await queryOne<any>(
      `SELECT * FROM leave_requests WHERE staff_id = ? AND status = 'APPROVED' AND ? BETWEEN start_date AND end_date`,
      [staff.id, today]
    );
    if (approvedLeave) {
      return NextResponse.json({
        success: false,
        isOnLeave: true,
        staff: {
          id: staff.id,
          staffId: staff.staff_id,
          fullName: staff.full_name,
          department: staff.department_name || "DVLA Operations",
        },
        message: `Staff member ${staff.full_name} is on approved leave today until ${approvedLeave.end_date}. Attendance check-in is exempt.`
      }, { status: 200 });
    }

    const settings = await queryOne<any>("SELECT * FROM attendance_settings LIMIT 1");
    const workStartTime = settings?.work_start_time || "08:00";
    const workEndTime = settings?.work_end_time || "17:00";
    const graceMinutes = settings?.late_grace_minutes ?? 15;
    const [startH, startM] = workStartTime.split(":").map(Number);
    const [endH, endM] = workEndTime.split(":").map(Number);
    const lateThreshold = startH * 60 + (startM || 0) + graceMinutes;
    const checkoutThreshold = endH * 60 + (endM || 0); // 17:00 = 5:00 PM

    const incomingAction = (body as any).action;

    let attendanceRecord = await queryOne<any>(
      "SELECT * FROM attendance WHERE staff_id = ? AND date = ?",
      [staff.id, today]
    );

    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";

    // CASE 1: Attendance already checked in AND already checked out today
    if (attendanceRecord && attendanceRecord.check_in_time && attendanceRecord.check_out_time) {
      return NextResponse.json({
        success: false,
        alreadyCompleted: true,
        staff: {
          id: staff.id,
          staffId: staff.staff_id,
          fullName: staff.full_name,
          department: staff.department_name || "DVLA Operations",
          position: staff.position,
        },
        attendance: {
          date: today,
          checkInTime: attendanceRecord.check_in_time,
          checkOutTime: attendanceRecord.check_out_time,
          status: attendanceRecord.status,
          workingMinutes: attendanceRecord.working_minutes,
        },
        message: `Hello ${staff.full_name}, your attendance and check-out are already completed for today. The system will not take attendance again until tomorrow.`
      }, { status: 200 });
    }

    // CASE 2: Attendance already checked in today, but not checked out yet
    if (attendanceRecord && attendanceRecord.check_in_time) {
      // Allowed to check out if at/after 5:00 PM (17:00) OR explicitly requested CHECK_OUT
      if (currentMins >= checkoutThreshold || incomingAction === "CHECK_OUT") {
        const [inH, inM] = attendanceRecord.check_in_time.split(":").map(Number);
        const inTotalMins = inH * 60 + (inM || 0);
        const workingMinutes = Math.max(0, currentMins - inTotalMins);
        const halfDayLimit = (settings?.half_day_hours || 4) * 60;
        let finalStatus = attendanceRecord.status;
        if (workingMinutes < halfDayLimit) finalStatus = "HALF_DAY";

        await run(
          `UPDATE attendance SET check_out_time=?, working_minutes=?, status=?, check_out_location=?, updated_at=NOW() WHERE id=?`,
          [nowTime, workingMinutes, finalStatus, location, attendanceRecord.id]
        );

        const hours = Math.floor(workingMinutes / 60);
        const minutes = workingMinutes % 60;
        const formattedDuration = `${hours}h ${minutes}m`;

        await logAudit(staff.user_id, staff.full_name, "STAFF", "BIOMETRIC_ATTENDANCE_CHECK_OUT",
          `Staff ${staff.full_name} (${staff.staff_id}) checked out via biometric face scan at ${nowTime}. Total hours: ${formattedDuration}.`, ip);

        return NextResponse.json({
          success: true,
          action: "CHECK_OUT",
          matchConfidence: matchConfidence || 95,
          staff: {
            id: staff.id,
            staffId: staff.staff_id,
            fullName: staff.full_name,
            department: staff.department_name || "DVLA Operations",
            position: staff.position,
            ghanaCard: staff.ghana_card,
          },
          attendance: {
            date: today,
            time: nowTime,
            checkInTime: attendanceRecord.check_in_time,
            checkOutTime: nowTime,
            workingMinutes,
            formattedDuration,
            status: finalStatus,
            action: "CHECK_OUT",
            location
          },
          message: `Goodbye, ${staff.full_name}! Check-out recorded at ${nowTime}. Total hours: ${formattedDuration}.`,
          redirectUrl: "/staff/dashboard",
        });
      }

      // If before 5:00 PM, DO NOT take attendance again!
      return NextResponse.json({
        success: false,
        alreadyCheckedIn: true,
        staff: {
          id: staff.id,
          staffId: staff.staff_id,
          fullName: staff.full_name,
          department: staff.department_name || "DVLA Operations",
          position: staff.position,
        },
        attendance: {
          date: today,
          checkInTime: attendanceRecord.check_in_time,
          scheduledCheckout: workEndTime,
          status: attendanceRecord.status,
        },
        message: `Attendance already recorded today at ${attendanceRecord.check_in_time}. Scheduled check-out is at 5:00 PM.`
      }, { status: 200 });
    }

    // CASE 3: First attendance of the day -> Record CHECK IN
    const attStatus = currentMins > lateThreshold ? "LATE" : "PRESENT";
    const attId = `att-${Date.now()}`;
    await run(
      `INSERT INTO attendance (id, staff_id, date, check_in_time, status, check_in_location, biometric_verified, biometric_photo)
       VALUES (?,?,?,?,?,?,1,?)`,
      [attId, staff.id, today, nowTime, attStatus, location, biometricImage || null]
    );

    const sessionUser = await getUserDetails(staff.user_id);
    if (sessionUser) await setSession(sessionUser);

    await logAudit(staff.user_id, staff.full_name, "STAFF", "BIOMETRIC_ATTENDANCE_CHECK_IN",
      `Staff ${staff.full_name} (${staff.staff_id}) clocked in via biometric face scan at ${nowTime} (${attStatus}).`, ip);

    return NextResponse.json({
      success: true,
      action: "CHECK_IN",
      matchConfidence: matchConfidence || 95,
      staff: {
        id: staff.id,
        staffId: staff.staff_id,
        fullName: staff.full_name,
        department: staff.department_name || "DVLA Operations",
        position: staff.position,
        ghanaCard: staff.ghana_card,
      },
      attendance: { date: today, time: nowTime, status: attStatus, action: "CHECK_IN", location },
      message: `Welcome, ${staff.full_name}! Check-in recorded at ${nowTime} (${attStatus}).`,
      redirectUrl: "/staff/dashboard",
    });
  } catch (err: any) {
    console.error("Biometric verify error:", err);
    return NextResponse.json({ error: "Biometric verification failed: " + (err.message || "Unknown error") }, { status: 500 });
  }
}
