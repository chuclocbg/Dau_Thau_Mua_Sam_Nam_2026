/**
 * Prisma `Decimal` fields (used for monetary/quantity precision, TD-05) come back
 * from the client as `Decimal.js` instances, not plain JS numbers — but most domain
 * types in this codebase predate that column type and declare `number`. This helper
 * converts every top-level Decimal-shaped value on a row back to `number` so
 * repository read paths satisfy their TS domain type exactly.
 *
 * Not used for the newer `Money`-typed fields (Payment module), which map to Prisma
 * `BigInt` and are handled by `bigIntToNumber`/mapping in that module's own
 * repository — bigint has no precision loss converting to/from the client, unlike
 * Decimal, so it needs no special helper.
 */

interface DecimalLike {
  toNumber(): number
}

function isDecimalLike(value: unknown): value is DecimalLike {
  return typeof value === 'object' && value !== null && typeof (value as DecimalLike).toNumber === 'function'
}

/** Shallow-convert every Decimal-shaped top-level field of a Prisma row to a plain number. */
export function convertDecimalFields<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row }
  for (const key of Object.keys(out)) {
    if (isDecimalLike(out[key])) {
      out[key] = out[key].toNumber()
    }
  }
  return out as T
}

/** Convert a single Decimal-shaped value (or null/undefined) to number, preserving null/undefined. */
export function decimalToNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined
  return isDecimalLike(value) ? value.toNumber() : (value as number)
}

// ── Date ↔ ISO string ──────────────────────────────────────────────────────────
// Prisma `DateTime` columns round-trip as JS `Date` instances, but every domain
// type in this codebase predates that and declares ISO 8601 `string`. Converted
// alongside Decimal in the same row-mapping pass below.

function isDateLike(value: unknown): value is Date {
  return value instanceof Date
}

/**
 * Shallow-convert every Decimal-shaped and Date-shaped top-level field of a Prisma
 * row to, respectively, `number` and ISO `string` — the two most common mismatches
 * between a Prisma row and this codebase's domain types. `null` is preserved as-is.
 */
export function mapPrismaRow<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row }
  for (const key of Object.keys(out)) {
    const value = out[key]
    if (isDecimalLike(value)) out[key] = value.toNumber()
    else if (isDateLike(value)) out[key] = value.toISOString()
  }
  return out as T
}
