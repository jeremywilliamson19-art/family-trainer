// Barcode number helpers (no decoder here, so importing this stays cheap).

/** UPC-E (8 digits) to its UPC-A (12 digits) equivalent. */
function upcEToA(e: string): string {
  const [ns, d1, d2, d3, d4, d5, d6, check] = e.split('')
  const body =
    d6 === '0' || d6 === '1' || d6 === '2'
      ? `${d1}${d2}${d6}0000${d3}${d4}${d5}`
      : d6 === '3'
        ? `${d1}${d2}${d3}00000${d4}${d5}`
        : d6 === '4'
          ? `${d1}${d2}${d3}${d4}00000${d5}`
          : `${d1}${d2}${d3}${d4}${d5}0000${d6}`
  return `${ns}${body}${check}`
}

/**
 * One form per product, as Open Food Facts stores it: UPC-A and UPC-E become
 * 13-digit EAN ("049000028911" → "0049000028911"). EAN-8 stays 8 digits.
 */
export function normalizeBarcode(raw: string): string {
  const code = raw.replace(/\D/g, '')
  if (code.length === 12) return `0${code}`
  if (code.length === 8 && (code[0] === '0' || code[0] === '1') && looksLikeUpcE(code)) return `0${upcEToA(code)}`
  return code
}

/** An 8-digit code is UPC-E (not EAN-8) when its check digit only works as UPC-E. */
function looksLikeUpcE(code: string): boolean {
  const a = upcEToA(code)
  const digits = a.slice(0, 11).split('').map(Number)
  const sum = digits.reduce((n, d, i) => n + d * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === Number(a[11])
}
