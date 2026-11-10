import type { GitCommit } from '@shared/types'

/** Bảng màu cho các làn nhánh trong đồ thị commit. */
export const GRAPH_LANE_COLORS = [
  '#4f8cff',
  '#e5a13a',
  '#b06cff',
  '#2bb673',
  '#ff6b9a',
  '#39c5cf',
  '#f97316',
  '#9ca3af',
]

export interface GraphRow {
  commit: GitCommit
  row: number
  lane: number
  color: string
}

/**
 * Một đoạn nối trong cùng một hàng.
 * `fromY` / `toY` là tỉ lệ theo chiều cao hàng (0 = đỉnh, 1 = đáy).
 */
export interface GraphEdge {
  row: number
  fromLane: number
  fromY: number
  toLane: number
  toY: number
  color: string
}

export interface GraphLayout {
  rows: GraphRow[]
  edges: GraphEdge[]
  maxLanes: number
}

interface Lane {
  hash: string
  color: string
}

const laneColorAt = (index: number): string => GRAPH_LANE_COLORS[index % GRAPH_LANE_COLORS.length]

/**
 * Tính vị trí làn và các đường nối cho danh sách commit mới → cũ.
 *
 * Quy ước:
 * - Mỗi làn đang "chờ" một hash commit sẽ xuất hiện ở hàng tiếp theo.
 * - Parent đầu tiên nối tiếp làn hiện tại.
 * - Parent merge được cấp làn mới (hoặc nối vào làn đã có).
 * - Khi hai làn cùng chờ một commit, chúng hội tụ về node của commit đó.
 */
export function layoutGitGraph(commits: GitCommit[]): GraphLayout {
  const lanes: Array<Lane | null> = []
  const rows: GraphRow[] = []
  const edges: GraphEdge[] = []
  let maxLanes = 1

  const findLane = (hash: string): number => lanes.findIndex((lane) => lane?.hash === hash)

  const allocateLane = (hash: string): number => {
    let index = lanes.findIndex((lane) => lane === null)
    if (index === -1) {
      index = lanes.length
      lanes.push(null)
    }
    lanes[index] = { hash, color: laneColorAt(index) }
    return index
  }

  commits.forEach((commit, row) => {
    const matching = lanes
      .map((lane, index) => (lane?.hash === commit.hash ? index : -1))
      .filter((index) => index >= 0)

    const nodeLane = matching.length > 0 ? matching[0] : allocateLane(commit.hash)
    const nodeColor = lanes[nodeLane]?.color ?? laneColorAt(nodeLane)

    // Chụp lại các làn đang hoạt động trước khi xử lý parent.
    const activeAtStart = lanes
      .map((lane, index) => (lane ? { index, color: lane.color } : null))
      .filter((lane): lane is { index: number; color: string } => lane !== null)

    // Các làn trùng hash hội tụ về node.
    for (const duplicate of matching) {
      if (duplicate === nodeLane) continue
      edges.push({
        row,
        fromLane: duplicate,
        fromY: 0.5,
        toLane: nodeLane,
        toY: 0.5,
        color: lanes[duplicate]?.color ?? nodeColor,
      })
      lanes[duplicate] = null
    }

    const usedLanes = new Set<number>()

    commit.parents.forEach((parent, parentIndex) => {
      let target = findLane(parent)
      if (target === -1) {
        if (parentIndex === 0) {
          target = nodeLane
          lanes[nodeLane] = { hash: parent, color: nodeColor }
        } else {
          target = allocateLane(parent)
        }
      }

      usedLanes.add(target)
      if (target !== nodeLane) {
        edges.push({
          row,
          fromLane: nodeLane,
          fromY: 0.5,
          toLane: target,
          toY: 1,
          color: parentIndex === 0 ? nodeColor : lanes[target]?.color ?? nodeColor,
        })
      }
    })

    // Commit không có parent (root) hoặc parent đầu tiên đã nằm ở làn khác.
    if (!usedLanes.has(nodeLane)) {
      lanes[nodeLane] = null
    }

    // Vẽ các làn đang hoạt động. Làn hội tụ vào node chỉ đi tới giữa hàng.
    const isNewNodeLane = matching.length === 0
    for (const active of activeAtStart) {
      if (active.index === nodeLane && isNewNodeLane) {
        // Làn mới bắt đầu từ node, không vẽ đoạn phía trên node.
        if (usedLanes.has(nodeLane)) {
          edges.push({
            row,
            fromLane: nodeLane,
            fromY: 0.5,
            toLane: nodeLane,
            toY: 1,
            color: active.color,
          })
        }
        continue
      }

      const convergesHere =
        (matching.includes(active.index) && active.index !== nodeLane) ||
        (active.index === nodeLane && !usedLanes.has(nodeLane))
      edges.push({
        row,
        fromLane: active.index,
        fromY: 0,
        toLane: active.index,
        toY: convergesHere ? 0.5 : 1,
        color: active.color,
      })
    }

    rows.push({ commit, row, lane: nodeLane, color: nodeColor })
    maxLanes = Math.max(maxLanes, nodeLane + 1, lanes.length)

    while (lanes.length > 0 && lanes[lanes.length - 1] === null) {
      lanes.pop()
    }
  })

  return { rows, edges, maxLanes }
}
