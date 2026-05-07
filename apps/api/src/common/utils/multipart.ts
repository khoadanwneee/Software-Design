import type { Request } from "express";
import { ErrorCodes } from "@unihub/shared-utils";
import { AppError } from "../errors/app-error.js";

export interface MultipartFile {
  fieldName: string;
  fileName: string;
  contentType: string;
  buffer: Buffer;
}

export interface MultipartFormData {
  fields: Record<string, string>;
  files: MultipartFile[];
}

function parseHeaderParams(value: string) {
  const [, ...params] = value.split(";").map((part) => part.trim());
  const result: Record<string, string> = {};
  for (const param of params) {
    const [key, rawValue] = param.split("=");
    if (!key || rawValue === undefined) {
      continue;
    }
    result[key] = rawValue.replace(/^"|"$/g, "");
  }
  return result;
}

function collectRequestBody(req: Request, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;

    req.on("data", (chunk: Buffer) => {
      size += chunk.byteLength;
      if (size > maxBytes) {
        reject(new AppError(413, ErrorCodes.VALIDATION_ERROR, "Upload is too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export async function readMultipartFormData(req: Request, maxBytes: number): Promise<MultipartFormData> {
  const contentType = req.header("content-type") ?? "";
  const boundary = /boundary=([^;]+)/i.exec(contentType)?.[1]?.replace(/^"|"$/g, "");
  if (!contentType.toLowerCase().startsWith("multipart/form-data") || !boundary) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "Expected multipart/form-data");
  }

  const body = await collectRequestBody(req, maxBytes);
  const raw = body.toString("latin1");
  const fields: Record<string, string> = {};
  const files: MultipartFile[] = [];

  for (const rawPart of raw.split(`--${boundary}`)) {
    if (!rawPart || rawPart === "--\r\n" || rawPart === "--") {
      continue;
    }

    const part = rawPart.replace(/^\r\n/, "").replace(/\r\n$/, "");
    if (!part || part === "--") {
      continue;
    }

    const separatorIndex = part.indexOf("\r\n\r\n");
    if (separatorIndex < 0) {
      continue;
    }

    const rawHeaders = part.slice(0, separatorIndex);
    const rawContent = part.slice(separatorIndex + 4).replace(/\r\n--$/, "");
    const headers = new Map(
      rawHeaders.split("\r\n").map((line) => {
        const [name, ...valueParts] = line.split(":");
        return [name.trim().toLowerCase(), valueParts.join(":").trim()] as const;
      })
    );

    const disposition = headers.get("content-disposition");
    if (!disposition) {
      continue;
    }

    const params = parseHeaderParams(disposition);
    const fieldName = params.name;
    if (!fieldName) {
      continue;
    }

    if (params.filename) {
      files.push({
        fieldName,
        fileName: params.filename,
        contentType: headers.get("content-type") ?? "application/octet-stream",
        buffer: Buffer.from(rawContent, "latin1")
      });
    } else {
      fields[fieldName] = Buffer.from(rawContent, "latin1").toString("utf8");
    }
  }

  return { fields, files };
}
