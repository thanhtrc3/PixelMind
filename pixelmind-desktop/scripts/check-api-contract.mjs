/* Kiểm tra hợp đồng IPC: mọi channel preload gọi/nghe đều có phía main.
   Chạy: node scripts/check-api-contract.mjs   (exit 0 = khớp, 1 = thiếu)
   Không thay được typecheck (shared/api.ts <-> preload <-> mock); chỉ bắt phần
   mà typecheck không thấy: channel có trong preload nhưng quên ipcMain.handle/send. */
import { readFile } from 'node:fs/promises'

const read = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8')
const [preload, main] = await Promise.all([
  read('electron/preload/index.ts'),
  read('electron/main/index.ts'),
])

const uniq = (list) => [...new Set(list)]
const match = (src, re) => uniq([...src.matchAll(re)].map((m) => m[1]))
const show = (list) => list.map((c) => `  - ${c}`).join('\n')

// preload: kênh gọi xuống main
const invoked = match(preload, /ipcRenderer\.(?:invoke|send)\(\s*['"]([^'"]+)['"]/g)
// preload: kênh nghe từ main
const listened = match(preload, /ipcRenderer\.on\(\s*['"]([^'"]+)['"]/g)
// main: kênh nhận
const handled = new Set([
  ...match(main, /ipcMain\.(?:handle|handleOnce|on)\(\s*['"]([^'"]+)['"]/g),
])
// main: kênh gửi lên renderer
const sent = new Set(match(main, /\.send\(\s*['"]([^'"]+)['"]/g))

const missingHandlers = invoked.filter((c) => !handled.has(c))
const missingSenders = listened.filter((c) => !sent.has(c))
const unexposed = [...handled].filter((c) => !invoked.includes(c))

// Lỗi chặn: thêm API mới mà quên handler ở main.
if (missingHandlers.length) {
  console.error('Channel preload gọi nhưng main KHÔNG có handler:')
  console.error(show(missingHandlers))
}
// Lỗi chặn: preload nghe sự kiện main không bao giờ phát (UI sẽ im lặng mãi).
if (missingSenders.length) {
  console.error('Channel preload nghe nhưng main KHÔNG gửi:')
  console.error(show(missingSenders))
}
if (unexposed.length) {
  // Không chặn: có thể là handler nội bộ chưa nối, in ra để rà.
  console.warn('Cảnh báo: main có handler không thấy preload gọi:')
  console.warn(show(unexposed))
}

console.log(`IPC: ${invoked.length} gọi / ${listened.length} nghe / ${handled.size} handler main`)
process.exit(missingHandlers.length || missingSenders.length ? 1 : 0)
