import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureSchema, queryAll, queryOne, run, logAudit, createNotification } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    await ensureSchema();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const whereClauses: string[] = [];
    const params: any[] = [];

    if (session.role === "STAFF") {
      whereClauses.push("cs.user_id = ?"); params.push(session.id);
    }
    if (status && status !== "ALL") { whereClauses.push("lr.status = ?"); params.push(status); }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const requests = await queryAll(
      `SELECT lr.*, cs.staff_id, cs.full_name, cs.phone, cs.email, cs.position,
              d.name as department_name
       FROM leave_requests lr
       JOIN contract_staff cs ON lr.staff_id = cs.id
       JOIN departments d ON cs.department_id = d.id
       ${whereSql}
       ORDER BY lr.created_at DESC`,
      params
    );

    return NextResponse.json({ requests });
  } catch (err: any) {
    console.error("Leave GET error:", err);
    return NextResponse.json({ error: "Failed to fetch leave requests" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { leaveType, startDate, endDate, reason, staffId: targetStaffId } = body;

    if (!leaveType || !startDate || !endDate || !reason) {
      return NextResponse.json({ error: "Please fill in all leave request fields." }, { status: 400 });
    }
    if (startDate > endDate) {
      return NextResponse.json({ error: "Start date cannot be after end date." }, { status: 400 });
    }

    let contractStaff: any = null;
    if (session.role === "STAFF") {
      contractStaff = await queryOne("SELECT * FROM contract_staff WHERE user_id = ?", [session.id]);
    } else {
      contractStaff = await queryOne("SELECT * FROM contract_staff WHERE id = ? OR staff_id = ?", [targetStaffId, targetStaffId]);
    }
    if (!contractStaff) return NextResponse.json({ error: "Staff member record not found." }, { status: 404 });

    const reqId = `leave-${Date.now()}`;
    await run(
      "INSERT INTO leave_requests (id, staff_id, leave_type, start_date, end_date, reason, status) VALUES (?,?,?,?,?,?,'PENDING')",
      [reqId, (contractStaff as any).id, leaveType, startDate, endDate, reason.trim()]
    );

    await logAudit(session.id, session.name, session.role, "LEAVE_REQUESTED",
      `Staff ${(contractStaff as any).full_name} (${(contractStaff as any).staff_id}) submitted a ${leaveType} leave request from ${startDate} to ${endDate}.`);

    const admins = await queryAll("SELECT id FROM users WHERE role = 'ADMIN'");
    for (const u of admins) {
      await createNotification((u as any).id, "New Leave Request Submitted",
        `${(contractStaff as any).full_name} submitted a ${leaveType} leave request (${startDate} to ${endDate}).`, "INFO", "/leave");
    }

    return NextResponse.json({ success: true, message: "Leave application submitted successfully." });
  } catch (err: any) {
    console.error("Leave POST error:", err);
    return NextResponse.json({ error: "Failed to submit leave request: " + err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await ensureSchema();
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Access denied. Only administrators can approve/reject leave." }, { status: 403 });
    }

    const body = await req.json();
    const { requestId, status, rejectionReason } = body;
    if (!requestId || !status || !["APPROVED", "REJECTED"].includes(status)) {
      return NextResponse.json({ error: "Invalid leave request update data." }, { status: 400 });
    }

    const leaveReq = await queryOne<any>(
      `SELECT lr.*, cs.staff_id, cs.full_name, cs.user_id FROM leave_requests lr
       JOIN contract_staff cs ON lr.staff_id = cs.id WHERE lr.id = ?`,
      [requestId]
    );
    if (!leaveReq) return NextResponse.json({ error: "Leave request not found." }, { status: 404 });

    await run(
      "UPDATE leave_requests SET status=?, approved_by=?, rejection_reason=?, updated_at=NOW() WHERE id=?",
      [status, session.name, rejectionReason || null, requestId]
    );

    if (status === "APPROVED") {
      const start = new Date(leaveReq.start_date);
      const end = new Date(leaveReq.end_date);
      const curr = new Date(start);
      while (curr <= end) {
        const dayOfWeek = curr.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          const dateStr = curr.toISOString().split("T")[0];
          const existingAtt = await queryOne<any>("SELECT id FROM attendance WHERE staff_id = ? AND date = ?", [leaveReq.staff_id, dateStr]);
          if (existingAtt) {
            await run(
              "UPDATE attendance SET status='ON_LEAVE', notes=?, updated_at=NOW() WHERE id=?",
              [`Approved ${leaveReq.leave_type} Leave (Ref: ${leaveReq.id})`, existingAtt.id]
            );
          } else {
            const attId = `att-leave-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
            await run(
              "INSERT INTO attendance (id, staff_id, date, status, notes) VALUES (?,?,?,'ON_LEAVE',?)",
              [attId, leaveReq.staff_id, dateStr, `Approved ${leaveReq.leave_type} Leave (Ref: ${leaveReq.id})`]
            );
          }
        }
        curr.setDate(curr.getDate() + 1);
      }
    }

    await logAudit(session.id, session.name, session.role,
      status === "APPROVED" ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
      `${session.name} (${session.role}) ${status.toLowerCase()} leave request for ${leaveReq.full_name} (${leaveReq.leave_type}, ${leaveReq.start_date} to ${leaveReq.end_date}).`);

    await createNotification(leaveReq.user_id, `Leave Request ${status}`,
      `Your ${leaveReq.leave_type} leave from ${leaveReq.start_date} to ${leaveReq.end_date} has been ${status.toLowerCase()} by ${session.name}.${rejectionReason ? ` Reason: ${rejectionReason}` : ""}`,
      status === "APPROVED" ? "SUCCESS" : "ALERT", "/leave");

    return NextResponse.json({ success: true, message: `Leave request has been ${status.toLowerCase()} successfully.` });
  } catch (err: any) {
    console.error("Leave PUT error:", err);
    return NextResponse.json({ error: "Failed to update leave request: " + err.message }, { status: 500 });
  }
}
