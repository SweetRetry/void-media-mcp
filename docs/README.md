# Docs

`docs/` answers "what is this", "how do I use it" and "what must I follow". It is the system knowledge base for developers and agents.

```text
docs/
  architecture.md   the stack, the decisions behind it, and where code lives
  api.md            the HTTP error contract and every error code
  deployment.md     Cloudflare deploy, secrets, OAuth, AI Gateway, rollback
  observability.md  logs and traces, locally and in production
  guardrails.md     the hooks, lint and scans that check an agent's work, and what to do when one fails
  future/           plans not decided yet, each with the signal that would trigger it
  rules/            engineering constraints in force, with their gates
```

Routing across the repo (docs, rules, scripts) lives in [AGENTS.md](../AGENTS.md).
