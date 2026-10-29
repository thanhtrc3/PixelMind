/* Máy chủ tĩnh nhỏ để xem giao diện renderer bằng trình duyệt (không cần Electron).
   Chỉ dùng cho việc kiểm thử giao diện: dữ liệu là bản giả lập. */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'

const root = resolve('out/renderer')
const port = Number(process.env.PORT ?? 4173)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
}

createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0])
    let target = normalize(join(root, urlPath === '/' ? '/index.html' : urlPath))
    if (!target.startsWith(root + sep) && target !== root) {
      res.writeHead(403).end('Forbidden')
      return
    }
    if ((await stat(target)).isDirectory()) target = join(target, 'index.html')
    const data = await readFile(target)
    res.writeHead(200, { 'Content-Type': MIME[extname(target).toLowerCase()] ?? 'application/octet-stream' })
    res.end(data)
  } catch {
    res.writeHead(404).end('Not found')
  }
}).listen(port, () => {
  console.log(`Xem trước giao diện: http://localhost:${port}`)
})
