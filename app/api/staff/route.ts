import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureSchema, queryAll, queryOne, run, logAudit } from "@/lib/db";
import bcrypt from "bcryptjs";
import { findBestFaceMatch, hasValidFaceDescriptor, parseFaceFeatures } from "@/lib/face-matcher";

export async function GET(req: NextRequest) {
  try {
    await ensureSchema();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get("departmentId");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const isNewFilter = searchParams.get("isNew");

    const whereClauses: string[] = [];
    const params: any[] = [];

    if (departmentId && departmentId !== "ALL") { whereClauses.push("cs.department_id = ?"); params.push(departmentId); }
    if (status && status !== "ALL") { whereClauses.push("cs.status = ?"); params.push(status); }
    if (isNewFilter === "true" || isNewFilter === "1") { whereClauses.push("cs.is_new_registration = 1"); }
    if (search) {
      whereClauses.push("(cs.full_name LIKE ? OR cs.staff_id LIKE ? OR cs.email LIKE ? OR cs.ghana_card LIKE ?)");
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const staffList = await queryAll(
      `SELECT cs.id, cs.staff_id, cs.user_id, cs.full_name, cs.ghana_card, cs.phone, cs.email,
              cs.gender, cs.dob, cs.address, cs.position, cs.contract_start, cs.contract_end,
              cs.status, cs.avatar, cs.biometric_data, cs.face_features, cs.biometric_captured_at,
              cs.is_new_registration, cs.emergency_contact, cs.emergency_phone, cs.registration_notes, cs.created_at,
              d.id as department_id, d.name as department_name, d.code as department_code
       FROM contract_staff cs
       JOIN departments d ON cs.department_id = d.id
       ${whereSql}
       ORDER BY cs.is_new_registration DESC, cs.staff_id ASC`,
      params
    );

    const staffWithBiometricStatus = staffList.map((s: any) => ({
      ...s,
      has_face_descriptor: hasValidFaceDescriptor(s.face_features),
    }));

    const departments = await queryAll("SELECT id, name, code FROM departments ORDER BY name ASC");

    return NextResponse.json({ staff: staffWithBiometricStatus, total: staffWithBiometricStatus.length, departments });
  } catch (err: any) {
    console.error("Staff GET error:", err);
    return NextResponse.json({ error: "Failed to fetch staff directory" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Access denied. Only administrators can add contract staff." }, { status: 403 });
    }

    const body = await req.json();
    const { fullName, ghanaCard, phone, email, gender = "MALE", dob, address, departmentId, position,
            contractStart, contractEnd, customStaffId, biometricImage, faceFeatures } = body;

    if (!fullName || !ghanaCard || !phone || !email || !departmentId || !position || !contractStart || !contractEnd) {
      return NextResponse.json({ error: "Please fill in all required staff fields." }, { status: 400 });
    }

    const parsedFeatures = parseFaceFeatures(faceFeatures);
    if ((biometricImage || faceFeatures) && (!biometricImage || !hasValidFaceDescriptor(parsedFeatures))) {
      return NextResponse.json({ error: "A clear, unique face must be detected before biometric enrollment." }, { status: 400 });
    }

    const existingEmail = await queryOne("SELECT id FROM users WHERE LOWER(email) = LOWER(?)", [email.trim()]);
    if (existingEmail) return NextResponse.json({ error: "A user with this email address already exists." }, { status: 400 });

    const existingCard = await queryOne("SELECT id FROM contract_staff WHERE UPPER(ghana_card) = UPPER(?)", [ghanaCard.trim()]);
    if (existingCard) return NextResponse.json({ error: "A staff member with this Ghana Card number already exists." }, { status: 400 });

    let finalStaffId = customStaffId?.trim().toUpperCase();
    if (!finalStaffId) {
      const countRow = await queryOne<{ c: number }>("SELECT COUNT(*) as c FROM contract_staff");
      const nextNum = ((countRow?.c ?? 0) + 1).toString().padStart(3, "0");
      finalStaffId = `DVLA-CS-${nextNum}`;
    }

    const staffUuid = `cs-${Date.now()}`;
    const userUuid = `user-${Date.now()}`;
    const passHash = bcrypt.hashSync("Staff@123", 10);

    if (parsedFeatures) {
      const enrolledStaff = await queryAll("SELECT id, staff_id, full_name, face_features, biometric_data FROM contract_staff WHERE status = 'ACTIVE' AND face_features IS NOT NULL");
      const duplicateMatch = findBestFaceMatch(parsedFeatures, enrolledStaff, 0.45);
      if (duplicateMatch) {
        return NextResponse.json({
          error: `This face is already enrolled to ${duplicateMatch.staff.full_name} (${duplicateMatch.staff.staff_id}). Each staff member must have their own biometric.`
        }, { status: 409 });
      }
    }

    const featStr = parsedFeatures ? JSON.stringify(parsedFeatures) : null;
    const capturedAt = (biometricImage || featStr) ? new Date() : null;

    await run(
      "INSERT INTO users (id, email, password_hash, name, role, phone, avatar, is_active) VALUES (?, ?, ?, ?, 'STAFF', ?, ?, 1)",
      [userUuid, email.trim(), passHash, fullName.trim(), phone.trim(), biometricImage || null]
    );

    await run(
      `INSERT INTO contract_staff (id, staff_id, user_id, full_name, ghana_card, phone, email, gender, dob,
        address, department_id, position, contract_start, contract_end, status,
        avatar, biometric_data, face_features, biometric_captured_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'ACTIVE',?,?,?,?)`,
      [staffUuid, finalStaffId, userUuid, fullName.trim(), ghanaCard.trim(), phone.trim(), email.trim(),
       gender, dob || null, address || null, departmentId, position.trim(), contractStart, contractEnd,
       biometricImage || null, biometricImage || null, featStr, capturedAt]
    );

    await logAudit(session.id, session.name, session.role,
      biometricImage ? "STAFF_ENROLLED_WITH_BIOMETRIC" : "STAFF_CREATED",
      `Admin added new contract staff: ${fullName} (Staff ID: ${finalStaffId}, Ghana Card: ${ghanaCard})${biometricImage ? " with facial biometric credentials enrolled." : "."}`
    );

    return NextResponse.json({
      success: true,
      message: `Contract staff ${fullName} (${finalStaffId}) registered successfully${biometricImage ? " with face biometrics enrolled" : ""}. Default password: Staff@123`,
      staffId: finalStaffId,
      id: staffUuid,
      hasBiometric: hasValidFaceDescriptor(parsedFeatures),
    });
  } catch (err: any) {
    console.error("Staff POST error:", err);
    return NextResponse.json({ error: "Failed to create contract staff: " + err.message }, { status: 500 });
  }
}
