# AGENTS.md — Vue 3 案例库项目记忆

> 本文件是跨设备、跨会话的记忆载体。每次会话自动加载；每完成一个任务、每做一个重要决策，必须顺手更新「当前进度」与「决策记录」。

## 项目速览

- **定位**：本地运行的 Vue 3 高级案例速查站——分类导航 + 搜索，每个案例含可交互演示、带中文注释的核心代码、可下钻完整源码，以及详情页「深入」tab 的五段式原理资料（`notes.md` 懒加载）
- **技术栈**：Vite + Vue 3.5（`<script setup lang="ts">`）+ TypeScript strict + Sass（SCSS，CSS 变量主题）+ Vue Router + highlight.js + marked + vitest；包管理 npm
- **常用命令**：
  - `npm run dev` — 启动开发服务器
  - `npm run type-check` — vue-tsc 类型检查
  - `npm run lint` — ESLint 检查（全量，收尾/合并前用）
  - `npx eslint <改动文件> --max-warnings 0` — 只查改动文件（L0/L1 默认用法）
  - `npx vitest run` — 运行测试
  - `npm run check:ui` — 浏览器端验收（headless Chrome，需先 `npm run build` + `npm run preview`）；页面交互只能用它，不要临时写 Chrome 脚本
  - `npm run check:ui -- --only 抽屉` — 只验一个场景（名字或路由命中，5~10 秒）；改单个案例默认用它，`--base http://localhost:5173` 可直接验 dev
- **远程仓库**：https://github.com/qindaxiaya/vue3-case-lab（公开，2026-10-20 为启用 ruleset 由私有转公开），单 `main` 分支；合并必须走 PR + 必需检查

## 约定

- 全程中文界面、中文说明文案；变量/函数/文件名英文
- **Windows 中文乱码（2026-10-20 根治，2026-10-21 迁移 V2 插件格式）**：opencode 以 `-NoProfile` 启动 Windows PowerShell 5.1，控制台/管道默认 GBK(936)，而 opencode 按 UTF-8 解码，中文输出就成乱码。全局插件 `~/.config/opencode/plugins/utf8-encoding.ts` 现在必须是 V2 写法（`export default Plugin.define({ id, setup })` + `ctx.shell.hook("create.before")`），对 PowerShell 命令自动前置 `[Console]::OutputEncoding=...UTF8`；V1 的「返回 hook 对象」写法在 v2.1.1 会直接加载失败（日志 `Plugin must export a default definition ... Missing key at ["default"]`，即表现为乱码复发）。验证两条：`opencode api get /api/plugin` 出现 `utf8-encoding` 且 `state.status=active`；不带前缀跑中文命令能正常显示。`--pure` 模式不加载插件，必须手工加同样设置
- **站点自身全部代码写中文注释**（组件/composable/工具/路由），关键逻辑逐行注释「做什么、为什么」，与案例代码同等标准
- TS strict，禁止 `any`（确需时用 `unknown` + 收窄）；ESLint `no-explicit-any` 为 error
- 组件 `<script setup lang="ts">`，组件 PascalCase，文件 kebab-case
- 禁止第三方 UI 组件库、禁止 Pinia；样式用 Sass（SCSS）+ CSS 变量主题，自建全局类 `btn-primary`/`btn-ghost`/`card`/`tag`，案例 Demo 用自身 scoped SCSS
  - 例外（2026-10-28 换挡）：**Naive UI** 允许用于演示区控件（按钮 / 单选组 / 输入框 / 下拉 / 提示 message），必须按需引入（unplugin-vue-components + NaiveUiResolver），禁止整包 `app.use(naive-ui)`；主题映射收敛在 `src/composables/useNaiveTheme.ts`（浅/暗 token 镜像），演示区由**详情页 `CasePage` 统一包一层共享组件 `src/components/demo/DemoNaive.vue`**（abstract，不渲染 wrapper）——不要在站点壳（App.vue 等）包 provider，barrel import 会把整个 naive-ui 拉进首屏；Demo 是 provider 的子组件，案例里直接 `const message = useMessage()` 用 Naive 提示（顶部居中、max 3、2.4s），不要自建 toast；演示区一律优先用 Naive 组件（按钮 `n-button`、互斥组 `n-radio-group`）而不是自写样式；站点壳与教学型组件（Toast 教学案例 toast-queue / Teleport / 弹窗 / 可编辑表格 / 自定义指令等）仍自建；Pinia 仍禁止
- 暗色模式：`.dark` class 策略（`<html class="dark">`，index.html 内联脚本防闪白）+ `localStorage` 键 `moyu-theme` 持久化
- 案例目录结构（新增案例零注册成本）：
  ```
  src/examples/<category>/<case-id>/
  ├── Demo.vue        # 可交互演示（scoped SCSS、内部关键逻辑中文注释、不引用站点内部组件）
  ├── meta.ts         # default export 满足 CaseMeta（title/难度/tags/summary/sell/explain）
  ├── notes.md        # 五段式案例资料（详情页「深入」tab 懒加载；模板见 docs/templates/notes.md）
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
  3. UI 组件库仅允许 Naive UI 演示区控件（2026-10-28 换挡，按需引入）；Toast 这类「教学如何做组件」的案例仍自建（注明真实项目可用 vue-toastification 等）
- 案例分类：`performance`（性能监控）、`observer`（观察者）、`virtual`（虚拟渲染）、`vue3`（Vue 3 API）、`composables`（组合式函数）、`practice`（工程实践）
- Commit：Conventional Commits + 中文描述；每任务收尾必 commit
- **工作节奏（2026-10-19 用户拍板）**：
  1. 做完一个任务/一个案例必须停下，等用户检查确认后才继续下一步
  2. 有页面变化时必须给出 dev 地址（`http://localhost:5173/`）供用户查看
  3. git 分步提交：一个任务/一个逻辑单元一个 commit，不攒大提交
- **任务分级（2026-10-21 用户拍板，解决「改一个样式也要跑全量」）**：细则见 `docs/skills-and-subagents.md`
  1. **L0 微调**（单文件样式/文案/间距/颜色，无逻辑）：读片段 → 改 → `npx eslint <改动文件> --max-warnings 0` → dev 目视；不 brainstorm、不写计划、不 TDD、不派子代理、不跑 DoD/build/全量 vitest
  2. **L1 小功能**（单组件/单案例内交互，≤3 文件）：逻辑部分先写测试 → 相关 `npx vitest run` + `npm run type-check` + `npx eslint <改动文件> --max-warnings 0` → dev 走查 + 375px；不跑全量 build、不派子代理
  3. **L2 新案例/跨模块**（新案例、registry/router/构建配置、≥4 个逻辑文件（纯样式批量微调不算），或改动触及共享模块）：完整 DoD + 全量四项 + 人工走查，收尾可派 `verifier` / `case-reviewer` 子代理
  4. 技能按级别触发：L0/L1 不主动加载 `brainstorming` / `writing-plans` / `subagent-driven-development`；用户明确要求走完整流程时以用户指令为准
  5. 停等与提交仍按「工作节奏」：每个任务停下等确认、有页面变化给 dev 地址；连续同类微调可合并成一次确认与一个 commit
  6. **修复存量案例 bug = L1，且只验目标案例**（2026-10-22 用户要求）：读相关片段（不整文件通读）→ 最小探针确认根因（一次页面取值即可）→ 改 → `npx eslint <该案例目录> --max-warnings 0` + `npm run type-check` + `npm run check:ui -- --only <案例>`。**不跑 build / check:bundle / 全量 check:ui / 全量 lint**；根因确认后再决定要不要落常驻断言
  7. **影响面超过 1 个案例时先问**：例如「这个毛病 8 个案例都有，只修这一个还是统一改」，不默认扩张；文档（本文件）按批次收尾一次写，不逐条追加
- **完成前强制验证清单（2026-10-19 教训固化；2026-10-21 收敛：完整清单只用于 L2 新案例/跨模块，L0/L1 按上方分级与影响面验证）**：
  1. 按 `docs/case-definition-of-done.md` 逐条验收（Demo 稳定性 / 对比开关 / 实测数据 / notes 五段 / meta.sell / 375px）
  2. `npx vitest run`（含真实 glob 收录链路 + 内容质量门禁：SBAC 四段齐全 / 卖点≤30 字、摘要≤40 字 / 说明区禁未解释缩写 / notes 五段 / 标题可被搜索命中——新增案例自动扩展校验）
  3. `npm run type-check`、`npm run lint`、`npm run build`
  4. dev 页面实测：案例页可交互、刷新无控制台告警、路由往返状态正确
  5. 有页面交互变化时，dev 地址交用户人工走查（机器验证不能替代）
  6. 未跑完清单不得宣称"完成"；宣称前先有 fresh 证据（已通过全局 superpowers skills 提供，用 skill 工具加载 `verification-before-completion`）
- 每任务收尾必更新本文件「当前进度」段；重大取舍记入「决策记录」

## 当前进度

- **阶段**：共 81 案例 / 9 分类（css 5 · basics 5 · animation 8 · performance 11 · observer 5 · virtual 3 · vue3 17 · composables 1 · practice 26）；「不造轮子」「框架案例抽离」「一案例一演示」约定已固化
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
- ✅ 2026-10-20 质量批次 6：其余 50 个存量案例 notes.md 五段补齐（当时 54/54，拆分 raf-throttle 后 55/55 全覆盖）；全部含现象/SBAC 式原理/关键代码/实测或行为指标/追问边界；脚本校验 55 篇均含 1~5 段；vitest、type-check、lint、build 通过
- ✅ 2026-10-20 说明区改为「说明 / 源码」tab 组，默认说明，源码默认隐藏；raf-loop 拆为逐帧动画 + 逐帧合并高频渲染（共 55 案例）
- ✅ 2026-10-20 顶栏搜索改为全局弹窗：半透明遮罩 + 实时结果卡片，支持 Ctrl/Cmd+K、上下键、回车直达详情；列表页回归纯分类筛选
- ✅ 2026-10-20 批次 7 机器验收：55 案例 / 167 个路由与模块请求全部 200；新增 `tests/content-quality.spec.ts` 五项门禁（SBAC / 长度 / 禁缩写 / notes 五段 / 搜索自洽），vitest 23/23
- ✅ 2026-10-20 详情页体验：回到顶部浮动按钮（滚动 480px 出现，带阅读进度环与缩放上浮动画）；说明/源码 tab 吸顶（top 64px）+ 左右键切换 + 切换后回到 tab 位置
- ✅ 2026-10-20 全站动效统一：`--ease-out` 快出慢收曲线；路由切换淡入淡出；卡片/筛选 chips/主题图标/搜索弹窗/面板切换补齐过渡；源码段数徽章仅多段时显示
- ✅ 2026-10-20 Task 14 机器走查：55/55 案例直连 + 375px 双视口无横向溢出；说明/源码默认态与切换、搜索弹窗（点击 / Ctrl+K / ↑↓ / 回车 / Esc）、分类筛选与返回保留、主题持久化、无效路由全部通过；首页 CTA / 特性卡、代码区核心与 demo 源码切换、复制（剪贴板无 `//!` 标记）、浏览器前进后退、减少动态下滚动恢复均通过；发现并修复返回列表滚动位置被旧页面高度截断（`scrollBehavior` 改读 history.state.scroll + 等新页高度足够再 instant 恢复）
- ✅ 2026-10-20 结项：用户人工走查通过（375px / 暗色 / 键盘 / 搜索弹窗 / 返回列表）；55 案例 / 6 分类全部完成，tag v0.1（后续新增合并门禁案例，现 56）
- ✅ 2026-10-20 CI 门禁：`.github/workflows/ci.yml` 在 push main / PR / 手动触发时跑 `npm ci` + type-check + lint + vitest + build；Node 22 LTS + npm 缓存，同分支并发自动取消旧任务
- ✅ 2026-10-20 main 硬门禁：ruleset `main-merge-gate` 要求 PR + 必需检查 `Type check, lint, test, build`，禁止强推/删除、只允许线性历史、审批数 0、无 bypass；实测直推报 GH013，红灯 PR 合并返回 `base branch policy prohibits the merge`
- ✅ 2026-10-20 合并门禁案例 `practice/branch-protection`：规则集开关 + 直推/红灯 PR/绿灯 PR 四态演示；实测红灯检查 18s、绿灯 33s，375px 无横向溢出，代码区含规则集配置与验证命令
- ✅ 2026-10-20 PDF 预览重构为 pdf.js + canvas：动态加载运行时与 worker，自建翻页/缩放/卸载；渲染前取消 `RenderTask`，卸载 destroy `loadingTask`。3 轮实测首屏 35~69ms（中位 45，含 worker 启动）、翻页 8~15ms、150% 缩放 6~11ms；快速连点、渲染中卸载、路由往返、375px 均无报错与页面横向溢出
- ✅ 2026-10-20 顶栏精修：品牌标记、搜索与主题图标全部改为自绘 SVG；搜索框收窄到 18.5rem、快捷键按平台显示；滚动 4px 后切半透明毛玻璃 + 轻投影；移动端只留标记并补 `aria-label`。实测 1200 / 375 / 320 均无横向溢出，亮暗色正常、控制台无报错
- ✅ 2026-10-20 详情页新增「深入」tab：`notes.md` 经 `import.meta.glob` 懒加载 + Promise 缓存，marked 渲染五段、highlight.js 高亮代码块（新增 bash/yaml，vue/html 按 xml），含骨架屏/失败重试/空态；首个 H1 隐藏，三个 tab 支持左右键循环。机器验收：vitest 25/25（含全案例 notes 加载器用例）、type-check、lint、build；Chrome CDP 实测 raf-loop / teleport-layer 五段齐全、代码高亮、暗色代码主题生效、375px 表格内部横滚且页面无溢出、控制台零错误
- ✅ 2026-10-20 Element Plus 试点：接入 unplugin-vue-components 按需引入（不整包注册），新增主题适配层 `_element.scss`（主色/字体/圆角/边框/背景对齐站点 token，含暗色与 Select 弹层）；3 个样板案例改用统一大号表单控件：vitest-gate（el-select）、debounce-throttle（el-input）、json-viewer（el-input textarea）
- ✅ 2026-10-20 收尾合并：#9 文档 → #7 Element Plus → #8 Demo 尺寸（rebase 解决 `vitest-gate` / `AGENTS.md` 冲突）；56/56 案例完成尺寸统一，`debounce-throttle`、`json-viewer` 的 EP 控件用 `:deep` 补 14px 字号与 40px 高度；CDP 1200/375 抽查 5 路由 + 下拉弹层 + 路由往返，无横向溢出与 console 错误
- ✅ 2026-10-20 批次 8（6 案例）：交叉观察器曝光统计 / 过渡组列表动画 / content-visibility 长列表 / 请求竞态与取消 / 乐观更新与回滚 / 虚拟网格；全部含 Demo + code + notes 五段。实测：IO 布局读取 888→0、回调 28；过渡组打乱耗时 360ms vs 普通替换 2ms；content-visibility 3000 条重建 99.4→49.9ms（1.99×，节点仍 3000）；请求竞态旧响应覆盖 2→0、最终结果串台→正确；乐观更新点击后 40ms 即变、失败约 300ms 回滚；虚拟网格 5000→44 节点、重建 97.5→14ms。vitest 25/25、type-check、lint、build 通过；1200/375 六路由无横向溢出、无 console 错误
- ✅ 2026-10-20 Agent Skills 接入：superpowers v7 以技能目录形式接入（当时放在 `~/.config/opencode/skills`，2026-10-21 起统一到 `~/.agents/skills`），`~/.claude/skills/frontend-design` 提供设计技能；2026-10-21 清理 `grill-me`（与 `grilling` 同文）和重复副本后无 duplicate 告警。opencode 升到 **v2.1.1** 后 `debug skill` 已移除，改用 `opencode api get /api/skill` 实测 **20 个**（17 superpowers + frontend-design + 内置 `opencode` / `report`）
- ✅ 2026-10-21 详情页 tab 体验：主色胶囊指示器用 transform 快滑并带柔和阴影；移除 `v-show` 面板重播的透明度动画，消除「深入」首次加载闪屏；首次 notes 用 `rendered` 事件 + 临时 min-height 等正文完成后再对齐；吸顶切换滚到「刚吸顶」位置（零高度锚点避开 sticky offsetTop 漂移），并支持快速连点。系统开启「减少动态效果」时，全局仍关闭其余动效，但指示器保留短滑，避免直接瞬移。实测 1200/375、亮暗色、键盘左右键、快速连点、减少动态效果均对齐；全量回归 62 路由 × 2 视口 = 124 项 0 失败，vitest 25/25、type-check、lint、build 通过
- ✅ 2026-10-21 skills 收口（续做中断会话 `ses_ea3f7735…`）：新增 `docs/skills-and-subagents.md`（20 个技能清单与触发时机、L0/L1/L2 分级、SubAgent 配置与权限语义、重装记录与排障）；`AGENTS.md` 增加任务分级并把强制清单收敛到 L2；新增项目级只读子代理 `case-reviewer` / `verifier`（`opencode debug agents` 实测 `mode=subagent`、`edit: deny`）；lint 常用写法改为单文件。**superpowers 已重装**：`npx skills add obra/superpowers -g -a opencode -s "*" --copy -y`，15 个技能补齐 prompts/scripts/references（`subagent-driven-development` 7 个文件、`systematic-debugging` 11 个、`diagnosing-superpowers` 20 个）；技能实体统一到 `~/.agents/skills`，`~/.config/opencode/skills` 已清空，避免重复来源。实测 `opencode api get /api/skill` = 20 条、全部指向 `.agents`（`frontend-design` 在 `.claude`）、日志无新 duplicate 告警。首轮 `case-reviewer` 审查报 0 P0 / 2 P1 / 8 P2，已逐条修完：统一 eslint `--max-warnings 0` 口径、按 V2 优先级覆盖解释同名技能（不是「随机/静默」）、补 `metadata.opencode/autoinvoke` 正确嵌套、L2 判据改为「≥4 个逻辑文件」、给 `case-reviewer` 追加 deny `git *--output*` 与 `*>*` 并实测拦截成功
- ✅ 2026-10-21 中文乱码复发并修复：opencode 升到 v2.1.1 后 V1 插件实现不再运行，每次启动报 `failed to load plugin ... Plugin must export a default definition with an id ... Missing key at ["default"]`，UTF-8 前缀实际没注入（不带前缀跑中文命令实测仍是乱码）。`utf8-encoding.ts` 改写为 `export default Plugin.define({ id: "utf8-encoding", setup })` + `ctx.shell.hook("create.before")`：按 `event.shell` 只对 PowerShell 注入、幂等跳过已有设置。实测 `/api/plugin` 中 `utf8-encoding` 为 `active`、日志不再报加载失败、裸跑 `中文测试：你好，世界` 正常显示（进程参数里可见自动加上的前缀）
- ✅ 2026-10-21 PR #13 已 rebase 合并到 main（两条 commit 保留：详情页 tab 优化、skills 与子代理手册）；CI `Type check, lint, test, build` 39s 通过
- ✅ 2026-10-21 企业级打包优化：首屏 gzip **521 KB → 91 KB**（-82%），详情页只加载当前案例
  - `registry.ts` 四类 glob 改「meta 同步 + 资源懒加载」：`allCases`/`getCase` 只给 meta 与 `codeFileCount`，新增 `loadDemoComponent` / `loadCaseSource`（Promise 缓存、失败清缓存可重试）；Demo 进详情页才下载，源码文本点开「源码」tab 才下载
  - 路由三个页面改 `() => import()`；`CasePage` 加演示/源码加载态与失败重试，切案例时重置状态并丢弃旧源码
  - `vite.config.ts` 用 `output.codeSplitting.groups` 拆 `vendor-vue` / `vendor-markdown` / `vendor-element-plus` / `vendor-utils`，`chunkSizeWarningLimit: 600`
  - Element Plus 去掉 353 KB 整包主题，改 `importStyle: 'css'` + `theme-chalk/base.css` + 暗色变量；组件样式只随 3 个用到 EP 的 Demo chunk 下发
  - 新增 `npm run check:bundle` 体积门禁（首屏 gzip ≤180 KB、单 chunk ≤600 KB、首屏禁「//! 中文」教学标记），CI 在 build 后执行
  - 产物按「类型 → 用途 → 案例」分目录：`assets/js/{index,vendor,pages,cases/<分类>/<案例>,lib,workers}`、`assets/css/{index,vendor,pages,cases/<分类>/<案例>,themes}`、`assets/{fonts,media}`；`check:bundle` 改递归扫描，路径变化不影响门禁
  - 机器验收（Chrome CDP）：首页/列表/详情/EP 案例零 console 错误；列表 62 张卡片；详情首屏**不请求**源码 chunk，点「源码」后才请求（125 行代码 + 4 处重点行）；notes 正常渲染；案例间切换不残留上一个案例源码、tab 回到「说明」；375px 无横向溢出；vitest 29/29、type-check、lint、build、check:bundle 全绿
- ✅ 2026-10-21 全局搜索扩到 notes 正文（正文命中带高亮片段）
  - 新增 `src/utils/search-index.ts`：纯函数「去 Markdown 标记 → 建文档 → 命中计数 + 片段截取 → 关键词切分 → 与元数据结果合并」，可单测、不依赖浏览器
  - 新增 `src/composables/useNotesIndex.ts`：首次打开搜索弹窗后 `requestIdleCallback` 构建，62 篇并发 6 分批读、模块级单例缓存、每读完一篇增量刷新结果
  - `SearchModal.vue`：结果行加「正文」标记与 `<mark>` 高亮片段（不用 `v-html` 防注入），正文索引加载中/不可用有提示；键盘选择不再被增量结果打断
  - 机器验收（Chrome CDP）：搜「微任务」3 条全部来自正文、搜「虚拟列表」元数据优先 + 6 条正文追加、`structuredClone` 1 条仅正文命中；↑↓ + 回车跳转 `/cases/vue3/reactive-loss`；375px `scrollWidth=375`、面板 351px；零 console 错误；vitest 45/45（新增 16 条）、type-check、lint、build 通过
- ✅ 2026-10-21 浏览器验收脚本统一（`npm run check:ui`）：此前各会话各写临时 CDP 脚本，跑完只 kill 父进程、`--headless` 有的加有的没加、每轮新建 profile，累计 **111 个 chrome 进程 + 41 个临时配置目录（2.0 GB）**，桌面上不断弹窗口。新增 `scripts/check-ui.mjs`：headless 启动、`--remote-debugging-port=0` 免抢端口、固定 `node_modules/.tmp/chrome-check`、退出整棵进程树 `taskkill /T /F` + 重试清目录；内置 5 个场景（首页 / 列表 / 详情源码按需 / EP 样式 / 375px），有失败退出码 1。实测通过，跑完自动化进程与临时目录均为 0；同时清理了存量的 111 个进程与 2 GB 目录
- ✅ 2026-10-21 站点体验优化（第二批）：列表页难度筛选（带数量）+ 收藏筛选 + 最近浏览；详情页收藏、浏览记录、相关案例（同标签优先，不够用同分类补齐）、上下篇导航；全局文档标题按路由更新、`skip-link` + `<main id="main-content">`、`NotFoundPage`（`/nope` 走 404 路由）、路由 chunk 加载失败自动刷新一次兜底；新增 `useCaseHistory` + 8 条单测
- ✅ 2026-10-21 新增 11 个案例（共 73 案例 / 8 分类）：`css` 5 个（grid-auto-fit / container-query / has-parent / fluid-clamp / aspect-ratio-cls）+ `basics` 5 个（event-loop / url-search-params / intl-format / structured-clone / clipboard-api），两个新分类置于分类列表最前；`practice/dynamic-chunk` 用真实动态 import 实测「按需 7.3 KB / 5.8 ms」vs「全量 36.8 KB / 15 ms」、同页二次点击 0 B / 0.8 ms，生产构建复访 300 B（304 头部）
- ✅ 2026-10-21 工具与门禁修正：`npm run type-check` 原为 `vue-tsc --noEmit`，根 tsconfig 只有 references、实际什么都不检查（本次 build 一次性暴露 12 处类型错误才发现的），改为 `vue-tsc -b`；`.gitignore` 补 `.vitest` / `coverage`；`check:ui` 场景从 5 个扩到 7 个（新增列表难度筛选、无效路由兜底，详情场景加相关案例与上下篇断言），并修正 dev 模式误判（源码 chunk / EP 样式只在 preview 有 hash 资源可数，dev 记 `null` 表示不适用）
- ✅ 2026-10-21 验收：`npx vitest run` 53/53、`npm run type-check`、`npm run lint`、`npm run build`、`npm run check:bundle`（首屏 gzip 103.8 KB）、`npm run check:ui` 7/7（preview）与 5/5（dev）全绿；11 个新案例在 375px 下 `scrollWidth=375`、零 console 错误；`container-query` 与 `aspect-ratio-cls` 的测量时序坑已在 headless 下复测（见决策记录）
- ✅ 2026-10-22 案例列表页补回到顶部：把详情页的浮动按钮抽成 `src/components/BackToTop.vue`（滚动 >480px 浮现、外圈滚动进度、点击缓动回顶、hover 上浮 + 进度环），逐帧缓动滚动移到 `src/utils/scroll.ts` 供详情页 tab 对齐与回顶共用；`check:ui` 的列表/详情场景各补「滚到底 → 按钮出现 → 点击回顶 → scrollY≈0」断言，实测 7/7 通过（列表 73 卡片、回顶 0px）；vitest 53/53、type-check、lint、build 全绿
- ✅ 2026-10-22 新增动画与交互分类 8 个入门案例（共 81 案例 / 9 分类）：`animation` 置于 css / basics 之后
  - 批 A（CSS 动画基础）：`skeleton-shimmer`（灰块占位 + 微光扫过，对比转圈加载的高度跳动）、`accordion-slide`（`grid-template-rows: 0fr → 1fr`，对比脚本量 `scrollHeight`，面板直接显示读取次数 1 → 0）、`drawer-slide`（`translateX` + 遮罩，等 `transitionend` 再卸载，Esc / 点遮罩 / 滚动锁 / 焦点回归）、`progress-ring`（只写一次 `stroke-dashoffset`，让过渡补中间帧，对比定时器逐帧改属性）
  - 批 B（交互细节）：`magnetic-button`（指针偏移换算 `translate`，限制最大位移、离开回弹、触摸与减少动态效果跳过）、`snap-carousel`（`scroll-snap-type` + `scrollIntoView` + 滚动位置反推索引，对比手算 `scrollLeft` 与边界夹取）、`tooltip-pop`（自建气泡 180ms 延迟出现 + 上/下方自适应定位 + `role="tooltip"`，对比原生 `title`）、`focus-visible-ring`（`:focus-visible` 焦点环，对比 `outline: none` 裸奔）
  - 每个案例默认停在「旧做法」一侧，面板可切对比、可重置，卸载清理定时器 / 监听器；notes 第 4 段只用「读取次数 / 监听器数 / 手算处数 / CSS 声明条数」等可核对口径，不写未实测毫秒
  - `check:ui` 新增 `checkAnimationCases`：8 个案例逐页在 375px 打开，断言无横向溢出、演示区有内容、有可操作按钮、控制台零报错
  - 验收：`npx vitest run` 53/53、`npm run type-check`、`npm run lint`、`npm run build`、`npm run check:bundle`（首屏 gzip 108.9 KB）、`npm run check:ui` 15/15 全绿（列表 81 卡片）
- ✅ 2026-10-22 修复动画案例在「系统关闭动画效果」时看不到动画：用户机器上浏览器把 `prefers-reduced-motion` 报成 reduce，站点全局规则把过渡压到 0.01ms，`drawer-slide` 的两种关闭方式看起来一模一样
  - Demo 改为「演示优先」：过渡始终播放，顶部提示系统真实设置，新增「模拟减少动态效果」开关展示跳过分支；`notes` 与教学代码同步说明「真实项目应跟随系统设置」
  - 演示区用 scoped `@media (prefers-reduced-motion: reduce)` + `!important` 还原过渡时长（全局规则同为 important，靠类选择器更高优先级胜出）
  - `check:ui` 新增「抽屉退场动画」场景：模拟 reduce 环境，断言关闭 80ms 后节点仍在且面板位移已达 281px、过渡结束后卸载、直接卸载与模拟开关都立刻移除；16 个场景全绿
- ✅ 2026-10-22 其余 6 个动画案例统一改为「演示优先」（用户选择）：`skeleton-shimmer` / `progress-ring` / `magnetic-button` / `accordion-slide` / `tooltip-pop` / `snap-carousel`
  - 每个案例都把系统 `prefers-reduced-motion` 降级为「顶部提示 + 手动开关」（`mockReduce`），演示本身始终播放；开关打开时走降级分支（高光静止 / 进度直接跳变 / 不跟随 / 直接展开 / 气泡瞬间出现 / 滚动直接到位）
  - scoped `@media (prefers-reduced-motion: reduce)` 用 `!important` 还原时长（关键帧动画要同时还原 `animation-duration` 与 `animation-iteration-count`），降级态用 `.is-static` / `.no-motion` 类压回去
  - notes 与教学代码同步说明「真实项目应跟随系统设置，本案例为了演示仍播放」
- ✅ 2026-10-22 流程优化（用户要求）：
  - `check:ui` 新增 `--only <关键字>`：按场景名或路由过滤，单场景 5~10 秒（`npm run check:ui -- --base http://localhost:5173 --only 抽屉` 实测 1 个场景通过）
  - `AGENTS.md` 任务分级补两条：修复存量案例 bug 固定走 L1（单案例 eslint + type-check + `--only`，不跑 build / bundle / 全量）；影响面超过 1 个案例先问，文档按批次合并提交
- ✅ 2026-10-22 回到顶部不再瞬跳（补记另一会话的 `7f8a175`）：`smoothScrollTo` 新增 `ignoreReducedMotion` 选项，回到顶部在系统开启「减少动态效果」时仍保留缓动（460ms → 320ms）；`check:ui` 列表场景记录 `reduceMotion` 与点击后 150ms 的 scrollY，并新增「瞬跳」断言。根因与动画案例相同：开发机浏览器就是 reduce
- ✅ 2026-10-27 案例质量基线（批 0）：新增 `npm run audit:cases` 静态体检（81 案例，按 P0/P1/P2 输出，报告写 `node_modules/.tmp/case-audit.md`）；`check:ui` 增加 `--case <分类>/<案例>` 单案例巡检与 `--sweep` 全案例巡检（375px，新增 console.error / console.warn 捕获）；修正 `vitest-gate`（五道真实门禁：type-check / lint / test / build / check:bundle，删除仓库不存在的覆盖率门禁）、`vite-split`（Vite 8 `codeSplitting.groups` + 真实构建数据）、`registry` 注释里的过时案例数
  - 验收：audit 81 案例 0 P0 / 0 P1 / 22 P2；`check:ui --sweep` 81/81；全量 `check:ui` 16/16；vitest 53/53；type-check、eslint、build、check:bundle（首屏 gzip 108.9 KB）通过
- ✅ 2026-10-27 机械 P2 清理（7 个案例）：4 处 `document.getElementById` 改模板 ref（accordion-slide 用 `faqRoot` + `querySelector`、infinite-scroll / lazy-image 用 `scrollRoot`、perf-observer 用 `shiftZone`），同步更新 `code/logic.ts.txt` 与 `code/usage.ts.txt`；3 个案例补 `aria-pressed`（typewriter-stream 2 个、reactive-loss 8 个、theme-switch 的 v-for 模式按钮）；reactive-loss 的 tags 从 6 个压到 5 个
  - `check:ui` 修正 `waitForDemo`：改为等 `.demo-card` 里的 `.async-placeholder` 消失，避免 dev 首次编译时把「演示加载中…」当成渲染完成；`--case` 不再把「可操作控件数」当硬失败（无限滚动靠滚动触发）
  - 新增 4 个常驻场景：折叠面板量高（读取 scrollHeight 0 → 1、高度 87px）、无限滚动预取（20 → 40 条）、懒加载容器滚动（6 → 12 张）、布局偏移注入（`blockAdded=true`）
  - 验收：audit 81 案例 0 P0 / 0 P1 / **14 P2（全部是 notes 第 4 段「约/左右/估计」）**；7 个案例 `check:ui --case` 通过；全量 `check:ui` 20/20；`--sweep` 81/81；vitest 53/53；type-check、eslint、build、check:bundle（首屏 gzip 108.8 KB）通过
  - 剩余 14 个「约/左右」P2：magnetic-button / snap-carousel / event-loop / intl-format / container-query / has-parent / raf-loop / raf-throttle / sse-chat / time-slicing / debounce-throttle / image-compress / optimistic-update / effect-scope
- ✅ 2026-10-27 「约/左右」P2 批 1（4 个案例）：`snap-carousel` 手算语句 6 行左右 → 5 行；`event-loop` 去掉时间约数，改用规范值 4ms / 60Hz 16.6ms 与实测 1~5ms 区间；`intl-format` 手写行数 30 → 26，并修掉生产构建用 `Function.prototype.toString()` 数行被压成 1 的真实 bug（改静态值 + `Intl 行数` 巡检）；`has-parent` JS 行数精确到核心段第 8–50 行共 30 行，面板与 meta 去掉「约」
  - `audit:cases` 的「左右」检测收紧为「数字 + 左右」，避免把「左右移动 / 箭头 / 两列 / 两侧」当估算词；P2 从 14 降到 7（全部是真实估算词）
  - 验收：audit 81 案例 0 P0 / 0 P1 / 7 P2；有代码改动的 intl-format / has-parent `check:ui --case` 通过；`--only Intl` 在 dev 与 preview 均显示 26/4；vitest 53/53；type-check、eslint、build 通过
  - 剩余 7 个：raf-loop / raf-throttle / sse-chat / time-slicing / debounce-throttle / image-compress / optimistic-update
- ✅ 2026-10-27 「约/左右」P2 批 2（4 个案例）：`raf-loop` 改为 60Hz 屏幕 60fps / 16.6ms / 74（本次采样）；`raf-throttle` 修正「每分钟」笔误为「每秒」，渲染 60 次（受刷新率限制）；`sse-chat` 首段 150~390ms（Demo 随机延迟）、重连 3000ms，删掉不稳定的「1.2s id 2/36」，meta 的 120ms 同步改为 150~390ms；`time-slicing` 全量渲染 21ms（本次中位数）
- ✅ 2026-10-27 「约/左右」P2 批 3（3 个案例）：`debounce-throttle` 节流每 100ms 1 次；`image-compress` 压缩率 96%（面板取整，1 − 60/1690 = 96.45%）；`optimistic-update` 回滚 300ms（接口固定延迟）
  - 阶段收口：audit 81 案例 **0 P0 / 0 P1 / 0 P2**；vitest 53/53、type-check、lint、build、check:bundle（首屏 gzip 108.9 KB）、全量 `check:ui` 21/21、`--sweep` 81/81 通过
  - 说明：sse-chat 原 notes/meta 与 Demo 实际 150~390ms 随机延迟不一致，已按代码修正并删除不稳定的 1.2s 快照；raf-throttle 原「每分钟」为笔误
- ✅ 2026-10-27 案例质量升级批 A（4 案例）：`animation/snap-carousel` 改 rAF 补间 + radio 模式 + 补间期间关闭吸附；`performance/perf-observer` 实时/加载期分组 + 重置实验 + 偏移块上限 5；`observer/lazy-image` 加载完成才 unobserve + 日志上限 20 + 持续观察开关 + 重置列表；`practice/optimistic-update` 提示改固定消息栈（`Teleport to="body"`，最多 3 条、2.4s 自动消失），面板位置全程不变；更新策略按钮统一改 radio 语义
  - 提交：`d269e63` / `4f12d88` / `ba23822` / `9b5ac48` / `9c448e4`；`snap-carousel` 说明区另修未解释缩写 `rAF`（`c307cb5`）
  - 验收：四个案例各自 `check:ui --only` 通过；`npx eslint <案例目录>` 与 `npm run type-check` 通过
- ✅ 2026-10-27 案例质量升级批 B（2 案例）：`basics/event-loop` 改 4 个预设 + 6 个任务开关，「直觉预期」按当前勾选动态生成，输出对照改 radio，`runToken` + `timerIds` 防止旧回调串台；`performance/time-slicing` 默认 3 万 / 300，可选 1/3/5 万与 100/300/1000，新增结果对比表，首帧改 `nextTick` + 双 rAF、最大阻塞按每批计时、点击响应改 `event.timeStamp`
  - `check:ui` 新增两个常驻场景：「事件循环任务开关」验证默认顺序、只留 Promise、慢任务后顺序与 radio 语义；「时间切片规模与测量」用 1 万 / 1000 跑全量与切片，断言对比表数值、切片首帧早于总耗时、渲染中点击可响应
  - `audit:cases` 的模式切换检查同时接受 `aria-pressed` 与 `role="radio"` + `aria-checked`；audit 81 案例 **0 P0 / 0 P1 / 0 P2**
  - 提交：`2313af1` / `bc6f4a9`
  - 验收：`npx vitest run` 53/53、`npm run type-check`、`npm run lint`、`npm run build`、`npm run check:bundle`（首屏 gzip 109.5 KB）、全量 `npm run check:ui` 25/25；两个案例 `--case` 在 1280 / 375 均无横向溢出、零 console 错误
- ✅ 2026-10-28 PR #15 已 rebase 合并到 main（`perf/enterprise-bundle-optimization`，59 个提交：企业级打包优化、站点体验两批、新分类 css / basics / animation 共 19 案例、质量基线与批 A/B 升级、回到顶部修复全部进主干）；合并前推送后 CI `Type check, lint, test, build` SUCCESS、mergeState CLEAN，合并后本地 main 快进到 `596e40e`，本地与远端特性分支已删除。期间踩坑：dev 服务器常驻时切分支，`unplugin-vue-components` 会立即重新生成 `src/components.d.ts` 挡住 pull，丢弃该文件改动再拉即可
- 🔄 2026-10-28 演示区 UI 统一批 1（4 案例，改用 Element Plus）：`event-loop`、`time-slicing`、`snap-carousel`、`optimistic-update` 的对比/模式组改 `el-radio-group` + `el-radio-button`，常规操作按钮改 `el-button`；`_element.scss` 在 `.demo-card` 内统一 EP 按钮/单选组为 36px（移动端 40px）高、站点圆角；`optimistic-update` 提示改用共享 `DemoToastStack`，固定在右上角（顶栏下方 80px）；`check:ui` 断言改为 EP DOM（`.el-radio-button` / `.is-active` / `input:checked`），保留提示 top/right 断言；`audit:cases` 识别 `<el-radio-group>`。`DemoButton` / `DemoSegmented` 已删除。剩余约 24 个互斥模式组与 200+ 案例按钮按批次继续迁移，未一次性铺开
- ✅ 2026-10-28 演示区 UI 换挡 Naive UI（推翻同日批 1 的 EP 方案）：spike 对比页（`/spike/ui-compare`，决策后已删）肉眼对比后用户拍板「Naive 默认观感更好，长期只维护 themeOverrides 颜色」。卸载 element-plus，`NaiveUiResolver` 按需引入；主题映射 `src/composables/useNaiveTheme.ts`（浅/暗 token 镜像 + 组件级 36px），演示区经共享 `DemoNaive.vue`（abstract provider）包主题上下文——**不能在 App.vue 包 provider**，barrel import 会把整个 naive-ui 拉进首屏（实测首屏 gzip 211.8 KB 爆门禁）；7 个案例改写 el-*→n-*（批 1 四案例 + vitest-gate 选项改数组 / debounce-throttle / json-viewer，教学代码同步）；踩坑：`vendor-naive-ui` 组必须**递归收编**依赖（naive 依赖 css-render/vooks/lodash 等独立小包，关闭递归会被内联进 Demo chunk 形成跨 chunk 循环 import，生产构建 n-select 挂 `Lt is not a function`；Vue 运行时由 vendor-vue priority 100 先认领不受影响）；`n-radio-button` 选中类名是 `--checked`（EP 是 `is-active`）。验收：首屏 gzip **106.6 KB**（换挡前 108.9）、vitest 53/53、type-check、eslint、build、check:bundle、check:ui 25/25、`--sweep` 81/81、audit 0 P0/P1/P2。剩余约 24 个互斥模式组与 200+ 案例按钮按批次继续迁移 n-*
- ✅ 2026-10-29 修复 `practice/debounce-throttle` 波形「没铺满就开始横移」：脉冲柱子数量原先写死 36 根，宽屏下只占三分之一容器宽度就开始丢旧柱子。改为 `measureWave()` 按容器 `clientWidth` 算容量（`(宽 - 22) / (柱宽 6 + 间距 3)`，最少 8 根），并用 `ResizeObserver` 跟随两栏/单栏切换，满了才 `shift()`；同时修正 meta 里与代码不一致的两处描述（节流 200ms → 100ms、「取消按钮」→ 重置按钮，实际没有取消按钮）。`check:ui` 新增常驻场景「防抖波形先铺满再滚动」：连续输入「容量 + 3」次后断言柱子数 === 容量、最右一根离右边 ≤30px、无横向溢出（写死 36 根这类回归会直接红灯）
- ✅ 2026-10-29 演示区提示统一改 Naive UI message（用户要求「用人家现成的组件，不要自己写」）：`DemoNaive.vue` 内层加 `NMessageProvider`（`placement="top"` 顶部居中 / `max=3` / `duration=2400`，容器由 provider Teleport 到 body，不进文档流）；新增 `DemoMessageBridge.vue` + `composables/useDemoMessage.ts` 桥接——Demo 是 provider 的父级、自己 setup 里 `inject` 不到 `useMessage()`，所以由 bridge（provider 子组件）挂载时把 api 注册到模块级，案例里 `demoMessage.success/error(...)` 调用；`optimistic-update` 删掉自建提示栈与定时器（`clearMessages` 改 `demoMessage.destroyAll()`），`DemoToastStack.vue` 已删（toast-queue 教学案例仍自建，符合「教学如何做组件」）；`check:ui` 该场景断言改 Naive DOM（`.n-message` / `--success-type` / `--error-type` / `.n-message-container--top` / 容器不在 `.ou-demo` 内 + 首条消息水平居中），实测 containerTop=12、中心偏移 0px、面板全程 396 不被推挤。验收：check:ui 26/26（dev）、`--sweep` 81/81、vitest 53/53、type-check、eslint、audit 0 P0/P1/P2
- ✅ 2026-10-29 演示区 provider 上移到 `CasePage`，案例可直接 `useMessage()`：原先每个用 Naive 的 Demo 都自己包一层 `DemoNaive`，81 个案例要迁 n-* 就得逐个套壳。改为 `<CasePage>` 里 `<DemoNaive><component :is="demoComponent" /></DemoNaive>`——Demo 成为 provider 的**子组件**，`inject` 正常，`useMessage()` 直接可用；删掉 `DemoMessageBridge.vue` / `useDemoMessage.ts` 与 7 个 Demo 的包裹层（脚本左移缩进），`optimistic-update` 改标准写法。首屏 gzip 仍 106.6 KB（naive 只在按需的 pages chunk 里），build / check:bundle / vitest 53 全过
- ✅ 2026-10-29 演示区 UI 迁移批 1（css + basics 共 10 案例，按钮 + 互斥模式组）：`grid-auto-fit` / `container-query` / `fluid-clamp` / `has-parent` / `aspect-ratio-cls` / `structured-clone` / `intl-format` / `url-search-params` / `clipboard-api`（`event-loop` 之前已迁）把原生 `<button>` + `aria-pressed` 手写选中态换成 `n-radio-group` + `n-radio-button`（`:value` + `@update:value`，回调统一收窄 `string | number | boolean | undefined`），普通按钮换 `n-button`（主操作 `type="primary"`、次级默认、描边主色 `type="primary" ghost`），并删掉对应的 `.mode` / `.btn` / `.chip` / `.pager-btn` 孤儿样式。验收：eslint、type-check、`check:ui --sweep` 81/81、`--case` 抽查 3 个（url-search-params / clipboard-api / grid-auto-fit）1280+375 无横向溢出、build、check:bundle（首屏 gzip 106.6 KB）、vitest 53/53
- ✅ 2026-10-29 演示区 UI 迁移批 2（animation 8 案例，按钮 + 互斥模式组）：`skeleton-shimmer` / `accordion-slide` / `drawer-slide` / `progress-ring` / `magnetic-button` / `tooltip-pop` / `focus-visible-ring` 的模式组换 `n-radio-group`（磁性按钮的「弱/中/强」用 `size="small"` 二级组），模拟减少动态效果与重置换 `n-button`（模拟开启态 `type="warning"` + `ghost`）；`snap-carousel` 之前已迁，本批只确认箭头/圆点保留。`drawer-slide` 重点改了两处：`ref` 拿 Naive 实例要用 `triggerRef.value?.$el?.focus()`（抽成 `focusTrigger()`），抽屉页脚关闭按钮换 `n-button`；`progress-ring` 的 25/60/100 预设换 `n-button size="small"`。`check:ui` 的抽屉场景 `button(text)` 辅助函数补 `.n-radio-button`（Naive 单选按钮是 label，不是 button，否则点不到「等动画结束」）。验收：eslint、type-check、全量 `check:ui` 26/26、`--sweep` 81/81、build、check:bundle（106.6 KB）、vitest 53/53
- ✅ 2026-10-29 演示区 UI 迁移批 3（performance 11 案例，按钮 + 互斥模式组）：`content-visibility`（布尔单选值 `:value="false"` / `:value="true"`）、`typewriter-stream` 的模式组换 `n-radio-group`；`chat-scroll` / `idle-schedule` / `perf-observer` / `pull-refresh` / `raf-loop` / `sse-chat` / `web-worker` 的操作按钮换 `n-button`（主操作 `type="primary"`、危险动作 `type="error"`、右对齐按钮只保留 `margin-left:auto` 之类的布局类）。`time-slicing` / `raf-throttle` 本就没有原生按钮。`web-worker` 的两个按钮保留 `.path-btn { align-self: flex-start }` 布局类，观感交给 Naive。验收：eslint、type-check、全量 `check:ui` 26/26、`--sweep` 81/81、8 个案例 `--case`（1280+375 无溢出）、build、check:bundle（106.6 KB）、vitest 53/53
- ✅ 2026-10-29 `check:ui` 等演示区加载改成真等：`waitForDemo` 返回 `ready / loading / missing` 三态并带注释，动画抽检与每个场景都改走它——原来动画抽检写死 `sleep(1500)`、场景写死 `sleep(3200)`，迁到 Naive 后案例 chunk 变大，dev 首次编译偶尔超过这个时间，会采到「演示加载中…」并随机报「演示区没有渲染出内容」。非案例页（列表 / 404）给 2.5s 等 CasePage 挂载后放行，不额外拖慢
- ✅ 2026-10-29 演示区 UI 迁移批 4（observer 5 + virtual 3）：`intersection-observer`（「滚动 + 位置计算 / 交叉观察器」换 `n-radio-group`，自动滚动 / 重置换 `n-button`）、`virtual-grid`（虚拟 / 全量的布尔单选值 + 跳到中间 / 回到顶部）、`virtual-variable`（虚拟 / 全量换单选组，回到顶部保留 `margin-left:auto` 布局类）；`mutation-observer` 五个动作按钮、`lazy-image` 的重置按钮换 `n-button`；`infinite-scroll` / `resize-observer` / `virtual-list` 本就没有原生按钮。验收：eslint、type-check、全量 `check:ui` 26/26、`--sweep` 81/81、5 个案例 `--case`（1280+375 无溢出）、「无限滚动预取」「懒加载滚动、重置与持续观察」两个常驻场景通过、build、check:bundle（106.5 KB）、vitest 53/53
- ✅ 2026-10-30 演示区 UI 迁移批 5（vue3，16 案例）：`reactive-loss` 四个「丢失写法 / 修法」组换 `n-radio-group size="small"`（卡片窄，布尔语义用 `:value`），7 个动作 + 5 个重置换 `n-button`；`custom-directives` 角色组换单选组、权限按钮保留 `v-permission` 指令（指令作用在 Naive 按钮根元素上照样生效）、下拉菜单项保留原生；`theme-switch` / `transition-group` 模式组换单选组；其余 `async-suspense` / `computed-cache` / `define-model` / `multi-v-model` / `recursive-tree` / `v-memo` / `watch-traps` / `effect-scope` / `shallow-markraw` / `teleport-layer` / `teleport-modal` / `editable-table` 的按钮换 `n-button`（`v-memo` 的「无关更新」用 `type="warning"`、`shallow-markraw` 的「改嵌套（无反应）」用 `quaternary`、`effect-scope` 的外部触发用 `dashed`）；`reactive-inject` 没有原生按钮。豁免：`theme-switch` 预览面板的 `.tp-btn`、`teleport-modal` 的 ✕ `.tp-close`、`custom-directives` 的 `.dropdown-item`、`editable-table` 行内 `.btn-del` 都是演示主体的一部分，保留原生样式
  - `teleport-modal` 的触发按钮换成 Naive 后模板 ref 拿到的是组件实例，焦点归还改成 `triggerRef.value?.$el?.focus()`（类型改成 `{ $el?: HTMLElement }`）
  - 新增常驻场景「响应式丢失模式切换」：默认丢失写法点两次源数据 → 界面停在 0 / 真实 2；切「toRef 修法」→ 界面补成 2，再点 → 3/3；重置 → 0/0 且模式回落，防止单选组接线错误静默通过
  - 验收：eslint、type-check、全量 `check:ui` 27/27、`--sweep` 81/81、16 个案例 `--case`（1280+375 无溢出）、build、check:bundle（106.5 KB）、vitest 53/53
- dev 地址：当前主工作区 `http://localhost:5173/`，列表 `/cases`，动画案例 `/cases/animation/skeleton-shimmer`，案例页 `/cases/performance/perf-observer`、`/cases/observer/intersection-observer`、`/cases/vue3/reactive-loss`

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
| 2026-10-20 | **PDF 案例手写最小 PDF 1.4** | 生成端不引入 pdf-lib；用 Helvetica 内置字体（仅 ASCII）+ 精确 xref 偏移生成多页 PDF，代码区说明生产环境选型 |
| 2026-10-20 | **PDF 预览改用 pdfjs-dist 渲染 canvas，不用 iframe** | 用户要求；pdf.js 6 动态 import（首屏包体不背 430KB），worker 用 `?url`；渲染前 cancel `RenderTask`，卸载 destroy `loadingTask`（v6 的 document proxy 没有 destroy）；翻页/缩放/水印自建 |
| 2026-10-20 | **说明型案例也做交互** | vite-split 用勾选估算体积，vitest-gate 用「模拟 CI 运行 + 注入失败」；不做纯文字页 |
| 2026-10-20 | **SFC 顶层注释禁止出现 `<Tag>`** | 顶层 `//` 注释里的 `<KeepAlive>`/`<Transition>` 会被当模板标签 → "Element is missing end tag"；用纯文字描述 |
| 2026-10-20 | **禁止用 PowerShell Set-Content 写源码** | 默认 ANSI 会吞换行/毁中文（本会话踩过，靠 git checkout 恢复）；统一用 write/edit 工具 |
| 2026-10-20 | **案例完成标准 DoD 固化** | 7 类标准写入 `docs/case-definition-of-done.md`：Demo 稳定性、错误/正确对比、真实测量、notes 五段、meta.sell、375px、类型与工程；新案例严格执行、存量渐进；豁免写 notes 第 5 段 |
| 2026-10-20 | **notes.md 五段式，接入详情页「深入」tab** | 现象/场景 → 原理 → 关键代码（标 3 处为什么）→ 数据对比（实测+方法）→ 追问与边界；用 `import.meta.glob` 懒加载并缓存，不进 registry 同步字段；首个 H1 隐藏，搜索暂不索引正文；非性能案例第 4 段允许行为指标替代 |
| 2026-10-20 | **CaseMeta 增加 sell 必填** | ≤30 字，包含「解决什么问题 + 为什么选它」，20 秒可口述；`summary` 一句话 ≤40 字，要有具体场景与做法（能直接当面试答案）；55 个存量 meta 全部按此标准重写 |
| 2026-10-20 | **案例说明统一 SBAC 四段** | 场景（新手真实遇到）/ 背景（大白话讲原理）/ 做法（案例怎么解决）/ 结论（记住什么、何时用）；写在 meta.explain，每段 1–3 句、少术语多类比；54 个案例全部补齐，未填时回退到 sell + 代码要点 |
| 2026-10-20 | **详情页源码默认收起** | 先看演示与 SBAC 说明，需要时再展开；避免一进页就被几百行代码劝退 |
| 2026-10-20 | **说明与源码合并为 tab 组，默认说明** | 两个标签同一 tab 组（role=tablist/tabpanel）切换，替代「展开源码」按钮；切换案例时重置回说明 |
| 2026-10-20 | **一案例一演示：多演示拆成独立案例** | raf-loop 拆为 raf-loop（逐帧动画）+ raf-throttle（逐帧合并高频渲染），代码文件随案例拆分；框架保留 emit `tabs` 兼容机制，新案例不再使用 |
| 2026-10-20 | **顶栏搜索改为全局弹窗** | 点击搜索框或 Ctrl / Cmd + K 打开半透明遮罩弹窗；输入实时过滤标题/摘要/标签，结果卡片展示标题/分类/难度/摘要，上下键 + 回车或点击直达详情；打开时锁页面滚动，Esc / 点遮罩关闭；列表页恢复为纯分类筛选 |
| 2026-10-20 | **详情页 tab 吸顶 + 回到顶部** | 说明/源码 tab 吸顶在顶栏下方（64px），长代码里随时切回说明；右下角浮动按钮滚动 480px 后出现，外圈显示阅读进度 |
| 2026-10-20 | **全站动效统一** | 新增 `--ease-out`（快出慢收）替代统一 ease-out；路由切换只做淡入淡出（不加位移，保护吸顶与固定按钮）；按钮/卡片/chips/主题图标/搜索弹窗/面板切换全部补齐过渡，尊重 reduced-motion |
| 2026-10-20 | **顶栏视觉精修，图标全部自绘 SVG** | 用户反馈页头需优化；emoji（📦/🔍/🌙）换成自绘标记与线性图标，避免各系统字形不一致；搜索框收窄、快捷键按平台显示；滚动后毛玻璃 + 投影；移动端隐藏站名但保留 `aria-label`，解决品牌链接无可访问名称的问题 |
| 2026-10-20 | **回到顶部自绘缓动滚动** | 不用 `behavior: 'smooth'`（系统「减少动态」或环境差异会退化为瞬间跳转）；改用 requestAnimationFrame + 缓入缓出插值，滚动期间临时关闭 CSS scroll-behavior，用户滚轮/触屏时立即让出控制权 |
| 2026-10-20 | **中文乱码从源头修复** | 根因是 PowerShell 5.1 `-NoProfile` + GBK 输出；用 opencode 全局插件在每条 bash 命令前注入 UTF-8 编码设置，替代「避开 shell / 读文件」的绕行方案；同时给交互式 PowerShell 加了 UTF-8 profile |
| 2026-10-20 | **返回列表滚动恢复读原始 history state** | out-in 过渡期间浏览器会按旧详情页高度把 1200px 截断成 490px，Vue Router 的 savedPosition 已被污染；改读 `history.state.scroll`，并等新页面可滚动高度足够后以 `behavior:'instant'` 恢复 |
| 2026-10-20 | **CI 门禁用单 job 顺序跑四项检查** | GitHub Actions Ubuntu + Node 22 LTS；push main / PR / 手动触发，`npm ci` 后依次 type-check、lint、vitest、build；不拆多 job 以免重复安装依赖，保持配置简单 |
| 2026-10-20 | **仓库转公开 + ruleset 硬门禁** | 私有免费仓库不支持分支保护/ruleset（API 403）；转公开后创建 `main-merge-gate`：必须 PR、必需检查 `Type check, lint, test, build`、禁强推/删除、线性历史、审批 0（单人不能自批）、无 bypass；管理员直推同样被 GH013 拒绝 |
| 2026-10-20 | **Demo 尺寸统一走 token + 全局兜底** | `_tokens.scss` 新增 `--demo-*`；`.demo-card` 控件桌面 ≥36px / 移动 ≥40px 由 `_components.scss` 兜底；字号按 13/14/15/16 分层，避免统一大字号压平层级；`CasePage` 外卡桌面 `2.25rem 2.5rem`、移动 `1.25rem`。覆盖 56/56；`debounce-throttle`、`json-viewer` 的 EP 控件用 `:deep` 补内层字号与 40px 高度 |
| 2026-10-20 | **Element Plus 仅限通用表单控件试点，按需引入，站点壳不换皮** | 用户拍板试点：用 unplugin-vue-components + ElementPlusResolver（`importStyle: false`）按需引入，样式由 main.ts 引入官方完整主题，再用 `_element.scss` 把主色/字体/圆角/边框/背景/暗色与 Select 弹层映射到站点 token；禁止整包 `app.use(ElementPlus)`；站点壳与教学型组件仍自建，Pinia 仍禁止 |
| 2026-10-20 | **skills 以目录形式接入 superpowers v7** | 当时放 `~/.config/opencode/skills` 直接放技能目录（17 个），不依赖 npm 插件；**2026-10-21 已迁至 `~/.agents/skills`，该目录现为空**（见同日重装决策）。bootstrap 由 `using-superpowers` 的描述触发；Claude Code 侧因 github.com 的 git 协议不可达，改用 codeload tarball 手工落缓存并同步 `installed_plugins.json` / marketplace sha 到 v7 |
| 2026-10-21 | **skills 去重并固定 frontend-design 来源** | 删除 `grill-me`（正文与 `grilling` 完全相同，仅 name/description 不同）；`frontend-design` 原为 `.agents` 实体 + `.claude` junction，opencode 双路径扫描导致 `duplicate skill name` 告警，改为仅保留 `~/.claude/skills` 真实目录；实测无重复告警（v1.19.3 计 19 个；v2.1.1 内置技能换成 `opencode` / `report`，共 20 个） |
| 2026-10-21 | **任务分级 L0/L1/L2，验证按影响面** | 用户反馈「改一个东西有点慢」：样式微调也被强制清单 + brainstorming/TDD 技能链拖成 15~25 次工具调用。改为 L0 只跑单文件 eslint、L1 跑相关测试 + type-check、L2 才走完整 DoD 与全量四项；技能按级别豁免；细则见 `docs/skills-and-subagents.md` |
| 2026-10-21 | **项目级只读子代理 case-reviewer / verifier** | 用 `.opencode/agents/*.md`（Markdown frontmatter + permissions 规则，随仓库同步）；两者都 `edit: deny` + 禁派子代理，`case-reviewer` 的 shell 只放行 `git diff/status/log/show`，并追加 deny `git *--output*` 与 `*>*`（否则 `git diff --output=file`、`> file` 能借只读命令写文件）；`verifier` 开放 shell 但只用于跑验证（靠 prompt 约束，非硬隔离）；仅 L2 审查/验收使用，L0/L1 不派 |
| 2026-10-21 | **superpowers 重装为完整安装，技能实体统一 `~/.agents/skills`** | 旧安装只有 `SKILL.md`，缺官方 prompts/scripts/references；用 `npx skills add obra/superpowers -g -a opencode -s "*" --copy -y` 重装（`--copy` 不建 symlink）。踩坑：同名技能按**固定优先级覆盖**（`~/.config/opencode/skills` > `~/.agents/skills` > `~/.claude/skills` > 内置），旧副本留在 config 目录就会盖住新版，且**日志不一定报** duplicate（.config/.agents 这次完全没报），只能靠 `api get /api/skill` 看 path 才发现；已清空 `~/.config/opencode/skills`，`frontend-design` 留 `~/.claude/skills` 真实目录。以后升级用 `npx skills update -g` |
| 2026-10-21 | **详情页 tab 指示器 + 吸顶对齐 + notes 首屏无闪** | 主色胶囊用 transform 滑动（0.18s，带柔和阴影）；移除 `v-show` 面板重播动画；首次 notes 用 `rendered` 事件 + 临时 min-height 等正文完成后再滚；吸顶目标用零高度锚点，避开 sticky `offsetTop` 漂移；系统开启「减少动态效果」时，全局仍关闭其余动效，但指示器显式保留短滑，避免被 0.01ms 规则压成瞬移；1200/375、快速连点、减少动态效果实测通过 |
| 2026-10-21 | **UTF-8 插件必须用 V2 格式，挂 shell 层的 `create.before`** | v2.1.1 起 V1「返回 hook 对象」的实现不再运行，表现为启动日志 `failed to load plugin` + 中文乱码复发（本次先复现：裸跑中文命令输出乱码）。改写为 `export default Plugin.define({ id, setup })` + `ctx.shell.hook("create.before")`；选 shell 层而非 `tool.execute.before`，是因为工具名从 `bash` 变 `shell` 后按名匹配会失效；用 `event.shell` 判断只对 PowerShell 注入。验收：`/api/plugin` 中 `utf8-encoding` = `active` + 裸跑中文命令正常 |
| 2026-10-21 | **案例资源改懒加载：registry 拆「同步 meta + 异步资源」** | 四个 glob 全 eager 时 62 份 Demo 源码 + 教学代码（约 750 KB 文本，`//!` 标记 735 处与主包完全对应）被逐字内联，首屏 gzip 521 KB。改为 `meta.ts` 保持 eager（列表/搜索要同步拿 62 条标题），Demo / `?raw` / `code/*.txt` 走动态 import；`loadDemoComponent` / `loadCaseSource` 用 Promise 缓存，失败清缓存允许重试。首屏降到 91 KB |
| 2026-10-21 | **Element Plus 样式改按需（推翻 2026-10-20「整包主题统一」决策）** | 全站只有 `debounce-throttle` / `json-viewer` / `vitest-gate` 用 EP，整包 `index.css` 353 KB（产物 549 KB）性价比极低。改 `importStyle: 'css'` + `theme-chalk/base.css` + `dark/css-vars.css`，组件样式随 Demo chunk 下发；`base.css` 必须留在入口 CSS，否则官方变量晚于 `_element.scss` 生效，浅色主题会被默认蓝覆盖 |
| 2026-10-21 | **Rolldown 分包用 `codeSplitting.groups` + priority，不用 `manualChunks`** | Vite 8 底层是 Rolldown，`manualChunks` 会被转成单个 codeSplitting 组，且组默认 `includeDependenciesRecursively: true`，把 Vue 运行时卷进 element-plus chunk → 入口被迫预加载 218 KB 且 EP 变成首屏依赖。改用显式分组：Vue 优先级最高先被认领，EP 组关闭递归收编，`theme-chalk` 的 CSS 不参与分组（留在入口保证覆盖顺序） |
| 2026-10-21 | **新增体积门禁 `npm run check:bundle` 并接入 CI** | 体积回归不会让单测变红（eager glob 就是例子）。脚本读 `dist/index.html` 的首屏资源，校验：首屏 gzip ≤180 KB、非 pdf 单 chunk ≤600 KB、首屏 JS 不得出现「//! 中文」教学标记；CI 在 build 后执行，红灯直接拦住合并 |
| 2026-10-21 | **全局搜索扩到 notes 正文：索引空闲构建、纯函数可单测** | 标题/摘要/标签继续同步匹配，正文索引在首次打开弹窗后 `requestIdleCallback` 构建（并发 6、单例缓存、边读边刷新），首屏不多下载 190 KB；匹配与片段逻辑放 `utils/search-index.ts` 纯函数（16 条单测），组件只负责调度；正文结果用 `<mark>` 高亮（不用 `v-html` 防注入），片段两行截断；键盘选择只在关键词变化时重置，避免增量结果把选中项弹回第一条 |
| 2026-10-21 | **构建产物按「类型 → 用途 → 案例」分目录** | 265 个 chunk 全平铺在 `assets/` 里，排查和缓存策略都没法按类处理。`entryFileNames` 固定入口；`chunkFileNames` 用 `facadeModuleId` 把案例 chunk 归到 `js/cases/<分类>/<案例>/`（Demo / Demo.source / 教学代码 / notes），vendor、pages、lib、workers 各自成目录；`assetFileNames` 按扩展名与 `originalFileNames` 把样式归到 `css/{vendor,pages,cases,themes}`，图片/字体/worker 分到 `media`/`fonts`/`js/workers`。只改路径不改体积，`check:bundle` 同步改递归扫描 |
| 2026-10-21 | **浏览器验收统一走 `npm run check:ui`，禁止临时 Chrome 脚本** | 各会话临时脚本只 kill 父进程、部分没加 `--headless`、每轮新建 profile，累计 111 个 chrome 进程 + 41 个目录（2 GB），桌面不断弹窗。统一脚本：headless、`--remote-debugging-port=0`、固定 `node_modules/.tmp/chrome-check`、退出 `taskkill /T /F` 并重试清理；默认验 preview（4173，可 `--base` 指 dev），失败返回 1。场景从 5 个扩到 7 个：首页 / 列表 / 详情源码按需（+ 相关案例、上下篇断言）/ EP 样式 / 列表难度筛选 / 无效路由兜底 / 375px |
| 2026-10-21 | **新分类 `css` / `basics` 前置且不合并，入门案例先讲现象再讲原理** | 用户要求补入门、简单常用的例子（可偏 CSS）。拆成「CSS 技巧」与「浏览器基础」两个分类，放在分类列表最前（查阅读顺序）；案例仍走四件套 + notes 五段，Demo 默认停在「错误/旧做法」那一侧，先看到问题再切正确做法 |
| 2026-10-21 | **选题边界：新分类讲「特性怎么用」，存量案例仍讲「机制为什么」** | 存量 62 个案例里 `reactive-*` / `v-memo` / `time-slicing` 讲的是机制，新分类补齐「CSS 特性怎么用」「浏览器原生 API 怎么用」这类日常高频但原理较轻的内容；`practice/dynamic-chunk` 与 `practice/vite-split` 的界线固定为「运行时动态 import 实测」vs「构建期怎么拆包」，避免两个案例讲同一件事 |
| 2026-10-21 | **`type-check` 必须用 `vue-tsc -b`** | 根 `tsconfig.json` 只有 `files: []` + references，`vue-tsc --noEmit` 在这种情况下什么都不检查（本次 build 暴露 12 处类型错误才发现）。改为构建模式后才会真正检查 `tsconfig.app.json` / `tsconfig.node.json` 引用的全部文件；CI 与本地口径一致 |
| 2026-10-21 | **布局偏移 / 容器查询的测量必须「页面可见 + 强制布局」** | `layout-shift` 条目在 `document.visibilityState === 'hidden'` 时根本不产生，rAF 也会被节流，headless 用旧模式（非 `--headless=new`）同样会假阴性；容器查询的 `getComputedStyle` 要读一次 `offsetWidth` 强制结算后再取值。Demo 内统一：`measureDirs` 强制布局 + 双 rAF，另加 120ms 定时器兜底（后台标签页不靠 rAF）；切换占位模式 / 清空列表产生的偏移延迟 220ms 再清零，只统计「图片逐张加载」的账 |
| 2026-10-21 | **相关案例不足 3 个时用同分类补齐** | 新分类里的独立技巧常常没有共享标签，纯按标签匹配会出现空块；改为「标签命中优先，不够 3 个用同分类其他案例补足」，保证详情页底部始终有可继续点击的入口 |
| 2026-10-22 | **新增 `animation` 分类，只收「日常高频的动画 / 交互细节」，与 `css` 分工** | 用户点名参照 `practice/ripple-button`，要更多入门常用的动画与样式案例。`css` 收纯布局/特性技巧（grid、容器查询、clamp 等），`animation` 收「一次点击/悬停/展开能看到的动效与交互」（骨架屏、折叠、抽屉、进度环、磁性按钮、吸附轮播、提示气泡、焦点环）；仍是一案例一演示、四件套、notes 五段 |
| 2026-10-22 | **动画案例的「数据对比」用行为指标，不编造耗时** | 这类案例的收益是体验与正确性（节点是否残留、要读几次高度、焦点是否可见），不是可稳定测出的毫秒；notes 第 4 段统一改用「读取 scrollHeight 次数 / 监听器个数 / 手算距离处数 / CSS 声明条数 / 触发分支数」等可核对口径，演示面板同步显示计数，避免跨环境测量的假精度 |
| 2026-10-22 | **`check:ui` 增加动画分类逐页抽检，而不是给 8 个案例各写一套断言** | 动画案例交互差异大，逐例定制脚本维护成本高；统一断言「375px 无横向溢出 + 演示区有内容 + 有可操作按钮 + 控制台零报错」，再靠人工走查覆盖「动效是否好看、对比是否有说服力」 |
| 2026-10-22 | **单个 bug 修复固定走 L1 + `check:ui --only`** | 用户反馈「改一个抽屉花了近 40 分钟」：单案例修复却跑了两次 16 场景全量验收、build、bundle、preview。改为：读相关片段（不整文件通读）→ 一次最小探针确认根因 → 改 → 单案例 eslint + type-check + `check:ui --only <场景>`；只有根因需要长期防回归时才补常驻断言，且不影响单次验收时长 |
| 2026-10-22 | **影响面超过 1 个案例先问，文档按批次合并** | 8 个动画案例都受系统 reduce 影响时，先让用户选「只修一个 / 统一改 / 全局放行」；`AGENTS.md` 的进度与决策在批次收尾一次写，不再每修一处追加一段、单独 commit |
| 2026-10-27 | **质量升级先建基线：静态体检只查机器能判断的，浏览器巡检兜住渲染** | 81 个案例靠人逐个翻容易漏，新增 `npm run audit:cases`（文件结构 / meta 长度 / notes 五段 / 过时命令 / 清理函数 / aria）与 `check:ui --case`、`--sweep`；静态体检把「约/左右」「document.getElementById」「缺 aria-pressed」标成 P2 工作项，不阻塞批次；真实溢出、未挂载、console.error/warn 由 `--sweep` 在 375px 下兜住。批 0 结果 0 P0 / 0 P1 / 22 P2，81/81 巡检通过 |
| 2026-10-27 | **案例里的 CI 门禁必须和仓库真实脚本一致** | `vitest-gate` 原来写覆盖率阈值，仓库根本没有 coverage 配置；改为真实的五步：`type-check`（`vue-tsc -b`）、`lint`、`test`（`vitest run`）、`build`、`check:bundle`，并补 `package.json` 的 `test` 脚本。`vite-split` 原来只写 `manualChunks`，改为 Vite 8 的 `codeSplitting.groups`，同时保留旧版写法说明；第 4 段换成 `npm run build` + `check:bundle` 的真实数据（首屏 gzip 108.9 KB） |
| 2026-10-27 | **机械 P2 先清一轮，行为敏感的改动补常驻断言** | 4 处 `document.getElementById` 统一改模板 ref：能拿容器就 `querySelector` 限定范围（accordion-slide 的 `faqRoot`），观察器 root 直接传 ref（infinite-scroll / lazy-image 的 `scrollRoot`），挂载点直接传 ref（perf-observer 的 `shiftZone`）；教学代码同步，避免「Demo 改了、代码区还是旧写法」。这 4 处会改变交互路径，给 accordion / infinite-scroll / lazy-image / perf-observer 各补一个常驻场景（读取 scrollHeight、预取页数、加载张数、偏移块是否插入），以后 `getElementById` 回归会先在浏览器巡检里露头。`check:ui` 的 `waitForDemo` 同时改为等占位符消失，否则 dev 首次编译会把「演示加载中…」当完成；`--case` 不再硬性要求按钮，无限滚动这类靠滚动触发的演示也能过 |
| 2026-10-27 | **「约/左右」P2 先区分方向词与估算词，再逐个换成可核对口径** | `audit:cases` 原来把「左右移动 / 箭头 / 两列 / 两侧」也当估算词；改为只报「数字 + 左右」与「约 / 大约 / 估计」。真实估算逐条处理：能数语句就数（snap-carousel 5 行、has-parent 30 行、intl-format 26 行），能用规范值或配置值就写死（4ms、16.6ms、100ms、300ms），不能稳定的写清测量方法与区间（event-loop 1~5ms）。`intl-format` 还暴露了生产构建压缩后 `Function.prototype.toString()` 只剩 1 行的问题，行数改静态值并加 `Intl 行数` 巡检，避免 dev 正常、preview 失真 |
| 2026-10-27 | **P2 收尾不只替换估算词，顺手修正与代码不一致的旧数据** | 清「约/左右」时发现两类问题：`raf-throttle` 把「每秒」写成「每分钟」；`sse-chat` 的 notes/meta 还停留在「每 120ms、1.2s id 2/36」，而 Demo 实际是 150~390ms 随机延迟，1.2s 的快照不稳定。处理原则：能用规范值或配置值写死的就写死（4ms、16.6ms、100ms、300ms、3000ms），随机/区间数据写清来源与范围，删掉无法复现的单点快照；代码能静态统计的不要依赖生产构建后的 `toString()` |
| 2026-10-27 | **事件循环用「预设 + 任务开关」，直觉顺序按勾选动态生成** | 写死预期序列在用户关掉任务后会失真；预设只负责批量勾选，`run()` 只排当前勾选的任务，`expectLines` 按书写顺序动态生成错误对照。输出对照是互斥模式，统一用 `role="radio"` + `aria-checked` + roving tabindex；`audit:cases` 同步接受 `aria-pressed` 或 radio 两种语义。重复运行用 `runToken` + `timerIds` 丢弃旧回调，避免日志串台 |
| 2026-10-27 | **时间切片固定三项测量口径：首帧 nextTick + 双 rAF、最大阻塞每批、点击响应 event.timeStamp** | 首帧不能在 push 后立刻读；`nextTick` 只等 DOM 更新，双 rAF 才等到绘制。最大阻塞按每批 `push + nextTick` 计时，避免总耗时掩盖单批卡顿；点击响应用 `event.timeStamp` 起算，才能把主线程排队时间算进去。参数变化清空对比结果，避免不同规模硬比；全量渲染期间按钮点不到，所以全量一列的点击响应为「—」 |
| 2026-10-28 | **演示区按钮/对比组统一用 Element Plus，提示用共享 DemoToastStack** | 用户明确要求「都使用 Element Plus 的按钮」。EP 使用范围从通用表单控件扩到演示区按钮与单选按钮组：`el-button` / `el-radio-group` 自带语义与键盘行为，样式由 `_element.scss` 在 `.demo-card` 内统一为 36px（移动端 40px）高、站点圆角。提示仍用共享 `DemoToastStack`（右上角、顶栏下方 80px），因为 EP `ElMessage` 默认顶部居中，且 toast-queue 这类教学案例需要自定义队列；这是「Demo 不引用站点内部组件」的唯一例外，仅限演示区 UI。站点壳仍自建，Pinia 仍禁止。按批次迁移，不一次性改 81 个案例 |
| 2026-10-28 | **演示区 UI 换挡 Naive UI（推翻同日 EP 方案）** | 用户看过 spike 对比页（`/spike/ui-compare`）后拍板：Naive 默认观感更好，长期只需维护 `themeOverrides` 的颜色映射，不用像 EP 那样写整份 `_element.scss` 覆盖层。实施要点：① 主题映射收敛到 `useNaiveTheme.ts`（浅/暗 token 镜像 + 组件级高度 36px），演示区经共享 `DemoNaive.vue`（abstract provider）包裹；**provider 不能放 App.vue**，barrel import 会把整个 naive-ui 拉进首屏（实测 gzip 211.8 KB 爆门禁），放 Demo 内才保持懒加载，首屏降到 106.6 KB；② `vendor-naive-ui` 分包组必须**开启递归收编**：naive 依赖 css-render/vooks/lodash 等是独立 npm 包，关闭递归会被内联进 Demo chunk 形成跨 chunk 循环 import，生产构建报 `Lt is not a function`（dev 正常、只有 preview 挂，容易漏测）；Vue 运行时由 vendor-vue priority 100 先认领，不会被卷走——EP 当年关递归是因为 theme-chalk CSS，Naive 是 CSS-in-JS 无此问题；③ `n-radio-button` 选中类名是 `n-radio-button--checked`（EP 是 `is-active`），`@change` 对应 `@update:value`，红色按钮类型是 `error`（EP 叫 `danger`），n-select 选项走数组（EP 是 el-option 子组件） |
| 2026-10-29 | **演示区提示统一用 Naive message，删掉自建 toast** | 用户要求「用人家现成的组件，不要自己写」。`NMessageProvider` 放进共享 `DemoNaive.vue`（`placement="top"` 顶部居中 / max 3 / 2400ms），容器由 provider Teleport 到 body，天然不进文档流；但 Demo 是 provider 的**父级**（Demo 里包 DemoNaive），setup 里 `inject` 拿不到 `useMessage()`，所以加 `DemoMessageBridge.vue` 在 provider 内部挂载时把 api 注册到 `composables/useDemoMessage.ts` 的模块级变量，案例里直接 `demoMessage.success/error(...)`（调用时现取 api，规避 setup 早于 bridge 挂载的时序问题）。`DemoToastStack.vue` 随之删除；toast-queue 这类「教你怎么写 toast」的案例仍自建，属于教学内容不算重复造轮子。`check:ui` 断言改 Naive DOM（`.n-message--success-type` / `--error-type` / `.n-message-container--top` / 容器不在演示区内 / 首条消息水平居中） |
| 2026-10-29 | **演示区 Naive provider 上移到 `CasePage`，全局按「按钮 + 互斥模式组」分类分批迁移** | 81 个案例要迁 n-*，若沿用「每个 Demo 自己包 DemoNaive」就得逐页套壳、且 Demo 作为 provider 父级拿不到 `useMessage()`，只能靠模块级桥接。改为在 CasePage 只包一次：Demo 成为 provider 子组件，`inject` 与 `useMessage()` 都正常，桥接层删除。代价是 naive-ui 随 pages chunk 在**每个案例页**加载（首屏不受影响，仍 106.6 KB gzip），换来案例代码可以照官方写法写。迁移口径（用户拍板）：本轮只换按钮与互斥模式组，输入框/开关/下拉下一轮；按分类分批，每批停等确认；`ripple-button` / `magnetic-button` / `snap-carousel` 箭头等「按钮本身就是演示主体」的保留自定义样式，在 notes 第 5 段注明 |
