# Rules

`docs/rules/` holds the engineering constraints in force, each routed from [AGENTS.md](../../AGENTS.md) by its trigger.

## Writing a rule

- State how to choose, where the rule applies and its exceptions. Keep the tables, parameters and short examples that change a decision.
- For a discrete domain (type sizes, radii, durations), list every allowed value with its use, and forbid everything else. A table without the ban becomes a reference manual.
- Every line should let the reader make one decision. Write a mechanism as a condition, not as history.
- Say each constraint once.
- Implementation values live in code and config. API details live in docs and types. Don't copy them here.
- Shortening a rule must not change it. Changing a threshold or scope is a change to say out loud.
- Every rule needs an entry in AGENTS.md. One rule is one Markdown file; a directory only when it ships a script.

## Verification

- **Tests and types first.** An invariant that can run as a test or a type is written as one. Visual and product judgment is checked in review.
- **Few source scans.** A scan joins `pnpm rules:check` only when its boundary is sharp and false positives are rare. Today: `zod:check` (deprecated Zod APIs), `ui:check` (the sweet-mode scanner for motion, z-index, color and type bans), `skills:check` (the copied agent skills). `vp lint` runs `@shadcn/lint` for call-site restyling, raw colors and arbitrary values.
- **No heuristic regex.** Everything else (spacing optics, composition, API response shape) is judged against the checklists, so nobody writes code just to pass a scanner.
