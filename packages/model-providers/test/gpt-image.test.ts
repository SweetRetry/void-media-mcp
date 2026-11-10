import { describe, expect, it } from "vite-plus/test"

import { outputTokens } from "../src/lib/gpt-image.ts"

/** Literal values from OpenAI's calculator. 2.5 at low, 1024x1024, is 196 tokens, as Tu-zi reported. */
describe("GPT Image output tokens", () => {
  it("counts 2.5 tokens by size and quality, without a factor", () => {
    expect(outputTokens("gpt-image-2.5", "1:1", "low")).toBe(196)
    expect(outputTokens("gpt-image-2.5", "3:2", "low")).toBe(158)
    expect(outputTokens("gpt-image-2.5", "1:1", "high")).toBe(1756)
    expect(outputTokens("gpt-image-2.5", "1:1", "max")).toBe(7024)
  })

  it("counts 2.6 tokens with its factor at low and medium", () => {
    expect(outputTokens("gpt-image-2.6", "1:1", "low")).toBe(823)
    expect(outputTokens("gpt-image-2.6", "3:2", "low")).toBe(664)
    expect(outputTokens("gpt-image-2.6", "16:9", "low")).toBe(588)
    expect(outputTokens("gpt-image-2.6", "1:1", "medium")).toBe(1449)
    expect(outputTokens("gpt-image-2.6", "1:1", "high")).toBe(1756)
  })
})
