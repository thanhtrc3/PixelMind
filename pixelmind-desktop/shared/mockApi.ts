/* ══════════════════════════════════════════════════════════════
   D1-21: MOCK API CHO DỰ ÁN THỬ NGHIỆM — KIỂU DỮ LIỆU & HÀM THUẦN
   ══════════════════════════════════════════════════════════════ */

export type MockHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface MockRoute {
  id: string
  method: MockHttpMethod
  /** Đường dẫn bắt đầu bằng '/', không kèm query. */
  path: string
  status: number
  /** Chuỗi JSON hợp lệ; '' = body rỗng. */
  body: string
  delayMs?: number
}

export interface MockApiConfig {
  /** 0 = tự chọn cổng trống. */
  port: number
  routes: MockRoute[]
}

export interface MockApiCall {
  at: number
  method: string
  path: string
  status: number
}

export interface MockApiState {
  running: boolean
  port: number | null
  url: string | null
  projectPath?: string
  error?: string
  calls: MockApiCall[]
}

export const MOCK_METHODS: MockHttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

export function normalizeMockPath(value: string): string {
  const clean = String(value || '').trim().split('?')[0].split('#')[0]
  if (!clean) return '/'
  const withSlash = clean.startsWith('/') ? clean : `/${clean}`
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, '') || '/' : '/'
}

export function matchMockRoute(
  routes: MockRoute[],
  method: string,
  pathname: string,
): MockRoute | null {
  const normMethod = String(method || '').toUpperCase()
  const normPath = normalizeMockPath(pathname)
  return routes.find((r) => r.method === normMethod && normalizeMockPath(r.path) === normPath) || null
}

export function emptyMockState(): MockApiState {
  return {
    running: false,
    port: null,
    url: null,
    calls: [],
  }
}

export function normalizeMockConfig(raw: unknown): { config: MockApiConfig; errors: string[] } {
  const errors: string[] = []
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>

  // Cổng (port)
  let port = 0
  if (obj.port !== undefined && obj.port !== null && obj.port !== '') {
    const p = Number(obj.port)
    if (!Number.isInteger(p) || p < 0 || p > 65535) {
      errors.push('Cổng phải là số nguyên từ 0 đến 65535.')
      port = 0
    } else {
      port = p
    }
  }

  // Danh sách routes
  const rawRoutes = Array.isArray(obj.routes) ? obj.routes : []
  const routes: MockRoute[] = []

  rawRoutes.forEach((item, index) => {
    const r = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const id = String(r.id || `r_${index + 1}`).trim() || `r_${index + 1}`

    // Method
    const rawMethod = String(r.method || 'GET').toUpperCase()
    let method: MockHttpMethod = 'GET'
    if (MOCK_METHODS.includes(rawMethod as MockHttpMethod)) {
      method = rawMethod as MockHttpMethod
    } else {
      errors.push(`Route #${index + 1}: Phương thức ${rawMethod} không hợp lệ (phải là GET, POST, PUT, PATCH, DELETE).`)
    }

    // Path
    const rawPath = String(r.path || '').trim()
    if (!rawPath) {
      errors.push(`Route #${index + 1}: Đường dẫn không được để trống.`)
    }
    const path = normalizeMockPath(rawPath)

    // Status
    const rawStatus = Number(r.status ?? 200)
    let status = 200
    if (!Number.isInteger(rawStatus) || rawStatus < 100 || rawStatus > 599) {
      errors.push(`Route #${index + 1}: Mã trạng thái HTTP (${r.status}) phải nằm trong khoảng 100-599.`)
    } else {
      status = rawStatus
    }

    // Body
    const body = typeof r.body === 'string' ? r.body : r.body !== undefined ? JSON.stringify(r.body) : ''
    if (body.trim() !== '') {
      try {
        JSON.parse(body)
      } catch (err: any) {
        errors.push(`Route #${index + 1}: Nội dung body không phải là chuỗi JSON hợp lệ.`)
      }
    }

    // Delay
    let delayMs: number | undefined
    if (r.delayMs !== undefined && r.delayMs !== null) {
      const d = Number(r.delayMs)
      if (Number.isFinite(d) && d >= 0) {
        delayMs = Math.min(Math.round(d), 5000)
      }
    }

    routes.push({
      id,
      method,
      path,
      status,
      body,
      delayMs,
    })
  })

  return {
    config: {
      port,
      routes,
    },
    errors,
  }
}
