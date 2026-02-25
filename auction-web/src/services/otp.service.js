import * as userModel from '../models/user.model.js';
import { sendMail } from '../utils/mailer.js';

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getOtpEmailTemplate(fullname, otp, extraHtml = '') {
  return `
    <p>Hi ${fullname},</p>
    ${extraHtml}
    <p>Your OTP code is: <strong>${otp}</strong></p>
    <p>This code will expire in 15 minutes.</p>
  `;
}

/**
 * Generate a 6-digit OTP, persist it in DB, and send it via email.
 *
 * @param {object}  params
 * @param {object}  params.user         - User object (must have .id and .email)
 * @param {string}  params.purpose      - OTP purpose, e.g. 'verify_email' | 'reset_password'
 * @param {string}  params.emailSubject - Subject line for the email
 * @param {string}  [params.recipientEmail] - Override email (defaults to user.email)
 * @param {string}  [params.recipientName]  - Override display name (defaults to user.fullname)
 * @param {string}  [params.extraHtml]      - Extra HTML inserted before the OTP line
 * @returns {Promise<string>} The generated OTP code
 */
export async function generateAndSendOtp({
  user,
  purpose,
  emailSubject,
  recipientEmail,
  recipientName,
  extraHtml = '',
}) {
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await userModel.createOtp({
    user_id: user.id,
    otp_code: otp,
    purpose,
    expires_at: expiresAt,
  });

  const to = recipientEmail || user.email;
  const name = recipientName || user.fullname;

  await sendMail({
    to,
    subject: emailSubject,
    html: getOtpEmailTemplate(name, otp, extraHtml),
  });

  return otp;
}
