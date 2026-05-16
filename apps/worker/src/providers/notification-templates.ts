export interface TemplateContent {
  subject: string;
  body: string;
}

type ChannelTemplates = Partial<Record<string, TemplateContent>>;

const TEMPLATES: Record<string, ChannelTemplates> = {
  "registration.confirmed": {
    IN_APP: {
      subject: "Registration confirmed",
      body: "You have successfully registered for \"{{workshopTitle}}\"."
    },
    EMAIL: {
      subject: "Registration confirmed - {{workshopTitle}}",
      body: [
        "Hello {{userName}},",
        "",
        "You have successfully registered for \"{{workshopTitle}}\".",
        "Workshop details: {{workshopUrl}}",
        "Please check your QR code in UniHub before check-in.",
        "",
        "UniHub Team"
      ].join("\n")
    },
    TELEGRAM: {
      subject: "Registration confirmed",
      body: "You have successfully registered for \"{{workshopTitle}}\"."
    }
  },

  "workshop.changed": {
    IN_APP: {
      subject: "Workshop updated",
      body: "\"{{workshopTitle}}\" has schedule or room updates. Please check the latest details."
    },
    EMAIL: {
      subject: "Workshop update - {{workshopTitle}}",
      body: [
        "Hello {{userName}},",
        "",
        "\"{{workshopTitle}}\" has schedule or room updates.",
        "View details: {{workshopUrl}}",
        "Please open UniHub to see the latest details.",
        "",
        "UniHub Team"
      ].join("\n")
    },
    TELEGRAM: {
      subject: "Workshop updated",
      body: "\"{{workshopTitle}}\" has changed. Please check the latest details."
    }
  },

  "workshop.cancelled": {
    IN_APP: {
      subject: "Workshop cancelled",
      body: "\"{{workshopTitle}}\" has been cancelled."
    },
    EMAIL: {
      subject: "Workshop cancelled - {{workshopTitle}}",
      body: [
        "Hello {{userName}},",
        "",
        "\"{{workshopTitle}}\" has been cancelled.",
        "View details: {{workshopUrl}}",
        "We are sorry for the inconvenience.",
        "",
        "UniHub Team"
      ].join("\n")
    },
    TELEGRAM: {
      subject: "Workshop cancelled",
      body: "\"{{workshopTitle}}\" has been cancelled."
    }
  },

  "workshop.reminder": {
    IN_APP: {
      subject: "Workshop reminder",
      body: "\"{{workshopTitle}}\" starts in {{reminderLabel}} at {{workshopStartTime}}."
    },
    EMAIL: {
      subject: "Reminder - {{workshopTitle}}",
      body: [
        "Hello {{userName}},",
        "",
        "This is a reminder that \"{{workshopTitle}}\" starts in {{reminderLabel}}.",
        "Start time: {{workshopStartTime}}.",
        "Workshop details: {{workshopUrl}}",
        "",
        "UniHub Team"
      ].join("\n")
    },
    TELEGRAM: {
      subject: "Workshop reminder",
      body: "\"{{workshopTitle}}\" starts in {{reminderLabel}}."
    }
  }
};

export function renderTemplate(
  eventType: string,
  channel: string,
  vars: Record<string, string>
): TemplateContent | null {
  const template = TEMPLATES[eventType]?.[channel];
  if (!template) {
    return null;
  }

  let subject = template.subject;
  let body = template.body;

  for (const [key, value] of Object.entries(vars)) {
    const placeholder = `{{${key}}}`;
    subject = subject.replaceAll(placeholder, value);
    body = body.replaceAll(placeholder, value);
  }

  const unreplacedPattern = /\{\{.+?\}\}/;
  if (unreplacedPattern.test(subject) || unreplacedPattern.test(body)) {
    console.error(
      `[notification-template] FAILED_TEMPLATE: unreplaced variables in ${eventType}/${channel}`,
      { subject, body }
    );
    return null;
  }

  return { subject, body };
}
