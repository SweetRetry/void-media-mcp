# Guardrails

What the codebase checks for an agent, so the agent spends its judgment on design and leaves mechanical rules to tools. Every check has one entry point in the root `package.json`, and hooks, CI and people all call that same command.

## When each check runs

| Check               | Command             | Pre-commit | Pre-push | `pnpm verify` and CI |
| :------------------ | :------------------ | :--------- | :------- | :------------------- |
| Format              | `pnpm format:check` | fixes      |          | yes                  |
| Markdown structure  | `pnpm md:check`     | fixes      |          | yes                  |
| Lint                | `pnpm lint`         |            |          | yes                  |
| Rule scans          | `pnpm rules:check`  | yes        |          | yes                  |
| Types               | `pnpm typecheck`    |            | yes      | yes                  |
| Unit tests          | `pnpm test`         |            | yes      | yes                  |
| Build               | `pnpm build`        |            |          | yes                  |
| Unused code         | `pnpm knip`         |            |          | yes                  |
| Browser smoke tests | `pnpm e2e`          |            |          | CI only              |

Hooks come from `lefthook.yml` and install with `pnpm install`. Pre-commit formats staged files and re-stages them, so a commit never fails on formatting. Lint is not in a hook. An agent runs `pnpm lint` itself or meets it in `pnpm verify`.

`pnpm verify` is the gate before calling a change done. Hooks are a fast subset of it and never replace it.

## What each check catches

- **Format.** Oxfmt via `vp fmt`, configured in `vite.config.ts` › `fmt`. It owns layout for code and Markdown. Run `pnpm format` and don't hand-format.
- **Markdown structure.** markdownlint, configured in `.markdownlint-cli2.jsonc`. It adds only what Oxfmt has no opinion on: fence languages, heading levels, links, table alignment. `pnpm md:fix` repairs most of it.
- **Lint.** Oxlint via `vp lint`, configured in `vite.config.ts` › `lint`, with the typescript, react, jsx-a11y and import plugins. `@shadcn/lint` enforces the `packages/ui` boundary at call sites:
  - `shadcn/no-restyle` bans appearance classes on atomic `@workspace/ui` controls while allowing layout classes, and opens `spacing`, `rounded` or `typography` on structural and text slots per the `contracts` in `vite.config.ts`.
  - `shadcn/no-raw-colors`, `shadcn/no-arbitrary-values` and `shadcn/no-inline-styles` keep colors and values on the design tokens.
  - `shadcn/no-unknown-classes` and `shadcn/require-static-classes` keep class names known and statically readable.
  - `apps/web/src/components/{agents,scroll-rail,ui}` is the app's own component library and is exempt from the color, value and inline-style rules. `no-restyle` still applies there.
- **Rule scans.** `pnpm rules:check` runs three scans with no room for judgment:
  - `zod:check` fails on Zod v3 patterns and deprecated APIs ([rules/zod-v4/README.md](rules/zod-v4/README.md)).
  - `ui:check` runs the [sweet-mode](../.agents/skills/sweet-mode/SKILL.md) scanner. It fails on fields joined by `·`, `transition-all`, transitions on layout properties, `ease-in`, entering from `scale: 0`, z-index off the `-z-10` to `z-50` ladder, hard-coded colors and Tailwind palette colors in classes, call-site shadows, decorative gradients and blur glows, static text faded with opacity, arbitrary font sizes and families, weights off the ladder, horizontal `<Separator />` and a Card inside a Card. It skips `packages/ui`, `components/ui`, tests and skill directories.
  - `skills:check` fails when a copied skill drifted from its source. `.agents/skills/void` must match the installed `void` package byte for byte. `.agents/skills/sweet-mode` must match the hash recorded in `.agents/skills/skills-lock.json`.
- **Types.** `tsc --noEmit` per workspace through Turborepo, with `strict` and `noUncheckedIndexedAccess`. In `apps/web` it runs `void prepare` first, which generates the binding types.
- **Unit tests.** Vitest via `vp test`, one project per app and package. Tests call pure modules and never start a container.
- **Build.** The production build of every workspace, the same one `pnpm deploy` ships.
- **Unused code.** knip, configured in `knip.json`. It fails on unused files, exports and dependencies in every workspace, `packages/ui` included, where the entry points are the same files its `exports` map publishes. Delete what it reports, or add a real entry point to `knip.json` when the file is loaded by a tool. Copied skills under `.agents/skills/` are ignored. Their files run outside the build, and `pnpm skills:check` owns them.
- **Browser smoke tests.** `pnpm e2e` drives a disposable local app with Playwright and writes evidence to `.verification/`. Details are in the [verification skill](../.agents/skills/verify-web/SKILL.md).

## Dependencies

`pnpm audit` is not part of `pnpm verify`; run it when bumping. Advisories that arrive through a transitive tree are fixed with `overrides` in `pnpm-workspace.yaml`, not by editing a dependency of a dependency. Two stay open on purpose.

- `braces` has no patched release, so it waits for `markdownlint-cli2` and `shadcn` to drop `micromatch`.
- `esbuild` 0.18.20 is pinned by `drizzle-kit`'s deprecated `@esbuild-kit` loader, and an override cannot cross that major. It is reachable only from `void`'s CLI.

Both are dev-only and never reach the Worker. `minimumReleaseAge` keeps pnpm's one-day cooldown; an override that needs a release younger than that is added to `minimumReleaseAgeExclude` with the same version.

`@shadcn/lint` stays on `0.1.x`. `0.2` widened `shadcn/no-restyle` and flags the composer's model picker in `apps/web/src/components/agents/prompt-input/model-picker.tsx`, which styles its own `DropdownMenuTrigger`. Moving that look into a `packages/ui` variant is a design change, so it waits for one.

## When a check fails

Fix the cause the message names. Every scan prints the file, the rule and the replacement.

- Don't silence a check to get green. No `--no-verify`, no new `ignorePatterns`, no `oxlint-disable` comment, no rule turned off. A rule that is wrong for a whole area is a config change to propose, as the component-library override above shows.
- Copied skills are never edited here. Drift after a `void` upgrade is expected, so run `pnpm skills:update` and commit the copy with the upgrade. A change to sweet-mode goes to [SweetRetry/retry-kit](https://github.com/SweetRetry/retry-kit/tree/main/skills) first, then `pnpm skills:update` pulls it.
- A hook skip with `git commit --no-verify` or `LEFTHOOK=0` is for a human who knows why. CI still runs the full gate.

## What no tool checks

Judgment stays in review: spacing optics, composition, copy, API response shape and whether a component belongs in `packages/ui`. The checklists for those are routed from [AGENTS.md](../AGENTS.md). [rules/README.md](rules/README.md) explains why a rule becomes a scan only when its boundary is sharp.
