// The built-in exercise library.

export type Muscle =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'

export const MUSCLES: { id: Muscle; label: string }[] = [
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'biceps', label: 'Biceps' },
  { id: 'triceps', label: 'Triceps' },
  { id: 'quads', label: 'Quads' },
  { id: 'hamstrings', label: 'Hamstrings' },
  { id: 'glutes', label: 'Glutes' },
  { id: 'calves', label: 'Calves' },
  { id: 'core', label: 'Core' },
  { id: 'forearms', label: 'Forearms' },
]

/** What an exercise needs. "gym" = commercial-gym machines/racks. */
export type Equipment = 'gym' | 'barbell' | 'dumbbells' | 'pullup_bar' | 'bands' | 'bench' | 'kettlebell' | 'box' | 'medball' | 'none'

export type Kind = 'strength' | 'plyo' | 'landing' | 'sprint' | 'conditioning' | 'core'

/** How weight goes up when it's time to progress. */
export type Load = 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight' | 'kettlebell'

export interface Exercise {
  id: string
  name: string
  kind: Kind
  primary: Muscle[]
  secondary?: Muscle[]
  /** All of these are needed. */
  needs: Equipment[]
  load: Load
  /** Lower-body barbell lifts progress in bigger jumps. */
  lower?: boolean
  /** Suitable for the son's program and library. */
  youth?: boolean
  /** Foot contacts per rep (plyometrics). */
  contacts?: number
  /** Higher-intensity jumps that need landing drills first. */
  highIntensity?: boolean
  /** Logged as seconds or yards instead of reps. */
  unit?: 'reps' | 'sec' | 'yd' | 'min'
  /** Main lifts get strength charts and plateau checks. */
  main?: boolean
}

const E = (e: Exercise) => e

export const EXERCISES: Exercise[] = [
  // ---- Chest
  E({ id: 'bench_press', name: 'Bench press', kind: 'strength', primary: ['chest'], secondary: ['triceps', 'shoulders'], needs: ['gym'], load: 'barbell', main: true }),
  E({ id: 'incline_db_press', name: 'Incline dumbbell press', kind: 'strength', primary: ['chest'], secondary: ['shoulders', 'triceps'], needs: ['dumbbells', 'bench'], load: 'dumbbell' }),
  E({ id: 'db_bench_press', name: 'Dumbbell bench press', kind: 'strength', primary: ['chest'], secondary: ['triceps', 'shoulders'], needs: ['dumbbells', 'bench'], load: 'dumbbell', main: true }),
  E({ id: 'db_floor_press', name: 'Dumbbell floor press', kind: 'strength', primary: ['chest'], secondary: ['triceps'], needs: ['dumbbells'], load: 'dumbbell' }),
  E({ id: 'cable_fly', name: 'Cable fly', kind: 'strength', primary: ['chest'], needs: ['gym'], load: 'cable' }),
  E({ id: 'machine_chest_press', name: 'Machine chest press', kind: 'strength', primary: ['chest'], secondary: ['triceps'], needs: ['gym'], load: 'machine' }),
  E({ id: 'dips', name: 'Dips', kind: 'strength', primary: ['triceps', 'chest'], secondary: ['shoulders'], needs: ['gym'], load: 'bodyweight' }),
  E({ id: 'push_up', name: 'Push-up', kind: 'strength', primary: ['chest'], secondary: ['triceps', 'shoulders', 'core'], needs: ['none'], load: 'bodyweight', youth: true }),

  // ---- Back
  E({ id: 'lat_pulldown', name: 'Lat pulldown', kind: 'strength', primary: ['back'], secondary: ['biceps'], needs: ['gym'], load: 'cable' }),
  E({ id: 'pull_up', name: 'Pull-up', kind: 'strength', primary: ['back'], secondary: ['biceps'], needs: ['pullup_bar'], load: 'bodyweight', main: true }),
  E({ id: 'chin_up', name: 'Chin-up', kind: 'strength', primary: ['back', 'biceps'], needs: ['pullup_bar'], load: 'bodyweight' }),
  E({ id: 'band_pulldown', name: 'Band lat pulldown', kind: 'strength', primary: ['back'], secondary: ['biceps'], needs: ['bands'], load: 'bodyweight' }),
  E({ id: 'seated_cable_row', name: 'Seated cable row', kind: 'strength', primary: ['back'], secondary: ['biceps'], needs: ['gym'], load: 'cable' }),
  E({ id: 'chest_supported_row', name: 'Chest-supported row', kind: 'strength', primary: ['back'], secondary: ['biceps', 'shoulders'], needs: ['gym'], load: 'machine' }),
  E({ id: 'barbell_row', name: 'Barbell row', kind: 'strength', primary: ['back'], secondary: ['biceps'], needs: ['gym'], load: 'barbell', main: true }),
  E({ id: 'one_arm_db_row', name: 'One-arm dumbbell row', kind: 'strength', primary: ['back'], secondary: ['biceps'], needs: ['dumbbells'], load: 'dumbbell', youth: true }),
  E({ id: 'inverted_row', name: 'Inverted row', kind: 'strength', primary: ['back'], secondary: ['biceps'], needs: ['none'], load: 'bodyweight', youth: true }),
  E({ id: 'db_pullover', name: 'Dumbbell pullover', kind: 'strength', primary: ['back'], secondary: ['chest'], needs: ['dumbbells', 'bench'], load: 'dumbbell' }),

  // ---- Shoulders
  E({ id: 'overhead_press', name: 'Overhead press', kind: 'strength', primary: ['shoulders'], secondary: ['triceps'], needs: ['gym'], load: 'barbell', main: true }),
  E({ id: 'db_shoulder_press', name: 'Dumbbell shoulder press', kind: 'strength', primary: ['shoulders'], secondary: ['triceps'], needs: ['dumbbells'], load: 'dumbbell', main: true }),
  E({ id: 'lateral_raise', name: 'Lateral raise', kind: 'strength', primary: ['shoulders'], needs: ['dumbbells'], load: 'dumbbell' }),
  E({ id: 'cable_lateral_raise', name: 'Cable lateral raise', kind: 'strength', primary: ['shoulders'], needs: ['gym'], load: 'cable' }),
  E({ id: 'rear_delt_fly', name: 'Rear delt fly', kind: 'strength', primary: ['shoulders'], secondary: ['back'], needs: ['dumbbells'], load: 'dumbbell' }),
  E({ id: 'face_pull', name: 'Face pull', kind: 'strength', primary: ['shoulders'], secondary: ['back'], needs: ['gym'], load: 'cable' }),
  E({ id: 'band_pull_apart', name: 'Band pull-apart', kind: 'strength', primary: ['shoulders'], secondary: ['back'], needs: ['bands'], load: 'bodyweight' }),

  // ---- Triceps (the bigger part of the upper arm)
  E({ id: 'triceps_pushdown', name: 'Triceps pushdown', kind: 'strength', primary: ['triceps'], needs: ['gym'], load: 'cable' }),
  E({ id: 'overhead_cable_ext', name: 'Overhead cable triceps extension', kind: 'strength', primary: ['triceps'], needs: ['gym'], load: 'cable' }),
  E({ id: 'skull_crusher', name: 'EZ-bar skull crusher', kind: 'strength', primary: ['triceps'], needs: ['gym'], load: 'barbell' }),
  E({ id: 'close_grip_bench', name: 'Close-grip bench press', kind: 'strength', primary: ['triceps'], secondary: ['chest'], needs: ['gym'], load: 'barbell', main: true }),
  E({ id: 'overhead_db_ext', name: 'Overhead dumbbell triceps extension', kind: 'strength', primary: ['triceps'], needs: ['dumbbells'], load: 'dumbbell' }),
  E({ id: 'lying_db_ext', name: 'Lying dumbbell triceps extension', kind: 'strength', primary: ['triceps'], needs: ['dumbbells'], load: 'dumbbell' }),
  E({ id: 'db_kickback', name: 'Dumbbell kickback', kind: 'strength', primary: ['triceps'], needs: ['dumbbells'], load: 'dumbbell' }),
  E({ id: 'close_grip_db_press', name: 'Close-grip dumbbell press', kind: 'strength', primary: ['triceps'], secondary: ['chest'], needs: ['dumbbells'], load: 'dumbbell' }),
  E({ id: 'diamond_push_up', name: 'Diamond push-up', kind: 'strength', primary: ['triceps'], secondary: ['chest'], needs: ['none'], load: 'bodyweight' }),
  E({ id: 'band_pushdown', name: 'Band triceps pushdown', kind: 'strength', primary: ['triceps'], needs: ['bands'], load: 'bodyweight' }),

  // ---- Biceps
  E({ id: 'ez_curl', name: 'EZ-bar curl', kind: 'strength', primary: ['biceps'], secondary: ['forearms'], needs: ['gym'], load: 'barbell' }),
  E({ id: 'cable_curl', name: 'Cable curl', kind: 'strength', primary: ['biceps'], needs: ['gym'], load: 'cable' }),
  E({ id: 'db_curl', name: 'Dumbbell curl', kind: 'strength', primary: ['biceps'], secondary: ['forearms'], needs: ['dumbbells'], load: 'dumbbell' }),
  E({ id: 'hammer_curl', name: 'Hammer curl', kind: 'strength', primary: ['biceps', 'forearms'], needs: ['dumbbells'], load: 'dumbbell' }),
  E({ id: 'incline_db_curl', name: 'Incline dumbbell curl', kind: 'strength', primary: ['biceps'], needs: ['dumbbells', 'bench'], load: 'dumbbell' }),
  E({ id: 'concentration_curl', name: 'Concentration curl', kind: 'strength', primary: ['biceps'], needs: ['dumbbells'], load: 'dumbbell' }),
  E({ id: 'band_curl', name: 'Band curl', kind: 'strength', primary: ['biceps'], needs: ['bands'], load: 'bodyweight' }),

  // ---- Legs
  E({ id: 'back_squat', name: 'Back squat', kind: 'strength', primary: ['quads', 'glutes'], secondary: ['core'], needs: ['gym'], load: 'barbell', lower: true, main: true }),
  E({ id: 'deadlift', name: 'Deadlift', kind: 'strength', primary: ['hamstrings', 'glutes', 'back'], needs: ['gym'], load: 'barbell', lower: true, main: true }),
  E({ id: 'romanian_deadlift', name: 'Romanian deadlift', kind: 'strength', primary: ['hamstrings', 'glutes'], needs: ['gym'], load: 'barbell', lower: true }),
  E({ id: 'db_rdl', name: 'Dumbbell Romanian deadlift', kind: 'strength', primary: ['hamstrings', 'glutes'], needs: ['dumbbells'], load: 'dumbbell', youth: true }),
  E({ id: 'leg_press', name: 'Leg press', kind: 'strength', primary: ['quads', 'glutes'], needs: ['gym'], load: 'machine' }),
  E({ id: 'leg_curl', name: 'Leg curl', kind: 'strength', primary: ['hamstrings'], needs: ['gym'], load: 'machine' }),
  E({ id: 'leg_extension', name: 'Leg extension', kind: 'strength', primary: ['quads'], needs: ['gym'], load: 'machine' }),
  E({ id: 'goblet_squat', name: 'Goblet squat', kind: 'strength', primary: ['quads', 'glutes'], secondary: ['core'], needs: ['dumbbells'], load: 'dumbbell', youth: true }),
  E({ id: 'bulgarian_split_squat', name: 'Bulgarian split squat', kind: 'strength', primary: ['quads', 'glutes'], needs: ['dumbbells', 'bench'], load: 'dumbbell' }),
  E({ id: 'split_squat', name: 'Split squat', kind: 'strength', primary: ['quads', 'glutes'], needs: ['none'], load: 'bodyweight', youth: true }),
  E({ id: 'step_up', name: 'Step-up', kind: 'strength', primary: ['quads', 'glutes'], needs: ['box'], load: 'bodyweight', youth: true }),
  E({ id: 'calf_raise', name: 'Calf raise', kind: 'strength', primary: ['calves'], needs: ['none'], load: 'bodyweight', youth: true }),
  E({ id: 'kb_swing', name: 'Kettlebell swing', kind: 'strength', primary: ['glutes', 'hamstrings'], secondary: ['core'], needs: ['kettlebell'], load: 'kettlebell' }),

  // ---- Core
  E({ id: 'plank', name: 'Plank', kind: 'core', primary: ['core'], needs: ['none'], load: 'bodyweight', youth: true, unit: 'sec' }),
  E({ id: 'side_plank', name: 'Side plank', kind: 'core', primary: ['core'], needs: ['none'], load: 'bodyweight', youth: true, unit: 'sec' }),
  E({ id: 'dead_bug', name: 'Dead bug', kind: 'core', primary: ['core'], needs: ['none'], load: 'bodyweight', youth: true }),
  E({ id: 'hanging_knee_raise', name: 'Hanging knee raise', kind: 'core', primary: ['core'], needs: ['pullup_bar'], load: 'bodyweight' }),
  E({ id: 'cable_crunch', name: 'Cable crunch', kind: 'core', primary: ['core'], needs: ['gym'], load: 'cable' }),

  // ---- Youth power and speed
  E({ id: 'snap_down', name: 'Snap-down to stick (landing drill)', kind: 'landing', primary: ['quads', 'glutes'], needs: ['none'], load: 'bodyweight', youth: true, contacts: 1 }),
  E({ id: 'drop_stick', name: 'Drop and stick (landing drill)', kind: 'landing', primary: ['quads', 'glutes'], needs: ['box'], load: 'bodyweight', youth: true, contacts: 1 }),
  E({ id: 'pogo_hops', name: 'Pogo hops', kind: 'plyo', primary: ['calves'], needs: ['none'], load: 'bodyweight', youth: true, contacts: 1 }),
  E({ id: 'box_jump', name: 'Box jump (low box)', kind: 'plyo', primary: ['quads', 'glutes'], needs: ['box'], load: 'bodyweight', youth: true, contacts: 1, highIntensity: true }),
  E({ id: 'broad_jump', name: 'Broad jump', kind: 'plyo', primary: ['quads', 'glutes'], needs: ['none'], load: 'bodyweight', youth: true, contacts: 1, highIntensity: true }),
  E({ id: 'lateral_bound', name: 'Lateral bound and stick', kind: 'plyo', primary: ['glutes', 'quads'], needs: ['none'], load: 'bodyweight', youth: true, contacts: 1, highIntensity: true }),
  E({ id: 'single_leg_hop', name: 'Single-leg hop and stick', kind: 'plyo', primary: ['quads', 'calves'], needs: ['none'], load: 'bodyweight', youth: true, contacts: 1, highIntensity: true }),
  E({ id: 'a_skip', name: 'A-skips', kind: 'sprint', primary: ['calves', 'quads'], needs: ['none'], load: 'bodyweight', youth: true, unit: 'yd' }),
  E({ id: 'wall_drill', name: 'Wall acceleration drill', kind: 'sprint', primary: ['quads', 'glutes'], needs: ['none'], load: 'bodyweight', youth: true }),
  E({ id: 'acceleration_start', name: 'Acceleration starts (10 yd)', kind: 'sprint', primary: ['quads', 'glutes', 'hamstrings'], needs: ['none'], load: 'bodyweight', youth: true, unit: 'yd' }),
  E({ id: 'sprint_20', name: 'Sprints (20 yd)', kind: 'sprint', primary: ['hamstrings', 'glutes'], needs: ['none'], load: 'bodyweight', youth: true, unit: 'yd' }),
  E({ id: 'med_ball_chest_pass', name: 'Med ball chest pass', kind: 'plyo', primary: ['chest'], secondary: ['triceps'], needs: ['medball'], load: 'bodyweight', youth: true }),
  E({ id: 'med_ball_slam', name: 'Med ball slam', kind: 'plyo', primary: ['core', 'back'], needs: ['medball'], load: 'bodyweight', youth: true }),
  E({ id: 'med_ball_rotational_throw', name: 'Med ball rotational throw', kind: 'plyo', primary: ['core'], needs: ['medball'], load: 'bodyweight', youth: true }),

  // ---- Drills suggested by form analysis (youth-safe)
  E({ id: 'a_march', name: 'A-march', kind: 'sprint', primary: ['quads', 'core'], needs: ['none'], load: 'bodyweight', youth: true, unit: 'yd' }),
  E({ id: 'b_skip', name: 'B-skips', kind: 'sprint', primary: ['hamstrings'], needs: ['none'], load: 'bodyweight', youth: true, unit: 'yd' }),
  E({ id: 'butt_kick', name: 'Butt kicks', kind: 'sprint', primary: ['hamstrings'], needs: ['none'], load: 'bodyweight', youth: true, unit: 'yd' }),
  E({ id: 'wicket_run', name: 'Wicket runs (mini hurdles)', kind: 'sprint', primary: ['hamstrings', 'quads'], needs: ['none'], load: 'bodyweight', youth: true, unit: 'yd' }),
  E({ id: 'fast_leg', name: 'Fast-leg drill', kind: 'sprint', primary: ['hamstrings'], needs: ['none'], load: 'bodyweight', youth: true }),
  E({ id: 'falling_start', name: 'Falling starts', kind: 'sprint', primary: ['quads', 'glutes'], needs: ['none'], load: 'bodyweight', youth: true, unit: 'yd' }),
  E({ id: 'three_point_start', name: 'Stance and start (3-point)', kind: 'sprint', primary: ['quads', 'glutes'], needs: ['none'], load: 'bodyweight', youth: true, unit: 'yd' }),
  E({ id: 'arm_swing_drill', name: 'Seated arm-swing drill', kind: 'sprint', primary: ['shoulders'], needs: ['none'], load: 'bodyweight', youth: true, unit: 'sec' }),
  E({ id: 'squat_to_stick', name: 'Jump and stick (full dip)', kind: 'plyo', primary: ['quads', 'glutes'], needs: ['none'], load: 'bodyweight', youth: true, contacts: 1 }),
  E({ id: 'jump_and_reach', name: 'Jump and reach', kind: 'plyo', primary: ['quads', 'glutes', 'calves'], needs: ['none'], load: 'bodyweight', youth: true, contacts: 1 }),
  E({ id: 'med_ball_scoop_toss', name: 'Med ball scoop toss', kind: 'plyo', primary: ['glutes', 'hamstrings'], needs: ['medball'], load: 'bodyweight', youth: true }),
  E({ id: 'band_walk', name: 'Lateral band walk', kind: 'strength', primary: ['glutes'], needs: ['bands'], load: 'bodyweight', youth: true }),
  E({ id: 'single_leg_bridge', name: 'Single-leg glute bridge', kind: 'strength', primary: ['glutes', 'hamstrings'], needs: ['none'], load: 'bodyweight', youth: true }),
  E({ id: 'jump_cut', name: 'Jump cuts', kind: 'plyo', primary: ['quads', 'glutes'], needs: ['none'], load: 'bodyweight', youth: true, contacts: 2 }),
  E({ id: 'cone_weave', name: 'Cone weave', kind: 'sprint', primary: ['quads', 'calves'], needs: ['none'], load: 'bodyweight', youth: true, unit: 'yd' }),
  E({ id: 'lateral_shuffle', name: 'Lateral shuffle and plant', kind: 'sprint', primary: ['glutes', 'quads'], needs: ['none'], load: 'bodyweight', youth: true, unit: 'yd' }),
  E({ id: 'ladder_drill', name: 'Agility ladder footwork', kind: 'sprint', primary: ['calves'], needs: ['none'], load: 'bodyweight', youth: true, unit: 'sec' }),

  // ---- Conditioning
  E({ id: 'incline_walk', name: 'Incline treadmill walk', kind: 'conditioning', primary: [], needs: ['gym'], load: 'bodyweight', unit: 'min' }),
  E({ id: 'bike_intervals', name: 'Bike intervals', kind: 'conditioning', primary: [], needs: ['gym'], load: 'bodyweight', unit: 'min' }),
  E({ id: 'home_circuit', name: 'Home circuit (push-ups, squats, swings)', kind: 'conditioning', primary: [], needs: ['none'], load: 'bodyweight', unit: 'min' }),
  E({ id: 'outdoor_walk', name: 'Brisk walk', kind: 'conditioning', primary: [], needs: ['none'], load: 'bodyweight', unit: 'min' }),
]

export const EXERCISE_BY_ID = new Map(EXERCISES.map((e) => [e.id, e]))

export function exercise(id: string): Exercise {
  return EXERCISE_BY_ID.get(id) ?? { id, name: id, kind: 'strength', primary: [], needs: ['none'], load: 'bodyweight' }
}

/** Equipment available from a member's home list ("dumbbells:5-50", "pullup_bar"...). */
export function homeEquipment(list: string[]): Set<Equipment> {
  const out = new Set<Equipment>(['none'])
  for (const item of list) out.add(item.split(':')[0] as Equipment)
  return out
}

/** Exercises doable at a location. The gym has everything. */
export function availableAt(location: 'gym' | 'home', home: Set<Equipment>, youthOnly = false): Exercise[] {
  return EXERCISES.filter((e) => (!youthOnly || e.youth) && (location === 'gym' || e.needs.every((n) => home.has(n))))
}
