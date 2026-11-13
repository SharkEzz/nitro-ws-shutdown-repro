// Starts `vite dev`, optionally opens a WebSocket to /_ws, sends SIGINT (Ctrl+C) and reports:
// how long `vite dev` took to exit, whether Nitro force-closed the dev worker, and whether the `close` hook ran.
// Runs twice: without a WebSocket (baseline) and with one.
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";

const freePort = () =>
  new Promise((resolve) => {
    const s = createServer().listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

async function run(withWebSocket) {
  const port = await freePort();
  const dev = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "dev", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  dev.stdout.on("data", (c) => (output += c));
  dev.stderr.on("data", (c) => (output += c));
  const exited = new Promise((resolve) => dev.once("exit", (code, signal) => resolve(code ?? signal)));

  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; ; i++) {
    if (await fetch(`${base}/api/hello`).then((r) => r.ok, () => false)) break;
    if (i > 300) throw new Error(`vite dev did not start:\n${output}`);
    await sleep(100);
  }

  let ws;
  if (withWebSocket) {
    ws = new WebSocket(`ws://127.0.0.1:${port}/_ws`);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });
    ws.onclose = (e) => (output += `[client] ws closed with code ${e.code}\n`);
  }
  await sleep(500);

  const t0 = performance.now();
  dev.kill("SIGINT");
  const code = await Promise.race([exited, sleep(15_000, "still running after 15 s")]);
  const ms = Math.round(performance.now() - t0);
  if (code === "still running after 15 s") dev.kill("SIGKILL");

  console.log(`\n### ${withWebSocket ? "With an open WebSocket" : "Without a WebSocket"}`);
  console.log(`exit: ${code}, after SIGINT: ${ms} ms`);
  console.log(`worker force-closed: ${output.includes("did not shut down in time")}`);
  console.log(`close hook ran:      ${output.includes("[repro] close hook ran")}`);
  console.log("--- output after startup ---");
  console.log(output.slice(output.indexOf("[repro]") === -1 ? 0 : output.indexOf("[repro]")).trim());
}

await run(false);
await run(true);
