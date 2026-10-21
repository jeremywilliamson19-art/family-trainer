import { describe, expect, it } from 'vitest'
import { better, computeResult, formatResult, jumpHeightIn, mph, TEST_BY_ID } from './agility'

describe('test calculations', () => {
  it('spec check: 0.50 s of flight ≈ 30.7 cm ≈ 12.1 in', () => {
    expect((jumpHeightIn(0.5) / 39.3700787) * 100).toBeCloseTo(30.66, 1)
    expect(jumpHeightIn(0.5)).toBeCloseTo(12.07, 2)
  })

  it('vertical: 120 frames at 240 fps = 0.5 s flight', () => {
    const r = computeResult(TEST_BY_ID.get('vertical')!, { takeoff: 1000, landing: 1120 }, 240)
    expect(r!.value).toBeCloseTo(12.07, 2)
    expect(formatResult(TEST_BY_ID.get('vertical')!, r!.value)).toBe('12.1″')
  })

  it('a re-encoded slo-mo clip still times correctly when the capture rate is set to 240', () => {
    // Same 120 captured frames, now played back at 30 fps: count frames, divide by capture rate.
    expect(computeResult(TEST_BY_ID.get('vertical')!, { takeoff: 10, landing: 130 }, 240)!.value).toBeCloseTo(12.07, 2)
  })

  it('40: time, 10-yard split, and mph', () => {
    const r = computeResult(TEST_BY_ID.get('dash40')!, { start: 0, split10: 432, finish: 1320 }, 240)!
    expect(r.value).toBeCloseTo(5.5, 5)
    expect(r.split10).toBeCloseTo(1.8, 5)
    expect(r.mph).toBeCloseTo(14.88, 2) // 120 ft / 5.5 s = 21.82 ft/s
    expect(mph(10, 1.8)).toBeCloseTo(11.36, 2)
  })

  it('rejects marks in the wrong order', () => {
    expect(computeResult(TEST_BY_ID.get('sprint10')!, { start: 500, finish: 400 }, 240)).toBeNull()
    expect(computeResult(TEST_BY_ID.get('dash40')!, { start: 0, split10: 1400, finish: 1320 }, 240)).toBeNull()
  })

  it('better: higher jumps, lower times', () => {
    expect(better(TEST_BY_ID.get('vertical')!, 14, 12)).toBe(true)
    expect(better(TEST_BY_ID.get('sprint10')!, 1.9, 2.0)).toBe(true)
    expect(formatResult(TEST_BY_ID.get('broad')!, 75)).toBe('6′ 3″')
  })
})
