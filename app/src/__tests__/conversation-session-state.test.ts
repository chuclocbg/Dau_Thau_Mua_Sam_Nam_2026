import { describe, it, expect, beforeEach } from 'vitest'
import { SessionStateManager } from '../conversation/application/sessionState.ts'

let manager: SessionStateManager

beforeEach(() => {
  manager = new SessionStateManager('session-1')
})

describe('SessionStateManager', () => {
  it('initializes as CREATED with empty advisorHistory/attachmentRefs', () => {
    const state = manager.current()
    expect(state.status).toBe('CREATED')
    expect(state.advisorHistory).toEqual([])
    expect(state.attachmentRefs).toEqual([])
  })

  it('recordActivity moves CREATED -> ACTIVE', () => {
    const state = manager.recordActivity('legal')
    expect(state.status).toBe('ACTIVE')
    expect(state.advisorHistory).toEqual(['legal'])
  })

  it('recordActivity does not duplicate an advisor already in history', () => {
    manager.recordActivity('legal')
    const state = manager.recordActivity('legal')
    expect(state.advisorHistory).toEqual(['legal'])
  })

  it('recordActivity appends a second, distinct advisor', () => {
    manager.recordActivity('legal')
    const state = manager.recordActivity('procurement')
    expect(state.advisorHistory).toEqual(['legal', 'procurement'])
  })

  it('transitionTo ACTIVE -> IDLE -> ACTIVE is valid', () => {
    manager.recordActivity('legal')
    manager.transitionTo('IDLE')
    const state = manager.transitionTo('ACTIVE')
    expect(state.status).toBe('ACTIVE')
  })

  it('transitionTo throws on an invalid transition (ARCHIVED -> ACTIVE)', () => {
    manager.transitionTo('ARCHIVED')
    expect(() => manager.transitionTo('ACTIVE')).toThrow(/Invalid session transition/)
  })

  it('transitionTo to the same status is a no-op, not an error', () => {
    expect(() => manager.transitionTo('CREATED')).not.toThrow()
  })

  it('isDueForIdle is false unless status is ACTIVE', () => {
    const future = new Date(Date.now() + 60 * 60_000)
    expect(manager.isDueForIdle(future, 30)).toBe(false)
  })

  it('isDueForIdle is true once idleMinutes have elapsed for an ACTIVE session', () => {
    manager.recordActivity('legal')
    const future = new Date(Date.now() + 31 * 60_000)
    expect(manager.isDueForIdle(future, 30)).toBe(true)
  })

  it('isDueForIdle is false before idleMinutes have elapsed', () => {
    manager.recordActivity('legal')
    const soon = new Date(Date.now() + 10 * 60_000)
    expect(manager.isDueForIdle(soon, 30)).toBe(false)
  })

  it('isDueForArchive is true once archiveMinutes have elapsed for an IDLE session', () => {
    manager.recordActivity('legal')
    manager.transitionTo('IDLE')
    const future = new Date(Date.now() + 61 * 60_000)
    expect(manager.isDueForArchive(future, 60)).toBe(true)
  })

  it('isDueForArchive is false unless status is IDLE', () => {
    const future = new Date(Date.now() + 61 * 60_000)
    expect(manager.isDueForArchive(future, 60)).toBe(false)
  })
})
