import { useEffect, useMemo, useState } from 'react'
import {
  ChevronRight,
  File as FileIcon,
  FileCode2,
  FileJson,
  FileText,
  FileType2,
  Folder,
  FolderOpen,
  Image as ImageIcon,
} from 'lucide-react'
import type { FileNode } from '@shared/types'

interface FileTreeProps {
  nodes: FileNode[]
  rootPath: string
  selectedPath: string | null
  query: string
  onSelect: (node: FileNode) => void
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

const FileTree = ({ nodes, rootPath, selectedPath, query, onSelect }: FileTreeProps) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set([rootPath]))

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

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return collectFiles(nodes).filter((file) => file.path.toLowerCase().includes(q)).slice(0, 300)
  }, [nodes, query])

  if (matches) {
    if (!matches.length) {
      return <div className="pm-hint" style={{ padding: '12px 12px' }}>Không có tệp nào khớp “{query}”.</div>
    }
    return (
      <div className="pm-tree">
        {matches.map((file) => {
          const Icon = iconFor(file.ext)
          const rel = file.path.slice(rootPath.length + 1)
          return (
            <button
              key={file.path}
              className={`pm-tree__row ${selectedPath === file.path ? 'on' : ''}`}
              style={{ paddingLeft: 10 }}
              onClick={() => onSelect(file)}
              title={rel}
            >
              <Icon size={13} className="ico" />
              <span className="nm">{file.name}</span>
              <span className="pm-muted pm-truncate" style={{ fontSize: 10, marginLeft: 'auto', paddingLeft: 8 }}>
                {rel}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  const renderNodes = (list: FileNode[], depth: number) => (
    <div className="pm-tree__children" role={depth === 0 ? 'tree' : 'group'}>
      {list.map((node) => {
        const isDir = node.type === 'dir'
        const isOpen = expanded.has(node.path)
        const Icon = isDir ? (isOpen ? FolderOpen : Folder) : iconFor(node.ext)
        return (
          <div key={node.path}>
            <button
              className={`pm-tree__row ${selectedPath === node.path ? 'on' : ''}`}
              style={{ paddingLeft: 8 + depth * 12 }}
              onClick={() => (isDir ? toggle(node.path) : onSelect(node))}
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

  if (!nodes.length) {
    return (
      <div className="pm-hint" style={{ padding: '14px 12px', lineHeight: 1.7 }}>
        Thư mục trống hoặc không đọc được.
        <br />
        Hãy kiểm tra lại đường dẫn dự án.
      </div>
    )
  }

  return <div className="pm-tree">{renderNodes(nodes, 0)}</div>
}

export default FileTree
