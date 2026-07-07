import { describe, it, expect } from 'vitest'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { loadEnvironmentSecrets } from '../startup/loadEnvironmentSecrets.ts'

describe('loadEnvironmentSecrets — genuine dotenv reuse', () => {
  it('loads variables from a real .env-style file into process.env', () => {
    const path = join(process.cwd(), `.env.test-scratch-${Date.now()}`)
    writeFileSync(path, 'X94_SCRATCH_VAR=hello-world\n')
    try {
      const result = loadEnvironmentSecrets(path)
      expect(result.loaded).toBe(true)
      expect(process.env['X94_SCRATCH_VAR']).toBe('hello-world')
    } finally {
      unlinkSync(path)
      delete process.env['X94_SCRATCH_VAR']
    }
  })

  it('reports loaded:false (never throws) when the file does not exist', () => {
    const path = join(process.cwd(), '.env.definitely-does-not-exist')
    expect(() => loadEnvironmentSecrets(path)).not.toThrow()
    const result = loadEnvironmentSecrets(path)
    expect(result.loaded).toBe(false)
    expect(typeof result.error).toBe('string')
  })
})
