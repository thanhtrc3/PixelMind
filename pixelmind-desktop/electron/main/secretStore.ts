/* ══════════════════════════════════════════════════════════════
   D1-26 & D1-23: LƯU TRỮ SECRET MÃ HOÁ (Electron safeStorage wrapper)
   Không phụ thuộc Electron trực tiếp, nhận SecretCodec để test được.
   ══════════════════════════════════════════════════════════════ */

import fs from 'node:fs/promises'
import { dirname } from 'node:path'

export interface SecretCodec {
  isEncryptionAvailable?(): boolean
  isAsyncEncryptionAvailable?(): Promise<boolean>
  encryptString?(value: string): Buffer
  encryptStringAsync?(value: string): Promise<Buffer>
  decryptString?(value: Buffer): string
  decryptStringAsync?(value: Buffer): Promise<{ result: string; shouldReEncrypt?: boolean } | string>
}

export interface SecretStore {
  readonly available: boolean
  isAvailable(): Promise<boolean>
  load(): Promise<string | null>
  save(value: string | null): Promise<void>
}

async function checkAvailable(codec: SecretCodec): Promise<boolean> {
  try {
    if (typeof codec.isAsyncEncryptionAvailable === 'function') {
      return await codec.isAsyncEncryptionAvailable()
    }
    if (typeof codec.isEncryptionAvailable === 'function') {
      return codec.isEncryptionAvailable()
    }
    return false
  } catch {
    return false
  }
}

async function doEncrypt(codec: SecretCodec, value: string): Promise<Buffer> {
  if (typeof codec.encryptStringAsync === 'function') {
    return await codec.encryptStringAsync(value)
  }
  if (typeof codec.encryptString === 'function') {
    return codec.encryptString(value)
  }
  throw new Error('Không có phương thức mã hoá khả dụng')
}

async function doDecrypt(codec: SecretCodec, buf: Buffer): Promise<string> {
  if (typeof codec.decryptStringAsync === 'function') {
    const res = await codec.decryptStringAsync(buf)
    if (typeof res === 'string') return res
    return res.result
  }
  if (typeof codec.decryptString === 'function') {
    return codec.decryptString(buf)
  }
  throw new Error('Không có phương thức giải mã khả dụng')
}

export function createSecretStore(file: string, codec: SecretCodec): SecretStore {
  let cachedAvailable: boolean | null = null

  return {
    get available(): boolean {
      if (cachedAvailable !== null) return cachedAvailable
      if (typeof codec.isAsyncEncryptionAvailable === 'function') {
        void codec.isAsyncEncryptionAvailable().then((v) => {
          cachedAvailable = v
        }).catch(() => {})
        return true
      }
      try {
        return codec.isEncryptionAvailable?.() ?? false
      } catch {
        return false
      }
    },

    async isAvailable(): Promise<boolean> {
      if (cachedAvailable !== null) return cachedAvailable
      cachedAvailable = await checkAvailable(codec)
      return cachedAvailable
    },

    async load(): Promise<string | null> {
      const isAvail = await this.isAvailable()
      if (!isAvail) return null
      try {
        const text = await fs.readFile(file, 'utf8')
        const parsed = JSON.parse(text)
        if (!parsed || parsed.v !== 1 || typeof parsed.data !== 'string') {
          return null
        }
        const buf = Buffer.from(parsed.data, 'base64')
        return await doDecrypt(codec, buf)
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

      const isAvail = await this.isAvailable()
      if (!isAvail) {
        // Tuyệt đối không ghi plaintext khi mã hoá không khả dụng
        return
      }

      const encrypted = await doEncrypt(codec, value)
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
