"use strict";
const ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const PATHS = new Set(["/api/auth/admins", "/api/admin/catalogue/state", "/api/health", "/api/ready"]);
function attachApiResponseDiagnostics(server, log = console.log) {
  const observe = (req, res) => {
    const path = String(req.url || "").split("?")[0];
    const supplied = req.headers["x-diagnostic-id"];
    if (req.method !== "GET" || !PATHS.has(path) || typeof supplied !== "string" || !ID.test(supplied)) return;
    const requestId = supplied;
    const started = Date.now();
    let bodyBytes = 0;
    const metadata = () => ({ requestId, pid: process.pid, path, status: res.statusCode, bodyBytes, contentLength: res.getHeader("content-length") ?? null, milliseconds: Date.now() - started });
    const emit = event => { try { log(JSON.stringify({ event, ...metadata() })); } catch {} };
    const bytes = (chunk, encoding) => typeof chunk === "string" ? Buffer.byteLength(chunk, typeof encoding === "string" ? encoding : undefined) : (chunk && typeof chunk !== "function" ? chunk.byteLength || 0 : 0);
    const write = res.write;
    const end = res.end;
    res.write = function (...args) { bodyBytes += bytes(args[0], args[1]); return write.apply(this, args); };
    res.end = function (...args) { bodyBytes += bytes(args[0], args[1]); return end.apply(this, args); };
    res.setHeader("X-Diagnostic-Id", requestId);
    emit("api_diagnostic_started");
    res.once("finish", () => emit("api_diagnostic_finished"));
    res.once("close", () => { if (!res.writableFinished) emit("api_diagnostic_closed_early"); });
  };
  server.prependListener("request", observe);
  return () => server.removeListener("request", observe);
}
module.exports = { attachApiResponseDiagnostics };
