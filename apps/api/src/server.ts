import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();

const server = app.listen(env.API_PORT, () => {
  console.log(`UniHub API listening on http://localhost:${env.API_PORT}`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${env.API_PORT} is already in use. Stop the existing API process or set API_PORT to another value in .env.`
    );
    process.exit(1);
  }

  throw error;
});
