import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface PaletteCommand {
  id: string
  label: string
  hint?: string
  keys?: string
  icon: LucideIcon
  disabled?: boolean
  run: () => void
}

interface CommandPaletteProps {
  commands: PaletteCommand[]
  onClose: () => void
}

const CommandPalette = ({ commands, onClose }: CommandPaletteProps) => {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((cmd) =>
      [cmd.label, cmd.hint ?? ''].join(' ').toLowerCase().includes(q),
    )
  }, [commands, query])

  useEffect(() => {
    setIndex(0)
  }, [query])

  const exec = (cmd: PaletteCommand | undefined) => {
    if (!cmd || cmd.disabled) return
    onClose()
    cmd.run()
  }

  return (
    <div className="pm-overlay" style={{ alignItems: 'flex-start' }} onMouseDown={onClose}>
      <div
        className="pm-palette"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="Bảng lệnh"
      >
        <div className="pm-palette__input">
          <Search size={15} />
          <input
            ref={inputRef}
            value={query}
            placeholder="Nhập lệnh hoặc tên dự án…"
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
            <div className="pm-palette__empty">Không có lệnh phù hợp.</div>
          ) : (
            filtered.map((cmd, i) => {
              const Icon = cmd.icon
              return (
                <button
                  key={cmd.id}
                  className={`pm-palette__item ${i === index ? 'on' : ''}`}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => exec(cmd)}
                  disabled={cmd.disabled}
                  style={cmd.disabled ? { opacity: 0.45 } : undefined}
                >
                  <Icon size={13} />
                  <span className="grow">{cmd.label}</span>
                  {cmd.hint && <small>{cmd.hint}</small>}
                  {cmd.keys && <span className="pm-kbd">{cmd.keys}</span>}
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
