# Zod v4

The project uses Zod v4. Write v4 APIs, never v3 patterns. The installed version is whatever `zod` resolves to in each workspace's `package.json` and in `pnpm-lock.yaml`.

## String formats: standalone constructors

v4 has a standalone constructor per format. It returns a dedicated type (such as `ZodEmail`) instead of `ZodString` plus a check.

| Not this (v3)                                   | Use                                                  |
| ----------------------------------------------- | ---------------------------------------------------- |
| `z.string().email()`                            | `z.email()`                                          |
| `z.string().url()`                              | `z.url()`                                            |
| `z.string().uuid()`                             | `z.uuid()`                                           |
| `z.string().ip()`                               | `z.ipv4()` / `z.ipv6()`                              |
| `z.string().emoji()`                            | `z.emoji()`                                          |
| `z.string().nanoid()`                           | `z.nanoid()`                                         |
| `z.string().cuid()` / `.cuid2()`                | `z.cuid()` / `z.cuid2()`                             |
| `z.string().ulid()`                             | `z.ulid()`                                           |
| `z.string().base64()`                           | `z.base64()`                                         |
| `z.string().datetime()` / `.date()` / `.time()` | `z.iso.datetime()` / `z.iso.date()` / `z.iso.time()` |

## Deprecated APIs

| Deprecated                                     | Replacement                                                 |
| ---------------------------------------------- | ----------------------------------------------------------- |
| `z.nativeEnum(MyEnum)`                         | `z.enum(MyEnum)`, which takes TS enums and objects          |
| `z.ostring()` / `z.onumber()` / `z.oboolean()` | `z.optional(z.string())`                                    |
| `z.TypeOf<T>` / `z.Infer<T>`                   | `z.infer<T>`                                                |
| `z.ZodTypeAny` / `z.ZodSchema` / `z.Schema`    | `z.ZodType`                                                 |
| `ZodIssueCode.xxx`                             | String literals, such as `"invalid_type"`                   |
| `setErrorMap(map)` / `getErrorMap()`           | `z.config({ customError: map })` / `z.config().customError` |
| `schema.deepPartial()`                         | `z.deepPartial(schema)`; the method is gone                 |

## Breaking changes

- `z.record()` takes both a key and a value schema: `z.record(z.string(), z.string())`. Use `z.partialRecord()` when keys needn't be exhaustive.
- `z.function()` takes an object or a chain: `z.function({ input: [...], output })`.
- Error messages use `error`, not `message`: `z.string().min(5, "Too short")`, `z.enum([...], { error: "..." })`, `.refine(fn, { error: "..." })`.
- A `.default()` value must match the output type. Use `.prefault()` when the value matches the input and must pass through a transform.
- `z.number()` rejects `Infinity`. `.int()` accepts only safe integers.
- `.exactPartial()` tells a missing key from an explicit `undefined`.
- `z.iso.datetime()` requires seconds, per RFC 3339. String `.min()`, `.max()` and `.length()` count Unicode code points.
- Objects and records always drop the `__proto__` key.

## Other v4 capabilities

Names only. Signatures live in the official docs and the type definitions.

- Env parsing: `z.stringbool()`, `z.coerce.*`
- Numbers: `z.int()`, `z.int32()` / `z.uint32()` / `z.int64()` / `z.uint64()`, `z.float32()` / `z.float64()`
- Structure: `z.strictObject()` / `z.looseObject()`, `z.xor()`, `z.looseRecord()`, `z.exactOptional()` / `z.nonoptional()`
- Composition: `z.pipe()`, `z.codec()`, `z.input()` / `z.output()`, `z.templateLiteral()`
- Checks and metadata: `z.check()`, `z.describe()` / `z.meta()`, `z.registry()` / `z.globalRegistry`, `z.properties()`, `z.json()`
- More types: `z.file()`, `z.creditCard()`, `z.jwt()`, `z.e164()`, `z.mac()`, `z.hostname()`, `z.hex()`, `z.cidrv4()` / `z.cidrv6()`, `z.xid()` / `z.ksuid()`, `z.uuidv4()` / `z.uuidv6()` / `z.uuidv7()`, `z.guid()`, `z.httpUrl()`
- Conversion: `z.toJSONSchema()` / `z.fromJSONSchema()`
- Boolean fast path: `z.validate()` / `z.validateAsync()`, when you need neither the parsed value nor the issues
- Compilation: `z.compile()`, only on a hot path with benchmark or profiling evidence. App-wide compilation needs `import "zod/compile"` at the entry.

## Check

After changing a schema or validation code:

```sh
pnpm zod:check
```
