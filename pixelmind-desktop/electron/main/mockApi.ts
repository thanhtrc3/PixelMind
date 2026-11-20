/* ══════════════════════════════════════════════════════════════
   D1-21: MOCK API SERVER CHO DỰ ÁN THỬ NGHIỆM
   Chạy bằng node:http cục bộ, không phụ thuộc Electron.
   ══════════════════════════════════════════════════════════════ */

import http from 'node:http'
import fs from 'node:fs/promises'
import { join } from 'node:path'
import type {
  MockApiCall,
  MockApiConfig,
  MockApiState,
  MockRoute,
} from '../../shared/mockApi.ts'
import {
  emptyMockState,
  matchMockRoute,
  normalizeMockConfig,
  normalizeMockPath,
} from '../../shared/mockApi.ts'
import { isPortAvailable as defaultIsPortAvailable } from './runnerPorts.ts'

export interface MockApiServerOptions {
  isPortAvailable?: (port: number) => Promise<boolean>
}

export class MockApiServer {
  private server: http.Server | null = null
  private routes: MockRoute[] = []
  private calls: MockApiCall[] = []
  private running = false
  private port: number | null = null
  private url: string | null = null
  private projectPath?: string
  private listeners: Set<(state: MockApiState) => void> = new Set()
  private checkPort: (port: number) => Promise<boolean>

  constructor(options?: MockApiServerOptions) {
    this.checkPort = options?.isPortAvailable ?? defaultIsPortAvailable
  }

  public state(): MockApiState {
    return {
      running: this.running,
      port: this.port,
      url: this.url,
      projectPath: this.projectPath,
      calls: this.calls,
    }
  }

  public onChange(cb: (state: MockApiState) => void): () => void {
    this.listeners.add(cb)
    return () => {
      this.listeners.delete(cb)
    }
  }

  private notify(error?: string) {
    const currentState = {
      ...this.state(),
      ...(error ? { error } : {}),
    }
    for (const listener of this.listeners) {
      try {
        listener(currentState)
      } catch {
        // bỏ qua lỗi trong callback listener
      }
    }
  }

  public async start(config: MockApiConfig, projectPath?: string): Promise<MockApiState> {
    if (this.running) {
      return {
        ...this.state(),
        error: 'Mock API đang chạy. Hãy dừng trước khi khởi động lại.',
      }
    }

    const wanted = config.port ?? 0
    if (wanted > 0 && !(await this.checkPort(wanted))) {
      const state = {
        ...emptyMockState(),
        projectPath,
        error: `Cổng ${wanted} đang bị tiến trình khác chiếm. Hãy chọn cổng khác.`,
      }
      this.notify(state.error)
      return state
    }

    const { config: normalizedConfig } = normalizeMockConfig(config)
    this.routes = normalizedConfig.routes
    this.calls = []
    this.projectPath = projectPath

    const srv = http.createServer(async (req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

      if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        this.recordCall('OPTIONS', req.url || '/', 204)
        return
      }

      try {
        const parsedUrl = new URL(req.url || '/', 'http://127.0.0.1')
        const pathname = normalizeMockPath(parsedUrl.pathname)
        const method = (req.method || 'GET').toUpperCase()

        const matched = matchMockRoute(this.routes, method, pathname)
        if (!matched) {
          const body = JSON.stringify({
            error: 'Không có route mock khớp',
            method,
            path: pathname,
          })
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(body)
          this.recordCall(method, pathname, 404)
          return
        }

        if (matched.delayMs && matched.delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, matched.delayMs))
        }

        res.writeHead(matched.status, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(matched.body || '{}')
        this.recordCall(method, pathname, matched.status)
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: String(err?.message || err) }))
      }
    })

    return new Promise<MockApiState>((resolve) => {
      srv.once('error', (err: any) => {
        this.server = null
        this.running = false
        this.port = null
        this.url = null
        const state = {
          ...emptyMockState(),
          projectPath,
          error: `Không khởi động được Mock API: ${err?.message || String(err)}`,
        }
        this.notify(state.error)
        resolve(state)
      })

      srv.listen({ port: wanted, host: '127.0.0.1' }, () => {
        this.server = srv
        this.running = true
        const address = srv.address()
        this.port = typeof address === 'object' && address ? address.port : wanted
        this.url = `http://127.0.0.1:${this.port}`

        const state = this.state()
        this.notify()
        resolve(state)
      })
    })
  }

  private recordCall(method: string, path: string, status: number) {
    this.calls.push({
      at: Date.now(),
      method,
      path,
      status,
    })
    if (this.calls.length > 50) {
      this.calls.shift()
    }
    this.notify()
  }

  public async stop(): Promise<MockApiState> {
    if (!this.server) {
      return emptyMockState()
    }

    const srv = this.server
    this.server = null
    this.running = false
    this.port = null
    this.url = null

    try {
      srv.closeAllConnections?.()
    } catch {}

    await new Promise<void>((resolve) => {
      srv.close(() => resolve())
    })

    this.routes = []
    const state = emptyMockState()
    this.notify()
    return state
  }
}

const MOCK_CONFIG_FILE = 'mock.json'

export async function readMockConfig(projectPath: string): Promise<MockApiConfig | null> {
  if (!projectPath) return null
  const file = join(projectPath, '.pixelmind', MOCK_CONFIG_FILE)
  try {
    const text = await fs.readFile(file, 'utf8')
    const parsed = JSON.parse(text)
    return normalizeMockConfig(parsed).config
  } catch {
    return null
  }
}

export async function writeMockConfig(projectPath: string, config: MockApiConfig): Promise<void> {
  if (!projectPath) return
  const dir = join(projectPath, '.pixelmind')
  await fs.mkdir(dir, { recursive: true })
  const file = join(dir, MOCK_CONFIG_FILE)
  const content = JSON.stringify(config, null, 2)
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`
  try {
    await fs.writeFile(temp, content, 'utf8')
    await fs.rename(temp, file)
  } catch {
    // Dự phòng an toàn trên Windows khi thao tác rename bị khoá tệp
    await fs.writeFile(file, content, 'utf8')
    await fs.unlink(temp).catch(() => {})
  }
}
