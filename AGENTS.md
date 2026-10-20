# AGENTS.md — Vue 3 案例库项目记忆

> 本文件是跨设备、跨会话的记忆载体。每次会话自动加载；每完成一个任务、每做一个重要决策，必须顺手更新「当前进度」与「决策记录」。

## 项目速览

- **定位**：本地运行的 Vue 3 高级案例速查站——分类导航 + 搜索，每个案例含可交互演示、带中文注释的核心代码、可下钻完整源码，以及站外查阅的 `notes.md` 五段式原理资料（私人收藏用）
- **技术栈**：Vite + Vue 3.5（`<script setup lang="ts">`）+ TypeScript strict + Sass（SCSS，CSS 变量主题）+ Vue Router + highlight.js + marked + vitest；包管理 npm
- **常用命令**：
  - `npm run dev` — 启动开发服务器
  - `npm run type-check` — vue-tsc 类型检查
  - `npm run lint` — ESLint 检查
  - `npx vitest run` — 运行测试
- **远程仓库**：https://github.com/qindaxiaya/vue3-case-lab（私有），单 `main` 分支线性提交

## 约定

- 全程中文界面、中文说明文案；变量/函数/文件名英文
- **站点自身全部代码写中文注释**（组件/composable/工具/路由），关键逻辑逐行注释「做什么、为什么」，与案例代码同等标准
- TS strict，禁止 `any`（确需时用 `unknown` + 收窄）；ESLint `no-explicit-any` 为 error
- 组件 `<script setup lang="ts">`，组件 PascalCase，文件 kebab-case
- 禁止第三方 UI 组件库、禁止 Pinia；样式用 Sass（SCSS）+ CSS 变量主题，自建全局类 `btn-primary`/`btn-ghost`/`card`/`tag`，案例 Demo 用自身 scoped SCSS
- 暗色模式：`.dark` class 策略（`<html class="dark">`，index.html 内联脚本防闪白）+ `localStorage` 键 `moyu-theme` 持久化
- 案例目录结构（新增案例零注册成本）：
  ```
  src/examples/<category>/<case-id>/
  ├── Demo.vue        # 可交互演示（scoped SCSS、内部关键逻辑中文注释、不引用站点内部组件）
  ├── meta.ts         # default export 满足 CaseMeta（title/难度/tags/summary/sell/explain）
  ├── notes.md        # 五段式案例资料（不参与 registry、不展示；模板见 docs/templates/notes.md）
  └── code/*.txt      # 带逐行中文注释的教学代码；多演示时按 <演示key>.*.txt 命名
  ```
- **案例完成标准（2026-10-20 用户拍板）**：`docs/case-definition-of-done.md` 为唯一验收源，覆盖 Demo 稳定性、错误/正确对比、真实测量、notes 五段、meta.sell、375px、类型与工程。新案例严格执行，存量按批次渐进补齐；豁免必须写进 notes.md 第 5 段。
- **框架与案例抽离（2026-10-19 用户拍板）**：
  1. 站点框架（CasePage/CodeWorkbench/registry/router 等）保持通用稳定，**不得为单个案例特化框架代码**
  2. 案例差异全部收在案例目录内自包含（Demo/meta/code）；框架只认通用约定
  3. **一个案例一个演示**（2026-10-20 用户拍板）：原先「多演示 tab」的案例已拆分（raf-loop → raf-loop + raf-throttle），新案例遇到两套对照场景直接建两个案例；框架仍保留 Demo emit `tabs` + prop `demoActive` 的兼容机制，但不再作为新案例的推荐写法
- **不造轮子（2026-10-19 用户拍板）**：
  1. 工程实践类案例优先用现成库/原生 API（VueUse、fuse.js 等），**不手写已解决的通用工具**（debounce/throttle/深拷贝等）——案例代码应贴近真实项目写法
  2. 原生浏览器 API（canvas/Worker/Clipboard/EyeDropper/Observer 系）不算造轮子，直接演示
  3. 第三方 UI 组件库仍禁用；Toast 这类「教学如何做组件」的案例除外（注明真实项目可用 vue-toastification 等）
- 案例分类：`performance`（性能监控）、`observer`（观察者）、`virtual`（虚拟渲染）、`vue3`（Vue 3 API）、`composables`（组合式函数）、`practice`（工程实践）
- Commit：Conventional Commits + 中文描述；每任务收尾必 commit
- **工作节奏（2026-10-19 用户拍板）**：
  1. 做完一个任务/一个案例必须停下，等用户检查确认后才继续下一步
  2. 有页面变化时必须给出 dev 地址（`http://localhost:5173/`）供用户查看
  3. git 分步提交：一个任务/一个逻辑单元一个 commit，不攒大提交
- **完成前强制验证清单（2026-10-19 教训固化，每个任务/案例收尾必跑）**：
  1. 按 `docs/case-definition-of-done.md` 逐条验收（Demo 稳定性 / 对比开关 / 实测数据 / notes 五段 / meta.sell / 375px）
  2. `npx vitest run`（含真实 glob 收录链路集成测试——新增案例会自动扩展验证）
  3. `npm run type-check`、`npm run lint`、`npm run build`
  4. dev 页面实测：案例页可交互、刷新无控制台告警、路由往返状态正确
  5. 有页面交互变化时，dev 地址交用户人工走查（机器验证不能替代）
  6. 未跑完清单不得宣称"完成"；宣称前先有 fresh 证据（verification-before-completion skill）
- 每任务收尾必更新本文件「当前进度」段；重大取舍记入「决策记录」

## 当前进度

- **阶段**：共 55 案例 / 6 分类（composables 1 · observer 4 · virtual 2 · performance 10 · vue3 16 · practice 22）；「不造轮子」「框架案例抽离」「一案例一演示」约定已固化
- 计划：`docs/superpowers/plans/2026-10-16-vue3-case-library.md`（14 个任务）
- 设计文档：`docs/superpowers/specs/2026-10-16-vue3-case-library-design.md`（P0+P1 案例清单）
- 需求来源：`E:\MyProject\myProject\vue3-case-library-spec.md`（38 案例清单，用户要求全部实现）
- 已完成：
  - ✅ 设计文档 + 实施计划 + GitHub 私有仓库（qindaxiaya/vue3-case-lab）
  - ✅ Task 1~4 脚手架/注册表/站点壳/案例页双 tab 工作台
  - ✅ P0 八案例：perf-observer / raf-loop / idle-schedule / lazy-image / virtual-list / watch-traps / async-suspense / reactive-inject
  - ✅ P1 七案例：infinite-scroll / resize-observer / mutation-observer / shallow-markraw / v-memo / teleport-layer / use-event-listener
  - ✅ 工程实践八案例：debounce-throttle（VueUse）/ command-palette（fuse.js）/ toast-queue / web-worker（Blob Worker）/ json-viewer / image-compress（canvas toBlob）/ ripple-button（WAAPI）/ color-picker（EyeDropper）
  - ✅ 分类 composables + practice；registry 排序复用 categories.ts（新增分类只改一处）
  - ✅ landing 首页 + 信息架构精简（无侧边栏）+ 页面宽度根因修复
  - ✅ spec 扩展批 1（vue3 5）：reactive-loss / computed-cache / effect-scope / define-model / multi-v-model
  - ✅ spec 扩展批 2（vue3 5）：recursive-tree / custom-directives / teleport-modal / theme-switch / editable-table
  - ✅ spec 扩展批 3（practice 6）：pinia-store（reactive 等效实现）/ route-rbac / keep-alive-lru / route-transition / history-guard / i18n-lazy
  - ✅ spec 扩展批 4（virtual 1 + performance 5）：virtual-variable / chat-scroll / time-slicing / pull-refresh / typewriter-stream / sse-chat
  - ✅ spec 扩展批 5（practice 文件能力 4）：file-preview / pdf-preview（手写 PDF 1.4）/ file-upload / chunk-upload
  - ✅ spec 扩展批 6（practice 5）：drag-sort / slider-captcha / tracking-sdk / vite-split / vitest-gate
- ✅ 2026-10-20 质量批次 1：完成标准 DoD + notes 模板落盘；CaseMeta 增加 `sell`，54 个案例一次补齐
- ✅ 2026-10-20 质量批次 2：路由切换重置演示状态；暗色代码主题改用 `?url` 导入并验证构建产物（github-dark css 1.06 kB）
- ✅ 2026-10-20 质量批次 3：详情页返回按钮 + 滚动位置恢复、列表筛选会话内保留、搜索跨页跳转、筛选自动校正、主题持久化不覆盖「跟随系统」、375px 顶栏收缩
- ✅ 2026-10-20 详情页说明改 SBAC（场景/背景/做法/结论），54 个案例全部补齐；源码区默认收起，先看演示与说明
- ✅ 2026-10-20 质量批次 4：修正 pinia（重复 store 名）/ history-guard（allowed、二次 popstate）/ route-rbac（user、computed）/ route-transition（direction）/ keep-alive-lru（ref）教学代码
- ✅ 2026-10-20 质量批次 5：4 个新案例 notes 五段 + 实测（time-slicing 切片/全量、virtual-variable DOM 9/2000、chat-scroll 未读/吸底、pull-refresh 刷新/加载）+ 375px 与刷新验收
- ✅ 2026-10-20 质量批次 6：其余 50 个存量案例 notes.md 五段补齐（54/54 全覆盖）；全部含现象/SBAC 式原理/关键代码/实测或行为指标/追问边界；脚本校验 54 篇均含 1~5 段；vitest 18/18、type-check、lint、build 通过
- ✅ 2026-10-20 说明区改为「说明 / 源码」tab 组，默认说明，源码默认隐藏；raf-loop 拆为逐帧动画 + 逐帧合并高频渲染（共 55 案例）
- ✅ 2026-10-20 顶栏搜索改为全局弹窗：半透明遮罩 + 实时结果卡片，支持 Ctrl/Cmd+K、上下键、回车直达详情；列表页回归纯分类筛选
- 待做：质量批次 7（说明/源码 tab 走查 + 新增 raf-throttle 验收）→ Task 14 收尾走查（全站手工清单 + 搜索/暗色/导航回归）→ tag v0.1
- dev 地址：`http://localhost:5173/`，列表 `/cases`，案例页 `/cases/performance/perf-observer`

## 决策记录

| 日期 | 决策 | 说明 |
|------|------|------|
| 2026-10-16 | 视觉走大众文档站风格 | 参照 VueUse / Element Plus 文档站观感，遵循 Token 表 |
| 2026-10-16 | 单 main + 多设备 git 同步 | 不建 feature 分支；里程碑 tag v0.1 / v0.2 |
| 2026-10-16 | 代码高亮 highlight.js（github / github-dark 主题） | 零构建配置、体积小、离线可用 |
| 2026-10-19 | **样式弃 Tailwind，改用 Sass + CSS 变量** | 用户拍板；Sass 组织嵌套/mixin，CSS 变量承载主题（`.dark` 切换），案例不依赖构建插件 |
| 2026-10-19 | **站点自身代码必须写中文注释** | 用户要求；与案例代码同等标准（关键逻辑逐行注释） |
| 2026-10-19 | GitHub 仓库用 gh CLI 方式接入 | 仓库 qindaxiaya/vue3-case-lab（私有），中途修复过 token scope 问题（重新 gh auth login） |
| 2026-10-19 | **工作节奏：每任务一停、给 dev 地址、分步 commit** | 用户拍板；做完等检查确认再继续，页面变化必须给地址，一个任务一个 commit |
| 2026-10-19 | **完成前强制验证清单固化** | 用户发现"没有案例"暴露检查盲区（单测用内联数据绕过真实 glob、HTTP 200 ≠ 渲染正确）；清单见「约定」段，宣称完成前必跑 |
| 2026-10-19 | **删侧边栏：列表页全宽 + 分类筛选 chips** | 用户反馈侧边栏不好看也不要了；顶栏加「案例」nav，详情页面包屑返回 |
| 2026-10-19 | **案例说明三行化 + Demo 保留实时面板** | 用户反馈说明太长没兴趣看、看不到重点；notes 每段 ≤3 行，仅关键坑用 callout；Demo 日志/sparkline 保留（用户未要求删） |
| 2026-10-19 | 按钮类必须显式覆盖全局 a 样式 | RouterLink 用作按钮时 `a:hover` 的下划线/链接色会覆盖按钮样式——`.btn-primary:hover` 须显式 `color:#fff; text-decoration:none` |
| 2026-10-19 | **框架与案例抽离** | 案例差异全部收在案例目录内自包含；多演示通用约定（emit `tabs` + `demoActive` + code `<key>.*.txt` 过滤），新案例用约定不改框架 |
| 2026-10-19 | **不造轮子** | 工程实践案例优先现成库/原生 API（VueUse/fuse.js 已装），不手写已解决的通用工具；UI 库仍禁（Toast 教学案例除外）；原生浏览器 API 不算造轮子 |
| 2026-10-20 | **spec 38 案例全部实现（扩到 54）** | 用户"都需要实现做一下"；按 6 批实现（vue3 10 / practice 15 / virtual 1 / performance 5），每批一 commit |
| 2026-10-20 | **Pinia 案例不装 Pinia** | 站点自定「禁止 Pinia」；用 20 行 reactive 实现等效 store，代码区展示真实 Pinia 写法并注明差异 |
| 2026-10-20 | **路由类案例用模拟状态机** | pinia-store/route-rbac/keep-alive-lru/route-transition/history-guard 不接真实 router，在 Demo 内模拟；keep-alive-lru 用真实 `<KeepAlive :max="2">` |
| 2026-10-20 | **PDF 案例手写最小 PDF 1.4** | 不引入 pdf-lib；用 Helvetica 内置字体（仅 ASCII）+ 精确 xref 偏移生成多页 PDF，代码区说明生产环境选型 |
| 2026-10-20 | **说明型案例也做交互** | vite-split 用勾选估算体积，vitest-gate 用「模拟 CI 运行 + 注入失败」；不做纯文字页 |
| 2026-10-20 | **SFC 顶层注释禁止出现 `<Tag>`** | 顶层 `//` 注释里的 `<KeepAlive>`/`<Transition>` 会被当模板标签 → "Element is missing end tag"；用纯文字描述 |
| 2026-10-20 | **禁止用 PowerShell Set-Content 写源码** | 默认 ANSI 会吞换行/毁中文（本会话踩过，靠 git checkout 恢复）；统一用 write/edit 工具 |
| 2026-10-20 | **案例完成标准 DoD 固化** | 7 类标准写入 `docs/case-definition-of-done.md`：Demo 稳定性、错误/正确对比、真实测量、notes 五段、meta.sell、375px、类型与工程；新案例严格执行、存量渐进；豁免写 notes 第 5 段 |
| 2026-10-20 | **notes.md 五段式，且不接入页面** | 现象/场景 → 原理 → 关键代码（标 3 处为什么）→ 数据对比（实测+方法）→ 追问与边界；作为案例资料存放在案例目录，不参与 registry；非性能案例第 4 段允许行为指标替代 |
| 2026-10-20 | **CaseMeta 增加 sell 必填** | ≤30 字，包含「解决什么问题 + 为什么选它」，20 秒可口述；54 个存量 meta 一次补齐 |
| 2026-10-20 | **案例说明统一 SBAC 四段** | 场景（新手真实遇到）/ 背景（大白话讲原理）/ 做法（案例怎么解决）/ 结论（记住什么、何时用）；写在 meta.explain，每段 1–3 句、少术语多类比；54 个案例全部补齐，未填时回退到 sell + 代码要点 |
| 2026-10-20 | **详情页源码默认收起** | 先看演示与 SBAC 说明，需要时再展开；避免一进页就被几百行代码劝退 |
| 2026-10-20 | **说明与源码合并为 tab 组，默认说明** | 两个标签同一 tab 组（role=tablist/tabpanel）切换，替代「展开源码」按钮；切换案例时重置回说明 |
| 2026-10-20 | **一案例一演示：多演示拆成独立案例** | raf-loop 拆为 raf-loop（逐帧动画）+ raf-throttle（逐帧合并高频渲染），代码文件随案例拆分；框架保留 emit `tabs` 兼容机制，新案例不再使用 |
| 2026-10-20 | **顶栏搜索改为全局弹窗** | 点击搜索框或 Ctrl / Cmd + K 打开半透明遮罩弹窗；输入实时过滤标题/摘要/标签，结果卡片展示标题/分类/难度/摘要，上下键 + 回车或点击直达详情；打开时锁页面滚动，Esc / 点遮罩关闭；列表页恢复为纯分类筛选 |
