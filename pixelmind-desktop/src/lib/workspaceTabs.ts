export interface WorkspaceTabsState {
  paths: string[]
  selectedPath: string | null
  activeTab: 'file' | 'preview'
}

export interface RestoredWorkspaceTabs<T> extends WorkspaceTabsState {
  file: T | null
  inaccessibleCount: number
}

export function serializeWorkspaceTabs(
  paths: string[],
  selectedPath: string | null,
  activeTab: WorkspaceTabsState['activeTab'],
): string {
  const state: WorkspaceTabsState = {
    paths,
    selectedPath: selectedPath && paths.includes(selectedPath) ? selectedPath : null,
    activeTab,
  }
  return JSON.stringify(state)
}

export function parseWorkspaceTabs(raw: string | null): WorkspaceTabsState {
  const empty: WorkspaceTabsState = { paths: [], selectedPath: null, activeTab: 'preview' }
  if (!raw) return empty

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return empty

    const value = parsed as Record<string, unknown>
    const paths = Array.isArray(value.paths)
      ? [
          ...new Set(
            value.paths.filter(
              (path): path is string => typeof path === 'string' && path.length > 0,
            ),
          ),
        ]
      : []

    return {
      paths,
      selectedPath:
        typeof value.selectedPath === 'string' && paths.includes(value.selectedPath)
          ? value.selectedPath
          : null,
      activeTab: value.activeTab === 'file' ? 'file' : 'preview',
    }
  } catch {
    return empty
  }
}

export async function restoreWorkspaceTabs<T>(
  saved: WorkspaceTabsState,
  fs: {
    exists(path: string): Promise<boolean>
    read(path: string): Promise<T>
  },
): Promise<RestoredWorkspaceTabs<T>> {
  const availablePaths = (
    await Promise.all(
      saved.paths.map(async (path) => {
        try {
          return (await fs.exists(path)) ? path : null
        } catch {
          return null
        }
      }),
    )
  ).filter((path): path is string => path !== null)

  let selected = saved.selectedPath && availablePaths.includes(saved.selectedPath)
    ? saved.selectedPath
    : availablePaths[availablePaths.length - 1] ?? null
  let file: T | null = null
  let inaccessibleCount = saved.paths.length - availablePaths.length

  while (selected) {
    try {
      file = await fs.read(selected)
      break
    } catch {
      availablePaths.splice(availablePaths.indexOf(selected), 1)
      inaccessibleCount += 1
      selected = availablePaths[availablePaths.length - 1] ?? null
    }
  }

  return {
    paths: availablePaths,
    selectedPath: selected,
    file,
    activeTab: saved.activeTab === 'file' && selected ? 'file' : 'preview',
    inaccessibleCount,
  }
}
