import type { RunLog, RunState } from '@shared/types'

export type ErrorType =
  | 'missing_package'
  | 'port_in_use'
  | 'electron_cache_lock'
  | 'command_not_found'
  | 'missing_script'
  | 'typescript_error'
  | 'syntax_error'
  | 'build_error'
  | 'unknown'

export interface ParsedError {
  type: ErrorType
  title: string
  summary: string
  file?: string
  line?: number
  column?: number
  recommendation: string
  actionLabel?: string
  actionKind?: 'install' | 'open_file' | 'retry'
  packageNames?: string[]
}

/** Lọc bỏ các dòng stack trace nội bộ của Node/Vite để tìm dòng lỗi có ý nghĩa với người dùng */
function extractMeaningfulMessage(text: string): string {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('at ') && !l.startsWith('Node.js v') && !l.startsWith('[system]'))

  for (const line of lines) {
    if (line.includes('Error:') || line.includes('error:') || line.includes('ERR_') || line.includes('failed to')) {
      return line.replace(/^Error:\s*/i, '').replace(/^\[error\]\s*/i, '')
    }
  }

  return lines[0] || 'Tiến trình dừng đột ngột do gặp lỗi trong quá trình thực thi.'
}

export function parseRunError(logs: RunLog[], run?: RunState | null): ParsedError | null {
  const isErrorState = run?.status === 'error'
  const isExitedWithError = Boolean(run?.status === 'exited' && run?.exitCode !== null && run?.exitCode !== 0)
  const hasStderr = logs.some((l) => l.stream === 'stderr')

  // Nếu tiến trình chưa kết thúc lỗi và không có stderr nào thì coi như chưa có lỗi
  if (!isErrorState && !isExitedWithError && !hasStderr) {
    return null
  }

  const allText = logs.map((l) => l.text).join('\n')
  const stderrText = logs
    .filter((l) => l.stream === 'stderr' || l.stream === 'system')
    .map((l) => l.text)
    .join('\n')

  const combined = `${allText}\n${stderrText}`

  // 1. Thiếu gói thư viện (ERR_MODULE_NOT_FOUND / Cannot find package / Could not resolve)
  const pkgMissingMatch =
    combined.match(/Cannot find package ['"](@?[^'"/]+(?:\/[^'"/]+)?)['"]/i) ||
    combined.match(/Cannot find module ['"](@?[^'"/]+(?:\/[^'"/]+)?)['"]/i) ||
    combined.match(/Could not resolve ['"](@?[^'"/]+(?:\/[^'"/]+)?)['"]/i) ||
    combined.match(/Failed to resolve import ["'](@?[^'"/]+(?:\/[^'"/]+)?)["']/i)

  if (pkgMissingMatch) {
    const pkg = pkgMissingMatch[1]
    const fileMatch = combined.match(/(?:in|from)\s+([^\s:]+\.(?:ts|tsx|js|jsx|mjs|cjs|vue|svelte))/i)
    const file = fileMatch ? fileMatch[1].split(/[\\/]/).pop() : undefined

    return {
      type: 'missing_package',
      title: `Thiếu thư viện “${pkg}”`,
      summary: file
        ? `Tệp “${file}” cần sử dụng gói “${pkg}”, nhưng gói này chưa được cài đặt trong thư mục node_modules.`
        : `Dự án cần sử dụng gói “${pkg}” nhưng chưa tìm thấy trong thư mục node_modules.`,
      file,
      recommendation: `Bấm nút “Cài đặt thư viện ngay” bên dưới để PixelMind tự động tải và cài đặt các gói còn thiếu.`,
      actionLabel: `Cài đặt thư viện ngay (${pkg})`,
      actionKind: 'install',
      packageNames: [pkg],
    }
  }

  // 2. Xung đột cổng mạng (EADDRINUSE)
  const portMatch =
    combined.match(/EADDRINUSE.*?:::?(\d{2,5})/i) ||
    combined.match(/address already in use.*?:::?(\d{2,5})/i) ||
    combined.match(/Port (\d{2,5}) is (?:already )?in use/i)

  if (portMatch) {
    const port = portMatch[1]
    return {
      type: 'port_in_use',
      title: `Cổng mạng ${port} đã bị chiếm dụng`,
      summary: `Máy chủ xem trước không thể khởi động vì cổng ${port} đã có một ứng dụng hoặc tiến trình khác sử dụng từ trước.`,
      recommendation: `Hãy tắt ứng dụng hoặc tiến trình đang chạy ở cổng ${port}, hoặc cấu hình dự án sang một cổng khác rồi thử lại.`,
      actionLabel: 'Thử chạy lại',
      actionKind: 'retry',
    }
  }

  // 3. Xung đột Cache Electron / Access is Denied (0x5)
  if (combined.includes('Unable to move the cache: Access is denied. (0x5)') || combined.includes('Gpu Cache Creation failed')) {
    return {
      type: 'electron_cache_lock',
      title: 'Xung đột tiến trình Desktop (Electron)',
      summary: 'Đã có một phiên bản PixelMind hoặc ứng dụng Electron khác đang chạy ngầm và khoá tệp bộ nhớ cache của hệ điều hành.',
      recommendation: 'Hãy đóng cửa sổ PixelMind đang chạy ngầm hoặc dùng Task Manager để tắt các tiến trình Electron cũ rồi chạy lại.',
      actionLabel: 'Thử chạy lại',
      actionKind: 'retry',
    }
  }

  // 4. Lệnh không tồn tại (Command not found / is not recognized)
  const cmdNotFoundMatch =
    combined.match(/'([^']+)' is not recognized as an internal or external command/i) ||
    combined.match(/command not found:\s*(\w+)/i) ||
    combined.match(/spawn (\w+) ENOENT/i)

  if (cmdNotFoundMatch) {
    const cmd = cmdNotFoundMatch[1]
    return {
      type: 'command_not_found',
      title: `Không tìm thấy công cụ chạy “${cmd}”`,
      summary: `Hệ thống không tìm thấy công cụ “${cmd}”. Có thể thư mục node_modules chưa được cài đặt hoặc công cụ chưa nằm trong biến môi trường.`,
      recommendation: `Hãy chạy “npm install” để tải toàn bộ các công cụ và thư viện cần thiết cho dự án.`,
      actionLabel: 'Cài đặt thư viện ngay',
      actionKind: 'install',
    }
  }

  // 5. Thiếu script trong package.json
  const scriptMissingMatch =
    combined.match(/npm error Missing script:\s*["']([^"']+)["']/i) ||
    combined.match(/Command ["']([^"']+)["'] not found/i)

  if (scriptMissingMatch) {
    const scriptName = scriptMissingMatch[1]
    return {
      type: 'missing_script',
      title: `Không có script “${scriptName}”`,
      summary: `Trong tệp package.json không khai báo lệnh script có tên là “${scriptName}”.`,
      recommendation: `Mở tệp package.json và kiểm tra mục "scripts" để chọn lệnh chạy phù hợp (ví dụ: dev, start, serve).`,
    }
  }

  // 6. Lỗi TypeScript
  const tsMatch = combined.match(/([^\s()]+\.(?:tsx?|jsx?)):?\((\d+),(\d+)\):\s*error TS\d+:\s*(.+)/i)
  if (tsMatch) {
    const filePath = tsMatch[1]
    const fileName = filePath.split(/[\\/]/).pop() || filePath
    const line = Number(tsMatch[2])
    const column = Number(tsMatch[3])
    const tsMsg = tsMatch[4].trim()

    return {
      type: 'typescript_error',
      title: `Lỗi TypeScript tại ${fileName} (dòng ${line})`,
      summary: tsMsg,
      file: filePath,
      line,
      column,
      recommendation: `Nhấp vào nút bên dưới để mở tệp “${fileName}” tại dòng ${line} và kiểm tra lại cú pháp hoặc kiểu dữ liệu.`,
      actionLabel: `Mở tệp ${fileName}`,
      actionKind: 'open_file',
    }
  }

  // 7. Lỗi cú pháp (SyntaxError)
  const syntaxMatch = combined.match(/SyntaxError:\s*(.+)/i)
  if (syntaxMatch) {
    const fileMatch = combined.match(/([^\s()]+\.(?:tsx?|jsx?|vue|svelte|html)):(\d+)/i)
    const file = fileMatch ? fileMatch[1].split(/[\\/]/).pop() : undefined
    const line = fileMatch ? Number(fileMatch[2]) : undefined

    return {
      type: 'syntax_error',
      title: file ? `Lỗi cú pháp tại ${file}${line ? ` (dòng ${line})` : ''}` : 'Lỗi cú pháp mã nguồn',
      summary: syntaxMatch[1].trim(),
      file,
      line,
      recommendation: `Kiểm tra dấu đóng/mở ngoặc, dấu phẩy hoặc cú pháp import trong mã nguồn vừa sửa đổi.`,
      actionLabel: file ? `Mở tệp ${file}` : undefined,
      actionKind: file ? 'open_file' : undefined,
    }
  }

  // 8. Lỗi biên dịch Vite / Rollup plugin
  const pluginMatch = combined.match(/\[plugin\s+([^\]]+)\]\s*(.+)/i)
  if (pluginMatch) {
    return {
      type: 'build_error',
      title: `Lỗi biên dịch (${pluginMatch[1]})`,
      summary: pluginMatch[2].trim(),
      recommendation: 'Kiểm tra lại cấu hình bộ biên dịch hoặc các gói plugin được cấu hình trong dự án.',
      actionLabel: 'Thử chạy lại',
      actionKind: 'retry',
    }
  }

  // 9. Lỗi tổng quát khi exitCode != 0
  if (isExitedWithError || isErrorState) {
    const message = extractMeaningfulMessage(stderrText || allText)
    return {
      type: 'unknown',
      title: `Tiến trình gặp lỗi (mã thoát: ${run?.exitCode ?? 'không xác định'})`,
      summary: message,
      recommendation: 'Bấm nút "Xem log chi tiết" bên dưới để kiểm tra toàn bộ thông báo hệ thống.',
      actionLabel: 'Thử chạy lại',
      actionKind: 'retry',
    }
  }

  return null
}

