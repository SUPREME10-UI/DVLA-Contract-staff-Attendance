import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureSchema, queryAll, queryOne, run } from "@/lib/db";

export async function GET() {
  try {
    await ensureSchema();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const notifications = await queryAll(
      "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30",
      [session.id]
    );
    const unreadRow = await queryOne<{ c: number }>(
      "SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0",
      [session.id]
    );

    return NextResponse.json({ notifications, unreadCount: unreadRow?.c ?? 0 });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await ensureSchema();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { notificationId, markAll } = await req.json();

    if (markAll) {
      await run("UPDATE notifications SET is_read = 1 WHERE user_id = ?", [session.id]);
    } else if (notificationId) {
      await run("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?", [notificationId, session.id]);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }
}
