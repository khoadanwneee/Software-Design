const DEFAULT_MAX_INPUT_CHARS = 30_000;

function maxInputChars() {
  const parsed = Number(process.env.AI_SUMMARY_MAX_INPUT_CHARS);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_MAX_INPUT_CHARS;
}

function normalizeLine(line: string) {
  return line.replace(/\s+/g, " ").trim();
}

function isPageNumberLine(line: string) {
  return (
    /^(page|trang)\s*\d+(\s*(of|\/)\s*\d+)?$/i.test(line) ||
    /^\d+\s*\/\s*\d+$/.test(line) ||
    /^[-–—]?\s*\d+\s*[-–—]?$/.test(line)
  );
}

function repeatedNoiseLines(lines: string[]) {
  const counts = new Map<string, number>();
  for (const line of lines) {
    const normalized = line.toLowerCase();
    if (line.length > 0 && line.length <= 80) {
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }

  return new Set(
    Array.from(counts.entries())
      .filter(([line, count]) => count >= 3 && !/[.!?]\s*$/.test(line) && line.split(" ").length <= 10)
      .map(([line]) => line)
  );
}

function joinSoftWrappedLines(text: string) {
  return text
    .replace(/(\p{L})-\n(\p{L})/gu, "$1$2")
    .replace(/([^\n])\n(?!\n)([^\n])/g, "$1 $2");
}

export function cleanPdfText(raw: string, maxLength = maxInputChars()) {
  const normalized = raw
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

  const lines = normalized.split("\n").map(normalizeLine);
  const noiseLines = repeatedNoiseLines(lines);
  const filtered = lines.filter((line) => {
    if (!line) {
      return true;
    }
    if (isPageNumberLine(line)) {
      return false;
    }
    return !noiseLines.has(line.toLowerCase());
  });

  const cleaned = joinSoftWrappedLines(filtered.join("\n"))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned.length > maxLength ? cleaned.slice(0, maxLength).trimEnd() : cleaned;
}
