import { useState } from 'react'
import { BookOpen, ExternalLink } from 'lucide-react'
import Modal from './Modal'

interface GuideDialogProps {
  onClose: () => void
  isDesktop: boolean
}

type Section = 'start' | 'open' | 'run' | 'preview' | 'shortcuts' | 'faq'

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: 'start', label: 'Bắt đầu nhanh' },
  { id: 'open', label: 'Mở dự án' },
  { id: 'run', label: 'Chạy dự án' },
  { id: 'preview', label: 'Xem trước' },
  { id: 'shortcuts', label: 'Phím tắt' },
  { id: 'faq', label: 'Xử lý sự cố' },
]

const GuideDialog = ({ onClose, isDesktop }: GuideDialogProps) => {
  const [section, setSection] = useState<Section>('start')

  return (
    <Modal
      title="Hướng dẫn sử dụng"
      subtitle="Bốn bước để đưa một dự án giao diện vào PixelMind."
      icon={<BookOpen size={16} />}
      width={860}
      onClose={onClose}
      footer={
        <>
          <span className="grow">
            {isDesktop ? 'Nhấn Esc để đóng hướng dẫn bất cứ lúc nào.' : 'Một số bước cần bản desktop để hoạt động.'}
          </span>
          <button className="btn primary" onClick={onClose}>
            Đã hiểu
          </button>
        </>
      }
    >
      <div className="pm-guide">
        <div className="pm-guide__nav">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              className={section === item.id ? 'on' : ''}
              onClick={() => setSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="pm-guide__body">
          {section === 'start' && (
            <>
              <h3>Bắt đầu trong 4 bước</h3>
              <p>PixelMind không tạo dự án mới — nó làm việc trực tiếp trên thư mục mã nguồn bạn đã có.</p>
              <ol>
                <li>
                  Nhấn <b>Mở thư mục</b> ở thanh trên cùng (hoặc <span className="pm-kbd">Ctrl</span>{' '}
                  <span className="pm-kbd">O</span>).
                </li>
                <li>Chọn thư mục gốc của dự án, nơi có package.json hoặc index.html.</li>
                <li>Duyệt cây tệp bên trái, nhấn vào tệp để xem nội dung ở giữa.</li>
                <li>
                  Nhấn <b>Chạy</b> để khởi động máy chủ phát triển và xem giao diện trong tab “Xem trước”.
                </li>
              </ol>
              <div className="pm-guide__card">
                <b>Dự án được lưu lại</b>
                <p style={{ margin: '6px 0 0' }}>
                  Mỗi thư mục đã mở được ghi vào danh sách dự án. Lần sau chỉ cần mở lại từ màn hình dự án, không cần
                  chọn lại đường dẫn.
                </p>
              </div>
            </>
          )}

          {section === 'open' && (
            <>
              <h3>Mở và quản lý dự án</h3>
              <p>Có ba cách để mở một dự án:</p>
              <ul>
                <li>Từ thanh trên cùng: nút <b>Mở thư mục</b>.</li>
                <li>Từ cột điều hướng bên trái: biểu tượng thư mục.</li>
                <li>Từ màn hình dự án: nút <b>Mở thư mục</b> ở góc phải.</li>
              </ul>
              <h4>Trong màn hình dự án</h4>
              <ul>
                <li>Nhấn vào thẻ dự án để mở ngay vào màn hình làm việc.</li>
                <li>Biểu tượng ngôi sao để ghim dự án quan trọng lên đầu danh sách.</li>
                <li>Nút <b>Thư mục</b> mở dự án trong File Explorer.</li>
                <li>Biểu tượng thùng rác chỉ xoá dự án khỏi danh sách, không xoá tệp trên đĩa.</li>
              </ul>
              <div className="pm-guide__card">
                <b>PixelMind nhận biết những gì?</b>
                <p style={{ margin: '6px 0 0' }}>
                  Tên dự án, khung công nghệ (React, Vue, Next.js, Vite…), trình quản lý gói (npm/pnpm/yarn/bun), danh
                  sách script trong package.json và nhánh git hiện tại.
                </p>
              </div>
            </>
          )}

          {section === 'run' && (
            <>
              <h3>Chạy dự án</h3>
              <p>
                Ở cột phải, chọn <b>Lệnh chạy</b> rồi nhấn <b>Chạy</b>. Lệnh mặc định là script phát triển đầu tiên
                trong package.json (<code>dev</code>, <code>serve</code>…).
              </p>
              <h4>Điều gì xảy ra tiếp theo</h4>
              <ol>
                <li>PixelMind mở một tiến trình con ngay trong thư mục dự án.</li>
                <li>Toàn bộ đầu ra được hiển thị ở khung nhật ký phía dưới.</li>
                <li>Khi phát hiện địa chỉ localhost, ứng dụng điền sẵn vào ô xem trước.</li>
                <li>Nhấn <b>Dừng</b> (hoặc <span className="pm-kbd">Shift</span> <span className="pm-kbd">F5</span>) để kết thúc cả cây tiến trình.</li>
              </ol>
              <div className="pm-guide__card">
                <b>Dự án không có package.json</b>
                <p style={{ margin: '6px 0 0' }}>
                  PixelMind tự bật máy chủ tĩnh nội bộ trỏ vào thư mục dự án và mở <code>index.html</code>. Rất tiện để
                  xem nhanh một trang HTML/CSS thuần.
                </p>
              </div>
            </>
          )}

          {section === 'preview' && (
            <>
              <h3>Xem trước giao diện</h3>
              <p>
                Tab <b>Xem trước</b> nhúng trực tiếp trang đang chạy. Bạn có thể nhập tay một địa chỉ khác vào ô URL
                rồi nhấn Enter.
              </p>
              <ul>
                <li>Nút tải lại để làm mới khung xem trước.</li>
                <li>Nút mở ngoài để đưa trang sang trình duyệt mặc định.</li>
                <li>Nút vuông để dừng tiến trình ngay tại chỗ.</li>
              </ul>
              <h4>Hai chế độ hiển thị</h4>
              <p>
                Vào <b>Cài đặt → Chạy &amp; xem trước</b> để chọn <b>Nhúng</b> (mặc định) hoặc <b>Trình duyệt</b>.
                Chế độ trình duyệt hữu ích khi dự án chặn nhúng iframe.
              </p>
              <div className="pm-guide__card">
                <b>Mẹo</b>
                <p style={{ margin: '6px 0 0' }}>
                  Bật “Tự động mở bản xem trước” để PixelMind chuyển tab ngay khi máy chủ sẵn sàng.
                </p>
              </div>
            </>
          )}

          {section === 'shortcuts' && (
            <>
              <h3>Phím tắt</h3>
              <table className="pm-shortcuts">
                <tbody>
                  <tr>
                    <td>Mở thư mục dự án</td>
                    <td><span className="pm-kbd">Ctrl</span> <span className="pm-kbd">O</span></td>
                  </tr>
                  <tr>
                    <td>Chạy dự án</td>
                    <td><span className="pm-kbd">F5</span></td>
                  </tr>
                  <tr>
                    <td>Dừng tiến trình</td>
                    <td><span className="pm-kbd">Shift</span> <span className="pm-kbd">F5</span></td>
                  </tr>
                  <tr>
                    <td>Tải lại cây tệp</td>
                    <td><span className="pm-kbd">Ctrl</span> <span className="pm-kbd">R</span></td>
                  </tr>
                  <tr>
                    <td>Bảng lệnh</td>
                    <td><span className="pm-kbd">Ctrl</span> <span className="pm-kbd">K</span></td>
                  </tr>
                  <tr>
                    <td>Cài đặt</td>
                    <td><span className="pm-kbd">Ctrl</span> <span className="pm-kbd">,</span></td>
                  </tr>
                  <tr>
                    <td>Màn hình dự án</td>
                    <td><span className="pm-kbd">Ctrl</span> <span className="pm-kbd">Shift</span> <span className="pm-kbd">O</span></td>
                  </tr>
                  <tr>
                    <td>Hướng dẫn</td>
                    <td><span className="pm-kbd">F1</span></td>
                  </tr>
                  <tr>
                    <td>Đóng hộp thoại</td>
                    <td><span className="pm-kbd">Esc</span></td>
                  </tr>
                </tbody>
              </table>
            </>
          )}

          {section === 'faq' && (
            <>
              <h3>Xử lý sự cố</h3>
              <h4>Không thấy địa chỉ localhost</h4>
              <p>
                Một số script in địa chỉ ra sau vài giây, hoặc dùng cổng khác. Hãy xem nhật ký, sau đó nhập tay địa chỉ
                vào ô URL của tab xem trước.
              </p>
              <h4>Trang xem trước trắng hoặc bị chặn</h4>
              <p>
                Dự án có thể đặt <code>X-Frame-Options</code> hoặc CSP chặn nhúng. Chuyển sang chế độ xem trước bằng
                trình duyệt trong Cài đặt.
              </p>
              <h4>Lệnh chạy báo lỗi “không tìm thấy module”</h4>
              <p>
                Bạn cần cài phụ thuộc trước. Mở dự án trong File Explorer, chạy <code>npm install</code> (hoặc
                <code> pnpm install</code>) một lần, rồi chạy lại trong PixelMind.
              </p>
              <h4>Tiến trình vẫn chạy sau khi đóng cửa sổ</h4>
              <p>
                PixelMind dừng toàn bộ tiến trình con khi thoát. Nếu còn sót, mở Task Manager và kết thúc tiến trình
                Node tương ứng.
              </p>
              <div className="pm-guide__card">
                <b>Đường dẫn dữ liệu</b>
                <p style={{ margin: '6px 0 0' }}>
                  Mở <b>Cài đặt → Dữ liệu</b> để xem tệp lưu danh sách dự án và mở thư mục dữ liệu bằng một cú nhấp.
                </p>
                <p style={{ margin: '6px 0 0' }}>
                  <ExternalLink size={11} /> Không có kết nối mạng nào được gửi đi từ ứng dụng.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default GuideDialog
