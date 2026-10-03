import { describe, expect, it } from 'vitest'
import { parsePlans } from './suggest-prescription'

describe('parsePlans', () => {
  it('reads a plain JSON array', () => {
    const reply =
      '[{"condition":"hypertension","treatment":"Lisinopril 10 mg once daily","instructions":"Take daily."}]'
    expect(parsePlans(reply)).toEqual([
      {
        match: 'hypertension',
        treatment: 'Lisinopril 10 mg once daily',
        instructions: 'Take daily.',
      },
    ])
  })

  it('finds the array inside a code fence and prose', () => {
    const reply =
      'Here you go:\n```json\n[{"condition":"copd","treatment":"Albuterol 2 puffs","instructions":"As needed."}]\n```'
    expect(parsePlans(reply)).toHaveLength(1)
  })

  it('returns nothing for text that is not the expected array', () => {
    expect(parsePlans('I cannot help with that.')).toEqual([])
    expect(parsePlans('[{"drug":"x"}]')).toEqual([])
    expect(parsePlans('[not json]')).toEqual([])
  })
})
