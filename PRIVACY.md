# Privacy

`clinical-trials-patient-mcp` is designed to store **no user data**. Not now, not in v2, not ever. This is a core design commitment, not a footnote.

## What we do NOT store

- No user accounts. There are none to create.
- No search history. Queries live in memory for the duration of one request and are then gone.
- No saved profiles, saved searches, bookmarks, or favorites.
- No feedback, ratings, or analytics keyed to user identity.
- No health information. If you describe a patient's condition to the LLM that calls this server, the LLM may send it as a tool argument — we process it in memory, pass what's needed to ClinicalTrials.gov, and discard it. We never write it anywhere.

## What exists transiently

- **Per-request memory.** Your tool inputs are held in RAM while the Cloudflare Worker services one request (typically under a second), then discarded when the request ends.
- **Upstream response cache.** We cache responses from ClinicalTrials.gov for 5 minutes, keyed by the ClinicalTrials.gov URL. This cache is shared across all users and contains only public CT.gov data. It is not keyed to any user identifier.
- **MCP session state.** The Cloudflare `agents` SDK uses a Durable Object per MCP session to hold ephemeral transport state (session ID, active stream). This is required by the MCP streamable-HTTP protocol. It does not record your queries; it is short-lived; it contains no persisted user data.

## What Cloudflare captures by default

We run on Cloudflare Workers. Cloudflare's platform logs standard request metadata for every hit: client IP, URL path, HTTP status, timing. **Crucially, Cloudflare's default logs do NOT include POST bodies.** MCP tool calls are POST requests, so the actual arguments you send (a condition name, a location, an NCT ID) are **not in the request log**.

We have not enabled any extended logging (Workers Logpush, Tail Workers, custom log forwarding) that would capture bodies. If you self-host a fork and enable those, you're on the hook for what they capture.

## Third parties we talk to

- **ClinicalTrials.gov (US NIH / NLM)** — every tool call ultimately hits the public [ClinicalTrials.gov API v2](https://clinicaltrials.gov/data-api/api). Your search terms go there. ClinicalTrials.gov's own privacy policy governs their retention.
- **Your MCP client (ChatGPT / Claude / etc.)** — whatever you say to them is governed by their privacy policy, not this server's. This server has no view into your LLM conversation; it only sees the tool-call arguments the LLM chose to send.

## What this means for future features

Any feature proposal that would require storing user data — saved profiles, eligibility history, notification subscriptions, anything with an account — is out of scope for this project by design. When such features would genuinely help patients, the right home is the LLM client (ChatGPT / Claude memory), not this server.

## Self-hosting

If you fork this to run your own instance:

- You inherit the same Cloudflare defaults (no POST-body logging).
- Do not enable Logpush, Tail Workers, or any custom logging that captures tool-call bodies without warning your users.
- Do not add persistent storage (KV, D1, R2) keyed to user identity.
- Keep this `PRIVACY.md` accurate to what your instance actually does. If you change the design, update the doc.

## License

This document is MIT-licensed along with the rest of the repository — feel free to copy it into other MCP projects that share the same design commitment.
