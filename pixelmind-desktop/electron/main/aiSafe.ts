import { promises as fs } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'

/* Tiện ích an toàn đường dẫn dùng chung cho AI context, apply engine và tool layer.
   Mọi đường dẫn tương đối đều bị ép nằm trong thư mục dự án. */

const BLOCKED_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'bin',
  'obj',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.cache',
  '.turbo',
  'coverage',
  '.pixelmind',
  '.vscode',
  '.idea',
])

const BLOCKED_FILE =
  /(^|[\\/])(\.env(\..*)?|\.npmrc|\.pypirc|\.netrc|id_rsa|id_ed25519|.*\.(pem|key|pfx|p12|keystore|jks|snk))$/i

const TEXT_EXT = new Set([
  'cs',
  'cshtml',
  'razor',
  'html',
  'htm',
  'css',
  'scss',
  'sass',
  'less',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'ts',
  'tsx',
  'json',
  'md',
  'txt',
  'xml',
  'yml',
  'yaml',
  'svg',
  'csproj',
  'sln',
  'fs',
  'fsx',
  'py',
  'go',
  'rs',
  'java',
  'kt',
  'php',
  'rb',
  'vue',
  'svelte',
  'sql',
  'config',
  'props',
  'targets',
  'sh',
  'ps1',
  'bat',
  'cmd',
])

export const isInside = (root: string, target: string): boolean => {
  const rel = relative(resolve(root), resolve(target))
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

export const toPosix = (value: string): string => value.split(sep).join('/')

/** Chuyển đường dẫn tương đối do AI/người dùng nhập thành đường dẫn tuyệt đối an toàn. */
export function resolveProjectPath(root: string, relativePath: string): string {
  const clean = (relativePath ?? '').trim().replace(/^[/\\]+/, '')
  if (!clean) throw new Error('Đường dẫn rỗng.')
  if (isAbsolute(clean)) throw new Error('Chỉ chấp nhận đường dẫn tương đối trong dự án.')
  const full = resolve(root, clean)
  if (!isInside(root, full)) throw new Error('Đường dẫn nằm ngoài dự án — đã chặn.')
  const rel = toPosix(relative(resolve(root), full))
  if (isBlockedPath(rel)) throw new Error(`Tệp/thư mục bị chặn vì lý do an toàn: ${rel}`)
  return full
}

export function isBlockedPath(relativePath: string): boolean {
  const rel = toPosix(relativePath)
  if (BLOCKED_FILE.test(rel)) return true
  const parts = rel.split('/')
  return parts.some((part) => BLOCKED_DIRS.has(part.toLowerCase()))
}

export const isTextFile = (name: string): boolean => {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  return !ext || TEXT_EXT.has(ext)
}

export async function readTextFileSafe(
  root: string,
  relativePath: string,
  maxBytes = 256 * 1024,
): Promise<{ text: string; truncated: boolean; fullPath: string; rel: string }> {
  const fullPath = resolveProjectPath(root, relativePath)
  const stat = await fs.stat(fullPath)
  if (!stat.isFile()) throw new Error('Không phải tệp.')
  const handle = await fs.open(fullPath, 'r')
  try {
    const length = Math.min(stat.size, maxBytes)
    const buffer = Buffer.alloc(length)
    await handle.read(buffer, 0, length, 0)
    return {
      text: buffer.toString('utf8'),
      truncated: stat.size > maxBytes,
      fullPath,
      rel: toPosix(relative(resolve(root), fullPath)),
    }
  } finally {
    await handle.close()
  }
}
