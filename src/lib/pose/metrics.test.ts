import { describe, expect, it } from 'vitest'
import { cutFindings, drillsFor, jumpFindings, sprintFindings } from './coach'
import { cutMetrics, jumpMetrics, L, sprintMetrics, type PoseFrame, type Pt } from './metrics'

// A side-view stick figure built from joint angles (degrees), so the right
// answer is known. Lengths in pixels; y grows downward; travelling right.
const THIGH = 200
const SHANK = 200
const TORSO = 280
const UPPER_ARM = 140
const FOREARM = 130
const rad = (d: number) => (d * Math.PI) / 180

interface LegPose {
  thigh: number // from straight down, + forward
  knee: number // interior knee angle (180 = straight)
}
interface Figure {
  hip: { x: number; y: number }
  lean: number // trunk from vertical, + forward
  legs: [LegPose, LegPose]
  arms: [number, number] // upper arm from straight down, + forward
  elbow?: number
  /** Front view: horizontal offsets instead of a side profile. */
  front?: { shoulder: number; knee: number; ankle: number }
}

function figure(f: Figure): Pt[] {
  const lm: Pt[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, v: 0 }))
  const p = (x: number, y: number): Pt => ({ x, y, v: 1 })
  const sh = p(f.hip.x + TORSO * Math.sin(rad(f.lean)), f.hip.y - TORSO * Math.cos(rad(f.lean)))
  const legs = f.legs.map((g) => {
    const knee = p(f.hip.x + THIGH * Math.sin(rad(g.thigh)), f.hip.y + THIGH * Math.cos(rad(g.thigh)))
    const shank = g.thigh - (180 - g.knee)
    return { knee, ankle: p(knee.x + SHANK * Math.sin(rad(shank)), knee.y + SHANK * Math.cos(rad(shank))) }
  })
  const arms = f.arms.map((a) => {
    const elbow = p(sh.x + UPPER_ARM * Math.sin(rad(a)), sh.y + UPPER_ARM * Math.cos(rad(a)))
    const fa = a + (180 - (f.elbow ?? 90))
    return { elbow, wrist: p(elbow.x + FOREARM * Math.sin(rad(fa)), elbow.y + FOREARM * Math.cos(rad(fa))) }
  })
  const w = f.front ?? { shoulder: 2, knee: 2, ankle: 2 }
  lm[L.lShoulder] = p(sh.x - w.shoulder, sh.y)
  lm[L.rShoulder] = p(sh.x + w.shoulder, sh.y)
  lm[L.lHip] = p(f.hip.x - w.shoulder * 0.7, f.hip.y)
  lm[L.rHip] = p(f.hip.x + w.shoulder * 0.7, f.hip.y)
  lm[L.lKnee] = { ...legs[0].knee, x: legs[0].knee.x - w.knee }
  lm[L.rKnee] = { ...legs[1].knee, x: legs[1].knee.x + w.knee }
  lm[L.lAnkle] = { ...legs[0].ankle, x: legs[0].ankle.x - w.ankle }
  lm[L.rAnkle] = { ...legs[1].ankle, x: legs[1].ankle.x + w.ankle }
  lm[L.lElbow] = arms[0].elbow
  lm[L.rElbow] = arms[1].elbow
  lm[L.lWrist] = arms[0].wrist
  lm[L.rWrist] = arms[1].wrist
  return lm
}

const GROUND = 900
const LEG = THIGH + SHANK

/** A running stride cycle at 240 fps with known peaks. */
function sprint({ kneeDrive, heel, arm, startLean, strike }: { kneeDrive: number; heel: number; arm: number; startLean: number; strike: number }): PoseFrame[] {
  const frames: PoseFrame[] = []
  const cycle = 60 // frames per stride (two steps)
  for (let i = 0; i < 360; i++) {
    const t = (i % cycle) / cycle
    const legAt = (ph: number): LegPose => {
      // Stance: thigh sweeps from +strike to −25 with a straight leg; swing: knee folds then drives forward.
      if (ph < 0.4) return { thigh: strike - (ph / 0.4) * (strike + 25), knee: 175 }
      const s = (ph - 0.4) / 0.6
      return { thigh: -25 + (kneeDrive + 25) * Math.sin((s * Math.PI) / 1.6), knee: 175 - (175 - heel) * Math.sin(s * Math.PI) }
    }
    const phases = [t, (t + 0.5) % 1]
    const legs: [LegPose, LegPose] = [legAt(phases[0]), legAt(phases[1])]
    const stanceIdx = phases.findIndex((ph) => ph < 0.4)
    // Stance foot on the ground; in the brief flight phase, hips stay at mid-stance height.
    const hipY = stanceIdx >= 0 ? GROUND - LEG * Math.cos(rad(legs[stanceIdx].thigh)) : GROUND - LEG * Math.cos(rad(25)) - 4
    frames.push({
      frame: i,
      lm: figure({ hip: { x: 200 + i * 6, y: hipY }, lean: i < 96 ? startLean : 8, legs, arms: [arm * Math.sin(t * 2 * Math.PI), -arm * Math.sin(t * 2 * Math.PI)] }),
    })
  }
  return frames
}

/** A vertical jump at 240 fps: dip, extend, 0.5 s flight (120 frames), land. */
function jump(opts: { dip: number; landKnee: number; armsUp: boolean; front?: boolean; cave?: boolean }) {
  const frames: PoseFrame[] = []
  const v0 = (9.81 * 0.5) / 2 // m/s for a 0.5 s flight
  const pxPerM = 500
  let takeoff = 0
  for (let i = 0; i < 420; i++) {
    let knee = 175
    let up = 0
    let arms = 0
    if (i >= 60 && i < 132) knee = 175 - (175 - opts.dip) * Math.sin(((i - 60) / 72) * Math.PI) // dip & drive
    if (i >= 120 && i < 132) arms = opts.armsUp ? 170 : 20
    if (i >= 132 && i < 252) {
      if (!takeoff) takeoff = i - 1
      const t = (i - 131) / 240
      up = (v0 * t - (9.81 * t * t) / 2) * pxPerM
      arms = opts.armsUp ? 150 : 20
    }
    if (i >= 252 && i < 324) knee = 175 - (175 - opts.landKnee) * Math.sin(((i - 252) / 72) * Math.PI)
    // Keep feet on the ground when not flying: hip height follows the knee bend.
    const legY = THIGH * Math.sin(rad(knee / 2)) + SHANK * Math.sin(rad(knee / 2))
    const thigh = 90 - knee / 2
    const front = opts.front ? { shoulder: 105, knee: opts.cave && i >= 252 && i < 324 ? 8 : 18, ankle: 20 } : undefined
    frames.push({ frame: i, lm: figure({ hip: { x: 400, y: GROUND - legY - up }, lean: 5, legs: [{ thigh, knee }, { thigh, knee }], arms: [arms, arms], elbow: 170, front }) })
  }
  return { frames, takeoff, landing: 252 }
}

describe('sprint form', () => {
  it('measures a good sprint and finds nothing to fix', () => {
    const m = sprintMetrics(sprint({ kneeDrive: 80, heel: 45, arm: 55, startLean: 40, strike: 10 }), 240)
    expect(m.kneeDrive).toBeGreaterThan(74)
    expect(m.heelRecovery).toBeLessThan(55)
    expect(m.armSwing).toBeGreaterThan(95)
    expect(m.startLean).toBeCloseTo(40, 0)
    expect(m.overstride).toBeLessThan(0.3)
    expect(sprintFindings(m).filter((f) => f.kind === 'focus')).toEqual([])
  })

  it('flags an upright start, low knees, short arms, low heels and overstriding', () => {
    const m = sprintMetrics(sprint({ kneeDrive: 45, heel: 110, arm: 20, startLean: 10, strike: 28 }), 240)
    const ids = sprintFindings(m).filter((f) => f.kind === 'focus').map((f) => f.id).sort()
    expect(ids).toEqual(['low_heels', 'low_knees', 'overstride', 'small_arms', 'upright_start'])
    const { fixes } = drillsFor(sprintFindings(m), 'sprint')
    expect(fixes.map((d) => d.exercise_id)).toContain('wall_drill')
  })
})

describe('jump form', () => {
  it('finds takeoff and landing within 2 frames of the truth (flight time error < 3%)', () => {
    const j = jump({ dip: 120, landKnee: 130, armsUp: true })
    const m = jumpMetrics(j.frames, 240)
    expect(Math.abs(m.takeoff! - j.takeoff)).toBeLessThanOrEqual(2)
    expect(Math.abs(m.landing! - j.landing)).toBeLessThanOrEqual(2)
    expect(Math.abs((m.landing! - m.takeoff!) - 120) / 120).toBeLessThan(0.03)
  })

  it('a good jump: deep enough dip, full extension, arms up, soft landing', () => {
    const m = jumpMetrics(jump({ dip: 120, landKnee: 130, armsUp: true }).frames, 240)
    expect(m.view).toBe('side')
    expect(m.dipKnee).toBeCloseTo(120, -1)
    expect(m.armsUp).toBe(true)
    expect(jumpFindings(m).filter((f) => f.kind === 'focus')).toEqual([])
  })

  it('flags a shallow dip, no arm swing, and a stiff landing', () => {
    const m = jumpMetrics(jump({ dip: 150, landKnee: 165, armsUp: false }).frames, 240)
    const ids = jumpFindings(m).filter((f) => f.kind === 'focus').map((f) => f.id).sort()
    expect(ids).toEqual(['arms_down', 'shallow_dip', 'stiff_landing'])
  })

  it('filmed from the front: knees caving in on landing', () => {
    const m = jumpMetrics(jump({ dip: 120, landKnee: 130, armsUp: true, front: true, cave: true }).frames, 240)
    expect(m.view).toBe('front')
    expect(jumpFindings(m).map((f) => f.id)).toContain('valgus')
    const ok = jumpMetrics(jump({ dip: 120, landKnee: 130, armsUp: true, front: true }).frames, 240)
    expect(jumpFindings(ok).map((f) => f.id)).not.toContain('valgus')
  })
})

describe('cuts', () => {
  it('flags staying tall at direction changes', () => {
    const shuttle = (drop: number): PoseFrame[] =>
      Array.from({ length: 200 }, (_, i) => {
        const phase = i % 100
        const x = phase < 50 ? 200 + phase * 12 : 800 - (phase - 50) * 12
        const atTurn = Math.abs(phase - 50) < 6 || phase < 6 || phase > 94
        return { frame: i, lm: figure({ hip: { x, y: 500 + (atTurn ? drop : 0) }, lean: 10, legs: [{ thigh: 10, knee: 170 }, { thigh: -10, knee: 170 }], arms: [0, 0] }) }
      })
    expect(cutFindings(cutMetrics(shuttle(10)))[0].id).toBe('tall_cuts')
    expect(cutFindings(cutMetrics(shuttle(80)))[0].id).toBe('good_cuts')
  })
})

describe('picking the athlete out of a crowd', () => {
  // A runner moving right past two people standing still.
  const runner = (i: number) => figure({ hip: { x: 100 + i * 20, y: 500 }, lean: 10, legs: [{ thigh: 30, knee: 150 }, { thigh: -20, knee: 170 }], arms: [30, -30] })
  const bystander = (x: number) => figure({ hip: { x, y: 520 }, lean: 0, legs: [{ thigh: 0, knee: 178 }, { thigh: 0, knee: 178 }], arms: [0, 0] })
  const frames = Array.from({ length: 40 }, (_, i) => ({ frame: i, people: i % 2 ? [bystander(300), runner(i), bystander(700)] : [runner(i), bystander(700), bystander(300)] }))

  it('follows the tapped runner, even as he passes right by a bystander', async () => {
    const { crowded, selectAthlete } = await import('./metrics')
    expect(crowded(frames)).toBe(true)
    const track = selectAthlete(frames, { x: 100, y: 500, frame: 0 })
    expect(track.every((f, i) => f.lm && Math.abs(f.lm[L.lHip].x - (100 + i * 20)) < 5)).toBe(true)
  })

  it('a tap on a bystander follows the bystander', async () => {
    const { selectAthlete } = await import('./metrics')
    const track = selectAthlete(frames, { x: 700, y: 520, frame: 10 })
    expect(track.every((f) => f.lm && Math.abs(f.lm[L.lHip].x - 700) < 5)).toBe(true)
  })
})

describe('tracking through detector misses', () => {
  const runner = (i: number) => figure({ hip: { x: 100 + i * 20, y: 500 }, lean: 10, legs: [{ thigh: 30, knee: 150 }, { thigh: -20, knee: 170 }], arms: [30, -30] })
  const bystander = (x: number) => figure({ hip: { x, y: 520 }, lean: 0, legs: [{ thigh: 0, knee: 178 }, { thigh: 0, knee: 178 }], arms: [0, 0] })

  it('a tap on a frame where the runner was missed still picks the runner, and he is re-found after gaps', async () => {
    const { selectAthlete } = await import('./metrics')
    // The runner goes undetected every 4th frame and for 3 frames in a row mid-clip.
    // (Not on frame 30, where he overlaps the bystander: a miss exactly there is
    // indistinguishable, which is why the app shows the skeleton and allows a re-pick.)
    const missed = (i: number) => (i % 4 === 2 && i !== 30) || (i >= 20 && i < 23)
    const frames = Array.from({ length: 40 }, (_, i) => ({ frame: i, people: missed(i) ? [bystander(700)] : [bystander(700), runner(i)] }))
    const track = selectAthlete(frames, { x: 100 + 10 * 20, y: 500, frame: 10 }) // frame 10 is a miss
    const found = track.filter((f) => f.lm)
    expect(found.every((f) => Math.abs(f.lm![L.lHip].x - (100 + f.frame * 20)) < 5)).toBe(true)
    expect(found.length).toBe(frames.filter((f) => f.people.length === 2).length)
  })
})
