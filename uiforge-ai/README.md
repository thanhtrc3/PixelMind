# UIForge AI

**UIForge AI** là một Visual Development Workspace (giống như Figma dành cho code). Ứng dụng này cho phép bạn mở một dự án web thực tế, xem giao diện đang chạy (Live Preview), và sử dụng AI hoặc kéo thả để chỉnh sửa trực tiếp mã nguồn (Source Code).

Dự án này được xây dựng trên nền tảng **React + TypeScript + Vite**.

---

## 🚀 Hướng dẫn cài đặt và chạy dự án

Để mở và chạy dự án này trên máy của bạn, hãy làm theo các bước sau:

### 1. Yêu cầu hệ thống (Prerequisites)
- Máy tính cần cài đặt sẵn **Node.js** (phiên bản 18 trở lên khuyến nghị). Bạn có thể tải tại [nodejs.org](https://nodejs.org/).

### 2. Cài đặt thư viện (Install Dependencies)
Mở terminal (hoặc Command Prompt / PowerShell) và di chuyển vào thư mục `uiforge-ai`:
```bash
cd d:\Code\PixelMind\uiforge-ai
```
Sau đó, chạy lệnh sau để tải các thư viện cần thiết:
```bash
npm install
```

### 3. Khởi động ứng dụng (Run Development Server)
Sau khi cài đặt xong, chạy lệnh sau để khởi động dự án:
```bash
npm run dev
```
Terminal sẽ hiển thị một đường link (thường là `http://localhost:5173`). Hãy giữ phím **Ctrl** và click vào đường link đó để mở ứng dụng trên trình duyệt của bạn.

---

## 📚 Tài liệu dự án

Các kế hoạch phát triển và kiến trúc của dự án được lưu trữ ở thư mục gốc (`d:\Code\PixelMind\`). Bạn có thể tham khảo các tài liệu sau để hiểu rõ định hướng của UIForge:

- **[Kế hoạch MVP ban đầu](../Ke_hoach_UIForge_AI_Antigravity.md)**: Chứa ý tưởng cốt lõi, kiến trúc 4 phần và các chế độ Canvas.
- **[Kiến trúc Đa cầu nối AI (Multi-Bridge)](../Ke_hoach_NextSteps_UIForge.md)**: Giải thích cách ứng dụng sẽ kết nối với Antigravity IDE, CLI và API đám mây mà không tốn phí.
- **[Sổ tay Bảo mật Tối đa (Zero-Trust Security)](../Security_Plan_UIForge.md)**: Các quy tắc phòng thủ bắt buộc để đảm bảo ứng dụng không bị hack (như chặn Command Injection, bảo vệ WebSocket, mã hóa API Key).

---

## 🛠️ Công nghệ sử dụng (Tech Stack)
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite
- **Layout Engine**: `react-resizable-panels`
- **Icons**: `lucide-react`
- **Styling**: Vanilla CSS (CSS Variables theo hệ màu HSL)
