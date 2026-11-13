/**
 * smartSnapping.ts — Thuật toán Smart Guides & Snapping cho Canvas (D2-07)
 * Hỗ trợ căn dóng theo cạnh trái, phải, trên, dưới và tâm phần tử khi Move hoặc Resize.
 */

export interface RectBox {
  left: number
  top: number
  width: number
  height: number
  label?: string
}

export interface SmartGuideLine {
  id: string
  type: 'vertical' | 'horizontal'
  /** Tọa độ trục vuông góc với đường dóng (X đối với vertical, Y đối với horizontal) */
  pos: number
  /** Tọa độ điểm bắt đầu dọc theo đường dóng */
  start: number
  /** Tọa độ điểm kết thúc dọc theo đường dóng */
  end: number
  /** Nhãn mô tả (ví dụ: 'Căn giữa', 'Cạnh trái', '0px', ...) */
  label?: string
  /** Vị trí đặt badge khoảng cách/nhãn */
  badgePos?: { x: number; y: number }
}

export interface SnapResult {
  left: number
  top: number
  width: number
  height: number
  guides: SmartGuideLine[]
}

const DEFAULT_THRESHOLD = 6 // Khoảng cách snap chuẩn (6px)

/**
 * Trích xuất danh sách các RectBox tham chiếu xung quanh phần tử đang chọn
 */
export function collectCandidateRects(
  doc: Document | null | undefined,
  selectedUid?: string,
  parentRect?: RectBox | null,
  containerSize?: { width: number; height: number }
): RectBox[] {
  const candidates: RectBox[] = []

  // 1. Thêm khung cha (nếu có)
  if (parentRect && parentRect.width > 0 && parentRect.height > 0) {
    candidates.push({
      left: Math.round(parentRect.left),
      top: Math.round(parentRect.top),
      width: Math.round(parentRect.width),
      height: Math.round(parentRect.height),
      label: 'Khung cha',
    })
  }

  // 2. Thêm các phần tử anh em (siblings) từ DOM trong iframe
  if (doc && selectedUid) {
    try {
      const activeEl = doc.querySelector(`[data-pm-uid="${selectedUid}"]`)
      if (activeEl?.parentElement) {
        const siblings = Array.from(activeEl.parentElement.children)
        for (const sib of siblings) {
          if (sib !== activeEl && sib instanceof HTMLElement) {
            const r = sib.getBoundingClientRect()
            // Bỏ qua các phần tử ẩn hoặc quá bé
            if (r.width >= 4 && r.height >= 4) {
              candidates.push({
                left: Math.round(r.left),
                top: Math.round(r.top),
                width: Math.round(r.width),
                height: Math.round(r.height),
                label: sib.tagName.toLowerCase(),
              })
            }
          }
        }
      }
    } catch {
      // Bỏ qua lỗi DOM nếu có
    }
  }

  // 3. Thêm viền container khung nhìn nếu có kích thước
  if (containerSize && containerSize.width > 0 && containerSize.height > 0) {
    candidates.push({
      left: 0,
      top: 0,
      width: containerSize.width,
      height: containerSize.height,
      label: 'Viền khung nhìn',
    })
  }

  return candidates
}

/**
 * Tính toán Snapping khi Kéo Di Chuyển (Move)
 */
export function calculateMoveSnap(
  proposed: RectBox,
  candidates: RectBox[],
  threshold = DEFAULT_THRESHOLD,
  bypass = false
): SnapResult {
  if (bypass || candidates.length === 0) {
    return { ...proposed, guides: [] }
  }

  let snappedLeft = proposed.left
  let snappedTop = proposed.top
  const guides: SmartGuideLine[] = []

  const activeCenterX = proposed.left + proposed.width / 2
  const activeRight = proposed.left + proposed.width
  const activeCenterY = proposed.top + proposed.height / 2
  const activeBottom = proposed.top + proposed.height

  // ─── TÍNH TOÁN THEO TRỤC DỌC (X) ───
  let minDiffX = threshold + 1
  let bestTargetX: {
    guideX: number
    snappedLeft: number
    start: number
    end: number
    label: string
  } | null = null

  for (const cand of candidates) {
    const candCenterX = cand.left + cand.width / 2
    const candRight = cand.left + cand.width

    const testPairs: Array<{
      activeVal: number
      targetVal: number
      calcLeft: number
      label: string
    }> = [
      { activeVal: proposed.left, targetVal: cand.left, calcLeft: cand.left, label: 'Cạnh trái' },
      { activeVal: activeCenterX, targetVal: candCenterX, calcLeft: candCenterX - proposed.width / 2, label: 'Căn giữa (X)' },
      { activeVal: activeRight, targetVal: candRight, calcLeft: candRight - proposed.width, label: 'Cạnh phải' },
      { activeVal: proposed.left, targetVal: candRight, calcLeft: candRight, label: 'Giáp cạnh phải' },
      { activeVal: activeRight, targetVal: cand.left, calcLeft: cand.left - proposed.width, label: 'Giáp cạnh trái' },
    ]

    for (const pair of testPairs) {
      const diff = Math.abs(pair.activeVal - pair.targetVal)
      if (diff <= threshold && diff < minDiffX) {
        minDiffX = diff
        const startY = Math.min(proposed.top, cand.top) - 16
        const endY = Math.max(activeBottom, cand.top + cand.height) + 16
        bestTargetX = {
          guideX: Math.round(pair.targetVal),
          snappedLeft: Math.round(pair.calcLeft),
          start: Math.round(startY),
          end: Math.round(endY),
          label: pair.label,
        }
      }
    }
  }

  if (bestTargetX) {
    snappedLeft = bestTargetX.snappedLeft
    guides.push({
      id: `v-${bestTargetX.guideX}`,
      type: 'vertical',
      pos: bestTargetX.guideX,
      start: bestTargetX.start,
      end: bestTargetX.end,
      label: bestTargetX.label,
      badgePos: { x: bestTargetX.guideX + 4, y: (bestTargetX.start + bestTargetX.end) / 2 },
    })
  }

  // ─── TÍNH TOÁN THEO TRỤC NGANG (Y) ───
  let minDiffY = threshold + 1
  let bestTargetY: {
    guideY: number
    snappedTop: number
    start: number
    end: number
    label: string
  } | null = null

  for (const cand of candidates) {
    const candCenterY = cand.top + cand.height / 2
    const candBottom = cand.top + cand.height

    const testPairs: Array<{
      activeVal: number
      targetVal: number
      calcTop: number
      label: string
    }> = [
      { activeVal: proposed.top, targetVal: cand.top, calcTop: cand.top, label: 'Cạnh trên' },
      { activeVal: activeCenterY, targetVal: candCenterY, calcTop: candCenterY - proposed.height / 2, label: 'Căn giữa (Y)' },
      { activeVal: activeBottom, targetVal: candBottom, calcTop: candBottom - proposed.height, label: 'Cạnh dưới' },
      { activeVal: proposed.top, targetVal: candBottom, calcTop: candBottom, label: 'Giáp cạnh dưới' },
      { activeVal: activeBottom, targetVal: cand.top, calcTop: cand.top - proposed.height, label: 'Giáp cạnh trên' },
    ]

    for (const pair of testPairs) {
      const diff = Math.abs(pair.activeVal - pair.targetVal)
      if (diff <= threshold && diff < minDiffY) {
        minDiffY = diff
        const startX = Math.min(snappedLeft, cand.left) - 16
        const endX = Math.max(snappedLeft + proposed.width, cand.left + cand.width) + 16
        bestTargetY = {
          guideY: Math.round(pair.targetVal),
          snappedTop: Math.round(pair.calcTop),
          start: Math.round(startX),
          end: Math.round(endX),
          label: pair.label,
        }
      }
    }
  }

  if (bestTargetY) {
    snappedTop = bestTargetY.snappedTop
    guides.push({
      id: `h-${bestTargetY.guideY}`,
      type: 'horizontal',
      pos: bestTargetY.guideY,
      start: bestTargetY.start,
      end: bestTargetY.end,
      label: bestTargetY.label,
      badgePos: { x: (bestTargetY.start + bestTargetY.end) / 2, y: bestTargetY.guideY + 4 },
    })
  }

  return {
    left: snappedLeft,
    top: snappedTop,
    width: proposed.width,
    height: proposed.height,
    guides,
  }
}

/**
 * Tính toán Snapping khi Kéo Co Giãn (Resize với 8 điểm neo)
 */
export function calculateResizeSnap(
  handle: string,
  proposed: RectBox,
  candidates: RectBox[],
  threshold = DEFAULT_THRESHOLD,
  bypass = false
): SnapResult {
  if (bypass || candidates.length === 0) {
    return { ...proposed, guides: [] }
  }

  let { left, top, width, height } = proposed
  const guides: SmartGuideLine[] = []

  const activeRight = left + width
  const activeBottom = top + height

  // 1. Co giãn cạnh phải (e, ne, se)
  if (handle.includes('e')) {
    let minDiff = threshold + 1
    let bestSnap: { targetX: number; start: number; end: number; label: string } | null = null

    for (const cand of candidates) {
      const candRight = cand.left + cand.width
      const candCenter = cand.left + cand.width / 2

      const targets = [
        { val: cand.left, label: 'Cạnh trái' },
        { val: candCenter, label: 'Căn giữa (X)' },
        { val: candRight, label: 'Cạnh phải' },
      ]

      for (const t of targets) {
        const diff = Math.abs(activeRight - t.val)
        if (diff <= threshold && diff < minDiff) {
          minDiff = diff
          bestSnap = {
            targetX: Math.round(t.val),
            start: Math.min(top, cand.top) - 16,
            end: Math.max(activeBottom, cand.top + cand.height) + 16,
            label: t.label,
          }
        }
      }
    }

    if (bestSnap) {
      const newWidth = Math.max(10, bestSnap.targetX - left)
      width = newWidth
      guides.push({
        id: `resize-e-${bestSnap.targetX}`,
        type: 'vertical',
        pos: bestSnap.targetX,
        start: bestSnap.start,
        end: bestSnap.end,
        label: `${bestSnap.label}: ${Math.round(width)}px`,
        badgePos: { x: bestSnap.targetX + 4, y: top + height / 2 },
      })
    }
  }

  // 2. Co giãn cạnh trái (w, nw, sw)
  if (handle.includes('w')) {
    let minDiff = threshold + 1
    let bestSnap: { targetX: number; start: number; end: number; label: string } | null = null

    for (const cand of candidates) {
      const candRight = cand.left + cand.width
      const candCenter = cand.left + cand.width / 2

      const targets = [
        { val: cand.left, label: 'Cạnh trái' },
        { val: candCenter, label: 'Căn giữa (X)' },
        { val: candRight, label: 'Cạnh phải' },
      ]

      for (const t of targets) {
        const diff = Math.abs(left - t.val)
        if (diff <= threshold && diff < minDiff) {
          minDiff = diff
          bestSnap = {
            targetX: Math.round(t.val),
            start: Math.min(top, cand.top) - 16,
            end: Math.max(activeBottom, cand.top + cand.height) + 16,
            label: t.label,
          }
        }
      }
    }

    if (bestSnap) {
      const oldRight = left + width
      const newLeft = bestSnap.targetX
      const newWidth = Math.max(10, oldRight - newLeft)
      left = oldRight - newWidth
      width = newWidth
      guides.push({
        id: `resize-w-${bestSnap.targetX}`,
        type: 'vertical',
        pos: bestSnap.targetX,
        start: bestSnap.start,
        end: bestSnap.end,
        label: `${bestSnap.label}: ${Math.round(width)}px`,
        badgePos: { x: bestSnap.targetX + 4, y: top + height / 2 },
      })
    }
  }

  // 3. Co giãn cạnh dưới (s, se, sw)
  if (handle.includes('s')) {
    let minDiff = threshold + 1
    let bestSnap: { targetY: number; start: number; end: number; label: string } | null = null

    for (const cand of candidates) {
      const candBottom = cand.top + cand.height
      const candCenter = cand.top + cand.height / 2

      const targets = [
        { val: cand.top, label: 'Cạnh trên' },
        { val: candCenter, label: 'Căn giữa (Y)' },
        { val: candBottom, label: 'Cạnh dưới' },
      ]

      for (const t of targets) {
        const diff = Math.abs(activeBottom - t.val)
        if (diff <= threshold && diff < minDiff) {
          minDiff = diff
          bestSnap = {
            targetY: Math.round(t.val),
            start: Math.min(left, cand.left) - 16,
            end: Math.max(left + width, cand.left + cand.width) + 16,
            label: t.label,
          }
        }
      }
    }

    if (bestSnap) {
      const newHeight = Math.max(10, bestSnap.targetY - top)
      height = newHeight
      guides.push({
        id: `resize-s-${bestSnap.targetY}`,
        type: 'horizontal',
        pos: bestSnap.targetY,
        start: bestSnap.start,
        end: bestSnap.end,
        label: `${bestSnap.label}: ${Math.round(height)}px`,
        badgePos: { x: left + width / 2, y: bestSnap.targetY + 4 },
      })
    }
  }

  // 4. Co giãn cạnh trên (n, ne, nw)
  if (handle.includes('n')) {
    let minDiff = threshold + 1
    let bestSnap: { targetY: number; start: number; end: number; label: string } | null = null

    for (const cand of candidates) {
      const candBottom = cand.top + cand.height
      const candCenter = cand.top + cand.height / 2

      const targets = [
        { val: cand.top, label: 'Cạnh trên' },
        { val: candCenter, label: 'Căn giữa (Y)' },
        { val: candBottom, label: 'Cạnh dưới' },
      ]

      for (const t of targets) {
        const diff = Math.abs(top - t.val)
        if (diff <= threshold && diff < minDiff) {
          minDiff = diff
          bestSnap = {
            targetY: Math.round(t.val),
            start: Math.min(left, cand.left) - 16,
            end: Math.max(left + width, cand.left + cand.width) + 16,
            label: t.label,
          }
        }
      }
    }

    if (bestSnap) {
      const oldBottom = top + height
      const newTop = bestSnap.targetY
      const newHeight = Math.max(10, oldBottom - newTop)
      top = oldBottom - newHeight
      height = newHeight
      guides.push({
        id: `resize-n-${bestSnap.targetY}`,
        type: 'horizontal',
        pos: bestSnap.targetY,
        start: bestSnap.start,
        end: bestSnap.end,
        label: `${bestSnap.label}: ${Math.round(height)}px`,
        badgePos: { x: left + width / 2, y: bestSnap.targetY + 4 },
      })
    }
  }

  return {
    left,
    top,
    width,
    height,
    guides,
  }
}

