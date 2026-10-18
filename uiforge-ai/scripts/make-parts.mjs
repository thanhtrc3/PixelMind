/* ══════════════════════════════════════════════════════════════
   Sinh kho part cho Search Toolbox (mục 2.13 — CN12)

   Mỗi part = một thư mục trong /toolbox gồm 5 tệp:
     meta.json    — “căn cước”: tên, nhóm, tags, phiên bản, DESIGN.md,
                    tác giả, nguồn gốc, giấy phép, trạng thái duyệt
     preview.png  — ảnh chụp nhỏ để lướt mắt chọn (sinh bằng script này)
     sample.html  — code khung sườn
     sample.css   — code màu sắc, kiểu dáng (chỉ dùng biến token)
     prompt.txt   — mô tả ngắn cho AI: kích thước, bo góc, vị trí icon,
                    màu khi bấm vào

   Chạy:  node scripts/make-parts.mjs
   ══════════════════════════════════════════════════════════════ */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOOLBOX = join(root, 'toolbox');

/* ═══════════════ 1. Bộ mã hoá PNG (không cần thư viện ngoài) ═══════════════ */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

const crc32 = (buf) => {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
};

const encodePNG = (w, h, rgba) => {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

/* ═══════════════ 2. Vẽ vector đơn giản lên bitmap (siêu mẫu ×2) ═══════════════ */

const OUT_W = 520;
const OUT_H = 340;
const SS = 2; // supersample để cạnh mượt
const W = OUT_W * SS;
const H = OUT_H * SS;

/* Bảng màu cho ảnh xem trước — nền sáng cho khớp với chính code mẫu
   (sample.css dùng thẻ trắng, viền #e6e6ea, chữ #24242c, nhấn #6d5df5) */
const COL = {
  bg:      [244, 245, 248, 255],
  grid:    [231, 233, 239, 255],
  surface: [255, 255, 255, 255],
  raised:  [241, 242, 246, 255],
  border:  [222, 224, 231, 255],
  bar:     [78, 82, 94, 255],
  barDim:  [172, 177, 188, 255],
  accent:  [109, 93, 245, 255],
  accentD: [90, 74, 224, 255],
  white:   [255, 255, 255, 255],
  green:   [49, 192, 122, 255],
  amber:   [226, 177, 60, 255],
};

const canvas = () => Buffer.alloc(W * H * 4);

const blend = (buf, i, c) => {
  const a = (c[3] === undefined ? 255 : c[3]) / 255;
  if (a <= 0) return;
  buf[i] = Math.round(buf[i] * (1 - a) + c[0] * a);
  buf[i + 1] = Math.round(buf[i + 1] * (1 - a) + c[1] * a);
  buf[i + 2] = Math.round(buf[i + 2] * (1 - a) + c[2] * a);
  buf[i + 3] = 255;
};

const fill = (buf, c) => {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) blend(buf, (y * W + x) * 4, c);
};

const rect = (buf, x, y, w, h, c) => {
  const x0 = Math.max(0, Math.round(x * SS));
  const y0 = Math.max(0, Math.round(y * SS));
  const x1 = Math.min(W, Math.round((x + w) * SS));
  const y1 = Math.min(H, Math.round((y + h) * SS));
  for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) blend(buf, (j * W + i) * 4, c);
};

/* Bo góc: kiểm tra khoảng cách tới 4 góc */
const insideRound = (i, j, x, y, w, h, r) => {
  const x0 = x, y0 = y, x1 = x + w - 1, y1 = y + h - 1;
  const dx = Math.max(x0 + r - i, i - (x1 - r), 0);
  const dy = Math.max(y0 + r - j, j - (y1 - r), 0);
  return dx * dx + dy * dy <= r * r + 0.0001;
};

const roundRect = (buf, x, y, w, h, r, c) => {
  const x0 = Math.max(0, Math.floor(x * SS));
  const y0 = Math.max(0, Math.floor(y * SS));
  const x1 = Math.min(W, Math.ceil((x + w) * SS));
  const y1 = Math.min(H, Math.ceil((y + h) * SS));
  for (let j = y0; j < y1; j++) {
    for (let i = x0; i < x1; i++) {
      if (insideRound(i, j, x * SS, y * SS, w * SS, h * SS, r * SS)) blend(buf, (j * W + i) * 4, c);
    }
  }
};

const strokeRound = (buf, x, y, w, h, r, c, t = 1.5) => {
  const x0 = Math.max(0, Math.floor(x * SS));
  const y0 = Math.max(0, Math.floor(y * SS));
  const x1 = Math.min(W, Math.ceil((x + w) * SS));
  const y1 = Math.min(H, Math.ceil((y + h) * SS));
  const tt = t * SS;
  for (let j = y0; j < y1; j++) {
    for (let i = x0; i < x1; i++) {
      const outer = insideRound(i, j, x * SS, y * SS, w * SS, h * SS, r * SS);
      const inner = insideRound(i, j, x * SS + tt, y * SS + tt, (w - t * 2) * SS, (h - t * 2) * SS, Math.max(0, (r - t) * SS));
      if (outer && !inner) blend(buf, (j * W + i) * 4, c);
    }
  }
};

const circle = (buf, cx, cy, r, c) => {
  const x0 = Math.max(0, Math.floor((cx - r) * SS));
  const y0 = Math.max(0, Math.floor((cy - r) * SS));
  const x1 = Math.min(W, Math.ceil((cx + r) * SS));
  const y1 = Math.min(H, Math.ceil((cy + r) * SS));
  const rr = r * SS * r * SS;
  for (let j = y0; j < y1; j++) {
    for (let i = x0; i < x1; i++) {
      const dx = i - cx * SS, dy = j - cy * SS;
      if (dx * dx + dy * dy <= rr) blend(buf, (j * W + i) * 4, c);
    }
  }
};

const line = (buf, x, y, w, c, t = 2) => rect(buf, x, y, w, t, c);

/* Kính lúp: vòng + tay cầm */
const magnifier = (buf, cx, cy, r, c) => {
  circle(buf, cx, cy, r, c);
  circle(buf, cx, cy, r - 1.4, COL.surface);
  rect(buf, cx + r - 1.2, cy + r - 1.2, 4, 1.8, c);
};

const panel = (buf, x, y, w, h, r = 10, bg = COL.surface, bd = COL.border) => {
  roundRect(buf, x + 1.5, y + 3, w, h, r, [16, 20, 32, 20]);
  roundRect(buf, x, y, w, h, r, bg);
  strokeRound(buf, x, y, w, h, r, bd, 1.4);
};

const downsample = (buf) => {
  const out = Buffer.alloc(OUT_W * OUT_H * 4);
  for (let y = 0; y < OUT_H; y++) {
    for (let x = 0; x < OUT_W; x++) {
      let r = 0, g = 0, b = 0;
      for (let dy = 0; dy < SS; dy++) {
        for (let dx = 0; dx < SS; dx++) {
          const i = ((y * SS + dy) * W + (x * SS + dx)) * 4;
          r += buf[i]; g += buf[i + 1]; b += buf[i + 2];
        }
      }
      const n = SS * SS;
      const o = (y * OUT_W + x) * 4;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
      out[o + 3] = 255;
    }
  }
  return out;
};

/* Nền chung cho mọi ảnh preview */
const backdrop = (buf) => {
  fill(buf, COL.bg);
  for (let x = 40; x < OUT_W - 40; x += 22) rect(buf, x, 30, 1, OUT_H - 60, COL.grid);
  for (let y = 30; y < OUT_H - 30; y += 22) rect(buf, 40, y, OUT_W - 80, 1, COL.grid);
};

/* ═══════════════ 3. 12 part ═══════════════ */

const PARTS = [
  /* ── 1 ── */
  {
    id: 'searchbox-card',
    name: 'Ô tìm kiếm dạng card viền',
    groups: ['search', 'form', 'navigation', 'hero'],
    tags: ['search', 'searchbox', 'ô tìm kiếm', 'viền', 'card', 'bo tròn', 'tìm kiếm'],
    version: '2.1.0',
    status: 'approved',
    demo: true,
    uses: 18,
    rejects: 0,
    updated: '2026-10-12',
    draw: (b) => {
      panel(b, 60, 138, 400, 64, 16);
      magnifier(b, 92, 170, 8, COL.bar);
      line(b, 116, 162, 150, COL.barDim, 8);
      line(b, 116, 176, 96, COL.barDim, 6);
      roundRect(b, 356, 152, 88, 36, 10, COL.accent);
      line(b, 382, 167, 36, [255, 255, 255, 210], 6);
    },
    html: `
<section class="pt-searchbox-card">
  <span class="pt-searchbox-card__icon" aria-hidden="true">
    <svg viewBox="0 0 16 16" width="16" height="16">
      <circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.6" />
      <line x1="10.6" y1="10.6" x2="14.4" y2="14.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
    </svg>
  </span>
  <input class="pt-searchbox-card__input" type="search" placeholder="Tìm sản phẩm, tài liệu, bài viết…" />
  <button class="pt-searchbox-card__btn" type="button">Tìm</button>
</section>
`,
    css: `
/* Ô tìm kiếm dạng card có viền — token lấy từ DESIGN.md */
.pt-searchbox-card {
  --pt-radius: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  max-width: 520px;
  padding: 12px 12px 12px 14px;
  border-radius: var(--pt-radius);
  background: #ffffff;
  border: 1.5px solid #e6e6ea;
  box-shadow: 0 8px 24px rgba(43, 39, 64, 0.06);
  font-family: var(--font-ui);
  transition: border-color 160ms ease, box-shadow 160ms ease;
}
.pt-searchbox-card:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px hsla(262, 82%, 60%, 0.16);
}
.pt-searchbox-card__icon { display: grid; place-items: center; color: #86868f; }
.pt-searchbox-card__input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  font: inherit;
  font-size: 14px;
  color: #24242c;
}
.pt-searchbox-card__input::placeholder { color: #9494a0; }
.pt-searchbox-card__btn {
  height: 36px;
  padding: 0 16px;
  border: 0;
  border-radius: calc(var(--pt-radius) - 6px);
  background: var(--accent);
  color: var(--text-on-accent);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 120ms ease;
}
.pt-searchbox-card__btn:active { background: var(--accent-hover); }
`,
    prompt: `Ô tìm kiếm dạng card có viền, đặt ở đầu trang.
- Kích thước: rộng tối đa 520px, cao 64px, padding 12px 14px
- Bo góc: 16px (theo --radius-lg của DESIGN.md), nút bên trong bo 10px
- Vị trí icon: kính lúp sát trái, cách mép 14px, màu #86868f, không bao giờ nằm trong nút
- Nút "Tìm": cao 36px, nền màu nhấn tím, chữ trắng, đậm 600
- Khi focus vào ô nhập: viền đổi sang màu nhấn + vòng sáng 3px tím nhạt
- Khi bấm nút: nền chuyển sang tím đậm hơn (--accent-hover)
- Chữ gợi ý khi rỗng: màu #9494a0`,
  },

  /* ── 2 ── */
  {
    id: 'searchbox-inline',
    name: 'Ô tìm kiếm trong thanh điều hướng',
    groups: ['search', 'navigation', 'header', 'layout'],
    tags: ['search', 'searchbox', 'nav', 'thanh điều hướng', 'inline', 'tìm kiếm'],
    version: '1.4.2',
    status: 'approved',
    demo: true,
    uses: 11,
    rejects: 0,
    updated: '2026-10-08',
    draw: (b) => {
      panel(b, 40, 96, 440, 52, 12);
      circle(b, 66, 122, 7, COL.raised);
      line(b, 84, 118, 46, COL.barDim, 7);
      line(b, 150, 118, 34, COL.barDim, 7);
      line(b, 198, 118, 40, COL.barDim, 7);
      roundRect(b, 300, 106, 160, 32, 16, COL.raised);
      magnifier(b, 320, 122, 6.5, COL.bar);
      line(b, 336, 118, 70, COL.barDim, 7);
    },
    html: `
<header class="pt-searchbox-inline">
  <span class="pt-searchbox-inline__brand">Northwind</span>
  <nav class="pt-searchbox-inline__links">
    <a href="#">Sản phẩm</a>
    <a href="#">Giải pháp</a>
    <a href="#">Bảng giá</a>
  </nav>
  <form class="pt-searchbox-inline__box" role="search">
    <span class="pt-searchbox-inline__icon" aria-hidden="true"></span>
    <input type="search" placeholder="Tìm nhanh…" aria-label="Tìm nhanh" />
  </form>
</header>
`,
    css: `
/* Ô tìm kiếm dạng viên nằm trong thanh điều hướng */
.pt-searchbox-inline {
  display: flex;
  align-items: center;
  gap: 24px;
  height: 68px;
  padding: 0 20px;
  border-radius: var(--radius-md);
  background: #ffffff;
  border-bottom: 1px solid #ebebef;
  font-family: var(--font-ui);
}
.pt-searchbox-inline__brand { font-weight: 700; font-size: 15px; color: #24242c; }
.pt-searchbox-inline__links { display: flex; gap: 18px; font-size: 13px; }
.pt-searchbox-inline__links a { color: #6a6a74; text-decoration: none; }
.pt-searchbox-inline__links a:hover { color: var(--accent); }
.pt-searchbox-inline__box {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  background: #f3f3f6;
  border: 1px solid transparent;
  transition: border-color 140ms ease, background 140ms ease;
}
.pt-searchbox-inline__box:focus-within { border-color: var(--accent); background: #ffffff; }
.pt-searchbox-inline__icon {
  width: 12px; height: 12px;
  border: 1.6px solid #86868f;
  border-radius: 50%;
  position: relative;
}
.pt-searchbox-inline__icon::after {
  content: "";
  position: absolute;
  right: -4px; bottom: -3px;
  width: 6px; height: 1.6px;
  background: #86868f;
  transform: rotate(45deg);
}
.pt-searchbox-inline__box input {
  width: 150px;
  border: 0;
  outline: 0;
  background: transparent;
  font: inherit;
  font-size: 13px;
  color: #24242c;
}
`,
    prompt: `Ô tìm kiếm con nhộng nằm trong thanh điều hướng, đẩy sát phải.
- Kích thước: cao 36px, rộng 150px phần chữ, padding 0 12px; thanh nav cao 68px
- Bo góc: viên thuốc hoàn toàn (999px); nav bo 12px
- Vị trí icon: kính lúp cách trái 12px, màu #86868f, chỉ vẽ bằng CSS (không dùng ảnh)
- Khi focus: nền từ #f3f3f6 sang trắng, viền 1px màu nhấn tím
- Link menu: màu #6a6a74, khi hover đổi sang màu nhấn
- Không có nút bấm kèm theo, chỉ nhập và Enter`,
  },

  /* ── 3 ── */
  {
    id: 'searchbox-suggest',
    name: 'Ô tìm kiếm kèm chip gợi ý',
    groups: ['search', 'form', 'feedback'],
    tags: ['search', 'searchbox', 'gợi ý', 'chip', 'tag', 'tìm kiếm'],
    version: '1.0.3',
    status: 'approved',
    demo: true,
    uses: 6,
    rejects: 1,
    updated: '2026-10-05',
    draw: (b) => {
      panel(b, 60, 104, 400, 56, 14);
      magnifier(b, 88, 132, 7.5, COL.bar);
      line(b, 110, 128, 140, COL.barDim, 8);
      const chips = ['Tài liệu', 'Bảng giá', 'API'];
      chips.forEach((_, i) => {
        roundRect(b, 60 + i * 96, 182, 84, 30, 15, COL.raised);
        strokeRound(b, 60 + i * 96, 182, 84, 30, 15, COL.border, 1.2);
        line(b, 74 + i * 96, 195, 56, COL.barDim, 6);
      });
      roundRect(b, 60, 182, 84, 30, 15, COL.accentD);
      line(b, 74, 195, 56, COL.white, 6);
    },
    html: `
<section class="pt-searchbox-suggest">
  <div class="pt-searchbox-suggest__box">
    <span class="pt-searchbox-suggest__icon" aria-hidden="true"></span>
    <input type="search" placeholder="Bạn muốn tìm gì?" />
  </div>
  <div class="pt-searchbox-suggest__chips">
    <button type="button" class="pt-searchbox-suggest__chip is-active">Tài liệu</button>
    <button type="button" class="pt-searchbox-suggest__chip">Bảng giá</button>
    <button type="button" class="pt-searchbox-suggest__chip">API</button>
    <button type="button" class="pt-searchbox-suggest__chip">Hướng dẫn</button>
  </div>
</section>
`,
    css: `
/* Ô tìm kiếm kèm dãy chip gợi ý từ khoá phổ biến */
.pt-searchbox-suggest { font-family: var(--font-ui); max-width: 520px; }
.pt-searchbox-suggest__box {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 56px;
  padding: 0 14px;
  border-radius: 14px;
  background: #ffffff;
  border: 1.5px solid #e6e6ea;
}
.pt-searchbox-suggest__box:focus-within { border-color: var(--accent); }
.pt-searchbox-suggest__icon {
  width: 13px; height: 13px;
  border: 1.8px solid #86868f;
  border-radius: 50%;
  position: relative;
  flex-shrink: 0;
}
.pt-searchbox-suggest__icon::after {
  content: "";
  position: absolute;
  right: -4.5px; bottom: -3px;
  width: 7px; height: 1.8px;
  background: #86868f;
  transform: rotate(45deg);
}
.pt-searchbox-suggest__box input {
  flex: 1; min-width: 0;
  border: 0; outline: 0; background: transparent;
  font: inherit; font-size: 14px; color: #24242c;
}
.pt-searchbox-suggest__chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.pt-searchbox-suggest__chip {
  height: 30px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid #e6e6ea;
  background: #ffffff;
  color: #575763;
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}
.pt-searchbox-suggest__chip:hover { border-color: var(--accent); color: var(--accent); }
.pt-searchbox-suggest__chip.is-active {
  background: var(--accent-muted);
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 600;
}
`,
    prompt: `Ô tìm kiếm kèm chip gợi ý, đặt giữa vùng nội dung.
- Ô nhập: cao 56px, bo góc 14px, padding 0 14px, viền 1.5px #e6e6ea
- Vị trí icon: kính lúp cách trái 14px, vẽ bằng CSS
- Chip: cao 30px, bo viên thuốc, cách nhau 8px, cách ô nhập 10px
- Chip đang chọn: nền tím nhạt, viền màu nhấn, chữ tím đậm 600
- Chip khi hover: viền + chữ đổi sang màu nhấn tím
- Khi focus ô nhập: viền đổi sang màu nhấn, không đổ bóng`,
  },

  /* ── 4 ── */
  {
    id: 'button-cta-primary',
    name: 'Nút CTA chính',
    groups: ['button', 'form', 'hero', 'feedback'],
    tags: ['button', 'cta', 'nút', 'kêu gọi', 'hero', 'bấm'],
    version: '3.0.1',
    status: 'approved',
    demo: true,
    uses: 42,
    rejects: 0,
    updated: '2026-10-14',
    draw: (b) => {
      roundRect(b, 100, 140, 170, 52, 14, COL.accent);
      line(b, 136, 161, 98, [255, 255, 255, 225], 9);
      roundRect(b, 284, 140, 136, 52, 14, COL.raised);
      strokeRound(b, 284, 140, 136, 52, 14, COL.border, 1.4);
      line(b, 314, 161, 76, COL.bar, 9);
      line(b, 100, 214, 200, COL.barDim, 6);
    },
    html: `
<div class="pt-button-cta">
  <button type="button" class="pt-button-cta__main">Bắt đầu miễn phí</button>
  <button type="button" class="pt-button-cta__ghost">Xem demo</button>
</div>
`,
    css: `
/* Cặp nút kêu gọi hành động ở vùng hero */
.pt-button-cta { display: inline-flex; align-items: center; gap: 14px; font-family: var(--font-ui); }
.pt-button-cta__main,
.pt-button-cta__ghost {
  height: 52px;
  padding: 0 26px;
  border-radius: 14px;
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 120ms ease, background 140ms ease, box-shadow 140ms ease;
}
.pt-button-cta__main {
  border: 0;
  background: var(--accent);
  color: var(--text-on-accent);
  box-shadow: 0 10px 24px hsla(262, 82%, 60%, 0.28);
}
.pt-button-cta__main:hover { background: var(--accent-hover); }
.pt-button-cta__main:active { transform: translateY(1px); box-shadow: 0 4px 12px hsla(262, 82%, 60%, 0.3); }
.pt-button-cta__ghost {
  background: transparent;
  color: #48484f;
  border: 1.5px solid #dcdce2;
}
.pt-button-cta__ghost:hover { border-color: var(--accent); color: var(--accent); }
`,
    prompt: `Cặp nút kêu gọi hành động ở vùng hero, nút chính bên trái.
- Kích thước: cao 52px, padding 0 26px, chữ 15px đậm 600, hai nút cách nhau 14px
- Bo góc: 14px, giống bo góc card trong DESIGN.md
- Nút chính: nền màu nhấn tím, chữ trắng, bóng đổ tím mờ 0 10px 24px
- Nút phụ: nền trong suốt, viền 1.5px #dcdce2, chữ #48484f
- Khi bấm: nút chính dịch xuống 1px và bóng ngắn lại, nền sang tím đậm
- Khi hover: nút phụ đổi viền và chữ sang màu nhấn
- Không đặt icon nếu chữ đã rõ nghĩa`,
  },

  /* ── 5 ── */
  {
    id: 'card-feature-3col',
    name: 'Card tính năng 3 cột',
    groups: ['card', 'layout', 'marketing', 'feedback'],
    tags: ['card', 'feature', 'tính năng', 'lưới', '3 cột', 'thẻ'],
    version: '2.2.0',
    status: 'approved',
    demo: true,
    uses: 24,
    rejects: 0,
    updated: '2026-10-11',
    draw: (b) => {
      for (let i = 0; i < 3; i++) {
        const x = 44 + i * 148;
        const hl = i === 1;
        panel(b, x, 106, 132, 150, 12, hl ? COL.raised : COL.surface, hl ? COL.accent : COL.border);
        roundRect(b, x + 16, 122, 34, 34, 10, hl ? COL.accentD : COL.raised);
        line(b, x + 16, 170, 92, COL.bar, 7);
        line(b, x + 16, 186, 100, COL.barDim, 6);
        line(b, x + 16, 198, 72, COL.barDim, 6);
      }
    },
    html: `
<div class="pt-card-feature">
  <article class="pt-card-feature__item">
    <span class="pt-card-feature__ico" aria-hidden="true"></span>
    <h3>Nhìn thấy lỗi</h3>
    <p>So ảnh mẫu với giao diện thật và đánh dấu từng chỗ lệch.</p>
  </article>
  <article class="pt-card-feature__item is-highlight">
    <span class="pt-card-feature__ico" aria-hidden="true"></span>
    <h3>Sửa bằng AI</h3>
    <p>Mô tả bằng tiếng Việt, AI sửa mã nguồn rồi chụp lại để so sánh.</p>
  </article>
  <article class="pt-card-feature__item">
    <span class="pt-card-feature__ico" aria-hidden="true"></span>
    <h3>Kiểm tra tự động</h3>
    <p>Chạy vòng kiểm tra sau mỗi lần sửa và ghi lại kết quả.</p>
  </article>
</div>
`,
    css: `
/* Lưới ba card tính năng, card giữa được làm nổi */
.pt-card-feature {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  font-family: var(--font-ui);
}
.pt-card-feature__item {
  padding: 20px;
  border-radius: 12px;
  background: #ffffff;
  border: 1.5px solid #ebebef;
  transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
}
.pt-card-feature__item:hover {
  transform: translateY(-2px);
  border-color: var(--accent);
  box-shadow: 0 12px 28px rgba(43, 39, 64, 0.08);
}
.pt-card-feature__item.is-highlight { border-color: var(--accent); background: #f8f8fa; }
.pt-card-feature__ico {
  display: block;
  width: 34px; height: 34px;
  border-radius: 10px;
  background: var(--accent-muted);
  border: 1px solid hsla(262, 82%, 60%, 0.28);
  margin-bottom: 14px;
}
.pt-card-feature__item h3 { margin: 0 0 6px; font-size: 15px; color: #24242c; }
.pt-card-feature__item p { margin: 0; font-size: 13px; line-height: 1.55; color: #6a6a74; }
`,
    prompt: `Lưới ba card tính năng nằm ngang dưới vùng hero.
- Kích thước: mỗi card rộng chia đều 3 cột, cách nhau 18px, padding trong 20px
- Bo góc: 12px; ô icon bo 10px, kích thước 34×34, cách chữ 14px
- Thứ tự trong card: icon → tiêu đề → mô tả
- Card giữa được làm nổi: viền màu nhấn tím, nền #f8f8fa
- Khi hover: card nhấc lên 2px, viền đổi sang màu nhấn
- Tiêu đề 15px màu #24242c, mô tả 13px màu #6a6a74, giãn dòng 1.55`,
  },

  /* ── 6 ── */
  {
    id: 'tabs-pill',
    name: 'Tab dạng viên',
    groups: ['navigation', 'layout', 'form'],
    tags: ['tab', 'viên', 'pill', 'điều hướng', 'chuyển mục'],
    version: '1.6.0',
    status: 'approved',
    demo: true,
    uses: 9,
    rejects: 0,
    updated: '2026-10-09',
    draw: (b) => {
      roundRect(b, 56, 138, 408, 50, 25, COL.surface);
      strokeRound(b, 56, 138, 408, 50, 25, COL.border, 1.2);
      roundRect(b, 62, 144, 118, 38, 19, COL.accent);
      line(b, 90, 162, 62, [255, 255, 255, 220], 7);
      line(b, 204, 162, 58, COL.barDim, 7);
      line(b, 288, 162, 52, COL.barDim, 7);
      line(b, 366, 162, 62, COL.barDim, 7);
    },
    html: `
<div class="pt-tabs-pill" role="tablist">
  <button type="button" role="tab" class="pt-tabs-pill__tab is-active" aria-selected="true">Tổng quan</button>
  <button type="button" role="tab" class="pt-tabs-pill__tab" aria-selected="false">Tính năng</button>
  <button type="button" role="tab" class="pt-tabs-pill__tab" aria-selected="false">Bảng giá</button>
  <button type="button" role="tab" class="pt-tabs-pill__tab" aria-selected="false">Câu hỏi</button>
</div>
`,
    css: `
/* Dãy tab dạng viên, cả dãy nằm trong một khung bo tròn */
.pt-tabs-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px;
  border-radius: 999px;
  background: #f3f3f6;
  border: 1px solid #ebebef;
  font-family: var(--font-ui);
}
.pt-tabs-pill__tab {
  height: 38px;
  padding: 0 20px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #6a6a74;
  font: inherit;
  font-size: 13.5px;
  cursor: pointer;
  transition: background 140ms ease, color 140ms ease;
}
.pt-tabs-pill__tab:hover { color: #24242c; }
.pt-tabs-pill__tab.is-active {
  background: var(--accent);
  color: var(--text-on-accent);
  font-weight: 600;
  box-shadow: 0 4px 12px hsla(262, 82%, 60%, 0.28);
}
`,
    prompt: `Dãy tab dạng viên dùng để chuyển mục trong trang.
- Kích thước: mỗi tab cao 38px, padding 0 20px, cả dãy có padding 6px, cách nhau 4px
- Bo góc: viên thuốc hoàn toàn (999px) cho cả khung và từng tab
- Nền khung: #f3f3f6, viền 1px #ebebef
- Tab đang chọn: nền màu nhấn tím, chữ trắng đậm 600, bóng tím mờ
- Tab thường: chữ #6a6a74, khi hover chữ đậm lên #24242c
- Khi bấm tab khác: chỉ đổi nền, không đổi kích thước để tránh nhảy bố cục`,
  },

  /* ── 7 ── */
  {
    id: 'table-pricing',
    name: 'Bảng giá ba gói',
    groups: ['card', 'table', 'layout', 'marketing'],
    tags: ['bảng giá', 'pricing', 'gói', 'bảng', 'so sánh'],
    version: '1.1.0',
    status: 'pending',
    demo: false,
    uses: 3,
    rejects: 1,
    updated: '2026-10-15',
    note: 'Đang chờ reviewer duyệt phần bảng so sánh.',
    draw: (b) => {
      for (let i = 0; i < 3; i++) {
        const x = 44 + i * 148;
        const mid = i === 1;
        panel(b, x, mid ? 92 : 108, 132, mid ? 168 : 136, 12, mid ? COL.raised : COL.surface, mid ? COL.accent : COL.border);
        line(b, x + 16, (mid ? 92 : 108) + 18, 64, COL.bar, 7);
        line(b, x + 16, (mid ? 92 : 108) + 38, 46, COL.accent, 10);
        line(b, x + 16, (mid ? 92 : 108) + 60, 92, COL.barDim, 5);
        line(b, x + 16, (mid ? 92 : 108) + 74, 78, COL.barDim, 5);
        roundRect(b, x + 16, (mid ? 92 : 108) + (mid ? 128 : 100), 100, 28, 8, mid ? COL.accent : COL.raised);
      }
    },
    html: `
<div class="pt-table-pricing">
  <article class="pt-table-pricing__col">
    <h3>Cơ bản</h3>
    <p class="pt-table-pricing__price">0₫<span>/tháng</span></p>
    <ul><li>1 dự án</li><li>3 khung màn hình</li></ul>
    <button type="button">Chọn gói</button>
  </article>
  <article class="pt-table-pricing__col is-featured">
    <span class="pt-table-pricing__tag">Phổ biến</span>
    <h3>Nhóm</h3>
    <p class="pt-table-pricing__price">290.000₫<span>/tháng</span></p>
    <ul><li>10 dự án</li><li>Không giới hạn khung</li><li>Duyệt 3 vòng</li></ul>
    <button type="button">Chọn gói</button>
  </article>
  <article class="pt-table-pricing__col">
    <h3>Doanh nghiệp</h3>
    <p class="pt-table-pricing__price">Liên hệ</p>
    <ul><li>Không giới hạn</li><li>Máy chủ riêng</li></ul>
    <button type="button">Liên hệ</button>
  </article>
</div>
`,
    css: `
/* Ba cột gói dịch vụ, cột giữa được làm nổi và có nhãn */
.pt-table-pricing {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  align-items: start;
  font-family: var(--font-ui);
}
.pt-table-pricing__col {
  position: relative;
  padding: 20px 18px;
  border-radius: 12px;
  background: #ffffff;
  border: 1.5px solid #ebebef;
  text-align: center;
}
.pt-table-pricing__col.is-featured {
  border-color: var(--accent);
  box-shadow: 0 14px 30px rgba(43, 39, 64, 0.08);
  transform: translateY(-8px);
}
.pt-table-pricing__tag {
  position: absolute;
  top: -11px; left: 50%;
  transform: translateX(-50%);
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--accent);
  color: var(--text-on-accent);
  font-size: 11px;
  font-weight: 600;
}
.pt-table-pricing__col h3 { margin: 0 0 8px; font-size: 14px; color: #24242c; }
.pt-table-pricing__price { margin: 0 0 14px; font-size: 24px; font-weight: 700; color: #24242c; }
.pt-table-pricing__price span { font-size: 12px; font-weight: 400; color: #86868f; }
.pt-table-pricing__col ul { margin: 0 0 16px; padding: 0; list-style: none; font-size: 13px; color: #6a6a74; }
.pt-table-pricing__col li { padding: 5px 0; border-top: 1px dashed #ebebef; }
.pt-table-pricing__col button {
  width: 100%;
  height: 38px;
  border-radius: 9px;
  border: 1.5px solid #dcdce2;
  background: transparent;
  color: #48484f;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.pt-table-pricing__col.is-featured button {
  border: 0;
  background: var(--accent);
  color: var(--text-on-accent);
}
`,
    prompt: `Ba cột gói dịch vụ đặt cạnh nhau, cột giữa là gói phổ biến.
- Kích thước: chia đều 3 cột, cách nhau 14px, padding trong 20px 18px
- Bo góc: 12px cho từng cột; nhãn "Phổ biến" bo viên thuốc, cao 22px
- Cột giữa nhấc lên 8px, viền màu nhấn, có bóng đổ
- Thứ tự: nhãn → tên gói → giá → danh sách quyền → nút chọn
- Giá 24px đậm 700; đơn vị /tháng 12px màu #86868f
- Nút ở cột giữa: nền màu nhấn, chữ trắng; các cột khác chỉ có viền
- Khi bấm nút: không đổi kích thước, chỉ đổi màu nền sang tím đậm`,
  },

  /* ── 8 ── */
  {
    id: 'form-field-group',
    name: 'Nhóm ô nhập có nhãn',
    groups: ['form', 'layout', 'feedback'],
    tags: ['form', 'ô nhập', 'nhãn', 'input', 'biểu mẫu'],
    version: '1.3.0',
    status: 'pending',
    demo: false,
    uses: 5,
    rejects: 2,
    updated: '2026-10-13',
    note: 'Chờ reviewer chốt trạng thái lỗi.',
    draw: (b) => {
      panel(b, 90, 96, 340, 60, 12);
      line(b, 106, 118, 70, COL.barDim, 6);
      line(b, 340, 118, 60, COL.amber, 6);
      panel(b, 90, 176, 340, 60, 12);
      line(b, 106, 198, 70, COL.barDim, 6);
      line(b, 106, 246, 180, COL.barDim, 5);
    },
    html: `
<div class="pt-form-field">
  <label class="pt-form-field__row">
    <span class="pt-form-field__label">Email</span>
    <input type="email" placeholder="ten@congty.vn" />
    <span class="pt-form-field__hint">Dùng email công việc để nhận hoá đơn.</span>
  </label>
  <label class="pt-form-field__row">
    <span class="pt-form-field__label">Số điện thoại</span>
    <input type="tel" placeholder="09xx xxx xxx" />
    <span class="pt-form-field__hint">Không bắt buộc.</span>
  </label>
</div>
`,
    css: `
/* Nhóm ô nhập kèm nhãn và dòng gợi ý */
.pt-form-field { display: flex; flex-direction: column; gap: 16px; max-width: 420px; font-family: var(--font-ui); }
.pt-form-field__row { display: flex; flex-direction: column; gap: 6px; }
.pt-form-field__label { font-size: 13px; font-weight: 600; color: #24242c; }
.pt-form-field__row input {
  height: 46px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1.5px solid #e6e6ea;
  background: #ffffff;
  font: inherit;
  font-size: 14px;
  color: #24242c;
  outline: 0;
  transition: border-color 140ms ease, box-shadow 140ms ease;
}
.pt-form-field__row input::placeholder { color: #aeaeb8; }
.pt-form-field__row input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px hsla(262, 82%, 60%, 0.14);
}
.pt-form-field__row input:user-invalid { border-color: var(--color-error); }
.pt-form-field__hint { font-size: 12px; color: #86868f; }
`,
    prompt: `Nhóm ô nhập có nhãn phía trên, dùng trong biểu mẫu.
- Kích thước: ô nhập cao 46px, padding 0 14px, nhóm rộng tối đa 420px, các nhóm cách nhau 16px
- Bo góc: 10px; nhãn cách ô nhập 6px, dòng gợi ý cách 6px
- Không đặt icon trong ô nhập
- Khi focus: viền đổi sang màu nhấn và có vòng sáng tím nhạt 3px
- Khi dữ liệu sai: viền đổi sang màu lỗi đỏ (--color-error)
- Nhãn 13px đậm 600, dòng gợi ý 12px màu #86868f`,
  },

  /* ── 9 ── */
  {
    id: 'breadcrumb-line',
    name: 'Dải breadcrumb',
    groups: ['navigation', 'layout', 'text'],
    tags: ['breadcrumb', 'đường dẫn', 'điều hướng', 'dải'],
    version: '0.9.1',
    status: 'hidden',
    demo: false,
    uses: 1,
    rejects: 4,
    updated: '2026-09-28',
    note: 'Bị ẩn: 4 lần bị BMT từ chối, chờ làm lại dấu phân cách.',
    draw: (b) => {
      let x = 60;
      for (let i = 0; i < 4; i++) {
        const w = [70, 56, 62, 84][i];
        line(b, x, 166, w, i === 3 ? COL.bar : COL.barDim, 8);
        x += w + 12;
        if (i < 3) {
          circle(b, x + 3, 170, 2.6, COL.border);
          x += 20;
        }
      }
      line(b, 60, 200, 300, COL.grid, 6);
    },
    html: `
<nav class="pt-breadcrumb" aria-label="Đường dẫn">
  <a href="#">Trang chủ</a>
  <span class="pt-breadcrumb__sep" aria-hidden="true"></span>
  <a href="#">Sản phẩm</a>
  <span class="pt-breadcrumb__sep" aria-hidden="true"></span>
  <a href="#">Máy in</a>
  <span class="pt-breadcrumb__sep" aria-hidden="true"></span>
  <span aria-current="page">Máy in laser L3250</span>
</nav>
`,
    css: `
/* Dải đường dẫn dưới thanh điều hướng */
.pt-breadcrumb {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-ui);
  font-size: 12.5px;
}
.pt-breadcrumb a { color: #86868f; text-decoration: none; }
.pt-breadcrumb a:hover { color: var(--accent); }
.pt-breadcrumb [aria-current="page"] { color: #24242c; font-weight: 600; }
.pt-breadcrumb__sep {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: #d4d4da;
  flex-shrink: 0;
}
`,
    prompt: `Dải đường dẫn đặt ngay dưới thanh điều hướng.
- Kích thước: chữ 12.5px, các mục cách nhau 10px
- Bo góc: không áp dụng (chỉ chữ và dấu chấm phân cách)
- Không dùng icon, dấu phân cách là chấm tròn 5px màu #d4d4da
- Mục đang xem: chữ đậm 600 màu #24242c, không có gạch chân
- Mục khác màu #86868f, khi hover đổi sang màu nhấn tím
- Khi bấm vào: đổi màu chữ ngay, không có hiệu ứng nền`,
  },

  /* ── 10 ── */
  {
    id: 'avatar-stack',
    name: 'Chồng avatar',
    groups: ['card', 'feedback', 'marketing'],
    tags: ['avatar', 'chồng', 'người dùng', 'nhóm', 'ảnh đại diện'],
    version: '1.2.0',
    status: 'approved',
    demo: false,
    uses: 7,
    rejects: 2,
    updated: '2026-10-06',
    note: 'Khoá: part này chỉ dùng nội bộ, không cho kéo ra ngoài kho.',
    draw: (b) => {
      const cols = [COL.accentD, COL.raised, COL.border, COL.accentD];
      cols.forEach((c, i) => {
        circle(b, 150 + i * 34, 168, 27, COL.bg);
        circle(b, 150 + i * 34, 168, 25, c);
      });
      roundRect(b, 292, 148, 96, 40, 20, COL.raised);
      strokeRound(b, 292, 148, 96, 40, 20, COL.border, 1.2);
      line(b, 314, 165, 52, COL.bar, 7);
      line(b, 150, 222, 190, COL.barDim, 6);
    },
    html: `
<div class="pt-avatar-stack">
  <span class="pt-avatar-stack__list">
    <span class="pt-avatar-stack__item">TH</span>
    <span class="pt-avatar-stack__item">QT</span>
    <span class="pt-avatar-stack__item">BA</span>
    <span class="pt-avatar-stack__item">RV</span>
  </span>
  <span class="pt-avatar-stack__more">+12 người khác</span>
</div>
`,
    css: `
/* Chồng avatar thể hiện số người đang tham gia */
.pt-avatar-stack { display: inline-flex; align-items: center; gap: 12px; font-family: var(--font-ui); }
.pt-avatar-stack__list { display: inline-flex; }
.pt-avatar-stack__item {
  display: grid;
  place-items: center;
  width: 40px; height: 40px;
  margin-left: -10px;
  border-radius: 50%;
  border: 2px solid #ffffff;
  background: var(--accent-muted);
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.pt-avatar-stack__item:first-child { margin-left: 0; }
.pt-avatar-stack__more {
  height: 32px;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  background: #f3f3f6;
  border: 1px solid #ebebef;
  font-size: 12.5px;
  color: #6a6a74;
}
`,
    prompt: `Chồng ảnh đại diện kèm số người còn lại.
- Kích thước: mỗi avatar 40×40, chồng lên nhau 10px, viền trắng 2px
- Bo góc: tròn hoàn toàn cho avatar, viên thuốc cho nhãn "+n người khác"
- Chữ trong avatar: 12px đậm 700, màu nhấn trên nền tím nhạt
- Nhãn còn lại: cao 32px, padding 0 14px, nền #f3f3f6
- Khi hover: hiện tooltip tên người dùng, không đổi kích thước
- Màu nền avatar mặc định lấy từ --accent-muted`,
  },

  /* ── 11 ── */
  {
    id: 'picker-date',
    name: 'Ô chọn ngày',
    groups: ['form', 'layout', 'feedback'],
    tags: ['ngày', 'date', 'lịch', 'chọn ngày', 'picker'],
    version: '1.0.0',
    status: 'approved',
    demo: false,
    uses: 2,
    rejects: 3,
    updated: '2026-10-02',
    note: 'Khoá: chưa chốt được quy tắc ngày nghỉ, không cho kéo ra ngoài kho.',
    draw: (b) => {
      panel(b, 130, 84, 260, 196, 14);
      line(b, 150, 104, 90, COL.bar, 8);
      circle(b, 372, 104, 5, COL.border);
      circle(b, 344, 104, 5, COL.border);
      rect(b, 130, 122, 260, 1, COL.border);
      const days = 35;
      for (let i = 0; i < days; i++) {
        const c = i % 7, r = Math.floor(i / 7);
        const x = 156 + c * 30, y = 142 + r * 24;
        const sel = i === 17;
        const rest = c === 5 || c === 6;
        circle(b, x, y, sel ? 9 : 4.5, sel ? COL.accent : rest ? COL.border : COL.barDim);
      }
    },
    html: `
<div class="pt-picker-date">
  <header class="pt-picker-date__head">
    <button type="button" aria-label="Tháng trước">‹</button>
    <strong>Tháng 10, 2026</strong>
    <button type="button" aria-label="Tháng sau">›</button>
  </header>
  <div class="pt-picker-date__grid">
    <span class="pt-picker-date__dow">T2</span><span class="pt-picker-date__dow">T3</span>
    <span class="pt-picker-date__dow">T4</span><span class="pt-picker-date__dow">T5</span>
    <span class="pt-picker-date__dow">T6</span><span class="pt-picker-date__dow">T7</span>
    <span class="pt-picker-date__dow">CN</span>
    <button type="button">1</button><button type="button">2</button><button type="button">3</button>
    <button type="button">4</button><button type="button">5</button><button type="button">6</button><button type="button">7</button>
    <button type="button">8</button><button type="button">9</button><button type="button">10</button>
    <button type="button">11</button><button type="button">12</button><button type="button">13</button><button type="button">14</button>
    <button type="button" class="is-selected" aria-current="date">15</button>
    <button type="button">16</button><button type="button">17</button><button type="button">18</button>
    <button type="button">19</button><button type="button">20</button><button type="button">21</button>
  </div>
</div>
`,
    css: `
/* Ô chọn ngày dạng lịch tháng */
.pt-picker-date {
  width: 280px;
  padding: 12px;
  border-radius: 14px;
  background: #ffffff;
  border: 1.5px solid #e6e6ea;
  box-shadow: 0 16px 36px rgba(43, 39, 64, 0.1);
  font-family: var(--font-ui);
}
.pt-picker-date__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 2px 10px;
  border-bottom: 1px solid #f0f0f4;
  font-size: 13px;
  color: #24242c;
}
.pt-picker-date__head button {
  width: 26px; height: 26px;
  border-radius: 8px;
  border: 1px solid #ebebef;
  background: #ffffff;
  color: #6a6a74;
  cursor: pointer;
  font: inherit;
}
.pt-picker-date__head button:hover { border-color: var(--accent); color: var(--accent); }
.pt-picker-date__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  padding-top: 8px;
}
.pt-picker-date__dow { font-size: 11px; color: #aeaeb8; text-align: center; padding-bottom: 4px; }
.pt-picker-date__grid button {
  height: 30px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #48484f;
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
}
.pt-picker-date__grid button:hover { background: #f3f3f6; }
.pt-picker-date__grid button.is-selected {
  background: var(--accent);
  color: var(--text-on-accent);
  font-weight: 600;
}
`,
    prompt: `Ô chọn ngày dạng lịch tháng, mở từ ô nhập ngày.
- Kích thước: rộng 280px, padding 12px, lưới 7 cột, mỗi ô cao 30px
- Bo góc: khung 14px, mỗi ô ngày 8px, nút chuyển tháng 8px
- Vị trí: mở ngay dưới ô nhập, cách 6px; mũi tên chuyển tháng nằm hai đầu dòng tiêu đề
- Ngày đang chọn: nền màu nhấn, chữ trắng đậm 600
- Ngày khi hover: nền #f3f3f6; thứ trong tuần 11px màu #aeaeb8
- Khi bấm ngày: đóng lịch ngay và đổ vào ô nhập theo định dạng dd/mm/yyyy`,
  },

  /* ── 12: cố ý thiếu preview.png để minh hoạ quy tắc ── */
  {
    id: 'toast-stack',
    name: 'Hàng thông báo nổi',
    groups: ['feedback', 'layout', 'form'],
    tags: ['thông báo', 'toast', 'nổi', 'cảnh báo', 'feedback'],
    version: '0.4.0',
    status: 'approved',
    demo: false,
    uses: 0,
    rejects: 0,
    updated: '2026-10-16',
    note: 'Thiếu preview.png: ảnh chụp lỗi, chưa bổ sung nên không được kéo vào khung.',
    draw: null,
    html: `
<div class="pt-toast-stack">
  <div class="pt-toast pt-toast--ok">
    <span class="pt-toast__ico" aria-hidden="true"></span>
    <div><strong>Đã lưu</strong><span>Giao diện được cập nhật vào main.</span></div>
  </div>
  <div class="pt-toast pt-toast--warn">
    <span class="pt-toast__ico" aria-hidden="true"></span>
    <div><strong>Lệch 12px</strong><span>Khối hero thấp hơn ảnh mẫu.</span></div>
  </div>
</div>
`,
    css: `
/* Hàng thông báo nổi ở góc phải dưới */
.pt-toast-stack { display: flex; flex-direction: column; gap: 10px; width: 300px; font-family: var(--font-ui); }
.pt-toast {
  display: flex;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  background: #ffffff;
  border: 1.5px solid #ebebef;
  box-shadow: 0 12px 28px rgba(43, 39, 64, 0.12);
  border-left-width: 4px;
}
.pt-toast--ok { border-left-color: var(--color-success); }
.pt-toast--warn { border-left-color: var(--color-warning); }
.pt-toast__ico {
  width: 18px; height: 18px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 1px;
  background: var(--color-success-muted);
  border: 1px solid var(--color-success);
}
.pt-toast--warn .pt-toast__ico {
  background: var(--color-warning-muted);
  border-color: var(--color-warning);
}
.pt-toast strong { display: block; font-size: 13px; color: #24242c; }
.pt-toast span { font-size: 12.5px; color: #6a6a74; line-height: 1.5; }
`,
    prompt: `Hàng thông báo nổi ở góc phải dưới màn hình.
- Kích thước: mỗi thông báo rộng 300px, padding 12px 14px, cách nhau 10px
- Bo góc: 12px; viền trái dày 4px mang màu trạng thái
- Vị trí icon: chấm tròn 18px nằm sát trái, cách chữ 10px
- Màu theo trạng thái: thành công xanh lá, cảnh báo vàng, lỗi đỏ (màu trạng thái cố định)
- Khi bấm vào: thông báo mờ dần rồi biến mất sau 300ms
- Tự ẩn sau 5 giây, xếp chồng lên nhau theo thứ tự mới nhất ở trên`,
  },
];

/* ═══════════════ 4. Ghi ra đĩa ═══════════════ */

let count = 0;
for (const p of PARTS) {
  const dir = join(TOOLBOX, p.id);
  mkdirSync(dir, { recursive: true });

  const meta = {
    id: p.id,
    name: p.name,
    groups: p.groups,
    tags: p.tags,
    version: p.version,
    designMd: 'DESIGN.md · 2026-10-01',
    author: p.demo ? 'Nguyễn Thanh Hiền' : 'Trần Quốc Bảo',
    origin: 'Figma · PixelMind Kit / ' + p.groups[0],
    license: 'MIT · nội bộ dự án',
    status: p.status,
    locked: p.id === 'avatar-stack' || p.id === 'picker-date',
    demo: p.demo,
    uses: p.uses,
    rejects: p.rejects,
    updated: p.updated,
    ...(p.note ? { note: p.note } : {}),
  };

  writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');
  writeFileSync(join(dir, 'sample.html'), p.html.replace(/^\n/, ''), 'utf8');
  writeFileSync(join(dir, 'sample.css'), p.css.replace(/^\n/, ''), 'utf8');
  writeFileSync(join(dir, 'prompt.txt'), p.prompt + '\n', 'utf8');

  if (p.draw) {
    const buf = canvas();
    backdrop(buf);
    p.draw(buf);
    writeFileSync(join(dir, 'preview.png'), encodePNG(OUT_W, OUT_H, downsample(buf)));
  }

  const files = ['meta.json', 'sample.html', 'sample.css', 'prompt.txt'];
  if (p.draw) files.push('preview.png');
  console.log(`  ✓ ${p.id.padEnd(22)} ${files.join(' ')}`);
  count++;
}

console.log(`\nĐã ghi ${count} part vào ${TOOLBOX}`);
