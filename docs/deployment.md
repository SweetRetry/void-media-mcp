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

## Domain

The app is served only at `https://obscura.sweetretry.dev`, a Workers custom domain on the `sweetretry.dev` zone (`routes` in `apps/web/void.config.ts`). Cloudflare creates its DNS record and certificate. The `workers.dev` route is off, because `BETTER_AUTH_URL` is the OAuth issuer and the MCP resource, so the app must have one origin. The Worker keeps the name `void-media-mcp` so its D1 database and R2 bucket in `void.lock.json` stay bound.

## Secrets and env

`apps/web/env.ts` declares every value. Put local values in `apps/web/.env` and production values with `pnpm --filter web exec void secret put <NAME>`. `void secret list` shows what's set.

| Name                                       | Production value                                         |
| :----------------------------------------- | :------------------------------------------------------- |
| `BETTER_AUTH_SECRET`                       | 32 random characters or more                             |
| `BETTER_AUTH_URL`                          | `https://obscura.sweetretry.dev`                         |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | The Google OAuth client below                            |
| `ADMIN_EMAILS`                             | The Google addresses allowed to sign in, comma-separated |
| `ARK_API_KEY`, `TUZI_API_KEY`              | Provider keys                                            |

## Google sign-in

Google Cloud Console › APIs & Services. Configure the OAuth consent screen (External, scopes `openid`, `email`, `profile`), then create an OAuth client ID of type Web application with:

- Authorized JavaScript origins: `https://obscura.sweetretry.dev`, `http://localhost:5173`.
- Authorized redirect URIs: `https://obscura.sweetretry.dev/api/auth/callback/google`, `http://localhost:5173/api/auth/callback/google`.

While the consent screen is in Testing, add every admin address as a test user. Better Auth refuses any other address before it writes a user row or a session (`databaseHooks` in `apps/web/src/server/auth/auth.server.ts`).

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

`.github/workflows/ci.yml` runs `verify` (`pnpm verify`) on every pull request and push to `main`. Dependabot (`.github/dependabot.yml`) bumps the actions monthly.

## Continuous deployment

Every push to `main` deploys. The `deploy` job in `ci.yml` runs after `verify` passes and calls `void deploy --platform cloudflare`, the same readiness-gated path as a local deploy: it applies pending D1 migrations, checks the new version through its preview URL and restores the previous one if the check fails. Runs on `main` queue and are never cancelled, so a deploy is not cut off while it applies migrations.

The job reads two repository settings (Settings › Secrets and variables › Actions):

- `CLOUDFLARE_API_TOKEN` (secret). Create it at Cloudflare dashboard › My Profile › API Tokens from the "Edit Cloudflare Workers" template, then add D1 Edit, since deploy applies migrations. Set it with `gh secret set CLOUDFLARE_API_TOKEN`.
- `CLOUDFLARE_ACCOUNT_ID` (variable). The `account_id` in `apps/web/void.lock.json`.

Worker secrets are not part of the job. `void deploy` keeps the ones already set with `void secret put`. A schema change still needs its migration committed (`pnpm db:generate`), or the deploy stops.
