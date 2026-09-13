import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

export function targetForPath(requestUrl) {
  const pathname = requestUrl.split("?", 1)[0];
  return pathname === "/api" || pathname.startsWith("/api/") ? "api" : "web";
}

function requestHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers).filter(([name]) => !HOP_BY_HOP_HEADERS.has(name.toLowerCase())),
  );
}

export function createProxyServer({ apiOrigin, webOrigin }) {
  const origins = {
    api: new URL(apiOrigin),
    web: new URL(webOrigin),
  };

  return http.createServer((request, response) => {
    const target = origins[targetForPath(request.url ?? "/")];
    const upstream = http.request(
      {
        hostname: target.hostname,
        port: target.port || 80,
        method: request.method,
        path: request.url,
        headers: requestHeaders(request.headers),
      },
      (upstreamResponse) => {
        response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
        upstreamResponse.pipe(response);
      },
    );

    upstream.on("error", (error) => {
      console.error(JSON.stringify({ event: "coolify_upstream_unavailable", message: error.message }));
      if (!response.headersSent) {
        response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      }
      response.end("AUNO upstream is unavailable.");
    });

    request.pipe(upstream);
  });
}

function startProcess(command, args) {
  const child = spawn(command, args, { stdio: "inherit" });
  child.on("error", (error) => {
    console.error(JSON.stringify({ event: "coolify_runtime_spawn_failed", message: error.message }));
  });
  return child;
}

function startRuntime() {
  const worker = startProcess(process.execPath, [
    "--import", "./scripts/sites-env.mjs",
    "./node_modules/wrangler/bin/wrangler.js", "dev",
    "--config", "dist/server/wrangler.json",
    "--local",
    "--persist-to", "/app/.wrangler/state",
    "--ip", "127.0.0.1",
    "--port", "8787",
    "--inspector-port", "0",
  ]);
  const web = startProcess(process.execPath, [
    "./node_modules/vinext/dist/cli.js", "start",
    "--hostname", "127.0.0.1",
    "--port", "3001",
  ]);
  const proxy = createProxyServer({
    apiOrigin: "http://127.0.0.1:8787",
    webOrigin: "http://127.0.0.1:3001",
  });
  const port = Number(process.env.PORT || 3000);
  let shuttingDown = false;

  const shutdown = (exitCode) => {
    if (shuttingDown) return;
    shuttingDown = true;
    proxy.close(() => process.exit(exitCode));
    for (const child of [worker, web]) {
      if (child.exitCode === null) child.kill("SIGTERM");
    }
  };

  for (const [name, child] of [["worker", worker], ["web", web]]) {
    child.on("exit", (code, signal) => {
      if (!shuttingDown) {
        console.error(JSON.stringify({ event: "coolify_runtime_child_stopped", name, code, signal }));
        shutdown(1);
      }
    });
  }

  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));
  proxy.listen(port, "0.0.0.0", () => {
    console.info(JSON.stringify({ event: "coolify_proxy_ready", port, apiPort: 8787, webPort: 3001 }));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startRuntime();
}
