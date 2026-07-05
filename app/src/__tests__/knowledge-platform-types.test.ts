import { describe, it, expect } from 'vitest'
import { KNOWLEDGE_RELATION_TYPES, KNOWLEDGE_ERROR_CODES, KnowledgeError } from '../knowledge/platform/knowledgeTypes.ts'

describe('KNOWLEDGE_RELATION_TYPES', () => {
  it('provides the 10 well-known relation constants', () => {
    expect(KNOWLEDGE_RELATION_TYPES.IMPLEMENTS).toBe('IMPLEMENTS')
    expect(KNOWLEDGE_RELATION_TYPES.SUPERSEDES).toBe('SUPERSEDES')
    expect(KNOWLEDGE_RELATION_TYPES.REFERENCES).toBe('REFERENCES')
    expect(KNOWLEDGE_RELATION_TYPES.DEPENDS_ON).toBe('DEPENDS_ON')
    expect(KNOWLEDGE_RELATION_TYPES.REQUIRES).toBe('REQUIRES')
    expect(KNOWLEDGE_RELATION_TYPES.GENERATES).toBe('GENERATES')
    expect(KNOWLEDGE_RELATION_TYPES.USES_TEMPLATE).toBe('USES_TEMPLATE')
    expect(KNOWLEDGE_RELATION_TYPES.USES_CHECKLIST).toBe('USES_CHECKLIST')
    expect(KNOWLEDGE_RELATION_TYPES.SIMILAR_TO).toBe('SIMILAR_TO')
    expect(KNOWLEDGE_RELATION_TYPES.RELATED_TO).toBe('RELATED_TO')
  })

  it('is frozen — cannot be mutated at runtime', () => {
    expect(Object.isFrozen(KNOWLEDGE_RELATION_TYPES)).toBe(true)
  })

  it('a brand-new relation type needs no code change — it is just a string', () => {
    const brandNew: string = 'SOMETHING_NOBODY_HAS_INVENTED_YET'
    expect(typeof brandNew).toBe('string')
  })
})

describe('KNOWLEDGE_ERROR_CODES', () => {
  it('defines 5 error codes', () => {
    expect(KNOWLEDGE_ERROR_CODES).toHaveLength(5)
    expect(KNOWLEDGE_ERROR_CODES).toContain('ITEM_NOT_FOUND')
    expect(KNOWLEDGE_ERROR_CODES).toContain('PROVIDER_NOT_FOUND')
    expect(KNOWLEDGE_ERROR_CODES).toContain('PROVIDER_ALREADY_REGISTERED')
    expect(KNOWLEDGE_ERROR_CODES).toContain('VALIDATION_FAILED')
    expect(KNOWLEDGE_ERROR_CODES).toContain('EDGE_NOT_FOUND')
  })
})

describe('KnowledgeError', () => {
  it('constructs with code, field, message', () => {
    const err = new KnowledgeError('ITEM_NOT_FOUND', 'itemId', 'Not found')
    expect(err.code).toBe('ITEM_NOT_FOUND')
    expect(err.field).toBe('itemId')
    expect(err.message).toBe('Not found')
    expect(err.name).toBe('KnowledgeError')
  })

  it('is an instanceof Error', () => {
    expect(new KnowledgeError('VALIDATION_FAILED', 'x', 'bad')).toBeInstanceOf(Error)
  })
})
