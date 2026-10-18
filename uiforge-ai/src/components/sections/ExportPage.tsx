import { useState } from 'react';
import { Check, Download, FileArchive, History, Info, X } from 'lucide-react';
import { PROJECT } from '../../data/project';
import '../../styles/Sections.css';

type Format = 'zip' | 'folder' | 'git';

const OPTIONS = [
  { id: 'src', name: 'Mã nguồn (source code)', desc: 'Toàn bộ src/ của ShopWeb', mb: 3.4, files: 42 },
  { id: 'shots', name: 'Ảnh chụp các trang', desc: '4 trang × 2 khung — ảnh mẫu không bắt buộc', mb: 1.2, files: 8 },
  { id: 'design', name: 'DESIGN.md + tokens.css', desc: 'Quy chuẩn màu, chữ, khoảng cách, bo góc', mb: 0.1, files: 2 },
  { id: 'parts', name: 'Thư viện part', desc: '11 part đã duyệt kèm sample.html / sample.css', mb: 2.6, files: 33 },
  { id: 'log', name: 'Nhật ký', desc: 'nhat-ky.csv — các bản ghi trong tháng', mb: 0.2, files: 1 },
];

const STEPS = [
  'Quét thay đổi so với bản đã duyệt',
  'Gom tệp theo mục đã chọn',
  'Sinh DESIGN.md + tokens.css kèm theo',
  'Nén gói và kiểm tra dung lượng',
  'Lưu ra nơi nhận và mở thư mục',
];

const WHERE: Record<Format, string> = {
  zip: `${PROJECT.folder}\\nop-bai-${PROJECT.version}.zip`,
  folder: `${PROJECT.folder}\\dist\\nop-bai-${PROJECT.version}\\`,
  git: `${PROJECT.repo} · nhánh xuat-bai-${PROJECT.version}`,
};

const ExportPage = () => {
  const [picked, setPicked] = useState<Record<string, boolean>>({
    src: true,
    shots: true,
    design: true,
    parts: false,
    log: true,
  });
  const [format, setFormat] = useState<Format>('zip');
  const [toast, setToast] = useState<string | null>(null);

  const toggle = (id: string) => setPicked((prev) => ({ ...prev, [id]: !prev[id] }));

  const chosen = OPTIONS.filter((o) => picked[o.id]);
  const totalMb = chosen.reduce((s, o) => s + o.mb, 0);
  const totalFiles = chosen.reduce((s, o) => s + o.files, 0);
  const size = `${totalMb.toFixed(1).replace('.', ',')} MB`;

  const run = () => {
    if (chosen.length === 0) {
      setToast('Chưa chọn mục nào để xuất — tích ít nhất một mục rồi thử lại');
      return;
    }
    setToast(`Đã đóng gói ${chosen.length} mục · ${size} · ${totalFiles} tệp vào ${WHERE[format]}`);
  };

  return (
    <div className="scroll">
      {/* ── Đầu trang ── */}
      <div className="pg-hd">
        <div>
          <h1 className="tt">Xuất bài</h1>
          <p className="sub">
            Gom kết quả thành một gói để nộp hoặc demo — có kèm ảnh mẫu và quy chuẩn
          </p>
        </div>
        <div className="grow" />
        <span className="chip ok">
          <Check size={12} />
          {PROJECT.version} đã kiểm tra: 1440 lệch 0,2%
        </span>
      </div>

      <div className="grid g2">
        {/* ── Cột trái: chọn nội dung + định dạng ── */}
        <div className="col" style={{ gap: 12 }}>
          <div className="card">
            <div className="card-hd">
              <FileArchive size={14} className="dim" />
              <b>Chọn nội dung xuất</b>
              <span className="tag">{chosen.length}/{OPTIONS.length} mục</span>
            </div>
            <div className="card-bd col" style={{ gap: 8 }}>
              {OPTIONS.map((o) => (
                <label key={o.id} className={`opt ${picked[o.id] ? 'on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={picked[o.id]}
                    onChange={() => toggle(o.id)}
                    style={{ width: 14, height: 14, marginTop: 2, accentColor: 'var(--accent)', flex: 'none' }}
                  />
                  <span className="grow">
                    <b>{o.name}</b>
                    <span className="hint">{o.desc}</span>
                  </span>
                  <span className="mono dim">
                    {o.files} tệp · {o.mb.toFixed(1).replace('.', ',')} MB
                  </span>
                </label>
              ))}
              <div className="strk info" style={{ marginTop: 2 }}>
                <Info size={14} style={{ flex: 'none', marginTop: 1 }} />
                <span>
                  Ảnh mẫu không bắt buộc — không có ảnh thì gói vẫn đủ code, DESIGN.md và nhật ký,
                  chỉ thiếu phần đối chiếu bằng ảnh.
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-hd">
              <Download size={14} className="dim" />
              <b>Định dạng gói</b>
            </div>
            <div className="card-bd">
              <div className="field" style={{ maxWidth: 260 }}>
                <label className="lbl">Kiểu xuất</label>
                <select
                  className="inp"
                  value={format}
                  onChange={(e) => setFormat(e.target.value as Format)}
                >
                  <option value="zip">ZIP — một tệp nén để nộp</option>
                  <option value="folder">Thư mục — giải nén sẵn tại chỗ</option>
                  <option value="git">Git branch — đẩy lên kho GitHub</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ── Cột phải: các bước + tóm tắt ── */}
        <div className="col" style={{ gap: 12 }}>
          <div className="card">
            <div className="card-hd">
              <History size={14} className="dim" />
              <b>Các bước xuất</b>
              <div className="grow" />
              <span className="hint">dự kiến 12 giây</span>
            </div>
            <div className="card-bd">
              <div className="tl">
                {STEPS.map((s, i) => (
                  <div className={`it ${i === 0 ? 'on' : ''}`} key={s}>
                    <div className="row" style={{ gap: 7 }}>
                      <span className="tag">{i + 1}</span>
                      <span style={{ fontSize: 12.5 }}>{s}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-hd">
              <FileArchive size={14} className="dim" />
              <b>Tóm tắt gói xuất</b>
            </div>
            <div className="card-bd" style={{ paddingTop: 6, paddingBottom: 6 }}>
              <div className="kv">
                <span className="k">Nội dung đã chọn</span>
                <span>{chosen.length} mục</span>
              </div>
              <div className="kv">
                <span className="k">Dung lượng ước tính</span>
                <span className="mono">{size}</span>
              </div>
              <div className="kv">
                <span className="k">Số tệp</span>
                <span className="mono">{totalFiles} tệp</span>
              </div>
              <div className="kv">
                <span className="k">Định dạng</span>
                <span className="mono">{format}</span>
              </div>
              <div className="kv">
                <span className="k">Nơi lưu</span>
                <span className="mono">{WHERE[format]}</span>
              </div>
            </div>
            <div className="card-bd" style={{ borderTop: '1px solid var(--line)' }}>
              <button className="btn primary" style={{ width: '100%' }} onClick={run}>
                <Download size={12} /> Xuất bài
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Thông báo nhỏ ── */}
      {toast && (
        <div className="sec-toast slide-up" role="status">
          <Check size={13} />
          <span className="grow">{toast}</span>
          <button className="ibtn sm" onClick={() => setToast(null)}>
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
};

export default ExportPage;
