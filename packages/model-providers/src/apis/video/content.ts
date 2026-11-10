import { mediaOf, type Reference } from "../../lib/input"

/** A reference as a `content` item. Ark and MiniMax share this shape. The media kind picks the key, the role picks the spelling. */
export function contentOf(reference: Reference) {
  const media = mediaOf(reference)
  const role =
    reference.role === "first-frame"
      ? "first_frame"
      : reference.role === "last-frame"
        ? "last_frame"
        : `reference_${media}`
  const key = `${media}_url`
  return { type: key, [key]: { url: reference.url }, role }
}
