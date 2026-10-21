# Family Trainer App: Build Spec

Build in the phases listed in section 13, one phase at a time, and stop for review after each.

## 1. What this is

A private fitness and nutrition app for one family, installed on iPhones as a home-screen web app (PWA). It is not going to the App Store.

Users:

- **Dad (Jeremy)**: Goal is fat loss plus muscle gain, focused on arms. Wants the most fat loss around the chest/underarm area and belly. Full macro tracking, workout logging, and coaching.
- **Son (12)**: Football (running back), basketball (center), rugby. Goals are to jump higher, get faster, and get stronger overall. Protein-only nutrition tracking, youth-safe training, and filmed agility testing.
- **Mom (Amanda)**: Creates the family recipes and has full access to the shared recipe book. Her own tracking is optional: she can turn food and workout tracking on or off in settings.

## 2. Platform and stack

- **App:** Progressive Web App, installable to the iPhone home screen. Must work full screen in standalone mode on iOS 16.4+ Safari. Mobile-first, iPhone-sized layout, large tap targets.
- **Frontend:** React + TypeScript + Vite. PWA manifest and service worker so logging works offline, then syncs.
- **Backend:** Supabase free tier for auth (email sign-in with a 6-digit code), the Postgres database, and edge functions. Row-level security on every table.
- **Hosting:** Vercel free tier.
- **Push notifications:** Web Push (VAPID). Scheduled sends come from a Supabase cron job plus an edge function. iOS only delivers web push to apps added to the home screen, so the app must walk the user through "Add to Home Screen" and the notification permission prompt on first run.
- **Running costs:** Target $0/month. No paid AI API in v1. Any API key (such as USDA) lives in an edge function, never in frontend code.

## 3. Accounts and household

- One household with three members. Dad is the household admin.
- The son's account is a child account managed by Dad:
  - Dad can see everything in the son's account. The son can't see Dad's or Mom's private data unless they share it.
  - ~~The son's body weight is never shown to him.~~ **Changed 2026-10-21 (Jeremy):** the son may see his own weight (he's working to add muscle), but it is never a main measure: his Progress leads with workouts, strength and speed, and a Growth section (height, then weight) comes last with no goal. Only a parent logs it. Calories stay hidden from him.
  - There is no messaging. Members can react to each other's posts with kudos only.
- **Family feed:** a simple feed of wins visible to all three, such as a completed workout, a PR, a new jump or sprint best, or a goal-hit streak. Each user controls which categories post to the feed. Weight and body measurements are off by default and never posted from the child account.
- No accounts outside the household in v1.

## 4. Onboarding and macro calculation (Dad, and Mom if tracking)

Collect age, sex, height, current weight, goal weight (optional), and activity level (sedentary, light, moderate, very active).

Calculation:

1. BMR uses Mifflin-St Jeor. Men: 10 × kg + 6.25 × cm − 5 × age + 5. Women: the same, but −161 instead of +5.
2. TDEE = BMR × activity multiplier (1.2, 1.375, 1.55, 1.725).
3. Calorie target = TDEE × 0.80 (a 20% deficit). Show the expected loss rate. Warn if the projected loss exceeds 1% of body weight per week.
4. Protein: 1.0 g per lb of goal weight. With no goal weight set, use 0.8 g per lb of current weight. This is the top-priority number in the UI.
5. Fat: 0.35 g per lb of current body weight, with a minimum of 0.3 g per lb.
6. Carbs: the remaining calories ÷ 4.
7. Training-day adjustment (optional, on by default): +10% carbs on workout days and −10% carbs on rest days. Weekly calories stay the same.

**Adaptive adjustment every 14 days:**

- Use a 7-day moving average of weigh-ins for the weight trend.
- Estimated real TDEE = average daily calories logged − (trend weight change in lb × 3500 ÷ days in period).
- Blend the new estimate 50/50 with the previous TDEE to smooth out noise, then recompute the targets.
- Explain any change in plain English. For example: "You lost 0.4 lb/week, slower than planned. Lowering your target by 120 calories."
- Skip the adjustment, and say so, if fewer than 10 of the 14 days were logged or fewer than 6 weigh-ins were recorded.

The home screen shows three things: calories remaining, protein remaining (most prominent), and a small carbs/fat bar.

**Son:** No calories, no deficit, and no calorie numbers anywhere in his UI.

- His daily protein target is 0.7 g per lb of body weight, configurable by the parent. It's stored in the parent settings, and the son just sees "Protein: 62 / 75 g."
- Show fueling reminders as text tips, not targets. For example: "Game day: eat a carb-heavy meal 2–3 hours before" and "Have protein within an hour after lifting."

## 5. Food logging

**Food sources:**

- **Barcode scan:** Camera barcode scanning in Safari with a JS library that works on iOS Safari (such as zxing-js). Safari doesn't support the native BarcodeDetector, so verify on a real iPhone. Look up the code in Open Food Facts.
- **Search:** USDA FoodData Central for generic foods (chicken breast, rice, banana) and Open Food Facts for branded foods, searched through an edge function.
- **Custom foods:** If a barcode isn't found, the user enters the label (serving size, calories, protein, carbs, fat). Save it for the whole household.
- **Quick add:** Calories and protein only, for restaurants.

**Meal builder** (the core flow, optimized for few taps):

1. Tap New meal. The meal type (breakfast, lunch, dinner, snack) defaults by time of day.
2. Add items from barcode, search, recents, favorites, or recipes.
3. Each item has a portion picker with quick buttons (½, 1, 1.5, 2 servings) and a toggle to enter grams or ounces.
4. The meal shows running totals.
5. Tap Save. The first time a new combination is saved, offer "Save as favorite?"

**Speed features:**

- **Suggested meals:** The top of the log screen shows the user's most frequent meals for the current meal type and time of day. One tap to log, one to confirm.
- **Copy a meal:** Copy yesterday's meal, or any past meal, to today.
- **Edit:** Any logged meal can be edited or deleted.
- **Goal:** A repeat meal logs in 2 taps, and a new 3–4 item meal in about 10.

**Optional (Phase 4):** Voice entry using the Safari Web Speech API. Parse "two eggs, toast, and a banana" by matching against the user's recent foods and the food database, then show the items for confirmation. If parsing is unreliable, ship without it.

## 6. Recipe book (shared with the whole household)

- Any member can create a recipe. Mom is the main author.
- Ingredients are added like foods (barcode, search, recents, custom), each with the amount used.
- **Servings:** Enter how many servings the recipe makes. The app calculates per-serving calories and macros.
- **Optional total cooked weight:** If entered, the user can log a portion by weight (such as 340 g of the dish), which is the most accurate method.
- **Import from a link:** An edge function fetches the page and reads the schema.org Recipe JSON-LD that most recipe sites include. It shows the parsed ingredients for the user to match to foods and confirm. With no JSON-LD, the user pastes the text and the app splits it into lines for manual matching.
- **Versioning:** Editing a recipe creates a new version. Past logs keep the version they were logged against.
- Recipes are logged by servings (½, 1, 1.5, 2) or by grams. Leftovers use the same recipe.
- Recipes have an optional photo, tags, and notes.

## 7. Coaching and trend analysis (rule-based, no AI API)

The **Sunday report** goes out every Sunday at 8:00 AM (configurable) as a push notification, with an in-app report page. For Dad and Mom it covers:

- Days protein was hit, and the average gap on days it wasn't
- Average calories vs target
- Weight trend and progress
- Workouts completed vs planned
- Top 3 most frequent meals
- 1–3 specific suggestions, each tied to a meal the user actually eats often. For example: "You had a salad at lunch 5 times this week and averaged 38 g short on protein. Adding 4 oz of grilled chicken (+35 g) closes most of the gap."
- Recipe suggestions: for recipes logged 2 or more times a week, suggest swaps such as plain Greek yogurt for sour cream. These are suggestions only. Never auto-edit a recipe.

For the son, the report covers protein days hit, workouts done, any new test bests, and one fueling tip.

**Suggestion engine:**

- Rules map meal categories (salad, breakfast, pasta, sandwich, snack, and so on) to high-protein add-ons and swaps.
- The add-on catalog is seeded with common high-protein foods and branded products, each tagged with the stores that carry it: Walmart, Smith's, Costco, WinCo, Harmons. Products the family scans are added to the catalog automatically.
- Respect each user's dislike list. Dad: no beans or legumes, which also excludes edamame, lentils, chickpeas, and hummus. The dislike list is editable in settings.
- Prefer foods the user has logged before. Second choice is catalog items available at their stores.

**Evening protein nudge:** At 7:00 PM (configurable), if protein is more than 25 g below target, send a push. For example: "You're 40 g short. A Greek yogurt or a protein shake gets you there." Pick from the user's own recent foods first.

## 8. Workouts

**Setup per user:**

- Weekly schedule: which days are gym days, home days, and rest days
- Home equipment list, chosen from presets (dumbbells with a weight range, pull-up bar, bands, bench, kettlebell) and editable
- The gym is assumed to be a full commercial gym

**Logging:**

- Pick a saved routine or start an empty workout. Add exercises from a built-in library filtered by location (gym or home equipment).
- Each set records weight, reps, and RPE (1–10, optional).
- Pre-fill from the last time that exercise was done.
- Rest timer between sets.
- Mark PRs automatically.

**Dad's programming and recommendations:**

- The priority is arms. The default plan hits biceps and triceps directly 2–3 times a week, targeting 12–20 hard sets per week for each. Emphasize triceps, the larger part of the upper arm.
- Also prioritize chest, back (lats), and shoulders for upper-body shape.
- Fat loss is overall, and the app must say so plainly: fat can't be spot-reduced. Chest and belly fat come off with the overall calorie deficit. Building the chest and lats and keeping protein high improves how that area looks. Offer 2–3 optional conditioning sessions a week (such as incline walking, bike intervals, or a home circuit).
- **Progression rule (double progression):** Each exercise has a rep range, such as 8–12. When all sets hit the top of the range at RPE 9 or below, recommend adding weight next time: +5 lb for upper-body dumbbells or cables, +5–10 lb for barbell. The same reps two sessions in a row means hold. Reps dropping two sessions in a row means flag possible fatigue.
- **Weekly volume tracker:** Count hard sets per muscle group per week. Flag arms if under 12 sets.
- **Plateau detection:** If the estimated strength on a main lift is flat for 3+ weeks, suggest a change, such as swapping the exercise variation, changing the rep range, or a deload week.
- Ship 2 starter programs for Dad to choose from, both editable: a 4-day upper/lower with arm emphasis (gym), and a 3-day dumbbell full-body with arm emphasis (home).

**Son's programming (youth guardrails, enforced in code):**

- Technique first. No 1-rep-max testing and no max-effort sets. Cap prescribed RPE at 8.
- Progression adds reps first, then small weight increases only after the parent marks form "good" on the last session. The parent marks form with a toggle on the set log.
- Plyometrics for jumping and speed: box jumps, broad jumps, bounds, skips, and landing drills. Cap total foot contacts per session at 80 by default, configurable by the parent. Landing mechanics drills come before higher-intensity jumps.
- Strength: goblet squat, split squats, RDL, push-ups, inverted rows, planks, med ball throws. Start with bodyweight and light loads.
- In-season mode (parent toggle) cuts volume by about 40% and limits lifting to 2 days a week.
- Ship one starter program: a 3-day youth athletic development plan (strength + plyos + sprint mechanics). Only the parent can edit it.

## 9. Agility testing with video (son; optional for Dad)

**Tests:**

- Vertical jump
- Broad jump
- 10-yard sprint
- 40-yard dash (with a 10-yard split)
- Pro-agility shuttle (5-10-5)
- 3-cone drill (L-drill)

**Recording:** Use the iPhone Camera app in Slo-mo mode (240 fps if available), then upload the clip from Photos into the web app.

- Verify the actual frame rate of the uploaded file. Shared iPhone slo-mo clips may be re-encoded, so the app must handle whatever frame rate the file has. Show the detected fps and let the user override it.
- Videos stay on the device and are never uploaded to the server. Save only the results, the marked frame numbers, and a single thumbnail image.

**Frame-marking UI:**

- A video player with frame-by-frame stepping (± 1 frame buttons) and a scrubber. Use requestVideoFrameCallback where available, and test on iOS Safari.
- The user taps to mark the key frames for each test.

**Calculations:**

- **Vertical jump:** Mark takeoff (the last frame with feet on the ground) and landing (the first frame touching the ground). Flight time t = frames ÷ fps. Height = 9.81 × t² ÷ 8 in meters, displayed in inches. Tip to show: land with straight legs, because tucking the knees inflates the result.
- **Broad jump:** The distance is entered from the tape, because video can't measure distance reliably here. The video is saved for form review only.
- **Sprints (10, 40):** Mark first movement and the frame where the torso crosses each cone. Time = frames ÷ fps. Average speed = distance ÷ time, in mph. Show the 10-yard split on the 40.
- **Pro-agility and 3-cone:** Mark the start movement and the finish crossing. Time = frames ÷ fps.

**Setup guide:** Before each test, show a short checklist with a diagram:

- Phone on a tripod, level, perpendicular to the lane
- Camera placement for that test (at the finish line, or side-on at the midpoint)
- Cone distances
- Consistent start rule: time starts at first movement

**History:** A per-test chart over time, personal bests, and the change since the last test. New bests post to the family feed if enabled.

**Phase 5 (later, optional):** Auto-detect takeoff and landing with an in-browser pose model (such as MediaPipe Pose). The user always confirms or adjusts. Ship it only if it's accurate on real clips.

## 10. Reminders (Web Push)

All reminders are configurable per user, with times and on/off toggles:

- Meal logging: breakfast, lunch, and dinner windows. Skip if a meal of that type is already logged.
- Workout reminders: based on each user's weekly schedule, labeled gym or home. For example: "Home workout today: arms + conditioning." Skip if the workout is already logged.
- Weigh-in: by default 3 mornings a week for Dad. Never for the son.
- Evening protein nudge (section 7)
- Sunday report (section 7)
- Agility testing reminder: every 4 weeks for the son (configurable)

Reminder logic runs on the server (a Supabase cron job every 15 minutes) and checks what has been logged before sending. If push permission is missing, show a banner in the app explaining how to enable it.

## 11. Progress tracking

- **Dad:** weight with a 7-day trend line, waist and chest measurements, optional progress photos (stored privately, visible only to him), strength charts for main lifts, and weekly arm volume.
- **Son:** height (monthly, entered by the parent), test results, strength progress, and protein consistency. His weight is visible to the parent only.

## 12. Non-goals for v1

- No photo-based calorie estimation, and no paid AI API
- No App Store release and no Apple Health integration (web apps can't access HealthKit)
- No users outside the household
- No messaging

## 13. Build phases

1. **Foundation:** Supabase setup with auth, household and child account, RLS, PWA install flow, push permission flow, and basic settings.
2. **Nutrition:** onboarding, macro calculation, food search, barcode scanning, custom foods, meal builder, suggested and copied meals, daily dashboard, and the son's protein-only view.
3. **Recipes and coaching:** shared recipe book with versioning and link import, Sunday report, suggestion engine with the store catalog and dislike list, evening nudge, and adaptive macro adjustment.
4. **Workouts and reminders:** exercise library, logging, starter programs, progression and volume rules, youth guardrails, the full reminder system, and the family feed. Optional: voice entry.
5. **Agility testing:** video upload, frame-marking UI, calculations, setup guides, and history charts. Optional later: auto-detection.

## 14. Acceptance checks (verify before calling a phase done)

- The app installs to an iPhone home screen and receives a test push notification.
- A repeat meal logs in 2 taps from the log screen.
- A barcode scan works in iOS Safari on a real phone.
- A recipe with 6 ingredients and 8 servings shows correct per-serving macros (checked against a hand calculation).
- The son's account shows no calories and no body weight anywhere.
- No suggestion ever includes beans or legumes for Dad.
- A test vertical-jump clip with a known flight time gives the correct height. Hand-calculated example: 0.50 s of flight ≈ 30.7 cm ≈ 12.1 in.
- Reminders don't fire when the item has already been logged.

## 15. Assumptions to confirm with Jeremy

- Dad's current workout split wasn't specified. Ship both starter programs and let him pick or edit.
- The 0.7 g/lb protein target for the son is a reasonable starting point for a youth athlete. The parent can change it, and a pediatrician can confirm it.
- Reminder times use defaults until each user sets their own.
