import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface PutObjectInput {
  key: string;
  body: Buffer;
}

function sanitizeSegment(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "file";
}

function findWorkspaceRoot(start: string) {
  let current = start;
  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = path.join(current, "pnpm-workspace.yaml");
    if (existsSync(candidate)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  const dirname = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(dirname, "../../..");
}

function storageRoot() {
  return path.resolve(process.env.LOCAL_OBJECT_STORAGE_DIR ?? path.join(findWorkspaceRoot(process.cwd()), ".unihub-storage"));
}

export function buildStorageKey(prefix: string, fileName: string) {
  const date = new Date().toISOString().slice(0, 10);
  const safePrefix = prefix
    .split("/")
    .map((segment) => sanitizeSegment(segment))
    .filter(Boolean)
    .join("/");
  return `${safePrefix}/${date}/${randomUUID()}-${sanitizeSegment(fileName)}`;
}

function resolveStorageKey(key: string) {
  const root = storageRoot();
  const resolved = path.resolve(root, key);
  if (!resolved.startsWith(root + path.sep)) {
    throw new Error("Invalid storage key");
  }
  return resolved;
}

export const localObjectStorage = {
  async putObject(input: PutObjectInput) {
    const filePath = resolveStorageKey(input.key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, input.body);
    return { storageKey: input.key, sizeBytes: input.body.byteLength };
  },

  async readText(key: string) {
    const filePath = resolveStorageKey(key);
    return readFile(filePath, "utf8");
  }
};
