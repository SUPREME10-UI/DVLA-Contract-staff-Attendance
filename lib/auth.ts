import { cookies } from "next/headers";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { ensureSchema, queryOne, queryAll } from "./db";

const SESSION_COOKIE_NAME = "dvla_session";
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  "dvla-contract-attendance-super-secret-key-2026-gh";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "STAFF";
  phone?: string | null;
  avatar?: string | null;
  staffId?: string;
  contractStaffId?: string;
  departmentId?: string;
  departmentName?: string;
  employmentStatus?: string;
}

export function signData(data: string): string {
  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(data)
    .digest("base64url");
  return `${data}.${signature}`;
}

export function verifyData(signedData: string): string | null {
  const parts = signedData.split(".");
  if (parts.length !== 2) return null;
  const [data, signature] = parts;
  const expectedSig = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(data)
    .digest("base64url");
  if (
    crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSig)
    )
  ) {
    return data;
  }
  return null;
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!sessionCookie || !sessionCookie.value) return null;

  try {
    const rawJson = verifyData(sessionCookie.value);
    if (!rawJson) return null;
    const session = JSON.parse(
      Buffer.from(rawJson, "base64url").toString("utf-8")
    );
    if (!session || !session.id) return null;

    // Verify user is still active in DB
    await ensureSchema();
    const userRow = await queryOne<{ is_active: number }>(
      "SELECT is_active FROM users WHERE id = ?",
      [session.id]
    );
    if (!userRow || userRow.is_active !== 1) return null;

    return session as SessionUser;
  } catch {
    return null;
  }
}

export async function setSession(user: SessionUser) {
  const cookieStore = await cookies();
  const rawJson = Buffer.from(JSON.stringify(user)).toString("base64url");
  const signed = signData(rawJson);

  cookieStore.set(SESSION_COOKIE_NAME, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getUserDetails(
  userId: string
): Promise<SessionUser | null> {
  await ensureSchema();
  const user = await queryOne<any>(
    "SELECT id, email, name, role, phone, avatar, is_active FROM users WHERE id = ?",
    [userId]
  );

  if (!user || user.is_active !== 1) return null;

  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    phone: user.phone,
    // Do not store large base64 data URLs in cookie (causes HTTP header overflow)
    avatar:
      user.avatar && !user.avatar.startsWith("data:") ? user.avatar : null,
  };

  if (user.role === "STAFF") {
    const staff = await queryOne<any>(
      `SELECT cs.id as contractStaffId, cs.staff_id, cs.status, cs.department_id,
              d.name as department_name
       FROM contract_staff cs
       LEFT JOIN departments d ON cs.department_id = d.id
       WHERE cs.user_id = ?`,
      [userId]
    );

    if (staff) {
      sessionUser.contractStaffId = staff.contractStaffId;
      sessionUser.staffId = staff.staff_id;
      sessionUser.employmentStatus = staff.status;
      sessionUser.departmentId = staff.department_id;
      sessionUser.departmentName = staff.department_name;
    }
  }

  return sessionUser;
}

export async function authenticateUser(
  emailOrStaffId: string,
  passwordPlain: string
): Promise<{ user: SessionUser | null; error?: string }> {
  await ensureSchema();
  let user: any = null;

  // Check if login input is a staff ID (e.g. DVLA-CS-001, DVLA 002, or any non-email ID)
  if (
    emailOrStaffId.toUpperCase().startsWith("DVLA") ||
    emailOrStaffId.includes("-") ||
    !emailOrStaffId.includes("@")
  ) {
    const staffRow = await queryOne<any>(
      "SELECT user_id FROM contract_staff WHERE UPPER(TRIM(staff_id)) = UPPER(TRIM(?))",
      [emailOrStaffId.trim()]
    );
    if (staffRow) {
      user = await queryOne<any>("SELECT * FROM users WHERE id = ?", [
        staffRow.user_id,
      ]);
    }
  }

  if (!user) {
    user = await queryOne<any>(
      "SELECT * FROM users WHERE LOWER(email) = LOWER(?)",
      [emailOrStaffId.trim()]
    );
  }

  if (!user) {
    return {
      user: null,
      error:
        "Invalid credentials. Please verify your email/Staff ID and password.",
    };
  }

  if (user.is_active !== 1) {
    return {
      user: null,
      error: "Your account is deactivated. Please contact your administrator.",
    };
  }

  const isValid = bcrypt.compareSync(passwordPlain, user.password_hash);
  if (!isValid) {
    return {
      user: null,
      error:
        "Invalid credentials. Please verify your email/Staff ID and password.",
    };
  }

  const sessionUser = await getUserDetails(user.id);
  if (!sessionUser) {
    return { user: null, error: "Unable to load user profile." };
  }

  return { user: sessionUser };
}
