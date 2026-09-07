# Kế hoạch phát triển: Ứng dụng Thiết kế Giao diện AI (Giống Figma)

Dự án này nhằm xây dựng một ứng dụng web giống Figma, đóng vai trò là cầu nối giữa người dùng và Antigravity AI. Người dùng có thể xem hình ảnh thiết kế, kiểm tra giao diện và trực tiếp ra lệnh cho AI để tạo hoặc chỉnh sửa lỗi UI.

## 1. Mục tiêu
Xây dựng một công cụ hỗ trợ thiết kế giao diện:
- Hiển thị bản vẽ/hình ảnh UI.
- Giao tiếp trực tiếp với AI (Antigravity) qua chat.
- AI có thể nhận diện yêu cầu, khoanh vùng lỗi và tiến hành sửa chữa mã nguồn giao diện (HTML/CSS/JS) ngay lập tức.

## 2. Các thành phần chính của ứng dụng
- **Khu vực Canvas (Không gian làm việc chính):** 
  - **Chế độ hiển thị:** Hỗ trợ hiển thị ảnh thiết kế (Mockup) VÀ hiển thị trực tiếp trang web (Live Web Preview qua iframe hoặc DOM overlay).
  - **Công cụ "Khoanh vùng" (Lasso/Select Tool):** Cho phép vẽ một vòng tròn/khung chữ nhật xung quanh một khu vực lỗi trên giao diện web hoặc ảnh để chọn mục tiêu.
  - Hỗ trợ thao tác Zoom (Phóng to/thu nhỏ), Pan (Di chuyển).
- **Thanh công cụ (Toolbar):** Các công cụ cơ bản như chọn (Select), khoanh vùng (Lasso), xem code.
- **Khu vực Chat AI (Bên phải):** Giao diện tương tác trò chuyện. Người dùng khoanh vùng một nút, nhập: "Sửa lại nút này cho góc bo tròn hơn". AI sẽ nhận diện vùng đó, đọc code của vùng đó và tiến hành sửa trực tiếp.
- **Trình cắm Đa AI (Multi-AI Plugin System):** Giao diện cho phép chuyển đổi linh hoạt giữa Antigravity, OpenAI (ChatGPT), Anthropic (Claude), hoặc các model Local để xử lý yêu cầu.
- **Khu vực Quản lý Layer/File (Bên trái):** Hiển thị danh sách các thành phần đang có trên Canvas.

## 3. Công nghệ đề xuất (Tech Stack)
Để đảm bảo trải nghiệm giống ứng dụng Desktop thực thụ (nhanh, mượt) nhưng vẫn dễ dàng triển khai, tôi đề xuất:
- **Frontend Framework:** React (sử dụng Vite) kết hợp TypeScript. 
- **Styling:** CSS thuần (Vanilla CSS) để dễ dàng kiểm soát chi tiết về thẩm mỹ (Aesthetics). Thiết kế sẽ hướng đến giao diện tối (Dark mode) sang trọng, mang lại cảm giác "Premium".
- **Quản lý State:** Zustand (để quản lý các thao tác phức tạp trên Canvas).
- **Backend / Integration Layer:** Node.js (hoặc Next.js API Routes) đóng vai trò là "Cổng kết nối AI" (AI Gateway). Lớp này sẽ chứa Adapter để liên kết ứng dụng với API của Antigravity, OpenAI, v.v.
- **Cơ chế đọc & sửa Code:** Giao tiếp qua WebSockets để truyền DOM state (trạng thái trang web) và nhận trực tiếp các bản vá code (code patches) từ AI để cập nhật giao diện realtime.

## 4. Các giai đoạn thực hiện (Phases)

### Giai đoạn 1: Xây dựng nền tảng (Foundation)
- Thiết lập cấu trúc dự án React + Vite.
- Xây dựng hệ thống UI cơ bản (Colors, Typography) cho chế độ Dark mode.
- Dựng Layout chính chia làm 3 cột: Sidebar Trái, Canvas Giữa, Chat AI Phải.

### Giai đoạn 2: Phát triển Canvas & Tương tác hình ảnh
- Viết tính năng tải (upload) và hiển thị hình ảnh trên Canvas.
- Phát triển tính năng Zoom và Pan mượt mà (sử dụng ma trận biến đổi Transform matrix hoặc thư viện hỗ trợ).

### Giai đoạn 3: Tích hợp Đa AI và Cơ chế "Khoanh Vùng - Sửa Lỗi"
- **AI Gateway:** Xây dựng hệ thống Plugin/Adapter để hỗ trợ gọi API tới nhiều AI khác nhau (Antigravity, OpenAI, Anthropic...).
- **Tính năng "Khoanh vùng" (Lasso Tool):** Khi người dùng khoanh tròn một điểm trên Live Web Preview, ứng dụng sẽ trích xuất tọa độ hoặc cây DOM HTML của vùng đó.
- **Luồng xử lý tự động:** 
  1. Khoanh vùng -> 2. Nhập lệnh -> 3. App gửi [Ảnh vùng chọn + Code HTML/CSS hiện tại của vùng đó + Lệnh của bạn] qua AI Gateway.
  4. AI (Antigravity/LLM khác) trả về Code mới.
  5. App tự động thay thế Code cũ trên Canvas để bạn xem kết quả ngay lập tức.

### Giai đoạn 4: Hoàn thiện (Polish & Optimize)
- Tối ưu hóa hiệu năng để đảm bảo mượt mà khi hình ảnh lớn.
- Thêm các vi hiệu ứng (Micro-animations) như khi di chuột vào nút, gửi tin nhắn.
- Đảm bảo thiết kế giao diện phải đẹp và "WOW".
