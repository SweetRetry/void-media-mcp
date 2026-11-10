/*
 * The facts read from a stored file an image's size from its header, a video's
 * size and duration from its MP4 boxes. They come from the bytes, never from the request, since a
 * provider can return something other than what was asked.
 */

export type Facts = { width?: number; height?: number; durationMs?: number }

const u16 = (b: Uint8Array, at: number) => (b[at]! << 8) | b[at + 1]!
const u32 = (b: Uint8Array, at: number) =>
  ((b[at]! << 24) >>> 0) + (b[at + 1]! << 16) + u16(b, at + 2)
const le16 = (b: Uint8Array, at: number) => b[at]! | (b[at + 1]! << 8)
const le24 = (b: Uint8Array, at: number) => le16(b, at) | (b[at + 2]! << 16)
const ascii = (b: Uint8Array, at: number, length: number) =>
  String.fromCharCode(...b.subarray(at, at + length))

function png(b: Uint8Array): Facts | null {
  if (ascii(b, 1, 3) !== "PNG" || ascii(b, 12, 4) !== "IHDR") return null
  return { width: u32(b, 16), height: u32(b, 20) }
}

function jpeg(b: Uint8Array): Facts | null {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null
  let at = 2
  while (at + 9 < b.length) {
    if (b[at] !== 0xff) return null
    const marker = b[at + 1]!
    // Start-of-frame markers carry the size; DHT, JPG and DAC share the range but do not.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
      return { height: u16(b, at + 5), width: u16(b, at + 7) }
    at += 2 + u16(b, at + 2)
  }
  return null
}

function webp(b: Uint8Array): Facts | null {
  if (ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 4) !== "WEBP") return null
  const chunk = ascii(b, 12, 4)
  if (chunk === "VP8X") return { width: le24(b, 24) + 1, height: le24(b, 27) + 1 }
  if (chunk === "VP8L") {
    const bits = b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24)
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
  }
  if (chunk === "VP8 ") return { width: le16(b, 26) & 0x3fff, height: le16(b, 28) & 0x3fff }
  return null
}

/** Where each box of `type` starts, with its size, found by its four-letter name. */
function* boxes(b: Uint8Array, type: string) {
  const [c0, c1, c2, c3] = [...type].map((char) => char.charCodeAt(0))
  for (let at = 4; at + 4 <= b.length; at++)
    if (b[at] === c0 && b[at + 1] === c1 && b[at + 2] === c2 && b[at + 3] === c3) {
      const size = u32(b, at - 4)
      if (size >= 8 && at - 4 + size <= b.length) yield [at - 4, size] as const
    }
}

function mp4(b: Uint8Array): Facts | null {
  if (ascii(b, 4, 4) !== "ftyp") return null
  const facts: Facts = {}
  for (const [at] of boxes(b, "mvhd")) {
    const v1 = b[at + 8] === 1
    const scale = u32(b, at + (v1 ? 28 : 20))
    const duration = v1 ? u32(b, at + 36) : u32(b, at + 24)
    if (scale) facts.durationMs = Math.round((duration / scale) * 1000)
    break
  }
  // The first track with a picture: tkhd ends with its width and height in 16.16 fixed point.
  for (const [at, size] of boxes(b, "tkhd")) {
    const width = u32(b, at + size - 8) >>> 16
    const height = u32(b, at + size - 4) >>> 16
    if (width && height) return { ...facts, width, height }
  }
  return facts
}

/** What the bytes say about themselves; an unknown format has no facts. */
export function factsOf(bytes: Uint8Array): Facts {
  return png(bytes) ?? jpeg(bytes) ?? webp(bytes) ?? mp4(bytes) ?? {}
}

/** The format the bytes are in, read from their signature, for a provider that does not name it. */
export function mimeOf(bytes: Uint8Array, fallback: string) {
  if (png(bytes)) return "image/png"
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg"
  if (ascii(bytes, 8, 4) === "WEBP") return "image/webp"
  if (ascii(bytes, 4, 4) === "ftyp") return "video/mp4"
  return fallback
}
