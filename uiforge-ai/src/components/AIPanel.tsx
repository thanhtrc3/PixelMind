import { useState } from 'react';
import '../styles/AIPanel.css';

type AIPanelTab = 'chat' | 'tasks' | 'findings' | 'context' | 'settings';

const AI_MODELS = [
  { id: 'antigravity', icon: '🔮', name: 'Antigravity (Gemini)', desc: 'Google Antigravity Agent — tích hợp sâu' },
  { id: 'gpt4o', icon: '🤖', name: 'OpenAI GPT-4o', desc: 'ChatGPT — đa năng' },
  { id: 'claude', icon: '🎭', name: 'Anthropic Claude', desc: 'Claude Sonnet — lý luận tốt' },
  { id: 'local', icon: '💻', name: 'Local Model', desc: 'Ollama / LM Studio — offline' },
];

const SAMPLE_TASKS = [
  { id: 1, status: 'done', label: 'Kiểm tra Header alignment', meta: '2 phút trước', progress: 100 },
  { id: 2, status: 'running', label: 'Sửa Button border-radius', meta: 'Đang chạy…', progress: 60 },
  { id: 3, status: 'pending', label: 'Responsive test 390px', meta: 'Chờ xử lý', progress: 0 },
];

const SAMPLE_FINDINGS = [
  { id: 1, sev: 'critical', label: 'Logo width sai lệch +24px', element: '.header__logo', expected: '120px', actual: '144px' },
  { id: 2, sev: 'warning', label: 'Padding Hero không khớp', element: '.hero', expected: 'padding: 48px', actual: 'padding: 36px' },
  { id: 3, sev: 'ok', label: 'Màu nền Footer', element: '.footer', expected: '#111', actual: '#111' },
];

const SAMPLE_MESSAGES = [
  { id: 1, role: 'system', text: 'Phiên làm việc bắt đầu — chưa có project nào được mở.' },
  { id: 2, role: 'user', text: 'Header đang lệch so với ảnh mẫu, sửa lại cho tôi.' },
  { id: 3, role: 'ai', text: 'Đã phân tích giao diện. Phát hiện 2 vấn đề:\n• Logo rộng hơn 24px\n• Padding top thiếu 12px\n\nĐang tiến hành sửa...' },
  { id: 4, role: 'user', text: 'Tốt, giảm border-radius nút submit xuống 8px.' },
  { id: 5, role: 'ai', text: '✅ Đã cập nhật `border-radius: 8px` cho `.btn-submit`. Giao diện đã được reload.' },
];

const AIPanel = () => {
  const [activeTab, setActiveTab] = useState<AIPanelTab>('chat');
  const [selectedModel, setSelectedModel] = useState('antigravity');
  const [inputText, setInputText] = useState('');

  const tabs: { key: AIPanelTab; label: string; badge?: number }[] = [
    { key: 'chat', label: 'Chat' },
    { key: 'tasks', label: 'Tasks', badge: 1 },
    { key: 'findings', label: 'Issues', badge: 2 },
    { key: 'context', label: 'Context' },
    { key: 'settings', label: 'AI' },
  ];

  const currentModel = AI_MODELS.find((m) => m.id === selectedModel)!;

  return (
    <aside className="ai-panel">
      {/* Header */}
      <div className="ai-panel__header">
        <div className="ai-panel__title">
          <div className="ai-panel__status-dot working" />
          <span>AI Agent</span>
        </div>
        <button className="icon-btn" data-tooltip="Xóa lịch sử chat">🗑</button>
        <button className="icon-btn" data-tooltip="Thu gọn panel">⇥</button>
      </div>

      {/* Model selector */}
      <button
        className="ai-panel__model-selector"
        style={{ display: 'flex', margin: '8px 12px' }}
      >
        <span className="ai-panel__model-icon">{currentModel.icon}</span>
        <span className="ai-panel__model-name">{currentModel.name}</span>
        <span className="ai-panel__model-caret">▾</span>
      </button>

      {/* Tabs */}
      <div className="ai-panel__tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`ai-panel__tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
            {t.badge ? (
              <span className="ai-panel__tab-badge">{t.badge}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="ai-panel__content">

        {/* ── Chat ── */}
        {activeTab === 'chat' && (
          <>
            {/* Messages */}
            <div className="chat-messages">
              {SAMPLE_MESSAGES.map((msg) => (
                <div
                  key={msg.id}
                  className={`chat-message ${
                    msg.role === 'user'
                      ? 'chat-message--user'
                      : msg.role === 'ai'
                      ? 'chat-message--ai'
                      : ''
                  }`}
                >
                  {msg.role === 'system' ? (
                    <div className="chat-bubble chat-bubble--system">{msg.text}</div>
                  ) : (
                    <div
                      className={`chat-bubble ${
                        msg.role === 'user' ? 'chat-bubble--user' : 'chat-bubble--ai'
                      }`}
                      style={{ whiteSpace: 'pre-line' }}
                    >
                      {msg.text}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Context card (selected area) */}
            <div className="chat-context-card">
              <div className="chat-context-thumb">⬚</div>
              <div className="chat-context-info">
                <div className="chat-context-label">Vùng được chọn</div>
                <div className="chat-context-detail">.header — 1440×72px</div>
              </div>
              <button className="chat-context-remove">✕</button>
            </div>

            {/* Input */}
            <div className="chat-input-area">
              <div className="chat-input-box">
                <textarea
                  className="chat-input"
                  placeholder="Mô tả yêu cầu sửa giao diện…"
                  rows={2}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />
                <button className="chat-send-btn" disabled={!inputText.trim()}>
                  ↑
                </button>
              </div>
              <div className="chat-input-actions">
                <button className="icon-btn" data-tooltip="Đính kèm ảnh">📎</button>
                <button className="icon-btn" data-tooltip="Screenshot vùng chọn">📷</button>
                <button className="icon-btn" data-tooltip="Chọn vùng trên canvas">⬚</button>
                <span className="chat-input-hint">Enter gửi · Shift+Enter xuống dòng</span>
              </div>
            </div>
          </>
        )}

        {/* ── Tasks ── */}
        {activeTab === 'tasks' && (
          <div className="task-list">
            {SAMPLE_TASKS.map((t) => (
              <div key={t.id} className="task-item">
                <div className="task-item-header">
                  <div className={`task-item-status ${t.status}`} />
                  <span className="task-item-label">{t.label}</span>
                  <span className="badge badge-neutral">{t.status}</span>
                </div>
                <div className="task-item-meta">{t.meta}</div>
                {t.status === 'running' && (
                  <div className="task-progress-bar">
                    <div className="task-progress-fill" style={{ width: `${t.progress}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Findings ── */}
        {activeTab === 'findings' && (
          <div className="findings-list">
            {SAMPLE_FINDINGS.map((f) => (
              <div key={f.id} className={`finding-item ${f.sev}`}>
                <div className="finding-item-header">
                  <span className="finding-item-label">{f.label}</span>
                  <span
                    className={`badge ${
                      f.sev === 'critical'
                        ? 'badge-error'
                        : f.sev === 'warning'
                        ? 'badge-warning'
                        : 'badge-success'
                    }`}
                  >
                    {f.sev === 'critical' ? '❌' : f.sev === 'warning' ? '⚠' : '✅'}
                  </span>
                </div>
                <div className="finding-item-element">{f.element}</div>
                <div className="finding-item-diff">
                  <span>Mong đợi:</span>
                  <span className="finding-diff-val expected">{f.expected}</span>
                  <span>Hiện tại:</span>
                  <span className="finding-diff-val actual">{f.actual}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Context ── */}
        {activeTab === 'context' && (
          <div className="context-panel">
            <div className="context-screenshot">
              <span>Chưa có vùng được chọn</span>
            </div>
            <div className="context-props">
              <div className="context-prop">
                <span className="context-prop-key">Element</span>
                <span className="context-prop-value">—</span>
              </div>
              <div className="context-prop">
                <span className="context-prop-key">Selector</span>
                <span className="context-prop-value">—</span>
              </div>
              <div className="context-prop">
                <span className="context-prop-key">Kích thước</span>
                <span className="context-prop-value">—</span>
              </div>
              <div className="context-prop">
                <span className="context-prop-key">Tọa độ</span>
                <span className="context-prop-value">—</span>
              </div>
              <div className="context-prop">
                <span className="context-prop-key">Viewport</span>
                <span className="context-prop-value">1440 × 900</span>
              </div>
              <div className="context-prop">
                <span className="context-prop-key">Framework</span>
                <span className="context-prop-value">—</span>
              </div>
            </div>
            <div className="context-empty">
              <div className="context-empty-icon">⬚</div>
              <span>Click vào một phần tử trên Canvas để xem thông tin chi tiết</span>
            </div>
          </div>
        )}

        {/* ── AI Settings ── */}
        {activeTab === 'settings' && (
          <div className="ai-settings">
            <div>
              <div className="ai-settings-label">Chọn AI Model</div>
              {AI_MODELS.map((m) => (
                <div
                  key={m.id}
                  className={`ai-model-card ${selectedModel === m.id ? 'selected' : ''}`}
                  onClick={() => setSelectedModel(m.id)}
                  style={{ marginBottom: 8 }}
                >
                  <div className="ai-model-card-icon">{m.icon}</div>
                  <div className="ai-model-card-info">
                    <div className="ai-model-card-name">{m.name}</div>
                    <div className="ai-model-card-desc">{m.desc}</div>
                  </div>
                  <div className="ai-model-check">
                    {selectedModel === m.id ? '✓' : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </aside>
  );
};

export default AIPanel;

