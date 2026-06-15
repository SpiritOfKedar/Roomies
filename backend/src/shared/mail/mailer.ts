import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env } from '../utils/env';
import { logger } from '../utils/logger';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;
  if (!env.SMTP_HOST || !env.SMTP_FROM) return null;

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
  });

  return transporter;
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<void> {
  const subject = 'Reset your Roomies password';
  const text = `You requested a password reset for your Roomies account.\n\nReset your password using this link (expires in 1 hour):\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`;
  const html = `
    <p>You requested a password reset for your Roomies account.</p>
    <p><a href="${resetUrl}">Reset your password</a> (link expires in 1 hour)</p>
    <p>If you did not request this, you can ignore this email.</p>
  `;

  const transport = getTransporter();
  if (!transport) {
    logger.warn({ to, resetUrl }, 'SMTP not configured — password reset link (dev)');
    return;
  }

  await transport.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    text,
    html,
  });
}
