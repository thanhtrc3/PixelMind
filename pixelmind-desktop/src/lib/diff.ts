export interface DiffLine {
  type: 'eq' | 'del' | 'add'
  text: string
  oldLn?: number
  newLn?: number
}

export interface DiffHunk {
  id: string
  hunkIndex: number
  minIdx: number
  maxIdx: number
  oldStart: number
  oldEnd: number
  newStart: number
  newEnd: number
  addedCount: number
  deletedCount: number
  lines: DiffLine[]
  accepted: boolean
}

/**
 * Tính toán mảng DiffLine theo thuật toán LCS (Longest Common Subsequence).
 */
export function computeLcsDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const m = oldLines.length
  const n = newLines.length

  // Bảng quy hoạch động LCS
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Int32Array(n + 1) as any)
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (oldLines[i] === newLines[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1])
      }
    }
  }

  let i = m
  let j = n
  const diff: DiffLine[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      diff.unshift({ type: 'eq', text: oldLines[i - 1], oldLn: i, newLn: j })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ type: 'add', text: newLines[j - 1], newLn: j })
      j--
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      diff.unshift({ type: 'del', text: oldLines[i - 1], oldLn: i })
      i--
    }
  }

  return diff
}

/**
 * Gom nhóm các dòng thay đổi gần nhau thành các Hunk độc lập kèm theo dòng ngữ cảnh (context).
 */
export function groupDiffIntoHunks(diff: DiffLine[], contextLines = 2): DiffHunk[] {
  const changedIndices: number[] = []
  diff.forEach((d, idx) => {
    if (d.type !== 'eq') changedIndices.push(idx)
  })

  // Nếu không có dòng nào khác biệt
  if (changedIndices.length === 0) {
    return []
  }

  // Nhóm các chỉ số thay đổi cách nhau không quá 2 * contextLines + 1 dòng
  const clusters: number[][] = []
  let currentCluster = [changedIndices[0]]
  for (let k = 1; k < changedIndices.length; k++) {
    const prev = changedIndices[k - 1]
    const curr = changedIndices[k]
    if (curr - prev <= contextLines * 2 + 1) {
      currentCluster.push(curr)
    } else {
      clusters.push(currentCluster)
      currentCluster = [curr]
    }
  }
  clusters.push(currentCluster)

  // Mở rộng mỗi cụm thêm các dòng ngữ cảnh xung quanh
  return clusters.map((cluster, hunkIdx) => {
    const minIdx = Math.max(0, cluster[0] - contextLines)
    const maxIdx = Math.min(diff.length - 1, cluster[cluster.length - 1] + contextLines)
    const lines = diff.slice(minIdx, maxIdx + 1)

    const oldNums = lines.filter((l) => l.oldLn !== undefined).map((l) => l.oldLn as number)
    const newNums = lines.filter((l) => l.newLn !== undefined).map((l) => l.newLn as number)

    const oldStart = oldNums.length > 0 ? Math.min(...oldNums) : 1
    const oldEnd = oldNums.length > 0 ? Math.max(...oldNums) : 1
    const newStart = newNums.length > 0 ? Math.min(...newNums) : 1
    const newEnd = newNums.length > 0 ? Math.max(...newNums) : 1

    const addedCount = lines.filter((l) => l.type === 'add').length
    const deletedCount = lines.filter((l) => l.type === 'del').length

    return {
      id: `hunk-${hunkIdx}`,
      hunkIndex: hunkIdx + 1,
      minIdx,
      maxIdx,
      oldStart,
      oldEnd,
      newStart,
      newEnd,
      addedCount,
      deletedCount,
      lines,
      accepted: true,
    }
  })
}

/**
 * Ghép lại toàn bộ văn bản sau khi chọn lọc chấp nhận (accept) hay từ chối (reject) từng hunk.
 */
export function buildMergedText(diff: DiffLine[], hunks: DiffHunk[]): string {
  const lineHunkMap = new Map<number, DiffHunk>()
  hunks.forEach((h) => {
    for (let idx = h.minIdx; idx <= h.maxIdx; idx++) {
      if (diff[idx]?.type !== 'eq') {
        lineHunkMap.set(idx, h)
      }
    }
  })

  const finalLines: string[] = []
  for (let idx = 0; idx < diff.length; idx++) {
    const item = diff[idx]
    if (item.type === 'eq') {
      finalLines.push(item.text)
    } else {
      const hunk = lineHunkMap.get(idx)
      const isAccepted = hunk ? hunk.accepted : true
      if (isAccepted) {
        if (item.type === 'add') finalLines.push(item.text)
      } else {
        if (item.type === 'del') finalLines.push(item.text)
      }
    }
  }

  return finalLines.join('\n')
}

