// Runs MediaPipe Pose on frames of a local video. Everything stays on the
// phone: the runtime and model are served from this app and the video is a
// local file.
import type { PoseLandmarker } from '@mediapipe/tasks-vision'
import type { PeopleFrame, Pt } from './metrics'

let landmarker: Promise<PoseLandmarker> | null = null

function load(): Promise<PoseLandmarker> {
  landmarker ??= (async () => {
    const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision')
    const base = import.meta.env.BASE_URL
    const fileset = await FilesetResolver.forVisionTasks(`${base}mediapipe`)
    const make = (delegate: 'GPU' | 'CPU') =>
      PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: `${base}models/pose_landmarker_full.task`, delegate },
        runningMode: 'VIDEO',
        // Track a few people so the athlete can be picked out from bystanders.
        numPoses: 4,
        minPoseDetectionConfidence: 0.4,
        minTrackingConfidence: 0.4,
      })
    // GPU is much faster; fall back to CPU where WebGL isn't available.
    return make('GPU').catch(() => make('CPU'))
  })().catch((e) => {
    landmarker = null
    throw e
  })
  return landmarker
}

/** Seeks to the middle of a frame and waits until that frame is showing. */
export function seekFrame(video: HTMLVideoElement, frame: number, fileFps: number): Promise<void> {
  return new Promise((resolve) => {
    const target = (frame + 0.5) / fileFps
    if (Math.abs(video.currentTime - target) < 0.25 / fileFps) return resolve()
    const done = () => {
      video.removeEventListener('seeked', done)
      // Wait for the frame to be painted where supported (Safari 15.4+).
      if ('requestVideoFrameCallback' in video) (video as HTMLVideoElement & { requestVideoFrameCallback(cb: () => void): void }).requestVideoFrameCallback(() => resolve())
      else resolve()
    }
    video.addEventListener('seeked', done)
    video.currentTime = target
    // Some browsers never fire rVFC for a paused seek; don't hang.
    setTimeout(resolve, 600)
  })
}

export interface AnalyzeOptions {
  fromFrame: number
  toFrame: number
  fileFps: number
  /** Real-time capture rate (240 for Slo-mo), for choosing the sampling step. */
  captureFps: number
  onProgress?: (done: number, total: number) => void
  signal?: AbortSignal
}

/**
 * Pose for frames in [from, to], sampled at about 60 per real-time second
 * and at most 400 frames, so a phone finishes in well under a minute.
 */
export async function analyzeFrames(video: HTMLVideoElement, o: AnalyzeOptions): Promise<PeopleFrame[]> {
  const pose = await load()
  const span = Math.max(1, o.toFrame - o.fromFrame)
  const step = Math.max(1, Math.round(o.captureFps / 60), Math.ceil(span / 400))
  const frames: PeopleFrame[] = []
  const w = video.videoWidth
  const h = video.videoHeight
  let ts = performance.now()
  const total = Math.floor(span / step) + 1
  video.pause()
  for (let f = o.fromFrame, n = 0; f <= o.toFrame; f += step, n++) {
    if (o.signal?.aborted) break
    await seekFrame(video, f, o.fileFps)
    ts = Math.max(ts + 1, performance.now()) // timestamps must increase
    const r = pose.detectForVideo(video, ts)
    frames.push({ frame: f, people: r.landmarks.map((lm) => lm.map((p): Pt => ({ x: p.x * w, y: p.y * h, v: p.visibility ?? 1 }))) })
    o.onProgress?.(n + 1, total)
  }
  return frames
}

/** Bones to draw for the skeleton overlay. */
export const BONES: [number, number][] = [
  [11, 12], [11, 23], [12, 24], [23, 24],
  [11, 13], [13, 15], [12, 14], [14, 16],
  [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 31], [28, 32],
]

export function drawSkeleton(ctx: CanvasRenderingContext2D, lm: Pt[], scale: number, color = 'rgba(34, 197, 94, 0.9)') {
  ctx.lineWidth = 3
  ctx.strokeStyle = color
  ctx.fillStyle = '#fff'
  for (const [a, b] of BONES) {
    if (lm[a].v < 0.5 || lm[b].v < 0.5) continue
    ctx.beginPath()
    ctx.moveTo(lm[a].x * scale, lm[a].y * scale)
    ctx.lineTo(lm[b].x * scale, lm[b].y * scale)
    ctx.stroke()
  }
  for (const i of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
    if (lm[i].v < 0.5) continue
    ctx.beginPath()
    ctx.arc(lm[i].x * scale, lm[i].y * scale, 4, 0, Math.PI * 2)
    ctx.fill()
  }
}
