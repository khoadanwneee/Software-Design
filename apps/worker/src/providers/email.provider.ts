import nodemailer, { type Transporter } from "nodemailer";

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface EmailSendResult {
  providerMessageId: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailSendResult>;
}

class MockEmailProvider implements EmailProvider {
  private failure: Error | null = null;

  failWith(error: Error | string | null) {
    this.failure = typeof error === "string" ? new Error(error) : error;
  }

  reset() {
    this.failure = null;
  }

  async send(message: EmailMessage) {
    if (this.failure) {
      throw this.failure;
    }
    console.log(`[mock-email] to=${message.to} subject="${message.subject}"`);
    return { providerMessageId: `mock-email-${Date.now()}` };
  }
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

class SmtpEmailProvider implements EmailProvider {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: SmtpConfig) {
    this.from = config.from;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.pass ?? "" } : undefined
    });
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const result = await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.body
    });
    return { providerMessageId: result.messageId || `smtp-${Date.now()}` };
  }
}

function toBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }
  return value.toLowerCase() === "true" || value === "1";
}

function toNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildEmailProvider(): EmailProvider {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    return new MockEmailProvider();
  }

  const port = toNumber(process.env.SMTP_PORT, 1025);
  const secure = toBoolean(process.env.SMTP_SECURE, false);
  const from = process.env.SMTP_FROM?.trim() || "UniHub <no-reply@unihub.local>";

  return new SmtpEmailProvider({
    host,
    port,
    secure,
    user: process.env.SMTP_USER?.trim() || undefined,
    pass: process.env.SMTP_PASS?.trim() || undefined,
    from
  });
}

export const emailProvider = buildEmailProvider();
