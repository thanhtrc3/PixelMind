/* Catalog adapter CLI agent — học theo mô hình "data-spec" của Open Design.
   Mỗi CLI là MỘT object dữ liệu; engine chung lo detect / launch / parse.
   Thêm CLI mới = thêm một def, không sửa engine. */

export type AgentStreamFormat =
  | 'opencode-json'
  | 'codex-json'
  | 'claude-json'
  | 'cursor-json'
  | 'copilot-json'
  | 'qoder-json'
  | 'plain'

export interface AgentBuildOptions {
  prompt: string
  model?: string
  sessionId?: string
  imagePaths?: string[]
  extraDirs?: string[]
  cwd: string
}

export interface AgentDef {
  id: string
  name: string
  bin: string
  fallbackBins?: string[]
  description: string
  /** Args để lấy phiên bản (probe detect). */
  versionArgs: string[]
  /** Args để liệt kê model (model discovery). */
  modelsArgs?: string[]
  /** Args để kiểm tra đăng nhập. Exit code 0 = đã đăng nhập. */
  authArgs?: string[]
  streamFormat: AgentStreamFormat
  /** Prompt gửi qua stdin thay vì argv. */
  promptViaStdin?: boolean
  supportsImages?: boolean
  /** false = chỉ phát hiện, chưa hỗ trợ chạy từ chatbox. */
  supportsRun: boolean
  fallbackModels?: string[]
  buildArgs(options: AgentBuildOptions): string[]
}

const stdinModel = (model?: string): string[] => (model ? ['-m', model] : [])

export const AGENT_DEFS: AgentDef[] = [
  {
    id: 'opencode',
    name: 'OpenCode',
    bin: 'opencode',
    description: 'OpenCode terminal agent (JSON event stream)',
    versionArgs: ['--version'],
    modelsArgs: ['models'],
    streamFormat: 'opencode-json',
    promptViaStdin: true,
    supportsImages: false,
    supportsRun: true,
    buildArgs: ({ prompt: _prompt, model, sessionId }) => [
      'run',
      '--format',
      'json',
      '--auto',
      ...stdinModel(model),
      ...(sessionId ? ['-s', sessionId] : []),
    ],
  },
  {
    id: 'codex',
    name: 'Codex CLI (ChatGPT)',
    bin: 'codex',
    description: 'OpenAI Codex CLI — tương đương "ChatGPT CLI"',
    versionArgs: ['--version'],
    modelsArgs: ['debug', 'models'],
    authArgs: ['login', 'status'],
    streamFormat: 'codex-json',
    promptViaStdin: false,
    supportsImages: true,
    supportsRun: true,
    fallbackModels: ['gpt-5-codex', 'gpt-5', 'o4-mini'],
    buildArgs: ({ prompt, model, sessionId }) =>
      sessionId
        ? ['exec', 'resume', '--json', sessionId, ...(model ? ['-m', model] : []), prompt]
        : ['exec', '--json', '--skip-git-repo-check', ...(model ? ['-m', model] : []), prompt],
  },
  {
    id: 'claude',
    name: 'Claude Code',
    bin: 'claude',
    description: 'Anthropic Claude Code (stream-json)',
    versionArgs: ['--version'],
    streamFormat: 'claude-json',
    promptViaStdin: false,
    supportsImages: true,
    supportsRun: true,
    fallbackModels: ['sonnet', 'opus', 'haiku'],
    buildArgs: ({ prompt, model, sessionId }) => [
      '-p',
      prompt,
      '--output-format',
      'stream-json',
      '--verbose',
      '--permission-mode',
      'bypassPermissions',
      ...(model ? ['--model', model] : []),
      ...(sessionId ? ['--resume', sessionId] : []),
    ],
  },
  {
    id: 'cursor-agent',
    name: 'Cursor Agent',
    bin: 'cursor-agent',
    description: 'Cursor CLI agent (stream-json, stdin)',
    versionArgs: ['--version'],
    modelsArgs: ['models'],
    authArgs: ['status'],
    streamFormat: 'cursor-json',
    promptViaStdin: true,
    supportsImages: true,
    supportsRun: true,
    buildArgs: ({ model }) => [
      '--print',
      '--output-format',
      'stream-json',
      '--stream-partial-output',
      '--force',
      ...(model ? ['--model', model] : []),
    ],
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot CLI',
    bin: 'copilot',
    description: 'GitHub Copilot CLI (JSONL, stdin)',
    versionArgs: ['--version'],
    streamFormat: 'copilot-json',
    promptViaStdin: true,
    supportsImages: false,
    supportsRun: true,
    buildArgs: ({ model }) => [
      '--allow-all-tools',
      '--output-format',
      'json',
      ...(model ? ['--model', model] : []),
    ],
  },
  {
    id: 'qoder',
    name: 'Qoder CLI',
    bin: 'qodercli',
    fallbackBins: ['qoder'],
    description: 'Qoder CLI (stream-json, stdin)',
    versionArgs: ['--version'],
    streamFormat: 'qoder-json',
    promptViaStdin: true,
    supportsImages: false,
    supportsRun: true,
    buildArgs: ({ model, cwd }) => [
      '-p',
      '--output-format',
      'stream-json',
      '--yolo',
      '-w',
      cwd,
      ...(model ? ['--model', model] : []),
    ],
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    bin: 'gemini',
    description: 'Google Gemini CLI (plain text)',
    versionArgs: ['--version'],
    streamFormat: 'plain',
    promptViaStdin: false,
    supportsImages: true,
    supportsRun: true,
    fallbackModels: ['gemini-2.5-pro', 'gemini-2.5-flash'],
    buildArgs: ({ prompt, model }) => [
      '-p',
      prompt,
      '-y',
      ...(model ? ['--model', model] : []),
    ],
  },
  {
    id: 'aider',
    name: 'Aider',
    bin: 'aider',
    description: 'AI pair programming CLI (plain text)',
    versionArgs: ['--version'],
    streamFormat: 'plain',
    promptViaStdin: false,
    supportsImages: false,
    supportsRun: true,
    buildArgs: ({ prompt, model }) => [
      '--message',
      prompt,
      '--yes',
      '--no-pretty',
      '--no-auto-commits',
      ...(model ? ['--model', model] : []),
    ],
  },
  {
    id: 'qwen',
    name: 'Qwen Code',
    bin: 'qwen',
    description: 'Qwen Code CLI (plain text)',
    versionArgs: ['--version'],
    streamFormat: 'plain',
    promptViaStdin: false,
    supportsImages: false,
    supportsRun: true,
    buildArgs: ({ prompt, model }) => [
      '-p',
      prompt,
      '-y',
      ...(model ? ['--model', model] : []),
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek TUI',
    bin: 'deepseek',
    fallbackBins: ['codewhale'],
    description: 'DeepSeek CLI (plain text, --auto)',
    versionArgs: ['--version'],
    streamFormat: 'plain',
    promptViaStdin: false,
    supportsImages: false,
    supportsRun: true,
    fallbackModels: ['deepseek-v4-pro', 'deepseek-v4-flash'],
    buildArgs: ({ prompt, model }) => [
      'exec',
      '--auto',
      ...(model ? ['--model', model] : []),
      prompt,
    ],
  },
  {
    id: 'amp',
    name: 'Amp',
    bin: 'amp',
    description: 'Amp CLI (plain text)',
    versionArgs: ['--version'],
    streamFormat: 'plain',
    promptViaStdin: false,
    supportsImages: false,
    supportsRun: true,
    buildArgs: ({ prompt }) => ['-x', prompt, '--dangerously-allow-all'],
  },
  {
    id: 'antigravity',
    name: 'Antigravity CLI (agy)',
    bin: 'agy',
    description: 'Google Antigravity agent CLI',
    versionArgs: ['--version'],
    streamFormat: 'plain',
    promptViaStdin: false,
    supportsImages: false,
    supportsRun: false,
    buildArgs: ({ prompt }) => [prompt],
  },
  {
    id: 'kimi',
    name: 'Kimi CLI',
    bin: 'kimi',
    description: 'Moonshot Kimi CLI (ACP) — chỉ phát hiện',
    versionArgs: ['--version'],
    streamFormat: 'plain',
    promptViaStdin: false,
    supportsImages: false,
    supportsRun: false,
    buildArgs: ({ prompt }) => [prompt],
  },
  {
    id: 'hermes',
    name: 'Hermes Agent',
    bin: 'hermes',
    description: 'Nous Research Hermes (ACP) — chỉ phát hiện',
    versionArgs: ['--version'],
    streamFormat: 'plain',
    promptViaStdin: false,
    supportsImages: false,
    supportsRun: false,
    buildArgs: ({ prompt }) => [prompt],
  },
  {
    id: 'kiro',
    name: 'Kiro',
    bin: 'kiro',
    description: 'Kiro CLI (ACP) — chỉ phát hiện',
    versionArgs: ['--version'],
    streamFormat: 'plain',
    promptViaStdin: false,
    supportsImages: false,
    supportsRun: false,
    buildArgs: ({ prompt }) => [prompt],
  },
  {
    id: 'kilo',
    name: 'Kilo',
    bin: 'kilo',
    description: 'Kilo CLI (ACP) — chỉ phát hiện',
    versionArgs: ['--version'],
    streamFormat: 'plain',
    promptViaStdin: false,
    supportsImages: false,
    supportsRun: false,
    buildArgs: ({ prompt }) => [prompt],
  },
  {
    id: 'vibe',
    name: 'Mistral Vibe',
    bin: 'vibe',
    description: 'Mistral Vibe CLI (ACP) — chỉ phát hiện',
    versionArgs: ['--version'],
    streamFormat: 'plain',
    promptViaStdin: false,
    supportsImages: false,
    supportsRun: false,
    buildArgs: ({ prompt }) => [prompt],
  },
  {
    id: 'trae-cli',
    name: 'Trae CLI',
    bin: 'traecli',
    description: 'Trae CLI (ACP) — chỉ phát hiện',
    versionArgs: ['--version'],
    streamFormat: 'plain',
    promptViaStdin: false,
    supportsImages: false,
    supportsRun: false,
    buildArgs: ({ prompt }) => [prompt],
  },
  {
    id: 'devin',
    name: 'Devin for Terminal',
    bin: 'devin',
    description: 'Devin CLI (ACP) — chỉ phát hiện',
    versionArgs: ['--version'],
    streamFormat: 'plain',
    promptViaStdin: false,
    supportsImages: false,
    supportsRun: false,
    buildArgs: ({ prompt }) => [prompt],
  },
  {
    id: 'pi',
    name: 'Pi Agent',
    bin: 'pi',
    description: 'Pi agent (RPC) — chỉ phát hiện',
    versionArgs: ['--version'],
    streamFormat: 'plain',
    promptViaStdin: false,
    supportsImages: true,
    supportsRun: false,
    buildArgs: ({ prompt }) => [prompt],
  },
  {
    id: 'reasonix',
    name: 'DeepSeek Reasonix',
    bin: 'reasonix',
    description: 'DeepSeek Reasonix (ACP) — chỉ phát hiện',
    versionArgs: ['--version'],
    streamFormat: 'plain',
    promptViaStdin: false,
    supportsImages: false,
    supportsRun: false,
    buildArgs: ({ prompt }) => [prompt],
  },
  {
    id: 'codebuddy',
    name: 'CodeBuddy',
    bin: 'codebuddy',
    description: 'CodeBuddy CLI (claude stream-json) — chỉ phát hiện',
    versionArgs: ['--version'],
    streamFormat: 'plain',
    promptViaStdin: false,
    supportsImages: false,
    supportsRun: false,
    buildArgs: ({ prompt }) => [prompt],
  },
  {
    id: 'mimo',
    name: 'MiMo',
    bin: 'mimo',
    description: 'MiMo CLI (JSON events) — chỉ phát hiện',
    versionArgs: ['--version'],
    streamFormat: 'plain',
    promptViaStdin: false,
    supportsImages: false,
    supportsRun: false,
    buildArgs: ({ prompt }) => [prompt],
  },
  {
    id: 'grok-build',
    name: 'Grok Build',
    bin: 'grok',
    description: 'Grok Build CLI (plain) — chỉ phát hiện',
    versionArgs: ['--version'],
    streamFormat: 'plain',
    promptViaStdin: false,
    supportsImages: false,
    supportsRun: false,
    buildArgs: ({ prompt }) => [prompt],
  },
  {
    id: 'atomcode',
    name: 'AtomCode',
    bin: 'atomcode',
    description: 'AtomCode CLI (plain) — chỉ phát hiện',
    versionArgs: ['--version'],
    streamFormat: 'plain',
    promptViaStdin: false,
    supportsImages: false,
    supportsRun: false,
    buildArgs: ({ prompt }) => [prompt],
  },
]

export function getAgentDef(id: string): AgentDef | undefined {
  return AGENT_DEFS.find((def) => def.id === id)
}

export function findAgentDefByBinary(binary: string): AgentDef | undefined {
  const base = binary.replace(/\.(exe|cmd|bat|sh)$/i, '').toLowerCase()
  return AGENT_DEFS.find(
    (def) =>
      def.bin.toLowerCase() === base ||
      (def.fallbackBins ?? []).some((bin) => bin.toLowerCase() === base),
  )
}

export function allAgentBinaries(): Set<string> {
  const set = new Set<string>()
  for (const def of AGENT_DEFS) {
    set.add(def.bin.toLowerCase())
    for (const bin of def.fallbackBins ?? []) set.add(bin.toLowerCase())
  }
  return set
}
