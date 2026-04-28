export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export class MockEmailProvider {
  async send(message: EmailMessage) {
    console.log(`[mock-email] to=${message.to} subject="${message.subject}"`);
    return { providerMessageId: `mock-email-${Date.now()}` };
  }
}

export const emailProvider = new MockEmailProvider();
