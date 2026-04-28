import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { ErrorCodes } from "@unihub/shared-utils";
import { env } from "../../config/env.js";
import { AppError } from "../errors/app-error.js";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: ErrorCodes.VALIDATION_ERROR,
        message: "Request validation failed",
        details: error.flatten()
      }
    });
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    });
  }

  const message = env.NODE_ENV === "production" ? "Internal server error" : error.message;
  return res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message,
      details: env.NODE_ENV === "production" ? undefined : error.stack
    }
  });
};
