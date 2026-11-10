import { recordAudit } from './aiAudit'
import type { AiContextPack, AiToolResult } from '../../shared/ai'
import { runTool } from './aiTools'

export type IdeWsMessageType =
  | 'hello'
  | 'context'
  | 'plan'
  | 'tool_call'
  | 'tool_result'
  | 'patch'
  | 'approval'
  | 'done'
  | 'error'

export interface IdeWsMessage {
  type: IdeWsMessageType
  id?: string
  client?: string
  version?: string
  projectId?: string
  projectPath?: string
  pack?: AiContextPack
  steps?: Array<{ id: string; label: string; status: 'pending' | 'running' | 'done' | 'failed' }>
  tool?: string
  args?: Record<string, unknown>
  toolResult?: AiToolResult
  patch?: { file: string; content?: string; summary?: string }
  approval?: { changeId: string; approved: boolean }
  summary?: string
  message?: string
  code?: number
}

const DEFAULT_IDE_WS_URL = 'ws://127.0.0.1:45678'

class IdeWebSocketBridge {
  private ws: WebSocket | null = null
  private url: string = DEFAULT_IDE_WS_URL
  private listeners = new Set<(msg: IdeWsMessage) => void>()
  private isConnecting = false

  setUrl(url: string) {
    this.url = url
  }

  getUrl(): string {
    return this.url
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  async ping(targetUrl = this.url): Promise<{ online: boolean; latencyMs: number; error?: string }> {
    const start = Date.now()
    return new Promise((resolve) => {
      let settled = false
      try {
        const testWs = new WebSocket(targetUrl)

        const timer = setTimeout(() => {
          if (!settled) {
            settled = true
            try { testWs.close() } catch {}
            resolve({ online: false, latencyMs: Date.now() - start, error: 'Hết thời gian kết nối (Timeout 1500ms)' })
          }
        }, 1500)

        testWs.onopen = () => {
          if (!settled) {
            settled = true
            clearTimeout(timer)
            const latency = Date.now() - start
            try { testWs.close() } catch {}
            resolve({ online: true, latencyMs: latency })
          }
        }

        testWs.onerror = () => {
          if (!settled) {
            settled = true
            clearTimeout(timer)
            resolve({ online: false, latencyMs: Date.now() - start, error: 'Không thể kết nối đến IDE WebSocket' })
          }
        }
      } catch (err) {
        resolve({ online: false, latencyMs: Date.now() - start, error: String(err) })
      }
    })
  }

  async connect(projectPath?: string, projectId?: string): Promise<boolean> {
    if (this.isConnected()) return true
    if (this.isConnecting) return false

    this.isConnecting = true
    try {
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        this.isConnecting = false
        // Gửi handshake 'hello' đúng theo giao thức
        this.send({
          type: 'hello',
          client: 'PixelMind Desktop',
          version: '1.0.0',
          projectId,
          projectPath,
        })
        void recordAudit({
          type: 'bridge',
          summary: `Đã kết nối IDE WebSocket Bridge: ${this.url}`,
          ok: true,
          projectId,
        })
      }

      this.ws.onmessage = async (event) => {
        try {
          const raw = typeof event.data === 'string' ? event.data : event.data.toString()
          const msg = JSON.parse(raw) as IdeWsMessage

          // Xử lý tự động tool_call từ IDE nếu có
          if (msg.type === 'tool_call' && msg.tool) {
            const result = await runTool({
              tool: msg.tool as never,
              projectId: msg.projectId,
              projectPath: msg.projectPath || projectPath || '',
              args: msg.args || {},
            })

            // Trả về tool_result cho IDE
            this.send({
              type: 'tool_result',
              id: msg.id,
              toolResult: result,
            })
          }

          for (const cb of this.listeners) {
            cb(msg)
          }
        } catch {}
      }

      this.ws.onclose = () => {
        this.ws = null
        this.isConnecting = false
      }

      this.ws.onerror = () => {
        this.ws = null
        this.isConnecting = false
      }

      return true
    } catch {
      this.isConnecting = false
      return false
    }
  }

  send(msg: IdeWsMessage): boolean {
    if (!this.isConnected() || !this.ws) return false
    try {
      this.ws.send(JSON.stringify(msg))
      return true
    } catch {
      return false
    }
  }

  disconnect() {
    if (this.ws) {
      try {
        this.ws.close()
      } catch {}
      this.ws = null
    }
    this.isConnecting = false
  }

  onMessage(callback: (msg: IdeWsMessage) => void): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }
}

export const ideWsBridge = new IdeWebSocketBridge()
