import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, queryOne, run, logAudit, createNotification } from "@/lib/db";
import { getUserDetails, setSession } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const body = await req.json();
    const {
      fullName, ghanaCard, phone, email, gender = "MALE", dob, address,
      departmentId, position = "Contract Staff", emergencyContact, emergencyPhone,
      password = "Staff@123", biometricImage, faceFeatures, registrationNotes,
    } = body;

    if (!fullName || !ghanaCard || !phone || !email) {
      return NextResponse.json({ error: "Full Name, Ghana Card, Phone, and Email are strictly required." }, { status: 400 });
    }

    // Check if staff already exists
    const existingStaff = await queryOne<any>(
      `SELECT cs.*, u.id as user_id FROM contract_staff cs
       JOIN users u ON cs.user_id = u.id
       WHERE UPPER(cs.ghana_card) = UPPER(?) OR LOWER(cs.email) = LOWER(?) OR LOWER(u.email) = LOWER(?)`,
      [ghanaCard.trim(), email.trim(), email.trim()]
    );

    if (existingStaff) {
      const featStr = faceFeatures ? (typeof faceFeatures === "string" ? faceFeatures : JSON.stringify(faceFeatures)) : null;
      await run(
        `UPDATE contract_staff SET avatar=COALESCE(?,avatar), biometric_data=COALESCE(?,biometric_data),
         face_features=COALESCE(?,face_features), biometric_captured_at=NOW(), phone=COALESCE(?,phone), updated_at=NOW()
         WHERE id=?`,
        [biometricImage || null, biometricImage || null, featStr, phone.trim(), existingStaff.id]
      );
      await run(
        "UPDATE users SET avatar=COALESCE(?,avatar), phone=COALESCE(?,phone), updated_at=NOW() WHERE id=?",
        [biometricImage || null, phone.trim(), existingStaff.user_id]
      );

      const sessionUser = await getUserDetails(existingStaff.user_id);
      if (sessionUser) await setSession(sessionUser);

      return NextResponse.json({
        success: true,
        message: `Welcome back, ${existingStaff.full_name}! Your face biometric has been updated.`,
        staff: { id: existingStaff.id, staffId: existingStaff.staff_id, fullName: existingStaff.full_name, email: existingStaff.email },
        user: sessionUser,
        redirectUrl: "/staff/dashboard",
      });
    }

    let finalDeptId = departmentId;
    if (!finalDeptId) {
      const firstDept = await queryOne<any>("SELECT id FROM departments ORDER BY name ASC LIMIT 1");
      finalDeptId = firstDept?.id || "dept-csl";
    }

    const countRow = await queryOne<{ c: number }>("SELECT COUNT(*) as c FROM contract_staff");
    const nextNum = ((countRow?.c ?? 0) + 1).toString().padStart(3, "0");
    const finalStaffId = `DVLA-CS-${nextNum}`;

    const userUuid = `user-${Date.now()}`;
    const staffUuid = `cs-${Date.now()}`;
    const passHash = bcrypt.hashSync(password || "Staff@123", 10);
    const contractStart = new Date().toISOString().substring(0, 10);
    const contractEnd = `${new Date().getFullYear() + 2}-12-31`;

    await run(
      "INSERT INTO users (id, email, password_hash, name, role, phone, avatar, is_active) VALUES (?,?,?,?,'STAFF',?,?,1)",
      [userUuid, email.trim().toLowerCase(), passHash, fullName.trim(), phone.trim(), biometricImage || null]
    );

    await run(
      `INSERT INTO contract_staff (id, staff_id, user_id, full_name, ghana_card, phone, email, gender, dob, address,
        department_id, position, contract_start, contract_end, status, avatar, biometric_data,
        biometric_captured_at, face_features, is_new_registration, emergency_contact, emergency_phone, registration_notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'ACTIVE',?,?,?,?,1,?,?,?)`,
      [staffUuid, finalStaffId, userUuid, fullName.trim(), ghanaCard.trim().toUpperCase(),
       phone.trim(), email.trim().toLowerCase(), gender, dob || null, address || null,
       finalDeptId, position.trim(), contractStart, contractEnd,
       biometricImage || null, biometricImage || null,
       biometricImage ? new Date() : null,
       faceFeatures ? (typeof faceFeatures === "string" ? faceFeatures : JSON.stringify(faceFeatures)) : null,
       emergencyContact || null, emergencyPhone || null,
       registrationNotes || "Self-enrolled via customer web biometric terminal"]
    );

    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    await logAudit(userUuid, fullName.trim(), "STAFF", "NEW_STAFF_BIOMETRIC_REGISTERED",
      `New contract staff self-enrolled via web biometric camera: ${fullName} (${finalStaffId}, Ghana Card: ${ghanaCard}).`, ip);

    await createNotification("user-admin", "New Contract Staff Registration",
      `New staff member ${fullName} (${finalStaffId}) submitted biometric enrollment and profile details.`, "SUCCESS", "/staff");

    const sessionUser = await getUserDetails(userUuid);
    if (sessionUser) await setSession(sessionUser);

    return NextResponse.json({
      success: true,
      message: `Thank you, ${fullName}! Your biometric enrollment and staff registration have been saved.`,
      staff: { id: staffUuid, staffId: finalStaffId, fullName: fullName.trim(), email: email.trim() },
      user: sessionUser,
      redirectUrl: "/staff/dashboard",
    });
  } catch (err: any) {
    console.error("Staff registration API error:", err);
    return NextResponse.json({ error: "Failed to save registration: " + (err.message || "Unknown error") }, { status: 500 });
  }
}
