import "dotenv/config";

import { app } from "./app.js";

const port = Number(process.env.PORT) || 5000;

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`API running at http://localhost:${port}`);
});

function shutdown(signal: string): void {
  console.log(`${signal} received. Closing the API server.`);

  server.close(() => {
    console.log("API server closed.");
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));