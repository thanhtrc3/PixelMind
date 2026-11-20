/* ══════════════════════════════════════════════════════════════
   D1-26: DEPLOY / PREVIEW URL — CHẠY TIẾN TRÌNH LỆNH TRIỂN KHAI
   Không phụ thuộc Electron để test được với Node runner.
   ══════════════════════════════════════════════════════════════ */

import { spawn } from 'node:child_process'
import type { DeployLog } from '../../shared/deploy.ts'
import {
  deployErrorMessage,
  parseDeployUrl,
  redactSecrets,
} from '../../shared/deploy.ts'

export interface DeployRunOptions {
  command: string
  cwd: string
  env?: Record<string, string>
  /** Giá trị cần che trong log. */
  secrets?: string[]
  timeoutMs?: number
  onLog?: (log: DeployLog) => void
}

export interface DeployRunResult {
  ok: boolean
  url: string | null
  code: number | null
  error?: string
}

function killChildProcess(child: ReturnType<typeof spawn>) {
  if (!child || !child.pid) return
  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
    } catch {
      try {
        child.kill()
      } catch {}
    }
  } else {
    try {
      child.kill('SIGTERM')
    } catch {}
  }
}

export function runDeployCommand(options: DeployRunOptions): Promise<DeployRunResult> {
  const { command, cwd, env, secrets = [], timeoutMs = 300_000, onLog } = options

  return new Promise<DeployRunResult>((resolve) => {
    let child: ReturnType<typeof spawn>
    try {
      child = spawn(command, {
        shell: true,
        cwd,
        env: { ...process.env, ...env },
        windowsHide: true,
      })
    } catch (err: any) {
      const msg = deployErrorMessage(null, '') + ' ' + redactSecrets(String(err?.message || err), secrets)
      resolve({
        ok: false,
        url: null,
        code: null,
        error: msg,
      })
      return
    }

    let timedOut = false
    let stdoutText = ''
    const stderrLines: string[] = []

    const timeoutTimer = setTimeout(() => {
      timedOut = true
      killChildProcess(child)
      onLog?.({
        at: Date.now(),
        stream: 'system',
        text: '[system] Quá thời gian triển khai, đã dừng tiến trình.\n',
      })
    }, timeoutMs)

    child.stdout?.on('data', (data: Buffer | string) => {
      const raw = data.toString()
      const redacted = redactSecrets(raw, secrets)
      stdoutText += redacted
      onLog?.({
        at: Date.now(),
        stream: 'stdout',
        text: redacted,
      })
    })

    child.stderr?.on('data', (data: Buffer | string) => {
      const raw = data.toString()
      const redacted = redactSecrets(raw, secrets)
      const lines = redacted.split(/\r?\n/)
      for (const line of lines) {
        if (line.trim()) {
          stderrLines.push(line)
          if (stderrLines.length > 40) {
            stderrLines.shift()
          }
        }
      }
      onLog?.({
        at: Date.now(),
        stream: 'stderr',
        text: redacted,
      })
    })

    child.on('error', (err: any) => {
      clearTimeout(timeoutTimer)
      const errText = redactSecrets(String(err?.message || err), secrets)
      onLog?.({
        at: Date.now(),
        stream: 'system',
        text: `[system] Lỗi: ${errText}\n`,
      })
      resolve({
        ok: false,
        url: null,
        code: null,
        error: `${deployErrorMessage(null, '')} ${errText}`,
      })
    })

    child.on('close', (code) => {
      clearTimeout(timeoutTimer)
      if (timedOut) {
        resolve({
          ok: false,
          url: null,
          code,
          error: `Quá thời gian triển khai (quá ${Math.round(timeoutMs / 1000)} giây). Kiểm tra kết nối mạng hoặc lệnh deploy.`,
        })
        return
      }

      if (code === 0) {
        const url = parseDeployUrl(stdoutText)
        resolve({
          ok: true,
          url,
          code: 0,
        })
      } else {
        const tail = stderrLines.slice(-8).join('\n')
        resolve({
          ok: false,
          url: null,
          code,
          error: deployErrorMessage(code, tail),
        })
      }
    })
  })
}
