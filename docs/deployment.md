# Deployment

Void deploys the app to your own Cloudflare account as one Worker. Every command below runs from the repo root.

## First deploy

Pick the Worker name first: `cloudflare.name` in `apps/web/void.config.ts` (default `void-starter`). It also names the `workers.dev` subdomain.

```sh
pnpm connect
pnpm run deploy
```

Before the first answer, create the AI Gateway: Cloudflare dashboard › AI › AI Gateway › Create gateway, named `void-starter` (or the value of `AI_GATEWAY_ID`). Workers AI rejects a gateway id the account doesn't have, and the chat answers `503` saying so. One gateway serves both dev and production.

1. `pnpm connect` runs `void connect --platform cloudflare`. It signs you in to Cloudflare in the browser and records the choice in `apps/web/.void/project.json`. That file is gitignored, so each clone connects once.
2. `pnpm run deploy` runs `void deploy`. It builds the app, creates the D1 database and R2 bucket on the first run, binds Workers AI, applies pending D1 migrations and publishes the Worker. It prints the `workers.dev` URL when it's done.

`pnpm deploy` is pnpm's own command for copying a workspace package, so the script is called with `pnpm run deploy`.

On this starter's first deploy, the Worker went live with its `workers.dev` route off (Cloudflare error 1042), and later deploys failed Void's readiness check because the new version had no preview URL. If that happens, open Workers & Pages › your Worker › Settings › Domains & Routes in the dashboard, enable `workers.dev` and Preview URLs, then deploy again with your account's subdomain:

```sh
CLOUDFLARE_WORKERS_SUBDOMAIN=<your-subdomain> pnpm run deploy
```

`void.config.ts` ships with `workers_dev: false`, so the public `workers.dev` route stays closed and nobody can spend the account's Workers AI allowance through it. Set it to `true` to open the app. `preview_urls: true` stays on either way: `void deploy` checks each new version's `/__void/ready` through its preview URL before it shifts traffic, and each version's preview URL (`<version>-<worker>.<subdomain>.workers.dev`) stays reachable.

`void deploy` writes `apps/web/void.lock.json` with your account id and the resources it created. The starter repo ignores it so no fork inherits someone else's account. In your own app, delete the `apps/web/void.lock.json` line from `.gitignore` and commit the file, so later deploys and teammates reuse the same database and bucket.

## Secrets and env

The app reads no secrets. When you add one, declare it in `apps/web/env.ts` with `defineEnv`, put the local value in `apps/web/.env`, and set the production value with `pnpm --filter web exec void secret put <NAME>`. `void secret list` shows what's set.

## AI Gateway and models

Workers AI calls name the gateway on every request (`AI_GATEWAY_ID` in `apps/web/src/server/ai.ts`, default `void-starter`). The gateway must exist first; see [First deploy](#first-deploy). Its logs, analytics, caching and rate limits live under AI › AI Gateway in the dashboard.

The model picker lists `@cf/*` models from `apps/web/src/lib/models.ts`. They need no provider key: usage counts against the account's Workers AI allowance, measured in neurons. Some models need access the account may not have; `@cf/google/gemma-3-12b-it`, for one, answered `403` ("This account is not allowed to access") on the account this starter was built with. Try a model in dev before you add it.

### Usage limits

There are no accounts, so once the `workers.dev` route is on, anyone with the URL can send messages. On the Workers Free plan, Workers AI stops at the daily free allowance and the chat answers `429`. On Workers Paid, usage past the allowance is billed. Set a rate limit on the gateway (AI Gateway › Settings › Rate limiting) before you share the URL widely.

### Provider models

`ai.provider(name).fetch(path, init)` calls a provider's native API (OpenAI, Google AI Studio, or a custom provider) through the same gateway, with your own key. Store the key as a secret and declare it in `env.ts`, then set `ai: { gateway }` in `void.config.ts`:

```sh
pnpm --filter web exec void secret put OPENAI_API_KEY
```

```ts
import { ai } from "void/ai"

const response = await ai.provider("openai").fetch("/chat/completions", {
  body: { model: "gpt-4o", messages: [{ role: "user", content: prompt }] },
})
```

## Analytics

Nothing is tracked by default. For page views, turn on [Cloudflare Web Analytics](https://developers.cloudflare.com/web-analytics/) for the Worker's domain. It sets no cookies, so it needs no consent banner.

## Logs and rollback

```sh
pnpm --filter web exec void project logs       # tail the deployed Worker's logs
pnpm --filter web exec void project rollback   # return to an earlier version
```

Rollback restores code, not data. D1 migrations stay applied, so keep each migration compatible with the code before it. See [observability.md](observability.md) for traces.

## CI

`.github/workflows/ci.yml` runs two jobs in parallel on every pull request and push to `main`. `verify` runs `pnpm verify`. `e2e` installs Playwright Chromium and runs `pnpm e2e --screenshots`; it makes no AI requests and needs no Cloudflare account. When it fails, the run keeps `.verification/` for 7 days as the `e2e-evidence` artifact. Dependabot (`.github/dependabot.yml`) bumps the actions monthly.

Deploying from CI needs a Cloudflare API token; it isn't set up here.
