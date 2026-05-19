import { NextResponse } from "next/server";
import { deleteSchoolSession } from "@/lib/auth";

export async function POST() {
  try {
    await deleteSchoolSession();
    return NextResponse.json({
      success: true,
      data: { message: "Logged out successfully" },
    });
  } catch (error) {
    console.error("School logout error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
