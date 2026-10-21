import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { TestDiagram } from '../../components/tests/TestDiagram'
import { VideoMarker } from '../../components/tests/VideoMarker'
import { ExerciseLink } from '../../components/ExerciseLink'
import { newWorkout } from '../training/plan'
import { api } from '../../lib/api'
import { better, computeResult, formatResult, TEST_BY_ID, type TestId, type TestResult } from '../../lib/agility'
import { readFileInfo, niceFps } from '../../lib/mp4'
import { localDate } from '../../lib/nutrition'
import { cutFindings, DRILLS, drillsFor, jumpFindings, sprintFindings, type Finding } from '../../lib/pose/coach'
import { coverage, crowded, cutMetrics, jumpMetrics, selectAthlete, sprintMetrics, type PeopleFrame } from '../../lib/pose/metrics'
import { analyzeFrames, seekFrame } from '../../lib/pose/runner'
import { useMember } from '../../lib/session'
import { newId } from '../../lib/syncStore'
import { mutateTraining, setDraft, useTraining } from '../../lib/trainingStore'
import type { Member, Program, TestRecord } from '../../lib/types'

type Step = 'setup' | 'video' | 'mark' | 'result'

/** Recording one filmed test: setup → clip → marks → result (+ form check). */
export function TestFlow() {
  const { test: testId } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const me = useMember()
  const test = TEST_BY_ID.get(testId as TestId)
  const athleteId = params.get('who') ?? me.id
  const forChild = athleteId !== me.id
  const own = useTraining()
  const [members, setMembers] = useState<Member[]>([])
  const [history, setHistory] = useState<TestRecord[]>([])

  const [step, setStep] = useState<Step>('setup')
  const [file, setFile] = useState<File | null>(null)
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])
  const [fileFps, setFileFps] = useState<number | null>(null)
  const [captureFps, setCaptureFps] = useState<number>(240)
  const [marks, setMarks] = useState<Record<string, number>>({})
  const [manual, setManual] = useState({ ft: '', inch: '' })
  const video = useRef<HTMLVideoElement>(null)

  const [people, setPeople] = useState<PeopleFrame[] | null>(null)
  const [tap, setTap] = useState<{ x: number; y: number; frame: number } | null>(null)
  const [suggestMarks, setSuggestMarks] = useState(false)
  const needsTap = !!people && crowded(people) && !tap
  const poses = useMemo(() => (people && !needsTap ? selectAthlete(people, tap ?? undefined) : null), [people, tap, needsTap])
  const [progress, setProgress] = useState<string | null>(null)
  const [findings, setFindings] = useState<Finding[] | null>(null)
  const [kept, setKept] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api<Member[]>('listMembers').then(setMembers, () => {})
  }, [])
  useEffect(() => {
    if (!forChild) setHistory(own.tests.filter((t) => t.member_id === me.id))
    else api<{ tests: TestRecord[] }>('trainingSync', { member_id: athleteId, from: '9999-01-01' }).then((r) => setHistory(r.tests), () => {})
  }, [forChild, athleteId, own.tests, me.id])

  if (!test) return <div className="screen"><p className="muted">Unknown test.</p></div>
  const athlete = members.find((m) => m.id === athleteId)
  const athleteName = athlete?.display_name ?? (forChild ? 'Athlete' : me.display_name)

  const result: TestResult | null = test.manualValue
    ? Number(manual.ft) * 12 + Number(manual.inch || 0) > 0
      ? { value: Number(manual.ft) * 12 + Number(manual.inch || 0) }
      : null
    : computeResult(test, marks, captureFps)
  const prior = history.filter((h) => h.test === test.id)
  const best = prior.length ? prior.reduce((a, b) => (better(test, b.value, a.value) ? b : a)) : null

  const pickVideo = async (f: File | undefined) => {
    if (!f) return
    setError(null)
    setFile(f)
    setMarks({})
    setPeople(null)
    setTap(null)
    setFindings(null)
    const info = await readFileInfo(f).catch(() => null)
    const fps = info ? niceFps(info.fps) : null
    setFileFps(fps ?? 30)
    // A 240/120 fps file is a Slo-mo original. A 30 fps file may be a shared
    // Slo-mo (still 240 captured frames per real second) or a normal video.
    setCaptureFps(fps && fps >= 100 ? fps : 240)
    setStep('mark')
  }

  /** The frames worth analyzing for this test. */
  const range = (): [number, number] | null => {
    const fps = fileFps ?? 30
    const total = Math.floor((video.current?.duration ?? 0) * fps)
    // Each file frame is one captured frame, so real seconds × capture rate = frames.
    const pad = (s: number) => Math.round(s * captureFps)
    if (test.form === 'jump') {
      if (marks.takeoff !== undefined && marks.landing !== undefined) return [Math.max(0, marks.takeoff - pad(1.2)), Math.min(total - 1, marks.landing + pad(0.6))]
      return [0, Math.max(0, total - 1)]
    }
    if (marks.start === undefined || marks.finish === undefined) return null
    return [marks.start, marks.finish]
  }

  const analyze = async (alsoSuggest: boolean) => {
    const v = video.current
    const r = range()
    if (!v || !r || !fileFps) return setError(test.form === 'jump' ? 'Load the clip first.' : 'Mark the start and finish first, so only the run is analyzed.')
    setError(null)
    setFindings(null)
    setTap(null)
    setSuggestMarks(alsoSuggest)
    setProgress('Loading the body-tracking model (first time takes a moment)…')
    try {
      setPeople(
        await analyzeFrames(v, {
          fromFrame: r[0],
          toFrame: r[1],
          fileFps,
          captureFps,
          onProgress: (d, t) => setProgress(`Tracking the body… ${Math.round((d / t) * 100)}%`),
        }),
      )
    } catch (e) {
      setError(`Form check failed: ${(e as Error).message}`)
    } finally {
      setProgress(null)
    }
  }

  // Once we know which person is the athlete: measurements, findings, suggested marks.
  useEffect(() => {
    if (!poses || !test || !fileFps) return
    if (coverage(poses) < 0.5) {
      setFindings([])
      setError('Couldn’t see the athlete’s whole body clearly in enough frames. Film side-on, whole body in frame, good light, and try again.')
      return
    }
    let f: Finding[]
    if (test.form === 'jump') {
      const m = jumpMetrics(poses, captureFps)
      if (suggestMarks && m.takeoff !== null && m.landing !== null && !test.manualValue) {
        setMarks((cur) => ({ ...cur, takeoff: m.takeoff!, landing: m.landing! }))
        setSuggestMarks(false)
        if (video.current) void seekFrame(video.current, m.takeoff, fileFps)
      } else if (suggestMarks) {
        setError('Couldn’t find a clear takeoff and landing. Mark them by hand with the frame buttons.')
        setSuggestMarks(false)
      }
      f = jumpFindings(m)
    } else if (test.form === 'sprint') f = sprintFindings(sprintMetrics(poses, captureFps))
    else f = cutFindings(cutMetrics(poses))
    setFindings(f)
    setKept(new Set(f.map((x) => x.id)))
  }, [poses])

  const thumbnail = async (): Promise<string | null> => {
    const v = video.current
    if (!v || !fileFps || !v.videoWidth) return null
    const key = marks.takeoff ?? marks.finish ?? marks.start
    if (key !== undefined) await seekFrame(v, key, fileFps)
    const c = document.createElement('canvas')
    c.width = 192
    c.height = Math.round((192 * v.videoHeight) / v.videoWidth)
    c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height)
    for (const q of [0.6, 0.4, 0.25]) {
      const d = c.toDataURL('image/jpeg', q)
      if (d.length <= 20_000) return d
    }
    return null
  }

  const keptFindings = (findings ?? []).filter((f) => kept.has(f.id))
  const drills = findings ? drillsFor(keptFindings, test.form) : null

  const save = async () => {
    if (!result) return
    setSaving(true)
    setError(null)
    const record: TestRecord = {
      id: newId(),
      member_id: athleteId,
      test: test.id,
      date: localDate(),
      value: Math.round(result.value * 100) / 100,
      split10: result.split10 ?? null,
      mph: result.mph ? Math.round(result.mph * 100) / 100 : null,
      split_mph: result.split_mph ? Math.round(result.split_mph * 100) / 100 : null,
      capture_fps: test.manualValue ? null : captureFps,
      file_fps: fileFps,
      marks,
      thumbnail: await thumbnail(),
      findings: keptFindings.map(({ id, kind, title, detail }) => ({ id, kind, title, detail })),
      drills: drills ? [...drills.fixes, ...drills.extras].map((d) => d.exercise_id) : [],
    }
    try {
      if (forChild) await api('saveTest', { record })
      else mutateTraining({ type: 'saveTest', record })
      nav(`/tests?who=${athleteId}&saved=${record.id}`, { replace: true })
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  /** Opens the drills as a workout right away (for the person on this phone). */
  const startDrills = () => {
    if (!drills) return
    const list = [...drills.fixes, ...drills.extras].slice(0, 6)
    const plan = { exercises: list.map((d) => ({ exercise_id: d.exercise_id, sets: 3, rep_min: 5, rep_max: 8, rest_s: 60 })), notes: [] }
    setDraft(newWorkout({ memberId: me.id, name: `Form drills (${test.short})`, location: 'home', program: null, dayIndex: null, plan, workouts: own.workouts, youth: me.role === 'child' }))
    nav('/train/workout')
  }

  /** Adds the drill picks as a "Form drills" day in the athlete's program. */
  const addDrillsToProgram = async () => {
    if (!drills) return
    const list = [...drills.fixes, ...drills.extras].slice(0, 6)
    const day = { name: `Form drills (${test.short})`, exercises: list.map((d) => ({ exercise_id: d.exercise_id, sets: 3, rep_min: 5, rep_max: 8, rest_s: 60 })) }
    try {
      const programs: Program[] = forChild ? (await api<{ programs: Program[] }>('trainingSync', { member_id: athleteId, from: '9999-01-01' })).programs : own.programs
      const p = programs[0]
      if (!p) return setError(forChild ? 'Set up his program first (Family → his name).' : 'Choose a program first (Train tab).')
      const days = [...p.days.filter((d) => d.name !== day.name), day].slice(0, 7)
      const next = { ...p, days, updated_at: new Date().toISOString() }
      if (forChild) await api('saveProgram', { program: next })
      else mutateTraining({ type: 'saveProgram', program: next })
      setProgress('Added a “Form drills” day to the program ✓')
      setTimeout(() => setProgress(null), 2500)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="screen">
      <h1>{test.name}</h1>
      <p className="muted">
        {athleteName}
        {best && ` · best ${formatResult(test, best.value)}`}
      </p>

      {step === 'setup' && (
        <>
          <section className="card stack">
            <TestDiagram test={test.id} />
            <h2>Setup</h2>
            <ol className="steps small">
              {test.setup.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            {!test.manualValue && (
              <p className="muted small">
                <strong>Camera:</strong> {test.camera} Use the Camera app’s <strong>SLO-MO</strong> mode (Settings → Camera → Record Slo-mo → 240 fps).
              </p>
            )}
          </section>
          <button className="btn" onClick={() => setStep('video')}>
            {test.manualValue ? 'Next' : 'I’ve filmed it'}
          </button>
        </>
      )}

      {step === 'video' && (
        <section className="card stack">
          {test.manualValue && (
            <>
              <h2>Distance from the tape</h2>
              <div className="row inline-fields">
                <label>
                  <input type="number" inputMode="numeric" value={manual.ft} onChange={(e) => setManual({ ...manual, ft: e.target.value })} /> ft
                </label>
                <label>
                  <input type="number" inputMode="numeric" value={manual.inch} onChange={(e) => setManual({ ...manual, inch: e.target.value })} /> in
                </label>
              </div>
              <button className="btn" disabled={!result} onClick={() => setStep('result')}>
                Next
              </button>
              <p className="muted small">Filmed it too? Add the clip for a form check:</p>
            </>
          )}
          <label className="btn secondary file-btn">
            🎞️ Choose the clip from Photos
            <input type="file" accept="video/*" hidden onChange={(e) => void pickVideo(e.target.files?.[0])} />
          </label>
          <p className="muted small">The video stays on this phone. Only the result, the marked frames and a small thumbnail are saved.</p>
        </section>
      )}

      {step === 'mark' && url && fileFps && (
        <>
          <section className="card stack">
            <div className="row fps-row">
              <span className="small">
                File: <strong>{fileFps} fps</strong>
              </span>
              <label className="small">
                Filmed at{' '}
                <select value={captureFps} onChange={(e) => setCaptureFps(Number(e.target.value))}>
                  {[...new Set([30, 60, 120, 240, fileFps])].sort((a, b) => a - b).map((f) => (
                    <option key={f} value={f}>
                      {f} fps
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {fileFps < 100 && (
              <p className="muted small">
                This file plays at {fileFps} fps. If you filmed in Slo-mo, iPhone may have converted it when sharing. Keep “Filmed at 240” so
                each frame counts as 1/240 s. If it was a normal video, choose {fileFps}.
              </p>
            )}
            {needsTap && <p className="tap-prompt">👆 More than one person is in the video. Pause on a frame where the athlete is clear and tap them.</p>}
            <VideoMarker
              url={url}
              fileFps={fileFps}
              marks={test.marks}
              values={marks}
              onMark={(k, f) => setMarks({ ...marks, [k]: f })}
              poses={poses}
              people={needsTap ? people : null}
              onTap={needsTap ? (x, y, frame) => setTap({ x, y, frame }) : undefined}
              videoRef={video}
            />
            {test.form === 'jump' && !test.manualValue && (
              <button className="btn secondary" disabled={!!progress} onClick={() => void analyze(true)}>
                🤖 Find takeoff &amp; landing for me
              </button>
            )}
            {progress && <p className="muted small">{progress}</p>}
          </section>
          {result && (
            <button className="btn" onClick={() => setStep('result')}>
              See result: {formatResult(test, result.value)}
            </button>
          )}
          {!result && Object.keys(marks).length === test.marks.length && test.marks.length > 0 && (
            <p className="error">Those marks are out of order. Check each one.</p>
          )}
        </>
      )}

      {step === 'result' && result && (
        <>
          <section className="card stack result-card">
            <span className="big-result">{formatResult(test, result.value)}</span>
            {result.mph && <p>{result.mph.toFixed(1)} mph average</p>}
            {result.split10 && (
              <p>
                10-yard split: <strong>{result.split10.toFixed(2)} s</strong> ({result.split_mph?.toFixed(1)} mph)
              </p>
            )}
            {best ? (
              better(test, result.value, best.value) ? (
                <p className="ok">🏆 New personal best! (was {formatResult(test, best.value)})</p>
              ) : (
                <p className="muted">Personal best: {formatResult(test, best.value)}</p>
              )
            ) : (
              <p className="muted">First recorded result.</p>
            )}
            {test.id === 'vertical' && <p className="muted small">Tip: land with straight legs; tucking the knees makes the number read too high.</p>}
          </section>

          {url && (
            <section className="card stack">
              <h2>Form check</h2>
              {!findings && !needsTap && (
                <>
                  <p className="muted small">
                    Tracks the body frame by frame and checks {test.form === 'sprint' ? 'start lean, knee drive, arm swing, heel recovery and foot strike' : test.form === 'jump' ? 'dip depth, extension, arm swing and landing' : 'how low the hips get at each cut'}. It’s
                    an estimate: watch the skeleton on the video and keep only what you agree with.
                    {test.form === 'sprint' && ' The angles are only meaningful if the clip was filmed from the side, with the phone square to the lane.'}
                  </p>
                  <button className="btn secondary" disabled={!!progress} onClick={() => void analyze(false)}>
                    🤖 Check form
                  </button>
                </>
              )}
              {progress && <p className="muted small">{progress}</p>}
              {needsTap && <p className="tap-prompt">👆 More than one person is in the video. Pause on a frame where the athlete is clear and tap them.</p>}
              {fileFps && (
                <VideoMarker
                  url={url}
                  fileFps={fileFps}
                  marks={[]}
                  values={marks}
                  onMark={() => {}}
                  startFrame={marks.start ?? marks.takeoff ?? 0}
                  poses={poses}
                  people={needsTap ? people : null}
                  onTap={needsTap ? (x, y, frame) => setTap({ x, y, frame }) : undefined}
                  videoRef={video}
                />
              )}
              {findings && findings.length === 0 && !error && <p className="muted">Nothing stood out. Nice!</p>}
              {findings?.map((f) => (
                <label key={f.id} className={`finding ${f.kind}`}>
                  <input
                    type="checkbox"
                    checked={kept.has(f.id)}
                    onChange={(e) => {
                      const s = new Set(kept)
                      if (e.target.checked) s.add(f.id)
                      else s.delete(f.id)
                      setKept(s)
                    }}
                  />
                  <span>
                    <strong>
                      {f.kind === 'good' ? '✅ ' : f.kind === 'note' ? 'ℹ️ ' : '🎯 '}
                      {f.title}
                    </strong>
                    <small className="block">{f.detail}</small>
                  </span>
                </label>
              ))}
              {findings && <p className="muted small">Untick anything that doesn’t look right on the video.</p>}
              {findings && people && crowded(people) && (
                <button
                  className="btn link small"
                  onClick={() => {
                    setTap(null)
                    setFindings(null)
                  }}
                >
                  Wrong person? Re-pick the athlete
                </button>
              )}
            </section>
          )}

          {drills && (drills.fixes.length > 0 || drills.extras.length > 0) && (
            <section className="card stack">
              <h2>Drills</h2>
              {[...drills.fixes.map((d) => [d, 'fix'] as const), ...drills.extras.map((d) => [d, 'football'] as const)].map(([d, why]) => (
                <div key={d.exercise_id} className="drill">
                  <strong>
                    <ExerciseLink id={d.exercise_id} who={forChild ? athleteId : undefined} />
                  </strong>{' '}
                  <small className="muted">
                    · {d.dose}
                    {why === 'football' ? ' · running-back drill' : ''}
                  </small>
                  <small className="block">{d.how}</small>
                </div>
              ))}
              <p className="muted small">Tap a drill for how to do it well and a demo video.</p>
              {!forChild && (
                <button className="btn" onClick={startDrills}>
                  Start these drills now
                </button>
              )}
              {me.role !== 'child' && (
                <button className="btn secondary" onClick={() => void addDrillsToProgram()}>
                  Add these to {forChild ? 'his' : 'my'} program
                </button>
              )}
            </section>
          )}

          {error && <p className="error">{error}</p>}
          <button className="btn" disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save result'}
          </button>
          <button className="btn link" onClick={() => setStep(test.manualValue && !url ? 'video' : 'mark')}>
            Back
          </button>
        </>
      )}

      {step !== 'result' && error && <p className="error">{error}</p>}
    </div>
  )
}

export const drillName = (id: string) => Object.values(DRILLS).find((d) => d.exercise_id === id)?.name ?? id
