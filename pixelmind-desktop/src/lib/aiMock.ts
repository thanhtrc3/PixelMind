/* Dữ liệu mẫu cho giao diện Trợ lý AI (chưa kết nối backend AI). */

export type AiBridgeKind = 'api' | 'ide' | 'cli' | 'ollama'
export type AiChangeStatus = 'pending' | 'accepted' | 'rejected'
export type AiStepStatus = 'done' | 'running' | 'pending' | 'failed'
import type { AiSelection } from '@shared/ai'

export type AiMessageRole = 'user' | 'assistant' | 'system'
export type AiTab = 'chat' | 'tasks' | 'changes' | 'context' | 'errors' | 'security'

export interface AiBridgeProfile {
  id: AiBridgeKind
  name: string
  detail: string
  status: 'online' | 'offline' | 'local'
  model?: string
}

export interface AiDiffLine {
  kind: 'add' | 'del' | 'ctx' | 'hunk'
  text: string
}

export interface AiChange {
  id: string
  file: string
  summary: string
  added: number
  removed: number
  status: AiChangeStatus
  diff: AiDiffLine[]
  task?: string
}

export interface AiStep {
  label: string
  status: AiStepStatus
}

export interface AiTask {
  id: string
  title: string
  detail: string
  status: 'running' | 'done' | 'failed' | 'queued'
  progress: number
  steps: AiStep[]
  time: string
}

export interface AiChatMessage {
  id: string
  role: AiMessageRole
  text: string
  time: string
  plan?: AiStep[]
  diff?: AiChange
}

export interface AiContextItem {
  id: string
  label: string
  detail: string
  tokens: number
  checked: boolean
}

export interface AiBuildError {
  id: string
  code: string
  file: string
  line?: number
  message: string
  severity: 'error' | 'warning'
}

export interface AiThemeOption {
  id: string
  name: string
  mood: string
  accent: string
  accent2: string
  bg: string
  surface: string
  text: string
  muted: string
  font: string
  radius: number
}

export interface AiDesignSection {
  id: string
  name: string
  role: string
  confidence: number
  checked: boolean
}

/** Phần tử đang được chọn trên canvas, dùng cho ngữ cảnh và sidecar. */
export type AiSelectedElement = AiSelection


export const AI_THEMES: AiThemeOption[] = [
  {
    id: 'do-son',
    name: 'Đỏ son · Giấy cũ',
    mood: 'Cổ điển · ấm · truyền thống',
    accent: '#b91c1c',
    accent2: '#d97706',
    bg: '#f8f5ef',
    surface: '#ffffff',
    text: '#1f2937',
    muted: '#6b7280',
    font: 'Be Vietnam Pro',
    radius: 10,
  },
  {
    id: 'ngoc-dem',
    name: 'Xanh ngọc · Đêm',
    mood: 'Hiện đại · tập trung · dịu mắt',
    accent: '#10b981',
    accent2: '#38bdf8',
    bg: '#0b1220',
    surface: '#111a2e',
    text: '#e2e8f0',
    muted: '#94a3b8',
    font: 'Inter',
    radius: 12,
  },
  {
    id: 'tim-hien-dai',
    name: 'Tím · Hiện đại',
    mood: 'Năng động · công nghệ · nổi bật',
    accent: '#6d5df5',
    accent2: '#a78bfa',
    bg: '#0f1014',
    surface: '#191b21',
    text: '#eceef2',
    muted: '#a3a9b4',
    font: 'Inter',
    radius: 14,
  },
]

export const AI_DESIGN_SECTIONS: AiDesignSection[] = [
  { id: 'sec-header', name: 'Header / Navbar', role: 'logo + điều hướng + CTA', confidence: 98, checked: true },
  { id: 'sec-hero', name: 'Hero', role: 'tiêu đề lớn + mô tả + 2 nút', confidence: 94, checked: true },
  { id: 'sec-features', name: 'Features', role: '3 thẻ tính năng', confidence: 88, checked: true },
  { id: 'sec-cta', name: 'CTA', role: 'khối kêu gọi hành động', confidence: 82, checked: true },
  { id: 'sec-footer', name: 'Footer', role: 'liên kết + bản quyền', confidence: 91, checked: true },
]

