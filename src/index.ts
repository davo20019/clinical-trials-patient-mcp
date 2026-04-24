import { ClinicalTrialsPatientMcp } from "./mcp-server";

export { ClinicalTrialsPatientMcp };

// Canonical MCP endpoint: /find-trials (under mcp.davidloor.com family).
// Legacy /mcp kept alive so the workers.dev URL keeps working for anyone
// who grabbed it during the first week. Safe to remove after migration
// has been announced for a while.
const CANONICAL_PATH = "/find-trials";
const LEGACY_PATH = "/mcp";

export default {
  async fetch(
    request: Request,
    env: unknown,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === CANONICAL_PATH || path.startsWith(`${CANONICAL_PATH}/`)) {
      return ClinicalTrialsPatientMcp.serve(CANONICAL_PATH).fetch(
        request,
        env as never,
        ctx
      );
    }

    if (path === LEGACY_PATH || path.startsWith(`${LEGACY_PATH}/`)) {
      return ClinicalTrialsPatientMcp.serve(LEGACY_PATH).fetch(
        request,
        env as never,
        ctx
      );
    }

    if (path === "/sse" || path.startsWith("/sse/")) {
      return ClinicalTrialsPatientMcp.serveSSE("/sse").fetch(
        request,
        env as never,
        ctx
      );
    }

    if (path === "/" || path === "/health") {
      return Response.json({
        name: "clinical-trials-patient-mcp",
        version: "0.1.0",
        status: "ok",
        mcpEndpoint: CANONICAL_PATH,
        legacyMcpEndpoint: LEGACY_PATH,
        sseEndpoint: "/sse",
        canonicalUrl: `https://mcp.davidloor.com${CANONICAL_PATH}`,
        source: "https://github.com/davo20019/clinical-trials-patient-mcp",
      });
    }

    return new Response("Not found", { status: 404 });
  },
};
