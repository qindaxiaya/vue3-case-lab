# Vue 3 高级案例库 — 设计文档

日期：2026-10-16
状态：待用户批准

## 1. 意图与背景

用户是前端开发者，希望拥有一个**私人收藏查阅**的 Vue 3 案例库，用于：

- 查阅「看起来比较高级、实际常用」的 Web API 与 Vue 3 高级用法
- 每个案例必须有**可交互的演示效果**（注重演示）
- 配套**核心代码**（可复制）与**中文原理说明**

收录范围（已与用户确认）：

- 浏览器高级 API：PerformanceObserver、IntersectionObserver、ResizeObserver、MutationObserver、requestIdleCallback、requestAnimationFrame 等
- 性能方案：虚拟渲染、性能监控面板
- Vue 3 高级 API：响应式进阶、组合式函数封装、异步组件、Teleport、provide/inject、v-memo 等

优先级：**性能监控面板类案例打头**，Vue 3 API 案例穿插其中。

## 2. 目标 / 非目标

### 目标

- G1：本地 Vite 开发服务器运行，打开即查，检索快（分类导航 + 搜索）
- G2：每个案例 = 可交互演示 + 核心代码（高亮、可复制、**带逐行/逐段中文注释**）+ 中文说明
- G2a：代码区提供「完整案例源码」查看入口（Demo.vue 全文），核心片段看不懂时可下钻到源码；说明文字与代码行呼应，把「为什么这么写」解释明白
- G3：案例代码本身是最佳实践范本（TS strict、组合式 API、`<script setup>`）
- G4：案例可按分类/标签扩展，新增案例成本低（约定目录结构即可）
- G5：暗色模式（class 策略 + localStorage 持久化）

### 非目标

- N1：不做在线代码编辑/沙箱运行（演示是预写好的组件，不是用户输入的代码）
- N2：不做 SSR/部署上线要求（`npm run build` 可用即可，主要在 dev 下使用）
- N3：不追求案例数量大而全，宁缺毋滥，只收「高级感 + 常用」
- N4：不做移动端优先适配（桌面查阅为主，小屏布局不烂即可）

### 反目标（做了算失败）

- A1：不引入任何第三方 UI 组件库（Element Plus / Naive UI 等），全部自行编写
- A2：不引入重型状态管理（无需 Pinia，站点级状态极少）
- A3：说明文字不说废话，不写「Vue 是一个渐进式框架」这类内容

## 3. 技术选型（builder's call，含理由）

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 构建 | Vite（Vue 3 + TS + Router） | 用户技术栈首选 |
| 语言 | TypeScript strict | 用户规范 |
| 样式 | Sass（SCSS 语法）+ CSS 变量（2026-10-19 用户拍板：不用 Tailwind） | Sass 变量/嵌套/mixin 组织样式，CSS 变量承载主题 token；暗色模式切换 `.dark` 类下变量值，案例不依赖 Tailwind 构建插件 |
| 代码高亮 | highlight.js（异步按需加载语言） | 零构建配置、体积小、离线可用、支持 vue/ts/js/css/json/html；shiki 效果更好但配置重，速查场景性价比低 |
| 说明渲染 | marked（渲染 meta 中的 Markdown 说明段） | 说明需要列表/强调等排版，纯结构化字段表达力不够；marked 极轻 |
| 搜索 | 客户端内存过滤 | 案例量在 50 以内，无需任何搜索库 |
| 状态 | `ref` + provide/inject + localStorage | 仅暗色模式与侧边栏折叠两类站点状态 |

## 4. 信息架构与站点结构

```
┌────────┬──────────────────────────────────────┐
│ 侧边栏  │  顶栏：标题 / 搜索框 / 暗色切换        │
│        ├──────────────────────────────────────┤
│ 分类    │  案例页：                             │
│ ├ 案例 │   标题 + 难度/标签                     │
│ ├ 案例 │   ① 演示区（可交互，卡片容器）          │
│ └ …    │   ② 核心代码（Tab 多文件 + 复制按钮）   │
│        │   ③ 说明（Markdown：用途/原理/注意点）  │
└────────┴──────────────────────────────────────┘
```

- 路由：`/c/:categoryId/:caseId`，`/` 重定向到精选案例（性能监控面板）
- 侧边栏按分类分组，分类顺序即学习/查阅顺序
- 顶栏搜索：按标题、标签、描述即时过滤，结果显示在侧边栏

## 5. 案例目录约定（扩展成本低的关键）

```
src/examples/<category>/<case-id>/
├── Demo.vue        # 可交互演示组件（唯一被站点加载运行的文件）
├── meta.ts         # 元数据：标题、难度、标签、说明（Markdown）
└── code/
    ├── usage.vue.txt      # 演示对应的核心代码（?raw 导入展示）
    └── composable.ts.txt  # 可选：相关封装/进阶代码
```

- `code/*.txt` 用 Vite `?raw` glob 导入，保证展示代码与站点解耦、可独立复制
- **核心代码书写规范（硬性要求）**：
  - 必须带中文注释，关键 API 调用逐行注释「这行在干什么、为什么这么写」
  - 片段是「提炼后的教学代码」，可比 Demo.vue 更精简，但变量名与 Demo.vue 保持一致，便于对照
  - 禁止无注释的裸代码块；单个片段超过 60 行时按逻辑分段（`// --- 步骤一：xxx ---`）
- **完整源码下钻**：CodeWorkbench 提供「完整源码」tab，通过 `?raw` 直接导入 `Demo.vue` 全文（含其内部注释），解决「片段看不懂想看全貌」的场景
- **说明与代码呼应**：`notes` 的「原理」段落按核心代码的逻辑分段组织，每段对应一个代码片段/步骤，讲清「为什么」而不复述「是什么」
- `meta.ts` 导出 `CaseMeta` 接口数据；站点用 `import.meta.glob` 自动发现全部案例，**新增案例 = 新建目录，零注册成本**
- 演示组件不引用站点内部组件与样式（样式用自身 scoped SCSS），保持案例独立可搬运

```ts
// meta.ts 形态
export default {
  id: 'perf-observer',
  title: 'PerformanceObserver 性能监控面板',
  difficulty: 'advanced',          // beginner | intermediate | advanced
  tags: ['PerformanceObserver', 'LCP', 'CLS', 'INP'],
  summary: '用 PerformanceObserver 搭一个实时性能指标面板',
  notes: {
    usage: '## 适用场景\n...',    // Markdown
    principle: '## 原理\n...',
    caveats: '## 注意点\n...',
  },
} satisfies CaseMeta
```

## 6. 首批案例清单

### P0（首批实现，8 个）

| # | 分类 | 案例 | 涉及 API | 演示效果 |
|---|------|------|----------|----------|
| 1 | 性能监控 | PerformanceObserver 面板 | PerformanceObserver, web-vitals 指标 | 实时显示 FP/FCP/LCP/TTFB/CLS/INP，触发按钮制造 CLS/长任务 |
| 2 | 性能监控 | requestAnimationFrame 渲染循环 | rAF, 时间轴控制 | 可启动/暂停的动画循环，显示帧率与回调耗时 |
| 3 | 性能监控 | requestIdleCallback 空闲调度 | rIC, postTask | 对比「立即执行 vs 空闲执行」对首屏交互的差异，进度可视化 |
| 4 | 观察者 | 图片懒加载 | IntersectionObserver | 滚动加载图片（占位色块模拟），显示进入视口回调日志 |
| 5 | 虚拟渲染 | 定高虚拟列表 | 虚拟滚动原理, rAF | 10 万行数据流畅滚动，显示渲染节点数/内存占用对比 |
| 6 | Vue 3 API | watch/watchEffect 陷阱 | watch, watchEffect, deep, flush | 交互演示深度侦听、副作用清理、flush 时机差异 |
| 7 | Vue 3 API | 异步组件与 Suspense | defineAsyncComponent, Suspense | 骨架屏切换、失败重试、超时配置演示 |
| 8 | Vue 3 API | 响应式依赖注入 | provide/inject, readonly, 任意层级 | 主题/状态跨 3 层组件传递与响应式更新演示 |

### P1（后续迭代，7 个）

| # | 分类 | 案例 | 涉及 API |
|---|------|------|----------|
| 9 | 观察者 | 无限滚动加载 | IntersectionObserver |
| 10 | 观察者 | 容器尺寸监听 | ResizeObserver |
| 11 | 观察者 | DOM 变更监听 | MutationObserver |
| 12 | Vue 3 API | shallowRef/markRaw 性能边界 | shallowRef, markRaw, triggerRef |
| 13 | Vue 3 API | v-memo 渲染优化 | v-memo, patch flag 概念 |
| 14 | Vue 3 API | Teleport 弹层管理 | Teleport, 多层 z-index |
| 15 | 组合式函数 | useEventListener/useRafFn 封装范式 | 组合式函数生命周期自动清理 |

## 7. 视觉设计（用户拍板：大众文档站观感）

### 设计定位

标准技术文档站风格（参照 VueUse / Element Plus 文档站的普遍观感），不追求特立独行。熟悉、易读、信息清晰即可。

### 设计 Token（CSS 变量，定义在 `:root` 与 `.dark`）

**色彩**：

| Token（CSS 变量） | 浅色 | 暗色 | 用途 |
|-------|------|------|------|
| `--bg` | `#F9FAFB` | `#111827` | 页面底 |
| `--surface` | `#FFFFFF` | `#1F2937` | 卡片/面板 |
| `--text` | `#111827` | `#F9FAFB` | 正文 |
| `--primary` | `#4F46E5` | `#818CF8` | 品牌/链接/当前导航/按钮 |
| `--border` | `#E5E7EB` | `#374151` | 边框/发丝线 |
| `--radius-card` | `1rem` | 同 | 圆角 2xl |
| `--radius-btn` | `0.75rem` | 同 | 按钮圆角 |
| `--shadow-soft` | `0 1px 3px rgb(0 0 0 / 0.08)` | 暗色用更深阴影 | 浅阴影 |

语义色（green/red/yellow）同样定义为变量，用于状态提示。

**字体**：

| 角色 | 字体 |
|------|------|
| 正文/标题 | 系统 sans 栈（含 Noto Sans SC），无衬线通吃 |
| 代码/指标 | 系统 mono 栈（ui-monospace / JetBrains Mono 可选） |

**代码高亮**：浅色 `github`、暗色 `github-dark`。

### 布局（标准文档站三栏）

```
┌─────────┬───────────────────────────────────────┐
│ 顶栏：站点名 · 搜索框 · 暗色切换                    │
├─────────┼───────────────────────────────────────┤
│ 侧边栏   │  案例标题 + tag 标签                     │
│ 分组导航 │  ┌───────────────────────────────┐     │
│ ├ 案例  │  │ 演示卡片（标准 card 样式）         │     │
│ └ …    │  └───────────────────────────────┘     │
│         │  代码区（tab + 复制按钮）                 │
│         │  说明区（Markdown 正文）                 │
└─────────┴───────────────────────────────────────┘
```

### 原则

1. 标准卡片：圆角 2xl、浅阴影 shadow-soft、hover 提升——Sass 自建 `card` 等类
2. 指标数据用 mono 字体 + 语义色区分状态，不做夸张的仪表式大数字
3. 动效：卡片 hover 提升、按钮过渡、页面切换 fade；尊重 `prefers-reduced-motion`
4. 暗色模式 class 策略 + localStorage 持久化
5. 全中文文案、语义化 HTML、键盘焦点可见、emoji `aria-hidden`

### 组件清单

- 站点级（`src/components/`）：`AppSidebar.vue`、`AppHeader.vue`、`CaseDemoCard.vue`、`CodeWorkbench.vue`、`CaseNotes.vue`、`SearchBox.vue`、`ThemeToggle.vue`
- `CodeWorkbench.vue`：highlight.js 高亮 + 复制按钮 + 多文件 tab；tab 分两组——「核心代码」（`code/*.txt`）与「完整源码」（`Demo.vue` 全文，只读展示）
- 自建类：`btn-primary` / `btn-ghost` / `card` / `tag`（浅/暗双模式，SCSS 全局类，参考 §7 Token 表）
- 可访问性：语义化标签、`aria-current`、emoji `aria-hidden`、键盘焦点可见

## 8. 约束

- 全程中文界面与说明；变量/函数名英文
- Vue 3 `<script setup lang="ts">` + strict TS
- 样式：Sass（SCSS）+ CSS 变量主题（2026-10-19 拍板，弃 Tailwind）
- **代码注释（2026-10-19 用户要求）**：站点自身全部代码（组件、composable、工具函数、路由等）必须写中文注释，与案例代码同等标准；关键逻辑逐行注释「做什么、为什么」，复杂分支/步骤加分段注释
- 包管理：npm
- 目录：`E:\MyProject\moyu`（当前为空目录）

### Git 工作流（用户拍板）

- 单 `main` 分支线性提交，不建 feature 分支
- Conventional Commits + 中文描述（`feat(case): 添加虚拟列表`）
- 里程碑打 tag：`v0.1` = P0 八案例齐、`v0.2` = P1 齐
- **多设备同步**：建远程私有仓库（GitHub 或 Gitee，待定），工作电脑 push、家庭电脑 pull；会话记忆通过 repo 内文件延续

### 记忆与多设备延续（用户拍板）

- 项目根维护 `AGENTS.md`：项目速览、约定、**当前进度**、**决策记录**——opencode 每次会话自动加载
- 约定：每完成一个任务、每做一个重要决策，必须顺手更新 `AGENTS.md` 的进度/决策段（各任务收尾动作）
- 家庭电脑开工流程：clone → 装 opencode 与 skills → 复制 `~/.claude/CLAUDE.md` → 开会话「读 AGENTS.md 与计划继续执行」
- 会话聊天记录仅存本地不可迁移；`AGENTS.md` + `docs/superpowers/` 即跨设备记忆载体

## 9. 交付物与验收

1. 可运行的 Vite 项目（`npm run dev` 启动）
2. P0 全部 8 个案例：演示可交互、核心代码带中文注释且可复制、可查看 Demo.vue 完整源码、说明为中文 Markdown 且与代码分段呼应
3. 分类导航 + 搜索 + 暗色模式可用
4. `npm run type-check` 与 `npm run lint` 通过（create-vue 默认脚本）

## 10. 留给 builder 的决定（已自行拍板）

- highlight.js 主题：浅色用 github、暗色用 github-dark
- 帧率/耗时等演示数据的展示形式：演示卡片内小型 stat 行，不另起图表库
- 搜索匹配规则：标题/标签/描述的大小写不敏感子串匹配
- P1 案例不在首批实现范围内，但目录约定需支持后续低摩擦添加
