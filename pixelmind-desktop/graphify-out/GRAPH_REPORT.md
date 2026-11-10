# Graph Report - pixelmind-desktop  (2026-11-10)

## Corpus Check
- 98 files · ~174,122 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 24 file(s) not represented in the graph (top: .css 22, .example 1, (none) 1)

## Summary
- 1137 nodes · 2667 edges · 50 communities (44 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `681fb106`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- aiTools.ts
- main/toolbox.ts
- AIPanel.tsx
- CanvasArea.tsx
- ToolboxPanel.tsx
- cliBridge.ts
- projects.ts
- shared/ai.ts
- main/ai.ts
- RunnerManager
- store.ts
- main/index.ts
- App.tsx
- lucide-react
- WorkspaceSidebar.tsx
- pages.ts
- MultiPageCanvas.tsx
- package.json
- detectProject
- compilerOptions
- AISidecar.tsx
- bridge.ts
- EditorBufferManager
- SettingsDialog.tsx
- types.ts
- compilerOptions
- GitGraphView.tsx
- mock.ts
- aiCost.ts
- build
- agentIntegrations.ts
- AiApi
- MutationDiffDialog.tsx
- TopBar.tsx
- WorkspaceView.tsx
- format.ts
- aiMock.ts
- resolveConfig
- dependencies
- supabase.ts
- scripts
- editorBuffer.ts
- ParsedError
- listModels
- AIThemeDialog.tsx
- elementClipboard.ts
- tsconfig.json
- electron.vite.config.ts

## God Nodes (most connected - your core abstractions)
1. `lucide-react` - 38 edges
2. `react` - 36 edges
3. `RunState` - 30 edges
4. `ProjectRecord` - 29 edges
5. `PixelMindApi` - 28 edges
6. `Modal()` - 28 edges
7. `ProjectPage` - 27 edges
8. `App()` - 24 edges
9. `EditorBufferManager` - 23 edges
10. `RunnerManager` - 20 edges

## Surprising Connections (you probably didn't know these)
- `DuplicatePageDialogProps` --references--> `ProjectPage`  [EXTRACTED]
  src/components/DuplicatePageDialog.tsx → shared/types.ts
- `VersionsTabProps` --references--> `ProjectRecord`  [EXTRACTED]
  src/components/VersionsTab.tsx → shared/types.ts
- `Entry` --references--> `RunState`  [EXTRACTED]
  electron/main/runner.ts → shared/types.ts
- `ProjectViewProps` --references--> `ProjectRecord`  [EXTRACTED]
  src/components/ProjectView.tsx → shared/types.ts
- `TitleBarProps` --references--> `ProjectRecord`  [EXTRACTED]
  src/components/TitleBar.tsx → shared/types.ts

## Import Cycles
- None detected.

## Communities (50 total, 6 thin omitted)

### Community 0 - "aiTools.ts"
Cohesion: 0.05
Nodes (75): acceptChange(), appendEvent(), buildDiff(), changePath(), changesDir(), ensureDirs(), journalPath(), lcsOps() (+67 more)

### Community 2 - "main/toolbox.ts"
Cohesion: 0.08
Nodes (57): appendToBody(), ASSET_EXT, backupFile(), blockAround(), buildPreview(), Candidate, CODE_EXT, collectCandidates() (+49 more)

### Community 3 - "AIPanel.tsx"
Cohesion: 0.12
Nodes (23): AiAuditEntry, AiBridgeStatus, AiContextResult, AiPlanStep, AiToolLogEntry, DetectedCli, AiChatMessage, AiMessageContent() (+15 more)

### Community 4 - "CanvasArea.tsx"
Cohesion: 0.12
Nodes (19): CanvasAreaProps, CanvasMode, CanvasToast, HandleDirection, HoverElementInfo, ResizingState, ToolConfig, ToolKey (+11 more)

### Community 5 - "ToolboxPanel.tsx"
Cohesion: 0.06
Nodes (44): InsertPlacement, ProjectComponent, ProjectScanResult, ToolboxElement, ToolboxGroupId, COMMON_CONTROL_IDS, ElementCatalogPanel(), elementToDragItem() (+36 more)

### Community 6 - "cliBridge.ts"
Cohesion: 0.09
Nodes (40): AGENT_DEFS, AgentBuildOptions, AgentDef, AgentStreamFormat, findAgentDefByBinary(), getAgentDef(), killSwitch(), activeCliProcesses (+32 more)

### Community 7 - "projects.ts"
Cohesion: 0.09
Nodes (34): addDevScriptToPkg(), buildMeta(), createIndexHtmlFile(), detectPages(), DotnetProjectInfo, execFileAsync, extOf(), FlutterProjectInfo (+26 more)

### Community 8 - "shared/ai.ts"
Cohesion: 0.06
Nodes (12): AiChangeStatus, AiChatMessage, AiCliTarget, AiConfig, AiContextSource, AiContextWire, AiDiffLine, AiMessageRole (+4 more)

### Community 9 - "main/ai.ts"
Cohesion: 0.08
Nodes (32): agentSessions, agentSessionsFile(), cancelChat(), chatHistoryPath(), clearChatHistory(), controllers, DEFAULTS, EnvMap (+24 more)

### Community 10 - "RunnerManager"
Cohesion: 0.13
Nodes (9): createWindow(), Entry, killPort(), killProjectBinaries(), LogHandler, MIME, RunnerManager, StateHandler (+1 more)

### Community 11 - "store.ts"
Cohesion: 0.18
Nodes (20): appendActivity(), EMPTY_SETTINGS, normalize(), normalizeProject(), patchProject(), patchStore(), persist(), readStore() (+12 more)

### Community 12 - "main/index.ts"
Cohesion: 0.09
Nodes (35): addNavigation(), ASSET_EXTENSION_SET, ASSET_EXTENSIONS, AttrMatch, buildMenu(), collectSourceTags(), escapeRegExp(), findBracedAttr() (+27 more)

### Community 13 - "App.tsx"
Cohesion: 0.08
Nodes (45): lucide-react, react, ProjectIssue, App(), DialogId, EMPTY_STORE, errorMessage(), View (+37 more)

### Community 14 - "lucide-react"
Cohesion: 0.18
Nodes (12): ProjectPage, AddPageDialog(), AddPageDialogProps, computeSuggestions(), FRAMES, RouteSuggestion, SOFTWARES, DeletePageDialogProps (+4 more)

### Community 15 - "WorkspaceSidebar.tsx"
Cohesion: 0.13
Nodes (26): FileNode, FileActionDialog(), FileActionDialogProps, FileActionKind, getParentDir(), normalizeSlash(), collectFiles(), FileTree() (+18 more)

### Community 16 - "pages.ts"
Cohesion: 0.17
Nodes (23): assertInsideProject(), buildTemplate(), cleanupEmptyParents(), collectFiles(), copyPageFile(), dirExists(), escapeHtml(), fileExists() (+15 more)

### Community 17 - "MultiPageCanvas.tsx"
Cohesion: 0.17
Nodes (21): canonicalPageKey(), CodeRevert, computeClusterLayout(), computeRingsLayout(), computeWireShape(), ConnectDrag, dedupePages(), DetectedAnchor (+13 more)

### Community 18 - "package.json"
Cohesion: 0.12
Nodes (20): author, description, devDependencies, electron@^45.1.0, electron-builder@^26.18.0, @types/node@^24.13.3, @types/react@^19.2.18, @types/react-dom@^19.2.4 (+12 more)

### Community 19 - "detectProject"
Cohesion: 0.17
Nodes (16): addProject(), findProjectCssDir(), mergeDetected(), samePath(), detectDotnetProject(), detectFlutterProject(), detectFramework(), detectOtherProject() (+8 more)

### Community 20 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowSyntheticDefaultImports, esModuleInterop, isolatedModules, jsx, lib, module, moduleResolution (+11 more)

### Community 21 - "AISidecar.tsx"
Cohesion: 0.24
Nodes (10): AiSelection, AISidecar(), AISidecarProps, extractSuggestionFromText(), generateLocalHeuristicSuggestion(), QUICK_PROMPTS, SidecarDiffItem, SidecarSuggestion (+2 more)

### Community 22 - "bridge.ts"
Cohesion: 0.16
Nodes (15): AtomLogo(), AtomLogoProps, ProjectView(), ProjectViewProps, MenuDef, RestoreIcon(), TitleBar(), TitleBarProps (+7 more)

### Community 24 - "SettingsDialog.tsx"
Cohesion: 0.20
Nodes (9): AiTestResult, AppInfo, ACCENTS, CODE_FONTS, SettingsDialog(), SettingsDialogProps, SHORTCUT_GROUPS, TabId (+1 more)

### Community 25 - "types.ts"
Cohesion: 0.09
Nodes (31): PixelMindApi, DEFAULT_DESIGN_TOKENS, generateTailwindTokensConfig(), generateVariablesCss(), tokenToCssVarName(), ColorToken, DesignTokens, GitGraphData (+23 more)

### Community 26 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, noEmit, noUnusedLocals (+7 more)

### Community 27 - "GitGraphView.tsx"
Cohesion: 0.20
Nodes (15): GitCommit, colorOf(), GitGraphView(), GitGraphViewProps, initialsOf(), laneX(), refClass(), formatRelativeTime() (+7 more)

### Community 28 - "mock.ts"
Cohesion: 0.09
Nodes (21): api, PreloadApi, AiBridgeKind, AiChange, AiChatEvent, AiChatRequest, AiChatStartRequest, AiCliEvent (+13 more)

### Community 29 - "aiCost.ts"
Cohesion: 0.35
Nodes (11): budgetFilePath(), computeStats(), getCostStats(), readStoredBudget(), recordTokenUsage(), resetCostStats(), safeId(), setTokenBudget() (+3 more)

### Community 30 - "build"
Cohesion: 0.17
Nodes (12): build, appId, directories, files, nsis, productName, win, output (+4 more)

### Community 31 - "agentIntegrations.ts"
Cohesion: 0.29
Nodes (10): AgentIntegration, buildSkillPreamble(), BUILTIN_SKILLS, describeMcp(), ensureProjectSkills(), loadMcpServers(), McpServerConfig, prepareAgentIntegration() (+2 more)

### Community 33 - "MutationDiffDialog.tsx"
Cohesion: 0.35
Nodes (9): MutationPreview, MutationDiffDialog(), MutationDiffDialogProps, ViewMode, buildMergedText(), computeLcsDiff(), DiffHunk, DiffLine (+1 more)

### Community 34 - "TopBar.tsx"
Cohesion: 0.46
Nodes (6): PanelBottomIcon(), PanelIconProps, PanelLeftIcon(), PanelRightIcon(), PencilFillIcon(), TopBar()

### Community 35 - "WorkspaceView.tsx"
Cohesion: 0.16
Nodes (28): ProjectDiagnosis, ProjectRecord, ProjectStat, RunLog, RunState, Settings, DiagnosisDialogProps, LogPanel() (+20 more)

### Community 37 - "format.ts"
Cohesion: 0.21
Nodes (7): FileContent, FileViewer(), FileViewerProps, getMonacoLanguage(), fileName(), formatBytes(), languageOf()

### Community 38 - "aiMock.ts"
Cohesion: 0.15
Nodes (12): AiBridgeKind, AiBridgeProfile, AiBuildError, AiChange, AiChangeStatus, AiChatMessage, AiContextItem, AiDiffLine (+4 more)

### Community 39 - "resolveConfig"
Cohesion: 0.33
Nodes (9): getStatus(), maskKey(), parseEnvFile(), pickKey(), readEnvFile(), readEnvOverrides(), resolveConfig(), resolveKey() (+1 more)

### Community 40 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, lucide-react@^1.63.0, @monaco-editor/react@^4.7.0, react@^19.2.0, react-dom@^19.2.0, react-resizable-panels@^4.15.0, @monaco-editor/react, react-dom (+1 more)

### Community 41 - "supabase.ts"
Cohesion: 0.29
Nodes (6): @supabase/supabase-js@^2.119.0, @supabase/supabase-js, isSupabaseConfigured, supabase, supabaseAnonKey, supabaseUrl

### Community 42 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, dist, preview, preview:web, typecheck

### Community 43 - "editorBuffer.ts"
Cohesion: 0.22
Nodes (8): ActionType, BufferListener, DirtyFileInfo, DomMutationRecord, ElementSnapshot, FileEditRecord, HistoryAction, UndoRedoHandler

### Community 44 - "ParsedError"
Cohesion: 0.29
Nodes (6): AIPanelProps, PreviewPaneProps, VisualErrorCardProps, AiSelectedElement, AiTab, ParsedError

### Community 45 - "listModels"
Cohesion: 0.38
Nodes (7): authHeaders(), completeAi(), fetchJson(), friendlyHttpError(), listModels(), parseSseData(), streamCompletion()

### Community 46 - "AIThemeDialog.tsx"
Cohesion: 0.17
Nodes (15): AIThemeDialog(), ContentField, contrast(), DEFAULT_SECTION_FIELDS, hexToRgb(), luminance(), MOODS, SectionId (+7 more)

### Community 50 - "electron.vite.config.ts"
Cohesion: 0.40
Nodes (4): electron-vite@^6.0.0, @vitejs/plugin-react@^6.1.2, electron-vite, @vitejs/plugin-react

## Knowledge Gaps
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `EditorBufferManager` connect `EditorBufferManager` to `editorBuffer.ts`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Should `aiTools.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05464725643896976 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `App.tsx` to `MutationDiffDialog.tsx`, `TopBar.tsx`, `AIPanel.tsx`, `CanvasArea.tsx`, `format.ts`, `WorkspaceView.tsx`, `ToolboxPanel.tsx`, `dependencies`, `ParsedError`, `lucide-react`, `AIThemeDialog.tsx`, `WorkspaceSidebar.tsx`, `MultiPageCanvas.tsx`, `package.json`, `AISidecar.tsx`, `bridge.ts`, `SettingsDialog.tsx`, `types.ts`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Should `api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.03125 - nodes in this community are weakly interconnected._
- **Why does `react` connect `App.tsx` to `AIPanel.tsx`, `CanvasArea.tsx`, `ToolboxPanel.tsx`, `lucide-react`, `WorkspaceSidebar.tsx`, `MultiPageCanvas.tsx`, `package.json`, `AISidecar.tsx`, `bridge.ts`, `SettingsDialog.tsx`, `types.ts`, `GitGraphView.tsx`, `MutationDiffDialog.tsx`, `TopBar.tsx`, `WorkspaceView.tsx`, `main.tsx`, `format.ts`, `dependencies`, `ParsedError`, `AIThemeDialog.tsx`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Should `main/toolbox.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0771478667445938 - nodes in this community are weakly interconnected._
- **Should `AIPanel.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11956521739130435 - nodes in this community are weakly interconnected._