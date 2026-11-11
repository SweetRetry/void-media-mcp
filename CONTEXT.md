# Context

- **Task.** One generation request: a prompt, params and references sent to one model `runs` times. Stored in `generation_task`. _Avoid_: job, generation (ambiguous).
- **Run.** One provider call inside a task. A task is billed per run; a Midjourney run delivers four outputs.
- **Output.** A file a run delivered, copied to R2 under `o/<id>` and served at `/f/<id>.<ext>`.
- **Quote.** The list price of all of a task's runs, computed at submit (`quote_usd`).
- **Cost.** The list price of the runs that delivered, or the provider's reported tokens times the token price (`cost_usd`). Not an invoice.
- **Lost run.** A run whose outcome is unknown (timeout, 5xx, worker died). The provider may have billed it; the audit counts it as possibly billed.
- **Confirming.** A task with a lost run whose provider task may still deliver; it keeps polling for 24 hours.
- **Admin.** The single account. MCP clients act for it after it consents.
- **Off.** A model or provider the admin switched off on the Models page. `list_models` hides it and `generate` refuses it; tasks already running finish. A model whose provider is off is off. _Avoid_: disabled (that is a revoked OAuth client).
