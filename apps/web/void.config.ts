import { defineConfig } from "void/config"

export default defineConfig({
  worker: {
    compatibility_date: "2026-10-01",
    compatibility_flags: ["nodejs_compat"],
  },
  // Passed through to Wrangler. `name` is the Worker; it keeps its old name so the D1 database and
  // R2 bucket recorded in void.lock.json stay bound. The app is served only at its custom domain,
  // which must equal BETTER_AUTH_URL (the OAuth issuer), so the workers.dev route is closed.
  // Every route needs a session or an OAuth token except discovery and output links.
  // `preview_urls` stays on because `void deploy` checks each new version through its preview URL.
  cloudflare: {
    name: "void-media-mcp",
    routes: [{ pattern: "obscura.sweetretry.dev", custom_domain: true }],
    workers_dev: false,
    preview_urls: true,
    // Scales image outputs down for `view_output`. Local dev runs it offline on sharp.
    images: { binding: "IMAGES" },
    observability: {
      enabled: true,
      logs: { enabled: true, invocation_logs: true },
      traces: { enabled: true },
    },
  },
})
