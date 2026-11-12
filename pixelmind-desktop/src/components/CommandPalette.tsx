import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FileCode2,
  FileJson,
  FileText,
  FileType2,
  File as FileIcon,
  History,
  Image as ImageIcon,
  Search,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { FileNode } from '@shared/types'

export interface PaletteCommand {
  id: string
  label: string
  hint?: string
  keys?: string
  icon: LucideIcon
  disabled?: boolean
  run: () => void
}

export type PaletteEntry =
  | {
      kind: 'command'
      id: string
      label: string
      hint?: string
      keys?: string
      icon: LucideIcon
      disabled?: boolean
      run: () => void
    }
  | {
      kind: 'file'
      id: string
      path: string
      name: string
      relPath: string
      ext: string
      isRecent?: boolean
    }

interface CommandPaletteProps {
  commands: PaletteCommand[]
  recentPaths?: string[]
  treeNodes?: FileNode[]
  rootPath?: string
  onOpenFile?: (path: string) => void
  onClose: () => void
}

const iconForExt = (ext: string) => {
  if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'vue', 'svelte', 'astro'].includes(ext)) return FileCode2
  if (['json', 'jsonc', 'lock'].includes(ext)) return FileJson
  if (['css', 'scss', 'sass', 'less'].includes(ext)) return FileType2
  if (['md', 'markdown', 'txt'].includes(ext)) return FileText
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'avif'].includes(ext)) return ImageIcon
  return FileIcon
}

const flattenFiles = (
  nodes: FileNode[],
  root = '',
  out: Array<{ path: string; name: string; relPath: string; ext: string }> = [],
): Array<{ path: string; name: string; relPath: string; ext: string }> => {
  for (const n of nodes) {
    if (n.type === 'file') {
      const normRoot = root.replace(/\\/g, '/')
      const normPath = n.path.replace(/\\/g, '/')
      const rel = normRoot && normPath.startsWith(normRoot)
        ? normPath.slice(normRoot.length).replace(/^\//, '')
        : n.path
      out.push({ path: n.path, name: n.name, relPath: rel, ext: n.ext })
    } else if (n.children) {
      flattenFiles(n.children, root, out)
    }
  }
  return out
}

const CommandPalette = ({
  commands,
  recentPaths = [],
  treeNodes = [],
  rootPath = '',
  onOpenFile,
  onClose,
}: CommandPaletteProps) => {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const allFiles = useMemo(() => {
    if (!treeNodes || treeNodes.length === 0) return []
    return flattenFiles(treeNodes, rootPath)
  }, [treeNodes, rootPath])

  const filtered = useMemo<PaletteEntry[]>(() => {
    const raw = query.trim()
    const isCmdOnly = raw.startsWith('>')
    const q = (isCmdOnly ? raw.slice(1) : raw).trim().toLowerCase()

    // 1. Chỉ tìm lệnh nếu bắt đầu bằng '>'
    if (isCmdOnly) {
      const matchedCmds = q
        ? commands.filter((cmd) => [cmd.label, cmd.hint ?? ''].join(' ').toLowerCase().includes(q))
        : commands
      return matchedCmds.map((cmd) => ({ kind: 'command', ...cmd }))
    }

    // 2. Khi query rỗng: Hiển thị Recent Files trước, rồi tới Commands
    if (!q) {
      const results: PaletteEntry[] = []
      if (recentPaths && recentPaths.length > 0) {
        const rootNorm = (rootPath || '').replace(/\\/g, '/')
        for (const p of recentPaths.slice(0, 8)) {
          const name = p.split(/[\\/]/).pop() || p
          const ext = (name.split('.').pop() || '').toLowerCase()
          const normP = p.replace(/\\/g, '/')
          const rel = rootNorm && normP.startsWith(rootNorm)
            ? normP.slice(rootNorm.length).replace(/^\//, '')
            : p
          results.push({
            kind: 'file',
            id: `recent-${p}`,
            path: p,
            name,
            relPath: rel,
            ext,
            isRecent: true,
          })
        }
      }
      for (const cmd of commands) {
        results.push({ kind: 'command', ...cmd })
      }
      return results
    }

    // 3. Khi có query thông thường: Tìm kiếm cả Tệp lẫn Lệnh
    const results: PaletteEntry[] = []

    // Tìm trong files (Quick Open)
    const matchedFiles = allFiles
      .filter((f) => f.name.toLowerCase().includes(q) || f.relPath.toLowerCase().includes(q))
      .slice(0, 30)

    for (const f of matchedFiles) {
      results.push({
        kind: 'file',
        id: `file-${f.path}`,
        path: f.path,
        name: f.name,
        relPath: f.relPath,
        ext: f.ext,
      })
    }

    // Tìm trong commands
    const matchedCmds = commands.filter((cmd) =>
      [cmd.label, cmd.hint ?? ''].join(' ').toLowerCase().includes(q),
    )
    for (const cmd of matchedCmds) {
      results.push({ kind: 'command', ...cmd })
    }

    return results
  }, [commands, query, allFiles, recentPaths, rootPath])

  useEffect(() => {
    setIndex(0)
  }, [query])

  const exec = (item: PaletteEntry | undefined) => {
    if (!item) return
    onClose()
    if (item.kind === 'file') {
      onOpenFile?.(item.path)
    } else if (item.kind === 'command') {
      if (item.disabled) return
      item.run()
    }
  }

  return (
    <div className="pm-overlay" style={{ alignItems: 'flex-start' }} onMouseDown={onClose}>
      <div
        className="pm-palette"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="Bảng lệnh & Mở tệp nhanh"
      >
        <div className="pm-palette__input">
          <Search size={15} />
          <input
            ref={inputRef}
            value={query}
            placeholder="Tìm tệp hoặc lệnh… (gõ > để lọc lệnh)"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setIndex((i) => Math.min(i + 1, filtered.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setIndex((i) => Math.max(i - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                exec(filtered[index])
              } else if (e.key === 'Escape') {
                e.preventDefault()
                onClose()
              }
              e.stopPropagation()
            }}
          />
          <span className="pm-kbd">Esc</span>
        </div>

        <div className="pm-palette__list">
          {filtered.length === 0 ? (
            <div className="pm-palette__empty">Không có tệp hoặc lệnh phù hợp.</div>
          ) : (
            filtered.map((item, i) => {
              if (item.kind === 'file') {
                const Icon = item.isRecent ? History : iconForExt(item.ext)
                return (
                  <button
                    key={item.id}
                    className={`pm-palette__item ${i === index ? 'on' : ''}`}
                    onMouseEnter={() => setIndex(i)}
                    onClick={() => exec(item)}
                  >
                    <Icon size={13} style={{ color: item.isRecent ? 'var(--accent)' : 'var(--text-2)' }} />
                    <span className="grow" style={{ fontWeight: 500 }}>
                      {item.name}
                    </span>
                    <small style={{ opacity: 0.65 }}>{item.relPath}</small>
                    {item.isRecent && (
                      <span className="pm-kbd" style={{ fontSize: 9, opacity: 0.8 }}>
                        Gần đây
                      </span>
                    )}
                  </button>
                )
              }
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  className={`pm-palette__item ${i === index ? 'on' : ''}`}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => exec(item)}
                  disabled={item.disabled}
                  style={item.disabled ? { opacity: 0.45 } : undefined}
                >
                  <Icon size={13} />
                  <span className="grow">{item.label}</span>
                  {item.hint && <small>{item.hint}</small>}
                  {item.keys && <span className="pm-kbd">{item.keys}</span>}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

export default CommandPalette
