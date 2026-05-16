import type { JobsOptions } from "bullmq";

export const notificationDefaultJobOptions: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 2000 }
};
