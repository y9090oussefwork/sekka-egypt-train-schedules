import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const workerPath = resolve("dist/server/index.js");
const hostingPath = resolve("dist/.openai/hosting.json");

try {
  await readFile(workerPath);
} catch {
  console.error("Missing Sites Worker entry: dist/server/index.js");
  process.exit(66);
}

try {
  const hostingData = await readFile(hostingPath, "utf8");
  JSON.parse(hostingData);
} catch {
  console.error("Missing or invalid packaged Sites manifest: dist/.openai/hosting.json");
  process.exit(66);
}

const workerUrl = pathToFileURL(workerPath);
workerUrl.searchParams.set("sites-validation", `${process.pid}-${Date.now()}`);
const worker = await import(workerUrl.href);
if (!worker.default || typeof worker.default.fetch !== "function") {
  throw new Error("dist/server/index.js must have an ESM default export with fetch(request, env, ctx)");
}

console.log("Validated Sites artifact: ESM Worker default.fetch and hosting manifest are present.");
