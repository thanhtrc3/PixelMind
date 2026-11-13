export interface ProjectTemplateFile {
  path: string
  content: string
}

export type TemplateCategory = 'all' | 'dotnet' | 'frontend' | 'fullstack' | 'static'

export interface ProjectTemplate {
  id: string
  name: string
  description: string
  category: TemplateCategory
  framework: string
  badge: string
  iconName: string
  defaultPort: number
  runCommand: string
  files: (projectName: string) => ProjectTemplateFile[]
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  // 1. ASP.NET Core
  {
    id: 'aspnet-core-mvc',
    name: 'ASP.NET Core Web App (MVC / Razor)',
    description: 'Ứng dụng Web C# chuẩn .NET 8.0 với Controllers, Razor Views, Layout và Hot Reload tự động.',
    category: 'dotnet',
    framework: 'ASP.NET Core (net8.0)',
    badge: '.NET 8.0',
    iconName: 'Boxes',
    defaultPort: 5077,
    runCommand: 'dotnet watch --non-interactive run',
    files: (projectName: string) => [
      {
        path: `${projectName}.csproj`,
        content: `<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
</Project>
`,
      },
      {
        path: 'Program.cs',
        content: `var builder = WebApplication.CreateBuilder(args);

// Thêm dịch vụ MVC / Razor Views
builder.Services.AddControllersWithViews();

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
`,
      },
      {
        path: 'appsettings.json',
        content: `{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*"
}
`,
      },
      {
        path: 'Controllers/HomeController.cs',
        content: `using Microsoft.AspNetCore.Mvc;

namespace ${projectName.replace(/[^a-zA-Z0-9]/g, '')}.Controllers;

public class HomeController : Controller
{
    public IActionResult Index()
    {
        ViewData["Title"] = "Trang chủ";
        return View();
    }
}
`,
      },
      {
        path: 'Views/Shared/_Layout.cshtml',
        content: `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>@ViewData["Title"] - ${projectName}</title>
    <link rel="stylesheet" href="~/css/site.css" />
</head>
<body>
    <header class="app-header">
        <div class="nav-container">
            <a class="nav-brand" href="/">⚡ ${projectName}</a>
            <nav class="nav-links">
                <a class="nav-link is-active" href="/">Trang chủ</a>
                <a class="nav-link" href="#features">Tính năng</a>
                <a class="nav-link" href="#contact">Liên hệ</a>
            </nav>
        </div>
    </header>

    <main class="main-content">
        @RenderBody()
    </main>

    <footer class="app-footer">
        <p>&copy; 2026 ${projectName} · Xây dựng với PixelMind & ASP.NET Core</p>
    </footer>
</body>
</html>
`,
      },
      {
        path: 'Views/Home/Index.cshtml',
        content: `@{
    Layout = "_Layout";
}

<section class="hero-section">
    <div class="hero-badge">ASP.NET Core • Razor Views</div>
    <h1 class="hero-title">Chào mừng bạn đến với ${projectName}</h1>
    <p class="hero-subtitle">
        Dự án C# ASP.NET Core MVC đã được cấu hình sẵn. Mọi chỉnh sửa CSS và Razor View sẽ được phản chiếu tức thì qua Hot Reload.
    </p>
    <div class="hero-actions">
        <button class="btn btn-primary" onclick="alert('Xin chào từ PixelMind!')">Khám phá ngay</button>
        <button class="btn btn-secondary">Xem tài liệu</button>
    </div>
</section>
`,
      },
      {
        path: 'wwwroot/css/site.css',
        content: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

body {
  background: #0f172a;
  color: #f8fafc;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(12px);
  position: sticky;
  top: 0;
  z-index: 50;
}

.nav-container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-brand {
  font-size: 18px;
  font-weight: 700;
  color: #a855f7;
  text-decoration: none;
}

.nav-links {
  display: flex;
  gap: 20px;
}

.nav-link {
  color: #94a3b8;
  text-decoration: none;
  font-size: 14px;
  transition: color 0.15s;
}

.nav-link:hover, .nav-link.is-active {
  color: #f8fafc;
}

.main-content {
  flex: 1;
  max-width: 1100px;
  margin: 0 auto;
  padding: 60px 24px;
  width: 100%;
}

.hero-section {
  text-align: center;
  max-width: 720px;
  margin: 40px auto;
}

.hero-badge {
  display: inline-block;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(168, 85, 247, 0.15);
  color: #c084fc;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 20px;
}

.hero-title {
  font-size: 40px;
  line-height: 1.2;
  margin-bottom: 16px;
  background: linear-gradient(135deg, #f8fafc 0%, #cbd5e1 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-subtitle {
  color: #94a3b8;
  font-size: 16px;
  line-height: 1.6;
  margin-bottom: 32px;
}

.hero-actions {
  display: flex;
  gap: 14px;
  justify-content: center;
}

.btn {
  padding: 10px 22px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
}

.btn-primary {
  background: #a855f7;
  color: #fff;
}

.btn-primary:hover {
  background: #9333ea;
}

.btn-secondary {
  background: transparent;
  border-color: rgba(255, 255, 255, 0.15);
  color: #f8fafc;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.05);
}

.app-footer {
  text-align: center;
  padding: 24px;
  color: #64748b;
  font-size: 13px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
`,
      },
      {
        path: 'README.md',
        content: `# ${projectName}

Dự án Web ASP.NET Core MVC được khởi tạo từ PixelMind.

## Cách chạy dự án
Chạy lệnh sau hoặc nhấn nút **Chạy (F5)** trong PixelMind:
\`\`\`bash
dotnet watch --non-interactive run
\`\`\`
`,
      },
    ],
  },

  // 2. React + Vite
  {
    id: 'react-vite-ts',
    name: 'React + Vite (TypeScript)',
    description: 'Dự án Single Page Application hiện đại với React 18, Vite và TypeScript, nạp sẵn CSS module và component mẫu.',
    category: 'frontend',
    framework: 'React + Vite',
    badge: 'React 18',
    iconName: 'Atom',
    defaultPort: 5173,
    runCommand: 'npm run dev',
    files: (projectName: string) => [
      {
        path: 'package.json',
        content: `{
  "name": "${projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "lucide-react": "^0.344.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.22",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.2.2",
    "vite": "^5.1.6"
  }
}
`,
      },
      {
        path: 'vite.config.ts',
        content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
  },
})
`,
      },
      {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName} — React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
      },
      {
        path: 'src/main.tsx',
        content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`,
      },
      {
        path: 'src/App.tsx',
        content: `import { useState } from 'react'
import { Sparkles, Layers, Zap } from 'lucide-react'

export default function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="container">
      <header className="header">
        <div className="brand">⚡ ${projectName}</div>
        <nav className="nav">
          <a href="#features">Tính năng</a>
          <a href="#about">Giới thiệu</a>
        </nav>
      </header>

      <main className="hero">
        <div className="tag">
          <Sparkles size={14} /> React + Vite Starter
        </div>
        <h1>Khởi tạo thành công với PixelMind</h1>
        <p>Ứng dụng React TypeScript đã sẵn sàng. Bạn có thể soi phần tử và sửa style trực tiếp trên Canvas.</p>

        <div className="card-counter">
          <button className="btn-primary" onClick={() => setCount((c) => c + 1)}>
            Đã bấm {count} lần
          </button>
          <span className="hint">Nhấp nút để thử React State</span>
        </div>

        <div className="grid">
          <div className="feature-card">
            <Zap size={20} className="icon-gold" />
            <h3>Siêu nhanh</h3>
            <p>Hỗ trợ Vite HMR cập nhật tức thì dưới 50ms.</p>
          </div>
          <div className="feature-card">
            <Layers size={20} className="icon-purple" />
            <h3>Trực quan</h3>
            <p>Dễ dàng chỉnh sửa layout với Inspector của PixelMind.</p>
          </div>
        </div>
      </main>
    </div>
  )
}
`,
      },
      {
        path: 'src/index.css',
        content: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

body {
  background: #090d16;
  color: #f1f5f9;
  min-height: 100vh;
}

.container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 0 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.brand {
  font-size: 18px;
  font-weight: 700;
  color: #60a5fa;
}

.nav a {
  color: #94a3b8;
  text-decoration: none;
  margin-left: 20px;
  font-size: 14px;
}

.hero {
  text-align: center;
  padding: 60px 0;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(96, 165, 250, 0.12);
  color: #60a5fa;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 20px;
}

h1 {
  font-size: 38px;
  margin-bottom: 16px;
}

p {
  color: #94a3b8;
  font-size: 16px;
  max-width: 600px;
  margin: 0 auto 30px;
}

.card-counter {
  margin: 20px 0 40px;
}

.btn-primary {
  background: #3b82f6;
  color: #fff;
  border: none;
  padding: 12px 28px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-primary:hover {
  background: #2563eb;
}

.hint {
  display: block;
  font-size: 12px;
  color: #64748b;
  margin-top: 8px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-top: 30px;
  text-align: left;
}

.feature-card {
  background: #131b2e;
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 24px;
  border-radius: 12px;
}

.feature-card h3 {
  font-size: 17px;
  margin: 12px 0 6px;
}

.feature-card p {
  font-size: 13.5px;
  margin: 0;
}

.icon-gold { color: #f59e0b; }
.icon-purple { color: #a855f7; }
`,
      },
      {
        path: 'README.md',
        content: `# ${projectName}

Khởi tạo từ PixelMind.

## Bắt đầu
Cài đặt thư viện:
\`\`\`bash
npm install
\`\`\`

Chạy dev server:
\`\`\`bash
npm run dev
\`\`\`
`,
      },
    ],
  },

  // 3. Modern Landing Page (HTML Tĩnh)
  {
    id: 'static-landing-page',
    name: 'Modern Landing Page (HTML/CSS/JS)',
    description: 'Trang đích tĩnh hoàn chỉnh với Hero, Features, Pricing và Testimonials. Chạy ngay bằng Static Server của PixelMind không cần cài thư viện.',
    category: 'static',
    framework: 'Thư mục tĩnh',
    badge: 'Chạy ngay',
    iconName: 'LayoutTemplate',
    defaultPort: 5000,
    runCommand: 'pixelmind static',
    files: (projectName: string) => [
      {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName} — Trang giới thiệu sản phẩm</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header class="navbar">
    <div class="logo">⚡ ${projectName}</div>
    <nav class="menu">
      <a href="#features">Giải pháp</a>
      <a href="#pricing">Bảng giá</a>
      <a href="#contact" class="btn-cta">Dùng thử miễn phí</a>
    </nav>
  </header>

  <section class="hero">
    <span class="badge">🚀 Ra mắt phiên bản 2.0</span>
    <h1>Xây dựng giao diện đẳng cấp trong thời gian ngắn nhất</h1>
    <p>Giải pháp thiết kế và lập trình đồng thời cho các nhà sáng tạo hiện đại. Chỉnh sửa trực quan, xem kết quả tức thì.</p>
    <div class="hero-buttons">
      <button class="btn btn-main">Bắt đầu ngay hôm nay</button>
      <button class="btn btn-outline">Xem bản thử nghiệm</button>
    </div>
  </section>

  <section id="features" class="features">
    <div class="feature-box">
      <div class="feat-icon">⚡</div>
      <h3>Tốc độ vượt trội</h3>
      <p>Tối ưu hóa từng dòng code giúp website tải nhanh dưới 1 giây.</p>
    </div>
    <div class="feature-box">
      <div class="feat-icon">🎨</div>
      <h3>Tùy biến dễ dàng</h3>
      <p>Hệ thống CSS Variables rõ ràng, chỉnh màu sắc và khoảng cách trong 1 nốt nhạc.</p>
    </div>
    <div class="feature-box">
      <div class="feat-icon">📱</div>
      <h3>Chuẩn mọi màn hình</h3>
      <p>Tự động co giãn mượt mà từ màn hình điện thoại đến máy tính rộng.</p>
    </div>
  </section>

  <footer class="footer">
    <p>&copy; 2026 ${projectName}. Tạo bởi PixelMind.</p>
  </footer>
</body>
</html>
`,
      },
      {
        path: 'style.css',
        content: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  font-family: system-ui, -apple-system, sans-serif;
}

body {
  background: #0b0f19;
  color: #e2e8f0;
  line-height: 1.6;
}

.navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 40px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.logo {
  font-size: 20px;
  font-weight: bold;
  color: #38bdf8;
}

.menu a {
  color: #94a3b8;
  text-decoration: none;
  margin-left: 24px;
  font-size: 14px;
  transition: color 0.15s;
}

.menu a:hover {
  color: #fff;
}

.btn-cta {
  background: #38bdf8;
  color: #0b0f19 !important;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
}

.hero {
  text-align: center;
  padding: 90px 20px 60px;
  max-width: 800px;
  margin: 0 auto;
}

.badge {
  background: rgba(56, 189, 248, 0.12);
  color: #38bdf8;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  display: inline-block;
  margin-bottom: 24px;
}

.hero h1 {
  font-size: 46px;
  line-height: 1.2;
  margin-bottom: 20px;
}

.hero p {
  font-size: 18px;
  color: #94a3b8;
  margin-bottom: 36px;
}

.hero-buttons {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.btn {
  padding: 12px 26px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.btn-main {
  background: #38bdf8;
  color: #0b0f19;
  border: none;
}

.btn-outline {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 24px;
  max-width: 1000px;
  margin: 60px auto;
  padding: 0 20px;
}

.feature-box {
  background: #151d30;
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 28px;
  border-radius: 12px;
}

.feat-icon {
  font-size: 26px;
  margin-bottom: 12px;
}

.feature-box h3 {
  margin-bottom: 8px;
}

.feature-box p {
  color: #94a3b8;
  font-size: 14px;
}

.footer {
  text-align: center;
  padding: 40px 20px;
  color: #64748b;
  font-size: 13px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
`,
      },
      {
        path: 'README.md',
        content: `# ${projectName}

Trang web tĩnh HTML/CSS/JS.

Nhấn nút **Chạy (F5)** trong PixelMind để xem trực tiếp ngay lập tức!
`,
      },
    ],
  },

  // 4. Admin Dashboard
  {
    id: 'admin-dashboard-ui',
    name: 'Admin Dashboard (Bảng điều khiển Quản trị)',
    description: 'Mẫu trang quản trị chuyên nghiệp với Sidebar danh mục, thống kê KPI, biểu đồ và bảng quản lý người dùng.',
    category: 'static',
    framework: 'Thư mục tĩnh',
    badge: 'Dashboard',
    iconName: 'LayoutDashboard',
    defaultPort: 5000,
    runCommand: 'pixelmind static',
    files: (projectName: string) => [
      {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName} — Bảng quản trị</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-brand">⚡ ${projectName}</div>
      <nav class="nav-menu">
        <a href="#" class="active">📊 Tổng quan</a>
        <a href="#">👥 Người dùng</a>
        <a href="#">📦 Đơn hàng</a>
        <a href="#">⚙️ Cài đặt</a>
      </nav>
    </aside>

    <div class="content-wrapper">
      <header class="topbar">
        <h2>Bảng tổng quan</h2>
        <div class="user-pill">Admin · Quản trị viên</div>
      </header>

      <main class="content">
        <div class="stats-row">
          <div class="stat-card">
            <span class="label">Tổng doanh thu</span>
            <div class="val">145.200.000 ₫</div>
            <span class="trend up">+18% so với tháng trước</span>
          </div>
          <div class="stat-card">
            <span class="label">Đơn hàng mới</span>
            <div class="val">1.284</div>
            <span class="trend up">+9.2%</span>
          </div>
          <div class="stat-card">
            <span class="label">Khách hàng mới</span>
            <div class="val">492</div>
            <span class="trend down">-2.4%</span>
          </div>
        </div>

        <div class="table-card">
          <h3>Đơn hàng gần đây</h3>
          <table>
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Khách hàng</th>
                <th>Giá trị</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>#DH-8921</td>
                <td>Nguyễn Văn An</td>
                <td>1.450.000 ₫</td>
                <td><span class="badge ok">Hoàn thành</span></td>
              </tr>
              <tr>
                <td>#DH-8920</td>
                <td>Trần Thị Bình</td>
                <td>890.000 ₫</td>
                <td><span class="badge pending">Đang giao</span></td>
              </tr>
              <tr>
                <td>#DH-8919</td>
                <td>Lê Hoàng Nam</td>
                <td>2.100.000 ₫</td>
                <td><span class="badge ok">Hoàn thành</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  </div>
</body>
</html>
`,
      },
      {
        path: 'style.css',
        content: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  font-family: system-ui, -apple-system, sans-serif;
}

body {
  background: #0f172a;
  color: #f8fafc;
}

.layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 240px;
  background: #1e293b;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  padding: 24px 16px;
}

.sidebar-brand {
  font-size: 17px;
  font-weight: 700;
  color: #38bdf8;
  margin-bottom: 30px;
  padding-left: 8px;
}

.nav-menu a {
  display: block;
  padding: 10px 12px;
  color: #94a3b8;
  text-decoration: none;
  border-radius: 6px;
  font-size: 14px;
  margin-bottom: 6px;
}

.nav-menu a:hover, .nav-menu a.active {
  background: rgba(56, 189, 248, 0.12);
  color: #38bdf8;
}

.content-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 32px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: #1e293b;
}

.user-pill {
  font-size: 13px;
  background: #334155;
  padding: 6px 14px;
  border-radius: 999px;
  color: #cbd5e1;
}

.content {
  padding: 32px;
  flex: 1;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
  margin-bottom: 28px;
}

.stat-card {
  background: #1e293b;
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 20px;
  border-radius: 10px;
}

.stat-card .label {
  font-size: 13px;
  color: #94a3b8;
}

.stat-card .val {
  font-size: 26px;
  font-weight: 700;
  margin: 6px 0;
}

.stat-card .trend {
  font-size: 12px;
}

.trend.up { color: #4ade80; }
.trend.down { color: #f87171; }

.table-card {
  background: #1e293b;
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 24px;
  border-radius: 10px;
}

.table-card h3 {
  margin-bottom: 16px;
  font-size: 16px;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

th {
  text-align: left;
  padding: 10px 12px;
  color: #94a3b8;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

td {
  padding: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.badge {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11.5px;
  font-weight: 600;
}

.badge.ok {
  background: rgba(74, 222, 128, 0.15);
  color: #4ade80;
}

.badge.pending {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
}
`,
      },
      {
        path: 'README.md',
        content: `# ${projectName}

Bảng điều khiển quản trị (Dashboard UI). Chạy bằng F5 trong PixelMind.
`,
      },
    ],
  },

  // 5. Vue 3 + Vite
  {
    id: 'vue3-vite',
    name: 'Vue 3 + Vite',
    description: 'Dự án Vue 3 với Script Setup, Vite và Single File Components (.vue).',
    category: 'frontend',
    framework: 'Vue + Vite',
    badge: 'Vue 3',
    iconName: 'Component',
    defaultPort: 5173,
    runCommand: 'npm run dev',
    files: (projectName: string) => [
      {
        path: 'package.json',
        content: `{
  "name": "${projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "vue": "^3.4.21"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.4",
    "vite": "^5.1.6"
  }
}
`,
      },
      {
        path: 'vite.config.js',
        content: `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173
  }
})
`,
      },
      {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName} — Vue 3 App</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
`,
      },
      {
        path: 'src/main.js',
        content: `import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

createApp(App).mount('#app')
`,
      },
      {
        path: 'src/App.vue',
        content: `<script setup>
import { ref } from 'vue'

const count = ref(0)
</script>

<template>
  <div class="vue-container">
    <div class="logo">🟢 Vue 3 + Vite</div>
    <h1>${projectName}</h1>
    <p>Dự án Vue 3 với Script Setup và Vite HMR siêu tốc.</p>
    <button class="btn" @click="count++">Số lần bấm: {{ count }}</button>
  </div>
</template>

<style scoped>
.vue-container {
  max-width: 600px;
  margin: 80px auto;
  text-align: center;
  padding: 40px;
  background: #182234;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.logo {
  font-size: 18px;
  font-weight: 700;
  color: #42b883;
  margin-bottom: 12px;
}
h1 {
  font-size: 32px;
  margin-bottom: 12px;
}
p {
  color: #94a3b8;
  margin-bottom: 24px;
}
.btn {
  background: #42b883;
  color: #0f172a;
  border: none;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}
</style>
`,
      },
      {
        path: 'src/style.css',
        content: `body {
  margin: 0;
  background: #0f172a;
  color: #f8fafc;
  font-family: system-ui, -apple-system, sans-serif;
}
`,
      },
      {
        path: 'README.md',
        content: `# ${projectName}

Khởi tạo từ PixelMind.

\`\`\`bash
npm install
npm run dev
\`\`\`
`,
      },
    ],
  },

  // 6. Next.js App Router
  {
    id: 'nextjs-app-router',
    name: 'Next.js App Router (React Framework)',
    description: 'Dự án Next.js 14 với App Router, Server Components và cấu trúc routing chuẩn mực.',
    category: 'fullstack',
    framework: 'Next.js',
    badge: 'Next.js 14',
    iconName: 'Globe',
    defaultPort: 3000,
    runCommand: 'npm run dev',
    files: (projectName: string) => [
      {
        path: 'package.json',
        content: `{
  "name": "${projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "14.1.4",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}
`,
      },
      {
        path: 'app/layout.js',
        content: `export const metadata = {
  title: '${projectName}',
  description: 'Tạo bởi PixelMind với Next.js',
}

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body style={{ margin: 0, background: '#090d16', color: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
`,
      },
      {
        path: 'app/page.js',
        content: `export default function Home() {
  return (
    <main style={{ maxWidth: 800, margin: '80px auto', padding: 20, textAlign: 'center' }}>
      <span style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: 999, fontSize: 13 }}>
        ▲ Next.js 14 App Router
      </span>
      <h1 style={{ fontSize: 40, margin: '20px 0 10px' }}>${projectName}</h1>
      <p style={{ color: '#94a3b8', fontSize: 16 }}>Dự án Next.js đã sẵn sàng chạy với PixelMind.</p>
    </main>
  )
}
`,
      },
      {
        path: 'README.md',
        content: `# ${projectName}

Khởi tạo từ PixelMind.

\`\`\`bash
npm install
npm run dev
\`\`\`
`,
      },
    ],
  },

  // 7. PHP Web App
  {
    id: 'php-starter',
    name: 'PHP Web Application (Modern PHP)',
    description: 'Ứng dụng PHP với router điều hướng, layout template và chạy trực tiếp bằng built-in web server của PHP.',
    category: 'fullstack',
    framework: 'PHP App',
    badge: 'PHP',
    iconName: 'FileCode',
    defaultPort: 8000,
    runCommand: 'php -S localhost:8000',
    files: (projectName: string) => [
      {
        path: 'index.php',
        content: `<?php
$title = "${projectName} — PHP Application";
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <title><?= htmlspecialchars($title) ?></title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="box">
        <div class="badge">🐘 PHP <?= phpversion() ?></div>
        <h1><?= htmlspecialchars($title) ?></h1>
        <p>Ứng dụng PHP sẵn sàng chỉnh sửa và xem trực tiếp trên Canvas PixelMind.</p>
        <p class="time">Thời gian máy chủ: <?= date('Y-m-d H:i:s') ?></p>
    </div>
</body>
</html>
`,
      },
      {
        path: 'style.css',
        content: `body {
  margin: 0;
  background: #0f172a;
  color: #f8fafc;
  font-family: system-ui, sans-serif;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}
.box {
  background: #1e293b;
  padding: 40px;
  border-radius: 12px;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.badge {
  color: #818cf8;
  font-weight: 600;
  margin-bottom: 12px;
}
h1 { margin-bottom: 10px; font-size: 28px; }
p { color: #94a3b8; font-size: 15px; margin-bottom: 8px; }
.time { font-family: monospace; color: #38bdf8; }
`,
      },
      {
        path: 'README.md',
        content: `# ${projectName}

Chạy dự án:
\`\`\`bash
php -S localhost:8000
\`\`\`
`,
      },
    ],
  },

  // 8. Python Web App
  {
    id: 'python-web-app',
    name: 'Python Web App (FastAPI / Flask)',
    description: 'Ứng dụng Python backend gọn nhẹ với tệp app.py máy chủ và thư mục static phục vụ giao diện.',
    category: 'fullstack',
    framework: 'Python App',
    badge: 'Python',
    iconName: 'Terminal',
    defaultPort: 8000,
    runCommand: 'python app.py',
    files: (projectName: string) => [
      {
        path: 'app.py',
        content: `from http.server import SimpleHTTPRequestHandler, HTTPServer
import os

PORT = 8000

class CustomHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

if __name__ == '__main__':
    print(f"🐍 Máy chủ Python đang chạy tại http://localhost:{PORT}")
    server = HTTPServer(('localhost', PORT), CustomHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\\nĐã dừng máy chủ.")
`,
      },
      {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${projectName} — Python Web</title>
  <style>
    body { background: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
    .card { background: #1e293b; padding: 40px; border-radius: 12px; text-align: center; border: 1px solid rgba(255,255,255,0.08); }
    .badge { color: #fbbf24; font-weight: 700; margin-bottom: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">🐍 Python Web App</div>
    <h1>${projectName}</h1>
    <p>Khởi chạy thành công từ PixelMind.</p>
  </div>
</body>
</html>
`,
      },
      {
        path: 'README.md',
        content: `# ${projectName}

Khởi chạy máy chủ:
\`\`\`bash
python app.py
\`\`\`
`,
      },
    ],
  },
]
