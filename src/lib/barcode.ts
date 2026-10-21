// Decoding grocery barcodes (UPC/EAN) from still images: a frame grabbed
// from the camera preview, or a photo taken with the iPhone camera.
import { normalizeBarcode } from './barcodeCodes'
import { BarcodeFormat, BinaryBitmap, DecodeHintType, HybridBinarizer, MultiFormatReader, RGBLuminanceSource } from '@zxing/library'

export const GROCERY_FORMATS = [BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.EAN_13, BarcodeFormat.EAN_8]

const reader = new MultiFormatReader()
reader.setHints(
  new Map<DecodeHintType, unknown>([
    [DecodeHintType.POSSIBLE_FORMATS, GROCERY_FORMATS],
    // Scan more rows and also try the image rotated 90°.
    [DecodeHintType.TRY_HARDER, true],
  ]),
)

function decodeGray(gray: Uint8ClampedArray, width: number, height: number): string | null {
  try {
    const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(gray, width, height)))
    return reader.decode(bitmap).getText()
  } catch {
    return null
  } finally {
    reader.reset()
  }
}

function rotate90(gray: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(gray.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) out[x * height + (height - 1 - y)] = gray[y * width + x]
  }
  return out
}

/**
 * Decodes RGBA pixels (canvas ImageData), trying the image as-is and turned
 * 90° (zxing's own rotate option doesn't apply to raw pixel sources).
 * Returns the code normalized for lookup, or null.
 */
export function decodeRgba(data: Uint8ClampedArray, width: number, height: number): string | null {
  const gray = new Uint8ClampedArray(width * height)
  for (let i = 0, j = 0; j < gray.length; i += 4, j++) {
    gray[j] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000
  }
  const code = decodeGray(gray, width, height) ?? decodeGray(rotate90(gray, width, height), height, width)
  return code ? normalizeBarcode(code) : null
}


/**
 * Decodes a drawable (video frame or photo). Big photos are scaled down
 * first: iPhone photos are 12+ megapixels, far more than a barcode needs.
 */
export function decodeDrawable(src: CanvasImageSource, srcWidth: number, srcHeight: number): string | null {
  for (const maxSide of [1600, 1000, 2400]) {
    const scale = Math.min(1, maxSide / Math.max(srcWidth, srcHeight))
    const w = Math.round(srcWidth * scale)
    const h = Math.round(srcHeight * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(src, 0, 0, w, h)
    const code = decodeRgba(ctx.getImageData(0, 0, w, h).data, w, h)
    if (code) return code
  }
  return null
}

/** Decodes a photo file from the camera or photo library. */
export async function decodeFile(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file) // applies the photo's rotation
  try {
    return decodeDrawable(bitmap, bitmap.width, bitmap.height)
  } finally {
    bitmap.close()
  }
}

export { normalizeBarcode }
