import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, isSecureCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.json({
      success: true,
      data: { message: "Logged out successfully" },
    });

    response.cookies.set(ADMIN_COOKIE, "", {
      httpOnly: true,
      secure: isSecureCookie(request),
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("Admin logout error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
