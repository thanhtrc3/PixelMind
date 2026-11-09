import { useEffect, useMemo, useState } from 'react'
import {
  ChevronRight,
  Copy,
  ExternalLink,
  File as FileIcon,
  FileCode2,
  FileJson,
  FilePlus2,
  FileText,
  FileType2,
  Folder,
  FolderOpen,
  FolderPlus,
  Image as ImageIcon,
  Pencil,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import type { FileNode } from '@shared/types'
import { api } from '../lib/bridge'
import FileActionDialog, { type FileActionKind } from './FileActionDialog'

interface FileTreeProps {
  nodes: FileNode[]
  rootPath: string
  selectedPath: string | null
  query: string
  onSelect: (node: FileNode) => void
  onRefresh?: () => void
  onShowToast?: (kind: 'ok' | 'err' | 'info', text: string) => void
}

const iconFor = (ext: string) => {
  if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'vue', 'svelte', 'astro'].includes(ext)) return FileCode2
  if (['json', 'jsonc', 'lock'].includes(ext)) return FileJson
  if (['css', 'scss', 'sass', 'less'].includes(ext)) return FileType2
  if (['md', 'markdown', 'txt'].includes(ext)) return FileText
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'avif'].includes(ext)) return ImageIcon
  return FileIcon
}

const collectFiles = (nodes: FileNode[], out: FileNode[] = []): FileNode[] => {
  for (const node of nodes) {
    if (node.type === 'file') out.push(node)
    else if (node.children) collectFiles(node.children, out)
  }
  return out
}

const normalizeSlash = (p: string) => p.replace(/\\/g, '/')

const FileTree = ({
  nodes,
  rootPath,
  selectedPath,
  query,
  onSelect,
  onRefresh,
  onShowToast,
}: FileTreeProps) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set([rootPath]))
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: FileNode | null } | null>(null)
  const [activeDialog, setActiveDialog] = useState<{ action: FileActionKind; node: FileNode | null } | null>(null)
  const [focusedNode, setFocusedNode] = useState<FileNode | null>(null)

  /* Tự mở các thư mục cha của tệp đang chọn */
  useEffect(() => {
    if (!selectedPath) return
    setExpanded((prev) => {
      const next = new Set(prev)
      const walk = (list: FileNode[], ancestors: string[]) => {
        for (const node of list) {
          if (node.type !== 'dir') continue
          if (selectedPath.startsWith(node.path)) {
            next.add(node.path)
            walk(node.children ?? [], [...ancestors, node.path])
          }
        }
      }
      walk(nodes, [])
      return next
    })
  }, [selectedPath, nodes])

  /* Đóng context menu khi click ra ngoài hoặc cuộn */
  useEffect(() => {
    if (!contextMenu) return
    const dismiss = () => setContextMenu(null)
    window.addEventListener('click', dismiss)
    window.addEventListener('contextmenu', dismiss)
    window.addEventListener('wheel', dismiss, { passive: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('click', dismiss)
      window.removeEventListener('contextmenu', dismiss)
      window.removeEventListener('wheel', dismiss)
      window.removeEventListener('keydown', onKey)
    }
  }, [contextMenu])

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  const copyPath = (path: string, isRelative = false) => {
    let textToCopy = path
    if (isRelative) {
      const root = normalizeSlash(rootPath)
      const clean = normalizeSlash(path)
      textToCopy = clean.startsWith(root) ? clean.slice(root.length).replace(/^\//, '') : clean
    }
    void navigator.clipboard.writeText(textToCopy)
    onShowToast?.('ok', isRelative ? `Đã sao chép đường dẫn tương đối: ${textToCopy}` : `Đã sao chép đường dẫn: ${textToCopy}`)
  }

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return collectFiles(nodes).filter((file) => file.path.toLowerCase().includes(q)).slice(0, 300)
  }, [nodes, query])

  const handleRowContextMenu = (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault()
    e.stopPropagation()
    setFocusedNode(node)
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      node,
    })
  }

  const handleTreeBackgroundContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      node: null,
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!focusedNode) return
    if (e.key === 'F2') {
      e.preventDefault()
      setActiveDialog({ action: 'rename', node: focusedNode })
    } else if (e.key === 'Delete') {
      e.preventDefault()
      setActiveDialog({ action: 'delete', node: focusedNode })
    }
  }

  const renderNodes = (list: FileNode[], depth: number) => (
    <div className="pm-tree__children" role={depth === 0 ? 'tree' : 'group'}>
      {list.map((node) => {
        const isDir = node.type === 'dir'
        const isOpen = expanded.has(node.path)
        const Icon = isDir ? (isOpen ? FolderOpen : Folder) : iconFor(node.ext)
        const isSelected = selectedPath === node.path

        return (
          <div key={node.path}>
            <button
              className={`pm-tree__row ${isSelected ? 'on' : ''}`}
              style={{ paddingLeft: 8 + depth * 12 }}
              onClick={() => {
                setFocusedNode(node)
                if (isDir) toggle(node.path)
                else onSelect(node)
              }}
              onContextMenu={(e) => handleRowContextMenu(e, node)}
              title={node.path}
            >
              <span className={`chev ${isOpen ? 'open' : ''}`}>
                {isDir ? <ChevronRight size={11} /> : null}
              </span>
              <Icon size={13} className="ico" />
              <span className="nm">{node.name}</span>
            </button>
            {isDir && isOpen && node.children && renderNodes(node.children, depth + 1)}
          </div>
        )
      })}
    </div>
  )

  return (
    <div
      className="pm-tree-container"
      style={{ minHeight: '100%', position: 'relative', outline: 'none' }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onContextMenu={handleTreeBackgroundContextMenu}
    >
      {matches ? (
        !matches.length ? (
          <div className="pm-hint" style={{ padding: '12px 12px' }}>Không có tệp nào khớp “{query}”.</div>
        ) : (
          <div className="pm-tree">
            {matches.map((file) => {
              const Icon = iconFor(file.ext)
              const rel = file.path.slice(rootPath.length + 1)
              return (
                <button
                  key={file.path}
                  className={`pm-tree__row ${selectedPath === file.path ? 'on' : ''}`}
                  style={{ paddingLeft: 10 }}
                  onClick={() => {
                    setFocusedNode(file)
                    onSelect(file)
                  }}
                  onContextMenu={(e) => handleRowContextMenu(e, file)}
                  title={rel}
                >
                  <Icon size={13} className="ico" />
                  <span className="nm" style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </span>
                </button>
              )
            })}
          </div>
        )
      ) : !nodes.length ? (
        <div className="pm-hint" style={{ padding: '14px 12px', lineHeight: 1.7 }}>
          Thư mục trống hoặc không đọc được.
          <br />
          Nhấp chuột phải để tạo tệp hoặc thư mục mới.
        </div>
      ) : (
        <div className="pm-tree">{renderNodes(nodes, 0)}</div>
      )}

      {/* ── CONTEXT MENU CHUẨN IDE (VS CODE STYLE) ── */}
      {contextMenu && (
        <div
          className="pm-file-context-menu"
          style={{
            left: Math.min(window.innerWidth - 240, contextMenu.x),
            top: Math.min(window.innerHeight - 320, contextMenu.y),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.node?.type === 'file' ? (
            <>
              <button
                className="pm-file-context-menu__item"
                onClick={() => {
                  onSelect(contextMenu.node!)
                  setContextMenu(null)
                }}
              >
                <FileText size={13} />
                <span>Mở tệp</span>
                <span className="pm-file-context-menu__shortcut">Enter</span>
              </button>
              <button
                className="pm-file-context-menu__item"
                onClick={() => {
                  void api.fs.showInFolder(contextMenu.node!.path)
                  setContextMenu(null)
                }}
              >
                <ExternalLink size={13} />
                <span>Mở trong File Explorer</span>
                <span className="pm-file-context-menu__shortcut">Shift+Alt+R</span>
              </button>

              <div className="pm-file-context-menu__divider" />

              <button
                className="pm-file-context-menu__item"
                onClick={() => {
                  setActiveDialog({ action: 'new-file', node: contextMenu.node })
                  setContextMenu(null)
                }}
              >
                <FilePlus2 size={13} />
                <span>Tạo tệp mới...</span>
              </button>
              <button
                className="pm-file-context-menu__item"
                onClick={() => {
                  setActiveDialog({ action: 'new-folder', node: contextMenu.node })
                  setContextMenu(null)
                }}
              >
                <FolderPlus size={13} />
                <span>Tạo thư mục mới...</span>
              </button>

              <div className="pm-file-context-menu__divider" />

              <button
                className="pm-file-context-menu__item"
                onClick={() => {
                  copyPath(contextMenu.node!.path, false)
                  setContextMenu(null)
                }}
              >
                <Copy size={13} />
                <span>Sao chép đường dẫn</span>
                <span className="pm-file-context-menu__shortcut">Shift+Alt+C</span>
              </button>
              <button
                className="pm-file-context-menu__item"
                onClick={() => {
                  copyPath(contextMenu.node!.path, true)
                  setContextMenu(null)
                }}
              >
                <Copy size={13} />
                <span>Sao chép đường dẫn tương đối</span>
              </button>

              <div className="pm-file-context-menu__divider" />

              <button
                className="pm-file-context-menu__item"
                onClick={() => {
                  setActiveDialog({ action: 'rename', node: contextMenu.node })
                  setContextMenu(null)
                }}
              >
                <Pencil size={13} />
                <span>Đổi tên...</span>
                <span className="pm-file-context-menu__shortcut">F2</span>
              </button>
              <button
                className="pm-file-context-menu__item pm-file-context-menu__item--danger"
                onClick={() => {
                  setActiveDialog({ action: 'delete', node: contextMenu.node })
                  setContextMenu(null)
                }}
              >
                <Trash2 size={13} />
                <span>Xoá vào Thùng rác</span>
                <span className="pm-file-context-menu__shortcut">Del</span>
              </button>
            </>
          ) : contextMenu.node?.type === 'dir' ? (
            <>
              <button
                className="pm-file-context-menu__item"
                onClick={() => {
                  void api.fs.showInFolder(contextMenu.node!.path)
                  setContextMenu(null)
                }}
              >
                <ExternalLink size={13} />
                <span>Mở trong File Explorer</span>
                <span className="pm-file-context-menu__shortcut">Shift+Alt+R</span>
              </button>

              <div className="pm-file-context-menu__divider" />

              <button
                className="pm-file-context-menu__item"
                onClick={() => {
                  setActiveDialog({ action: 'new-file', node: contextMenu.node })
                  setContextMenu(null)
                }}
              >
                <FilePlus2 size={13} />
                <span>Tạo tệp mới tại đây...</span>
              </button>
              <button
                className="pm-file-context-menu__item"
                onClick={() => {
                  setActiveDialog({ action: 'new-folder', node: contextMenu.node })
                  setContextMenu(null)
                }}
              >
                <FolderPlus size={13} />
                <span>Tạo thư mục mới tại đây...</span>
              </button>

              <div className="pm-file-context-menu__divider" />

              <button
                className="pm-file-context-menu__item"
                onClick={() => {
                  copyPath(contextMenu.node!.path, false)
                  setContextMenu(null)
                }}
              >
                <Copy size={13} />
                <span>Sao chép đường dẫn</span>
                <span className="pm-file-context-menu__shortcut">Shift+Alt+C</span>
              </button>
              <button
                className="pm-file-context-menu__item"
                onClick={() => {
                  copyPath(contextMenu.node!.path, true)
                  setContextMenu(null)
                }}
              >
                <Copy size={13} />
                <span>Sao chép đường dẫn tương đối</span>
              </button>

              <div className="pm-file-context-menu__divider" />

              <button
                className="pm-file-context-menu__item"
                onClick={() => {
                  setActiveDialog({ action: 'rename', node: contextMenu.node })
                  setContextMenu(null)
                }}
              >
                <Pencil size={13} />
                <span>Đổi tên...</span>
                <span className="pm-file-context-menu__shortcut">F2</span>
              </button>
              <button
                className="pm-file-context-menu__item pm-file-context-menu__item--danger"
                onClick={() => {
                  setActiveDialog({ action: 'delete', node: contextMenu.node })
                  setContextMenu(null)
                }}
              >
                <Trash2 size={13} />
                <span>Xoá vào Thùng rác</span>
                <span className="pm-file-context-menu__shortcut">Del</span>
              </button>
            </>
          ) : (
            // Click chuột phải vào khoảng trống
            <>
              <button
                className="pm-file-context-menu__item"
                onClick={() => {
                  setActiveDialog({ action: 'new-file', node: null })
                  setContextMenu(null)
                }}
              >
                <FilePlus2 size={13} />
                <span>Tạo tệp mới ở thư mục gốc</span>
              </button>
              <button
                className="pm-file-context-menu__item"
                onClick={() => {
                  setActiveDialog({ action: 'new-folder', node: null })
                  setContextMenu(null)
                }}
              >
                <FolderPlus size={13} />
                <span>Tạo thư mục mới ở thư mục gốc</span>
              </button>

              <div className="pm-file-context-menu__divider" />

              <button
                className="pm-file-context-menu__item"
                onClick={() => {
                  void api.fs.openPath(rootPath)
                  setContextMenu(null)
                }}
              >
                <ExternalLink size={13} />
                <span>Mở thư mục dự án trong Explorer</span>
              </button>
              <button
                className="pm-file-context-menu__item"
                onClick={() => {
                  onRefresh?.()
                  setContextMenu(null)
                }}
              >
                <RefreshCw size={13} />
                <span>Tải lại cây tệp</span>
                <span className="pm-file-context-menu__shortcut">Ctrl+R</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* ── DIALOG THAO TÁC TỆP / THƯ MỤC ── */}
      {activeDialog && (
        <FileActionDialog
          action={activeDialog.action}
          targetNode={activeDialog.node}
          rootPath={rootPath}
          onClose={() => setActiveDialog(null)}
          onSuccess={(msg) => onShowToast?.('ok', msg)}
          onRefresh={() => onRefresh?.()}
        />
      )}
    </div>
  )
}

export default FileTree
