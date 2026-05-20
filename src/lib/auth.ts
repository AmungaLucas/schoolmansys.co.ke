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

export const ADMIN_COOKIE = "admin_session";
export const SCHOOL_COOKIE = "school_session";

/**
 * Determine if cookies should be set with the Secure flag.
 * In production behind a proxy (Caddy/Vercel), x-forwarded-proto is "https"
 * even though the app listens on plain HTTP.
 * Falls back to checking NODE_ENV === "production" if the header is missing.
 */
export function isSecureCookie(request?: { headers: { get(name: string): string | null } }): boolean {
  if (request) {
    const proto = request.headers.get("x-forwarded-proto");
    if (proto === "http") return false;
    if (proto === "https") return true;
  }
  return process.env.NODE_ENV === "production";
}

/** Encode session payload to a base64url token (no cookie side-effect). */
export function encodeSession(data: SessionData): string {
  return Buffer.from(JSON.stringify(data)).toString("base64url");
}

/** Decode a base64url token back to session payload. */
function decodeSession(token: string): SessionData | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    return JSON.parse(decoded) as SessionData;
  } catch {
    return null;
  }
}

/** Build an admin session token (no cookie side-effect). */
export function buildAdminToken(
  userId: string,
  name: string,
  email: string,
  role: string
): string {
  const session: AdminSession = { userId, userType: "admin", name, email, role };
  return encodeSession(session);
}

/** Build a school session token (no cookie side-effect). */
export function buildSchoolToken(
  userId: string,
  tenantId: string,
  name: string,
  email: string,
  roleId: string | null
): string {
  const session: SchoolSession = { userId, userType: "school", tenantId, name, email, roleId };
  return encodeSession(session);
}

/** Read and verify the admin session cookie. Server-side only. */
export async function verifyAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  return decodeSession(token) as AdminSession | null;
}

/** Read and verify the school session cookie. Server-side only. */
export async function verifySchoolSession(): Promise<SchoolSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SCHOOL_COOKIE)?.value;
  if (!token) return null;
  return decodeSession(token) as SchoolSession | null;
}
