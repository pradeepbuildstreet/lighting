import { randomUUID } from "node:crypto";

const HOP = ["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"];
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function cleanHeaders(input) {
  const headers = new Headers(input);
  for (const name of (headers.get("connection") || "").split(",")) if (name.trim()) headers.delete(name.trim());
  for (const name of HOP) headers.delete(name);
  return headers;
}
export async function forwardApi(request, options) {
  const method = request.method.toUpperCase();
  const supplied = request.headers.get("x-diagnostic-id") || "";
  const requestId = UUID.test(supplied) ? supplied : randomUUID();
  const started = Date.now();
  let cleanup = () => {};
  let timedOut = false;
  const log = details => {
    if (options.diagnostics) {
      try { (options.log || console.info)(JSON.stringify({ event: "api_proxy", requestId, pid: process.pid, method, ...details, milliseconds: Date.now() - started })); } catch {}
    }
  };
  const fail = (status, error) => Response.json({ error: error + (!["GET", "HEAD", "OPTIONS"].includes(method) ? " Verify saved state before retrying this write." : ""), requestId }, { status, headers: { "Cache-Control": "private, no-store", "X-Diagnostic-Id": requestId } });
  let origin;
  try {
    origin = new URL(options.origin);
    const localHttp = options.allowLocalHttp && origin.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
    if ((!localHttp && origin.protocol !== "https:") || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) throw new Error("Invalid origin");
  } catch { return fail(503, "API upstream is not configured."); }
  const incoming = new URL(request.url);
  if (!incoming.pathname.startsWith("/api/")) return fail(404, "Not found.");
  const target = new URL(origin.origin);
  target.pathname = incoming.pathname;
  target.search = incoming.search;
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, options.timeoutMs || 60000);
  cleanup = () => { clearTimeout(timer); request.signal.removeEventListener("abort", abort); };
  request.signal.addEventListener("abort", abort, { once: true });
  if (request.signal.aborted) abort();
  try {
    const headers = cleanHeaders(request.headers);
    for (const name of ["host", "content-length", "expect"]) headers.delete(name);
    headers.set("accept-encoding", "identity");
    headers.set("x-diagnostic-id", requestId);
    const init = { method, headers, redirect: "manual", cache: "no-store", signal: controller.signal };
    if (method !== "GET" && method !== "HEAD" && request.body) { init.body = request.body; init.duplex = "half"; }
    const upstream = await fetch(target, init);
    const outgoing = cleanHeaders(upstream.headers);
    const cookies = upstream.headers.has("set-cookie") ? upstream.headers.getSetCookie() : [];
    outgoing.delete("set-cookie");
    for (const cookie of cookies) outgoing.append("set-cookie", cookie);
    outgoing.delete("content-length");
    const encoding = (upstream.headers.get("content-encoding") || "").trim().toLowerCase();
    if (encoding) {
      if (!encoding.split(",").every(value => ["identity", "gzip", "x-gzip", "deflate", "br"].includes(value.trim()))) throw new Error("UNSUPPORTED_ENCODING");
      outgoing.delete("content-encoding");
      for (const name of ["etag", "content-md5", "digest", "content-digest", "repr-digest"]) outgoing.delete(name);
    }
    outgoing.set("cache-control", "private, no-store");
    outgoing.set("x-diagnostic-id", requestId);
    outgoing.set("x-api-proxy", "buffered-json-v1");
    const location = outgoing.get("location");
    if (location) {
      const destination = new URL(location, target);
      if (destination.origin === target.origin && destination.pathname.startsWith("/api/")) outgoing.set("location", destination.pathname + destination.search + destination.hash);
    }
    if (method === "HEAD" || [204, 205, 304].includes(upstream.status)) {
      if (upstream.body) await upstream.body.cancel();
      if (method === "HEAD" && !encoding && upstream.headers.has("content-length")) outgoing.set("content-length", upstream.headers.get("content-length"));
      cleanup();
      log({ path: incoming.pathname, status: upstream.status, mode: "bodyless" });
      return new Response(null, { status: upstream.status, headers: outgoing });
    }
    const type = (upstream.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const json = type === "application/json" || type.endsWith("+json");
    if (json) {
      const reader = upstream.body?.getReader();
      const chunks = [];
      let size = 0;
      if (reader) {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > (options.maxJsonBytes || 33554432)) { await reader.cancel(); throw new Error("JSON_TOO_LARGE"); }
          chunks.push(part.value);
        }
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      if (!size) throw new Error("EMPTY_JSON");
      try { JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error("INVALID_JSON"); }
      cleanup();
      log({ path: incoming.pathname, status: upstream.status, mode: "buffered", bodyBytes: size });
      return new Response(bytes, { status: upstream.status, headers: outgoing });
    }
    if (!upstream.body) {
      cleanup();
      return new Response(null, { status: upstream.status, headers: outgoing });
    }
    const reader = upstream.body.getReader();
    const stream = new ReadableStream({
      async pull(destination) {
        try {
          const part = await reader.read();
          if (part.done) { cleanup(); destination.close(); }
          else destination.enqueue(part.value);
        } catch (error) { cleanup(); destination.error(error); }
      },
      async cancel(reason) { cleanup(); controller.abort(); try { await reader.cancel(reason); } catch {} },
    });
    log({ path: incoming.pathname, status: upstream.status, mode: "stream" });
    return new Response(stream, { status: upstream.status, headers: outgoing });
  } catch (error) {
    controller.abort();
    cleanup();
    const code = error instanceof Error ? error.message : "ERROR";
    const messages = { EMPTY_JSON: "Upstream returned an empty JSON response.", INVALID_JSON: "Upstream returned invalid JSON.", JSON_TOO_LARGE: "Upstream JSON exceeds the proxy response limit.", UNSUPPORTED_ENCODING: "Upstream returned an unsupported content encoding." };
    log({ path: incoming.pathname, status: timedOut ? 504 : 502, errorName: error instanceof Error ? error.name : "Error" });
    return fail(timedOut ? 504 : 502, timedOut ? "API upstream timed out." : messages[code] || "API upstream request failed.");
  }
}
