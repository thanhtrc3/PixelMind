import { promises as fs } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { PROJECT_TEMPLATES } from '../../shared/projectTemplates'

export interface ScaffoldOptions {
  templateId: string
  parentDir: string
  projectName: string
}

export interface ScaffoldResult {
  success: boolean
  projectPath?: string
  error?: string
  templateName?: string
}

/**
 * Khởi tạo dự án từ template vào thư mục đích.
 */
export async function scaffoldProjectFromTemplate(
  options: ScaffoldOptions,
): Promise<ScaffoldResult> {
  const { templateId, parentDir, projectName } = options

  const template = PROJECT_TEMPLATES.find((t) => t.id === templateId)
  if (!template) {
    return { success: false, error: `Không tìm thấy template có mã "${templateId}".` }
  }

  const cleanName = projectName.trim()
  if (!cleanName || /[/\\:*?"<>|]/.test(cleanName)) {
    return { success: false, error: 'Tên dự án chứa ký tự không hợp lệ.' }
  }

  const targetPath = resolve(parentDir, cleanName)

  // Kiểm tra thư mục đích
  try {
    const stats = await fs.stat(targetPath)
    if (stats.isDirectory()) {
      const items = await fs.readdir(targetPath)
      if (items.length > 0) {
        return {
          success: false,
          error: `Thư mục "${cleanName}" đã tồn tại và không trống. Vui lòng chọn tên khác hoặc dọn dẹp thư mục.`,
        }
      }
    }
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      return { success: false, error: `Không thể kiểm tra thư mục: ${err.message}` }
    }
  }

  // Tạo thư mục gốc dự án
  await fs.mkdir(targetPath, { recursive: true })

  // Sinh các file của template
  const files = template.files(cleanName)
  for (const file of files) {
    // Ngăn chặn path traversal
    const safeRel = file.path.replace(/\\/g, '/').replace(/^\/+/, '')
    if (safeRel.includes('..')) {
      continue
    }

    const fullFilePath = resolve(targetPath, safeRel)
    if (!fullFilePath.startsWith(targetPath)) {
      continue
    }

    await fs.mkdir(dirname(fullFilePath), { recursive: true })
    await fs.writeFile(fullFilePath, file.content, 'utf8')
  }

  return {
    success: true,
    projectPath: targetPath,
    templateName: template.name,
  }
}
