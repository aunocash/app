import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { createProxyServer, targetForPath } from "../scripts/coolify-runtime.mjs";

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function close(server) {
  server.close();
  await once(server, "close");
}

function upstream(name) {
  return http.createServer((request, response) => {
    response.setHeader("x-auno-upstream", name);
    response.end(`${name}:${request.url}`);
  });
}

assert.equal(targetForPath("/api/health"), "api");
assert.equal(targetForPath("/api"), "api");
assert.equal(targetForPath("/api?check=1"), "api");
assert.equal(targetForPath("/docs"), "web");

const api = upstream("api");
const web = upstream("web");
const apiOrigin = await listen(api);
const webOrigin = await listen(web);
const proxy = createProxyServer({ apiOrigin, webOrigin });
const proxyOrigin = await listen(proxy);

try {
  const apiResponse = await fetch(`${proxyOrigin}/api/health`);
  assert.equal(apiResponse.headers.get("x-auno-upstream"), "api");
  assert.equal(await apiResponse.text(), "api:/api/health");

  const pageResponse = await fetch(`${proxyOrigin}/docs`);
  assert.equal(pageResponse.headers.get("x-auno-upstream"), "web");
  assert.equal(await pageResponse.text(), "web:/docs");
} finally {
  await Promise.all([close(proxy), close(api), close(web)]);
}
