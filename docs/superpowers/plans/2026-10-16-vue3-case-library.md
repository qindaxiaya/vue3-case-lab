# Vue 3 案例库 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **状态（2026-10-20）：** 本计划 14 个 Task 已全部完成。实际实现与后续调整（无侧边栏、notes 五段、说明/源码 tab、CI 与 ruleset 硬门禁、56 个案例）以 `AGENTS.md` 为准；本文件保留为历史实施记录。

**Goal:** 构建一个本地运行的 Vue 3 高级案例速查站：分类导航 + 搜索，每个案例含可交互演示、带中文注释的核心代码、可下钻的完整源码、中文原理说明。

**Architecture:** Vite + Vue 3 + TS strict + Sass（SCSS，CSS 变量主题）+ Vue Router。案例以约定目录结构存放（`src/examples/<category>/<case-id>/` 含 Demo.vue、meta.ts、code/*.txt），通过 `import.meta.glob` 自动注册，新增案例零注册成本。代码展示用 highlight.js 异步高亮 + `?raw` 导入；说明用 marked 渲染 meta 中的 Markdown。

**Tech Stack:** Vue 3.5+（`<script setup lang="ts">`）、Vite、TypeScript strict、Sass（SCSS 语法，CSS 变量 `.dark` 暗色策略）、Vue Router、highlight.js、marked、vitest（仅测注册表纯逻辑）、npm。

**Spec:** `docs/superpowers/specs/2026-10-16-vue3-case-library-design.md`

## Global Constraints

- 全程中文界面、中文说明文案；变量/函数/文件名英文
- **站点自身全部代码写中文注释**（组件/composable/工具/路由），关键逻辑逐行注释「做什么、为什么」，与案例代码同等标准
- TS strict，禁止 `any`（确需时用 `unknown` + 收窄）
- 组件 `<script setup lang="ts">`，组件 PascalCase，文件 kebab-case
- 禁止第三方 UI 组件库、禁止 Pinia；样式用 Sass（SCSS）+ CSS 变量主题，自建全局类 `btn-primary`/`btn-ghost`/`card`/`tag`，案例 Demo 用自身 scoped SCSS
- 暗色模式：`.dark` class 策略（`<html class="dark">`）+ CSS 变量切换 + `localStorage` 键 `moyu-theme` 持久化
- 站点名固定「Vue 3 案例库」
- 核心代码片段（`code/*.txt`）必须带中文注释，关键 API 逐行注释；超 60 行按 `// --- 步骤一：xxx ---` 分段；禁止裸代码块
- 每任务结束 commit（Task 1 先 `git init`）
- 验证命令：`npm run type-check`、`npm run lint`、`npx vitest run`、`npm run dev` 手工走查

## Review Focus

以下失败模式 spec 有暗示但不易被常规验证捕获，审查时重点看：

1. **暗色模式首屏闪白**：主题 class 必须在 FOUC 前同步应用（index.html 内联 script 读 localStorage）——Task 3 步骤验证
2. **highlight.js 暗色主题不跟随**：切换暗色后已渲染代码块颜色不更新——Task 4 需在切换后重渲或双主题 CSS，步骤里验证
3. **PerformanceObserver 部分指标类型不被浏览器支持**：`observe({ type })` 需 try/catch 兼容（如旧浏览器无 `longtask`/`event`）——Task 6 步骤验证不支持时优雅降级
4. **虚拟列表滚动抖动/首渲卡顿**：10 万行数据生成放一次性工具函数，渲染窗口用 `requestAnimationFrame` 节流——Task 10 步骤验证滚动流畅、节点数恒定
5. **marked 渲染 XSS**：notes 为本地可信内容不引入 DOMPurify，但 `v-html` 仅允许来自 meta.ts 的 notes 字段，不允许用户输入流入——Task 4 实现时注明
6. **中文输入法搜索抖动**：搜索用 `computed` 过滤即可（输入法组词期间频繁更新可接受），但需验证输入法确认前后不丢字——Task 3 步骤验证

---

### Task 1: 项目脚手架与全局样式

**Files:**
- Create: `package.json`、`vite.config.ts`、`tsconfig.json` 等脚手架文件
- Create: `index.html`（含防闪白内联主题脚本占位）
- Create: `src/main.ts`、`src/App.vue`、`src/style.scss`（Sass 入口：token 变量、dark 主题、自建类）
- Create: `src/types/case.ts`（空壳类型，Task 2 填充）
- Create: `AGENTS.md`（项目记忆载体）
- Init: git 仓库（已存在，无需重复）

**Interfaces:**
- Produces: 可启动的空站；`src/style.scss` 定义 CSS 变量主题（`:root`/`.dark`）、自建组件类

- [x] **Step 1: 用 Vite 官方模板初始化项目**

```powershell
npm create vite@latest . -- --template vue-ts
npm install
npm install vue-router highlight.js marked
npm install -D sass vitest
```

若目录非空导致模板初始化失败，手动创建等价文件（package.json scripts：`dev`/`build`/`preview`/`type-check`（`vue-tsc --noEmit`）/`lint`（eslint + eslint-plugin-vue + typescript-eslint））。

- [x] **Step 2: 配置 Sass 入口与暗色主题**

`src/style.scss` 写 `:root` 与 `.dark` 的 CSS 变量（spec §7 Token 表：颜色/圆角/阴影/字体），并定义自建类：`btn-primary`、`btn-ghost`、`card`、`tag`（用 CSS 变量实现浅/暗双模式）。Sass 用于组织嵌套、mixin、局部变量；主题切换值用 CSS 变量。全局组件样式放 `src/styles/` 下按模块拆分（`_tokens.scss`、`_base.scss`、`_components.scss`），由 `style.scss` 统一 `@use`。

- [x] **Step 3: 创建空壳类型文件 `src/types/case.ts`**

```ts
export type CaseDifficulty = 'beginner' | 'intermediate' | 'advanced'
export interface CaseNotes { usage: string; principle: string; caveats: string }
export interface CaseMeta {
  id: string
  title: string
  difficulty: CaseDifficulty
  tags: string[]
  summary: string
  notes: CaseNotes
}
```

- [x] **Step 4: 创建 `AGENTS.md` 项目记忆骨架**

含四段（中文）：「项目速览」（一句话定位 + 技术栈 + 常用命令）、「约定」（复制 Global Constraints 要点：中文注释/禁第三方 UI 库/案例目录结构）、「当前进度」（初始化为：计划见 `docs/superpowers/plans/2026-10-16-vue3-case-library.md`，进行中 Task N）、「决策记录」（初始化两条：视觉走大众文档站风格、单 main + 多设备 git 同步）。后续每个任务收尾必须更新「当前进度」段。

- [x] **Step 5: 启动验证**

Run: `npm run dev`、`npm run type-check`
Expected: dev 服务启动无报错；type-check 通过

- [x] **Step 6: Commit**

```powershell
git add -A; git commit -m "chore: scaffold vite vue3 ts sass project with agents.md"
```

- [x] **Step 7: 接入 GitHub 远程仓库**（✅ 2026-10-19 已完成：仓库 qindaxiaya/vue3-case-lab 私有，origin 已关联并首推；2026-10-20 为启用 ruleset 转公开）

### Task 2: 案例自动注册表与搜索过滤

**Files:**
- Create: `src/examples/types.ts`（从 `src/types/case.ts` re-export，便于案例就近引用）
- Create: `src/examples/categories.ts`
- Create: `src/examples/registry.ts`
- Test: `tests/registry.spec.ts`

**Interfaces:**
- Consumes: `CaseMeta`（Task 1）
- Produces:
  - `categories: { id: string; name: string }[]` — 顺序即导航顺序：`performance`（性能监控）、`observer`（观察者）、`virtual`（虚拟渲染）、`vue3`（Vue 3 API）
  - `allCases: RegisteredCase[]`，其中 `RegisteredCase = { meta: CaseMeta; categoryId: string; demoComponent: Component; demoSource: string; codeTabs: { name: string; lang: string; content: string }[] }`
  - `getCase(categoryId: string, caseId: string): RegisteredCase | undefined`
  - `filterCases(cases: RegisteredCase[], query: string): RegisteredCase[]` — 大小写不敏感，匹配 title/tags/summary
  - `resolveCodeLang(fileName: string): string` — `usage.vue.txt` → `vue`，`composable.ts.txt` → `typescript`

- [x] **Step 1: 写失败测试 `tests/registry.spec.ts`**

覆盖：`resolveCodeLang` 从文件名提取语言；`filterCases` 空串返回全部、中文查询命中 summary、无命中返回空数组。用内联构造的 `RegisteredCase` 数组，不依赖 glob。

- [x] **Step 2: Run vitest 验证失败**

Run: `npx vitest run tests/registry.spec.ts`
Expected: FAIL（模块不存在）

- [x] **Step 3: 实现 `categories.ts` 与 `registry.ts`**

glob 规则：
- 组件：`import.meta.glob('../examples/*/*/Demo.vue', { eager: true })`
- 源码：`import.meta.glob('../examples/*/*/Demo.vue', { query: '?raw', import: 'default', eager: true })`
- 片段：`import.meta.glob('../examples/*/*/code/*.txt', { query: '?raw', import: 'default', eager: true })`
- 元数据：`import.meta.glob('../examples/*/*/meta.ts', { eager: true })`（取 default export）

按路径解析 categoryId/caseId，meta 缺失或 id 与目录名不一致时在 dev console 抛错。`codeTabs` 按文件名排序。

- [x] **Step 4: Run vitest 验证通过**

Run: `npx vitest run tests/registry.spec.ts`
Expected: PASS

- [x] **Step 5: Commit**

```powershell
git add -A; git commit -m "feat: case registry with glob auto-discovery and search filter"
```

### Task 3: 站点壳（路由/导航/搜索/主题切换）

**Files:**
- Create: `src/composables/useTheme.ts`
- Create: `src/components/AppHeader.vue`、`src/components/AppSidebar.vue`、`src/components/SearchBox.vue`、`src/components/ThemeToggle.vue`
- Create: `src/pages/HomePage.vue`（占位）、`src/pages/CasePage.vue`（占位）
- Create: `src/router.ts`
- Modify: `index.html`（内联防闪白脚本）、`src/main.ts`、`src/App.vue`

**Interfaces:**
- Consumes: `categories`、`allCases`、`filterCases`（Task 2）
- Produces: 路由 `/` → HomePage、`/c/:categoryId/:caseId` → CasePage；`useTheme(): { isDark: Ref<boolean>; toggle: () => void }`

- [x] **Step 1: 实现 `useTheme` 与防闪白**

`useTheme` 初始化读 `localStorage('moyu-theme')`，同步 `<html classList>`；`index.html` `<head>` 内联 script 在 Vue 挂载前执行同样逻辑（避免闪白）。

- [x] **Step 2: 实现 Header/Sidebar/Search/ThemeToggle**

App 布局：顶栏（站点名 + SearchBox + ThemeToggle）+ 左侧 Sidebar。Sidebar 按 `categories` 分组列出 `allCases`，`<router-link>` 当前项加 `aria-current="page"` 与 primary 高亮；搜索框绑定 `filterCases` 结果联动侧边栏列表；无结果显示「没有匹配的案例」空状态。

- [x] **Step 3: 路由与占位页**

HomePage/CasePage 先渲染占位文案；404 重定向到 `/`。

- [x] **Step 4: 验证**

Run: `npm run dev`
Expected: 暗色切换即时生效且刷新后保持、无闪白；搜索「性能」侧边栏只剩性能监控类；用中文输入法在搜索框组词「性能」，确认前后输入不丢字、结果实时联动；路由切换正常
Run: `npm run type-check && npm run lint`
Expected: 通过

- [x] **Step 5: Commit**

```powershell
git add -A; git commit -m "feat: site shell with sidebar nav search and dark theme"
```

### Task 4: 案例页三件套（演示卡/代码工作台/说明）

**Files:**
- Create: `src/components/CodeWorkbench.vue`
- Create: `src/components/CaseNotes.vue`
- Create: `src/pages/CasePage.vue`（正式实现，替换占位）

**Interfaces:**
- Consumes: `getCase`（Task 2）；`CaseMeta`（Task 1）
- Produces: `CodeWorkbench` props `{ tabs: { name: string; lang: string; content: string }[]; demoSource: string }`；`CaseNotes` props `{ notes: CaseNotes }`

- [x] **Step 1: 实现 `CodeWorkbench.vue`**

- tab 两组：「核心代码」（各 codeTabs 项）+「完整源码」（`Demo.vue` 全文，文件名显示 `Demo.vue`）
- highlight.js 按需注册语言：`typescript`、`javascript`、`html`（vue 走 html 规则）、`css`、`json`；`lang === 'vue'` 映射 html
- 暗色主题切换：watch `isDark` 后对已渲染块重新 `highlightElement`（或 CSS 双主题方案），确保 Review Focus #2 通过
- 复制按钮：`navigator.clipboard.writeText`，成功后按钮文案变「已复制」1.5s
- 代码区 `overflow-x-auto`，行号不强求

- [x] **Step 2: 实现 `CaseNotes.vue`**

`marked.parse(notes.usage/principle/caveats)` 三段渲染，段标题固定为「适用场景 / 原理 / 注意点」；`v-html` 仅渲染本地 meta 内容（可信，不引 sanitize 库，代码注明）。排版：正文行宽受限、`prose` 风格用 SCSS 手工排（h3 用 primary 色小标题、code 用 mono 圆角底）。

- [x] **Step 3: 组装 `CasePage.vue`**

从路由参数 `getCase`；页头 = 标题 + 难度 tag + API 标签 pills；往下依次 Demo 卡片（`<component :is="demoComponent" />` 包在 card 中）、CodeWorkbench、CaseNotes；找不到案例时显示空状态并给回首页链接。

- [x] **Step 4: 用临时冒烟案例验证**

临时建 `src/examples/performance/smoke/`（Demo.vue 按钮计数 + meta.ts + code/usage.ts.txt 带注释），走查：演示可交互、代码高亮与复制可用、切暗色代码主题跟随、完整源码 tab 显示 Demo.vue 全文、说明渲染正常。验证后删除冒烟案例目录。

- [x] **Step 5: 验证与 Commit**

Run: `npm run type-check && npm run lint`
Expected: 通过

```powershell
git add -A; git commit -m "feat: case page with demo card code workbench and notes"
```

### Task 5: 首页（精选入口）

**Files:**
- Modify: `src/pages/HomePage.vue`

**Interfaces:**
- Consumes: `allCases`、`categories`（Task 2）

- [x] **Step 1: 实现首页**

内容 = 一句站点简介 + 分类分组的案例卡片列表（标题/摘要/难度 tag/标签），卡片 `card` 类 + hover 提升；首张卡片为「性能监控面板」置顶精选。点击进 CasePage。

- [x] **Step 2: 验证与 Commit**

Run: `npm run dev` 手验首页与跳转；`npm run type-check && npm run lint`

```powershell
git add -A; git commit -m "feat: home page with featured cases"
```

---

以下任务每个交付一个 P0 案例。**所有案例任务共同规范**（不再重复）：

1. 目录 `src/examples/<category>/<case-id>/`，含 `Demo.vue`（可交互、scoped SCSS 样式、内部关键逻辑中文注释）、`meta.ts`（default export 满足 `CaseMeta`，notes 三段 Markdown）、`code/*.txt`（带逐行中文注释的教学代码，与 Demo 变量名一致，>60 行分段）
2. Demo.vue 不引用站点内部组件
3. 每步验证：`npm run type-check`、`npm run lint` 通过；`npm run dev` 手工走查演示交互 + 代码展示 + 说明阅读三件事
4. 收尾必做：更新 `AGENTS.md`「当前进度」段（已完成案例 id 清单）；重大实现取舍记入「决策记录」
5. Commit message：`feat(case): add <case-id>`

### Task 6: 案例 perf-observer（PerformanceObserver 面板）

**Files:**
- Create: `src/examples/performance/perf-observer/{Demo.vue, meta.ts, code/usage.ts.txt}`

**Interfaces:**
- Produces: 注册表自动收录（无需接线）

- [x] **Step 1: 写 Demo.vue**

用 `PerformanceObserver` 订阅 `paint`（FP/FCP）、`largest-contentful-paint`（LCP）、`layout-shift`（CLS，需 `buffered: true`）、`navigation`（TTFB）；指标卡网格展示实时值。额外按钮：「制造布局偏移」（动态插入图片使 CLS 上升）、「制造长任务」（同步阻塞 80ms）并用 `longtask` 类型观察（observe 包 try/catch，不支持则显示「当前浏览器不支持」）。`buffered: true` 保证进页面即有历史指标。

- [x] **Step 2: 写 code/usage.ts.txt 与 meta.ts**

片段讲清：`new PerformanceObserver(cb).observe({ type, buffered })` 模式、四类 entry 的关键字段（`startTime`、`value`、`hadRecentInput`）。notes：适用场景（真实用户性能监控 RUM）、原理（浏览器推送 buffered entry）、注意点（CLS 需排除近期输入、INP 需 `type: 'event'` 且单独聚合计算——说明里讲清本例为何不直接展示 INP 原始值）。

- [x] **Step 3: 走查验证**

Run: `npm run dev` → 案例页：页面加载即显示 FP/FCP/LCP/TTFB；点「制造布局偏移」CLS 数值增长变黄；「制造长任务」日志出现；type-check/lint 通过

- [x] **Step 4: Commit**

### Task 7: 案例 raf-loop（requestAnimationFrame 渲染循环）

**Files:**
- Create: `src/examples/performance/raf-loop/{Demo.vue, meta.ts, code/usage.ts.txt}`

- [x] **Step 1: 写 Demo.vue**

一个方块沿轨道循环移动（`transform` 动画，不用 CSS animation），启动/暂停按钮控制循环；实时显示 FPS（滑动窗口统计）、每帧回调耗时（`performance.now()` 差值）、累计帧数。停止时必须 `cancelAnimationFrame`，`onUnmounted` 清理。

- [x] **Step 2: 写 code/usage.ts.txt 与 meta.ts**

片段讲清：`requestAnimationFrame`/`cancelAnimationFrame` 配对、时间戳驱动位移（与 setInterval 的差异）、`document.visibilitychange` 时暂停的可选优化。notes：适用场景（自定义动画、节流渲染）、原理（与刷新率同步、后台标签暂停）、注意点（必须成对取消，否则切页后仍在跑）。

- [x] **Step 3: 走查验证**：FPS 数值随动画更新、暂停后帧数不再增长、离开页面无报错（devtool console）、type-check/lint 通过

- [x] **Step 4: Commit**

### Task 8: 案例 idle-schedule（requestIdleCallback 空闲调度）

**Files:**
- Create: `src/examples/performance/idle-schedule/{Demo.vue, meta.ts, code/usage.ts.txt}`

- [x] **Step 1: 写 Demo.vue**

对比演示：同一任务（生成 200 条列表项）提供「立即执行」与「空闲执行」两个按钮；点击立即执行时同步渲染进度条卡顿可视化（用 rAF 采样主线程响应），空闲执行分片推进（每片在 `deadline.timeRemaining() > 0` 时处理一批）。展示每片耗时与空闲时间余量日志。`cancelIdleCallback` 由「取消」按钮演示。

- [x] **Step 2: 写 code/usage.ts.txt 与 meta.ts**

片段讲清：`requestIdleCallback(callback, { timeout })`、`IdleDeadline` 的 `timeRemaining()`/`didTimeout`、超时兜底语义。notes：适用场景（首屏后的非紧急计算、大数据预处理）、原理（浏览器空闲期调度）、注意点（timeout 保底会强制执行；Safari 长期未支持需 rAF 降级——给出一行降级代码）。

- [x] **Step 3: 走查验证**：两按钮对比可见卡顿差异、取消按钮生效、type-check/lint 通过

- [x] **Step 4: Commit**

### Task 9: 案例 lazy-image（IntersectionObserver 图片懒加载）

**Files:**
- Create: `src/examples/observer/lazy-image/{Demo.vue, meta.ts, code/usage.ts.txt}`

- [x] **Step 1: 写 Demo.vue**

滚动容器内 30 张占位色块模拟图片（`div` + 随机背景色 + 高度），进入视口才「加载」（模拟 300ms 后显示完整内容）；观察器回调日志区实时打印 `isIntersecting` 与 `intersectionRatio`；演示 `root`（滚动容器）、`rootMargin: '100px'` 预加载、`threshold` 配置的效果（提供切换开关）。卸载时 `disconnect()`。

- [x] **Step 2: 写 code/usage.ts.txt 与 meta.ts**

片段讲清：`new IntersectionObserver(cb, { root, rootMargin, threshold })`、`entries.forEach` 判 `isIntersecting` 后 `unobserve` 释放、真实 img 懒加载的标准写法（`data-src` → `src`）。notes：适用场景（图片懒加载、无限滚动触点、曝光统计、吸底/吸顶检测）、原理（浏览器异步计算相交、不占主线程）、注意点（root 默认 viewport 不是 null 传法、用完要 unobserve/disconnect）。

- [x] **Step 3: 走查验证**：滚动时日志滚动打印、rootMargin 提前加载可见、type-check/lint 通过

- [x] **Step 4: Commit**

### Task 10: 案例 virtual-list（定高虚拟列表）

**Files:**
- Create: `src/examples/virtual/virtual-list/{Demo.vue, meta.ts, code/useVirtualList.ts.txt, code/usage.vue.txt}`

- [x] **Step 1: 写 Demo.vue**

10 万行数据（一次性生成 `Array.from`，行内容含序号与随机文案）；可视区固定 400px 高、行高 32px；只渲染视口 ±5 行（总 DOM 行数 ≈ 可视行数 + 10，页面常显「当前渲染节点数」）；外层容器 `transform: translateY` 定位。顶部统计条：总行数、渲染节点数、滚动位置。滚动处理用 rAF 节流。

- [x] **Step 2: 写 code/useVirtualList.ts.txt 与 code/usage.vue.txt**

composable 片段讲清：可视行数计算、startIndex/endIndex 公式、padding/transform 占位、滚动节流；usage 片段为模板用法。notes：适用场景（长列表/日志流/表格）、原理（空间换 DOM）、注意点（定高是简化版，动态高度需缓存测量值——原理段简述思路）。

- [x] **Step 3: 走查验证**：滚动流畅无白屏、渲染节点数恒定在 30 左右、快速滚动不错位、type-check/lint 通过

- [x] **Step 4: Commit**

### Task 11: 案例 watch-traps（watch/watchEffect 陷阱）

**Files:**
- Create: `src/examples/vue3/watch-traps/{Demo.vue, meta.ts, code/usage.ts.txt}`

- [x] **Step 1: 写 Demo.vue**

三个并排实验区，各自带源码内联小注释与操作按钮：
1. **reactive 对象深层属性**：直接 `watch(obj, ...)` 不加 `deep` 时修改嵌套属性不触发；对比加 `deep: true` 后触发次数
2. **watchEffect 的依赖收集**：条件分支切换后不再收集的依赖失效演示（`if (enabled.value) watch 深层`），并演示 `onCleanup` 取消过期异步
3. **flush 时机**：`flush: 'sync'` vs 默认 `'pre'` vs `'post'`，用一个输入框 + 日志展示读取 DOM 更新状态的差异
每个实验区有「重置」按钮，日志面板实时打印触发记录（含时间戳）。

- [x] **Step 2: 写 code/usage.ts.txt 与 meta.ts**

片段分三段对应三个陷阱，逐行注释。notes：适用场景（响应式调试）、原理（依赖收集与触发模型）、注意点（deep 的性能代价、watchEffect 清理函数、解构丢响应用 toRefs）。

- [x] **Step 3: 走查验证**：三个实验行为符合预期、重置可用、type-check/lint 通过

- [x] **Step 4: Commit**

### Task 12: 案例 async-suspense（异步组件与 Suspense）

**Files:**
- Create: `src/examples/vue3/async-suspense/{Demo.vue, meta.ts, code/usage.ts.txt}`

- [x] **Step 1: 写 Demo.vue**

用 `defineAsyncComponent` 包装一个模拟慢加载子组件（返回 Promise，可控延迟/失败）：
- 加载中显示 `#fallback` 骨架屏（简单灰块脉动）
- 控制面板：延迟时长滑块、「模拟加载失败」开关、「重试」按钮（`onErrorCaptured` 捕获后重置组件 key 重试）
- 演示 `loadingComponent`/`errorComponent`/`delay`/`timeout`/`defsult` 配置项各自动效
说明区旁演示 `Suspense` 的 `suspensible` 与嵌套行为简例。

- [x] **Step 2: 写 code/usage.ts.txt 与 meta.ts**

片段讲清：`defineAsyncComponent({ loader, loadingComponent, errorComponent, delay, timeout })` 标准工厂、失败重试模式（改 key）。notes：适用场景（路由级代码分割、重组件延迟加载）、原理（动态 import + 组件状态机）、注意点（Suspense 在 Vue 3 仍标 experimental、timeout 到期抛错走 errorComponent）。

- [x] **Step 3: 走查验证**：骨架屏→内容切换顺滑、失败→错误组件→重试成功、type-check/lint 通过

- [x] **Step 4: Commit**

### Task 13: 案例 reactive-inject（响应式依赖注入）

**Files:**
- Create: `src/examples/vue3/reactive-inject/{Demo.vue, meta.ts, code/usage.ts.txt}`

- [x] **Step 1: 写 Demo.vue**

三层嵌套组件结构（Parent → Child → GrandChild，文件内多组件定义或同目录小组件）：顶层用 `provide('theme', themeRef)` 注入主题（亮/暗/跟随系统三态），底层任意组件 `inject` 后可切换；演示 `computed` 包装的只读注入（`provide` 传 `computed(() => ...)` 防止底层篡改计数上限）、`Symbol` key 防污染、`readonly()` 包裹的注入对象写警告。侧栏显示每层组件的「谁在读/谁在写」日志。

- [x] **Step 2: 写 code/usage.ts.txt 与 meta.ts**

片段讲清：provide/inject 基本配对、响应式保证（传 ref/computed 不要解构）、Symbol key、readonly 边界。notes：适用场景（组件库底层、主题/多语言/当前用户跨层传递）、原理（组件树依赖注入 vs prop 逐层透传）、注意点（provide 在 setup 同步执行、key 用 InjectionKey 类型）。

- [x] **Step 3: 走查验证**：底层切换顶层状态同步、只读注入写入无效且警告、type-check/lint 通过

- [x] **Step 4: Commit**

### Task 14: 收尾走查

**Files:**
- Modify: 按走查发现的问题修复

- [x] **Step 1: 全量质量门**

Run: `npm run type-check && npm run lint && npx vitest run`
Expected: 全部通过

- [x] **Step 2: 全站手工走查清单**

- 首页 8 张案例卡片全部可点进对应页
- 每个案例页：演示可交互、核心代码 tab 切换与复制、完整源码 tab 显示 Demo.vue、三段说明渲染正常、代码注释为中文
- 搜索「性能」「observer」「watch」各命中预期结果；空搜索显示空状态
- 暗色模式全站走一遍（含代码高亮颜色跟随）、刷新保持
- 浏览器后退/前进在案例间导航正常；不存在的案例 URL 显示空状态不白屏

- [x] **Step 3: 修复走查问题，更新 `AGENTS.md`，提交打 tag**

按 Step 2 清单修复所有发现的问题；「当前进度」段更新为：P0 八案例全部完成；「决策记录」补齐走查中的取舍。打里程碑 tag 并推送：

```powershell
git add -A; git commit -m "fix: polish issues from full site walkthrough"
git tag v0.1; git push origin main --tags
```
