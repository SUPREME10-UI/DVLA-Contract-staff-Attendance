import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureSchema, queryAll, queryOne, run, logAudit } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (session.role === "STAFF") {
      return NextResponse.json({
        error: "Contract staff cannot manage personal credentials. Please contact your administrator."
      }, { status: 403 });
    }

    const { currentPassword, newPassword } = await req.json();
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const user = await queryOne<any>("SELECT password_hash FROM users WHERE id = ?", [session.id]);
    if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
      return NextResponse.json({ error: "Current password does not match" }, { status: 400 });
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    await run("UPDATE users SET password_hash=?, updated_at=NOW() WHERE id=?", [newHash, session.id]);

    await logAudit(session.id, session.name, session.role, "PASSWORD_CHANGED",
      `User ${session.name} updated their security password.`);

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
  }
}
