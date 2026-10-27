import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureSchema, queryOne, run, logAudit } from "@/lib/db";

export async function GET() {
  try {
    await ensureSchema();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const org = await queryOne("SELECT * FROM organizations LIMIT 1");
    const settings = await queryOne("SELECT * FROM attendance_settings LIMIT 1");

    return NextResponse.json({ organization: org, settings });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await ensureSchema();
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Access denied. Only administrators can alter organization settings." }, { status: 403 });
    }

    const body = await req.json();
    const { workStartTime, workEndTime, lateGraceMinutes, halfDayHours, requireLocation, allowOvertime,
            orgName, orgAddress, orgPhone, orgEmail } = body;

    await run(
      `UPDATE attendance_settings SET
        work_start_time=COALESCE(?,work_start_time), work_end_time=COALESCE(?,work_end_time),
        late_grace_minutes=COALESCE(?,late_grace_minutes), half_day_hours=COALESCE(?,half_day_hours),
        require_location=COALESCE(?,require_location), allow_overtime=COALESCE(?,allow_overtime)
       WHERE id = (SELECT id FROM (SELECT id FROM attendance_settings LIMIT 1) t)`,
      [workStartTime, workEndTime,
       lateGraceMinutes !== undefined ? Number(lateGraceMinutes) : null,
       halfDayHours !== undefined ? Number(halfDayHours) : null,
       requireLocation !== undefined ? (requireLocation ? 1 : 0) : null,
       allowOvertime !== undefined ? (allowOvertime ? 1 : 0) : null]
    );

    if (orgName || orgAddress || orgPhone || orgEmail) {
      await run(
        `UPDATE organizations SET name=COALESCE(?,name), address=COALESCE(?,address),
         phone=COALESCE(?,phone), email=COALESCE(?,email)
         WHERE id = (SELECT id FROM (SELECT id FROM organizations LIMIT 1) t)`,
        [orgName, orgAddress, orgPhone, orgEmail]
      );
    }

    await logAudit(session.id, session.name, session.role, "SETTINGS_UPDATED",
      `Admin updated attendance configuration: Start=${workStartTime}, End=${workEndTime}, Grace=${lateGraceMinutes}m.`);

    return NextResponse.json({ success: true, message: "Settings updated successfully" });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to update settings: " + err.message }, { status: 500 });
  }
}
