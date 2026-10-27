import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { queryAll, queryOne, ensureSchema } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureSchema();

    const { searchParams } = new URL(req.url);
    const todayIso = new Date().toISOString().substring(0, 10);
    const dateParam = searchParams.get("date") || todayIso;

    // 1. If user is CONTRACT STAFF
    if (session.role === "STAFF") {
      const staff = await queryOne(`
        SELECT cs.*, d.name as department_name
        FROM contract_staff cs
        JOIN departments d ON cs.department_id = d.id
        WHERE cs.user_id = ?
      `, [session.id]);

      if (!staff) {
        return NextResponse.json({ error: "Staff record not found" }, { status: 404 });
      }

      const todayRecord = await queryOne(`
        SELECT * FROM attendance WHERE staff_id = ? AND date = ?
      `, [staff.id, dateParam]);

      const todayLeave = await queryOne(`
        SELECT * FROM leave_requests 
        WHERE staff_id = ? AND status = 'APPROVED' AND ? BETWEEN start_date AND end_date
      `, [staff.id, dateParam]);

      const stats = await queryOne(`
        SELECT 
          count(*) as total_records,
          sum(case when status = 'PRESENT' then 1 else 0 end) as total_present,
          sum(case when status = 'LATE' then 1 else 0 end) as total_late,
          sum(case when status = 'ABSENT' then 1 else 0 end) as total_absent,
          sum(case when status = 'ON_LEAVE' then 1 else 0 end) as total_leave,
          sum(working_minutes) as total_working_minutes
        FROM attendance
        WHERE staff_id = ?
      `, [staff.id]);

      const recentAttendances = await queryAll(`
        SELECT * FROM attendance WHERE staff_id = ? ORDER BY date DESC LIMIT 7
      `, [staff.id]);

      return NextResponse.json({
        role: "STAFF",
        staff,
        today: {
          date: dateParam,
          record: todayRecord || null,
          isOnLeave: !!todayLeave,
          leaveDetails: todayLeave || null
        },
        stats: {
          totalDaysWorked: ((stats?.total_present || 0) as number) + ((stats?.total_late || 0) as number),
          totalPresent: stats?.total_present || 0,
          totalLate: stats?.total_late || 0,
          totalAbsent: stats?.total_absent || 0,
          totalLeave: stats?.total_leave || 0,
          totalHoursWorked: Math.round((((stats?.total_working_minutes || 0) as number) / 60) * 10) / 10
        },
        recentAttendances
      });
    }

    // 2. ADMIN Dashboard
    // Total staff count
    const totalStaffRow = await queryOne(`SELECT count(*) as c FROM contract_staff cs`);
    const totalStaff = (totalStaffRow?.c as number) || 0;

    // Active staff count
    const activeStaffRow = await queryOne(`SELECT count(*) as c FROM contract_staff cs WHERE cs.status = 'ACTIVE'`);
    const activeStaffCount = (activeStaffRow?.c as number) || 0;

    // Today's attendance breakdown
    const todayAttendance = await queryAll(
      `SELECT a.*, cs.staff_id, cs.full_name, cs.position, cs.status as staff_status,
         d.name as department_name
       FROM attendance a
       JOIN contract_staff cs ON a.staff_id = cs.id
       JOIN departments d ON cs.department_id = d.id
       WHERE a.date = ?
       ORDER BY a.check_in_time DESC`,
      [dateParam]
    );

    let presentToday = 0, lateToday = 0, onLeaveToday = 0, currentlyCheckedIn = 0, totalMinutesToday = 0;
    for (const rec of todayAttendance) {
      if (rec.status === "PRESENT" || rec.status === "EARLY") presentToday++;
      if (rec.status === "LATE") lateToday++;
      if (rec.status === "ON_LEAVE") onLeaveToday++;
      if (rec.check_in_time && !rec.check_out_time) currentlyCheckedIn++;
      totalMinutesToday += (rec.working_minutes as number) || 0;
    }
    const recordedStaffCount = todayAttendance.length;
    const absentToday = Math.max(0, activeStaffCount - recordedStaffCount);

    // 7-day trend
    const baseDate = new Date(dateParam + "T00:00:00");
    const past7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().substring(0, 10);
    });

    const trendData = await Promise.all(past7Days.map(async (d) => {
      const dayRecords = await queryAll(
        `SELECT a.status FROM attendance a JOIN contract_staff cs ON a.staff_id = cs.id WHERE a.date = ?`,
        [d]
      );
      const p = dayRecords.filter(r => r.status === "PRESENT" || r.status === "EARLY").length;
      const l = dayRecords.filter(r => r.status === "LATE").length;
      const lv = dayRecords.filter(r => r.status === "ON_LEAVE").length;
      const dayName = new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
      return { date: d, dayName, present: p, late: l, onLeave: lv, total: dayRecords.length };
    }));

    // Attendance by department
    const deptBreakdown = await queryAll(`
      SELECT 
        d.id, d.name, d.code,
        count(distinct cs.id) as staff_count,
        sum(case when a.date = ? AND a.status IN ('PRESENT', 'LATE') then 1 else 0 end) as attended_today
      FROM departments d
      LEFT JOIN contract_staff cs ON d.id = cs.department_id AND cs.status = 'ACTIVE'
      LEFT JOIN attendance a ON cs.id = a.staff_id AND a.date = ?
      GROUP BY d.id, d.name, d.code
      ORDER BY d.name ASC
    `, [dateParam, dateParam]);

    // Recent audit activity
    const recentActivity = await queryAll(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 6`);

    // Pending leaves
    const pendingLeavesRow = await queryOne(
      `SELECT count(*) as c FROM leave_requests WHERE status = 'PENDING'`
    );

    // Who has not checked in today
    const checkedInStaffIds = todayAttendance.map(a => a.staff_id as string);
    let notCheckedInStaff: any[] = [];
    if (activeStaffCount > 0) {
      const allActiveStaff = await queryAll(
        `SELECT cs.id, cs.staff_id, cs.full_name, cs.phone, cs.position,
           d.name as department_name
         FROM contract_staff cs
         JOIN departments d ON cs.department_id = d.id
         WHERE cs.status = 'ACTIVE'`
      );
      notCheckedInStaff = allActiveStaff.filter(s => !checkedInStaffIds.includes(s.staff_id as string) && !checkedInStaffIds.includes(s.id as string));
    }

    const newRegistrationsRow = await queryOne("SELECT count(*) as c FROM contract_staff WHERE is_new_registration = 1");

    return NextResponse.json({
      role: session.role,
      date: dateParam,
      stats: {
        totalStaff,
        activeStaff: activeStaffCount,
        presentToday,
        lateToday,
        absentToday,
        currentlyCheckedIn,
        onLeaveToday,
        totalHoursWorkedToday: Math.round((totalMinutesToday / 60) * 10) / 10,
        pendingLeavesCount: (pendingLeavesRow?.c as number) || 0,
        newRegistrationsCount: (newRegistrationsRow?.c as number) || 0
      },
      trendData,
      deptBreakdown,
      todayAttendance,
      notCheckedInStaff,
      recentActivity
    });
  } catch (err: any) {
    console.error("Dashboard GET error:", err);
    return NextResponse.json({ error: "Failed to fetch dashboard data: " + (err?.message || err) }, { status: 500 });
  }
}
