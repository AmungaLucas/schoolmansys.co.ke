import nodemailer from 'nodemailer';

const EMAIL_TIMEOUT_MS = 5000; // Constraint #4: 5-second timeout

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn('[Email] SMTP not configured. Email sending disabled.');
    // Return a test account transporter that will fail gracefully
    return nodemailer.createTransport({
      jsonTransport: true,
    });
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for other ports
    auth: {
      user,
      pass,
    },
    // Connection pooling for shared hosting
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
    rateLimit: 10,
  });

  return transporter;
}

/**
 * Send an email with a 5-second timeout (Constraint #4).
 * Returns { success, warning? } envelope.
 */
export async function sendEmail(options: EmailOptions): Promise<{
  success: boolean;
  warning?: string;
  messageId?: string;
}> {
  const from = process.env.SMTP_FROM || `${process.env.SMTP_USER || 'noreply'} <${process.env.SMTP_USER || 'noreply@schoolmansys.co.ke'}>`;

  const mailOptions: nodemailer.SendMailOptions = {
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text || stripHtml(options.html),
  };

  try {
    // Constraint #4: Promise.race with 5-second timeout
    const result = await Promise.race([
      getTransporter().sendMail(mailOptions),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Email sending timed out (5s)')), EMAIL_TIMEOUT_MS)
      ),
    ]);

    return { success: true, messageId: result.messageId };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown email error';
    console.error('[Email] Failed to send:', message);
    return {
      success: false,
      warning: `Email not sent: ${message}`,
    };
  }
}

/**
 * Send a school admin invite email.
 */
export async function sendInviteEmail(params: {
  to: string;
  adminName: string;
  schoolName: string;
  subdomain: string;
  inviteToken: string;
}): Promise<{ success: boolean; warning?: string }> {
  const appUrl = process.env.APP_URL || 'https://schoolmansys.co.ke';
  const inviteLink = `${appUrl}/accept-invite?token=${params.inviteToken}`;

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; border-radius: 8px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="width: 48px; height: 48px; background-color: #059669; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;">
          <span style="color: white; font-size: 24px; font-weight: bold;">S</span>
        </div>
        <h1 style="color: #111827; font-size: 24px; margin: 0 0 4px 0;">SchoolManSys</h1>
        <p style="color: #6b7280; font-size: 14px; margin: 0;">School Management Platform</p>
      </div>

      <div style="background: white; border-radius: 8px; padding: 24px; border: 1px solid #e5e7eb;">
        <p style="color: #374151; font-size: 16px; margin: 0 0 16px 0;">
          Hello <strong>${params.adminName}</strong>,
        </p>
        <p style="color: #374151; font-size: 16px; margin: 0 0 16px 0; line-height: 1.6;">
          You have been invited to set up the school administration for
          <strong>${params.schoolName}</strong> on SchoolManSys.
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${inviteLink}"
             style="display: inline-block; background-color: #059669; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Set Up Your Account
          </a>
        </div>

        <div style="background-color: #f3f4f6; border-radius: 6px; padding: 12px; margin: 24px 0;">
          <p style="color: #6b7280; font-size: 13px; margin: 0 0 4px 0;">Or copy this link:</p>
          <p style="color: #059669; font-size: 13px; margin: 0; word-break: break-all;">
            ${inviteLink}
          </p>
        </div>

        <p style="color: #6b7280; font-size: 14px; margin: 0; line-height: 1.6;">
          You can share this link via WhatsApp to the admin if needed.
          This link will expire in 7 days.
        </p>
      </div>

      <div style="text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          SchoolManSys - Built for Kenyan CBC/CBE Schools
        </p>
        <p style="color: #9ca3af; font-size: 12px; margin: 4px 0 0 0;">
          ${params.subdomain}.schoolmansys.co.ke
        </p>
      </div>
    </div>
  `;

  return sendEmail({
    to: params.to,
    subject: `You're Invited: Set Up ${params.schoolName} on SchoolManSys`,
    html,
  });
}

/**
 * Send a password reset email (Force Reset by Super Admin).
 */
export async function sendPasswordResetEmail(params: {
  to: string;
  adminName: string;
  schoolName: string;
  resetLink: string;
}): Promise<{ success: boolean; warning?: string }> {
  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; border-radius: 8px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="width: 48px; height: 48px; background-color: #059669; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;">
          <span style="color: white; font-size: 24px; font-weight: bold;">S</span>
        </div>
        <h1 style="color: #111827; font-size: 24px; margin: 0 0 4px 0;">SchoolManSys</h1>
      </div>

      <div style="background: white; border-radius: 8px; padding: 24px; border: 1px solid #e5e7eb;">
        <p style="color: #374151; font-size: 16px; margin: 0 0 16px 0;">
          Hello <strong>${params.adminName}</strong>,
        </p>
        <p style="color: #374151; font-size: 16px; margin: 0 0 16px 0; line-height: 1.6;">
          Your password for <strong>${params.schoolName}</strong> has been reset by the platform administrator.
          Please click the link below to set a new password.
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${params.resetLink}"
             style="display: inline-block; background-color: #059669; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Set New Password
          </a>
        </div>

        <div style="background-color: #fef3c7; border-radius: 6px; padding: 12px; margin: 24px 0;">
          <p style="color: #92400e; font-size: 13px; margin: 0;">
            This reset was initiated by the platform administrator. If you did not request this, please contact support immediately.
          </p>
        </div>
      </div>
    </div>
  `;

  return sendEmail({
    to: params.to,
    subject: `Password Reset: ${params.schoolName} - SchoolManSys`,
    html,
  });
}

/**
 * Verify SMTP configuration by sending a test email.
 */
export async function verifySmtp(): Promise<{ success: boolean; error?: string }> {
  try {
    const t = getTransporter();
    await t.verify();
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'SMTP verification failed';
    return { success: false, error: message };
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
