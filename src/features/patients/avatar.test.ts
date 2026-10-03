import { describe, expect, it } from 'vitest'
import { avatarFor } from './avatar'
import { getAllPatients } from './data'

describe('avatarFor', () => {
  it('gives the same photo for the same patient every time', () => {
    expect(avatarFor('F', 'P001')).toBe(avatarFor('F', 'P001'))
  })

  it('uses women portraits for female patients and men for male', () => {
    expect(avatarFor('F', 'P004')).toContain('/women/')
    expect(avatarFor('M', 'P004')).toContain('/men/')
  })

  it('gives no two patients the same photo', () => {
    const urls = getAllPatients().map((p) => avatarFor(p.sex, p.id))
    expect(new Set(urls).size).toBe(urls.length)
  })
})
