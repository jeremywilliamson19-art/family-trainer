import { describe, expect, it } from 'vitest'
import { EXERCISES } from './exercises'
import { DRILLS } from './pose/coach'
import { TEMPLATES } from './programs'
import { demoUrl, FORM } from './formGuide'

describe('form guides', () => {
  it('every exercise in the library has cues and a common mistake', () => {
    const missing = EXERCISES.filter((e) => !FORM[e.id] || FORM[e.id].cues.length < 2 || !FORM[e.id].mistakes.length).map((e) => e.id)
    expect(missing).toEqual([])
  })

  it('every recommended drill and program exercise has a guide', () => {
    const ids = [...Object.values(DRILLS).map((d) => d.exercise_id), ...TEMPLATES.flatMap((t) => t.days.flatMap((d) => d.exercises.map((e) => e.exercise_id)))]
    expect(ids.filter((id) => !FORM[id])).toEqual([])
  })

  it('no guides for exercises that don’t exist', () => {
    const ids = new Set(EXERCISES.map((e) => e.id))
    expect(Object.keys(FORM).filter((k) => !ids.has(k))).toEqual([])
  })

  it('demo links are YouTube searches for proper form', () => {
    expect(demoUrl('Box jump (low box)')).toBe('https://www.youtube.com/results?search_query=Box%20jump%20proper%20form')
  })
})
