import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
const ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export async function GET(request: NextRequest) {
  const supplied = request.headers.get("x-diagnostic-id") || "";
  const requestId = ID.test(supplied) ? supplied : randomUUID();
  const headers = new Headers({
    "Cache-Control": "private, no-store, max-age=0",
    "Vary": "Cookie",
    "X-Diagnostic-Id": requestId,
    "X-Diagnostic-Proxy": "buffered-v1",
  });
  const fail = (status: number, error: string) => Response.json({ error, requestId }, { status, headers });
  if (process.env.API_PROXY_DIAGNOSTICS !== "true") return fail(404, "Not found");
  const session = request.cookies.get("lighting_admin_session")?.value;
  if (!session || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(session)) return fail(401, "Admin sign-in required.");
  let origin: URL;
  try {
    origin = new URL(process.env.INTERNAL_API_ORIGIN || "");
    if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) throw new Error("Invalid origin");
  } catch { return fail(503, "Diagnostic upstream is not configured."); }
  const started = Date.now();
  try {
    const upstream = await fetch(new URL("/api/auth/admins", origin), {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "identity",
        "Cookie": `lighting_admin_session=${session}`,
        "X-Diagnostic-Id": requestId,
      },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    const body = await upstream.text();
    console.info(JSON.stringify({ event: "api_diagnostic_buffered", requestId, pid: process.pid, upstreamStatus: upstream.status, bodyBytes: Buffer.byteLength(body, "utf8"), milliseconds: Date.now() - started }));
    if (upstream.status >= 300 && upstream.status < 400) return fail(502, "Unexpected upstream redirect.");
    if (!body.trim()) return fail(502, "Upstream returned an empty JSON response.");
    try { JSON.parse(body); }
    catch { return fail(502, "Upstream returned invalid JSON."); }
    headers.set("Content-Type", "application/json; charset=utf-8");
    return new Response(body, { status: upstream.status, headers });
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    console.error(JSON.stringify({ event: "api_diagnostic_buffered_failed", requestId, pid: process.pid, errorName: name, milliseconds: Date.now() - started }));
    return fail(name === "TimeoutError" || name === "AbortError" ? 504 : 502, "Diagnostic upstream request failed.");
  }
}
