import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createStudentImportFromUpload } from "./student-import.service.js";

const watchDir = process.env.STUDENT_IMPORT_WATCH_DIR?.trim() ?? "";
const scanIntervalSeconds = Number(process.env.STUDENT_IMPORT_SCAN_INTERVAL_SECONDS ?? "300");

export function startStudentImportScheduler() {
  if (!watchDir) {
    return;
  }

  let running = false;
  const scan = async () => {
    if (running) {
      return;
    }
    running = true;

    try {
      const entries = await readdir(watchDir, { withFileTypes: true });
      const csvFiles = entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".csv"))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));

      for (const fileName of csvFiles) {
        const fullPath = path.join(watchDir, fileName);
        const buffer = await readFile(fullPath);
        await createStudentImportFromUpload({
          fileName,
          contentType: "text/csv",
          buffer,
          importType: "STUDENT_NIGHTLY",
          description: `Auto import from watch dir: ${watchDir}`,
          dryRun: false
        });
      }
    } catch (error) {
      console.warn(
        "Student import scheduler scan failed; API continues running normally.",
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      running = false;
    }
  };

  void scan();
  const interval = Math.max(scanIntervalSeconds, 30) * 1000;
  const timer = setInterval(() => {
    void scan();
  }, interval);
  timer.unref();
}

