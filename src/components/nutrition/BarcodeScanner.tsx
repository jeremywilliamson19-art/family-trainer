import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { useEffect, useRef, useState, type FormEvent } from 'react'

const FORMATS = [BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.EAN_13, BarcodeFormat.EAN_8]

/**
 * Camera barcode scanning with zxing (Safari has no BarcodeDetector).
 * Falls back to typing the number when the camera isn't available.
 */
export function BarcodeScanner({ onCode, onCancel }: { onCode: (code: string) => void; onCancel: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [typed, setTyped] = useState('')

  useEffect(() => {
    let controls: IScannerControls | undefined
    let done = false
    const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, FORMATS]])
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 })
    reader
      .decodeFromConstraints({ video: { facingMode: 'environment' } }, video.current!, (result) => {
        if (result && !done) {
          done = true
          controls?.stop()
          navigator.vibrate?.(50)
          onCode(result.getText())
        }
      })
      .then((c) => {
        controls = c
        if (done) c.stop()
      })
      .catch((e: Error) => {
        setError(
          e.name === 'NotAllowedError'
            ? 'Camera access is off. iPhone Settings → Apps → Safari → Camera → Allow, then reopen the app. Or type the number below.'
            : 'Couldn’t start the camera. Type the barcode number below.',
        )
      })
    return () => {
      done = true
      controls?.stop()
    }
  }, [onCode])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const code = typed.replace(/\D/g, '')
    if (code.length >= 8) onCode(code)
  }

  return (
    <div className="scanner">
      {!error && (
        <div className="viewfinder">
          <video ref={video} playsInline muted autoPlay />
          <div className="aim" />
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <p className="muted small">Point the camera at the barcode. Hold steady about 6 inches away.</p>
      <form className="row inline-form" onSubmit={submit}>
        <input inputMode="numeric" placeholder="Or type the barcode number" value={typed} onChange={(e) => setTyped(e.target.value)} />
        <button className="btn small">Look up</button>
      </form>
      <button type="button" className="btn secondary" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}
