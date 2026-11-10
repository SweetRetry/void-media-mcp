import { describe, expect, it } from "vite-plus/test"

import { controlsOf, models, usdOf } from "../src/index.ts"

describe("usd", () => {
  it("converts a CNY price at the pinned rate and multiplies by units", () => {
    expect(usdOf({ amount: 7.2, currency: "CNY", per: "output" })).toBe(1)
    expect(usdOf({ amount: 0.1, currency: "USD", per: "second" }, 5)).toBeCloseTo(0.5)
  })
})

describe("catalog", () => {
  it("names every model once, because prices and records key on the name", () => {
    const names = models.map((model) => model.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it("identifies every model once by its API id per provider", () => {
    const ids = models.map((model) => `${model.provider}/${model.id}`)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("keeps every default inside the values its control offers", () => {
    for (const model of models) {
      for (const control of controlsOf(model.params)) {
        const where = `${model.name} › ${control.key}`
        if ("options" in control)
          expect(control.options as unknown[], where).toContain(control.default)
        if ("min" in control) {
          expect(control.default, where).toBeGreaterThanOrEqual(control.min)
          expect(control.default, where).toBeLessThanOrEqual(control.max)
        }
      }
    }
  })

  it("keys every variant on a control the model has, and every variant price on one of its values", () => {
    for (const model of models) {
      if (model.price && "byVariant" in model.price) expect(model.variant, model.name).toBeDefined()
      if (!model.variant) continue
      const spec = model.params[model.variant]
      expect(spec, model.name).toBeDefined()
      if (model.price && "byVariant" in model.price) {
        for (const value of Object.keys(model.price.byVariant)) {
          expect(spec!.options as readonly string[], model.name).toContain(value)
        }
      }
    }
  })
})
