import { NextResponse } from "next/server";
import { deleteAdminSession } from "@/lib/auth";

export async function POST() {
  try {
    await deleteAdminSession();
    return NextResponse.json({
      success: true,
      data: { message: "Logged out successfully" },
    });
  } catch (error) {
    console.error("Admin logout error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
