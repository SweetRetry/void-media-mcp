import { defineConfig } from "void/config"

export default defineConfig({
  worker: {
    compatibility_date: "2026-10-01",
    compatibility_flags: ["nodejs_compat"],
  },
  // Passed through to Wrangler. `name` is the Worker and its workers.dev subdomain. The public
  // URL is open: every route needs a session or an OAuth token except discovery and output links.
  // `preview_urls` stays on because `void deploy` checks each new version through its preview URL.
  cloudflare: {
    name: "void-media-mcp",
    workers_dev: true,
    preview_urls: true,
    observability: {
      enabled: true,
      logs: { enabled: true, invocation_logs: true },
      traces: { enabled: true },
    },
  },
})
