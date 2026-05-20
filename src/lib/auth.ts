import { cookies } from "next/headers";

export interface AdminSession {
  userId: string;
  userType: "admin";
  name: string;
  email: string;
  role: string;
}

export interface SchoolSession {
  userId: string;
  userType: "school";
  tenantId: string;
  name: string;
  email: string;
  roleId: string | null;
}

export type SessionData = AdminSession | SchoolSession;

const ADMIN_COOKIE = "admin_session";
const SCHOOL_COOKIE = "school_session";

function encodeSession(data: SessionData): string {
  return Buffer.from(JSON.stringify(data)).toString("base64url");
}

function decodeSession(token: string): SessionData | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    return JSON.parse(decoded) as SessionData;
  } catch {
    return null;
  }
}

export async function createAdminSession(
  userId: string,
  name: string,
  email: string,
  role: string
): Promise<string> {
  const session: AdminSession = {
    userId,
    userType: "admin",
    name,
    email,
    role,
  };
  const token = encodeSession(session);
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  });
  return token;
}

export async function createSchoolSession(
  userId: string,
  tenantId: string,
  name: string,
  email: string,
  roleId: string | null
): Promise<string> {
  const session: SchoolSession = {
    userId,
    userType: "school",
    tenantId,
    name,
    email,
    roleId,
  };
  const token = encodeSession(session);
  const cookieStore = await cookies();
  cookieStore.set(SCHOOL_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return token;
}

export async function verifyAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  return decodeSession(token) as AdminSession | null;
}

export async function verifySchoolSession(): Promise<SchoolSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SCHOOL_COOKIE)?.value;
  if (!token) return null;
  return decodeSession(token) as SchoolSession | null;
}

export async function deleteAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
}

export async function deleteSchoolSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SCHOOL_COOKIE);
}
