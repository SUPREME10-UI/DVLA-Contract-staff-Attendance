import { NextResponse } from "next/server";
import { ensureSchema, queryAll } from "@/lib/db";

export async function GET() {
  try {
    await ensureSchema();
    const departments = await queryAll("SELECT id, name, code, description FROM departments ORDER BY name ASC");
    return NextResponse.json({ departments });
  } catch (err: any) {
    console.error("Departments API error:", err);
    return NextResponse.json({ error: "Failed to load departments" }, { status: 500 });
  }
}
