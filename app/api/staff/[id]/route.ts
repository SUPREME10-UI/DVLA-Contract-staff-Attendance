import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureSchema, queryAll, queryOne, run, logAudit } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const staff = await queryOne<any>(
      `SELECT cs.*, d.name as department_name, d.code as department_code,
              u.is_active as user_active
       FROM contract_staff cs
       JOIN users u ON cs.user_id = u.id
       JOIN departments d ON cs.department_id = d.id
       WHERE cs.id = ? OR cs.staff_id = ?`,
      [id, id]
    );

    if (!staff) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    if (session.role === "STAFF" && staff.user_id !== session.id) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const stats = await queryOne<any>(
      `SELECT COUNT(*) as total_days_recorded,
              SUM(CASE WHEN status='PRESENT' THEN 1 ELSE 0 END) as present_days,
              SUM(CASE WHEN status='LATE' THEN 1 ELSE 0 END) as late_days,
              SUM(CASE WHEN status='ABSENT' THEN 1 ELSE 0 END) as absent_days,
              SUM(CASE WHEN status='ON_LEAVE' THEN 1 ELSE 0 END) as leave_days,
              SUM(working_minutes) as total_working_minutes
       FROM attendance WHERE staff_id = ?`,
      [staff.id]
    );

    const recentAttendances = await queryAll("SELECT * FROM attendance WHERE staff_id = ? ORDER BY date DESC LIMIT 10", [staff.id]);
    const leaveHistory = await queryAll("SELECT * FROM leave_requests WHERE staff_id = ? ORDER BY created_at DESC", [staff.id]);

    return NextResponse.json({
      staff,
      stats: {
        totalDaysRecorded: stats?.total_days_recorded || 0,
        presentDays: stats?.present_days || 0,
        lateDays: stats?.late_days || 0,
        absentDays: stats?.absent_days || 0,
        leaveDays: stats?.leave_days || 0,
        totalHours: Math.round(((stats?.total_working_minutes || 0) / 60) * 10) / 10,
      },
      recentAttendances,
      leaveHistory,
    });
  } catch (err: any) {
    console.error("Staff detail GET error:", err);
    return NextResponse.json({ error: "Failed to fetch staff details" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Only administrators can edit staff information." }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { fullName, ghanaCard, phone, email, gender, dob, address, departmentId, position,
            contractStart, contractEnd, status } = body;

    const staff = await queryOne<any>("SELECT * FROM contract_staff WHERE id = ? OR staff_id = ?", [id, id]);
    if (!staff) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });

    await run(
      `UPDATE contract_staff SET
        full_name=COALESCE(?,full_name), ghana_card=COALESCE(?,ghana_card), phone=COALESCE(?,phone),
        email=COALESCE(?,email), gender=COALESCE(?,gender), dob=COALESCE(?,dob), address=COALESCE(?,address),
        department_id=COALESCE(?,department_id), position=COALESCE(?,position),
        contract_start=COALESCE(?,contract_start), contract_end=COALESCE(?,contract_end),
        status=COALESCE(?,status), updated_at=NOW()
       WHERE id=?`,
      [fullName, ghanaCard, phone, email, gender, dob, address, departmentId, position,
       contractStart, contractEnd, status, staff.id]
    );

    if (fullName || phone) {
      await run(
        "UPDATE users SET name=COALESCE(?,name), phone=COALESCE(?,phone), updated_at=NOW() WHERE id=?",
        [fullName, phone, staff.user_id]
      );
    }

    await logAudit(session.id, session.name, session.role, "STAFF_UPDATED",
      `Admin updated staff profile for ${staff.full_name} (${staff.staff_id}).`);

    return NextResponse.json({ success: true, message: "Staff information updated successfully." });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to update staff: " + err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Only administrators can change staff status." }, { status: 403 });
    }

    const { id } = await params;
    const { status, reason } = await req.json();

    if (!status || !["ACTIVE", "INACTIVE", "TERMINATED"].includes(status)) {
      return NextResponse.json({ error: "Invalid employment status." }, { status: 400 });
    }

    const staff = await queryOne<any>("SELECT * FROM contract_staff WHERE id = ? OR staff_id = ?", [id, id]);
    if (!staff) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });

    const isUserActive = status === "ACTIVE" ? 1 : 0;
    await run("UPDATE contract_staff SET status=?, updated_at=NOW() WHERE id=?", [status, staff.id]);
    await run("UPDATE users SET is_active=?, updated_at=NOW() WHERE id=?", [isUserActive, staff.user_id]);

    await logAudit(session.id, session.name, session.role,
      status === "ACTIVE" ? "STAFF_REACTIVATED" : "STAFF_DEACTIVATED",
      `Admin changed status of ${staff.full_name} (${staff.staff_id}) to ${status}. Reason: ${reason || "N/A"}`);

    return NextResponse.json({ success: true, message: `Staff member status updated to ${status}.`, status });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to update status: " + err.message }, { status: 500 });
  }
}
