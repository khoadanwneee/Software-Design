export interface CsvParseResult {
  rows: string[][];
}

export function parseCsv(input: string): CsvParseResult {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldWasQuoted = false;

  const pushField = () => {
    row.push(fieldWasQuoted ? field : field.trim());
    field = "";
    fieldWasQuoted = false;
  };

  const pushRow = () => {
    pushField();
    if (row.some((cell) => cell.length > 0)) {
      rows.push(row);
    }
    row = [];
  };

  const text = input.replace(/^\uFEFF/, "");
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === "\"" && next === "\"") {
        field += "\"";
        index += 1;
        continue;
      }
      if (char === "\"") {
        inQuotes = false;
        continue;
      }
      field += char;
      continue;
    }

    if (char === "\"" && field.length === 0) {
      inQuotes = true;
      fieldWasQuoted = true;
      continue;
    }

    if (char === ",") {
      pushField();
      continue;
    }

    if (char === "\n") {
      pushRow();
      continue;
    }

    if (char === "\r") {
      if (next === "\n") {
        continue;
      }
      pushRow();
      continue;
    }

    field += char;
  }

  if (inQuotes) {
    throw new Error("CSV has an unterminated quoted field");
  }

  if (field.length > 0 || row.length > 0 || fieldWasQuoted) {
    pushRow();
  }

  return { rows };
}
