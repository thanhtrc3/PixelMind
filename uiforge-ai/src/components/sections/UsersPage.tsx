import { useState } from 'react';
import { Check, Info, Mail, ScrollText, UserPlus, Users, X } from 'lucide-react';
import { PROJECT, USERS } from '../../data/project';
import type { User } from '../../data/project';
import type { SectionId } from '../../data/sections';
import '../../styles/Sections.css';

const ROLE_CHIP: Record<User['role'], string> = {
  admin: 'ac',
  dev: 'info',
  reviewer: '',
};

const STATE_LABEL: Record<User['state'], { text: string; cls: string }> = {
  'hoat-dong': { text: 'đang hoạt động', cls: 'ok' },
  'cho-moi': { text: 'chờ mời', cls: 'warn' },
  khoa: { text: 'đã khoá', cls: 'err' },
};

const ROLE_ROWS: { role: User['role']; screen: string; can: string }[] = [
  { role: 'admin', screen: 'Toàn bộ, cấu hình', can: 'Quản người dùng, cấp giấy phép, xem nhật ký, báo cáo' },
  { role: 'dev', screen: 'Màn hình làm việc', can: 'Mở dự án, sửa tay, nhờ AI sửa, tạo phiên bản' },
  { role: 'reviewer', screen: 'Lịch sử phiên bản', can: 'Xem diff, Đồng ý (lưu GitHub) hoặc Từ chối' },
];

type Props = {
  onSection: (id: SectionId) => void;
};

const UsersPage = ({ onSection }: Props) => {
  const [users, setUsers] = useState<User[]>(USERS);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState<{ email: string; role: User['role'] }>({
    email: '',
    role: 'dev',
  });
  const [toast, setToast] = useState<string | null>(null);

  const active = users.filter((u) => u.state === 'hoat-dong').length;
  const invited = users.filter((u) => u.state === 'cho-moi').length;
  const locked = users.filter((u) => u.state === 'khoa').length;

  const submit = () => {
    const email = form.email.trim() || 'thanh.vien.moi@sv.edu.vn';
    const name = email
      .split('@')[0]
      .split('.')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ') || 'Thành viên mới';
    const next: User = {
      id: `ND-${String(users.length + 1).padStart(3, '0')}`,
      name,
      email,
      role: form.role,
      joined: '18/10/2026',
      lastSeen: 'chưa đăng nhập',
      state: 'cho-moi',
    };
    setUsers((prev) => [...prev, next]);
    setInviteOpen(false);
    setForm({ email: '', role: 'dev' });
    setToast(`Đã mời ${email} với vai trò ${form.role} — tài khoản ở trạng thái chờ mời`);
  };

  return (
    <div className="scroll">
      {/* ── Đầu trang ── */}
      <div className="pg-hd">
        <div>
          <div className="row" style={{ gap: 8 }}>
            <h1 className="tt">Người dùng</h1>
            <span className="chip ok">
              <span className="dot ok" />
              {active} đang hoạt động
            </span>
            <span className="chip warn">{invited} chờ mời</span>
            <span className="chip err">{locked} đã khoá</span>
          </div>
          <p className="sub">
            {PROJECT.name} · {users.length} tài khoản · tài khoản do admin tạo, không có tự đăng ký —
            vai trò quyết định thấy màn hình nào
          </p>
        </div>
        <div className="grow" />
        <button className="btn" onClick={() => onSection('log')}>
          <ScrollText size={12} /> Xem nhật ký
        </button>
        <button className="btn primary" onClick={() => setInviteOpen(true)}>
          <UserPlus size={12} /> Mời người dùng
        </button>
      </div>

      {/* ── Danh sách tài khoản ── */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-hd">
          <Users size={14} className="dim" />
          <b>Danh sách tài khoản</b>
          <span className="tag">{users.length} tài khoản</span>
          <div className="grow" />
          <span className="hint">xoá người dùng là xoá mềm để nhật ký không mất dấu người thực hiện</span>
        </div>
        <div className="card-bd tight">
          <table className="tb">
            <thead>
              <tr>
                <th style={{ width: 68 }}>Mã</th>
                <th>Người dùng</th>
                <th style={{ width: 104 }}>Vai trò</th>
                <th style={{ width: 138 }}>Trạng thái</th>
                <th style={{ width: 106 }}>Tham gia</th>
                <th style={{ width: 118 }}>Đăng nhập gần nhất</th>
                <th className="r" style={{ width: 62 }} />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const s = STATE_LABEL[u.state];
                return (
                  <tr key={u.id}>
                    <td className="mono">{u.id}</td>
                    <td>
                      <span className="row" style={{ gap: 8 }}>
                        <span className="avatar">{u.name.slice(0, 1)}</span>
                        <span>
                          {u.name}
                          <span className="hint mono" style={{ display: 'block' }}>
                            {u.email}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className={`chip ${ROLE_CHIP[u.role]}`}>{u.role}</span>
                    </td>
                    <td>
                      <span className={`chip ${s.cls}`}>
                        <span className={`dot ${s.cls}`} />
                        {s.text}
                      </span>
                    </td>
                    <td className="mono">{u.joined}</td>
                    <td className="hint">{u.lastSeen}</td>
                    <td className="r">
                      <button
                        className="btn sm ghost"
                        onClick={() => setToast(`Đang mở hồ sơ ${u.id} · ${u.name} để sửa vai trò`)}
                      >
                        Sửa
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid g2">
        {/* ── Mỗi vai trò thấy gì ── */}
        <div className="card">
          <div className="card-hd">
            <Users size={14} className="dim" />
            <b>Mỗi vai trò thấy gì</b>
          </div>
          <div className="card-bd tight">
            <table className="tb">
              <thead>
                <tr>
                  <th style={{ width: 104 }}>Vai trò</th>
                  <th>Màn hình chính</th>
                  <th>Được làm</th>
                </tr>
              </thead>
              <tbody>
                {ROLE_ROWS.map((r) => (
                  <tr key={r.role}>
                    <td>
                      <span className={`chip ${ROLE_CHIP[r.role]}`}>{r.role}</span>
                    </td>
                    <td>{r.screen}</td>
                    <td className="hint">{r.can}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Chính sách tài khoản ── */}
        <div className="card">
          <div className="card-hd">
            <Info size={14} className="dim" />
            <b>Chính sách tài khoản</b>
          </div>
          <div className="card-bd">
            <div className="kv">
              <span className="k" style={{ width: 148 }}>Tạo tài khoản</span>
              <span className="hint" style={{ fontSize: 12 }}>
                Chỉ admin tạo được, không có màn tự đăng ký
              </span>
            </div>
            <div className="kv">
              <span className="k" style={{ width: 148 }}>Người được mời</span>
              <span className="hint" style={{ fontSize: 12 }}>
                Ở trạng thái <b>chờ mời</b> cho tới lần đăng nhập đầu tiên
              </span>
            </div>
            <div className="kv">
              <span className="k" style={{ width: 148 }}>Khoá tài khoản</span>
              <span className="hint" style={{ fontSize: 12 }}>
                Có hiệu lực ngay, phiên đang mở bị đăng xuất
              </span>
            </div>
            <div className="kv">
              <span className="k" style={{ width: 148 }}>Xoá tài khoản</span>
              <span className="hint" style={{ fontSize: 12 }}>
                Là xoá mềm, giữ lại dấu người thực hiện trong nhật ký
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Hộp thoại mời người dùng ── */}
      <div className={`modal ${inviteOpen ? 'on' : ''}`} onClick={() => setInviteOpen(false)}>
        <div className="dlg" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
          <div className="dlg-hd">
            <UserPlus size={16} style={{ color: 'var(--accent-2)' }} />
            <b>Mời người dùng</b>
            <div className="grow" />
            <button className="ibtn sm" onClick={() => setInviteOpen(false)}>
              <X size={15} />
            </button>
          </div>
          <div className="dlg-bd">
            <div className="field">
              <label className="lbl">Email sinh viên *</label>
              <input
                className="inp mono"
                placeholder="ten.ho@sv.edu.vn"
                value={form.email}
                autoFocus
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label className="lbl">Vai trò</label>
              <select
                className="inp"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as User['role'] })}
              >
                <option value="admin">admin — quản người dùng, cấp giấy phép</option>
                <option value="dev">dev — mở dự án, sửa tay, nhờ AI sửa</option>
                <option value="reviewer">reviewer — xem diff, đồng ý hoặc từ chối</option>
              </select>
            </div>
            <div className="strk info" style={{ marginTop: 12 }}>
              <Info size={14} style={{ flex: 'none', marginTop: 1 }} />
              <span>
                Lời mời gửi tới hộp thư sinh viên. Người được mời vào thẳng dự án{' '}
                <b>{PROJECT.name}</b> với vai trò đã chọn.
              </span>
            </div>
          </div>
          <div className="dlg-ft">
            <span className="hint grow">Chưa cần mật khẩu — người dùng tự đặt ở lần đăng nhập đầu</span>
            <button className="btn" onClick={() => setInviteOpen(false)}>
              Huỷ
            </button>
            <button className="btn primary" onClick={submit}>
              <Mail size={12} /> Gửi lời mời
            </button>
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

export default UsersPage;
