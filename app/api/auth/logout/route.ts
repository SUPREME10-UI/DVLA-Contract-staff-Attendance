import { NextRequest, NextResponse } from "next/server";
import { clearSession, getSession } from "@/lib/auth";
import { logAudit } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (session) {
      const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
      logAudit(
        session.id,
        session.name,
        session.role,
        "USER_LOGOUT",
        `User ${session.name} logged out.`,
        ip
      );
    }
    await clearSession();
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to logout" }, { status: 500 });
  }
}
