import { forwardApi } from "@/lib/api-forwarder.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function handle(request: Request) {
  return forwardApi(request, {
    origin: process.env.INTERNAL_API_ORIGIN || (process.env.NODE_ENV !== "production" ? "http://127.0.0.1:3000" : ""),
    allowLocalHttp: process.env.NODE_ENV !== "production",
    diagnostics: process.env.API_PROXY_DIAGNOSTICS === "true",
    timeoutMs: 60000,
    maxJsonBytes: 32 * 1024 * 1024,
  });
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE, handle as HEAD, handle as OPTIONS };
