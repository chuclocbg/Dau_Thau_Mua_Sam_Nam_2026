import { describe, it, expect } from 'vitest'
import { readMetadataString } from '../reasoning/application/resolutionMetadataNormalizer.ts'

describe('readMetadataString', () => {
  it('returns the string value when present', () => {
    expect(readMetadataString({ foo: 'bar' }, 'foo')).toBe('bar')
  })

  it('returns undefined when the key is absent', () => {
    expect(readMetadataString({}, 'foo')).toBeUndefined()
  })

  it('returns undefined when the value is not a string (never throws, never coerces)', () => {
    expect(readMetadataString({ foo: 42 }, 'foo')).toBeUndefined()
    expect(readMetadataString({ foo: null }, 'foo')).toBeUndefined()
    expect(readMetadataString({ foo: { nested: true } }, 'foo')).toBeUndefined()
  })
})
