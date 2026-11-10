# Scripts

Repo tooling. Each script states its purpose, usage, inputs, outputs and failure mode in its header comment. Common operations are exposed as root `package.json` scripts, so CI and people call the same entry point.

| Script            | Entry point         | Purpose                                                                                          |
| :---------------- | :------------------ | :----------------------------------------------------------------------------------------------- |
| `agent-skills.js` | `pnpm skills:check` | Check the copied skills in `.agents/skills` against their sources; `skills:update` rewrites them |

`pnpm e2e` runs `e2e.js` and its Playwright driver `e2e-browser.js` against a disposable local app. Install headless Chromium with `pnpm exec playwright install --only-shell chromium`. Runs write retained evidence to `.verification/` and need no agent-specific browser service. The [verification skill](../.agents/skills/verify-web/SKILL.md) owns launch details, feature coverage and connected journeys for agents.

App runtime code stays in `apps/` or `packages/`. Schema changes go through migrations, not scripts.
