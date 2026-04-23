import { ClinicalTrialsPatientMcp } from "./mcp-server";

export { ClinicalTrialsPatientMcp };

export default {
  async fetch(
    request: Request,
    env: unknown,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
      return ClinicalTrialsPatientMcp.serve("/mcp").fetch(
        request,
        env as never,
        ctx
      );
    }

    if (url.pathname === "/sse" || url.pathname.startsWith("/sse/")) {
      return ClinicalTrialsPatientMcp.serveSSE("/sse").fetch(
        request,
        env as never,
        ctx
      );
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return Response.json({
        name: "clinical-trials-patient-mcp",
        version: "0.1.0",
        status: "ok",
        mcpEndpoint: "/mcp",
        sseEndpoint: "/sse",
        source: "https://github.com/davo20019/clinical-trials-patient-mcp",
      });
    }

    return new Response("Not found", { status: 404 });
  },
};
