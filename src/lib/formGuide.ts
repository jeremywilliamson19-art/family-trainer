// How to do each exercise well: a few cues, the most common mistake, and a
// note for kids where it matters. Shown on the exercise page and in the
// workout logger so form comes first.

export interface FormGuide {
  /** 3–4 short cues, most important first. */
  cues: string[]
  /** The most common mistake(s) to watch for. */
  mistakes: string[]
  /** Extra guidance for the son's version. */
  youth?: string
}

const g = (cues: string[], mistakes: string[], youth?: string): FormGuide => ({ cues, mistakes, ...(youth ? { youth } : {}) })

export const FORM: Record<string, FormGuide> = {
  // ---- Chest
  bench_press: g(
    ['Eyes under the bar, feet flat, shoulder blades pinched together', 'Lower the bar to mid-chest with elbows about 45° from your sides', 'Press up and slightly back toward your face', 'Keep your butt on the bench the whole time'],
    ['Elbows flared straight out to 90°', 'Bouncing the bar off the chest'],
  ),
  incline_db_press: g(
    ['Bench at about 30°', 'Start with dumbbells over the upper chest, palms forward or slightly in', 'Lower until elbows are just below the bench, then press up and in'],
    ['Bench set too steep (turns it into a shoulder press)', 'Letting the dumbbells drift apart at the bottom'],
  ),
  db_bench_press: g(
    ['Shoulder blades back and down, feet flat', 'Lower with control until the dumbbells are at chest level', 'Press up, bringing them together over the chest'],
    ['Dropping the dumbbells too low with no control', 'Arching the lower back off the bench'],
  ),
  db_floor_press: g(
    ['Lie on the floor, knees bent, dumbbells over the chest', 'Lower until your upper arms touch the floor lightly', 'Pause, then press straight up'],
    ['Slamming the elbows into the floor', 'Elbows flared straight out'],
  ),
  cable_fly: g(
    ['Slight bend in the elbows, and keep it fixed', 'Bring the handles together in a wide hugging arc', 'Squeeze the chest for a second, then open slowly'],
    ['Bending and straightening the elbows (turns it into a press)', 'Going too heavy and losing the stretch'],
  ),
  machine_chest_press: g(
    ['Handles level with mid-chest', 'Back flat against the pad', 'Press out smoothly; don’t let the weight stack touch between reps'],
    ['Seat too low or too high', 'Shoulders rolling forward at the end'],
  ),
  dips: g(
    ['Start straight-armed with shoulders down, away from the ears', 'Lean slightly forward for chest, stay upright for triceps', 'Lower until upper arms are about parallel to the floor, then press up'],
    ['Sinking too deep and straining the shoulders', 'Shrugging the shoulders up'],
  ),
  push_up: g(
    ['Hands just wider than shoulders, body in one straight line', 'Squeeze glutes and brace your stomach', 'Lower your chest to a fist’s height off the floor, elbows about 45°', 'Push the floor away until arms are straight'],
    ['Hips sagging or piking up', 'Only going halfway down'],
    'Can’t do full ones yet? Do them with hands on a bench or counter, still keeping a straight body.',
  ),

  // ---- Back
  lat_pulldown: g(
    ['Grip just wider than shoulders, chest up, slight lean back', 'Pull the bar to your upper chest by driving elbows down', 'Control it back up until arms are straight'],
    ['Leaning way back and swinging', 'Pulling behind the neck'],
  ),
  pull_up: g(
    ['Hang with straight arms, palms facing away', 'Pull your chest toward the bar, elbows driving down to your sides', 'Chin over the bar, then lower all the way with control'],
    ['Kicking and swinging for momentum', 'Half reps that never straighten the arms'],
    'Use a band or a box under the feet until full pull-ups are possible.',
  ),
  chin_up: g(
    ['Palms facing you, shoulder-width grip', 'Pull until your chin clears the bar', 'Lower slowly to a full hang'],
    ['Swinging the legs', 'Craning the neck to get the chin over'],
  ),
  band_pulldown: g(
    ['Anchor the band high, kneel or sit tall', 'Pull elbows down to your sides, squeezing the shoulder blades', 'Let the band back up slowly'],
    ['Pulling with the arms only, no shoulder-blade squeeze', 'Leaning back to cheat'],
  ),
  seated_cable_row: g(
    ['Sit tall with a slight knee bend', 'Pull the handle to your stomach, elbows close', 'Squeeze shoulder blades, then let the arms reach forward slowly'],
    ['Rocking the torso back and forth', 'Shrugging the shoulders up'],
  ),
  chest_supported_row: g(
    ['Chest against the pad the whole time', 'Pull elbows back past your body', 'Pause and squeeze, then lower slowly'],
    ['Lifting the chest off the pad', 'Short, jerky reps'],
  ),
  barbell_row: g(
    ['Hinge forward to about 45°, back flat, knees soft', 'Pull the bar to your lower ribs', 'Lower to straight arms without standing up'],
    ['Rounding the lower back', 'Standing up more each rep to move the weight'],
  ),
  one_arm_db_row: g(
    ['One hand and knee on a bench, back flat', 'Pull the dumbbell toward your hip, not your shoulder', 'Lower until the arm is straight'],
    ['Twisting the torso to lift', 'Shrugging toward the ear'],
  ),
  inverted_row: g(
    ['Hang under a bar or rings, body straight like a plank', 'Pull your chest to the bar', 'Lower with control'],
    ['Hips sagging', 'Only moving the head toward the bar'],
    'Bend the knees to make it easier; straighten the legs as you get stronger.',
  ),
  db_pullover: g(
    ['Lie across or along a bench, one dumbbell held over the chest', 'Lower it back behind your head with a slight elbow bend', 'Pull it back over the chest using your lats'],
    ['Bending the elbows a lot (turns it into a triceps move)', 'Going too heavy and arching the back'],
  ),

  // ---- Shoulders
  overhead_press: g(
    ['Bar on the front of the shoulders, glutes and stomach tight', 'Press straight up, moving your head back out of the way', 'Finish with the bar over the middle of your head'],
    ['Leaning way back', 'Pressing out in front instead of straight up'],
  ),
  db_shoulder_press: g(
    ['Dumbbells at shoulder height, palms forward or slightly in', 'Press up until arms are straight', 'Lower to ear level with control'],
    ['Arching the lower back', 'Banging the dumbbells together at the top'],
  ),
  lateral_raise: g(
    ['Slight bend in the elbows, light weight', 'Raise out to the sides to shoulder height, leading with the elbows', 'Lower slowly (about 2–3 seconds)'],
    ['Swinging the body to lift heavier weight', 'Shrugging the shoulders up'],
  ),
  cable_lateral_raise: g(
    ['Stand side-on to the cable, handle in the far hand', 'Raise out to shoulder height', 'Lower slowly, keeping tension'],
    ['Leaning away to cheat', 'Raising above shoulder height'],
  ),
  rear_delt_fly: g(
    ['Hinge forward with a flat back, slight elbow bend', 'Open the arms out to the sides, leading with the elbows', 'Squeeze the back of the shoulders, then lower slowly'],
    ['Using momentum', 'Squeezing the shoulder blades so hard the back muscles take over'],
  ),
  face_pull: g(
    ['Rope at face height', 'Pull toward your forehead, splitting the rope apart', 'Finish with hands beside your ears, elbows high'],
    ['Pulling to the chest', 'Leaning back'],
  ),
  band_pull_apart: g(
    ['Arms straight in front at shoulder height', 'Pull the band apart until it touches your chest', 'Return slowly'],
    ['Bending the elbows', 'Arching the back'],
  ),

  // ---- Triceps
  triceps_pushdown: g(
    ['Elbows pinned at your sides', 'Push down until arms are fully straight', 'Let the hands come up to about chest height, not higher'],
    ['Elbows drifting forward', 'Leaning over the weight to push with the body'],
  ),
  overhead_cable_ext: g(
    ['Face away from the cable, rope behind your head', 'Elbows pointing forward and staying still', 'Straighten the arms fully overhead, then bend slowly for a big stretch'],
    ['Elbows flaring out wide', 'Arching the back'],
  ),
  skull_crusher: g(
    ['Upper arms angled slightly back toward your head and kept still', 'Lower the bar to just behind your forehead', 'Straighten the elbows to press it back up'],
    ['Moving the upper arms (turns it into a press)', 'Going so heavy you can’t control the bottom'],
  ),
  close_grip_bench: g(
    ['Hands about shoulder-width apart', 'Elbows tucked close to the body', 'Lower to the lower chest and press up'],
    ['Grip too narrow (hurts the wrists)', 'Elbows flaring out'],
  ),
  overhead_db_ext: g(
    ['Hold one dumbbell with both hands overhead', 'Lower it behind your head, elbows pointing up', 'Straighten the arms fully'],
    ['Elbows flaring out', 'Arching the lower back'],
  ),
  lying_db_ext: g(
    ['Lie on a bench, dumbbells over your shoulders, palms facing each other', 'Bend only at the elbows to lower beside your head', 'Straighten fully'],
    ['Upper arms moving', 'Dropping fast at the bottom'],
  ),
  db_kickback: g(
    ['Hinge forward, upper arm parallel to the floor and held still', 'Straighten the arm back until it’s fully locked', 'Squeeze, then lower slowly'],
    ['Swinging the upper arm', 'Going too heavy to fully straighten'],
  ),
  close_grip_db_press: g(
    ['Dumbbells pressed together over your chest', 'Lower to the chest with elbows tucked', 'Press up, keeping them touching'],
    ['Letting the dumbbells drift apart', 'Elbows flaring'],
  ),
  diamond_push_up: g(
    ['Hands together under the chest, thumbs and index fingers making a diamond', 'Body straight', 'Lower your chest to your hands, elbows back along your sides'],
    ['Hips sagging', 'Elbows flaring out'],
  ),
  band_pushdown: g(
    ['Anchor the band high', 'Elbows at your sides', 'Push down to straight arms, return slowly'],
    ['Elbows moving forward', 'Using body weight to push'],
  ),

  // ---- Biceps
  ez_curl: g(
    ['Stand tall, elbows at your sides', 'Curl the bar up without moving the elbows forward', 'Lower slowly all the way to straight arms'],
    ['Swinging the body', 'Half reps that don’t straighten the arms'],
  ),
  cable_curl: g(
    ['Elbows at your sides, stand tall', 'Curl to the shoulders and squeeze', 'Lower with control'],
    ['Elbows drifting forward', 'Leaning back'],
  ),
  db_curl: g(
    ['Palms facing forward, elbows at your sides', 'Curl up without swinging', 'Lower slowly to fully straight'],
    ['Swinging the dumbbells up', 'Elbows moving forward'],
  ),
  hammer_curl: g(
    ['Palms facing each other the whole time', 'Curl up, elbows still', 'Lower with control'],
    ['Swinging', 'Rotating the wrists'],
  ),
  incline_db_curl: g(
    ['Bench at about 45°, arms hanging straight down behind you', 'Curl up without moving the elbows forward', 'Lower to a full stretch'],
    ['Lifting the shoulders off the bench', 'Going too heavy to control'],
  ),
  concentration_curl: g(
    ['Sit, elbow braced against the inside of the thigh', 'Curl up and squeeze at the top', 'Lower all the way'],
    ['Using the shoulder to help', 'Moving the elbow off the thigh'],
  ),
  band_curl: g(
    ['Stand on the band, elbows at your sides', 'Curl up and squeeze', 'Lower slowly'],
    ['Swinging', 'Elbows drifting forward'],
  ),

  // ---- Legs
  back_squat: g(
    ['Bar on the upper back, feet shoulder-width, toes slightly out', 'Brace your stomach, then sit down between your heels', 'Knees track over the toes; go to at least thighs parallel', 'Drive up through the whole foot'],
    ['Knees caving in', 'Heels lifting or back rounding at the bottom'],
  ),
  deadlift: g(
    ['Bar over the middle of the foot, shins close', 'Flat back, chest up, take the slack out of the bar', 'Push the floor away, then hips forward to stand tall', 'Lower by pushing hips back, bar close to the legs'],
    ['Rounding the lower back', 'Bar drifting away from the legs'],
  ),
  romanian_deadlift: g(
    ['Stand tall, soft knees', 'Push hips straight back, bar sliding down the thighs', 'Stop when you feel a big hamstring stretch, back flat', 'Squeeze glutes to stand'],
    ['Rounding the back to go lower', 'Bending the knees into a squat'],
  ),
  db_rdl: g(
    ['Dumbbells in front of the thighs, soft knees', 'Push hips back, dumbbells close to the legs', 'Go down until the hamstrings stretch, back flat', 'Squeeze glutes to stand'],
    ['Rounding the back', 'Squatting instead of hinging'],
    'Practice the hinge with a broomstick along the back first: head, upper back and tailbone touching it.',
  ),
  leg_press: g(
    ['Feet shoulder-width in the middle of the platform', 'Lower until knees are about 90°, lower back flat on the pad', 'Press through the whole foot'],
    ['Lower back curling off the pad', 'Locking the knees hard at the top'],
  ),
  leg_curl: g(
    ['Knee lined up with the machine’s pivot', 'Curl the heels toward the glutes', 'Lower slowly'],
    ['Hips lifting off the pad', 'Dropping the weight'],
  ),
  leg_extension: g(
    ['Knee lined up with the pivot, back against the pad', 'Straighten the legs and squeeze the thighs', 'Lower with control'],
    ['Swinging the weight up', 'Lifting the hips'],
  ),
  goblet_squat: g(
    ['Hold the dumbbell at your chest, elbows down', 'Feet shoulder-width, toes slightly out', 'Sit down between your heels; elbows brush the inside of the knees', 'Chest up, push up through the whole foot'],
    ['Knees caving in', 'Heels lifting off the floor'],
    'Start with a light dumbbell or none at all. Only add weight once every rep looks the same.',
  ),
  bulgarian_split_squat: g(
    ['Back foot on a bench, front foot far enough forward', 'Drop the back knee straight down', 'Front knee tracks over the toes; push up through the front heel'],
    ['Front foot too close (knee shoots way past the toes)', 'Leaning way forward'],
  ),
  split_squat: g(
    ['Long stance, back heel up', 'Drop the back knee straight down toward the floor', 'Front knee over the ankle and toes, torso tall'],
    ['Front knee caving in', 'Stance too short'],
    'Hold onto a wall for balance at first.',
  ),
  step_up: g(
    ['Whole foot on the box', 'Drive up through the front heel, don’t push off the back foot', 'Stand tall at the top, step down with control'],
    ['Pushing off the bottom leg', 'Front knee caving in'],
    'Start with a low box (knee lower than hip at the top).',
  ),
  calf_raise: g(
    ['Balls of the feet on a step', 'Rise as high as you can and pause', 'Lower the heels slowly below the step'],
    ['Bouncing', 'Bending the knees'],
  ),
  kb_swing: g(
    ['Hinge (hips back), not a squat', 'Snap the hips forward to float the bell to chest height', 'Arms are just ropes; let the bell fall back between the legs'],
    ['Lifting with the arms', 'Rounding the back at the bottom'],
  ),

  // ---- Core
  plank: g(
    ['Elbows under shoulders, body in one straight line', 'Squeeze glutes and pull belly button in', 'Breathe normally'],
    ['Hips sagging or piking up', 'Holding the breath'],
  ),
  side_plank: g(
    ['Elbow under the shoulder, feet stacked', 'Lift the hips so the body is straight from head to feet', 'Hold without rolling forward'],
    ['Hips dropping', 'Rolling the chest toward the floor'],
  ),
  dead_bug: g(
    ['On your back, arms up, knees over hips', 'Press your lower back into the floor', 'Lower the opposite arm and leg slowly, then switch'],
    ['Lower back arching off the floor', 'Going fast'],
  ),
  hanging_knee_raise: g(
    ['Hang still with shoulders engaged', 'Curl the knees toward the chest, tilting the pelvis up', 'Lower slowly without swinging'],
    ['Swinging', 'Only lifting the knees to hip height'],
  ),
  cable_crunch: g(
    ['Kneel facing the cable, rope beside your head', 'Curl the ribs toward the hips, rounding the spine', 'Return slowly'],
    ['Pulling with the arms', 'Sitting back onto the heels instead of crunching'],
  ),

  // ---- Youth power and speed
  snap_down: g(
    ['Rise up onto your toes with arms high', 'Snap down fast into an athletic stance', 'Freeze: knees bent over toes, chest up, quiet feet'],
    ['Knees caving in', 'Landing stiff-legged or loud'],
    'This teaches landing. Quiet, soft landings matter more than speed.',
  ),
  drop_stick: g(
    ['Step (don’t jump) off a low box', 'Land on both feet at the same time', 'Bend knees and hips, freeze for 2 seconds'],
    ['Knees caving in', 'Wobbling or taking extra steps'],
    'Use a low box (about knee height or lower).',
  ),
  pogo_hops: g(
    ['Stand tall, tiny bend in the knees', 'Bounce off the balls of the feet quickly, like a pogo stick', 'Short ground contact, light and quiet'],
    ['Bending the knees a lot', 'Landing on the heels'],
  ),
  box_jump: g(
    ['Arms back, quick dip, then swing arms and jump', 'Land softly on the box in a quarter squat', 'Stand up, then STEP down (don’t jump down)'],
    ['Box too high (tucking knees to make it)', 'Knees caving in on landing'],
    'Low box only. Every landing should be quiet.',
  ),
  broad_jump: g(
    ['Arms back, dip, then swing arms forward and jump out', 'Land on both feet with knees bent and over the toes', 'Stick the landing for 2 seconds'],
    ['Landing stiff-legged', 'Falling backward on landing'],
  ),
  lateral_bound: g(
    ['Push off one leg sideways', 'Land on the other leg, knee over the toes', 'Stick it for 2 seconds, then bound back'],
    ['Knee caving in on landing', 'Not controlling the landing'],
  ),
  single_leg_hop: g(
    ['Hop forward a short distance on one leg', 'Land on the same leg with the knee bent and over the toes', 'Freeze for 2 seconds'],
    ['Knee caving in', 'Big hops before landings are steady'],
    'Short hops first. Only go farther once every landing is solid.',
  ),
  a_skip: g(
    ['Skip with one knee driving up to hip height', 'Toes pulled up, foot comes down under the hips', 'Opposite arm drives with the knee'],
    ['Leaning back', 'Landing out in front of the body'],
  ),
  wall_drill: g(
    ['Hands on a wall, body leaning at about 45° in a straight line', 'Drive one knee up, toes pulled up', 'Switch legs quickly, keeping the body straight'],
    ['Hips bending (body not straight)', 'Standing too upright'],
  ),
  acceleration_start: g(
    ['Start low, lean forward', 'Push hard into the ground for the first 3 steps', 'Rise gradually over 10 yards; drive the arms'],
    ['Popping straight up', 'Reaching out with the feet'],
  ),
  sprint_20: g(
    ['Lean forward out of the start, then run tall', 'Arms swing cheek to hip, elbows near 90°', 'Feet land under the hips'],
    ['Arms crossing the body', 'Overstriding'],
    'Full rest between sprints: quality over quantity.',
  ),
  med_ball_chest_pass: g(
    ['Ball at the chest, athletic stance', 'Step and push the ball explosively to a wall or partner', 'Follow through with straight arms'],
    ['Using only the arms', 'Ball too heavy to throw fast'],
  ),
  med_ball_slam: g(
    ['Lift the ball overhead, rising onto the toes', 'Slam it down hard in front of your feet', 'Hinge and squat to pick it up with a flat back'],
    ['Rounding the back to pick it up', 'Slamming onto your toes'],
  ),
  med_ball_rotational_throw: g(
    ['Stand side-on to a wall', 'Rotate the hips first, then the shoulders, and throw', 'Pivot the back foot'],
    ['Throwing with just the arms', 'No hip rotation'],
  ),
  a_march: g(
    ['Stand tall on the toes of the standing leg', 'Drive one knee to hip height, toes pulled up', 'Opposite arm drives forward; switch slowly'],
    ['Leaning back', 'Flat-footed standing leg'],
  ),
  b_skip: g(
    ['Start like an A-skip', 'Extend the lower leg out', 'Paw it back down under the hips'],
    ['Landing in front of the body', 'Leaning back'],
  ),
  butt_kick: g(
    ['Stay tall, quick steps', 'Heels come straight up under the hips', 'Arms swing naturally'],
    ['Leaning forward', 'Kicking the heels out behind'],
  ),
  wicket_run: g(
    ['Mini hurdles or sticks 4–5 feet apart', 'Run tall, stepping over each with a high knee', 'Feet land under the hips, quick rhythm'],
    ['Reaching out with the foot', 'Looking down at the sticks'],
  ),
  fast_leg: g(
    ['Jog lightly', 'Every third step, snap one heel up and the foot straight down', 'Keep the foot landing under the hips'],
    ['Leaning back', 'Swinging the leg out front'],
  ),
  falling_start: g(
    ['Stand tall on the toes', 'Lean forward as one straight piece until you have to step', 'Explode into a sprint, staying low for the first few steps'],
    ['Bending at the waist instead of leaning', 'Standing up right away'],
  ),
  three_point_start: g(
    ['Running-back stance: feet shoulder-width, one hand down, weight balanced', 'First step is a short, powerful push, not a big reach', 'Stay low and rise gradually; eyes down then up'],
    ['Too much weight on the down hand (falls forward)', 'False step backward'],
  ),
  arm_swing_drill: g(
    ['Sit tall, elbows at about 90°', 'Swing hands from hip pocket to cheek', 'Fast and relaxed; no crossing the body'],
    ['Arms crossing the midline', 'Shoulders shrugging up'],
  ),
  squat_to_stick: g(
    ['Quick dip to a quarter squat with arms back', 'Swing arms up and jump', 'Land softly and freeze: knees over toes, chest up'],
    ['Knees caving in', 'Loud, stiff landings'],
  ),
  jump_and_reach: g(
    ['Arms back, quick dip', 'Swing arms up hard and reach for a mark on the wall', 'Fully straighten ankles, knees and hips; land softly'],
    ['Not using the arms', 'Landing stiff'],
  ),
  med_ball_scoop_toss: g(
    ['Light ball between the knees, hinge with a flat back', 'Explode up through the hips, throwing the ball high behind you', 'Arms stay long'],
    ['Lifting with the arms', 'Rounding the back'],
  ),
  band_walk: g(
    ['Band around the knees, quarter squat', 'Step sideways, pushing the knees out against the band', 'Stay low the whole time'],
    ['Knees caving in', 'Standing up tall between steps'],
  ),
  single_leg_bridge: g(
    ['On your back, one foot down, other leg up', 'Push through the heel and lift the hips', 'Hips stay level; hold 2 seconds'],
    ['Hips tilting to one side', 'Arching the lower back'],
  ),
  jump_cut: g(
    ['Hop sideways off both feet', 'Land balanced and low, knees over toes', 'Burst forward immediately'],
    ['Landing tall or off balance', 'Knees caving in'],
    'Football: keep the ball high and tight against the chest as you cut.',
  ),
  cone_weave: g(
    ['Cones 2 yards apart', 'Sink the hips at each cone and plant the outside foot', 'Short, quick steps; eyes up'],
    ['Staying tall through the turns', 'Rounding wide around the cones'],
    'Football: carry the ball in the arm away from the cone, high and tight.',
  ),
  lateral_shuffle: g(
    ['Athletic stance, hips low', 'Shuffle without crossing the feet', 'Plant the outside foot and push back the other way'],
    ['Feet crossing or clicking together', 'Standing up tall'],
  ),
  ladder_drill: g(
    ['Light, quick feet on the balls of the feet', 'Arms move with the feet', 'Eyes up, not staring at the ladder'],
    ['Heavy, flat feet', 'Rushing and stepping on the rungs'],
  ),

  // ---- Conditioning
  incline_walk: g(
    ['Incline 8–12%, brisk walk', 'Stand tall; don’t hold the rails', 'You should be able to talk, just barely'],
    ['Hanging on the handrails', 'Going so steep you hunch over'],
  ),
  bike_intervals: g(
    ['Warm up 5 minutes', 'Alternate 30 seconds hard with 90 seconds easy', 'Seat height: slight knee bend at the bottom of the pedal stroke'],
    ['Seat too low', 'Going all-out with no recovery'],
  ),
  home_circuit: g(
    ['Push-ups, squats and swings back to back, then rest', 'Keep every rep clean', 'Repeat for the time set'],
    ['Letting form slip as you tire', 'No rest between rounds'],
  ),
  outdoor_walk: g(['Brisk pace: a little out of breath', 'Stand tall, swing the arms', 'Aim for 20–30 minutes'], ['Strolling too slowly to count']),
}

/** A YouTube search for a form demo (always valid; opens in Safari). */
export function demoUrl(name: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name.replace(/\s*\(.*?\)\s*/g, ' ').trim()} proper form`)}`
}
