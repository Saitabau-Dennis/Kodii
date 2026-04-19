import { createAvatar } from '@dicebear/core'
import * as pixelArt from '@dicebear/pixel-art'

const BACKGROUND_COLORS = ['b6e3f4', 'c0aede', 'd1d4f9']

export function createPixelAvatar(seed: string, size = 40): string {
  return createAvatar(pixelArt, {
    seed,
    size,
    backgroundColor: BACKGROUND_COLORS,
  }).toDataUri()
}
