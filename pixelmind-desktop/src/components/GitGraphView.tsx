import { useMemo } from 'react'
import type { GitCommit } from '@shared/types'
import { formatRelativeTime } from '../lib/format'
import { layoutGitGraph } from '../lib/gitGraph'

const ROW_HEIGHT = 42
const LANE_WIDTH = 16
const GRAPH_PADDING = 8

const laneX = (lane: number): number => GRAPH_PADDING + lane * LANE_WIDTH

const initialsOf = (name: string): string => {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
}

const colorOf = (name: string): string => {
  let hash = 0
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 360
  }
  return `hsl(${hash} 48% 42%)`
}

const refClass = (ref: GitCommit['refs'][number]): string => {
  if (ref.type === 'tag') return 'tag'
  if (ref.type === 'remote') return 'remote'
  if (ref.type === 'head') return 'head'
  return ref.current ? 'branch current' : 'branch'
}

interface GitGraphViewProps {
  commits: GitCommit[]
  selectedHash: string | null
  onSelect: (commit: GitCommit) => void
}

const GitGraphView = ({ commits, selectedHash, onSelect }: GitGraphViewProps) => {
  const layout = useMemo(() => layoutGitGraph(commits), [commits])
  const graphWidth = Math.max(24, layout.maxLanes * LANE_WIDTH + GRAPH_PADDING * 2)
  const totalHeight = layout.rows.length * ROW_HEIGHT

  return (
    <div className="pm-gitgraph">
      <svg
        className="pm-gitgraph__svg"
        width={graphWidth}
        height={totalHeight}
        viewBox={`0 0 ${graphWidth} ${totalHeight}`}
        aria-hidden="true"
      >
        {layout.edges.map((edge, index) => {
          const x1 = laneX(edge.fromLane)
          const y1 = edge.row * ROW_HEIGHT + edge.fromY * ROW_HEIGHT
          const x2 = laneX(edge.toLane)
          const y2 = edge.row * ROW_HEIGHT + edge.toY * ROW_HEIGHT
          if (Math.abs(x1 - x2) < 0.5) {
            return (
              <line
                key={`edge-${index}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={edge.color}
                strokeWidth={2}
                strokeLinecap="round"
              />
            )
          }
          const middleY = (y1 + y2) / 2
          return (
            <path
              key={`edge-${index}`}
              d={`M ${x1} ${y1} C ${x1} ${middleY}, ${x2} ${middleY}, ${x2} ${y2}`}
              fill="none"
              stroke={edge.color}
              strokeWidth={2}
              strokeLinecap="round"
            />
          )
        })}

        {layout.rows.map(({ commit, row, lane, color }) => {
          const cx = laneX(lane)
          const cy = row * ROW_HEIGHT + ROW_HEIGHT / 2
          return (
            <g key={`node-${commit.hash}`}>
              {commit.isHead && (
                <circle cx={cx} cy={cy} r={8} fill="none" stroke={color} strokeWidth={1.2} opacity={0.65} />
              )}
              {commit.isMerge ? (
                <>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={5.4}
                    fill="var(--panel, #1e1e2e)"
                    stroke={color}
                    strokeWidth={2}
                  />
                  <circle cx={cx} cy={cy} r={2} fill={color} />
                </>
              ) : (
                <circle cx={cx} cy={cy} r={4.5} fill={color} stroke="var(--panel, #1e1e2e)" strokeWidth={1.4} />
              )}
            </g>
          )
        })}
      </svg>

      <div className="pm-gitgraph__rows">
        {layout.rows.map(({ commit }) => {
          const visibleRefs = commit.refs.filter((ref) => ref.type !== 'head')
          const hasHead = commit.refs.some((ref) => ref.type === 'head')
          return (
            <button
              type="button"
              key={commit.hash}
              className={`pm-gitgraph-row ${selectedHash === commit.hash ? 'active' : ''}`}
              style={{ paddingLeft: graphWidth + 6 }}
              onClick={() => onSelect(commit)}
              title={`${commit.shortHash} · ${commit.subject}`}
            >
              <span className="pm-gitgraph-row__top">
                <span className="pm-gitgraph-subject">{commit.subject}</span>
                {hasHead && <span className="pm-gitgraph-ref head">HEAD</span>}
                {visibleRefs.map((ref) => (
                  <span
                    key={`${ref.type}-${ref.name}`}
                    className={`pm-gitgraph-ref ${refClass(ref)}`}
                    title={ref.type === 'remote' ? 'Nhánh remote' : ref.type === 'tag' ? 'Tag' : 'Nhánh'}
                  >
                    {ref.name}
                  </span>
                ))}
              </span>
              <span className="pm-gitgraph-row__meta">
                <span className="pm-gitgraph-avatar" style={{ background: colorOf(commit.author) }}>
                  {initialsOf(commit.author)}
                </span>
                <span className="pm-gitgraph-author">{commit.author}</span>
                <span
                  className="pm-gitgraph-time"
                  title={new Date(commit.timestamp * 1000).toLocaleString('vi-VN')}
                >
                  {formatRelativeTime(commit.timestamp * 1000)}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default GitGraphView
