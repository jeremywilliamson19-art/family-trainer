// Turning form measurements into findings and drills. Rule-based and
// conservative: each finding shows the number it's based on, and the
// parent confirms or dismisses it.
import type { CutMetrics, JumpMetrics, SprintMetrics } from './metrics'

export interface Drill {
  exercise_id: string
  name: string
  how: string
  dose: string
}

export const DRILLS: Record<string, Drill> = {
  wall_drill: { exercise_id: 'wall_drill', name: 'Wall acceleration drill', how: 'Lean into a wall at 45°, body in a straight line. Drive one knee up, switch fast.', dose: '3 × 6 switches' },
  falling_start: { exercise_id: 'falling_start', name: 'Falling starts', how: 'Stand tall, lean forward until you have to step, then sprint 10 yards staying low.', dose: '4 × 10 yd' },
  three_point_start: { exercise_id: 'three_point_start', name: 'Stance and start (3-point)', how: 'Running-back stance. First 3 steps push back into the ground; eyes down, rise gradually.', dose: '5 × 10 yd' },
  a_march: { exercise_id: 'a_march', name: 'A-march', how: 'March tall: knee up to hip height, toes up, opposite arm drives.', dose: '2 × 20 yd' },
  a_skip: { exercise_id: 'a_skip', name: 'A-skips', how: 'Skip with a big knee drive and a quick, flat-foot step down under the hips.', dose: '2 × 20 yd' },
  b_skip: { exercise_id: 'b_skip', name: 'B-skips', how: 'A-skip, then extend the leg and paw it back down under the hips.', dose: '2 × 20 yd' },
  butt_kick: { exercise_id: 'butt_kick', name: 'Butt kicks', how: 'Quick heels up under the hips, staying tall.', dose: '2 × 20 yd' },
  wicket_run: { exercise_id: 'wicket_run', name: 'Wicket runs', how: 'Run over low sticks or mini hurdles set 4–5 feet apart. Feet land under the hips.', dose: '4 × 20 yd' },
  fast_leg: { exercise_id: 'fast_leg', name: 'Fast-leg drill', how: 'Jog; every third step, snap one heel up and the foot straight down under you.', dose: '3 × 20 yd' },
  arm_swing_drill: { exercise_id: 'arm_swing_drill', name: 'Seated arm-swing drill', how: 'Sit tall, elbows at 90°. Swing hands from hip pocket to chin, fast, no crossing the body.', dose: '3 × 15 sec' },
  squat_to_stick: { exercise_id: 'squat_to_stick', name: 'Jump and stick', how: 'Quick dip to about a quarter squat with arms back, jump, land softly and freeze.', dose: '3 × 5' },
  jump_and_reach: { exercise_id: 'jump_and_reach', name: 'Jump and reach', how: 'Swing arms back, then up hard; reach for a mark on the wall and fully straighten hips, knees and ankles.', dose: '3 × 5' },
  med_ball_scoop_toss: { exercise_id: 'med_ball_scoop_toss', name: 'Med ball scoop toss', how: 'Light ball between the knees, dip, and explode up, throwing it high behind you.', dose: '3 × 5' },
  snap_down: { exercise_id: 'snap_down', name: 'Snap-downs', how: 'Rise to the toes with arms up, then snap into an athletic stance and freeze, knees bent and over the toes.', dose: '2 × 5' },
  drop_stick: { exercise_id: 'drop_stick', name: 'Drop and stick', how: 'Step off a low box, land on both feet, bend knees and hips, freeze for 2 seconds.', dose: '2 × 5' },
  band_walk: { exercise_id: 'band_walk', name: 'Lateral band walks', how: 'Band around the knees, quarter squat, step sideways keeping knees pushed out.', dose: '3 × 10 steps each way' },
  single_leg_bridge: { exercise_id: 'single_leg_bridge', name: 'Single-leg glute bridge', how: 'On your back, one foot down, push hips up and hold 2 seconds. Keep hips level.', dose: '3 × 8 each leg' },
  jump_cut: { exercise_id: 'jump_cut', name: 'Jump cuts', how: 'Running-back jump cut: hop sideways off both feet, land balanced and low, burst forward.', dose: '3 × 4 each way' },
  cone_weave: { exercise_id: 'cone_weave', name: 'Cone weave', how: 'Weave through 5 cones 2 yards apart. Sink the hips at each cone, ball high and tight.', dose: '4 reps' },
  lateral_shuffle: { exercise_id: 'lateral_shuffle', name: 'Shuffle and plant', how: 'Shuffle 5 yards, plant the outside foot with hips low, and drive back.', dose: '4 × 2 plants' },
  ladder_drill: { exercise_id: 'ladder_drill', name: 'Ladder footwork', how: 'Quick feet through an agility ladder: in-in-out-out, then lateral icky shuffle.', dose: '3 × 20 sec' },
}

export interface Finding {
  id: string
  /** 'focus' = something to work on; 'good' = keep doing it; 'note' = about the measurement. */
  kind: 'focus' | 'good' | 'note'
  title: string
  detail: string
  drills: string[]
}

const r = (n: number) => Math.round(n)

export function sprintFindings(m: SprintMetrics): Finding[] {
  const out: Finding[] = []
  if (m.startLean !== null) {
    if (m.startLean < 20)
      out.push({ id: 'upright_start', kind: 'focus', title: 'Stands up too fast at the start', detail: `Body lean in the first steps was about ${r(m.startLean)}°. Strong starts lean 30–45° and rise gradually over 10 yards.`, drills: ['wall_drill', 'falling_start', 'three_point_start'] })
    else if (m.startLean >= 30) out.push({ id: 'good_start', kind: 'good', title: 'Good forward lean out of the start', detail: `About ${r(m.startLean)}° in the first steps.`, drills: [] })
  }
  if (m.kneeDrive !== null) {
    if (m.kneeDrive < 60)
      out.push({ id: 'low_knees', kind: 'focus', title: 'Low knee drive', detail: `Thighs came up to about ${r(m.kneeDrive)}° from vertical. Aim for close to hip height (75–90°).`, drills: ['a_march', 'a_skip', 'wall_drill'] })
    else if (m.kneeDrive >= 75) out.push({ id: 'good_knees', kind: 'good', title: 'Strong knee drive', detail: `Thighs reached about ${r(m.kneeDrive)}°.`, drills: [] })
  }
  if (m.heelRecovery !== null && m.heelRecovery > 80)
    out.push({ id: 'low_heels', kind: 'focus', title: 'Heels stay low behind', detail: `Knees only folded to about ${r(m.heelRecovery)}°. Pulling the heel up under the hip makes the leg swing through faster.`, drills: ['butt_kick', 'b_skip', 'fast_leg'] })
  if (m.armSwing !== null) {
    if (m.armSwing < 60)
      out.push({ id: 'small_arms', kind: 'focus', title: 'Small arm swing', detail: `Arms moved through about ${r(m.armSwing)}°. Arms set the rhythm for the legs: hip to chin, elbows near 90°.`, drills: ['arm_swing_drill', 'a_march'] })
    else if (m.armSwing >= 90) out.push({ id: 'good_arms', kind: 'good', title: 'Powerful arm action', detail: `About ${r(m.armSwing)}° of swing.`, drills: [] })
  }
  if (m.overstride !== null && m.overstride > 0.35)
    out.push({ id: 'overstride', kind: 'focus', title: 'Feet land too far in front', detail: `Feet landed about ${r(m.overstride * 100)}% of a leg length ahead of the hips. That acts like a brake; land closer to under the body.`, drills: ['wicket_run', 'fast_leg', 'a_skip'] })
  return out
}

export function jumpFindings(m: JumpMetrics): Finding[] {
  const out: Finding[] = []
  if (m.dipKnee !== null) {
    if (m.dipKnee > 135)
      out.push({ id: 'shallow_dip', kind: 'focus', title: 'Shallow dip before jumping', detail: `Knees bent only to about ${r(m.dipKnee)}°. A quick dip to about a quarter squat (110–130°) stores more spring.`, drills: ['squat_to_stick', 'jump_and_reach'] })
    else if (m.dipKnee >= 90) out.push({ id: 'good_dip', kind: 'good', title: 'Good dip depth', detail: `About ${r(m.dipKnee)}° at the knees.`, drills: [] })
  }
  if (m.takeoffKnee !== null && m.takeoffHip !== null) {
    if (m.takeoffKnee < 160 || m.takeoffHip < 160)
      out.push({ id: 'no_extension', kind: 'focus', title: 'Not fully straightening at takeoff', detail: `At takeoff the knees reached about ${r(m.takeoffKnee)}° and hips ${r(m.takeoffHip)}° (straight is 180°). Full “triple extension” of ankles, knees and hips adds height.`, drills: ['jump_and_reach', 'med_ball_scoop_toss'] })
    else out.push({ id: 'good_extension', kind: 'good', title: 'Full extension at takeoff', detail: `Knees ${r(m.takeoffKnee)}°, hips ${r(m.takeoffHip)}°.`, drills: [] })
  }
  if (m.armsUp === false)
    out.push({ id: 'arms_down', kind: 'focus', title: 'Arms aren’t helping', detail: 'Hands were below the shoulders at takeoff. A hard arm swing adds roughly 10% to a jump.', drills: ['jump_and_reach'] })
  if (m.airKnee !== null && m.airKnee < 120)
    out.push({ id: 'tucked', kind: 'note', title: 'Knees tucked in the air', detail: `Knees bent to about ${r(m.airKnee)}° in the air. That makes the flight longer, so the jump height reads too high. Retest landing with straight legs.`, drills: [] })
  if (m.landingKnee !== null) {
    if (m.landingKnee > 155)
      out.push({ id: 'stiff_landing', kind: 'focus', title: 'Stiff landing', detail: `Knees only bent to about ${r(m.landingKnee)}° when landing. Soft landings with bent knees and hips protect knees and set up the next move.`, drills: ['snap_down', 'drop_stick'] })
    else out.push({ id: 'good_landing', kind: 'good', title: 'Soft landing', detail: `Knees bent to about ${r(m.landingKnee)}°.`, drills: [] })
  }
  if (m.kneeToAnkleWidth !== null && m.kneeToAnkleWidth < 0.8)
    out.push({ id: 'valgus', kind: 'focus', title: 'Knees cave in on landing', detail: `Knees came in to ${r(m.kneeToAnkleWidth * 100)}% of the ankle width. Knees should track over the toes. This is the most important landing fix for knee safety.`, drills: ['band_walk', 'single_leg_bridge', 'drop_stick'] })
  return out
}

export function cutFindings(m: CutMetrics): Finding[] {
  if (m.hipDrop === null) return []
  return m.hipDrop < 0.08
    ? [{ id: 'tall_cuts', kind: 'focus', title: 'Stays tall when changing direction', detail: `Hips dropped only about ${r(m.hipDrop * 100)}% of a leg length at the turns. Sinking the hips before a cut makes it faster and safer.`, drills: ['lateral_shuffle', 'jump_cut', 'cone_weave'] }]
    : [{ id: 'good_cuts', kind: 'good', title: 'Gets low into cuts', detail: `Hips dropped about ${r(m.hipDrop * 100)}% of a leg length at the turns.`, drills: [] }]
}

/** Running-back extras that fit each kind of test, beyond the form fixes. */
export const FOOTBALL_EXTRAS: Record<'sprint' | 'jump' | 'cut', string[]> = {
  sprint: ['three_point_start', 'falling_start'],
  jump: ['squat_to_stick', 'jump_cut'],
  cut: ['jump_cut', 'cone_weave', 'ladder_drill'],
}

/** Drills for a set of kept findings: fixes first, then football extras; no repeats. */
export function drillsFor(findings: Finding[], form: 'sprint' | 'jump' | 'cut'): { fixes: Drill[]; extras: Drill[] } {
  const fixIds = [...new Set(findings.filter((f) => f.kind === 'focus').flatMap((f) => f.drills))]
  const extraIds = FOOTBALL_EXTRAS[form].filter((d) => !fixIds.includes(d))
  return { fixes: fixIds.map((d) => DRILLS[d]), extras: extraIds.map((d) => DRILLS[d]) }
}
