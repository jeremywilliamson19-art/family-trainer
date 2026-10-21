// Filmed speed and jump tests (spec section 9): what to mark on the video
// and how results are calculated.

export type TestId = 'vertical' | 'broad' | 'sprint10' | 'dash40' | 'pro_agility' | 'three_cone'

export interface MarkDef {
  key: string
  label: string
  hint: string
}

export interface TestDef {
  id: TestId
  name: string
  short: string
  /** Frames to mark, in order. */
  marks: MarkDef[]
  /** Result unit; lower is better for times. */
  unit: 'in' | 's'
  higherIsBetter: boolean
  /** Broad jump: distance is typed from the tape; video is for form only. */
  manualValue?: boolean
  setup: string[]
  camera: string
  /** Which form analysis applies. */
  form: 'jump' | 'sprint' | 'cut'
}

const FIRST_MOVE: MarkDef = { key: 'start', label: 'First movement', hint: 'The first frame any part of the body starts to move.' }

export const TESTS: TestDef[] = [
  {
    id: 'vertical',
    name: 'Vertical jump',
    short: 'Vertical',
    marks: [
      { key: 'takeoff', label: 'Takeoff', hint: 'The LAST frame with the toes still touching the ground.' },
      { key: 'landing', label: 'Landing', hint: 'The FIRST frame a foot touches the ground again.' },
    ],
    unit: 'in',
    higherIsBetter: true,
    setup: [
      'Phone on a tripod or steady surface, level, about 10 feet away.',
      'Film from the side so both feet are clearly in frame the whole time.',
      'Jump straight up with an arm swing. Land on both feet with legs straight.',
      'Don’t tuck the knees in the air: it makes the flight longer and the number too high.',
    ],
    camera: 'Side-on, feet at the bottom of the frame.',
    form: 'jump',
  },
  {
    id: 'broad',
    name: 'Broad jump',
    short: 'Broad',
    marks: [],
    unit: 'in',
    higherIsBetter: true,
    manualValue: true,
    setup: [
      'Toes behind a line. Jump forward as far as possible and stick the landing.',
      'Measure from the line to the back of the closest heel with a tape.',
      'Filming is optional, for checking form. The distance comes from the tape.',
    ],
    camera: 'Side-on at the midpoint, whole jump in frame.',
    form: 'jump',
  },
  {
    id: 'sprint10',
    name: '10-yard sprint',
    short: '10 yd',
    marks: [FIRST_MOVE, { key: 'finish', label: 'Finish', hint: 'The frame the torso crosses the 10-yard cone.' }],
    unit: 's',
    higherIsBetter: false,
    setup: [
      'Mark start and 10 yards with cones.',
      'Phone on a tripod at the finish line, side-on, perpendicular to the lane.',
      'Start in a 2- or 3-point stance. Time starts at first movement, no rocking.',
      'Run all the way through the finish cone.',
    ],
    camera: 'At the finish line, side-on.',
    form: 'sprint',
  },
  {
    id: 'dash40',
    name: '40-yard dash',
    short: '40 yd',
    marks: [
      FIRST_MOVE,
      { key: 'split10', label: '10-yard split', hint: 'The frame the torso crosses the 10-yard cone.' },
      { key: 'finish', label: 'Finish', hint: 'The frame the torso crosses the 40-yard cone.' },
    ],
    unit: 's',
    higherIsBetter: false,
    setup: [
      'Cones at 0, 10 and 40 yards.',
      'Film side-on from far enough back to see the start, 10 and 40 yards. A helper panning slowly also works.',
      'Time starts at first movement. Run through the 40-yard cone.',
    ],
    camera: 'Side-on, far enough back to see 0–40 yards.',
    form: 'sprint',
  },
  {
    id: 'pro_agility',
    name: 'Pro-agility (5-10-5)',
    short: '5-10-5',
    marks: [FIRST_MOVE, { key: 'finish', label: 'Finish', hint: 'The frame the torso crosses the middle line at the end.' }],
    unit: 's',
    higherIsBetter: false,
    setup: [
      'Three lines 5 yards apart. Start straddling the middle line.',
      'Sprint 5 yards to one side and touch the line, 10 yards to the far line and touch, then 5 back through the middle.',
      'Phone on a tripod in line with the middle line, far enough back to see all three lines.',
    ],
    camera: 'Facing the lanes, middle line in the center.',
    form: 'cut',
  },
  {
    id: 'three_cone',
    name: '3-cone drill',
    short: '3-cone',
    marks: [FIRST_MOVE, { key: 'finish', label: 'Finish', hint: 'The frame the torso crosses the start line at the end.' }],
    unit: 's',
    higherIsBetter: false,
    setup: [
      'Three cones in an L, 5 yards apart.',
      'Run to cone 2 and touch the line, back to cone 1, back around cone 2, weave around cone 3, and back to the start.',
      'Phone on a tripod where it sees all three cones and the start line.',
    ],
    camera: 'Wide view of all three cones.',
    form: 'cut',
  },
]

export const TEST_BY_ID = new Map(TESTS.map((t) => [t.id, t]))

const G = 9.81
const M_TO_IN = 39.3700787

/** Flight time → jump height: h = g·t²/8 (meters), shown in inches. */
export function jumpHeightIn(flightSeconds: number): number {
  return ((G * flightSeconds * flightSeconds) / 8) * M_TO_IN
}

/** Average speed over a distance in yards. */
export function mph(yards: number, seconds: number): number {
  return ((yards * 3) / seconds) * (3600 / 5280)
}

export interface TestResult {
  /** Inches (jumps) or seconds (runs). */
  value: number
  /** 40-yard dash: 10-yard split, seconds. */
  split10?: number
  /** Average speed (runs). */
  mph?: number
  split_mph?: number
}

/**
 * Times come from frame counts: each captured frame is 1/captureFps
 * seconds of real time (240 for iPhone Slo-mo), whatever the file's
 * playback rate is.
 */
export function computeResult(test: TestDef, marks: Record<string, number>, captureFps: number): TestResult | null {
  const secs = (a: string, b: string) => (marks[b] - marks[a]) / captureFps
  const has = test.marks.every((m) => Number.isFinite(marks[m.key]))
  if (!has || captureFps <= 0) return null
  switch (test.id) {
    case 'vertical': {
      const t = secs('takeoff', 'landing')
      return t > 0 ? { value: jumpHeightIn(t) } : null
    }
    case 'sprint10': {
      const t = secs('start', 'finish')
      return t > 0 ? { value: t, mph: mph(10, t) } : null
    }
    case 'dash40': {
      const t = secs('start', 'finish')
      const s = secs('start', 'split10')
      return t > 0 && s > 0 && s < t ? { value: t, split10: s, mph: mph(40, t), split_mph: mph(10, s) } : null
    }
    case 'pro_agility':
    case 'three_cone': {
      const t = secs('start', 'finish')
      return t > 0 ? { value: t } : null
    }
    case 'broad':
      return null
  }
}

export function formatResult(test: TestDef, value: number): string {
  if (test.unit === 's') return `${value.toFixed(2)} s`
  if (test.id === 'broad') return `${Math.floor(value / 12)}′ ${Math.round(value % 12)}″`
  return `${value.toFixed(1)}″`
}

/** Is `a` better than `b` for this test? */
export function better(test: TestDef, a: number, b: number): boolean {
  return test.higherIsBetter ? a > b : a < b
}
