import type { PixelMindApi } from '@shared/api'

declare global {
  interface Window {
    pixelmind?: PixelMindApi
  }
}

export {}
