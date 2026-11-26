import http from 'node:http'
import https from 'node:https'
import os from 'node:os'
import { spawn, type ChildProcess } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { join, extname, normalize } from 'node:path'

export interface SharedComment {
  id: string
  x: number
  y: number
  text: string
  route: string
  author?: string
  resolved?: boolean
  createdAt?: number
}

export interface ShareServerStatus {
  active: boolean
  port: number
  localUrl: string
  lanUrls: string[]
  publicUrl: string | null
  tunnelStatus: 'idle' | 'starting' | 'ready' | 'error'
  tunnelError?: string
  comments: SharedComment[]
}

let server: http.Server | null = null
let activePort = 0
let currentProjectPath = ''
let currentProjectName = 'PixelMind Project'
let currentTargetUrl = ''
let commentsCache: SharedComment[] = []
let tunnelProc: ChildProcess | null = null
let publicUrl: string | null = null
let tunnelStatus: 'idle' | 'starting' | 'ready' | 'error' = 'idle'
let tunnelError: string | undefined

function normalizeRoute(r?: string | null): string {
  return ((r || '/').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/').toLowerCase()
}

function getLanAddresses(): string[] {
  const nets = os.networkInterfaces()
  const ips: string[] = []
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address)
      }
    }
  }
  return ips
}

async function loadProjectComments(projectPath: string): Promise<SharedComment[]> {
  if (!projectPath) return []
  try {
    const file = join(projectPath, '.pixelmind', 'comments.json')
    const raw = await fs.readFile(file, 'utf8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
  } catch { }
  return []
}

async function saveProjectComments(projectPath: string, list: SharedComment[]): Promise<void> {
  if (!projectPath) return
  try {
    const dir = join(projectPath, '.pixelmind')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(join(dir, 'comments.json'), JSON.stringify(list, null, 2), 'utf8')
  } catch { }
}

function buildInjectedShareScript(projectName: string): string {
  const safeName = JSON.stringify(projectName || 'Dự án')
  return `
<script data-pm-share-client>
(function() {
  if (window.__PM_SHARE_ACTIVE__) return;
  window.__PM_SHARE_ACTIVE__ = true;

  var PROJECT_NAME = ${safeName};
  var comments = [];
  var isPinMode = false;
  var editingId = null;
  var hoveredId = null;
  var menuState = null;
  var authorName = '';
  try { authorName = localStorage.getItem('pm_share_author') || 'Khách'; } catch(e) { authorName = 'Khách'; }

  function normRoute(r) {
    return ((r || '/').split('?')[0].split('#')[0].replace(/\\/+$/, '') || '/').toLowerCase();
  }

  var host = document.createElement('div');
  host.id = '__pm_share_root__';
  host.style.cssText = 'position:static;z-index:2147483640;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
  document.body.appendChild(host);

  var bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:2147483645;display:flex;align-items:center;gap:8px;padding:7px 12px;border-radius:999px;background:rgba(15,23,42,0.94);color:#f8fafc;border:1px solid rgba(148,163,184,0.28);box-shadow:0 10px 28px rgba(0,0,0,0.4);backdrop-filter:blur(8px);font-size:12px;';
  host.appendChild(bar);

  var badge = document.createElement('span');
  badge.style.cssText = 'display:inline-flex;align-items:center;gap:5px;font-weight:700;color:#38bdf8;';
  badge.textContent = '👁️ Chỉ xem & Ghi chú · ' + PROJECT_NAME;
  bar.appendChild(badge);

  var authorInput = document.createElement('input');
  authorInput.type = 'text';
  authorInput.value = authorName;
  authorInput.placeholder = 'Tên của bạn...';
  authorInput.title = 'Tên hiển thị khi bạn ghim ghi chú';
  authorInput.style.cssText = 'width:95px;padding:3px 8px;border-radius:999px;border:1px solid rgba(148,163,184,0.3);background:rgba(30,41,59,0.9);color:#f8fafc;font-size:11.5px;outline:none;';
  authorInput.addEventListener('change', function() {
    authorName = authorInput.value.trim() || 'Khách';
    try { localStorage.setItem('pm_share_author', authorName); } catch(e) {}
  });
  bar.appendChild(authorInput);

  var pinBtn = document.createElement('button');
  pinBtn.type = 'button';
  pinBtn.style.cssText = 'padding:4px 11px;border-radius:999px;border:none;background:#f59e0b;color:#0f172a;font-weight:700;font-size:11.5px;cursor:pointer;transition:all 0.15s;';
  function updatePinBtn() {
    pinBtn.textContent = isPinMode ? '✕ Huỷ ghim (Esc)' : '📌 Ghim ghi chú (C)';
    pinBtn.style.background = isPinMode ? '#ef4444' : '#f59e0b';
    pinBtn.style.color = isPinMode ? '#ffffff' : '#0f172a';
    document.body.style.cursor = isPinMode ? 'crosshair' : '';
  }
  updatePinBtn();
  pinBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    isPinMode = !isPinMode;
    updatePinBtn();
  });
  bar.appendChild(pinBtn);

  var pinsContainer = document.createElement('div');
  pinsContainer.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;z-index:2147483642;';
  host.appendChild(pinsContainer);

  var menuEl = document.createElement('div');
  menuEl.style.cssText = 'position:fixed;display:none;z-index:2147483647;min-width:185px;padding:5px;border-radius:10px;background:#0f172a;border:1px solid rgba(148,163,184,0.25);box-shadow:0 10px 28px rgba(0,0,0,0.45);color:#f8fafc;font-size:12px;flex-direction:column;gap:2px;';
  host.appendChild(menuEl);

  function apiCall(body, cb) {
    fetch('/__pm_share/comments', {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data && Array.isArray(data.comments)) {
          comments = data.comments;
          renderPins();
        }
        if (cb) cb(data);
      })
      .catch(function() {});
  }

  function closeMenu() {
    menuState = null;
    menuEl.style.display = 'none';
  }

  window.addEventListener('click', function() {
    if (menuState) closeMenu();
  });

  window.addEventListener('keydown', function(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
    if (e.key === 'c' || e.key === 'C') {
      isPinMode = !isPinMode;
      updatePinBtn();
    } else if (e.key === 'Escape' && isPinMode) {
      isPinMode = false;
      updatePinBtn();
    }
  });

  document.addEventListener('click', function(e) {
    if (!isPinMode) return;
    if (host.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    var pageX = Math.round(e.pageX);
    var pageY = Math.round(e.pageY);
    var curRoute = normRoute(window.location.pathname);
    isPinMode = false;
    updatePinBtn();
    var newId = 'comment-' + Date.now();
    var count = comments.filter(function(c) { return normRoute(c.route) === curRoute; }).length + 1;
    var defaultText = 'Ghi chú #' + count;
    editingId = newId;
    apiCall({
      action: 'add',
      id: newId,
      x: pageX,
      y: pageY,
      text: defaultText,
      author: authorName || 'Khách',
      route: curRoute
    });
  }, true);

  function openContextMenu(item, clientX, clientY) {
    menuState = item;
    menuEl.innerHTML = '';
    menuEl.style.left = clientX + 'px';
    menuEl.style.top = clientY + 'px';
    menuEl.style.display = 'flex';

    function addBtn(label, color, onClick) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.style.cssText = 'text-align:left;padding:6px 10px;border-radius:6px;border:none;background:transparent;color:' + (color || '#f8fafc') + ';cursor:pointer;font-size:12px;';
      b.addEventListener('click', function(ev) {
        ev.stopPropagation();
        closeMenu();
        onClick();
      });
      menuEl.appendChild(b);
    }

    addBtn('✏️ Sửa nội dung ghi chú', '#f8fafc', function() {
      editingId = item.id;
      renderPins();
    });
    addBtn(item.resolved ? '🔄 Mở lại ghi chú' : '✅ Đánh dấu đã xong', '#f8fafc', function() {
      apiCall({ action: 'update', id: item.id, resolved: !item.resolved });
    });
    addBtn('🗑️ Xoá thẻ ghi chú này', '#f87171', function() {
      apiCall({ action: 'delete', id: item.id });
    });
  }

  function renderPins() {
    if (editingId && document.activeElement && pinsContainer.contains(document.activeElement)) {
      return;
    }
    pinsContainer.innerHTML = '';
    var curRoute = normRoute(window.location.pathname);
    var list = comments.filter(function(c) { return normRoute(c.route) === curRoute; });

    list.forEach(function(item) {
      var isEditing = editingId === item.id;
      var isExpanded = isEditing || hoveredId === item.id;
      var pin = document.createElement('div');
      pin.title = 'Rê chuột để xem • Chuột trái: Nhập/sửa ghi chú • Chuột phải: Tuỳ chọn';
      pin.style.cssText = [
        'position:absolute',
        'left:' + item.x + 'px',
        'top:' + item.y + 'px',
        'transform:translate(0,-100%)',
        'z-index:' + (isExpanded ? 2147483646 : 2147483643),
        'display:inline-flex',
        'align-items:center',
        'justify-content:center',
        'gap:' + (isExpanded ? '6px' : '0'),
        'min-width:24px',
        'height:' + (isEditing ? '28px' : '24px'),
        'padding:' + (isEditing ? '3px 6px' : isExpanded ? '3px 10px' : '0 6px'),
        'border-radius:12px 12px 12px 2px',
        'background:' + (item.resolved ? '#22c55e' : '#f59e0b'),
        'color:#0f172a',
        'border:1.5px solid #ffffff',
        'font-size:11px',
        'font-weight:700',
        'cursor:' + (isEditing ? 'text' : 'pointer'),
        'box-shadow:0 3px 10px rgba(0,0,0,0.32)',
        'max-width:' + (isExpanded ? '300px' : '26px'),
        'white-space:nowrap',
        'overflow:hidden'
      ].join(';');

      pin.addEventListener('mouseenter', function() {
        if (hoveredId !== item.id && !editingId) {
          hoveredId = item.id;
          renderPins();
        }
      });
      pin.addEventListener('mouseleave', function() {
        if (hoveredId === item.id && !editingId) {
          hoveredId = null;
          renderPins();
        }
      });
      pin.addEventListener('click', function(ev) {
        ev.stopPropagation();
        closeMenu();
        if (!isEditing) {
          editingId = item.id;
          renderPins();
        }
      });
      pin.addEventListener('contextmenu', function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        openContextMenu(item, ev.clientX, ev.clientY);
      });

      var icon = document.createElement('span');
      icon.textContent = '💬';
      icon.style.fontSize = '11px';
      pin.appendChild(icon);

      if (isEditing) {
        var inp = document.createElement('input');
        inp.type = 'text';
        inp.value = item.text;
        inp.placeholder = 'Nhập ghi chú...';
        inp.style.cssText = 'width:175px;padding:2px 6px;border-radius:6px;border:1px solid rgba(15,23,42,0.25);background:#ffffff;color:#0f172a;font-size:11px;font-weight:600;outline:none;';
        inp.addEventListener('click', function(ev) { ev.stopPropagation(); });
        function commit() {
          var clean = inp.value.trim() || item.text;
          editingId = null;
          apiCall({ action: 'update', id: item.id, text: clean, author: authorName || item.author || 'Khách' });
        }
        inp.addEventListener('keydown', function(ev) {
          ev.stopPropagation();
          if (ev.key === 'Enter') {
            commit();
          } else if (ev.key === 'Escape') {
            editingId = null;
            renderPins();
          }
        });
        inp.addEventListener('blur', function() {
          if (editingId === item.id) commit();
        });
        pin.appendChild(inp);
        setTimeout(function() { inp.focus(); inp.select(); }, 10);
      } else if (isExpanded) {
        var txt = document.createElement('span');
        txt.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' + (item.resolved ? 'text-decoration:line-through;' : '');
        txt.textContent = (item.author ? '[' + item.author + '] ' : '') + item.text;
        pin.appendChild(txt);
      }

      pinsContainer.appendChild(pin);
    });
  }

  apiCall(null);
  setInterval(function() {
    if (!editingId) apiCall(null);
  }, 2000);
})();
</script>
`
}

function injectShareScriptIntoHtml(html: string, projectName: string): string {
  const script = buildInjectedShareScript(projectName)
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${script}\n</body>`)
  }
  return `${html}\n${script}`
}

const MIME_BY_EXT: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
}

async function serveStaticOrFallback(reqPath: string, res: http.ServerResponse): Promise<void> {
  const cleanRel = normalize(decodeURIComponent(reqPath.split('?')[0] || '/')).replace(/^(\.\.[\/\\])+/, '')
  const candidates =
    cleanRel === '/' || cleanRel === '\\' || cleanRel === '.'
      ? ['index.html', 'public/index.html', 'wwwroot/index.html']
      : [cleanRel.replace(/^[\/\\]+/, ''), join('wwwroot', cleanRel.replace(/^[\/\\]+/, ''))]

  for (const rel of candidates) {
    if (!currentProjectPath) break
    const full = join(currentProjectPath, rel)
    try {
      const stat = await fs.stat(full)
      if (stat.isFile()) {
        const ext = extname(full).toLowerCase()
        const mime = MIME_BY_EXT[ext] || 'application/octet-stream'
        if (ext === '.html' || ext === '.htm') {
          const raw = await fs.readFile(full, 'utf8')
          const body = injectShareScriptIntoHtml(raw, currentProjectName)
          res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' })
          res.end(body)
          return
        }
        const buf = await fs.readFile(full)
        res.writeHead(200, { 'Content-Type': mime })
        res.end(buf)
        return
      }
    } catch { }
  }

  const fallbackHtml = injectShareScriptIntoHtml(
    `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${currentProjectName} — Xem & Ghi chú</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 48px 24px; background: #f8fafc; color: #0f172a; text-align: center; }
    .card { max-width: 540px; margin: 40px auto; padding: 28px; border-radius: 16px; background: #ffffff; border: 1px solid #e2e8f0; box-shadow: 0 8px 24px rgba(15,23,42,0.06); }
    h1 { font-size: 20px; margin: 0 0 10px; }
    p { font-size: 14px; color: #475569; line-height: 1.6; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${currentProjectName}</h1>
    <p>Dự án đang ở chế độ chia sẻ <b>Chỉ xem & Ghi chú</b> trên trình duyệt. Hãy bật <b>Chạy dự án</b> trong PixelMind Desktop để xem giao diện trực tiếp, hoặc bấm <b>📌 Ghim ghi chú</b> ở góc dưới để để lại nhận xét trên trang này.</p>
  </div>
</body>
</html>`,
    currentProjectName,
  )
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(fallbackHtml)
}

function handleShareRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
  const urlStr = req.url || '/'

  // CORS cho phép trình duyệt truy cập API ghi chú
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // Endpoint đọc/ghi ghi chú (chỉ cho phép thao tác trên danh sách ghi chú, KHÔNG đụng vào mã nguồn dự án)
  if (urlStr.startsWith('/__pm_share/comments')) {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify({ projectName: currentProjectName, comments: commentsCache }))
      return
    }

    if (req.method === 'POST') {
      let body = ''
      req.on('data', (chunk) => {
        body += chunk.toString()
        if (body.length > 100_000) req.destroy()
      })
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}')
          if (payload.action === 'add') {
            const newComment: SharedComment = {
              id: String(payload.id || `comment-${Date.now()}`),
              x: Number(payload.x) || 100,
              y: Number(payload.y) || 100,
              text: String(payload.text || 'Ghi chú mới').slice(0, 500),
              route: normalizeRoute(payload.route),
              author: String(payload.author || 'Khách').slice(0, 40),
              resolved: false,
              createdAt: Date.now(),
            }
            commentsCache = [...commentsCache, newComment]
          } else if (payload.action === 'update' && payload.id) {
            commentsCache = commentsCache.map((c) =>
              c.id === payload.id
                ? {
                    ...c,
                    text: payload.text !== undefined ? String(payload.text).slice(0, 500) : c.text,
                    resolved: payload.resolved !== undefined ? Boolean(payload.resolved) : c.resolved,
                    author: payload.author !== undefined ? String(payload.author).slice(0, 40) : c.author,
                  }
                : c,
            )
          } else if (payload.action === 'delete' && payload.id) {
            commentsCache = commentsCache.filter((c) => c.id !== payload.id)
          }
          void saveProjectComments(currentProjectPath, commentsCache)
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ success: true, comments: commentsCache }))
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ success: false }))
        }
      })
      return
    }
  }

  // Proxy sang dev server của dự án đang chạy
  if (!currentTargetUrl) {
    void serveStaticOrFallback(urlStr, res)
    return
  }

  let target: URL
  try {
    target = new URL(urlStr, currentTargetUrl)
  } catch {
    void serveStaticOrFallback(urlStr, res)
    return
  }

  const client = target.protocol === 'https:' ? https : http
  const headers: Record<string, string | string[] | undefined> = { ...req.headers }
  headers.host = target.host
  // Yêu cầu upstream trả về nội dung không nén để có thể chèn thanh Ghi chú vào HTML
  headers['accept-encoding'] = 'identity'

  const proxyReq = client.request(
    target,
    {
      method: req.method,
      headers,
    },
    (proxyRes) => {
      const contentType = String(proxyRes.headers['content-type'] || '').toLowerCase()
      const outHeaders: http.OutgoingHttpHeaders = { ...proxyRes.headers }
      delete outHeaders['content-security-policy']
      delete outHeaders['content-security-policy-report-only']
      delete outHeaders['x-frame-options']

      // Nếu là trang HTML: chèn client Chỉ xem & Ghi chú
      if (contentType.includes('text/html')) {
        const chunks: Buffer[] = []
        proxyRes.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
        proxyRes.on('end', () => {
          const rawHtml = Buffer.concat(chunks).toString('utf8')
          const modifiedHtml = injectShareScriptIntoHtml(rawHtml, currentProjectName)
          const buf = Buffer.from(modifiedHtml, 'utf8')
          outHeaders['content-length'] = String(buf.byteLength)
          outHeaders['cache-control'] = 'no-store'
          res.writeHead(proxyRes.statusCode || 200, outHeaders)
          res.end(buf)
        })
        return
      }

      res.writeHead(proxyRes.statusCode || 200, outHeaders)
      proxyRes.pipe(res)
    },
  )

  proxyReq.on('error', () => {
    void serveStaticOrFallback(urlStr, res)
  })

  req.pipe(proxyReq)
}

export function getShareStatus(): ShareServerStatus {
  const lanIps = getLanAddresses()
  return {
    active: Boolean(server && activePort > 0),
    port: activePort,
    localUrl: activePort > 0 ? `http://localhost:${activePort}` : '',
    lanUrls: activePort > 0 ? lanIps.map((ip) => `http://${ip}:${activePort}`) : [],
    publicUrl,
    tunnelStatus,
    tunnelError,
    comments: commentsCache,
  }
}

export async function startShareServer(options: {
  projectPath: string
  projectName?: string
  targetUrl?: string | null
  comments?: SharedComment[]
}): Promise<ShareServerStatus> {
  if (options.projectPath && options.projectPath !== currentProjectPath) {
    currentProjectPath = options.projectPath
    const diskComments = await loadProjectComments(options.projectPath)
    if (options.comments && options.comments.length > 0 && diskComments.length === 0) {
      commentsCache = options.comments
      await saveProjectComments(options.projectPath, commentsCache)
    } else {
      commentsCache = diskComments
    }
  } else if (options.comments && options.comments.length > 0 && commentsCache.length === 0) {
    commentsCache = options.comments
    await saveProjectComments(currentProjectPath, commentsCache)
  }

  if (options.projectName) currentProjectName = options.projectName
  if (options.targetUrl !== undefined) currentTargetUrl = options.targetUrl || ''

  if (server && activePort > 0) {
    return getShareStatus()
  }

  await new Promise<void>((resolve, reject) => {
    const srv = http.createServer(handleShareRequest)
    srv.on('error', reject)
    srv.listen(0, '0.0.0.0', () => {
      const addr = srv.address()
      activePort = typeof addr === 'object' && addr ? addr.port : 0
      server = srv
      resolve()
    })
  })

  return getShareStatus()
}

export async function stopShareServer(): Promise<ShareServerStatus> {
  if (tunnelProc) {
    try {
      tunnelProc.kill()
    } catch { }
    tunnelProc = null
  }
  publicUrl = null
  tunnelStatus = 'idle'
  tunnelError = undefined

  if (server) {
    const srv = server
    server = null
    activePort = 0
    await new Promise<void>((resolve) => srv.close(() => resolve()))
  }
  return getShareStatus()
}

export async function syncShareComments(options: {
  projectPath: string
  targetUrl?: string | null
  projectName?: string
  comments?: SharedComment[]
}): Promise<ShareServerStatus> {
  if (options.projectName) currentProjectName = options.projectName
  if (options.targetUrl !== undefined && options.targetUrl) currentTargetUrl = options.targetUrl
  if (options.projectPath && options.projectPath !== currentProjectPath) {
    currentProjectPath = options.projectPath
    commentsCache = await loadProjectComments(options.projectPath)
  }
  if (Array.isArray(options.comments)) {
    commentsCache = options.comments
    await saveProjectComments(currentProjectPath, commentsCache)
  }
  return getShareStatus()
}

export async function startShareTunnel(): Promise<ShareServerStatus> {
  if (!server || activePort <= 0) {
    return getShareStatus()
  }
  if (tunnelProc && (tunnelStatus === 'ready' || tunnelStatus === 'starting')) {
    return getShareStatus()
  }

  tunnelStatus = 'starting'
  tunnelError = undefined
  publicUrl = null

  return await new Promise<ShareServerStatus>((resolve) => {
    let settled = false
    const finish = () => {
      if (!settled) {
        settled = true
        resolve(getShareStatus())
      }
    }

    // Sử dụng SSH reverse tunnel miễn phí (Forever-Free tier, tắt PubkeyAuthentication để không dính tài khoản trả phí)
    const proc = spawn(
      'ssh',
      [
        '-T',
        '-o',
        'StrictHostKeyChecking=no',
        '-o',
        'PubkeyAuthentication=no',
        '-o',
        'ServerAliveInterval=30',
        '-o',
        'ConnectTimeout=10',
        '-R',
        `80:127.0.0.1:${activePort}`,
        'nokey@localhost.run',
      ],
      { windowsHide: true },
    )
    tunnelProc = proc

    const onOutput = (chunk: Buffer) => {
      const text = chunk.toString('utf8')
      const match = text.match(/https:\/\/[a-zA-Z0-9.-]+\.lhr\.life/)
      if (match) {
        publicUrl = match[0]
        tunnelStatus = 'ready'
        finish()
      }
    }

    proc.stdout?.on('data', onOutput)
    proc.stderr?.on('data', onOutput)

    proc.on('error', (err) => {
      tunnelStatus = 'error'
      tunnelError = `Không khởi chạy được SSH Tunnel: ${err.message}`
      tunnelProc = null
      finish()
    })

    proc.on('exit', (code) => {
      if (tunnelProc === proc) {
        tunnelProc = null
        if (!publicUrl) {
          tunnelStatus = 'error'
          tunnelError = `Tunnel kết thúc sớm (mã ${code ?? -1}). Hãy kiểm tra kết nối mạng hoặc dùng link LAN.`
          finish()
        } else {
          publicUrl = null
          tunnelStatus = 'idle'
        }
      }
    })

    setTimeout(() => {
      if (!settled) {
        if (!publicUrl) {
          tunnelStatus = 'error'
          tunnelError = 'Quá thời gian chờ cấp link Internet. Bạn vẫn có thể dùng link LAN/Wi-Fi bên trên.'
        }
        finish()
      }
    }, 12000)
  })
}
