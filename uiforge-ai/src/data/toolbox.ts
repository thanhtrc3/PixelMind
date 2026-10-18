/* ══════════════════════════════════════════════════════════════
   Kho part — Search Toolbox (mục 2.13 · CN12)

   Không hard-code dữ liệu trong component: mọi part được đọc
   thẳng từ thư mục /toolbox, mỗi part là MỘT THƯ MỤC CHỨA 5 TỆP
   đúng như báo cáo:
       meta.json · preview.png · sample.html · sample.css · prompt.txt

   Vite đọc các tệp này lúc build (import.meta.glob) nên thêm part
   mới chỉ cần tạo thư mục mới trong /toolbox là app tự nhận.
   ══════════════════════════════════════════════════════════════ */

export type PartStatus = 'approved' | 'pending' | 'hidden';

export interface PartMeta {
  id: string;
  name: string;
  groups: string[];
  tags: string[];
  version: string;
  designMd: string;
  author: string;
  origin: string;
  license: string;
  status: PartStatus;
  locked: boolean;
  demo: boolean;
  uses: number;
  rejects: number;
  updated: string;
  note?: string;
}

export interface PartFile {
  name: string;
  role: string;
  /** Nội dung để hiện trong khung xem code; ảnh thì để trống */
  body?: string;
  kind: 'json' | 'image' | 'code' | 'text';
}

export interface Part extends PartMeta {
  preview?: string;
  html: string;
  css: string;
  prompt: string;
  metaText: string;
  files: PartFile[];
  /** Part được kéo vào khung hay không (đủ ảnh + đã qua reviewer + không bị khoá/ẩn) */
  draggable: boolean;
  /** Lý do không kéo được, hiện ngay trên thẻ */
  blockReason?: string;
}

/* Vai trò của từng tệp — lấy nguyên văn bảng trong mục 2.13 */
const FILE_ROLE: Record<string, string> = {
  'meta.json': '“Căn cước” của part: tên, nhóm, tags tìm kiếm, phiên bản, bản DESIGN.md mà part dựa theo, tác giả, nguồn gốc và giấy phép sử dụng.',
  'preview.png': 'Ảnh chụp nhỏ để người lướt mắt chọn, khỏi phải đọc code.',
  'sample.html': 'Code khung sườn của part.',
  'sample.css': 'Code màu sắc, kiểu dáng của part.',
  'prompt.txt': 'Đoạn mô tả ngắn dành cho AI: kích thước, bo góc, vị trí icon, màu khi bấm vào.',
};

/* ── Đọc cả kho bằng glob của Vite ── */
const metas = import.meta.glob('../../toolbox/*/meta.json', {
  eager: true, import: 'default',
}) as Record<string, PartMeta>;

const metaTexts = import.meta.glob('../../toolbox/*/meta.json', {
  eager: true, query: '?raw', import: 'default',
}) as Record<string, string>;

const htmls = import.meta.glob('../../toolbox/*/sample.html', {
  eager: true, query: '?raw', import: 'default',
}) as Record<string, string>;

const csses = import.meta.glob('../../toolbox/*/sample.css', {
  eager: true, query: '?raw', import: 'default',
}) as Record<string, string>;

const prompts = import.meta.glob('../../toolbox/*/prompt.txt', {
  eager: true, query: '?raw', import: 'default',
}) as Record<string, string>;

const previews = import.meta.glob('../../toolbox/*/preview.png', {
  eager: true, import: 'default',
}) as Record<string, string>;

const idOf = (path: string) => path.split('/').slice(-2)[0];
const at = <T,>(map: Record<string, T>, id: string, file: string): T | undefined =>
  map[`../../toolbox/${id}/${file}`];

export const PARTS: Part[] = Object.entries(metas)
  .map(([path, meta]) => {
    const id = idOf(path);
    const preview = at(previews, id, 'preview.png');
    const html = at(htmls, id, 'sample.html') ?? '';
    const css = at(csses, id, 'sample.css') ?? '';
    const prompt = at(prompts, id, 'prompt.txt') ?? '';
    const metaText = at(metaTexts, id, 'meta.json') ?? JSON.stringify(meta, null, 2);

    /* Quy tắc trong mục 2.13: thiếu ảnh preview hoặc chưa qua reviewer
       duyệt thì KHÔNG được kéo vào khung; part bị ẩn hoặc bị khoá cũng vậy. */
    let blockReason: string | undefined;
    if (meta.status === 'hidden') blockReason = 'Part đang bị ẩn';
    else if (meta.locked) blockReason = 'Part này không được kéo ra ngoài kho';
    else if (!preview) blockReason = 'Thiếu ảnh preview.png';
    else if (meta.status === 'pending') blockReason = 'Chưa qua reviewer duyệt';

    const files: PartFile[] = [
      { name: 'meta.json', role: FILE_ROLE['meta.json'], body: metaText, kind: 'json' },
    ];
    if (preview) files.push({ name: 'preview.png', role: FILE_ROLE['preview.png'], kind: 'image' });
    files.push(
      { name: 'sample.html', role: FILE_ROLE['sample.html'], body: html, kind: 'code' },
      { name: 'sample.css', role: FILE_ROLE['sample.css'], body: css, kind: 'code' },
      { name: 'prompt.txt', role: FILE_ROLE['prompt.txt'], body: prompt, kind: 'text' },
    );

    return {
      ...meta,
      preview,
      html,
      css,
      prompt,
      metaText,
      files,
      draggable: !blockReason,
      blockReason,
    };
  })
  /* Part demo của báo cáo lên trước, sau đó tới part dùng nhiều nhất */
  .sort((a, b) => Number(b.demo) - Number(a.demo) || b.uses - a.uses);

export const PART_MAP: Record<string, Part> = Object.fromEntries(PARTS.map((p) => [p.id, p]));

/** Tất cả nhóm có trong kho, kèm số part mỗi nhóm */
export const GROUPS: { key: string; count: number }[] = (() => {
  const map = new Map<string, number>();
  PARTS.forEach((p) => p.groups.forEach((g) => map.set(g, (map.get(g) ?? 0) + 1)));
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
})();

export const STATUS_LABEL: Record<PartStatus, string> = {
  approved: 'Đã duyệt',
  pending: 'Chờ duyệt',
  hidden: 'Bị ẩn',
};

/** Một part đã được kéo từ toolbox vào khung */
export interface InsertedPart {
  uid: string;
  partId: string;
  at: string;
}

/** Lọc theo từ khoá: tên, mã part, tags, nhóm, tác giả, nguồn gốc */
export const matchesQuery = (p: Part, q: string) => {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [p.name, p.id, p.author, p.origin, ...p.tags, ...p.groups]
    .join(' ')
    .toLowerCase()
    .includes(needle);
};
