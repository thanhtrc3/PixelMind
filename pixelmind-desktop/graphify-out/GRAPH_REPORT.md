# Graph Report - pixelmind-desktop  (2026-11-11)

## Corpus Check
- 99 files · ~183,971 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 24 file(s) not represented in the graph (top: .css 22, .example 1, (none) 1)

## Summary
- 1166 nodes · 2717 edges · 52 communities (46 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ee5e693a`
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
- WorkspaceView.tsx
- TopBar.tsx
- main/index.ts
- WorkspaceSidebar.tsx
- preload/index.ts
- format.ts
- pages.ts
- MultiPageCanvas.tsx
- package.json
- lucide-react
- compilerOptions
- AISidecar.tsx
- TopBar.tsx
- EditorBufferManager
- data/toolbox.ts
- shared/toolbox.ts
- compilerOptions
- types.ts
- mock.ts
- aiCost.ts
- build
- agentIntegrations.ts
- AiApi
- GitGraphView.tsx
- addNavigation
- App.tsx
- ProjectRecord
- aiMock.ts
- readChatEntries
- dependencies
- supabase.ts
- scripts
- react
- detectPages
- agentDefs.ts
- tsconfig.json
- detectProject
- electron.vite.config.ts
- startChat
- walk
- AIDesignImportDialog.tsx

## God Nodes (most connected - your core abstractions)
1. `lucide-react` - 38 edges
2. `react` - 36 edges
3. `RunState` - 30 edges
4. `ProjectRecord` - 29 edges
5. `PixelMindApi` - 28 edges
6. `ProjectPage` - 27 edges
7. `Modal()` - 26 edges
8. `App()` - 26 edges
9. `EditorBufferManager` - 23 edges
10. `RunnerManager` - 20 edges

## Surprising Connections (you probably didn't know these)
- `FileActionDialogProps` --references--> `FileNode`  [EXTRACTED]
  src/components/FileActionDialog.tsx → shared/types.ts
- `FileTreeProps` --references--> `FileNode`  [EXTRACTED]
  src/components/FileTree.tsx → shared/types.ts
- `FileViewerProps` --references--> `FileContent`  [EXTRACTED]
  src/components/FileViewer.tsx → shared/types.ts
- `ProjectViewProps` --references--> `ProjectRecord`  [EXTRACTED]
  src/components/ProjectView.tsx → shared/types.ts
- `TitleBarProps` --references--> `ProjectRecord`  [EXTRACTED]
  src/components/TitleBar.tsx → shared/types.ts

## Import Cycles
- None detected.

## Communities (52 total, 6 thin omitted)

### Community 0 - "aiTools.ts"
Cohesion: 0.05
Nodes (77): acceptChange(), appendEvent(), buildDiff(), changePath(), changesDir(), ensureDirs(), journalPath(), lcsOps() (+69 more)

### Community 2 - "main/toolbox.ts"
Cohesion: 0.12
Nodes (41): appendToBody(), ASSET_EXT, backupFile(), blockAround(), buildPreview(), Candidate, CODE_EXT, collectCandidates() (+33 more)

### Community 3 - "AIPanel.tsx"
Cohesion: 0.10
Nodes (29): AiAuditEntry, AiBridgeStatus, AiChatEntry, AiConversationSummary, AiPlanStep, AiToolLogEntry, AiAttachment, AiChatMessage (+21 more)

### Community 4 - "CanvasArea.tsx"
Cohesion: 0.06
Nodes (40): MutationPreview, AlignType, CanvasAreaProps, CanvasMode, CanvasToast, DistributeType, HandleDirection, HoverElementInfo (+32 more)

### Community 5 - "ToolboxPanel.tsx"
Cohesion: 0.11
Nodes (25): InsertPlacement, ProjectComponent, ToolboxElement, ToolboxGroupId, COMMON_CONTROL_IDS, ElementCatalogPanel(), elementToDragItem(), getControlIcon() (+17 more)

### Community 6 - "cliBridge.ts"
Cohesion: 0.10
Nodes (34): killSwitch(), activeCliProcesses, AgentRunHandle, createStreamParser(), detectInstalledClis(), execFileAsync, extractVersion(), firstLine() (+26 more)

### Community 7 - "projects.ts"
Cohesion: 0.09
Nodes (33): addDevScriptToPkg(), buildMeta(), DotnetProjectInfo, execFileAsync, extOf(), FlutterProjectInfo, getGitDiffStats(), GIT_LOG_FORMAT (+25 more)

### Community 8 - "shared/ai.ts"
Cohesion: 0.05
Nodes (14): AiChangeStatus, AiChatMessage, AiChatRequest, AiChatStartRequest, AiCliTarget, AiConfig, AiContextSource, AiContextWire (+6 more)

### Community 9 - "main/ai.ts"
Cohesion: 0.09
Nodes (36): agentSessions, authHeaders(), cancelChat(), completeAi(), controllers, DEFAULTS, EnvMap, fetchJson() (+28 more)

### Community 10 - "WorkspaceView.tsx"
Cohesion: 0.10
Nodes (20): Entry, killPort(), killProjectBinaries(), LogHandler, MIME, RunnerManager, StateHandler, PackageManager (+12 more)

### Community 11 - "TopBar.tsx"
Cohesion: 0.39
Nodes (7): PanelBottomIcon(), PanelIconProps, PanelLeftIcon(), PanelRightIcon(), PencilFillIcon(), TopBar(), TopBarProps

### Community 12 - "main/index.ts"
Cohesion: 0.11
Nodes (19): ASSET_EXTENSION_SET, ASSET_EXTENSIONS, AttrMatch, buildMenu(), collectSourceTags(), createWindow(), escapeRegExp(), GENERIC_CSS_CLASSES (+11 more)

### Community 13 - "WorkspaceSidebar.tsx"
Cohesion: 0.13
Nodes (24): FileActionDialog(), FileActionDialogProps, FileActionKind, getParentDir(), normalizeSlash(), collectFiles(), FileTree(), FileTreeProps (+16 more)

### Community 14 - "preload/index.ts"
Cohesion: 0.16
Nodes (15): api, PreloadApi, AiChatEvent, AiContextRequest, AiProposeChangeRequest, AiToolCallRequest, PixelMindApi, ProjectScanResult (+7 more)

### Community 15 - "format.ts"
Cohesion: 0.13
Nodes (16): AtomLogo(), AtomLogoProps, FileViewer(), FileViewerProps, getMonacoLanguage(), ProjectDetail(), statusChip, ProjectView() (+8 more)

### Community 16 - "pages.ts"
Cohesion: 0.17
Nodes (23): assertInsideProject(), buildTemplate(), cleanupEmptyParents(), collectFiles(), copyPageFile(), dirExists(), escapeHtml(), fileExists() (+15 more)

### Community 17 - "MultiPageCanvas.tsx"
Cohesion: 0.17
Nodes (21): canonicalPageKey(), CodeRevert, computeClusterLayout(), computeRingsLayout(), computeWireShape(), ConnectDrag, dedupePages(), DetectedAnchor (+13 more)

### Community 18 - "package.json"
Cohesion: 0.12
Nodes (20): author, description, devDependencies, electron@^45.1.0, electron-builder@^26.18.0, @types/node@^24.13.3, @types/react@^19.2.18, @types/react-dom@^19.2.4 (+12 more)

### Community 19 - "lucide-react"
Cohesion: 0.07
Nodes (35): lucide-react, AiTestResult, ProjectIssue, ProjectPage, AddPageDialog(), AddPageDialogProps, computeSuggestions(), FRAMES (+27 more)

### Community 20 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowSyntheticDefaultImports, esModuleInterop, isolatedModules, jsx, lib, module, moduleResolution (+11 more)

### Community 21 - "AISidecar.tsx"
Cohesion: 0.24
Nodes (10): AiSelection, AISidecar(), AISidecarProps, extractSuggestionFromText(), generateLocalHeuristicSuggestion(), QUICK_PROMPTS, SidecarDiffItem, SidecarSuggestion (+2 more)

### Community 22 - "TopBar.tsx"
Cohesion: 0.23
Nodes (10): MenuDef, RestoreIcon(), TitleBar(), TitleBarProps, errorText(), VersionsTab(), VersionsTabProps, api (+2 more)

### Community 24 - "data/toolbox.ts"
Cohesion: 0.12
Nodes (18): at(), csses, FILE_ROLE, GROUPS, htmls, idOf(), InsertedPart, metas (+10 more)

### Community 25 - "shared/toolbox.ts"
Cohesion: 0.15
Nodes (16): cssToFrameworkBlock(), toFrameworkHtml(), AttributeMutationRequest, cssToJsxObject(), DeleteMutationRequest, DuplicateMutationRequest, ElementMutationTarget, escapeRazor() (+8 more)

### Community 26 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, noEmit, noUnusedLocals (+7 more)

### Community 27 - "types.ts"
Cohesion: 0.05
Nodes (61): appendActivity(), EMPTY_SETTINGS, normalize(), normalizeProject(), patchProject(), patchStore(), persist(), readStore() (+53 more)

### Community 28 - "mock.ts"
Cohesion: 0.15
Nodes (9): AiChange, estimateTokens(), createBrowserMock(), DEMO_ROOT, demoFiles, demoProject, demoTree(), node() (+1 more)

### Community 29 - "aiCost.ts"
Cohesion: 0.35
Nodes (11): budgetFilePath(), computeStats(), getCostStats(), readStoredBudget(), recordTokenUsage(), resetCostStats(), safeId(), setTokenBudget() (+3 more)

### Community 30 - "build"
Cohesion: 0.17
Nodes (12): build, appId, directories, files, nsis, productName, win, output (+4 more)

### Community 31 - "agentIntegrations.ts"
Cohesion: 0.29
Nodes (10): AgentIntegration, buildSkillPreamble(), BUILTIN_SKILLS, describeMcp(), ensureProjectSkills(), loadMcpServers(), McpServerConfig, prepareAgentIntegration() (+2 more)

### Community 33 - "GitGraphView.tsx"
Cohesion: 0.20
Nodes (15): GitCommit, colorOf(), GitGraphView(), GitGraphViewProps, initialsOf(), laneX(), refClass(), formatRelativeTime() (+7 more)

### Community 34 - "addNavigation"
Cohesion: 0.24
Nodes (15): addNavigation(), findBracedAttr(), findStaticAttr(), handlerHasNavigation(), handlerPointsTo(), hasAspNavigation(), removeAspNavigation(), removeNavigation() (+7 more)

### Community 35 - "App.tsx"
Cohesion: 0.17
Nodes (20): App(), DialogId, EMPTY_STORE, errorMessage(), View, CommandPalette(), DeletePageDialog(), StatusBar() (+12 more)

### Community 37 - "ProjectRecord"
Cohesion: 0.33
Nodes (11): FileNode, ProjectDiagnosis, ProjectRecord, ProjectStat, Settings, DiagnosisDialogProps, ProjectDetailProps, RunSidebarProps (+3 more)

### Community 38 - "aiMock.ts"
Cohesion: 0.13
Nodes (15): AIPanelProps, AiBridgeKind, AiBridgeProfile, AiBuildError, AiChange, AiChangeStatus, AiChatMessage, AiContextItem (+7 more)

### Community 39 - "readChatEntries"
Cohesion: 0.39
Nodes (9): chatHistoryPath(), clearChatHistory(), getChatHistory(), getConversations(), normalizeConversationId(), readChatEntries(), removeConversation(), rewriteChatHistory() (+1 more)

### Community 40 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, lucide-react@^1.63.0, @monaco-editor/react@^4.7.0, react@^19.2.0, react-dom@^19.2.0, react-resizable-panels@^4.15.0, @monaco-editor/react, react-dom (+1 more)

### Community 41 - "supabase.ts"
Cohesion: 0.29
Nodes (6): @supabase/supabase-js@^2.119.0, @supabase/supabase-js, isSupabaseConfigured, supabase, supabaseAnonKey, supabaseUrl

### Community 42 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, dist, preview, preview:web, typecheck

### Community 43 - "react"
Cohesion: 0.25
Nodes (7): react, CommandPaletteProps, PaletteCommand, Toast(), ToastMessage, ToastStack(), ToastStackProps

### Community 44 - "detectPages"
Cohesion: 0.50
Nodes (4): detectPages(), listFiles(), routeFromName(), titleFromName()

### Community 45 - "agentDefs.ts"
Cohesion: 0.18
Nodes (7): AGENT_DEFS, AgentBuildOptions, AgentDef, AgentStreamFormat, findAgentDefByBinary(), AgentRunOptions, isBinaryAllowed()

### Community 49 - "detectProject"
Cohesion: 0.14
Nodes (18): addProject(), findProjectCssDir(), mergeDetected(), samePath(), createIndexHtmlFile(), detectDotnetProject(), detectFlutterProject(), detectFramework() (+10 more)

### Community 50 - "electron.vite.config.ts"
Cohesion: 0.40
Nodes (4): electron-vite@^6.0.0, @vitejs/plugin-react@^6.1.2, electron-vite, @vitejs/plugin-react

### Community 51 - "startChat"
Cohesion: 0.24
Nodes (10): getAgentDef(), agentSessionsFile(), extractPlanFromText(), friendlyRuntimeError(), loadAgentSessions(), persistAgentSessions(), persistChat(), startChat() (+2 more)

### Community 56 - "AIDesignImportDialog.tsx"
Cohesion: 0.20
Nodes (9): AIDesignImportDialog(), AIDesignImportDialogProps, DEFAULT_SNIPPETS, FrameworkId, FRAMEWORKS, Phase, ToastKind, AI_DESIGN_SECTIONS (+1 more)

## Knowledge Gaps
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `AIPanel.tsx`, `CanvasArea.tsx`, `ToolboxPanel.tsx`, `WorkspaceView.tsx`, `TopBar.tsx`, `WorkspaceSidebar.tsx`, `format.ts`, `MultiPageCanvas.tsx`, `package.json`, `lucide-react`, `AISidecar.tsx`, `TopBar.tsx`, `types.ts`, `GitGraphView.tsx`, `App.tsx`, `main.tsx`, `ProjectRecord`, `dependencies`, `AIDesignImportDialog.tsx`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Should `aiTools.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05283505154639175 - nodes in this community are weakly interconnected._
- **Why does `electron` connect `aiTools.ts` to `main/ai.ts`, `main/index.ts`, `preload/index.ts`, `pages.ts`, `package.json`, `types.ts`, `aiCost.ts`, `agentIntegrations.ts`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Should `api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.03125 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `lucide-react` to `App.tsx`, `AIPanel.tsx`, `CanvasArea.tsx`, `ProjectRecord`, `ToolboxPanel.tsx`, `dependencies`, `WorkspaceView.tsx`, `react`, `TopBar.tsx`, `WorkspaceSidebar.tsx`, `format.ts`, `MultiPageCanvas.tsx`, `package.json`, `AISidecar.tsx`, `TopBar.tsx`, `AIDesignImportDialog.tsx`, `types.ts`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Should `main/toolbox.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1207897793263647 - nodes in this community are weakly interconnected._
- **Should `AIPanel.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10114942528735632 - nodes in this community are weakly interconnected._