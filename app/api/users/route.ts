import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureSchema, queryAll, queryOne, run, logAudit } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  try {
    await ensureSchema();
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Access denied. Only administrators can view user accounts." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role");
    const search = searchParams.get("search");

    const whereClauses: string[] = [];
    const params: any[] = [];
    if (role && role !== "ALL") { whereClauses.push("u.role = ?"); params.push(role); }
    if (search) {
      whereClauses.push("(u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)");
      const term = `%${search}%`;
      params.push(term, term, term);
    }
    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const users = await queryAll(
      `SELECT u.id, u.name, u.email, u.role, u.phone, u.is_active, u.created_at,
              cs.staff_id, cs.position, d.name as department_name
       FROM users u
       LEFT JOIN contract_staff cs ON u.id = cs.user_id
       LEFT JOIN departments d ON cs.department_id = d.id
       ${whereSql}
       ORDER BY u.created_at DESC`,
      params
    );

    return NextResponse.json({ users });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, password, role, phone, departmentId, title } = body;
    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: "Name, email, password, and role are required." }, { status: 400 });
    }

    const existing = await queryOne("SELECT id FROM users WHERE LOWER(email) = LOWER(?)", [email.trim()]);
    if (existing) return NextResponse.json({ error: "A user with this email address already exists." }, { status: 400 });

    const userId = `user-${Date.now()}`;
    const hash = bcrypt.hashSync(password, 10);

    await run(
      "INSERT INTO users (id, email, password_hash, name, role, phone, is_active) VALUES (?,?,?,?,?,?,1)",
      [userId, email.trim(), hash, name.trim(), role, phone?.trim() || null]
    );

    await logAudit(session.id, session.name, session.role, "USER_CREATED",
      `Admin created user ${name} with role ${role} (${email}).`);

    return NextResponse.json({ success: true, message: `Account created for ${name} (${role})` });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to create user: " + err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await ensureSchema();
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const { userId, isActive } = await req.json();
    if (userId === session.id) {
      return NextResponse.json({ error: "You cannot deactivate your own administrative account." }, { status: 400 });
    }

    await run("UPDATE users SET is_active=?, updated_at=NOW() WHERE id=?", [isActive ? 1 : 0, userId]);
    const user = await queryOne<any>("SELECT name, email FROM users WHERE id = ?", [userId]);

    await logAudit(session.id, session.name, session.role,
      isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      `Admin ${isActive ? "activated" : "deactivated"} user ${user?.name || userId}.`);

    return NextResponse.json({ success: true, message: `User status changed to ${isActive ? "Active" : "Inactive"}` });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to update user status" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureSchema();
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "User ID is required." }, { status: 400 });
    }

    if (userId === session.id) {
      return NextResponse.json({ error: "You cannot delete your own administrative account." }, { status: 400 });
    }

    const targetUser = await queryOne<any>("SELECT name, email, role FROM users WHERE id = ?", [userId]);
    if (!targetUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const cs = await queryOne<any>("SELECT id FROM contract_staff WHERE user_id = ?", [userId]);
    if (cs) {
      await run("DELETE FROM attendance WHERE staff_id = ?", [cs.id]);
      await run("DELETE FROM leave_requests WHERE staff_id = ?", [cs.id]);
      await run("DELETE FROM contract_staff WHERE id = ?", [cs.id]);
    }
    await run("DELETE FROM supervisors WHERE user_id = ?", [userId]);
    await run("DELETE FROM notifications WHERE user_id = ?", [userId]);
    await run("DELETE FROM users WHERE id = ?", [userId]);

    // Also remove from MySQL if reachable
    try {
      const mysql = await import("mysql2/promise");
      const conn = await mysql.createConnection({
        uri: process.env.DATABASE_URL || "mysql://root@localhost:3306/dvla_contract_attendance"
      });
      if (cs) {
        await conn.query("DELETE FROM attendance WHERE staffId = ?", [cs.id]);
        await conn.query("DELETE FROM leaverequest WHERE staffId = ?", [cs.id]);
        await conn.query("DELETE FROM contractstaff WHERE id = ?", [cs.id]);
      }
      await conn.query("DELETE FROM notification WHERE userId = ?", [userId]);
      await conn.query("DELETE FROM user WHERE id = ?", [userId]);
      await conn.end();
    } catch {
      // Ignored if MySQL is idle
    }

    await logAudit(session.id, session.name, session.role, "USER_DELETED",
      `Admin deleted user ${targetUser.name} (${targetUser.email}).`);

    return NextResponse.json({ success: true, message: `User ${targetUser.name} has been deleted.` });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to delete user: " + err.message }, { status: 500 });
  }
}
