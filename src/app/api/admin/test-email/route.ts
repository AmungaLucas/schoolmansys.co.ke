import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { verifySmtp, sendEmail } from "@/lib/email";

/**
 * GET - Verify SMTP connection is working
 * POST - Send a test email to verify end-to-end
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Admin authentication required" } },
        { status: 401 }
      );
    }

    // Check SMTP configuration
    const config = {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER,
      hasPassword: !!process.env.SMTP_PASS,
      from: process.env.SMTP_FROM,
    };

    if (!config.host || !config.user || !process.env.SMTP_PASS) {
      return NextResponse.json({
        success: false,
        error: {
          code: "SMTP_NOT_CONFIGURED",
          message: "SMTP is not configured. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS in your environment variables.",
        },
        config,
      });
    }

    // Verify SMTP connection
    const result = await verifySmtp();

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: {
          code: "SMTP_CONNECTION_FAILED",
          message: result.error || "Could not connect to SMTP server",
        },
        config,
      });
    }

    return NextResponse.json({
      success: true,
      message: "SMTP connection verified successfully",
      config: {
        host: config.host,
        port: config.port,
        user: config.user,
        from: config.from,
      },
    });
  } catch (error) {
    console.error("SMTP verify error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to verify SMTP" } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Admin authentication required" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { to } = body;

    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "A valid email address is required" } },
        { status: 400 }
      );
    }

    const result = await sendEmail({
      to,
      subject: "SchoolManSys - Test Email",
      html: `
        <div style="font-family: 'Segoe UI', sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 48px; height: 48px; background-color: #059669; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;">
              <span style="color: white; font-size: 24px; font-weight: bold;">S</span>
            </div>
            <h1 style="color: #111827; font-size: 24px; margin: 12px 0 4px 0;">SchoolManSys</h1>
          </div>
          <div style="background: white; border-radius: 8px; padding: 24px; border: 1px solid #e5e7eb;">
            <p style="color: #374151; font-size: 16px; margin: 0 0 12px 0;">
              Hello <strong>${to}</strong>,
            </p>
            <p style="color: #374151; font-size: 16px; margin: 0 0 16px 0; line-height: 1.6;">
              This is a test email from <strong>SchoolManSys</strong> to verify your SMTP configuration is working correctly.
            </p>
            <div style="background-color: #ecfdf5; border-radius: 6px; padding: 12px; margin: 16px 0;">
              <p style="color: #065f46; font-size: 14px; margin: 0;">
                If you received this email, your email settings are configured correctly!
              </p>
            </div>
            <p style="color: #6b7280; font-size: 13px; margin: 0;">
              Sent at: ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}
            </p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({
      success: result.success,
      message: result.success ? `Test email sent to ${to}` : "Failed to send test email",
      ...(result.messageId && { messageId: result.messageId }),
      ...(result.warning && { warning: result.warning }),
    });
  } catch (error) {
    console.error("Test email error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to send test email" } },
      { status: 500 }
    );
  }
}
