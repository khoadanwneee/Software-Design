import http from "node:http";

const port = Number(process.env.AI_SUMMARY_DEV_PORT ?? process.env.PORT ?? 8000);
const expectedApiKey = process.env.AI_SUMMARY_API_KEY ?? "";

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type, ngrok-skip-browser-warning"
  });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Request body is too large"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(raw));
    request.on("error", reject);
  });
}

function requireAuth(request, response) {
  if (!expectedApiKey) {
    return true;
  }

  const authorization = request.headers.authorization ?? "";
  if (authorization !== `Bearer ${expectedApiKey}`) {
    sendJson(response, 401, { error: "Unauthorized" });
    return false;
  }

  return true;
}

function buildSummary(input) {
  const title = normalizeText(input.title) || "workshop";
  const description = normalizeText(input.description);
  const pdfText = normalizeText(input.pdfText);
  const source = [description, pdfText].filter(Boolean).join(" ");

  if (!source) {
    return "Khong du noi dung de tao tom tat chat luong.";
  }

  const sentences = source
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const excerpt = (sentences.slice(0, 3).join(" ") || source).slice(0, 700).trim();

  return `Tom tat dev cho ${title}: ${excerpt}`;
}

function normalizeText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  if (request.method !== "POST" || request.url !== "/summarize") {
    sendJson(response, 404, { error: "Use POST /summarize" });
    return;
  }

  if (!requireAuth(request, response)) {
    return;
  }

  try {
    const raw = await readBody(request);
    const input = raw ? JSON.parse(raw) : {};
    sendJson(response, 200, {
      model: "dev-ai-summary-server",
      summary: buildSummary(input)
    });
  } catch (error) {
    sendJson(response, 400, {
      error: error instanceof Error ? error.message : "Invalid request"
    });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Dev AI summary server listening on http://127.0.0.1:${port}/summarize`);
});
