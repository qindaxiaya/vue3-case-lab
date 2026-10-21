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
- **远程仓库**：https://github.com/qindaxiaya/vue3-case-lab（公开，2026-10-20 为启用 ruleset 由私有转公开），单 `main` 分支；合并必须走 PR + 必需检查

## 约定

- 全程中文界面、中文说明文案；变量/函数/文件名英文
- **Windows 中文乱码（2026-10-20 根治，2026-10-21 迁移 V2 插件格式）**：opencode 以 `-NoProfile` 启动 Windows PowerShell 5.1，控制台/管道默认 GBK(936)，而 opencode 按 UTF-8 解码，中文输出就成乱码。全局插件 `~/.config/opencode/plugins/utf8-encoding.ts` 现在必须是 V2 写法（`export default Plugin.define({ id, setup })` + `ctx.shell.hook("create.before")`），对 PowerShell 命令自动前置 `[Console]::OutputEncoding=...UTF8`；V1 的「返回 hook 对象」写法在 v2.1.1 会直接加载失败（日志 `Plugin must export a default definition ... Missing key at ["default"]`，即表现为乱码复发）。验证两条：`opencode api get /api/plugin` 出现 `utf8-encoding` 且 `state.status=active`；不带前缀跑中文命令能正常显示。`--pure` 模式不加载插件，必须手工加同样设置
- **站点自身全部代码写中文注释**（组件/composable/工具/路由），关键逻辑逐行注释「做什么、为什么」，与案例代码同等标准
- TS strict，禁止 `any`（确需时用 `unknown` + 收窄）；ESLint `no-explicit-any` 为 error
- 组件 `<script setup lang="ts">`，组件 PascalCase，文件 kebab-case
- 禁止第三方 UI 组件库、禁止 Pinia；样式用 Sass（SCSS）+ CSS 变量主题，自建全局类 `btn-primary`/`btn-ghost`/`card`/`tag`，案例 Demo 用自身 scoped SCSS
  - 例外（2026-10-20 试点）：Element Plus 允许用于 Demo 通用表单控件（输入框 / 下拉 / 多行输入），必须按需引入（unplugin-vue-components + ElementPlusResolver），禁止 `app.use(ElementPlus)` 整包注册；站点壳与教学型组件（Toast/Teleport/弹窗/可编辑表格/自定义指令等）仍自建；Pinia 仍禁止
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
  3. UI 组件库仅允许 Element Plus 通用表单控件（2026-10-20 试点，按需引入）；Toast 这类「教学如何做组件」的案例仍自建（注明真实项目可用 vue-toastification 等）
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
- **完成前强制验证清单（2026-10-19 教训固化；2026-10-21 收敛：完整清单只用于 L2 新案例/跨模块，L0/L1 按上方分级与影响面验证）**：
  1. 按 `docs/case-definition-of-done.md` 逐条验收（Demo 稳定性 / 对比开关 / 实测数据 / notes 五段 / meta.sell / 375px）
  2. `npx vitest run`（含真实 glob 收录链路 + 内容质量门禁：SBAC 四段齐全 / 卖点≤30 字、摘要≤40 字 / 说明区禁未解释缩写 / notes 五段 / 标题可被搜索命中——新增案例自动扩展校验）
  3. `npm run type-check`、`npm run lint`、`npm run build`
  4. dev 页面实测：案例页可交互、刷新无控制台告警、路由往返状态正确
  5. 有页面交互变化时，dev 地址交用户人工走查（机器验证不能替代）
  6. 未跑完清单不得宣称"完成"；宣称前先有 fresh 证据（已通过全局 superpowers skills 提供，用 skill 工具加载 `verification-before-completion`）
- 每任务收尾必更新本文件「当前进度」段；重大取舍记入「决策记录」

## 当前进度

- **阶段**：共 62 案例 / 6 分类（composables 1 · observer 5 · virtual 3 · performance 11 · vue3 17 · practice 25）；「不造轮子」「框架案例抽离」「一案例一演示」约定已固化
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
- dev 地址：当前主工作区 `http://localhost:5173/`，列表 `/cases`，案例页 `/cases/performance/perf-observer`

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
| 2026-10-21 | **浏览器验收统一走 `npm run check:ui`，禁止临时 Chrome 脚本** | 各会话临时脚本只 kill 父进程、部分没加 `--headless`、每轮新建 profile，累计 111 个 chrome 进程 + 41 个目录（2 GB），桌面不断弹窗。统一脚本：headless、`--remote-debugging-port=0`、固定 `node_modules/.tmp/chrome-check`、退出 `taskkill /T /F` 并重试清理；内置 5 个场景、失败返回 1 |
