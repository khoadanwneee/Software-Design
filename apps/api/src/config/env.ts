import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().default(4000),
  APP_ORIGIN: z.string().default("http://localhost:5173"),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgresql://unihub:unihub@localhost:5432/unihub_workshop?schema=public"),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  JWT_SECRET: z.string().min(12).default("change-me-in-local-dev"),
  JWT_EXPIRES_IN: z.string().default("2h"),
  RATE_LIMIT_DEFAULT_POINTS: z.coerce.number().default(120),
  RATE_LIMIT_DEFAULT_DURATION_SECONDS: z.coerce.number().default(60),
  RATE_LIMIT_REGISTRATION_POINTS: z.coerce.number().default(10),
  RATE_LIMIT_PAYMENT_POINTS: z.coerce.number().default(8),
  RATE_LIMIT_CHECKIN_SYNC_POINTS: z.coerce.number().default(30),
  MAX_UPLOAD_BYTES: z.coerce.number().default(10 * 1024 * 1024)
});

export const env = envSchema.parse(process.env);
