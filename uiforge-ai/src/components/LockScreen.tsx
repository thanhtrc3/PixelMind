import { useState } from 'react';
import { LogIn, Info, WandSparkles, X } from 'lucide-react';
import { USERS } from '../data/project';
import '../styles/Lock.css';

type Props = {
  /** Cho phép đóng khi người dùng không muốn đăng xuất hẳn */
  onCancel?: () => void;
  onLogin: () => void;
};

const FEATURES = [
  ['Ảnh mẫu + quy chuẩn', 'Gắn DESIGN.md và tokens.css để giao diện không trôi khỏi thiết kế gốc.'],
  ['Sửa tay và nhờ AI xen kẽ', 'Kéo thả ghi thẳng vào code, hoặc gõ một câu tiếng Việt cho AI sửa.'],
  ['Chạy lại — chụp — so sánh', 'Kiểm tra theo điểm ảnh và theo DOM, co giãn ở 390 / 768 / 1440.'],
] as const;

const LockScreen = ({ onCancel, onLogin }: Props) => {
  const [account, setAccount] = useState('hien.nguyen@sv.edu.vn');
  const [password, setPassword] = useState('12345678');
  const [role, setRole] = useState('admin');

  const pick = (email: string) => {
    setAccount(email);
    const u = USERS.find((x) => x.email === email);
    if (u) setRole(u.role);
  };

  return (
    <div className="lock">
      <div className="lock__left">
        <div className="row" style={{ gap: 10 }}>
          <div className="lock__mark">
            <WandSparkles size={15} strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em' }}>PixelMind</div>
            <div className="hint" style={{ fontSize: 11 }}>
              Hệ thống hỗ trợ thiết kế giao diện
            </div>
          </div>
        </div>

        <div style={{ marginTop: 'auto' }}>
          <h1 className="lock__pitch">
            Ứng dụng desktop giúp code giao diện web cho đúng với mẫu thiết kế.
          </h1>
          <p className="hint" style={{ maxWidth: 470, fontSize: 12.5 }}>
            Mở dự án thật, xem nó chạy ngay trong app, rồi kéo thả sửa hoặc gõ tiếng Việt nhờ AI sửa.
            Mọi thay đổi ghi thẳng vào mã nguồn, không phải xuất ra rồi chép lại.
          </p>
          <div style={{ marginTop: 20, maxWidth: 470 }}>
            {FEATURES.map(([t, d], i) => (
              <div className="lock__feat" key={t}>
                <div className="n">{i + 1}</div>
                <div>
                  <b style={{ fontSize: 12.5 }}>{t}</b>
                  <div className="hint">{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="hint" style={{ fontSize: 11 }}>
          Đồ án chuyên ngành · Nguyễn Thanh Hiền – Đoàn Quí Trường
        </div>
      </div>

      <div className="lock__right">
        <div className="lock__box">
          <h2 style={{ fontSize: 20, fontWeight: 650, letterSpacing: '-0.02em', margin: '0 0 4px' }}>
            Đăng nhập
          </h2>
          <p className="hint" style={{ margin: '0 0 18px' }}>
            Dùng tài khoản do admin cấp. Vai trò lấy từ tài khoản.
          </p>

          <div className="col" style={{ gap: 12 }}>
            <div className="field">
              <label className="lbl">Tài khoản</label>
              <input className="inp" value={account} onChange={(e) => setAccount(e.target.value)} />
            </div>
            <div className="field">
              <label className="lbl">Mật khẩu</label>
              <input
                className="inp"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onLogin()}
              />
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <label className="cbx">
                <input type="checkbox" defaultChecked />
                Ghi nhớ đăng nhập
              </label>
              <span className="hint">Quên mật khẩu?</span>
            </div>

            <button className="btn primary" style={{ height: 33 }} onClick={onLogin}>
              <LogIn size={13} /> Đăng nhập
            </button>

            <div className="strk info" style={{ marginTop: 2 }}>
              <Info size={13} style={{ flex: 'none', marginTop: 1 }} />
              <div>
                Vai trò quyết định màn hình: Admin thấy tất cả · Dev thấy màn hình làm việc · Tester
                thấy kiểm tra · BA thấy phiếu yêu cầu · Reviewer thấy diff và nút duyệt.
              </div>
            </div>

            <div className="row wrap" style={{ gap: 5, justifyContent: 'center', paddingTop: 4 }}>
              {USERS.slice(0, 4).map((u) => (
                <button
                  key={u.id}
                  className={`tag ${u.email === account ? 'is-on' : ''}`}
                  style={{ border: 0, cursor: 'pointer' }}
                  onClick={() => pick(u.email)}
                >
                  {u.role} · {u.email.split('@')[0]}
                </button>
              ))}
            </div>
            <span className="hint" style={{ textAlign: 'center' }}>
              vai trò đang chọn: <b>{role}</b>
            </span>
          </div>
        </div>

        {onCancel && (
          <button className="ibtn lock__close" onClick={onCancel} title="Đóng">
            <X size={15} />
          </button>
        )}
      </div>
    </div>
  );
};

export default LockScreen;
