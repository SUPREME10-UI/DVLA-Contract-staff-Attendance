import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureSchema, queryAll, queryOne, run, logAudit, createNotification } from "@/lib/db";
import { findBestFaceMatch, hasValidFaceDescriptor, parseFaceFeatures } from "@/lib/face-matcher";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Only administrators can access biometric records." }, { status: 403 });
    }

    const { id } = await params;
    const staff = await queryOne<any>(
      `SELECT cs.id, cs.staff_id, cs.full_name, cs.avatar, cs.biometric_data, cs.face_features,
              cs.biometric_captured_at, d.name as department_name
       FROM contract_staff cs
       JOIN departments d ON cs.department_id = d.id
       WHERE cs.id = ? OR cs.staff_id = ?`,
      [id, id]
    );

    if (!staff) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });

    return NextResponse.json({
      staffId: staff.staff_id,
      fullName: staff.full_name,
      department: staff.department_name,
      hasBiometric: hasValidFaceDescriptor(staff.face_features),
      hasFaceFeatures: hasValidFaceDescriptor(staff.face_features),
      capturedAt: staff.biometric_captured_at || null,
      avatarPreview: staff.avatar || staff.biometric_data || null,
    });
  } catch (err: any) {
    console.error("Biometric GET error:", err);
    return NextResponse.json({ error: "Failed to fetch biometric record." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Only administrators can enroll staff biometrics." }, { status: 403 });
    }

    const { id } = await params;
    const { biometricImage, faceFeatures } = await req.json();

    if (!biometricImage) return NextResponse.json({ error: "Biometric image is required." }, { status: 400 });

    const parsedFeatures = parseFaceFeatures(faceFeatures);
    if (!hasValidFaceDescriptor(parsedFeatures)) {
      return NextResponse.json({ error: "A clear face must be detected before biometric enrollment." }, { status: 400 });
    }

    const staff = await queryOne<any>(
      `SELECT cs.*, u.id as user_id FROM contract_staff cs
       JOIN users u ON cs.user_id = u.id WHERE cs.id = ? OR cs.staff_id = ?`,
      [id, id]
    );
    if (!staff) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });

    const otherEnrolledStaff = await queryAll(
      "SELECT id, staff_id, full_name, face_features, biometric_data FROM contract_staff WHERE id != ? AND status = 'ACTIVE' AND face_features IS NOT NULL",
      [staff.id]
    );
    const duplicateMatch = findBestFaceMatch(parsedFeatures, otherEnrolledStaff, 0.45);
    if (duplicateMatch) {
      return NextResponse.json({
        error: `This face is already enrolled to ${duplicateMatch.staff.full_name} (${duplicateMatch.staff.staff_id}).`
      }, { status: 409 });
    }

    const featStr = JSON.stringify(parsedFeatures);
    const isFirstCapture = !(staff.biometric_data || staff.face_features);

    await run(
      `UPDATE contract_staff SET biometric_data=?, face_features=?, avatar=?, biometric_captured_at=NOW(), updated_at=NOW() WHERE id=?`,
      [biometricImage, featStr, biometricImage, staff.id]
    );
    await run("UPDATE users SET avatar=?, updated_at=NOW() WHERE id=?", [biometricImage, staff.user_id]);

    await logAudit(session.id, session.name, session.role,
      isFirstCapture ? "BIOMETRIC_ENROLLED" : "BIOMETRIC_UPDATED",
      `Admin ${session.name} ${isFirstCapture ? "enrolled" : "updated"} biometric face data for ${staff.full_name} (${staff.staff_id}).`);

    await createNotification(staff.user_id,
      isFirstCapture ? "Biometric Face Enrolled" : "Biometric Face Updated",
      isFirstCapture
        ? "Your biometric face data has been enrolled by admin. You can now check in automatically at the terminal."
        : `Your biometric face data has been updated by admin ${session.name}.`,
      "SUCCESS", "/staff/dashboard");

    return NextResponse.json({
      success: true,
      firstCapture: isFirstCapture,
      message: isFirstCapture
        ? `Biometric enrolled successfully for ${staff.full_name}.`
        : `Biometric updated successfully for ${staff.full_name}.`,
    });
  } catch (err: any) {
    console.error("Biometric POST error:", err);
    return NextResponse.json({ error: "Failed to save biometric: " + err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Only administrators can delete staff biometrics." }, { status: 403 });
    }

    const { id } = await params;
    const staff = await queryOne<any>(
      `SELECT cs.*, u.id as user_id FROM contract_staff cs
       JOIN users u ON cs.user_id = u.id WHERE cs.id = ? OR cs.staff_id = ?`,
      [id, id]
    );
    if (!staff) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
    if (!staff.biometric_data && !staff.face_features) {
      return NextResponse.json({ error: "This staff member has no biometric data on record." }, { status: 400 });
    }

    await run(
      "UPDATE contract_staff SET biometric_data=NULL, face_features=NULL, biometric_captured_at=NULL, updated_at=NOW() WHERE id=?",
      [staff.id]
    );

    await logAudit(session.id, session.name, session.role, "BIOMETRIC_DELETED",
      `Admin ${session.name} deleted biometric face data for ${staff.full_name} (${staff.staff_id}).`);

    await createNotification(staff.user_id, "Biometric Data Removed",
      "Your biometric face data has been removed by admin. Please contact administration to re-enroll.", "WARNING", "/staff/dashboard");

    return NextResponse.json({ success: true, message: `Biometric data cleared for ${staff.full_name}.` });
  } catch (err: any) {
    console.error("Biometric DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete biometric: " + err.message }, { status: 500 });
  }
}
