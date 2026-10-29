import type { PixelMindApi } from '@shared/api'
import { createBrowserMock } from './mock'

/** API gốc do preload của Electron cung cấp (nếu đang chạy trong app desktop). */
export const nativeApi: PixelMindApi | undefined = (window as unknown as { pixelmind?: PixelMindApi })
  .pixelmind

export const isDesktop = Boolean(nativeApi)

/** Luôn có API để gọi: desktop thật hoặc bản giả lập trên trình duyệt. */
export const api: PixelMindApi = nativeApi ?? createBrowserMock()
