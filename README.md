# clinical-trials-patient-mcp

> A remote MCP server that helps patients and caregivers find clinical trials on [ClinicalTrials.gov](https://clinicaltrials.gov) — built for the moment after bad news, when you need options and a phone number, not a research portal.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
![Platform](https://img.shields.io/badge/runtime-Cloudflare%20Workers-F38020)
![Status](https://img.shields.io/badge/status-live-brightgreen)

Add one URL to ChatGPT, Claude, or any MCP-compatible client, then ask natural-language questions like:

> *"My dad was just diagnosed with pancreatic cancer — are there any recruiting trials in Texas?"*

> *"Find me phase 2 breast cancer trials that are recruiting near Denver."*

> *"What does trial NCT04567890 require to qualify?"*

The LLM calls this server's tools to query ClinicalTrials.gov, and responds with trial details, eligibility criteria, **phone numbers and emails for each site**, and source URLs you can verify yourself.

---

## Why this exists

Clinical trials save lives, but ClinicalTrials.gov is written for researchers — dense, jargon-heavy, and hard to navigate at 11pm when a family is scared and looking for hope. Most patients never hear about relevant trials.

This server lowers the floor. A caregiver with a phone and an LLM can surface trials, read eligibility, and find a real human to call — in a single conversation.

---

## Tools

The server exposes **three MCP tools** over the ClinicalTrials.gov v2 API:

### `list_conditions`
Disambiguate a vague term into specific, searchable conditions.

| Input | Example | Output |
|---|---|---|
| `query` | `"breast cancer"` | `["Triple Negative Breast Cancer", "HER2-positive Breast Cancer", ...]` with study counts |

Use this first when the patient's term could match many subtypes.

### `search_trials`
Find trials by condition, with patient-friendly defaults (**recruiting only** unless you opt in to more).

| Input | Required | Example |
|---|---|---|
| `condition` | yes | `"Triple Negative Breast Cancer"` |
| `location` | no | `"Denver, CO"`, `"Texas"`, `"80202"` |
| `status` | no | `"recruiting"` (default), `"not_yet_recruiting"`, `"any"` |
| `phase` | no | `"1"`, `"2"`, `"3"`, `"4"`, `"any"` (default) |
| `pageSize` | no | `1`–`25`, default `10` |

Returns an array of trials with title, brief summary, phase, status, per-site locations, sponsor, **last-updated date**, and the official ClinicalTrials.gov URL.

### `get_trial_details`
Full details for one trial by NCT ID.

| Input | Example |
|---|---|
| `nctId` | `"NCT01234567"` |

Returns identification, description, status, design, **full verbatim eligibility criteria**, per-site locations with contacts (name / phone / email where available), sponsor, interventions, and PubMed references.

---

## Connecting

> **⚠️ This is an information tool, not medical advice.** Data may lag reality by weeks. Always confirm current enrollment by calling the trial site, and discuss any trial with the patient's treating physician before acting.

**Live endpoint:** `https://mcp.davidloor.com/find-trials`

**In ChatGPT / Claude / other MCP clients:** add the URL above as a streamable-HTTP MCP server.

> *Legacy URL still live for back-compat:* `https://clinical-trials-patient-mcp.davo20019.workers.dev/mcp`
>
> This MCP lives under an **umbrella subdomain** (`mcp.davidloor.com`) that hosts a growing family of MCPs. Future siblings: `mcp.davidloor.com/drug-info`, `mcp.davidloor.com/rare-disease`, etc.

You can also host your own copy in minutes — see [Self-hosting](#self-hosting) below.

---

## Self-hosting

It's free to run on Cloudflare's Workers plan. Here's the full path from clone to deploy:

```bash
git clone https://github.com/<your-github>/clinical-trials-patient-mcp
cd clinical-trials-patient-mcp
npm install
npx wrangler login
npx wrangler deploy
```

That deploys to a `*.workers.dev` subdomain. Expected cost on a $5/mo Workers Paid plan: effectively **free** at realistic traffic (the server is stateless, responses are cached for 5 minutes, and rate limiting prevents abuse).

---

## Development

```bash
npm install          # install deps
npm test             # run unit tests
npm run test:watch   # watch mode
npm run typecheck    # tsc --noEmit
npm run dev          # wrangler dev (local MCP server)
npm run deploy       # wrangler deploy
```

### Project layout

```
src/
├── errors.ts              # typed error classes
├── ctgov/
│   ├── types.ts           # normalized response shapes
│   ├── cache.ts           # Workers Cache API wrapper (5-min TTL)
│   └── client.ts          # typed CT.gov v2 REST client
├── tools/
│   ├── list-conditions.ts
│   ├── search-trials.ts
│   └── get-trial-details.ts
├── mcp-server.ts          # McpAgent + tool registration
└── index.ts               # Worker fetch entry (/mcp, /sse, /health)

test/
├── fixtures/              # captured CT.gov JSON responses
├── ctgov/                 # client + cache tests
└── tools/                 # tool-level tests with mocked client
```

---

## Architecture

- **Stateless Cloudflare Worker** — each tool call is independent; no sessions, no PII stored.
- **Cloudflare `agents` SDK** — wraps the official MCP TypeScript SDK with streamable-HTTP transport.
- **Workers Cache API** — 5-minute TTL on upstream responses; duplicate searches don't re-hit ClinicalTrials.gov.
- **Rate limiting** — 60 req/min per client IP via Cloudflare's built-in binding.
- **Typed error handling** — every tool returns structured errors the LLM can translate for the patient.

See [`docs/superpowers/specs/`](./docs/superpowers/specs/) for the full design spec.

---

## Limits (v1)

- **No geocoded radius search** (*"within 50 miles of 80202"*) — v1 accepts free-form location strings that the upstream API handles natively. Radius is a v2 candidate.
- **No eligibility matching** — the LLM reads the criteria verbatim; this server just serves them. Only a trial coordinator can confirm whether a specific patient qualifies.
- **No multi-source aggregation** (EU register, WHO ICTRP, etc.) — those would be sibling MCPs, not inside this one. See the spec's "Future Extensions" section.

---

## Privacy — zero user data stored

This server stores **no** user data. No accounts, no search history, no saved profiles. Your queries live in memory for one request and are then discarded. Full details in [PRIVACY.md](./PRIVACY.md).

## Responsible use

This server returns information from a public data source (ClinicalTrials.gov). It does **not** give medical advice, diagnose, or recommend treatment.

- Always encourage users to **call the trial site** to confirm current enrollment — data can be weeks out of date.
- Always encourage users to **discuss with their treating physician** before acting.
- The tool descriptions instruct LLM clients to quote eligibility criteria verbatim (not paraphrase) and to surface the `lastUpdated` field.

---

## Contributing

Issues and pull requests welcome. This is a solo side project; expect asynchronous review. If you're adding a feature:

1. Open an issue first to discuss scope.
2. Follow the TDD pattern used in existing tests.
3. Keep the stateless, zero-PII design — no user accounts, no stored search history.

---

## License

[MIT](./LICENSE). Data sourced from [ClinicalTrials.gov](https://clinicaltrials.gov), which is in the public domain.
