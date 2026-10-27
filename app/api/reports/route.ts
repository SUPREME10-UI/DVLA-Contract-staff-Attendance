import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureSchema, queryAll, queryOne } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    await ensureSchema();
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Access denied. Only administrators can generate reports." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const reportType = searchParams.get("type") || "DAILY";
    const now = new Date();
    const defaultEnd = now.toISOString().substring(0, 10);
    const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const startDate = searchParams.get("startDate") || defaultStart;
    const endDate = searchParams.get("endDate") || defaultEnd;
    const departmentId = searchParams.get("departmentId");
    const staffId = searchParams.get("staffId");

    const org = await queryOne<any>("SELECT * FROM organizations LIMIT 1");

    const whereClauses: string[] = ["a.date >= ?", "a.date <= ?"];
    const params: any[] = [startDate, endDate];

    if (departmentId && departmentId !== "ALL") { whereClauses.push("cs.department_id = ?"); params.push(departmentId); }
    if (staffId && staffId !== "ALL") { whereClauses.push("(cs.id = ? OR cs.staff_id = ?)"); params.push(staffId, staffId); }
    if (reportType === "LATE") { whereClauses.push("a.status = 'LATE'"); }
    else if (reportType === "ABSENCE") { whereClauses.push("a.status = 'ABSENT'"); }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const rawRecords = await queryAll(
      `SELECT a.id, a.date, a.check_in_time, a.check_out_time, a.working_minutes, a.status,
              a.check_in_location, a.is_corrected, a.correction_reason,
              cs.staff_id, cs.full_name, cs.ghana_card, cs.position,
              d.name as department_name, d.code as department_code
       FROM attendance a
       JOIN contract_staff cs ON a.staff_id = cs.id
       JOIN departments d ON cs.department_id = d.id
       ${whereSql}
       ORDER BY a.date DESC, cs.full_name ASC`,
      params
    );

    let totalPresent = 0, totalLate = 0, totalAbsent = 0, totalLeave = 0, totalHalfDay = 0, totalMinutes = 0;
    for (const r of rawRecords) {
      if ((r as any).status === "PRESENT" || (r as any).status === "EARLY") totalPresent++;
      else if ((r as any).status === "LATE") totalLate++;
      else if ((r as any).status === "ABSENT") totalAbsent++;
      else if ((r as any).status === "ON_LEAVE") totalLeave++;
      else if ((r as any).status === "HALF_DAY") totalHalfDay++;
      totalMinutes += (r as any).working_minutes || 0;
    }

    return NextResponse.json({
      organization: {
        name: org?.name || "Driver and Vehicle Licensing Authority (DVLA)",
        address: org?.address || "Cantonments, Accra, Ghana",
        phone: org?.phone || "+233 30 274 6760",
        email: org?.email || "info@dvla.gov.gh",
      },
      meta: { reportType, startDate, endDate, generatedAt: new Date().toISOString(), generatedBy: session.name, generatedRole: session.role },
      summary: { totalRecords: rawRecords.length, totalPresent, totalLate, totalAbsent, totalLeave, totalHalfDay, totalHours: Math.round((totalMinutes / 60) * 10) / 10 },
      records: rawRecords,
    });
  } catch (err: any) {
    console.error("Reports API error:", err);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
