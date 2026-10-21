import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { decodeDrawable, decodeFile, decodeRgba, normalizeBarcode } from '../../lib/barcode'

/**
 * Live camera scanning (Safari has no BarcodeDetector, so frames are decoded
 * with zxing), plus two fallbacks: a full-resolution photo from the iPhone
 * camera, or typing the number.
 */
export function BarcodeScanner({ onCode, onCancel }: { onCode: (code: string) => void; onCancel: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const found = useRef(false)

  const finish = (code: string) => {
    if (found.current) return
    found.current = true
    navigator.vibrate?.(50)
    onCode(code)
  }

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!

    // Decode just the area inside the aiming box, at full camera resolution.
    const scan = () => {
      const v = video.current
      if (stopped || found.current || !v) return
      if (v.readyState >= 2 && v.videoWidth) {
        const sw = Math.round(v.videoWidth * 0.86)
        const sh = Math.round(v.videoHeight * 0.5)
        const scale = Math.min(1, 1280 / sw)
        canvas.width = Math.round(sw * scale)
        canvas.height = Math.round(sh * scale)
        ctx.drawImage(v, (v.videoWidth - sw) / 2, (v.videoHeight - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height)
        const code = decodeRgba(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)
        if (code) return finish(code)
      }
      timer = setTimeout(scan, 250)
    }

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then(async (s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop())
        stream = s
        // Continuous autofocus where the browser allows it (close-up barcodes need it).
        const track = s.getVideoTracks()[0]
        const caps = (track.getCapabilities?.() ?? {}) as { focusMode?: string[] }
        if (caps.focusMode?.includes('continuous')) {
          await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => {})
        }
        const v = video.current!
        v.srcObject = s
        await v.play().catch(() => {})
        scan()
      })
      .catch((e: Error) =>
        setError(
          e.name === 'NotAllowedError'
            ? 'Camera access is off. Use “Take a photo” below, or turn it on: iPhone Settings → Apps → Safari → Camera → Allow, then reopen the app.'
            : 'Couldn’t start the live camera. Use “Take a photo” below or type the number.',
        ),
      ) ?? setError('This browser can’t use the camera. Type the barcode number below.')

    return () => {
      stopped = true
      clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setNote('Reading the photo…')
    const code = await decodeFile(file).catch(() => null)
    if (code) return finish(code)
    setNote('Couldn’t find a barcode in that photo. Get closer so the barcode fills most of the picture, with good light and no glare.')
  }

  const snapFrame = () => {
    const v = video.current
    if (!v?.videoWidth) return
    const code = decodeDrawable(v, v.videoWidth, v.videoHeight)
    if (code) finish(code)
    else setNote('Not yet. Hold the barcode flat inside the box, about 6 inches away, and try again.')
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const code = normalizeBarcode(typed)
    if (code.length >= 8) finish(code)
  }

  return (
    <div className="scanner">
      {!error && (
        <div className="viewfinder" onClick={snapFrame}>
          <video ref={video} playsInline muted autoPlay />
          <div className="aim" />
        </div>
      )}
      {error ? <p className="error">{error}</p> : <p className="muted small">Line the barcode up inside the box. It scans by itself. Tap the picture to try right now.</p>}
      {note && <p className="muted small">{note}</p>}

      <input ref={photoInput} type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} />
      <button type="button" className="btn secondary" onClick={() => photoInput.current?.click()}>
        📸 Take a photo of the barcode
      </button>

      <form className="row inline-form" onSubmit={submit}>
        <input inputMode="numeric" placeholder="Or type the barcode number" value={typed} onChange={(e) => setTyped(e.target.value)} />
        <button className="btn small">Look up</button>
      </form>
      <button type="button" className="btn link" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}
