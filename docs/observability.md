# Observability

The Worker's logs and traces are the record of what a request did. The `traceId` ties a user's error report to that record: every `/api/*` `500` carries it, and the `api.failed` log holds the same value ([api.md](api.md)). Through Cloudflare's edge it is the request's `cf-ray` id.

## Logging

- Log server events with `logger` from `void/log`. Each call writes one JSON line, which Workers Logs captures, indexes by field and attaches to the request's trace.
- Name events with a short dotted key and put the data in fields: `logger.error("api.failed", { path, error })`. The event name lands in the `msg` field.
- Pass an `Error` as is. `logger` keeps its `name`, `message`, `stack` and `cause`.
- `logger.child(fields)` binds fields shared by a group of calls, such as `{ chatId }`.
- Browser code keeps `console`; its logs never reach Workers Logs.
- Never log secrets, cookies, session tokens, passwords or full request bodies.

## Local dev

The Cloudflare Vite plugin records every request's spans and logs while `pnpm dev` runs. Browse them at <http://localhost:5173/cdn-cgi/local/explorer/>, or query them with SQL:

```sh
curl -s http://localhost:5173/cdn-cgi/local/explorer/api/local/observability/query \
  -H 'content-type: application/json' \
  -d '{"sql": "select trace_id, level, message from logs where level = '\''error'\'' order by ts_ms desc limit 5"}'
```

Two tables hold the data:

| Table   | Columns                                                                                                                    |
| :------ | :------------------------------------------------------------------------------------------------------------------------- |
| `spans` | `trace_id`, `span_id`, `parent_id`, `service`, `name`, `kind`, `start_ms`, `duration_ms`, `outcome`, `error`, `attributes` |
| `logs`  | `trace_id`, `span_id`, `seq`, `ts_ms`, `level`, `message`, `operation`                                                     |

A request's root span has `parent_id` null. Join `logs` to `spans` on `trace_id` to see what one request logged:

```sql
select s.name, s.duration_ms, l.level, l.message
from spans s join logs l on l.trace_id = s.trace_id
where s.parent_id is null and l.level = 'error'
order by l.ts_ms desc limit 10;
```

Local requests have no `cf-ray`, so a local `500` carries a random UUID as its `traceId`. Find the `api.failed` log that holds it, or search by time or path.

## Production

`void.config.ts` turns on Workers Logs and Traces through the Wrangler `observability` settings:

```ts
cloudflare: {
  observability: {
    enabled: true,
    logs: { enabled: true, invocation_logs: true },
    traces: { enabled: true },
  },
},
```

- **Dashboard.** Workers & Pages › your Worker › Observability shows logs and traces. Filter by the ray id from an error's `traceId`.
- **Live tail.** `pnpm --filter web exec void project logs` streams logs from the deployed Worker.
- **AI.** AI Gateway's logs show each model call, with its latency, tokens and cache status.
