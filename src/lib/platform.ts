/** iPhone/iPad, including iPadOS which reports itself as a Mac. */
export function isIOS(): boolean {
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

/** Opened from the home-screen icon rather than a browser tab. */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** Safari on iOS (the only iOS browser we trust for install + push). */
export function isIOSSafari(): boolean {
  const ua = navigator.userAgent
  return isIOS() && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(ua)
}

/** iOS major.minor, or null when not iOS. */
export function iosVersion(): number | null {
  const m = navigator.userAgent.match(/OS (\d+)_(\d+)/)
  return isIOS() && m ? Number(`${m[1]}.${m[2]}`) : null
}
