import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, queryOne } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    await ensureSchema();
    const { searchParams } = new URL(req.url);
    const identifier = searchParams.get("identifier");

    if (!identifier) {
      return NextResponse.json({ exists: false, error: "Identifier required" }, { status: 400 });
    }

    const cleanId = identifier.trim();
    const staff = await queryOne<any>(
      `SELECT cs.id, cs.staff_id, cs.full_name, cs.email, cs.ghana_card, cs.position,
              d.name as department_name, cs.status, cs.avatar, cs.biometric_data
       FROM contract_staff cs
       LEFT JOIN departments d ON cs.department_id = d.id
       WHERE UPPER(cs.staff_id) = UPPER(?)
          OR LOWER(cs.email) = LOWER(?)
          OR UPPER(cs.ghana_card) = UPPER(?)`,
      [cleanId, cleanId, cleanId]
    );

    if (!staff) return NextResponse.json({ exists: false, isNew: true });

    return NextResponse.json({
      exists: true,
      isNew: false,
      staff: {
        id: staff.id,
        staffId: staff.staff_id,
        fullName: staff.full_name,
        email: staff.email,
        department: staff.department_name,
        position: staff.position,
        status: staff.status,
        hasBiometric: !!staff.biometric_data || !!staff.avatar,
      },
    });
  } catch (err: any) {
    console.error("Staff check error:", err);
    return NextResponse.json({ exists: false, error: "Internal error" }, { status: 500 });
  }
}
