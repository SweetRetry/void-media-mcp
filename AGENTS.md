# Obscura

A remote MCP server for image, video and audio generation, in a Turborepo + pnpm workspace. It deploys one Cloudflare Worker with [Void](https://github.com/voidzero-dev/void) and TanStack Start. See README.md for what it does.

## Where things go

Route content by kind: system and usage knowledge → `docs/`; plans not decided yet → `docs/future/`; engineering constraints → `docs/rules/`; repo tooling → `scripts/`. Read `docs/rules/README.md` before adding or changing a rule.

## Vocabulary

- Read [CONTEXT.md](CONTEXT.md) before discussing requirements, designing or naming code, and use its terms.
- When a discussion adds a term, settles an ambiguity or corrects a meaning, update `CONTEXT.md` right away. This is standing permission, even in a pure discussion, unless the user says not to touch files.
- Record only meanings the user confirmed or that the docs and code show. When usage conflicts with the glossary and it matters for the decision at hand, point out the difference and settle it before updating. Never write a guess into the glossary.
- One or two sentences per entry, covering the meaning and its boundary. Note aliases, and list easily confused words under _Avoid_. `CONTEXT.md` holds current definitions only; designs, implementation notes and discussion go where the routing above says.

## Architecture

- `apps/*` own entry points, composition and app-specific business code. `packages/*` hold only capabilities that several apps or processes already share, never what might be reused someday. Cross package boundaries only through public `exports`.
- `packages/ui` owns each atomic control's **own appearance**: height, padding, radius, color and type come from its variants (`variant` / `size`), while call sites pass only layout classes (margin, width, flex or grid placement) and props. Container and typography slots (`Card*`, `Dialog*`, `Table*`, `Field*`) allow `spacing`, concentric `rounded` or `typography` per the `contracts` in `vite.config.ts`.
- A new look goes where its reuse is: a `cva` variant in `packages/ui/src/components/*` when shared across views, otherwise an app component.
- Changes to `packages/ui/src/styles/globals.css` and `retry.css` need **HITL** (a human confirms first): they hold the global theme and Retry tokens specified in `DESIGN.md`. Agents never change them silently; propose first and wait for explicit approval.
- Before building something, check the docs, types and extension points of the dependencies already here. Prefer maintained, production-proven libraries.
- Tests never start or depend on a container runtime. Integration checks that need outside resources run in an explicit integration environment.
- Directory names carry the grouping. Inside a directory that already names the domain, a file name says only its own job: `server/notes.functions.ts`, not `server/server-notes-functions.ts`.
- `*.server.ts` modules are server-only. Server functions (`createServerFn`) live in `*.functions.ts` and may import them; components and `src/lib` never do.

[docs/architecture.md](docs/architecture.md) describes each app and package, the request path and the decisions behind the stack.

## Rules by trigger

| Trigger                                             | Read first                                                                                                           |
| :-------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------- |
| Void: bindings, CLI, config, deploy                 | [.agents/skills/void/SKILL.md](.agents/skills/void/SKILL.md); its `docs/` live in `apps/web/node_modules/void/docs/` |
| Using Zod or changing validation                    | `docs/rules/zod-v4/README.md`                                                                                        |
| Frontend UI: screens, layout, motion, components    | [DESIGN.md](DESIGN.md)                                                                                               |
| Env vars, secrets, deploy, AI Gateway               | [docs/deployment.md](docs/deployment.md)                                                                             |
| What a request actually did: logs, traces, `cf-ray` | [docs/observability.md](docs/observability.md)                                                                       |

## Tech choices

One option per concern. Don't add alternatives.

- Framework: TanStack Start on Void (framework mode). Bindings come from `void/db`, `void/storage`, `void/ai`.
- Database: D1 through Drizzle. Auth: Better Auth with `mcp()` as the OAuth server for MCP clients.
- Client state: zustand. Toasts: sonner.
- Motion: motion (`motion/react`) or Tailwind CSS transitions.
- Forms: react-hook-form + zod + @hookform/resolvers, rendered with shadcn/ui `Field` and `Controller` (Base UI has no `Form` component).
- Icons: lucide-react (installed in `packages/ui`).
- Dates: dayjs.

## Verification

- [docs/guardrails.md](docs/guardrails.md) lists every hook, lint rule and scan, when it runs and what to do when one fails.
- After a code change, `pnpm verify` is the one full gate. It runs `format:check`, `md:check`, `lint`, `rules:check`, `typecheck`, `test`, `build` and `knip`. Day-to-day commands are in the root `package.json`.
- Oxfmt shapes Markdown; markdownlint adds only structural rules (fence languages, heading levels, links), configured in `.markdownlint-cli2.jsonc`. Keep them from overlapping, or the two commands keep rewriting the same file.
- Git hooks come from the root `lefthook.yml` and install with `pnpm install`. Pre-commit runs Oxfmt and markdownlint on staged files (and re-stages them) plus `rules:check`. Pre-push runs typecheck and test. Hooks are a subset of `pnpm verify` and don't replace CI. Skip them with `git commit --no-verify` or `LEFTHOOK=0`.
