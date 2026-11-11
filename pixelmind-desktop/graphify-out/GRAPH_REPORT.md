# Graph Report - pixelmind-desktop  (2026-11-11)

## Corpus Check
- 98 files · ~182,013 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 24 file(s) not represented in the graph (top: .css 22, .example 1, (none) 1)

## Summary
- 1152 nodes · 2697 edges · 56 communities (49 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2644aae9`
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
- PixelMindApi
- preload/index.ts
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
- execFileAsync
- VersionsTab.tsx
- types.ts
- FileViewer.tsx
- aiMock.ts
- agentDefs.ts
- dependencies
- supabase.ts
- scripts
- ideWsBridge.ts
- RunLog
- recordAudit
- AIThemeDialog.tsx
- IdeWebSocketBridge
- tsconfig.json
- addProject
- electron.vite.config.ts
- startChat
- NavRail.tsx
- theme.ts
- AIDesignImportDialog.tsx
- aiAudit.ts

## God Nodes (most connected - your core abstractions)
1. `lucide-react` - 38 edges
2. `react` - 36 edges
3. `RunState` - 30 edges
4. `ProjectRecord` - 29 edges
5. `PixelMindApi` - 28 edges
6. `ProjectPage` - 27 edges
7. `Modal()` - 27 edges
8. `App()` - 24 edges
9. `EditorBufferManager` - 23 edges
10. `RunnerManager` - 20 edges

## Surprising Connections (you probably didn't know these)
- `startChat()` --calls--> `run()`  [EXTRACTED]
  electron/main/ai.ts → shared/ai.ts
- `buildContextPack()` --calls--> `estimateTokens()`  [EXTRACTED]
  electron/main/aiContext.ts → shared/ai.ts
- `ReadGitGraphOptions` --references--> `GitGraphScope`  [EXTRACTED]
  electron/main/projects.ts → shared/types.ts
- `AIPanelProps` --references--> `RunLog`  [EXTRACTED]
  src/components/AIPanel.tsx → shared/types.ts
- `CanvasAreaProps` --references--> `ProjectPage`  [EXTRACTED]
  src/components/CanvasArea.tsx → shared/types.ts

## Import Cycles
- None detected.

## Communities (56 total, 7 thin omitted)

### Community 0 - "aiTools.ts"
Cohesion: 0.07
Nodes (67): acceptChange(), appendEvent(), buildDiff(), changePath(), changesDir(), ensureDirs(), journalPath(), lcsOps() (+59 more)

### Community 2 - "main/toolbox.ts"
Cohesion: 0.06
Nodes (67): appendToBody(), ASSET_EXT, backupFile(), blockAround(), buildPreview(), Candidate, CODE_EXT, collectCandidates() (+59 more)

### Community 3 - "AIPanel.tsx"
Cohesion: 0.12
Nodes (25): AiBridgeStatus, AiContextResult, AiPlanStep, AiToolLogEntry, AiAttachment, AiChatMessage, AiMessageContent(), AIPanel() (+17 more)

### Community 4 - "CanvasArea.tsx"
Cohesion: 0.07
Nodes (30): AlignType, CanvasMode, CanvasToast, DistributeType, HandleDirection, HoverElementInfo, ResizingState, ToolConfig (+22 more)

### Community 5 - "ToolboxPanel.tsx"
Cohesion: 0.06
Nodes (44): InsertPlacement, ProjectComponent, ProjectScanResult, ToolboxElement, ToolboxGroupId, COMMON_CONTROL_IDS, ElementCatalogPanel(), elementToDragItem() (+36 more)

### Community 6 - "cliBridge.ts"
Cohesion: 0.12
Nodes (28): getAgentDef(), activeCliProcesses, AgentRunHandle, createStreamParser(), detectInstalledClis(), execFileAsync, extractVersion(), firstLine() (+20 more)

### Community 7 - "projects.ts"
Cohesion: 0.08
Nodes (38): addDevScriptToPkg(), buildMeta(), createIndexHtmlFile(), detectDotnetProject(), detectFlutterProject(), detectFramework(), detectOtherProject(), detectPackageManager() (+30 more)

### Community 8 - "shared/ai.ts"
Cohesion: 0.06
Nodes (9): AiChangeStatus, AiChatMessage, AiCliTarget, AiContextSource, AiContextWire, AiMessageRole, AiToolCall, AiToolName (+1 more)

### Community 9 - "main/ai.ts"
Cohesion: 0.08
Nodes (41): agentSessions, authHeaders(), cancelChat(), chatHistoryPath(), clearChatHistory(), completeAi(), controllers, DEFAULTS (+33 more)

### Community 10 - "RunnerManager"
Cohesion: 0.15
Nodes (9): Entry, killPort(), killProjectBinaries(), LogHandler, MIME, RunnerManager, StateHandler, PackageManager (+1 more)

### Community 11 - "store.ts"
Cohesion: 0.27
Nodes (15): appendActivity(), EMPTY_SETTINGS, normalize(), normalizeProject(), patchProject(), patchStore(), persist(), readStore() (+7 more)

### Community 12 - "main/index.ts"
Cohesion: 0.09
Nodes (36): addNavigation(), ASSET_EXTENSION_SET, ASSET_EXTENSIONS, AttrMatch, buildMenu(), collectSourceTags(), createWindow(), escapeRegExp() (+28 more)

### Community 13 - "lucide-react"
Cohesion: 0.13
Nodes (23): lucide-react, react, ProjectPage, AddPageDialogProps, FRAMES, RouteSuggestion, SOFTWARES, DeletePageDialogProps (+15 more)

### Community 14 - "PixelMindApi"
Cohesion: 0.25
Nodes (8): ReadGitGraphOptions, PixelMindApi, ToolboxMutationPayload, ToolboxWritePayload, GitGraphScope, GitRollbackResult, StoreData, Window

### Community 15 - "preload/index.ts"
Cohesion: 0.17
Nodes (11): api, PreloadApi, AiBridgeKind, AiChatEntry, AiChatEvent, AiChatRequest, AiChatStartRequest, AiCliEvent (+3 more)

### Community 16 - "pages.ts"
Cohesion: 0.17
Nodes (23): assertInsideProject(), buildTemplate(), cleanupEmptyParents(), collectFiles(), copyPageFile(), dirExists(), escapeHtml(), fileExists() (+15 more)

### Community 17 - "MultiPageCanvas.tsx"
Cohesion: 0.17
Nodes (21): canonicalPageKey(), CodeRevert, computeClusterLayout(), computeRingsLayout(), computeWireShape(), ConnectDrag, dedupePages(), DetectedAnchor (+13 more)

### Community 18 - "package.json"
Cohesion: 0.13
Nodes (19): author, description, devDependencies, electron-builder@^26.18.0, @types/node@^24.13.3, @types/react@^19.2.18, @types/react-dom@^19.2.4, typescript@~6.0.2 (+11 more)

### Community 19 - "App.tsx"
Cohesion: 0.13
Nodes (25): App(), DialogId, EMPTY_STORE, errorMessage(), View, AddPageDialog(), computeSuggestions(), AIDesignImportDialog() (+17 more)

### Community 20 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowSyntheticDefaultImports, esModuleInterop, isolatedModules, jsx, lib, module, moduleResolution (+11 more)

### Community 21 - "AISidecar.tsx"
Cohesion: 0.24
Nodes (10): AiSelection, AISidecar(), AISidecarProps, extractSuggestionFromText(), generateLocalHeuristicSuggestion(), QUICK_PROMPTS, SidecarDiffItem, SidecarSuggestion (+2 more)

### Community 22 - "TopBar.tsx"
Cohesion: 0.46
Nodes (6): PanelBottomIcon(), PanelIconProps, PanelLeftIcon(), PanelRightIcon(), PencilFillIcon(), TopBar()

### Community 24 - "SettingsDialog.tsx"
Cohesion: 0.22
Nodes (8): AiTestResult, AppInfo, ACCENTS, CODE_FONTS, SettingsDialogProps, SHORTCUT_GROUPS, TabId, TABS

### Community 25 - "WorkspaceSidebar.tsx"
Cohesion: 0.08
Nodes (41): DEFAULT_DESIGN_TOKENS, generateTailwindTokensConfig(), generateVariablesCss(), tokenToCssVarName(), ColorToken, DesignTokens, FileNode, RadiusToken (+33 more)

### Community 26 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, noEmit, noUnusedLocals (+7 more)

### Community 27 - "GitGraphView.tsx"
Cohesion: 0.20
Nodes (15): GitCommit, colorOf(), GitGraphView(), GitGraphViewProps, initialsOf(), laneX(), refClass(), formatRelativeTime() (+7 more)

### Community 28 - "mock.ts"
Cohesion: 0.15
Nodes (9): estimateTokens(), DEFAULT_SETTINGS, createBrowserMock(), DEMO_ROOT, demoFiles, demoProject, demoTree(), node() (+1 more)

### Community 29 - "aiCost.ts"
Cohesion: 0.35
Nodes (11): budgetFilePath(), computeStats(), getCostStats(), readStoredBudget(), recordTokenUsage(), resetCostStats(), safeId(), setTokenBudget() (+3 more)

### Community 30 - "build"
Cohesion: 0.17
Nodes (12): build, appId, directories, files, nsis, productName, win, output (+4 more)

### Community 31 - "agentIntegrations.ts"
Cohesion: 0.29
Nodes (10): AgentIntegration, buildSkillPreamble(), BUILTIN_SKILLS, describeMcp(), ensureProjectSkills(), loadMcpServers(), McpServerConfig, prepareAgentIntegration() (+2 more)

### Community 33 - "execFileAsync"
Cohesion: 0.24
Nodes (11): execFileAsync, getGitDiffStats(), gitBranch(), gitFetch(), gitHeadHash(), gitRemotes(), gitRevertFiles(), initGit() (+3 more)

### Community 34 - "VersionsTab.tsx"
Cohesion: 0.19
Nodes (9): AtomLogo(), AtomLogoProps, ProjectDetail(), statusChip, ProjectView(), fileName(), formatTime(), scriptLabel() (+1 more)

### Community 35 - "types.ts"
Cohesion: 0.10
Nodes (28): ActivityKind, ActivityStatus, GitGraphData, GitRefType, IssueActionKind, IssueLevel, IssueType, ProjectActivity (+20 more)

### Community 37 - "FileViewer.tsx"
Cohesion: 0.26
Nodes (12): FileContent, FileViewer(), FileViewerProps, getMonacoLanguage(), RunSidebar(), SidebarTab, rememberAiPanelWidth(), savedAiPanelWidth() (+4 more)

### Community 38 - "aiMock.ts"
Cohesion: 0.12
Nodes (17): AIPanelProps, CanvasAreaProps, ReferenceAsset, AiBridgeKind, AiBridgeProfile, AiBuildError, AiChange, AiChangeStatus (+9 more)

### Community 39 - "agentDefs.ts"
Cohesion: 0.18
Nodes (7): AGENT_DEFS, AgentBuildOptions, AgentDef, AgentStreamFormat, findAgentDefByBinary(), AgentRunOptions, isBinaryAllowed()

### Community 40 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, lucide-react@^1.63.0, @monaco-editor/react@^4.7.0, react@^19.2.0, react-dom@^19.2.0, react-resizable-panels@^4.15.0, @monaco-editor/react, react-dom (+1 more)

### Community 41 - "supabase.ts"
Cohesion: 0.29
Nodes (6): @supabase/supabase-js@^2.119.0, @supabase/supabase-js, isSupabaseConfigured, supabase, supabaseAnonKey, supabaseUrl

### Community 42 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, dist, preview, preview:web, typecheck

### Community 43 - "ideWsBridge.ts"
Cohesion: 0.47
Nodes (5): ideWsBridge, IdeWsMessage, IdeWsMessageType, AiContextPack, AiToolResult

### Community 44 - "RunLog"
Cohesion: 0.23
Nodes (11): RunLog, LogPanel(), LogPanelProps, PreviewPaneProps, errorBadgeLabel(), VisualErrorCard(), VisualErrorCardProps, ErrorType (+3 more)

### Community 45 - "recordAudit"
Cohesion: 0.48
Nodes (7): killSwitch(), recordAudit(), killAllCliProcesses(), runAgent(), runCliAgent(), stopCliAgent(), onEvent()

### Community 46 - "AIThemeDialog.tsx"
Cohesion: 0.17
Nodes (15): AIThemeDialog(), ContentField, contrast(), DEFAULT_SECTION_FIELDS, hexToRgb(), luminance(), MOODS, SectionId (+7 more)

### Community 49 - "addProject"
Cohesion: 0.40
Nodes (5): addProject(), findProjectCssDir(), mergeDetected(), samePath(), isDirectory()

### Community 50 - "electron.vite.config.ts"
Cohesion: 0.40
Nodes (4): electron-vite@^6.0.0, @vitejs/plugin-react@^6.1.2, electron-vite, @vitejs/plugin-react

### Community 51 - "startChat"
Cohesion: 0.29
Nodes (8): agentSessionsFile(), extractPlanFromText(), friendlyRuntimeError(), loadAgentSessions(), persistAgentSessions(), persistChat(), startChat(), run()

### Community 53 - "theme.ts"
Cohesion: 0.80
Nodes (4): applyThemeVariables(), clamp(), hexToRgb(), mix()

### Community 56 - "AIDesignImportDialog.tsx"
Cohesion: 0.22
Nodes (8): AIDesignImportDialogProps, DEFAULT_SNIPPETS, FrameworkId, FRAMEWORKS, Phase, ToastKind, AI_DESIGN_SECTIONS, AiDesignSection

### Community 57 - "aiAudit.ts"
Cohesion: 0.36
Nodes (7): auditFilePath(), clearAuditLogs(), listAuditLogs(), safeId(), electron@^45.1.0, electron, AiAuditEntry

## Knowledge Gaps
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `lucide-react` to `main/toolbox.ts`, `AIPanel.tsx`, `CanvasArea.tsx`, `ToolboxPanel.tsx`, `MultiPageCanvas.tsx`, `package.json`, `App.tsx`, `AISidecar.tsx`, `TopBar.tsx`, `SettingsDialog.tsx`, `WorkspaceSidebar.tsx`, `GitGraphView.tsx`, `VersionsTab.tsx`, `types.ts`, `main.tsx`, `FileViewer.tsx`, `dependencies`, `RunLog`, `AIThemeDialog.tsx`, `AIDesignImportDialog.tsx`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Should `aiTools.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0687719298245614 - nodes in this community are weakly interconnected._
- **Why does `EditorBufferManager` connect `EditorBufferManager` to `CanvasArea.tsx`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Should `api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.03125 - nodes in this community are weakly interconnected._
- **Why does `electron` connect `aiAudit.ts` to `aiTools.ts`, `main/ai.ts`, `store.ts`, `main/index.ts`, `preload/index.ts`, `pages.ts`, `package.json`, `aiCost.ts`, `agentIntegrations.ts`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Should `main/toolbox.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06438631790744467 - nodes in this community are weakly interconnected._
- **Should `AIPanel.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11692307692307692 - nodes in this community are weakly interconnected._