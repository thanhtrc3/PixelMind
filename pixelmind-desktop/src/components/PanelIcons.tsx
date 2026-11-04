interface PanelIconProps {
  active?: boolean
  size?: number
}

/** Icon điều khiển Bố cục Trái (Left Panel / Sidebar) - Chuẩn VS Code */
export function PanelLeftIcon({ active = false, size = 15 }: PanelIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      style={{ display: 'block' }}
    >
      <rect x="1.5" y="1.5" width="13" height="13" rx="2.5" />
      <line x1="6" y1="1.5" x2="6" y2="14.5" />
      {active && (
        <rect
          x="2.1"
          y="2.1"
          width="3.5"
          height="11.8"
          rx="1.5"
          fill="currentColor"
          opacity="0.85"
          stroke="none"
        />
      )}
    </svg>
  )
}

/** Icon điều khiển Bố cục Dưới (Bottom Panel / Console & Terminal) - Chuẩn VS Code */
export function PanelBottomIcon({ active = false, size = 15 }: PanelIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      style={{ display: 'block' }}
    >
      <rect x="1.5" y="1.5" width="13" height="13" rx="2.5" />
      <line x1="1.5" y1="10" x2="14.5" y2="10" />
      {active && (
        <rect
          x="2.1"
          y="10.2"
          width="11.8"
          height="3.7"
          rx="1.5"
          fill="currentColor"
          opacity="0.85"
          stroke="none"
        />
      )}
    </svg>
  )
}

/** Icon điều khiển Bố cục Phải (Right Panel / Run & Inspector Sidebar) - Chuẩn VS Code */
export function PanelRightIcon({ active = false, size = 15 }: PanelIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      style={{ display: 'block' }}
    >
      <rect x="1.5" y="1.5" width="13" height="13" rx="2.5" />
      <line x1="10" y1="1.5" x2="10" y2="14.5" />
      {active && (
        <rect
          x="10.4"
          y="2.1"
          width="3.5"
          height="11.8"
          rx="1.5"
          fill="currentColor"
          opacity="0.85"
          stroke="none"
        />
      )}
    </svg>
  )
}

/** Icon cây bút chì tô đặc (Chuẩn Bootstrap bi-pencil-fill - Ảnh 2) */
export function PencilFillIcon({ size = 13, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
      className={className}
    >
      <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.5.5 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11z" />
    </svg>
  )
}
