import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, queryOne, logAudit } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email address is required" }, { status: 400 });
    }

    const user = await queryOne<any>(
      "SELECT * FROM users WHERE LOWER(email) = LOWER(?)",
      [email.trim()]
    );

    if (user) {
      await logAudit(user.id, user.name, user.role, "PASSWORD_RESET_REQUEST",
        `Password reset link requested for email ${email}.`);
    }

    // Always respond with success to prevent user enumeration
    return NextResponse.json({
      success: true,
      message: "If an account exists with that email address, password reset instructions have been dispatched to your corporate inbox.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Unable to process password reset request" }, { status: 500 });
  }
}
