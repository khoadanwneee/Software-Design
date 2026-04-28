import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { errorHandler } from "./common/middleware/error-handler.js";
import { defaultRateLimit } from "./common/middleware/rate-limit.js";
import { requestId } from "./common/middleware/request-id.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { apiRouter } from "./routes.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: env.APP_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(requestId);
  app.use(
    morgan("combined", {
      skip: (req) => req.path === "/health"
    })
  );

  const swaggerSpec = swaggerJsdoc({
    definition: {
      openapi: "3.0.0",
      info: { title: "UniHub Workshop API", version: "0.1.0" }
    },
    apis: ["src/modules/**/*.ts"]
  });

  app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.use("/api", defaultRateLimit, apiRouter);
  app.use("/health", healthRouter);
  app.use(errorHandler);

  return app;
}
