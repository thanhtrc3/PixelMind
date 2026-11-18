/* ══════════════════════════════════════════════════════════════
   D1-26 & D1-23: LƯU TRỮ SECRET MÃ HOÁ (Electron safeStorage wrapper)
   Không phụ thuộc Electron trực tiếp, nhận SecretCodec để test được.
   ══════════════════════════════════════════════════════════════ */

import fs from 'node:fs/promises'
import { dirname } from 'node:path'

export interface SecretCodec {
  isEncryptionAvailable(): boolean
  encryptString(value: string): Buffer
  decryptString(value: Buffer): string
}

export interface SecretStore {
  available: boolean
  load(): Promise<string | null>
  save(value: string | null): Promise<void>
}

export function createSecretStore(file: string, codec: SecretCodec): SecretStore {
  return {
    get available(): boolean {
      try {
        return codec.isEncryptionAvailable()
      } catch {
        return false
      }
    },

    async load(): Promise<string | null> {
      if (!this.available) return null
      try {
        const text = await fs.readFile(file, 'utf8')
        const parsed = JSON.parse(text)
        if (!parsed || parsed.v !== 1 || typeof parsed.data !== 'string') {
          return null
        }
        const buf = Buffer.from(parsed.data, 'base64')
        return codec.decryptString(buf)
      } catch {
        // Nếu file hỏng, thử xoá dọn dẹp
        await fs.unlink(file).catch(() => {})
        return null
      }
    },

    async save(value: string | null): Promise<void> {
      if (value === null) {
        await fs.unlink(file).catch(() => {})
        return
      }

      if (!this.available) {
        // Tuyệt đối không ghi plaintext khi mã hoá không khả dụng
        return
      }

      const encrypted = codec.encryptString(value)
      const content = JSON.stringify(
        {
          v: 1,
          data: encrypted.toString('base64'),
        },
        null,
        2,
      )

      await fs.mkdir(dirname(file), { recursive: true })
      const temp = `${file}.${process.pid}.${Date.now()}.tmp`
      try {
        await fs.writeFile(temp, content, 'utf8')
        await fs.rename(temp, file)
      } catch {
        await fs.writeFile(file, content, 'utf8')
        await fs.unlink(temp).catch(() => {})
      }
    },
  }
}
