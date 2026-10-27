import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, setSession } from "@/lib/auth";
import { ensureSchema, logAudit } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const body = await req.json();
    const { identifier, password } = body;

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Please enter your email/Staff ID and password" },
        { status: 400 }
      );
    }

    const { user, error } = await authenticateUser(identifier, password);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "Authentication failed" },
        { status: 401 }
      );
    }

    await setSession(user);

    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    await logAudit(
      user.id,
      user.name,
      user.role,
      "USER_LOGIN",
      `User ${user.name} (${user.role}) logged in successfully via web portal.`,
      ip
    );

    let redirectUrl = "/admin/dashboard";
    if (user.role === "STAFF") redirectUrl = "/staff/dashboard";

    return NextResponse.json({ success: true, user, redirectUrl });
  } catch (err: any) {
    console.error("Login API error:", err);
    return NextResponse.json(
      { error: "Internal server error occurred" },
      { status: 500 }
    );
  }
}
