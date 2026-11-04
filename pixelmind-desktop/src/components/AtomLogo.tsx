interface AtomLogoProps {
  size?: number
  className?: string
  style?: React.CSSProperties
}

/**
 * Biểu tượng thương hiệu PixelMind — Icon nguyên tử Atom chuẩn theo Ảnh 1.
 * Nền hình tròn màu tối (#2b2d39) với 3 quỹ đạo elip và các hạt electron màu xanh cyan phát sáng (#8fe5f5).
 */
export const AtomLogo = ({ size = 18, className = '', style }: AtomLogoProps) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'block', flexShrink: 0, ...style }}
    >
      {/* Vòng nền tròn màu tối chuẩn xác theo Ảnh cũ (#2b2d39) */}
      <circle cx="64" cy="64" r="58" fill="#2b2d39" />

      {/* Hạt nhân trung tâm */}
      <circle cx="64" cy="64" r="3.8" fill="#8fe5f5" />

      {/* 3 quỹ đạo elip giao nhau */}
      <g stroke="#8fe5f5" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
        {/* Quỹ đạo đứng */}
        <ellipse cx="64" cy="64" rx="14" ry="37" />
        {/* Quỹ đạo nghiêng 30 độ */}
        <ellipse cx="64" cy="64" rx="14" ry="37" transform="rotate(60 64 64)" />
        {/* Quỹ đạo nghiêng 150 độ */}
        <ellipse cx="64" cy="64" rx="14" ry="37" transform="rotate(120 64 64)" />
      </g>

      {/* 3 hạt electron đính trên các đỉnh quỹ đạo (hình tam giác cân) */}
      <circle cx="64" cy="27" r="3.8" fill="#8fe5f5" />
      <circle cx="96" cy="82.5" r="3.8" fill="#8fe5f5" />
      <circle cx="32" cy="82.5" r="3.8" fill="#8fe5f5" />
    </svg>
  )
}

export default AtomLogo

