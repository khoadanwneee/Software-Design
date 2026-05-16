export interface NotificationLogFields {
  dedupeKey?: string;
  eventType?: string;
  channel?: string;
  recipientId?: string;
  retryAttempt?: number;
  providerMsgId?: string;
  failureReason?: string;
  [key: string]: unknown;
}

export interface NotificationLogger {
  info(event: string, fields?: NotificationLogFields): void;
  warn(event: string, fields?: NotificationLogFields): void;
  error(event: string, fields?: NotificationLogFields): void;
}

export interface NotificationMetrics {
  increment(metric: "sent" | "failed" | "retried" | "skipped", fields?: NotificationLogFields): void;
}

function write(level: "info" | "warn" | "error", event: string, fields: NotificationLogFields = {}) {
  const payload = {
    level,
    event,
    component: "notification-worker",
    ...fields
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

export const notificationLogger: NotificationLogger = {
  info: (event, fields) => write("info", event, fields),
  warn: (event, fields) => write("warn", event, fields),
  error: (event, fields) => write("error", event, fields)
};

export const notificationMetrics: NotificationMetrics = {
  increment: (metric, fields) => {
    write("info", `notification.metric.${metric}`, fields);
  }
};
