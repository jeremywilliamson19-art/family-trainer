// Form measurements from body landmarks (MediaPipe Pose's 33 points),
// frame by frame. Points are in pixels (x right, y down). Pure functions so
// they can be tested with synthetic poses.

export interface Pt {
  x: number
  y: number
  /** 0–1 confidence the point is visible. */
  v: number
}

export interface PoseFrame {
  frame: number
  /** 33 landmarks, or null when no person was found. */
  lm: Pt[] | null
}

// MediaPipe Pose landmark indices.
export const L = {
  nose: 0,
  lShoulder: 11,
  rShoulder: 12,
  lElbow: 13,
  rElbow: 14,
  lWrist: 15,
  rWrist: 16,
  lHip: 23,
  rHip: 24,
  lKnee: 25,
  rKnee: 26,
  lAnkle: 27,
  rAnkle: 28,
} as const

const VIS = 0.5

/** Every person found in a frame (the model tracks up to a few). */
export interface PeopleFrame {
  frame: number
  people: Pt[][]
}

/** Center of a person: mid-hips, else mid-shoulders. */
export function center(lm: Pt[]): Pt {
  const hips = mid(lm[L.lHip], lm[L.rHip])
  return hips.v >= 0.3 ? hips : mid(lm[L.lShoulder], lm[L.rShoulder])
}

/** Height of a person on screen (nose/shoulders to the lowest ankle). */
function bodySize(lm: Pt[]): number {
  // Only points the model actually saw (undetected ones sit at 0,0).
  const ys = [L.nose, L.lShoulder, L.rShoulder, L.lAnkle, L.rAnkle].filter((i) => lm[i].v >= 0.3).map((i) => lm[i].y)
  return ys.length >= 2 ? Math.max(...ys) - Math.min(...ys) : 0
}

/** True when any frame shows more than one person. */
export function crowded(frames: PeopleFrame[]): boolean {
  return frames.some((f) => f.people.length > 1)
}

/**
 * Follows one athlete through the clip: starts from the person nearest the
 * tap (or the biggest person if there was no tap), then each frame takes
 * whoever is nearest the last position, so the track never jumps to a
 * bystander. Frames where the athlete isn't found are null.
 */
export function selectAthlete(frames: PeopleFrame[], tap?: { x: number; y: number; frame: number }): PoseFrame[] {
  const out: PoseFrame[] = frames.map((f) => ({ frame: f.frame, lm: null }))
  const tapPt: Pt | null = tap ? { x: tap.x, y: tap.y, v: 1 } : null
  let startIdx = -1
  let pick: Pt[] | null = null
  if (tapPt) {
    // The detector misses people in some frames, so start from the frame
    // nearest the tap where someone was actually found near the tap point.
    const tapIdx = Math.max(0, frames.findIndex((f) => f.frame >= tap!.frame))
    const order = [...frames.keys()].sort((a, b) => Math.abs(a - tapIdx) - Math.abs(b - tapIdx))
    for (const i of order) {
      const near = frames[i].people.filter((p) => dist(center(p), tapPt) <= Math.max(bodySize(p) * 0.5, 40))
      if (near.length) {
        startIdx = i
        pick = near.reduce((a, b) => (dist(center(b), tapPt) < dist(center(a), tapPt) ? b : a))
        break
      }
    }
  } else {
    startIdx = frames.findIndex((f) => f.people.length)
    if (startIdx >= 0) pick = frames[startIdx].people.reduce((a, b) => (bodySize(b) > bodySize(a) ? b : a))
  }
  if (startIdx < 0 || !pick) return out
  out[startIdx].lm = pick

  // Walk forward and backward from the starting frame, predicting the next
  // position from the athlete's own motion so a passing bystander who is
  // momentarily just as close doesn't steal the track.
  for (const dirn of [1, -1]) {
    let last: Pt[] = pick
    let prevCenter: Pt | null = null
    let gap = 0
    for (let i = startIdx + dirn; i >= 0 && i < frames.length; i += dirn) {
      gap++
      const c = center(last)
      const vx: number = prevCenter ? c.x - prevCenter.x : 0
      const vy: number = prevCenter ? c.y - prevCenter.y : 0
      const predicted: Pt = { x: c.x + vx * gap, y: c.y + vy * gap, v: 1 }
      // How far the athlete could plausibly be from the prediction: tracking
      // jitter (hip points wobble 2–4% of body height), plus up to 1.3× their
      // own speed for each frame since last seen (a guess until it's known).
      const body = Math.max(bodySize(last), 1)
      const perFrame = prevCenter ? Math.max(1.3 * Math.hypot(vx, vy), 0.04 * body) : 0.15 * body
      const limit = 0.06 * body + perFrame * gap
      let best: Pt[] | null = null
      for (const p of frames[i].people) {
        const d = dist(center(p), predicted)
        if (d <= limit && (!best || d < dist(center(best), predicted))) best = p
      }
      if (best) {
        out[i].lm = best
        prevCenter = gap === 1 ? c : { x: c.x + vx * (gap - 1), y: c.y + vy * (gap - 1), v: 1 }
        last = best
        gap = 0
      }
    }
  }
  return out
}

export const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, v: Math.min(a.v, b.v) })
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

/** Angle at b (degrees, 0–180) formed by a-b-c. */
export function angle(a: Pt, b: Pt, c: Pt): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y }
  const v2 = { x: c.x - b.x, y: c.y - b.y }
  const cos = (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1)
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI
}

/**
 * Angle of the segment from `from` to `to`, measured from straight down
 * (0° = pointing down, 90° = horizontal), signed positive toward `dir`
 * (+1 = moving right, −1 = moving left).
 */
function fromDown(from: Pt, to: Pt, dir: number): number {
  return (Math.atan2((to.x - from.x) * dir, to.y - from.y) * 180) / Math.PI
}

/** Forward lean of the trunk from vertical (hip → shoulder), degrees. */
function trunkLean(lm: Pt[], dir: number): number {
  const hip = mid(lm[L.lHip], lm[L.rHip])
  const sh = mid(lm[L.lShoulder], lm[L.rShoulder])
  return (Math.atan2((sh.x - hip.x) * dir, hip.y - sh.y) * 180) / Math.PI
}

const percentile = (xs: number[], p: number) => {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))]
}
const median = (xs: number[]) => percentile(xs, 50)

function visible(lm: Pt[] | null, idx: number[]): lm is Pt[] {
  return !!lm && idx.every((i) => (lm[i]?.v ?? 0) >= VIS)
}

const LOWER = [L.lHip, L.rHip, L.lKnee, L.rKnee, L.lAnkle, L.rAnkle]
const UPPER = [L.lShoulder, L.rShoulder, L.lHip, L.rHip]

/** Share of frames where the body was tracked clearly. */
export function coverage(frames: PoseFrame[]): number {
  if (!frames.length) return 0
  return frames.filter((f) => visible(f.lm, [...LOWER, ...UPPER])).length / frames.length
}

/** Average leg length (hip → ankle), the yardstick for distances. */
function legLength(frames: PoseFrame[]): number {
  const xs: number[] = []
  for (const f of frames) if (visible(f.lm, LOWER)) xs.push((dist(f.lm[L.lHip], f.lm[L.lAnkle]) + dist(f.lm[L.rHip], f.lm[L.rAnkle])) / 2)
  return median(xs)
}

/** Which way the athlete travels across the frame: +1 right, −1 left. */
export function travelDirection(frames: PoseFrame[]): number {
  const hips = frames.filter((f) => visible(f.lm, [L.lHip, L.rHip])).map((f) => mid(f.lm![L.lHip], f.lm![L.rHip]).x)
  return hips.length > 1 && hips[hips.length - 1] < hips[0] ? -1 : 1
}

// ---------------------------------------------------------------------------
// Sprint (side view)
// ---------------------------------------------------------------------------

export interface SprintMetrics {
  /** Trunk lean over the first ~0.4 s, degrees from vertical. */
  startLean: number | null
  /** Typical peak thigh angle in front of the body, degrees from vertical. */
  kneeDrive: number | null
  /** Typical tightest knee bend in the swing (smaller = better heel recovery). */
  heelRecovery: number | null
  /** Typical arm swing range at the shoulder, degrees. */
  armSwing: number | null
  /** How far ahead of the hips feet land, as a share of leg length. */
  overstride: number | null
}

export function sprintMetrics(frames: PoseFrame[], captureFps: number): SprintMetrics {
  const dir = travelDirection(frames)
  const ok = frames.filter((f) => visible(f.lm, [...LOWER, ...UPPER]))
  const lmOf = (f: PoseFrame) => f.lm as Pt[]

  const startFrames = ok.filter((f) => f.frame - (ok[0]?.frame ?? 0) <= captureFps * 0.4)
  const startLean = startFrames.length ? median(startFrames.map((f) => trunkLean(lmOf(f), dir))) : null

  const thigh: number[] = []
  const knee: number[] = []
  for (const f of ok) {
    const lm = lmOf(f)
    for (const [h, k, a] of [
      [L.lHip, L.lKnee, L.lAnkle],
      [L.rHip, L.rKnee, L.rAnkle],
    ] as const) {
      thigh.push(fromDown(lm[h], lm[k], dir))
      knee.push(angle(lm[h], lm[k], lm[a]))
    }
  }

  const arms: number[] = []
  for (const [s, e, h] of [
    [L.lShoulder, L.lElbow, L.lHip],
    [L.rShoulder, L.rElbow, L.rHip],
  ] as const) {
    const xs = frames.filter((f) => visible(f.lm, [s, e, h])).map((f) => fromDown(f.lm![s], f.lm![e], dir))
    if (xs.length > 5) arms.push(percentile(xs, 95) - percentile(xs, 5))
  }

  // Foot strikes: an ankle reaching the ground after being above it.
  const leg = legLength(frames)
  const ankleYs = ok.flatMap((f) => [lmOf(f)[L.lAnkle].y, lmOf(f)[L.rAnkle].y])
  const ground = percentile(ankleYs, 95)
  const strikes: number[] = []
  for (const a of [L.lAnkle, L.rAnkle]) {
    let airborne = false
    for (const f of ok) {
      const lm = lmOf(f)
      const onGround = ground - lm[a].y < leg * 0.04
      if (onGround && airborne) {
        const hip = mid(lm[L.lHip], lm[L.rHip])
        strikes.push(((lm[a].x - hip.x) * dir) / leg)
      }
      airborne = !onGround && ground - lm[a].y > leg * 0.08 ? true : onGround ? false : airborne
    }
  }

  return {
    startLean: Number.isFinite(startLean) ? startLean : null,
    kneeDrive: thigh.length ? percentile(thigh, 95) : null,
    heelRecovery: knee.length ? percentile(knee, 5) : null,
    armSwing: arms.length ? Math.max(...arms) : null,
    overstride: strikes.length ? median(strikes) : null,
  }
}

// ---------------------------------------------------------------------------
// Jump (side or front view)
// ---------------------------------------------------------------------------

export interface JumpMetrics {
  /** Suggested marks (frame numbers). */
  takeoff: number | null
  landing: number | null
  /** Deepest knee angle in the dip before takeoff (smaller = deeper). */
  dipKnee: number | null
  /** Knee/hip extension at takeoff. */
  takeoffKnee: number | null
  takeoffHip: number | null
  /** Wrists above the shoulders at takeoff. */
  armsUp: boolean | null
  /** Tightest knee angle in the air (tucking inflates the vertical). */
  airKnee: number | null
  /** Deepest knee bend in the 0.3 s after landing (bigger = stiffer). */
  landingKnee: number | null
  /** Front view: knees closer together than ankles on landing (<1 = caving in). */
  kneeToAnkleWidth: number | null
  view: 'front' | 'side'
}

export function jumpMetrics(frames: PoseFrame[], captureFps: number): JumpMetrics {
  const ok = frames.filter((f) => visible(f.lm, [...LOWER, ...UPPER]))
  const lmOf = (f: PoseFrame) => f.lm as Pt[]
  const leg = legLength(frames)
  const empty: JumpMetrics = { takeoff: null, landing: null, dipKnee: null, takeoffKnee: null, takeoffHip: null, armsUp: null, airKnee: null, landingKnee: null, kneeToAnkleWidth: null, view: 'side' }
  if (ok.length < 5 || !Number.isFinite(leg)) return empty

  // Front view when the shoulders look wide relative to the torso.
  const widths = ok.map((f) => {
    const lm = lmOf(f)
    return dist(lm[L.lShoulder], lm[L.rShoulder]) / (dist(mid(lm[L.lShoulder], lm[L.rShoulder]), mid(lm[L.lHip], lm[L.rHip])) || 1)
  })
  const view = median(widths) > 0.55 ? 'front' : 'side'

  // Airborne: both ankles clearly above standing level. Use the longest run.
  const lowAnkle = (lm: Pt[]) => Math.max(lm[L.lAnkle].y, lm[L.rAnkle].y)
  const ground = median(ok.slice(0, Math.max(3, Math.floor(ok.length * 0.15))).map((f) => lowAnkle(lmOf(f))))
  const air = ok.map((f) => ground - lowAnkle(lmOf(f)) > leg * 0.06)
  let best: [number, number] | null = null
  for (let i = 0; i < air.length; i++) {
    if (!air[i]) continue
    let j = i
    while (j + 1 < air.length && air[j + 1]) j++
    if (!best || j - i > best[1] - best[0]) best = [i, j]
    i = j
  }
  if (!best || best[0] === 0 || best[1] === ok.length - 1) return { ...empty, view }
  // The 6% threshold finds the jump reliably but crosses late; walk out to
  // where the feet are within 2% of the ground so the flight isn't cut short.
  const height = (i: number) => ground - lowAnkle(lmOf(ok[i]))
  let takeoffIdx = best[0] - 1
  while (takeoffIdx > 0 && height(takeoffIdx) > leg * 0.02) takeoffIdx--
  let landingIdx = best[1] + 1
  while (landingIdx < ok.length - 1 && height(landingIdx) > leg * 0.02) landingIdx++

  const knees = (lm: Pt[]) => [angle(lm[L.lHip], lm[L.lKnee], lm[L.lAnkle]), angle(lm[L.rHip], lm[L.rKnee], lm[L.rAnkle])]
  const hips = (lm: Pt[]) => [angle(lm[L.lShoulder], lm[L.lHip], lm[L.lKnee]), angle(lm[L.rShoulder], lm[L.rHip], lm[L.rKnee])]
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

  const dipWindow = ok.slice(0, takeoffIdx + 1).filter((f) => ok[takeoffIdx].frame - f.frame <= captureFps * 1.0)
  const dipKnee = Math.min(...dipWindow.map((f) => avg(knees(lmOf(f)))))

  // Extension right at takeoff: best of the last few ground frames.
  const ext = ok.slice(Math.max(0, takeoffIdx - 3), takeoffIdx + 1)
  const takeoffKnee = Math.max(...ext.map((f) => avg(knees(lmOf(f)))))
  const takeoffHip = Math.max(...ext.map((f) => avg(hips(lmOf(f)))))
  const armsUp = ext.some((f) => {
    const lm = lmOf(f)
    return Math.min(lm[L.lWrist].y, lm[L.rWrist].y) < Math.min(lm[L.lShoulder].y, lm[L.rShoulder].y)
  })

  const airKnee = Math.min(...ok.slice(best[0], best[1] + 1).map((f) => avg(knees(lmOf(f)))))
  const landWindow = ok.slice(landingIdx).filter((f) => f.frame - ok[landingIdx].frame <= captureFps * 0.3)
  const landingKnee = landWindow.length ? Math.min(...landWindow.map((f) => avg(knees(lmOf(f))))) : null

  let kneeToAnkleWidth: number | null = null
  if (view === 'front' && landWindow.length) {
    kneeToAnkleWidth = Math.min(
      ...landWindow.map((f) => {
        const lm = lmOf(f)
        return Math.abs(lm[L.lKnee].x - lm[L.rKnee].x) / (Math.abs(lm[L.lAnkle].x - lm[L.rAnkle].x) || 1)
      }),
    )
  }

  return {
    takeoff: ok[takeoffIdx].frame,
    landing: ok[landingIdx].frame,
    dipKnee,
    takeoffKnee,
    takeoffHip,
    armsUp,
    airKnee,
    landingKnee,
    kneeToAnkleWidth,
    view,
  }
}

// ---------------------------------------------------------------------------
// Cuts (pro-agility, 3-cone)
// ---------------------------------------------------------------------------

export interface CutMetrics {
  /** How much the hips drop at direction changes, as a share of leg length. */
  hipDrop: number | null
  cuts: number
}

export function cutMetrics(frames: PoseFrame[]): CutMetrics {
  const ok = frames.filter((f) => visible(f.lm, LOWER))
  const leg = legLength(frames)
  if (ok.length < 10) return { hipDrop: null, cuts: 0 }
  const hip = ok.map((f) => mid(f.lm![L.lHip], f.lm![L.rHip]))
  const standing = percentile(
    hip.map((h) => h.y),
    10,
  )
  // Direction changes: horizontal hip velocity flips sign (smoothed).
  const drops: number[] = []
  const k = 3
  for (let i = k; i < hip.length - k; i++) {
    const before = hip[i].x - hip[i - k].x
    const after = hip[i + k].x - hip[i].x
    if (Math.sign(before) !== Math.sign(after) && Math.abs(before) > leg * 0.05 && Math.abs(after) > leg * 0.05) {
      drops.push((hip[i].y - standing) / leg)
      i += k * 3
    }
  }
  return { hipDrop: drops.length ? median(drops) : null, cuts: drops.length }
}
