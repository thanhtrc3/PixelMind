import React from 'react'
import type { SmartGuideLine } from '../../lib/smartSnapping'

interface SmartGuidesOverlayProps {
  guides: SmartGuideLine[]
}

/**
 * SmartGuidesOverlay — Lớp hiển thị đường dóng thông minh và nhãn khoảng cách/căn lề (D2-07)
 * Hiển thị các đường dóng thẳng đứng (vertical) và nằm ngang (horizontal) phong cách Figma/Sketch
 */
export const SmartGuidesOverlay: React.FC<SmartGuidesOverlayProps> = ({ guides }) => {
  if (!guides || guides.length === 0) return null

  return (
    <div className="canvas__smart-guides-layer" aria-hidden="true">
      {guides.map((g) => {
        const isVert = g.type === 'vertical'
        const length = Math.max(1, g.end - g.start)

        const lineStyle: React.CSSProperties = isVert
          ? {
              left: g.pos,
              top: g.start,
              width: 1,
              height: length,
            }
          : {
              left: g.start,
              top: g.pos,
              width: length,
              height: 1,
            }

        return (
          <React.Fragment key={g.id}>
            <div
              className={`canvas__smart-guide-line ${isVert ? 'is-vertical' : 'is-horizontal'}`}
              style={lineStyle}
            />

            {g.label && g.badgePos && (
              <div
                className="canvas__smart-guide-badge"
                style={{
                  left: g.badgePos.x,
                  top: g.badgePos.y,
                }}
              >
                {g.label}
              </div>
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

