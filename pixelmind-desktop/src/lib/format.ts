export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

export const formatTime = (timestamp: number | null): string => {
  if (!timestamp) return 'Chưa mở lần nào'
  const diff = Date.now() - timestamp
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return 'Vừa xong'
  if (diff < hour) return `${Math.floor(diff / minute)} phút trước`
  if (diff < day) return `${Math.floor(diff / hour)} giờ trước`
  if (diff < 7 * day) return `${Math.floor(diff / day)} ngày trước`
  return new Date(timestamp).toLocaleDateString('vi-VN')
}

export const shortPath = (path: string, home?: string): string => {
  if (!home) return path
  const normalized = path.toLowerCase()
  const homeNormalized = home.toLowerCase()
  return normalized.startsWith(homeNormalized) ? `~${path.slice(home.length)}` : path
}

export const fileName = (path: string): string => path.split(/[\\/]/).pop() ?? path

export const dirName = (path: string): string => {
  const parts = path.split(/[\\/]/)
  parts.pop()
  return parts.join(path.includes('/') ? '/' : '\\')
}

export const baseName = (path: string): string => {
  const parts = path.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? path
}

export const languageOf = (ext: string): string => {
  const map: Record<string, string> = {
    ts: 'TypeScript',
    tsx: 'TypeScript React',
    js: 'JavaScript',
    jsx: 'JavaScript React',
    mjs: 'JavaScript',
    cjs: 'JavaScript',
    json: 'JSON',
    css: 'CSS',
    scss: 'SCSS',
    html: 'HTML',
    md: 'Markdown',
    yml: 'YAML',
    yaml: 'YAML',
    svg: 'SVG',
    py: 'Python',
    dart: 'Dart',
    go: 'Go',
    rs: 'Rust',
    cs: 'C#',
    cshtml: 'Razor (ASP.NET)',
    razor: 'Razor Component',
    sln: 'Visual Studio Solution',
    csproj: 'C# Project',
    fsproj: 'F# Project',
    vbproj: 'VB.NET Project',
    dockerfile: 'Dockerfile',
    config: 'XML Configuration',
    props: 'MSBuild Props',
    targets: 'MSBuild Targets',
    sql: 'SQL',
    sh: 'Shell',
    ps1: 'PowerShell',
    txt: 'Văn bản',
  }
  return map[ext.toLowerCase()] ?? (ext ? ext.toUpperCase() : 'Tệp')
}

export const kindOfScript = (name: string): 'dev' | 'build' | 'start' | 'test' | 'other' => {
  if (/^(dev|serve|develop|start:dev)$/i.test(name)) return 'dev'
  if (/^(build|compile)$/i.test(name)) return 'build'
  if (/^start$/i.test(name)) return 'start'
  if (/test/i.test(name)) return 'test'
  return 'other'
}

export const scriptLabel = (kind: string): string => {
  switch (kind) {
    case 'dev':
      return 'Phát triển'
    case 'build':
      return 'Đóng gói'
    case 'start':
      return 'Khởi động'
    case 'test':
      return 'Kiểm thử'
    default:
      return 'Khác'
  }
}

export const createId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
