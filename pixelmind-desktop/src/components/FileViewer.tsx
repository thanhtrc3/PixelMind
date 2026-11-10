import { useEffect, useMemo, useRef, useState } from 'react'
import Editor, { loader, type OnMount } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  FileCode2,
  FolderOpen,
  Loader2,
  Save,
  Sparkles,
  WrapText,
} from 'lucide-react'
import type { FileContent } from '@shared/types'
import { formatBytes, languageOf } from '../lib/format'
import { api } from '../lib/bridge'

// Cấu hình loader dùng monaco-editor cục bộ (không cần tải từ CDN bên ngoài)
loader.config({ monaco })

interface FileViewerProps {
  file: FileContent | null
  loading: boolean
  onOpenExternal: (path: string) => void
  onShowInFolder: (path: string) => void
  onShowToast?: (kind: 'ok' | 'err' | 'info', text: string) => void
}

/** Chuyển đổi đuôi file sang định danh ngôn ngữ chuẩn của Monaco */
const getMonacoLanguage = (ext: string): string => {
  const e = (ext || '').toLowerCase().replace(/^\./, '')
  const map: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    json: 'json',
    jsonc: 'json',
    md: 'markdown',
    markdown: 'markdown',
    py: 'python',
    pyw: 'python',
    rs: 'rust',
    go: 'go',
    c: 'c',
    cpp: 'cpp',
    h: 'cpp',
    hpp: 'cpp',
    cs: 'csharp',
    java: 'java',
    kt: 'kotlin',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    ps1: 'powershell',
    bat: 'bat',
    cmd: 'bat',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    svg: 'xml',
    ini: 'ini',
    dockerfile: 'dockerfile',
    graphql: 'graphql',
    gql: 'graphql',
  }
  return map[e] || 'plaintext'
}

const FileViewer = ({
  file,
  loading,
  onOpenExternal,
  onShowInFolder,
  onShowToast,
}: FileViewerProps) => {
  const [code, setCode] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [wordWrap, setWordWrap] = useState<'on' | 'off'>('on')
  const [theme, setTheme] = useState<'vs-dark' | 'vs'>('vs-dark')
  const [cursorPos, setCursorPos] = useState({ ln: 1, col: 1, selected: 0 })

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const monacoInstanceRef = useRef<typeof monaco | null>(null)
  const handleSaveRef = useRef<() => Promise<void>>(async () => {})

  // Theo dõi theme của PixelMind qua data-theme trên thẻ html
  useEffect(() => {
    const updateTheme = () => {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light'
      setTheme(isLight ? 'vs' : 'vs-dark')
    }
    updateTheme()
    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  // Đồng bộ nội dung khi chuyển sang file khác
  useEffect(() => {
    if (file && !file.binary) {
      setCode(file.text || '')
      setIsDirty(false)
    } else {
      setCode('')
      setIsDirty(false)
    }
    setCursorPos({ ln: 1, col: 1, selected: 0 })
  }, [file?.path, file?.text, file?.binary])

  // Lưu file thật sự xuống đĩa (Ctrl+S / nút Lưu)
  const handleSave = async () => {
    if (!file || saving) return
    setSaving(true)
    try {
      // Lấy nội dung mới nhất từ editor nếu có
      const currentCode = editorRef.current ? editorRef.current.getValue() : code
      await api.fs.write(file.path, currentCode)
      file.text = currentCode
      setCode(currentCode)
      setIsDirty(false)
      onShowToast?.('ok', `Đã lưu tệp ${file.name} xuống đĩa thành công!`)
    } catch (err: any) {
      onShowToast?.('err', `Lỗi khi lưu tệp: ${err?.message || ''}`)
    } finally {
      setSaving(false)
    }
  }

  // Cập nhật ref để phím tắt trong monaco luôn gọi phiên bản mới nhất của handleSave
  handleSaveRef.current = handleSave

  // Định dạng mã nguồn (Format Document)
  const handleFormat = async () => {
    if (!editorRef.current) return
    try {
      const action = editorRef.current.getAction('editor.action.formatDocument')
      if (action) {
        await action.run()
        onShowToast?.('ok', 'Đã định dạng mã nguồn')
      } else {
        onShowToast?.('info', 'Định dạng mã nguồn không khả dụng cho ngôn ngữ này')
      }
    } catch (err: any) {
      onShowToast?.('err', `Lỗi khi định dạng: ${err?.message || ''}`)
    }
  }

  const handleCopy = async () => {
    if (!file) return
    try {
      const currentCode = editorRef.current ? editorRef.current.getValue() : code
      await navigator.clipboard.writeText(currentCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
      onShowToast?.('ok', 'Đã sao chép mã vào khay nhớ tạm')
    } catch {
      setCopied(false)
    }
  }

  // Callback khi Monaco editor được mount
  const handleEditorDidMount: OnMount = (editor, m) => {
    editorRef.current = editor
    monacoInstanceRef.current = m

    // Đăng ký phím tắt Ctrl+S / Cmd+S
    editor.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.KeyS, () => {
      void handleSaveRef.current()
    })

    // Đăng ký phím tắt Format Alt+Shift+F
    editor.addCommand(m.KeyMod.Alt | m.KeyMod.Shift | m.KeyCode.KeyF, () => {
      void editor.getAction('editor.action.formatDocument')?.run()
    })

    // Lắng nghe thay đổi vị trí con trỏ và vùng bôi đen
    editor.onDidChangeCursorPosition((e) => {
      const selection = editor.getSelection()
      let selectedLen = 0
      if (selection && !selection.isEmpty()) {
        const model = editor.getModel()
        if (model) {
          selectedLen = model.getValueInRange(selection).length
        }
      }
      setCursorPos({
        ln: e.position.lineNumber,
        col: e.position.column,
        selected: selectedLen,
      })
    })

    editor.onDidChangeCursorSelection(() => {
      const selection = editor.getSelection()
      if (selection) {
        const model = editor.getModel()
        const selectedLen = model && !selection.isEmpty() ? model.getValueInRange(selection).length : 0
        setCursorPos((prev) => ({ ...prev, selected: selectedLen }))
      }
    })
  }

  const monacoLang = useMemo(() => {
    return file ? getMonacoLanguage(file.ext) : 'plaintext'
  }, [file?.ext])

  if (loading) {
    return (
      <div className="pm-viewer" style={{ display: 'grid', placeItems: 'center' }}>
        <span className="pm-row pm-muted" style={{ gap: 8 }}>
          <Loader2 size={14} className="spin" /> Đang đọc tệp…
        </span>
      </div>
    )
  }

  if (!file) {
    return (
      <div className="pm-viewer" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="pm-empty" style={{ border: 0, background: 'transparent', padding: 32 }}>
          <div className="pm-empty__ico">
            <FileCode2 size={20} />
          </div>
          <h3>Chọn một tệp để sửa</h3>
          <p>Nhấp vào tệp trong cây thư mục bên trái để xem và sửa mã nguồn bằng trình soạn thảo Monaco.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="pm-viewer" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ── HEADER THANH CÔNG CỤ TỆP ── */}
      <div className="pm-viewer__hd">
        <FileCode2 size={13} style={{ flexShrink: 0, color: 'var(--accent)' }} />
        <span className="path" title={file.path}>
          {file.path}
        </span>

        {isDirty ? (
          <span className="pm-viewer__dirty-badge" title="Tệp đã chỉnh sửa, bấm Ctrl+S để lưu">
            ● Chưa lưu
          </span>
        ) : (
          <span
            style={{
              fontSize: 10,
              color: 'var(--text-3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            ✓ Đã lưu
          </span>
        )}

        <span className="grow" />

        <span className="pm-badge" style={{ fontSize: 10, padding: '1px 6px' }}>
          {languageOf(file.ext)}
        </span>
        <span style={{ color: 'var(--line-2)' }}>·</span>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{formatBytes(file.size)}</span>

        {/* Nút lưu tệp trực tiếp */}
        {!file.binary && (
          <button
            className={`btn ${isDirty ? 'primary' : 'secondary'}`}
            onClick={() => void handleSave()}
            disabled={saving || !isDirty}
            title="Lưu tệp xuống đĩa (Ctrl+S)"
            style={{ height: 22, fontSize: 11, padding: '0 8px', gap: 4 }}
          >
            <Save size={11} /> {saving ? 'Đang lưu…' : 'Lưu'}
          </button>
        )}

        {/* Nút định dạng code */}
        {!file.binary && (
          <button
            className="pm-ibtn"
            onClick={() => void handleFormat()}
            title="Định dạng mã nguồn (Alt+Shift+F)"
            style={{ width: 24, height: 24 }}
          >
            <Sparkles size={12} />
          </button>
        )}

        {/* Nút bật/tắt word wrap */}
        {!file.binary && (
          <button
            className={`pm-ibtn ${wordWrap === 'on' ? 'active' : ''}`}
            onClick={() => setWordWrap((prev) => (prev === 'on' ? 'off' : 'on'))}
            title={wordWrap === 'on' ? 'Tắt ngắt dòng mềm (Word Wrap)' : 'Bật ngắt dòng mềm (Word Wrap)'}
            style={{ width: 24, height: 24 }}
          >
            <WrapText size={12} />
          </button>
        )}

        <button
          className="pm-ibtn"
          onClick={handleCopy}
          title="Sao chép toàn bộ nội dung"
          style={{ width: 24, height: 24 }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>

        <button
          className="pm-ibtn"
          onClick={() => onShowInFolder(file.path)}
          title="Hiện trong thư mục (Explorer)"
          style={{ width: 24, height: 24 }}
        >
          <FolderOpen size={12} />
        </button>

        <button
          className="pm-ibtn"
          onClick={() => onOpenExternal(file.path)}
          title="Mở bằng ứng dụng mặc định của hệ thống"
          style={{ width: 24, height: 24 }}
        >
          <ExternalLink size={12} />
        </button>
      </div>

      {/* ── BODY NỘI DUNG TỆP ── */}
      <div
        className="pm-viewer__body"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          position: 'relative',
        }}
      >
        {file.truncated && (
          <div className="pm-banner" style={{ margin: '8px 14px 4px', flexShrink: 0 }}>
            <AlertTriangle size={13} />
            <span>
              Tệp lớn hơn 1 MB nên chỉ hiển thị phần đầu. Hãy mở bằng trình soạn thảo bên ngoài để xem đầy đủ.
            </span>
          </div>
        )}

        {file.binary ? (
          file.dataUrl ? (
            <div className="pm-viewer__img" style={{ flex: 1, overflow: 'auto' }}>
              <img src={file.dataUrl} alt={file.name} />
            </div>
          ) : (
            <div className="pm-hint" style={{ padding: 20 }}>
              Tệp nhị phân ({formatBytes(file.size)}) — không thể hiển thị dạng văn bản.
            </div>
          )
        ) : (
          <div style={{ flex: 1, minHeight: 0, width: '100%', position: 'relative' }}>
            <Editor
              height="100%"
              width="100%"
              path={file.path}
              language={monacoLang}
              theme={theme}
              value={code}
              onChange={(value) => {
                const next = value ?? ''
                setCode(next)
                setIsDirty(next !== (file.text ?? ''))
              }}
              onMount={handleEditorDidMount}
              loading={
                <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--text-3)' }}>
                  <span className="pm-row" style={{ gap: 8, fontSize: 12 }}>
                    <Loader2 size={14} className="spin" /> Đang tải Monaco Editor…
                  </span>
                </div>
              }
              options={{
                fontSize: 13,
                fontFamily: "var(--font-mono, 'Consolas', 'Courier New', monospace)",
                tabSize: 2,
                minimap: { enabled: true, maxColumn: 80 },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                wordWrap: wordWrap,
                lineNumbers: 'on',
                renderWhitespace: 'selection',
                smoothScrolling: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                folding: true,
                renderLineHighlight: 'all',
                fixedOverflowWidgets: true,
                padding: { top: 8, bottom: 8 },
              }}
            />
          </div>
        )}
      </div>

      {/* ── FOOTER STATUS BAR ── */}
      {!file.binary && (
        <div
          className="pm-viewer__status"
          style={{
            height: 22,
            padding: '0 10px',
            borderTop: '1px solid var(--line)',
            background: 'var(--panel)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 10.5,
            color: 'var(--text-3)',
            flexShrink: 0,
            userSelect: 'none',
          }}
        >
          <span>
            Dòng {cursorPos.ln}, Cột {cursorPos.col}
            {cursorPos.selected > 0 && ` (${cursorPos.selected} ký tự chọn)`}
          </span>
          <span className="grow" />
          <span>Dấu cách: 2</span>
          <span>·</span>
          <span>UTF-8</span>
          <span>·</span>
          <span style={{ textTransform: 'capitalize' }}>{monacoLang}</span>
        </div>
      )}
    </div>
  )
}

export default FileViewer
