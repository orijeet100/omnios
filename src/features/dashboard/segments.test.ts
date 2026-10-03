import { describe, it, expect } from 'vitest'
import { getDashboard, isShownSegment } from './segments'

describe('getDashboard', () => {
  it('reports the latest complete week', () => {
    const { weekStart } = getDashboard()
    expect(weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('returns only the three user-facing segments', () => {
    const { cards } = getDashboard()
    expect(cards.map((c) => c.id)).toEqual([
      'bp_off',
      'glucose_off',
      'recovery_off',
    ])
  })

  it('gives every card a count, a comparison and at least one metric', () => {
    const { cards } = getDashboard()
    for (const card of cards) {
      expect(card.count).toBeGreaterThan(0)
      expect(card.prevCount).toBeGreaterThanOrEqual(0)
      expect(['up', 'down', 'flat']).toContain(card.trend)
      expect(card.metrics.length).toBeGreaterThan(0)
      expect(card.primaryMetric).toBe(card.metrics[0])
    }
  })
})

describe('isShownSegment', () => {
  it('accepts the three shown segments', () => {
    expect(isShownSegment('bp_off')).toBe(true)
    expect(isShownSegment('glucose_off')).toBe(true)
    expect(isShownSegment('recovery_off')).toBe(true)
  })

  it('rejects data-quality and unknown segments', () => {
    expect(isShownSegment('data_gap')).toBe(false)
    expect(isShownSegment('nope')).toBe(false)
    expect(isShownSegment('')).toBe(false)
  })
})
