// Starter programs (spec section 8). Picking one copies it into the
// member's own editable program.
import type { ProgramDay, ProgramExercise } from './types'

export interface Template {
  id: string
  name: string
  blurb: string
  location: 'gym' | 'home'
  youth: boolean
  days: ProgramDay[]
}

const x = (exercise_id: string, sets: number, rep_min: number, rep_max: number, rest_s = 90, extra: Partial<ProgramExercise> = {}): ProgramExercise => ({
  exercise_id,
  sets,
  rep_min,
  rep_max,
  rest_s,
  ...extra,
})

/**
 * 4-day upper/lower, gym. Direct arm work on all four days: about 18 hard
 * sets of triceps and 15 of biceps a week, with chest, lats and shoulders
 * as the other priorities. Conditioning is optional.
 */
export const UPPER_LOWER: Template = {
  id: 'upper_lower_arms',
  name: '4-day upper/lower, arm focus',
  blurb: 'Gym. Arms trained directly 4×/week (triceps emphasized), plus chest, lats and shoulders.',
  location: 'gym',
  youth: false,
  days: [
    {
      name: 'Upper A',
      exercises: [
        x('bench_press', 3, 6, 10, 150),
        x('lat_pulldown', 3, 8, 12, 120),
        x('incline_db_press', 3, 8, 12, 120),
        x('seated_cable_row', 3, 10, 12, 90),
        x('overhead_cable_ext', 3, 10, 15, 75),
        x('ez_curl', 3, 8, 12, 75),
        x('triceps_pushdown', 3, 12, 15, 60),
        x('lateral_raise', 3, 12, 20, 60),
      ],
    },
    {
      name: 'Lower A',
      exercises: [
        x('back_squat', 3, 6, 10, 180),
        x('romanian_deadlift', 3, 8, 10, 150),
        x('leg_press', 3, 10, 15, 120),
        x('leg_curl', 3, 10, 15, 90),
        x('calf_raise', 3, 10, 15, 60),
        x('hammer_curl', 3, 10, 12, 60),
        x('overhead_db_ext', 3, 10, 15, 60),
        x('incline_walk', 1, 20, 30, 0, { optional: true }),
      ],
    },
    {
      name: 'Upper B',
      exercises: [
        x('overhead_press', 3, 6, 10, 150),
        x('pull_up', 3, 6, 10, 120),
        x('db_bench_press', 3, 8, 12, 120),
        x('chest_supported_row', 3, 10, 12, 90),
        x('skull_crusher', 3, 8, 12, 75),
        x('incline_db_curl', 3, 10, 12, 75),
        x('dips', 3, 8, 12, 90),
        x('rear_delt_fly', 3, 15, 20, 60),
      ],
    },
    {
      name: 'Lower B',
      exercises: [
        x('deadlift', 3, 5, 8, 180),
        x('bulgarian_split_squat', 3, 8, 12, 120),
        x('leg_extension', 3, 12, 15, 75),
        x('leg_curl', 3, 10, 15, 75),
        x('cable_curl', 3, 12, 15, 60),
        x('triceps_pushdown', 3, 12, 15, 60),
        x('bike_intervals', 1, 15, 20, 0, { optional: true }),
      ],
    },
  ],
}

/** 3-day dumbbell full body, home. About 14 triceps and 12 biceps sets a week. */
export const DUMBBELL_HOME: Template = {
  id: 'db_full_body_arms',
  name: '3-day dumbbell full body, arm focus',
  blurb: 'Home. Dumbbells (a bench and pull-up bar help). Arms every session.',
  location: 'home',
  youth: false,
  days: [
    {
      name: 'Full body A',
      exercises: [
        x('db_bench_press', 3, 8, 12, 120),
        x('one_arm_db_row', 3, 10, 12, 90),
        x('goblet_squat', 3, 10, 15, 90),
        x('overhead_db_ext', 3, 10, 15, 60),
        x('db_curl', 3, 10, 12, 60),
        x('lateral_raise', 3, 12, 20, 60),
      ],
    },
    {
      name: 'Full body B',
      exercises: [
        x('pull_up', 3, 6, 10, 120),
        x('db_shoulder_press', 3, 8, 12, 90),
        x('db_rdl', 3, 10, 12, 90),
        x('lying_db_ext', 3, 10, 12, 60),
        x('hammer_curl', 3, 10, 12, 60),
        x('diamond_push_up', 2, 10, 20, 60),
      ],
    },
    {
      name: 'Full body C',
      exercises: [
        x('push_up', 3, 10, 20, 75),
        x('one_arm_db_row', 3, 10, 12, 90),
        x('split_squat', 3, 10, 12, 90),
        x('close_grip_db_press', 3, 10, 12, 75),
        x('concentration_curl', 3, 10, 12, 60),
        x('db_curl', 3, 10, 12, 60),
        x('db_kickback', 3, 12, 15, 60),
        x('home_circuit', 1, 12, 20, 0, { optional: true }),
      ],
    },
  ],
}

/**
 * 3-day youth athletic development: landing drills first, then jumps,
 * sprint mechanics and technique-first strength. Effort capped at RPE 8,
 * foot contacts ≤ 80 per session.
 */
export const YOUTH: Template = {
  id: 'youth_athlete',
  name: 'Youth athletic development (3 days)',
  blurb: 'Jump higher, run faster, get stronger, safely. Edited by a parent.',
  location: 'home',
  youth: true,
  days: [
    {
      name: 'Day 1: jump + push/pull',
      exercises: [
        x('snap_down', 2, 5, 5, 60, { rpe: 6 }), // 10 contacts
        x('pogo_hops', 2, 10, 10, 60, { rpe: 6 }), // 20
        x('box_jump', 3, 4, 4, 90, { rpe: 7 }), // 12
        x('a_skip', 2, 20, 20, 60, { rpe: 6 }),
        x('goblet_squat', 3, 8, 12, 90, { rpe: 7 }),
        x('push_up', 3, 8, 15, 75, { rpe: 7 }),
        x('inverted_row', 3, 8, 12, 75, { rpe: 7 }),
        x('plank', 3, 20, 40, 45, { rpe: 6 }),
      ],
    },
    {
      name: 'Day 2: speed + legs',
      exercises: [
        x('drop_stick', 2, 5, 5, 60, { rpe: 6 }), // 10
        x('broad_jump', 3, 4, 4, 90, { rpe: 7 }), // 12
        x('lateral_bound', 2, 6, 6, 75, { rpe: 7 }), // 12
        x('wall_drill', 3, 6, 6, 60, { rpe: 6 }),
        x('acceleration_start', 4, 10, 10, 90, { rpe: 8 }),
        x('split_squat', 3, 8, 10, 75, { rpe: 7 }),
        x('db_rdl', 3, 8, 12, 75, { rpe: 7 }),
        x('med_ball_chest_pass', 3, 6, 6, 60, { rpe: 7 }),
        x('side_plank', 2, 20, 30, 45, { rpe: 6 }),
      ],
    },
    {
      name: 'Day 3: power + full body',
      exercises: [
        x('snap_down', 2, 5, 5, 60, { rpe: 6 }), // 10
        x('pogo_hops', 2, 10, 10, 60, { rpe: 6 }), // 20
        x('single_leg_hop', 2, 4, 4, 90, { rpe: 7 }), // 8
        x('sprint_20', 6, 20, 20, 90, { rpe: 8 }),
        x('step_up', 3, 8, 10, 75, { rpe: 7 }),
        x('push_up', 3, 8, 15, 75, { rpe: 7 }),
        x('one_arm_db_row', 3, 8, 12, 75, { rpe: 7 }),
        x('med_ball_slam', 3, 8, 8, 60, { rpe: 7 }),
        x('dead_bug', 2, 8, 12, 45, { rpe: 6 }),
      ],
    },
  ],
}

export const TEMPLATES = [UPPER_LOWER, DUMBBELL_HOME, YOUTH]
