# Void Media MCP

A remote MCP server on Cloudflare that lets Claude Code generate images, video and audio through ByteDance Ark and Tu-zi, with a task log and a cost audit. Built on [void-starter](https://github.com/SweetRetry/void-starter); the model catalog comes from olio-void's `packages/model-providers`, without chat models or credits.

## What it does

- **MCP tools** at `/mcp` (Streamable HTTP): `list_models`, `get_model_guide` (the prompt-writing guide of a model whose syntax lives in the prompt, such as Midjourney; also an MCP resource at `void-media://guides/<model id>`), `generate` (a client that supports elicitation on protocol 2026-07-28 is sent the quote to confirm before anything is billed), `get_task`, `view_output` (scaled previews of image outputs, so Claude can look at what it made), `list_tasks` (searchable log), `cost_report`.
- **Standard MCP auth.** OAuth 2.1 with PKCE, dynamic client registration and RFC 9728 discovery, served by Better Auth's `mcp()` plugin. Access tokens are JWTs bound to `/mcp`.
- **One admin.** Sign-up is off. `scripts/seed-admin.mjs` creates the account with a random email and password.
- **Tasks.** Each request is a row in D1 that moves queued → running → succeeded | partial | failed (`confirming` while a lost run may still deliver). A cron advances open tasks every minute.
- **Outputs in R2.** Every delivered file is copied to R2 at once and served at `/f/<random id>.<ext>`.
- **Cost audit.** Each task records its quote at submit, its cost for what delivered, provider-reported tokens, the price it used, and runs that may have been billed without delivering. Prices are catalog list prices in USD (CNY at a pinned rate), not invoices.
- **Web.** `/sign-in`, `/consent`, and `/` with the cost audit and a searchable generation log.

## Use it from Claude Code

```sh
claude mcp add --transport http --scope user void-media https://<worker>.workers.dev/mcp
```

Then `/mcp` in Claude Code, pick `void-media`, authenticate, sign in as the admin and allow.

## Develop

```sh
pnpm install
# apps/web/.env: BETTER_AUTH_SECRET, BETTER_AUTH_URL=http://localhost:5173, ARK_API_KEY, TUZI_API_KEY
pnpm --filter web exec void db migrate
pnpm seed:admin           # local admin; credentials go to apps/web/.admin-credentials
pnpm dev
```

## Deploy

```sh
pnpm --filter web exec void secret sync <file with the four server values>
pnpm run deploy
pnpm seed:admin -- --remote
```

## Layout

```text
apps/web/src/routes/mcp.ts                 MCP endpoint
apps/web/src/server/mcp.server.ts          the tools
apps/web/src/server/auth/                  Better Auth + MCP token check
apps/web/src/server/generation/            provider calls, task state machine, pricing, views
apps/web/crons/generations.ts              advances open tasks
packages/model-providers/                  model catalog, params, prices, provider adapters
```
