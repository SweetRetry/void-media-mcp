import type { MediaModel } from "./model"
import { defaultsOf, type Params } from "./params"

/** What a price bills. An output is one delivered image. A call is one request. */
export type PriceUnit = "output" | "second" | "call" | "million-tokens"

/** The provider's price in the currency it bills. Not converted when authored. */
export type Price = {
  amount: number
  currency: "CNY" | "USD"
  per: PriceUnit
}

/** A price per variant value. A value left out has no published price. */
export type VariantPrices = { byVariant: Readonly<Record<string, Price>> }

/** Price per million output tokens, for models whose token count depends on params (GPT Image's size and quality). */
export type OutputTokenPrice = {
  currency: "USD"
  perMillion: number
  /** Null when the params do not fix the count, so the run has no quote. */
  tokensOf: (params: Partial<Params>) => number | null
}

/** CNY to USD rate the price list pins. Revisit when it moves 3%. */
export const CNY_PER_USD = 7.2

/** US dollars for `units` of what the price bills: seconds, outputs or millions of tokens. Null when unpublished. */
export function usdOf(price: Price | null, units = 1): number | null {
  if (!price) return null
  const dollars = price.currency === "CNY" ? price.amount / CNY_PER_USD : price.amount
  return dollars * units
}

/** Provider price of one run: the flat price, or the price of the chosen variant value. Null when unpublished. */
export function priceOf(model: MediaModel, params: Partial<Params> = {}): Price | null {
  const { price, variant } = model
  if (!price) return null
  if ("tokensOf" in price) {
    const tokens = price.tokensOf({ ...defaultsOf(model.params), ...params })
    if (tokens === null) return null
    return {
      amount: (tokens * price.perMillion) / 1_000_000,
      currency: price.currency,
      per: "output",
    }
  }
  if (!("byVariant" in price)) return price
  if (!variant) return null
  const value = params[variant] ?? model.params[variant]?.default
  return value === undefined ? null : (price.byVariant[value] ?? null)
}
