import { NotificationChannel } from "@unihub/shared-types";
import { emailProvider } from "./email.provider.js";

export interface ChannelSendResult {
  success: boolean;
  providerMsgId?: string;
  error?: string;
  errorType?: "PROVIDER_TIMEOUT" | "FAILED_TEMPLATE" | "CHANNEL_DISABLED" | "GENERAL";
}

export interface ChannelPayload {
  userId: string;
  toEmail: string;
  userName: string;
  subject: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationChannelAdapter {
  readonly channel: NotificationChannel;
  send(payload: ChannelPayload): Promise<ChannelSendResult>;
}

export type PreferenceKey = "inApp" | "email" | "telegram" | string;

export interface RegisteredNotificationChannel {
  readonly channel: NotificationChannel;
  readonly preferenceKey: PreferenceKey;
  readonly defaultEnabled: boolean;
  readonly adapter: NotificationChannelAdapter;
}

export interface NotificationPreferenceShape {
  inApp?: boolean;
  email?: boolean;
  telegram?: boolean;
  [key: string]: boolean | undefined;
}

export class NotificationChannelRegistry {
  private readonly channels = new Map<NotificationChannel, RegisteredNotificationChannel>();

  constructor(channels: RegisteredNotificationChannel[] = []) {
    for (const channel of channels) {
      this.register(channel);
    }
  }

  register(channel: RegisteredNotificationChannel) {
    this.channels.set(channel.channel, channel);
  }

  get(channel: NotificationChannel) {
    return this.channels.get(channel);
  }

  list() {
    return Array.from(this.channels.values());
  }

  isEnabled(channel: RegisteredNotificationChannel, prefs: NotificationPreferenceShape) {
    return prefs[channel.preferenceKey] ?? channel.defaultEnabled;
  }
}

class InAppChannelAdapter implements NotificationChannelAdapter {
  readonly channel = NotificationChannel.IN_APP;

  async send(_payload: ChannelPayload): Promise<ChannelSendResult> {
    return { success: true, providerMsgId: `in-app-${Date.now()}` };
  }
}

class EmailChannelAdapter implements NotificationChannelAdapter {
  readonly channel = NotificationChannel.EMAIL;

  async send(payload: ChannelPayload): Promise<ChannelSendResult> {
    try {
      const result = await emailProvider.send({
        to: payload.toEmail,
        subject: payload.subject,
        body: payload.body
      });
      return { success: true, providerMsgId: result.providerMessageId };
    } catch (error: any) {
      const isTimeout =
        error?.code === "ETIMEDOUT" ||
        error?.code === "ESOCKET" ||
        String(error?.message ?? "").toLowerCase().includes("timeout");
      return {
        success: false,
        error: error?.message ?? "Email send failed",
        errorType: isTimeout ? "PROVIDER_TIMEOUT" : "GENERAL"
      };
    }
  }
}

class TelegramChannelAdapter implements NotificationChannelAdapter {
  readonly channel = NotificationChannel.TELEGRAM;

  async send(_payload: ChannelPayload): Promise<ChannelSendResult> {
    return {
      success: false,
      error: "Telegram channel is not configured",
      errorType: "CHANNEL_DISABLED"
    };
  }
}

export const channelRegistry = new NotificationChannelRegistry([
  {
    channel: NotificationChannel.IN_APP,
    preferenceKey: "inApp",
    defaultEnabled: true,
    adapter: new InAppChannelAdapter()
  },
  {
    channel: NotificationChannel.EMAIL,
    preferenceKey: "email",
    defaultEnabled: true,
    adapter: new EmailChannelAdapter()
  },
  {
    channel: NotificationChannel.TELEGRAM,
    preferenceKey: "telegram",
    defaultEnabled: false,
    adapter: new TelegramChannelAdapter()
  }
]);
