import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FileCode2,
  FileJson,
  FileText,
  FileType2,
  File as FileIcon,
  History,
  Image as ImageIcon,
  Loader2,
  Search,
  TriangleAlert,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { FileNode } from '@shared/types'
import type { FileSearchMatch } from '../../shared/api'
import { parsePaletteQuery } from '../../shared/search'
import { api } from '../lib/bridge'

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
  | {
      kind: 'content'
      id: string
      match: FileSearchMatch
    }

interface CommandPaletteProps {
  commands: PaletteCommand[]
  recentPaths?: string[]
  treeNodes?: FileNode[]
  rootPath?: string
  onOpenFile?: (path: string) => void
  /** Mở đúng vị trí đoạn khớp tìm được trong nội dung dự án. */
  onOpenContentMatch?: (match: FileSearchMatch) => void
  onClose: () => void
}

/** Số kết quả tối đa khi tìm nội dung từ palette. */
const CONTENT_RESULT_LIMIT = 40

/** Tô sáng đoạn khớp trong dòng preview của kết quả tìm kiếm. */
const renderMatchPreview = (match: FileSearchMatch) => {
  const { preview, previewMatchStart: start, previewMatchEnd: end } = match
  if (typeof start !== 'number' || typeof end !== 'number' || end <= start) return preview
  const from = Math.max(0, Math.min(preview.length, start))
  const to = Math.max(from, Math.min(preview.length, end))
  if (from === to) return preview
  return (
    <>
      {preview.slice(0, from)}
      <mark className="pm-search-hit">{preview.slice(from, to)}</mark>
      {preview.slice(to)}
    </>
  )
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
  onOpenContentMatch,
  onClose,
}: CommandPaletteProps) => {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const [contentResults, setContentResults] = useState<FileSearchMatch[]>([])
  const [contentLoading, setContentLoading] = useState(false)
  const [contentError, setContentError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const contentRequestRef = useRef(0)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const allFiles = useMemo(() => {
    if (!treeNodes || treeNodes.length === 0) return []
    return flattenFiles(treeNodes, rootPath)
  }, [treeNodes, rootPath])

  const parsed = parsePaletteQuery(query)
  const isCmdOnly = parsed.mode === 'command'
  const isContentMode = parsed.mode === 'content'
  const term = parsed.term
  const contentTerm = isContentMode ? term : ''

  /* Tìm nội dung toàn dự án khi query bắt đầu bằng '?' (debounce 220ms). */
  useEffect(() => {
    if (!isContentMode || !contentTerm || !rootPath) {
      // Vô hiệu hoá phản hồi đang bay để không hiện kết quả của truy vấn cũ.
      contentRequestRef.current++
      setContentResults([])
      setContentLoading(false)
      setContentError(null)
      return
    }
    const requestId = ++contentRequestRef.current
    setContentLoading(true)
    setContentError(null)
    const timer = window.setTimeout(() => {
      api.fs
        .search(rootPath, contentTerm, { maxResults: CONTENT_RESULT_LIMIT })
        .then((results) => {
          if (contentRequestRef.current !== requestId) return
          setContentResults(results)
          setContentError(null)
        })
        .catch((error: unknown) => {
          if (contentRequestRef.current !== requestId) return
          setContentResults([])
          setContentError(error instanceof Error ? error.message : 'Không tìm kiếm được nội dung dự án.')
        })
        .finally(() => {
          if (contentRequestRef.current === requestId) setContentLoading(false)
        })
    }, 220)
    return () => {
      window.clearTimeout(timer)
      // Vô hiệu hoá phản hồi cũ nếu truy vấn đã đổi.
      contentRequestRef.current++
    }
  }, [isContentMode, contentTerm, rootPath])

  const filtered = useMemo<PaletteEntry[]>(() => {
    // 1. '?' → tìm nội dung toàn dự án
    if (isContentMode) {
      if (!contentTerm) return []
      return contentResults.map((match) => ({
        kind: 'content',
        id: `content-${match.file}:${match.line}:${match.matchStart ?? 0}`,
        match,
      }))
    }

    const q = term.toLowerCase()

    // 2. Chỉ tìm lệnh nếu bắt đầu bằng '>'
    if (isCmdOnly) {
      const matchedCmds = q
        ? commands.filter((cmd) => [cmd.label, cmd.hint ?? ''].join(' ').toLowerCase().includes(q))
        : commands
      return matchedCmds.map((cmd) => ({ kind: 'command', ...cmd }))
    }

    // 3. Khi query rỗng: Hiển thị Recent Files trước, rồi tới Commands
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

    // 4. Khi có query thông thường: Tìm kiếm cả Tệp lẫn Lệnh
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
  }, [commands, allFiles, recentPaths, rootPath, isContentMode, isCmdOnly, term, contentTerm, contentResults])

  useEffect(() => {
    setIndex(0)
  }, [query])

  // Giữ con trỏ chọn trong phạm vi danh sách khi kết quả co lại (đang tải/đổi truy vấn).
  useEffect(() => {
    setIndex((current) => Math.min(current, Math.max(0, filtered.length - 1)))
  }, [filtered.length])

  const exec = (item: PaletteEntry | undefined) => {
    if (!item) return
    onClose()
    if (item.kind === 'file') {
      onOpenFile?.(item.path)
    } else if (item.kind === 'content') {
      if (onOpenContentMatch) onOpenContentMatch(item.match)
      else onOpenFile?.(item.match.fullPath)
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
            placeholder="Tìm tệp hoặc lệnh… (gõ > lệnh, ? tìm trong nội dung)"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setIndex((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)))
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

        {isContentMode && (
          <div className="pm-palette__hint">
            {contentError ? (
              <>
                <TriangleAlert size={11} />
                <span>{contentError}</span>
              </>
            ) : contentLoading ? (
              <>
                <Loader2 size={11} className="spin" />
                <span>Đang tìm “{contentTerm}” trong nội dung dự án…</span>
              </>
            ) : !rootPath ? (
              <>
                <TriangleAlert size={11} />
                <span>Chưa mở dự án nào để tìm trong nội dung.</span>
              </>
            ) : !contentTerm ? (
              <>
                <Search size={11} />
                <span>
                  Nhập đoạn mã cần tìm sau dấu <b>?</b> — ví dụ <code>?onClick=</code>, <code>?TODO</code>
                </span>
              </>
            ) : (
              <>
                <Search size={11} />
                <span>
                  {contentResults.length}
                  {contentResults.length >= CONTENT_RESULT_LIMIT ? '+' : ''} kết quả cho “{contentTerm}” — ↑↓ chọn,
                  Enter để mở đúng dòng
                </span>
              </>
            )}
          </div>
        )}

        <div className="pm-palette__list">
          {filtered.length === 0 ? (
            isContentMode ? (
              contentLoading ? (
                <div className="pm-palette__empty">
                  <span className="pm-row" style={{ gap: 8, justifyContent: 'center' }}>
                    <Loader2 size={13} className="spin" /> Đang tìm trong nội dung dự án…
                  </span>
                </div>
              ) : contentError ? (
                <div className="pm-palette__empty" style={{ color: 'var(--color-danger-text, #f87171)' }}>
                  <span className="pm-row" style={{ gap: 8, justifyContent: 'center' }}>
                    <TriangleAlert size={13} /> {contentError}
                  </span>
                </div>
              ) : !rootPath ? (
                <div className="pm-palette__empty">Mở một dự án trước để tìm trong nội dung.</div>
              ) : !contentTerm ? (
                <div className="pm-palette__empty">Kết quả sẽ hiện ở đây kèm tên tệp và số dòng.</div>
              ) : (
                <div className="pm-palette__empty">Không tìm thấy “{contentTerm}” trong nội dung dự án.</div>
              )
            ) : (
              <div className="pm-palette__empty">Không có tệp hoặc lệnh phù hợp.</div>
            )
          ) : (
            filtered.map((item, i) => {
              if (item.kind === 'content') {
                const match = item.match
                const name = match.file.split('/').pop() || match.file
                return (
                  <button
                    key={item.id}
                    className={`pm-palette__item pm-palette__item--content ${i === index ? 'on' : ''}`}
                    onMouseEnter={() => setIndex(i)}
                    onClick={() => exec(item)}
                    title={`${match.file}:${match.line}`}
                  >
                    <FileCode2 size={13} />
                    <span className="pm-palette__content">
                      <span className="pm-palette__content-hd">
                        <span className="pm-palette__content-name">{name}</span>
                        <small>
                          {match.file}:{match.line}
                        </small>
                      </span>
                      <span className="pm-palette__content-code">{renderMatchPreview(match)}</span>
                    </span>
                  </button>
                )
              }
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

        {!isContentMode && (
          <div className="pm-palette__foot">
            <span className="pm-kbd">?</span>
            <span>tìm trong nội dung dự án</span>
            <span className="pm-kbd">&gt;</span>
            <span>chỉ tìm lệnh</span>
            <span className="pm-kbd">Enter</span>
            <span>mở mục đang chọn</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default CommandPalette
