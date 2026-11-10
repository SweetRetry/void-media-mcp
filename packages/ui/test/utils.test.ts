import { describe, expect, it } from "vite-plus/test"

import { cn } from "../src/lib/utils.ts"

/**
 * `cn`'s merge semantics are an implicit contract of every component: each one is written as
 * `cn(variants({ variant, size, className }))`, so the caller's className overrides the variant.
 * The merge engine moved from clsx + tailwind-merge to the cn package, and a mistake there is a
 * silent visual regression, so the contract is pinned here.
 */
describe("cn", () => {
  it("the later class wins for the same property", () => {
    expect(cn("p-2", "p-4")).toBe("p-4")
    expect(cn("p-4", "p-2")).toBe("p-2")
    expect(cn("rounded-md", "rounded-full")).toBe("rounded-full")
    expect(cn("flex items-center", "items-start")).toBe("flex items-start")
  })

  it("classes under different variants both stay", () => {
    expect(cn("hover:p-2", "p-4")).toBe("hover:p-2 p-4")
  })

  it("arbitrary and scale values override each other", () => {
    // These arbitrary values are inputs to the merge, not styles, so the design rule is waived.
    // eslint-disable-next-line shadcn/no-arbitrary-values
    expect(cn("p-[13px]", "p-3")).toBe("p-3")
    // eslint-disable-next-line shadcn/no-arbitrary-values
    expect(cn("p-3", "p-[13px]")).toBe("p-[13px]")
  })

  it("keeps clsx conditional semantics", () => {
    expect(cn("px-2", false, undefined, null)).toBe("px-2")
    expect(cn("px-2", { "text-white": true, hidden: false })).toBe("px-2 text-white")
    expect(cn(["px-2", ["py-1"]])).toBe("px-2 py-1")
  })

  it("a caller className overrides the component variant", () => {
    expect(cn("h-9 px-4 py-2", "px-6")).toBe("h-9 py-2 px-6")
  })

  it("a missing className adds no literal undefined", () => {
    expect(cn("px-2", undefined)).toBe("px-2")
  })
})
