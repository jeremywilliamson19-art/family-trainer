import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { MarkDef } from '../../lib/agility'
import type { PeopleFrame, PoseFrame } from '../../lib/pose/metrics'
import { drawSkeleton, seekFrame } from '../../lib/pose/runner'

type VideoWithRvfc = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => number
  cancelVideoFrameCallback?: (h: number) => void
}

/**
 * Frame-accurate player: ±1 / ±10 frame steps, a scrubber, slow playback,
 * and a button per mark. Shows the pose skeleton when one is available for
 * the current frame.
 */
export function VideoMarker({
  url,
  fileFps,
  marks,
  values,
  onMark,
  poses,
  people,
  onTap,
  startFrame = 0,
  videoRef,
}: {
  url: string
  fileFps: number
  marks: MarkDef[]
  values: Record<string, number>
  onMark: (key: string, frame: number) => void
  poses?: PoseFrame[] | null
  /** When set, everyone found is drawn and a tap on the video picks the athlete. */
  people?: PeopleFrame[] | null
  onTap?: (x: number, y: number, frame: number) => void
  /** Frame to open on (e.g. the start of the marked run). */
  startFrame?: number
  videoRef: RefObject<HTMLVideoElement | null>
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [frame, setFrame] = useState(0)
  // Where we're headed, updated at once, so quick repeated taps on ±1/±10
  // add up instead of all starting from the not-yet-updated frame.
  const pos = useRef(0)
  const [frames, setFrames] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [showPose, setShowPose] = useState(true)

  const frameOf = useCallback((t: number) => Math.max(0, Math.floor(t * fileFps + 1e-3)), [fileFps])

  // Track the shown frame while playing (precise with requestVideoFrameCallback).
  useEffect(() => {
    const v = videoRef.current as VideoWithRvfc | null
    if (!v) return
    let handle = 0
    const tick = (_now: number, meta: { mediaTime: number }) => {
      if (!v.paused) pos.current = frameOf(meta.mediaTime)
      setFrame(frameOf(meta.mediaTime))
      handle = v.requestVideoFrameCallback!(tick)
    }
    const onTime = () => {
      if (!v.paused) pos.current = frameOf(v.currentTime)
      setFrame(frameOf(v.currentTime))
    }
    if (v.requestVideoFrameCallback) handle = v.requestVideoFrameCallback(tick)
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('seeked', onTime)
    const onMeta = () => {
      setFrames(Math.max(1, Math.floor(v.duration * fileFps)))
      if (startFrame > 0 && pos.current === 0) {
        pos.current = startFrame
        setFrame(startFrame)
        void seekFrame(v, startFrame, fileFps)
      }
    }
    v.addEventListener('loadedmetadata', onMeta)
    if (v.readyState >= 1) onMeta()
    return () => {
      if (handle && v.cancelVideoFrameCallback) v.cancelVideoFrameCallback(handle)
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('seeked', onTime)
      v.removeEventListener('loadedmetadata', onMeta)
    }
  }, [videoRef, fileFps, frameOf, url, startFrame])

  // Skeleton for the nearest analyzed frame.
  useEffect(() => {
    const c = canvas.current
    const v = videoRef.current
    if (!c || !v) return
    const ctx = c.getContext('2d')!
    c.width = c.clientWidth * devicePixelRatio
    c.height = c.clientHeight * devicePixelRatio
    ctx.clearRect(0, 0, c.width, c.height)
    if (!v.videoWidth) return
    const scale = c.width / v.videoWidth
    if (people?.length) {
      let near = people[0]
      for (const p of people) if (Math.abs(p.frame - frame) < Math.abs(near.frame - frame)) near = p
      if (Math.abs(near.frame - frame) <= 8) for (const lm of near.people) drawSkeleton(ctx, lm, scale, 'rgba(255,255,255,0.85)')
      return
    }
    if (!showPose || !poses?.length) return
    let best = poses[0]
    for (const p of poses) if (Math.abs(p.frame - frame) < Math.abs(best.frame - frame)) best = p
    if (!best.lm || Math.abs(best.frame - frame) > 8) return
    drawSkeleton(ctx, best.lm, scale)
  }, [frame, poses, people, showPose, videoRef])

  const tap = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current
    if (!onTap || !v?.videoWidth) return
    const box = e.currentTarget.getBoundingClientRect()
    // object-fit: contain → map the tap into video pixels.
    const s = Math.min(box.width / v.videoWidth, box.height / v.videoHeight)
    const ox = (box.width - v.videoWidth * s) / 2
    const oy = (box.height - v.videoHeight * s) / 2
    onTap((e.clientX - box.left - ox) / s, (e.clientY - box.top - oy) / s, frame)
  }

  const go = async (f: number) => {
    const v = videoRef.current
    if (!v) return
    v.pause()
    setPlaying(false)
    const target = Math.max(0, Math.min(frames - 1, f))
    pos.current = target
    setFrame(target)
    await seekFrame(v, target, fileFps)
  }

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      v.playbackRate = 0.25
      void v.play()
      setPlaying(true)
    } else {
      v.pause()
      setPlaying(false)
    }
  }

  return (
    <div className="marker">
      <div className={`player ${onTap ? 'tap-mode' : ''}`} onClick={tap}>
        <video ref={videoRef} src={url} playsInline muted preload="auto" onEnded={() => setPlaying(false)} />
        <canvas ref={canvas} />
      </div>
      <div className="row frame-row">
        <span className="small">
          Frame <strong>{frame}</strong> / {frames}
        </span>
        {poses?.length ? (
          <label className="small">
            <input type="checkbox" checked={showPose} onChange={(e) => setShowPose(e.target.checked)} /> skeleton
          </label>
        ) : null}
      </div>
      <input type="range" min={0} max={Math.max(0, frames - 1)} value={frame} onChange={(e) => void go(Number(e.target.value))} aria-label="Scrub" />
      <div className="step-row">
        <button className="btn secondary small" onClick={() => void go(pos.current - 10)}>
          −10
        </button>
        <button className="btn secondary small" onClick={() => void go(pos.current - 1)} aria-label="Back one frame">
          ‹ 1
        </button>
        <button className="btn secondary small" onClick={togglePlay}>
          {playing ? '❚❚' : '▶︎ slow'}
        </button>
        <button className="btn secondary small" onClick={() => void go(pos.current + 1)} aria-label="Forward one frame">
          1 ›
        </button>
        <button className="btn secondary small" onClick={() => void go(pos.current + 10)}>
          +10
        </button>
      </div>
      <div className="mark-list">
        {marks.map((m) => (
          <div key={m.key} className="mark-row">
            <span>
              <strong>{m.label}</strong>
              <small className="muted block">{m.hint}</small>
            </span>
            <span className="mark-actions">
              {values[m.key] !== undefined && (
                <button className="chip" onClick={() => void go(values[m.key])} aria-label={`Go to ${m.label}`}>
                  #{values[m.key]}
                </button>
              )}
              <button className="btn small" onClick={() => onMark(m.key, pos.current)}>
                {values[m.key] === undefined ? 'Mark' : 'Re-mark'}
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
