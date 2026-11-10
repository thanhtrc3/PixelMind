# Graph Report - pixelmind-desktop  (2026-11-10)

## Corpus Check
- 98 files · ~177,290 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 24 file(s) not represented in the graph (top: .css 22, .example 1, (none) 1)

## Summary
- 1141 nodes · 2676 edges · 60 communities (53 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d20615f5`
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
- lucide-react
- types.ts
- FileActionDialog.tsx
- pages.ts
- MultiPageCanvas.tsx
- package.json
- App.tsx
- compilerOptions
- AISidecar.tsx
- TopBar.tsx
- EditorBufferManager
- SettingsDialog.tsx
- WorkspaceSidebar.tsx
- compilerOptions
- GitGraphView.tsx
- mock.ts
- aiCost.ts
- build
- agentIntegrations.ts
- AiApi
- MutationDiffDialog.tsx
- VersionsTab.tsx
- RunState
- FileViewer.tsx
- aiMock.ts
- agentDefs.ts
- dependencies
- supabase.ts
- scripts
- editorBuffer.ts
- ParsedError
- recordAudit
- AIThemeDialog.tsx
- IdeWebSocketBridge
- tsconfig.json
- toolboxBridge.ts
- electron.vite.config.ts
- startChat
- addNavigation
- theme.ts
- WorkspaceView.tsx
- bridge.ts
- AIDesignImportDialog.tsx
- aiAudit.ts
- ProjectPage
- walk

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
- `Entry` --references--> `RunState`  [EXTRACTED]
  electron/main/runner.ts → shared/types.ts
- `CanvasWin` --references--> `ProjectPage`  [EXTRACTED]
  src/components/MultiPageCanvas.tsx → shared/types.ts
- `MultiPageCanvasProps` --references--> `ProjectPage`  [EXTRACTED]
  src/components/MultiPageCanvas.tsx → shared/types.ts
- `RouteTreeNode` --references--> `ProjectPage`  [EXTRACTED]
  src/components/WorkspaceSidebar.tsx → shared/types.ts
- `FileTreeProps` --references--> `FileNode`  [EXTRACTED]
  src/components/FileTree.tsx → shared/types.ts

## Import Cycles
- None detected.

## Communities (60 total, 7 thin omitted)

### Community 0 - "aiTools.ts"
Cohesion: 0.07
Nodes (68): acceptChange(), appendEvent(), buildDiff(), changePath(), changesDir(), ensureDirs(), journalPath(), lcsOps() (+60 more)

### Community 2 - "main/toolbox.ts"
Cohesion: 0.08
Nodes (57): appendToBody(), ASSET_EXT, backupFile(), blockAround(), buildPreview(), Candidate, CODE_EXT, collectCandidates() (+49 more)

### Community 3 - "AIPanel.tsx"
Cohesion: 0.12
Nodes (23): AiBridgeKind, AiBridgeStatus, AiContextResult, AiPlanStep, AiToolLogEntry, DetectedCli, AiChatMessage, AiMessageContent() (+15 more)

### Community 4 - "CanvasArea.tsx"
Cohesion: 0.12
Nodes (16): AlignType, CanvasAreaProps, CanvasMode, CanvasToast, DistributeType, HandleDirection, HoverElementInfo, ResizingState (+8 more)

### Community 5 - "ToolboxPanel.tsx"
Cohesion: 0.06
Nodes (43): InsertPlacement, ProjectComponent, ToolboxElement, ToolboxGroupId, COMMON_CONTROL_IDS, ElementCatalogPanel(), elementToDragItem(), getControlIcon() (+35 more)

### Community 6 - "cliBridge.ts"
Cohesion: 0.12
Nodes (31): findAgentDefByBinary(), activeCliProcesses, AgentRunHandle, createStreamParser(), detectInstalledClis(), execFileAsync, extractVersion(), firstLine() (+23 more)

### Community 7 - "projects.ts"
Cohesion: 0.06
Nodes (52): addProject(), findProjectCssDir(), mergeDetected(), samePath(), addDevScriptToPkg(), buildMeta(), createIndexHtmlFile(), detectDotnetProject() (+44 more)

### Community 8 - "shared/ai.ts"
Cohesion: 0.06
Nodes (15): AiChangeStatus, AiChatMessage, AiChatRequest, AiChatStartRequest, AiCliRunRequest, AiCliTarget, AiConfig, AiContextSource (+7 more)

### Community 9 - "main/ai.ts"
Cohesion: 0.08
Nodes (41): agentSessions, authHeaders(), cancelChat(), chatHistoryPath(), clearChatHistory(), completeAi(), controllers, DEFAULTS (+33 more)

### Community 10 - "RunnerManager"
Cohesion: 0.12
Nodes (9): createWindow(), Entry, killPort(), killProjectBinaries(), LogHandler, MIME, RunnerManager, StateHandler (+1 more)

### Community 11 - "store.ts"
Cohesion: 0.18
Nodes (20): appendActivity(), EMPTY_SETTINGS, normalize(), normalizeProject(), patchProject(), patchStore(), persist(), readStore() (+12 more)

### Community 12 - "main/index.ts"
Cohesion: 0.11
Nodes (18): ASSET_EXTENSION_SET, ASSET_EXTENSIONS, AttrMatch, buildMenu(), collectSourceTags(), escapeRegExp(), GENERIC_CSS_CLASSES, getAllWebFrames() (+10 more)

### Community 13 - "lucide-react"
Cohesion: 0.16
Nodes (16): lucide-react, react, DeletePageDialog(), DiagnosisDialog(), levelBadge(), defaultRoute(), DuplicatePageDialog(), normalizeRoute() (+8 more)

### Community 14 - "types.ts"
Cohesion: 0.11
Nodes (24): api, PreloadApi, PixelMindApi, ProjectScanResult, ToolboxMutationPayload, ToolboxWritePayload, ToolboxWriteResult, AppInfo (+16 more)

### Community 15 - "FileActionDialog.tsx"
Cohesion: 0.35
Nodes (9): FileActionDialog(), FileActionKind, getParentDir(), normalizeSlash(), collectFiles(), FileTree(), FileTreeProps, iconFor() (+1 more)

### Community 16 - "pages.ts"
Cohesion: 0.18
Nodes (22): assertInsideProject(), buildTemplate(), cleanupEmptyParents(), collectFiles(), copyPageFile(), dirExists(), escapeHtml(), fileExists() (+14 more)

### Community 17 - "MultiPageCanvas.tsx"
Cohesion: 0.15
Nodes (23): canonicalPageKey(), CanvasWin, CodeRevert, computeClusterLayout(), computeRingsLayout(), computeWireShape(), ConnectDrag, dedupePages() (+15 more)

### Community 18 - "package.json"
Cohesion: 0.13
Nodes (19): author, description, devDependencies, electron-builder@^26.18.0, @types/node@^24.13.3, @types/react@^19.2.18, @types/react-dom@^19.2.4, typescript@~6.0.2 (+11 more)

### Community 19 - "App.tsx"
Cohesion: 0.19
Nodes (14): App(), DialogId, EMPTY_STORE, errorMessage(), View, CommandPalette(), CommandPaletteProps, PaletteCommand (+6 more)

### Community 20 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowSyntheticDefaultImports, esModuleInterop, isolatedModules, jsx, lib, module, moduleResolution (+11 more)

### Community 21 - "AISidecar.tsx"
Cohesion: 0.24
Nodes (10): AiSelection, AISidecar(), AISidecarProps, extractSuggestionFromText(), generateLocalHeuristicSuggestion(), QUICK_PROMPTS, SidecarDiffItem, SidecarSuggestion (+2 more)

### Community 22 - "TopBar.tsx"
Cohesion: 0.57
Nodes (5): PanelBottomIcon(), PanelIconProps, PanelLeftIcon(), PanelRightIcon(), TopBar()

### Community 24 - "SettingsDialog.tsx"
Cohesion: 0.29
Nodes (6): ACCENTS, CODE_FONTS, SettingsDialog(), SHORTCUT_GROUPS, TabId, TABS

### Community 25 - "WorkspaceSidebar.tsx"
Cohesion: 0.10
Nodes (29): DEFAULT_DESIGN_TOKENS, generateTailwindTokensConfig(), generateVariablesCss(), tokenToCssVarName(), ColorToken, DesignTokens, RadiusToken, SpacingToken (+21 more)

### Community 26 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, noEmit, noUnusedLocals (+7 more)

### Community 27 - "GitGraphView.tsx"
Cohesion: 0.20
Nodes (15): GitCommit, colorOf(), GitGraphView(), GitGraphViewProps, initialsOf(), laneX(), refClass(), formatRelativeTime() (+7 more)

### Community 28 - "mock.ts"
Cohesion: 0.12
Nodes (13): AiChange, AiChatEvent, AiContextRequest, AiProposeChangeRequest, AiToolCallRequest, estimateTokens(), createBrowserMock(), DEMO_ROOT (+5 more)

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

### Community 34 - "VersionsTab.tsx"
Cohesion: 0.18
Nodes (9): AtomLogo(), AtomLogoProps, ProjectView(), errorText(), VersionsTab(), editorBuffer, fileName(), formatTime() (+1 more)

### Community 35 - "RunState"
Cohesion: 0.25
Nodes (16): ProjectDiagnosis, ProjectRecord, ProjectStat, RunState, Settings, DiagnosisDialogProps, ProjectDetailProps, statusChip (+8 more)

### Community 37 - "FileViewer.tsx"
Cohesion: 0.39
Nodes (6): FileContent, FileViewer(), FileViewerProps, getMonacoLanguage(), formatBytes(), languageOf()

### Community 38 - "aiMock.ts"
Cohesion: 0.12
Nodes (17): AIPanelProps, AI_THEMES, AiBridgeKind, AiBridgeProfile, AiBuildError, AiChange, AiChangeStatus, AiChatMessage (+9 more)

### Community 39 - "agentDefs.ts"
Cohesion: 0.22
Nodes (5): AGENT_DEFS, AgentBuildOptions, AgentDef, AgentStreamFormat, AgentRunOptions

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
Cohesion: 0.36
Nodes (5): PreviewPaneProps, errorBadgeLabel(), VisualErrorCard(), VisualErrorCardProps, ParsedError

### Community 45 - "recordAudit"
Cohesion: 0.67
Nodes (4): killSwitch(), recordAudit(), killAllCliProcesses(), stopCliAgent()

### Community 46 - "AIThemeDialog.tsx"
Cohesion: 0.18
Nodes (14): AIThemeDialog(), AIThemeDialogProps, ContentField, contrast(), DEFAULT_SECTION_FIELDS, hexToRgb(), luminance(), MOODS (+6 more)

### Community 49 - "toolboxBridge.ts"
Cohesion: 0.22
Nodes (8): InsertListener, insertListeners, InsertPlacement, onToolboxInsert(), takePendingToolboxInsert(), toolboxDrag, ToolboxDragItem, ToolboxInsertRequest

### Community 50 - "electron.vite.config.ts"
Cohesion: 0.40
Nodes (4): electron-vite@^6.0.0, @vitejs/plugin-react@^6.1.2, electron-vite, @vitejs/plugin-react

### Community 51 - "startChat"
Cohesion: 0.24
Nodes (10): getAgentDef(), agentSessionsFile(), extractPlanFromText(), friendlyRuntimeError(), loadAgentSessions(), persistAgentSessions(), persistChat(), startChat() (+2 more)

### Community 52 - "addNavigation"
Cohesion: 0.24
Nodes (15): addNavigation(), findBracedAttr(), findStaticAttr(), handlerHasNavigation(), handlerPointsTo(), hasAspNavigation(), removeAspNavigation(), removeNavigation() (+7 more)

### Community 53 - "theme.ts"
Cohesion: 0.80
Nodes (4): applyThemeVariables(), clamp(), hexToRgb(), mix()

### Community 54 - "WorkspaceView.tsx"
Cohesion: 0.30
Nodes (11): RunLog, LogPanel(), LogPanelProps, RunSidebar(), SidebarTab, rememberAiPanelWidth(), savedAiPanelWidth(), WorkspaceView() (+3 more)

### Community 55 - "bridge.ts"
Cohesion: 0.20
Nodes (11): AddPageDialog(), computeSuggestions(), FRAMES, RouteSuggestion, SOFTWARES, MenuDef, RestoreIcon(), TitleBar() (+3 more)

### Community 56 - "AIDesignImportDialog.tsx"
Cohesion: 0.20
Nodes (9): AIDesignImportDialog(), AIDesignImportDialogProps, DEFAULT_SNIPPETS, FrameworkId, FRAMEWORKS, Phase, ToastKind, AI_DESIGN_SECTIONS (+1 more)

### Community 57 - "aiAudit.ts"
Cohesion: 0.36
Nodes (7): auditFilePath(), clearAuditLogs(), listAuditLogs(), safeId(), electron@^45.1.0, electron, AiAuditEntry

### Community 58 - "ProjectPage"
Cohesion: 0.25
Nodes (8): FileNode, ProjectPage, AddPageDialogProps, DeletePageDialogProps, DuplicatePageDialogProps, FileActionDialogProps, PageParamDialogProps, WorkspaceSidebarProps

## Knowledge Gaps
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ProjectPage` connect `ProjectPage` to `api.ts`, `RunState`, `CanvasArea.tsx`, `projects.ts`, `main/index.ts`, `lucide-react`, `types.ts`, `MultiPageCanvas.tsx`, `App.tsx`, `WorkspaceView.tsx`, `bridge.ts`, `WorkspaceSidebar.tsx`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Should `aiTools.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0675990675990676 - nodes in this community are weakly interconnected._
- **Why does `electron` connect `aiAudit.ts` to `aiTools.ts`, `main/ai.ts`, `store.ts`, `main/index.ts`, `types.ts`, `pages.ts`, `package.json`, `aiCost.ts`, `agentIntegrations.ts`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Should `api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.03125 - nodes in this community are weakly interconnected._
- **Why does `ProjectRecord` connect `RunState` to `api.ts`, `VersionsTab.tsx`, `projects.ts`, `store.ts`, `main/index.ts`, `lucide-react`, `types.ts`, `App.tsx`, `TopBar.tsx`, `bridge.ts`, `WorkspaceView.tsx`, `WorkspaceSidebar.tsx`, `ProjectPage`, `mock.ts`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Should `main/toolbox.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07948568088836938 - nodes in this community are weakly interconnected._
- **Should `AIPanel.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11956521739130435 - nodes in this community are weakly interconnected._