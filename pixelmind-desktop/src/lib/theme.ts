/** Chuyển mã màu hex sang các biến CSS phái sinh cho màu nhấn. */

const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)))

const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace('#', '')
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean
  const value = Number.parseInt(full.slice(0, 6), 16)
  if (Number.isNaN(value)) return [109, 93, 245]
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

const mix = (hex: string, target: number, amount: number): string => {
  const [r, g, b] = hexToRgb(hex)
  const blend = (channel: number) => clamp(channel + (target - channel) * amount)
  return `#${[blend(r), blend(g), blend(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

export function applyThemeVariables(accent: string, fontSize: number) {
  const root = document.documentElement
  const [r, g, b] = hexToRgb(accent)

  root.style.setProperty('--accent', accent)
  root.style.setProperty('--accent-strong', mix(accent, 0, 0.16))
  root.style.setProperty('--accent-2', mix(accent, 255, 0.24))
  root.style.setProperty('--accent-hover', mix(accent, 255, 0.24))
  root.style.setProperty('--accent-text', mix(accent, 255, 0.6))
  root.style.setProperty('--accent-soft', `rgba(${r}, ${g}, ${b}, 0.14)`)
  root.style.setProperty('--accent-muted', `rgba(${r}, ${g}, ${b}, 0.14)`)
  root.style.setProperty('--accent-muted-2', `rgba(${r}, ${g}, ${b}, 0.22)`)
  root.style.setProperty('--accent-line', `rgba(${r}, ${g}, ${b}, 0.42)`)
  root.style.setProperty('--border-focus', accent)

  root.style.setProperty('--font-base', `${fontSize}px`)
  root.style.setProperty('--font-md', `${fontSize + 1}px`)
  root.style.setProperty('--font-lg', `${fontSize + 3}px`)
  root.style.setProperty('--font-sm', `${Math.max(10, fontSize - 1)}px`)
  root.style.setProperty('--font-xs', `${Math.max(9, fontSize - 2)}px`)
  root.style.setProperty('--font-2xs', `${Math.max(9, fontSize - 3)}px`)
}
