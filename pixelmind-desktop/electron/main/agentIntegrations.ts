/* Tích hợp agent: staging Skills + inject MCP server theo từng CLI.
   Học theo Open Design: skill được copy thật vào thư mục dự án, MCP cấu hình
   theo đúng định dạng mà từng CLI hiểu. */

import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

export interface McpServerConfig {
  name: string
  command: string
  args?: string[]
  env?: Record<string, string>
}

export interface AgentIntegration {
  env: Record<string, string>
  extraArgs: string[]
  preamble: string
  skillRoot: string
  skillCount: number
  mcpCount: number
}

const BUILTIN_SKILLS: Record<string, string> = {
  'pixelmind-design': `# PixelMind Design Skill

Bạn đang hỗ trợ thiết kế giao diện cho dự án của người dùng đang được mở trong **PixelMind Desktop**.

## QUYỀN HẠN & PHẠM VI (BẮT BUỘC TUÂN THỦ)
- **CHỈ SỬA DỰ ÁN ĐANG MỞ**: Bạn chỉ được phép đọc và chỉnh sửa các tệp tin bên trong thư mục dự án đang mở này.
- **KHÔNG ĐƯỢC SỬA ỨNG DỤNG**: Bạn TUYỆT ĐỐI KHÔNG CÓ QUYỀN sửa đổi, can thiệp hoặc thay đổi giao diện, mã nguồn, cấu hình của chính ứng dụng PixelMind Desktop.
- **PHẠM VI YÊU CẦU**: Mọi yêu cầu như "đổi màu nút theo theme", "đổi giao diện", "làm navbar tối giản hơn"... đều là dành cho các tệp giao diện (HTML/CSS/JS/TSX/Vue...) của DỰ ÁN ĐANG MỞ TRÊN CANVAS, KHÔNG PHẢI cho ứng dụng PixelMind Desktop.

## Nguyên tắc
- Ưu tiên tái sử dụng component và design token đã có trong dự án.
- Đọc \`DESIGN.md\`, \`tokens.css\`, hoặc thư mục \`design-tokens\` nếu tồn tại trước khi tạo màu mới.
- Không phá vỡ bố cục hiện tại: thay đổi tối thiểu, đúng phạm vi yêu cầu.
- Giữ ngôn ngữ giao diện nhất quán (tiếng Việt nếu dự án đang dùng tiếng Việt).
- Không commit, không xoá tệp ngoài phạm vi yêu cầu.

## Quy trình
1. Đọc ngữ cảnh phần tử đang chọn (tag, class, computed styles).
2. Đề xuất thay đổi dạng diff trước khi ghi.
3. Chạy build/typecheck nếu dự án có cấu hình.
`,
  'pixelmind-workflow': `# PixelMind Workflow Skill

Quy trình làm việc an toàn khi sửa mã nguồn dự án:

1. **Khảo sát** — đọc tệp liên quan trong dự án đang mở, xác định đúng điểm sửa.
2. **Lập kế hoạch** — nêu ngắn gọn các bước sẽ làm.
3. **Thực thi** — sửa từng tệp của dự án, giữ thay đổi nhỏ và có thể hoàn tác.
4. **Kiểm chứng** — chạy \`npm run build\`, \`npm run typecheck\`, hoặc lệnh tương ứng của dự án.
5. **Báo cáo** — tóm tắt tệp đã đổi và cách kiểm tra.

Không chạy lệnh phá huỷ (\`rm -rf\`, \`git reset --hard\`, \`format\`) nếu người dùng chưa xác nhận.
Tuyệt đối không đụng vào mã nguồn của ứng dụng PixelMind Desktop.
`,
}

/** Stage các skill vào <project>/.pixelmind/skills — copy thật, không symlink. */
export async function ensureProjectSkills(projectPath: string): Promise<string> {
  const skillRoot = join(projectPath, '.pixelmind', 'skills')
  await fs.mkdir(skillRoot, { recursive: true })

  await Promise.all(
    Object.entries(BUILTIN_SKILLS).map(async ([name, body]) => {
      const dir = join(skillRoot, name)
      const file = join(dir, 'SKILL.md')
      try {
        await fs.access(file)
      } catch {
        await fs.mkdir(dir, { recursive: true })
        await fs.writeFile(file, body, 'utf8')
      }
    }),
  )

  return skillRoot
}

export function buildSkillPreamble(
  skillRoot: string,
  skillCount: number,
  projectPath?: string,
): string {
  return [
    `[PHẠM VI QUYỀN HẠN] Bạn là trợ lý thiết kế/lập trình CHỈ DÀNH CHO DỰ ÁN ĐANG MỞ tại: "${projectPath || 'dự án hiện tại'}".`,
    'Bạn TUYỆT ĐỐI KHÔNG CÓ QUYỀN sửa đổi, đổi giao diện hay can thiệp vào bất kỳ tệp nào của ứng dụng PixelMind Desktop. Mọi chỉnh sửa giao diện chỉ áp dụng cho các tệp của dự án đang mở này.',
    `Có ${skillCount} skill tham khảo tại ${skillRoot} — chỉ đọc khi tác vụ thật sự liên quan.`,
    'Trả lời trực tiếp câu hỏi của người dùng trước; không liệt kê lại skill, quy trình hay tệp đã đọc trừ khi được hỏi.',
  ].join('\n')
}

function sanitizeServers(raw: unknown): McpServerConfig[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { servers?: unknown }).servers)
      ? (raw as { servers: unknown[] }).servers
      : []

  return list
    .map((item): McpServerConfig | null => {
      if (!item || typeof item !== 'object') return null
      const obj = item as Record<string, unknown>
      const name = String(obj.name ?? obj.id ?? '').trim()
      const command = String(obj.command ?? obj.cmd ?? '').trim()
      if (!name || !command) return null
      return {
        name,
        command,
        args: Array.isArray(obj.args) ? obj.args.map((arg) => String(arg)) : undefined,
        env:
          obj.env && typeof obj.env === 'object'
            ? Object.fromEntries(
                Object.entries(obj.env as Record<string, unknown>).map(([key, value]) => [
                  key,
                  String(value),
                ]),
              )
            : undefined,
      }
    })
    .filter((item): item is McpServerConfig => item !== null)
}

async function readJson(path: string): Promise<unknown | null> {
  try {
    const text = await fs.readFile(path, 'utf8')
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

/** Đọc MCP server từ dự án trước, rồi tới cấu hình người dùng. */
export async function loadMcpServers(projectPath: string): Promise<McpServerConfig[]> {
  const projectFile = join(projectPath, '.pixelmind', 'mcp.json')
  const userFile = join(app.getPath('userData'), 'agent-mcp.json')

  const projectServers = sanitizeServers(await readJson(projectFile))
  if (projectServers.length) return projectServers

  return sanitizeServers(await readJson(userFile))
}

/**
 * Chuẩn bị env + args + preamble cho một lần chạy agent.
 * - Claude Code: ghi .pixelmind/mcp.claude.json và truyền --mcp-config
 * - OpenCode: truyền OPENCODE_CONFIG_CONTENT
 */
export async function prepareAgentIntegration(
  defId: string,
  projectPath: string,
): Promise<AgentIntegration> {
  const env: Record<string, string> = {}
  const extraArgs: string[] = []

  let skillRoot = ''
  let skillCount = 0
  try {
    skillRoot = await ensureProjectSkills(projectPath)
    skillCount = Object.keys(BUILTIN_SKILLS).length
  } catch {
    skillRoot = ''
  }

  let mcpCount = 0
  try {
    const servers = await loadMcpServers(projectPath)
    mcpCount = servers.length

    if (servers.length && defId === 'claude') {
      const file = join(projectPath, '.pixelmind', 'mcp.claude.json')
      const mcpServers = Object.fromEntries(
        servers.map((server) => [
          server.name,
          {
            command: server.command,
            args: server.args ?? [],
            ...(server.env ? { env: server.env } : {}),
          },
        ]),
      )
      await fs.mkdir(join(projectPath, '.pixelmind'), { recursive: true })
      await fs.writeFile(file, JSON.stringify({ mcpServers }, null, 2), 'utf8')
      extraArgs.push('--mcp-config', file)
    } else if (servers.length && defId === 'opencode') {
      const mcp = Object.fromEntries(
        servers.map((server) => [
          server.name,
          {
            type: 'local',
            command: [server.command, ...(server.args ?? [])],
            ...(server.env ? { environment: server.env } : {}),
          },
        ]),
      )
      env.OPENCODE_CONFIG_CONTENT = JSON.stringify({ mcp })
    }
  } catch {
    mcpCount = 0
  }

  const preamble = skillRoot ? buildSkillPreamble(skillRoot, skillCount, projectPath) : ''

  return { env, extraArgs, preamble, skillRoot, skillCount, mcpCount }
}

/** Liệt kê MCP server đang cấu hình (cho UI Cài đặt). */
export async function describeMcp(projectPath: string): Promise<McpServerConfig[]> {
  return loadMcpServers(projectPath)
}
