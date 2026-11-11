import { switchedOff } from "@db/schema"
import type { MediaModel } from "@workspace/model-providers"
import { and, db, eq } from "void/db"

/** What the admin turned off: model ids and provider ids. */
export type Off = { models: Set<string>; providers: Set<string> }

export type SwitchKind = (typeof switchedOff.$inferSelect)["kind"]

export async function offOf(): Promise<Off> {
  const rows = await db.select().from(switchedOff)
  const ids = (kind: SwitchKind) => new Set(rows.filter((r) => r.kind === kind).map((r) => r.id))
  return { models: ids("model"), providers: ids("provider") }
}

/** A model is on when neither it nor its provider is off. */
export const isOn = (off: Off, model: MediaModel) =>
  !off.models.has(model.id) && !off.providers.has(model.provider)

/** Turns an entry on or off. Idempotent: setting the state it already has changes nothing. */
export async function setSwitch(kind: SwitchKind, id: string, on: boolean) {
  if (on)
    await db.delete(switchedOff).where(and(eq(switchedOff.kind, kind), eq(switchedOff.id, id)))
  else await db.insert(switchedOff).values({ kind, id }).onConflictDoNothing()
}
