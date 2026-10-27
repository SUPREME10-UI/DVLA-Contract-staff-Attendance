import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureSchema, queryAll, queryOne } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    await ensureSchema();
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Access denied. Audit logs are restricted to system administrators." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const action = searchParams.get("action");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "50"));
    const offset = (page - 1) * limit;

    const whereClauses: string[] = [];
    const params: any[] = [];

    if (action && action !== "ALL") { whereClauses.push("action = ?"); params.push(action); }
    if (search) {
      whereClauses.push("(description LIKE ? OR user_name LIKE ? OR action LIKE ?)");
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const countRow = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM audit_logs ${whereSql}`, params
    );
    const logs = await queryAll(
      `SELECT * FROM audit_logs ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return NextResponse.json({
      logs,
      total: countRow?.total ?? 0,
      page,
      limit,
      totalPages: Math.ceil((countRow?.total ?? 0) / limit),
    });
  } catch (err: any) {
    console.error("Audit log error:", err);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}
