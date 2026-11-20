/* E2E D1-17: buildPartInsertItem (node) + savePart/listParts thật qua IPC + dữ liệu Part cũ. */
import { chromium } from 'playwright'
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildPartInsertItem } from 'file:///D:/Code/PixelMind/PixelMind/pixelmind-desktop/src/lib/toolboxBridge.ts'

const results = []
const check = (name, cond, extra = '') => {
  results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${cond ? '' : ` — ${extra}`}`)
  console.log(results.at(-1))
}

const project = join(await mkdtemp(join(tmpdir(), 'pm-parts-')), 'p')
await mkdir(join(project, '.pixelmind'), { recursive: true })

const part = {
  id: 'p1',
  name: 'Nút',
  html: '<button class="btn {{size}}" data-label="{{label}}">Bấm</button>',
  css: '.btn-{{size}}{padding:{{pad}}}',
  props: [
    { name: 'size', defaultValue: 'md' },
    { name: 'label', defaultValue: 'Gửi' },
    { name: 'pad', defaultValue: '8px' },
  ],
  variants: [
    { id: 'sm', name: 'Nhỏ', values: { size: 'sm', pad: '4px' } },
    { id: 'lg', name: 'Lớn', values: { size: 'lg', pad: '16px' } },
  ],
}

// 1. Hai biến thể → đầu ra khác nhau, hết placeholder
const small = buildPartInsertItem(part, 'sm')
const large = buildPartInsertItem(part, 'lg')
check('hai biến thể cho đầu ra khác nhau', small.html !== large.html, `${small.html} | ${large.html}`)
check('biến thể nhỏ: đúng giá trị', small.html.includes('class="btn sm"') && small.html.includes('data-label="Gửi"') && small.css.includes('padding:4px'), small.html)
check('biến thể lớn: đúng giá trị', large.html.includes('class="btn lg"') && large.css.includes('padding:16px'), large.html)
check('không còn {{...}}', !/\{\{/.test(small.html + small.css), small.html + small.css)
check('không chọn biến thể → props mặc định', buildPartInsertItem(part, null).html.includes('class="btn md"'), buildPartInsertItem(part, null).html)

// 2. Part cũ (không props/variants) → y nguyên
const oldPart = { id: 'old', name: 'Cũ', html: '<div class="x">cũ</div>', css: '.x{color:red}' }
const oldItem = buildPartInsertItem(oldPart, 'bat-ky')
check('Part cũ: html/css y nguyên', oldItem.html === oldPart.html && oldItem.css === oldPart.css, JSON.stringify(oldItem))

// 3. Lưu Part có biến thể qua IPC, đọc lại từ đĩa
const browser = await chromium.connectOverCDP('http://127.0.0.1:9229')
const page = browser.contexts()[0].pages()[0]
const saved = await page.evaluate(
  (input) => window.pixelmind.toolbox.savePart(input),
  { name: 'Nút biến thể', html: part.html, css: part.css, props: part.props, variants: part.variants, projectPath: project },
)
check('savePart thành công', saved.success === true, JSON.stringify(saved))
check('savePart giữ props + variants', saved.part?.props?.length === 3 && saved.part?.variants?.length === 2, JSON.stringify(saved.part ?? {}))

const listed = await page.evaluate((p) => window.pixelmind.toolbox.listParts(p), project)
check('listParts đọc lại đúng Part', listed.success === true && listed.parts.some((p) => p.name === 'Nút biến thể' && p.variants?.length === 2), JSON.stringify(listed).slice(0, 250))

const onDisk = JSON.parse(await readFile(join(project, '.pixelmind', 'custom-parts.json'), 'utf8'))
check('file lưu có variants', onDisk.parts?.[0]?.variants?.length === 2, JSON.stringify(onDisk).slice(0, 200))

// 4. Biến thể chứa mã nguy hiểm → bị chặn
const evil = await page.evaluate(
  (p) => window.pixelmind.toolbox.savePart({ name: 'Xấu', html: '<div>{{x}}</div>', props: [{ name: 'x', defaultValue: 'a' }], variants: [{ id: 'v', name: 'V', values: { x: '<script>alert(1)</script>' } }], projectPath: p }),
  project,
)
check('biến thể chứa <script> bị từ chối', evil.success === false && !!evil.error, JSON.stringify(evil))

// 5. Dữ liệu Part cũ trên đĩa (không có props/variants) vẫn đọc được
const legacyDir = join(await mkdtemp(join(tmpdir(), 'pm-parts-old-')), 'p')
await mkdir(join(legacyDir, '.pixelmind'), { recursive: true })
await writeFile(
  join(legacyDir, '.pixelmind', 'custom-parts.json'),
  JSON.stringify({ version: 1, parts: [{ id: 'legacy-1', name: 'Part cũ', description: '', html: '<div class="y">y</div>', language: 'html', tags: ['custom'], createdAt: 1, updatedAt: 1 }] }, null, 2),
)
const legacy = await page.evaluate((p) => window.pixelmind.toolbox.listParts(p), legacyDir)
const legacyPart = legacy.parts.find((p) => p.name === 'Part cũ')
check('Part cũ trên đĩa: listParts đọc được', legacy.success === true && !!legacyPart, JSON.stringify(legacy.parts.map((p) => p.name)))
check('Part cũ: không có variants, chèn y nguyên', legacyPart && legacyPart.variants === undefined && buildPartInsertItem(legacyPart).html === '<div class="y">y</div>')

// Dọn Part đã lưu trong lúc test (kho toàn cục cũng nhận bản sao)
if (saved.part?.id) await page.evaluate(({ id, p }) => window.pixelmind.toolbox.deletePart(id, p), { id: saved.part.id, p: project })

await browser.close()
const failed = results.filter((r) => r.startsWith('FAIL'))
console.log(failed.length ? `\n${failed.length} FAIL` : '\nTẤT CẢ PART E2E PASS')
process.exit(failed.length ? 1 : 0)
