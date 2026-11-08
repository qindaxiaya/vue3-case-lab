# admin 第五批 5 个后台组件案例 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `admin` 分类新增 5 个自包含后台案例：跨页选择、批量删除撤销、日期范围快捷筛选、会话过期提醒、行快速查看，并完成 DoD、截图、文档与 PR。

**Architecture:** 每个案例仍按四件套自包含：`Demo.vue` 演示交互、`meta.ts` 元数据与 SBAC、`notes.md` 五段资料、`code/*.txt` 教学代码。案例之间不抽公共业务组件；演示区控件继续使用 Naive UI，共享主题由 `CasePage` 的 `DemoNaive` 提供。`check:ui` 每个案例新增一个常驻场景，断言关键状态、失败路径与重置。

**Tech Stack:** Vue 3.5 `<script setup lang="ts">`、TypeScript strict、Sass scoped、Naive UI（按需）、Vite、Vitest、`npm run check:ui`。

**Spec:** `AGENTS.md` 的「案例目录结构」「案例完成标准」「不造轮子」「框架与案例抽离」约定；案例质量细则见 `docs/case-definition-of-done.md`。

## Global Constraints

- 中文界面与中文注释；变量 / 函数 / 文件名英文。
- TS strict，禁止 `any`；ESLint `no-explicit-any` 为 error。
- Demo 不引用站点内部组件；演示控件用 Naive UI，按钮 / 单选组 / 输入框 / 勾选等按需自动导入。
- 一个案例一个演示；错误 / 旧做法与正确做法可在同一 Demo 内对照，但不拆多演示 tab。
- 每个案例必须有：可重置、卸载清理定时器 / 监听器、375px 无横向溢出、`data-stat` 面板可核对。
- `meta.sell` ≤30 字，`meta.summary` ≤40 字，`explain` 四段齐全。
- `notes.md` 五段：现象 / 原理 / 关键代码（3 处为什么）/ 数据对比（实测口径）/ 追问与边界（踩坑 ≤3）。
- `CASES.md` 由 `npm run gen:cases` 生成，禁止手改。
- 375px 浅 + 暗截图放 `docs/screenshots/admin/<案例>/`，截图不入 CI。
- 不新增依赖；不抽通用 DataTable / Form / 选择器 / 会话管理组件。

## Review Focus

- 跨页选择：翻页后已选项必须保留；「选择本页」不能选中其他页；「选择全部筛选结果」只并入当前筛选命中的行，不能把被筛掉的行也选上。
- 批量删除撤销：删除后行立即消失；撤销按原顺序恢复；3 秒后撤销入口消失且不能再恢复；再次删除时上一批不可再撤销。
- 日期范围：结束日期必须包含当天；结束早于开始时只提示错误，不能悄悄改变上一次结果；快捷选项与自定义输入必须互相同步。
- 会话过期：活动只在 `active` 阶段重置倒计时；`warning` 阶段必须点「继续使用」才续期；`expired` 后只能重新登录；卸载要清掉定时器。
- 快速查看：抽屉只读，不修改列表；上一条 / 下一条在边界禁用；关闭后焦点必须回到打开它的那一行按钮。

---

### Task 1: 跨页选择 `admin/cross-page-selection`

**Files:**
- Create: `src/examples/admin/cross-page-selection/Demo.vue`
- Create: `src/examples/admin/cross-page-selection/meta.ts`
- Create: `src/examples/admin/cross-page-selection/notes.md`
- Create: `src/examples/admin/cross-page-selection/code/cross-page-selection.ts.txt`
- Modify: `scripts/check-ui.mjs`（在 admin 场景区新增 `跨页选择保留与筛选全选`）

**Interfaces:**
- `Row`：`{ id: number; name: string; status: 'pending' | 'done'; owner: string }`，共 10 条；id 1~6 为 `pending`，7~10 为 `done`。
- `PAGE_SIZE = 5`。
- 状态：`selectedIds = ref<Set<number>>(new Set())`、`page = ref(1)`、`status = ref<'all' | 'pending' | 'done'>('all')`。
- 计算：`filteredRows`、`pageRows`、`pageAllSelected`、`pageIndeterminate`、`selectedCount`、`filteredCount`、`pageCount`。
- 动作：`toggleRow(id)`、`togglePage()`、`selectFiltered()`、`clearSelection()`、`setStatus(value)`、`prevPage()`、`nextPage()`、`reset()`。
- `data-stat`：`selected-count`、`page-count`、`filtered-count`、`page-index`、`filter-status`、`page-all`。
- 选择器：`.cps-demo`、`[data-row-check="<id>"]`、`[data-row="<id>"]`、`[data-action="select-page"]`、`[data-action="select-filtered"]`、`[data-action="clear"]`、`[data-action="prev"]`、`[data-action="next"]`、`[data-action="reset"]`、`.cps-filter`。

- [ ] **Step 1: 写 `check:ui` 失败场景**

场景 `跨页选择保留与筛选全选`，路由 `/cases/admin/cross-page-selection`。断言：
- 初始：已选 0、第 1 页、本页 5 行、筛选后 10 行。
- 勾选第 1 行：已选 1。
- 点下一页：已选仍为 1；点「选择本页」：已选 6。
- 切筛选「待处理」：筛选后 6 行、已选 6、回到第 1 页。
- 切筛选「已完成」：筛选后 4 行、已选仍为 6；点「选择全部筛选结果」：已选 10。
- 点「清空选择」：已选 0。
- 切筛选「待处理」并点「选择全部筛选结果」：已选 6；点下一页：已选仍为 6。
- 点「重置」：已选 0、筛选「全部」、第 1 页。

- [ ] **Step 2: 运行场景确认失败**

Run: `npm run check:ui -- --base http://localhost:5174 --only 跨页选择`
Expected: 路由不存在 / 演示区找不到 `.cps-demo`。

- [ ] **Step 3: 实现 Demo**

顶部是筛选单选组与「选择本页 / 选择全部筛选结果 / 清空选择 / 重置」按钮；中间是表格，每行一个 `n-checkbox`，表头一个支持半选的 `n-checkbox`；底部是上一页 / 下一页与计数。已选集合用 `Set` 保存，翻页与筛选只改变可见行，不清空集合；「选择本页」只并入当前页 id；「选择全部筛选结果」只并入当前筛选命中的 id；清空与重置清空集合。表头勾选只作用于当前页，半选状态由本页已选数量派生。按钮用 `n-button`，筛选组用 `n-radio-group`。

- [ ] **Step 4: 补齐 meta / notes / code**

标题「CrossPageSelection：翻页后已选不能丢」；sell「跨页保留勾选，全选只作用于筛选结果」；summary「用 Set 保存跨页选择，本页全选与筛选全选分开」。
notes 第 3 段标 3 处：`Set` 跨页保存、本页全选与筛选全选的范围、半选状态派生。第 4 段用场景实测 0/5/10、1、6/6、10、6 等。
`code` 与 Demo 同源，标 `//!` 重点行。

- [ ] **Step 5: 验证**

Run: `npx eslint src/examples/admin/cross-page-selection scripts/check-ui.mjs --max-warnings 0 && npm run type-check && npm run check:ui -- --base http://localhost:5174 --only 跨页选择`
Expected: 场景通过。

---

### Task 2: 批量删除撤销 `admin/batch-delete-undo`

**Files:**
- Create: `src/examples/admin/batch-delete-undo/Demo.vue`
- Create: `src/examples/admin/batch-delete-undo/meta.ts`
- Create: `src/examples/admin/batch-delete-undo/notes.md`
- Create: `src/examples/admin/batch-delete-undo/code/batch-delete-undo.ts.txt`
- Modify: `scripts/check-ui.mjs`（新增 `批量删除撤销与超时`）

**Interfaces:**
- `Row`：`{ id: number; name: string; owner: string }`，共 8 条。
- `UNDO_MS = 3000`。
- 状态：`rows = ref<Row[]>([...])`、`selectedIds = ref<Set<number>>(new Set())`、`pending = ref<{ ids: number[]; expiresAt: number } | null>(null)`、`remaining = ref(0)`、`timer: ReturnType<typeof setInterval> | null`。
- 动作：`toggleRow(id)`、`toggleAll()`、`deleteSelected()`、`undoDelete()`、`finalizePending()`、`reset()`。
- `data-stat`：`row-count`、`selected-count`、`undo-count`、`remaining`、`status-text`。
- 选择器：`.bdu-demo`、`[data-row="<id>"]`、`[data-row-check="<id>"]`、`[data-action="delete"]`、`[data-action="undo"]`、`[data-action="reset"]`。

- [ ] **Step 1: 写失败场景**

场景 `批量删除撤销与超时`。断言：
- 初始：8 行、已选 0。
- 勾选 2 行后删除：剩 6 行、已选 0、撤销条显示 2 条、剩余秒数 1~3。
- 点「撤销删除」：恢复 8 行、撤销条消失、剩余 0。
- 再勾选 1 行删除：剩 7 行；等待 3400ms 后仍是 7 行、撤销条消失。
- 点「重置」：恢复 8 行、已选 0。

- [ ] **Step 2: 运行确认失败**

Run: `npm run check:ui -- --base http://localhost:5174 --only 批量删除`
Expected: 路由不存在。

- [ ] **Step 3: 实现 Demo**

表格 + 行勾选 + 表头全选 + 删除按钮。删除时立即从 `rows` 移除并保存被删行快照与过期时间，启动 100ms 间隔的倒计时刷新 `remaining`；撤销按原索引顺序插回；到期只清空 `pending`。再次删除时先丢弃上一批撤销入口，再开始新一批。倒计时条固定在演示区内、不推挤表格；按钮用 `n-button`，勾选用 `n-checkbox`。卸载时清掉定时器。

- [ ] **Step 4: 补齐 meta / notes / code**

标题「BatchDeleteUndo：删错了要能撤回来」；sell「批量删除先移除再给 3 秒撤销窗口」；summary「删除保存快照，撤销按原顺序恢复，超时不可再撤」。
notes 第 3 段标 3 处：快照与过期时间、原顺序恢复、定时器清理。第 4 段用场景实测 8→6→8、8→7、3 秒窗口。

- [ ] **Step 5: 验证**

Run: `npx eslint src/examples/admin/batch-delete-undo scripts/check-ui.mjs --max-warnings 0 && npm run type-check && npm run check:ui -- --base http://localhost:5174 --only 批量删除`
Expected: 场景通过。

---

### Task 3: 日期范围快捷筛选 `admin/date-range-presets`

**Files:**
- Create: `src/examples/admin/date-range-presets/Demo.vue`
- Create: `src/examples/admin/date-range-presets/meta.ts`
- Create: `src/examples/admin/date-range-presets/notes.md`
- Create: `src/examples/admin/date-range-presets/code/date-range-presets.ts.txt`
- Modify: `scripts/check-ui.mjs`（新增 `日期范围快捷筛选与自定义校验`）

**Interfaces:**
- `Record`：`{ id: number; title: string; date: string; amount: number }`，共 12 条，`date` 为 `YYYY-MM-DD`。
- 固定基准日：`BASE_DATE = '2026-11-08'`。
- `Preset = 'today' | '7d' | '30d' | 'custom'`。
- 状态：`preset = ref<Preset>('7d')`、`draftStart = ref('2026-11-02')`、`draftEnd = ref('2026-11-08')`、`appliedStart = ref('2026-11-02')`、`appliedEnd = ref('2026-11-08')`、`error = ref('')`。
- 动作：`applyPreset(preset)`、`applyCustom()`、`reset()`、`formatDate(date)`。
- `data-stat`：`preset`、`result-count`、`range-text`、`error-text`。
- 选择器：`.drp-demo`、`[data-preset="today"]`、`[data-preset="7d"]`、`[data-preset="30d"]`、`[data-field="start"] input`、`[data-field="end"] input`、`[data-action="apply-custom"]`、`[data-action="reset"]`。

- [ ] **Step 1: 写失败场景**

场景 `日期范围快捷筛选与自定义校验`。断言：
- 初始：预设「近 7 天」、结果 6 条、范围 `2026-11-02 ~ 2026-11-08`、无错误。
- 点「今天」：结果 2 条、范围 `2026-11-08 ~ 2026-11-08`。
- 点「近 30 天」：结果 10 条、范围 `2026-10-10 ~ 2026-11-08`。
- 自定义开始 `2026-10-31`、结束 `2026-11-06`，点「应用自定义」：结果 5 条、预设「自定义」、无错误。
- 自定义开始 `2026-11-06`、结束 `2026-11-01`，点「应用自定义」：错误「结束日期不能早于开始日期」、结果仍为 5 条。
- 点「重置」：预设「近 7 天」、结果 6 条、无错误。

- [ ] **Step 2: 运行确认失败**

Run: `npm run check:ui -- --base http://localhost:5174 --only 日期范围`
Expected: 路由不存在。

- [ ] **Step 3: 实现 Demo**

顶部是快捷单选组与两个日期文本框（`n-input`，占位 `YYYY-MM-DD`）加「应用自定义」按钮；下面是结果列表与范围 / 错误提示。快捷选项用固定基准日计算起止（本地日期格式化，避免 `toISOString()` 的时区偏移）；自定义只更新草稿，点「应用自定义」才校验并应用；结束日期用 `<=` 比较，保证包含当天；错误时只提示，不改上一次结果。结果按 ISO 字符串比较。重置回到「近 7 天」。

- [ ] **Step 4: 补齐 meta / notes / code**

标题「DateRangePresets：快捷日期别各算各的」；sell「今天 / 7 天 / 30 天与自定义共用一套范围」；summary「快捷项生成起止，自定义先校验再应用，结束日包含当天」。
notes 第 3 段标 3 处：本地日期格式化、快捷与自定义共用 `appliedStart/appliedEnd`、结束日包含。第 4 段用场景实测 2/6/10/5 条与错误路径。

- [ ] **Step 5: 验证**

Run: `npx eslint src/examples/admin/date-range-presets scripts/check-ui.mjs --max-warnings 0 && npm run type-check && npm run check:ui -- --base http://localhost:5174 --only 日期范围`
Expected: 场景通过。

---

### Task 4: 会话过期提醒 `admin/session-expiry`

**Files:**
- Create: `src/examples/admin/session-expiry/Demo.vue`
- Create: `src/examples/admin/session-expiry/meta.ts`
- Create: `src/examples/admin/session-expiry/notes.md`
- Create: `src/examples/admin/session-expiry/code/session-expiry.ts.txt`
- Modify: `scripts/check-ui.mjs`（新增 `会话过期提醒与续期`）

**Interfaces:**
- `Phase = 'active' | 'warning' | 'expired'`。
- `SESSION_SECONDS = 6`、`WARN_SECONDS = 2`、`TICK_MS = 1000`。
- 状态：`remaining = ref(SESSION_SECONDS)`、`phase = ref<Phase>('active')`、`activityCount = ref(0)`、`timer: ReturnType<typeof setInterval> | null`。
- 动作：`touch()`、`extend()`、`logout()`、`relogin()`、`reset()`、`startTimer()`、`stopTimer()`。
- `data-stat`：`remaining`、`phase`、`activity-count`、`warning-visible`。
- 选择器：`.se-demo`、`[data-phase]`、`[data-action="activity"]`、`[data-action="extend"]`、`[data-action="logout"]`、`[data-action="relogin"]`、`[data-action="reset"]`。

- [ ] **Step 1: 写失败场景**

场景 `会话过期提醒与续期`。断言：
- 初始：剩余 6 秒、阶段 `active`、警告不可见。
- 等剩余小于 6 后点「模拟活动」：剩余回到 6、活动计数 1、阶段仍 `active`。
- 等到阶段变为 `warning`（最多 6 秒）：警告可见、剩余 1~2 秒。
- 点「继续使用」：阶段 `active`、剩余 6、警告消失。
- 点「退出登录」：阶段 `expired`、重新登录按钮可见。
- 点「重新登录」：阶段 `active`、剩余 6。
- 点「重置」：阶段 `active`、剩余 6、活动计数 0。

- [ ] **Step 2: 运行确认失败**

Run: `npm run check:ui -- --base http://localhost:5174 --only 会话过期`
Expected: 路由不存在。

- [ ] **Step 3: 实现 Demo**

卡片显示当前阶段、剩余秒数与活动计数；`active` 阶段每秒递减，剩余 2 秒进入 `warning` 并显示续期提示，0 秒进入 `expired`；`active` 阶段的「模拟活动」重置为 6 秒并计数，`warning` 阶段该按钮禁用；「继续使用」只在 `warning` 可用；「退出登录」直接进入 `expired`；`expired` 显示「重新登录」。卸载时清掉定时器。按钮用 `n-button`，提示区用站点 token 样式。

- [ ] **Step 4: 补齐 meta / notes / code**

标题「SessionExpiry：别让用户填到一半被踢下线」；sell「空闲倒计时 + 提前提醒 + 续期 / 退出」；summary「6 秒演示会话，剩 2 秒提醒，过期只能重新登录」。
notes 第 3 段标 3 处：倒计时状态机、活动只在 active 重置、定时器清理。第 4 段用场景实测 6→5→6、warning、expired、重新登录。

- [ ] **Step 5: 验证**

Run: `npx eslint src/examples/admin/session-expiry scripts/check-ui.mjs --max-warnings 0 && npm run type-check && npm run check:ui -- --base http://localhost:5174 --only 会话过期`
Expected: 场景通过。

---

### Task 5: 行快速查看 `admin/quick-view-drawer`

**Files:**
- Create: `src/examples/admin/quick-view-drawer/Demo.vue`
- Create: `src/examples/admin/quick-view-drawer/meta.ts`
- Create: `src/examples/admin/quick-view-drawer/notes.md`
- Create: `src/examples/admin/quick-view-drawer/code/quick-view-drawer.ts.txt`
- Modify: `scripts/check-ui.mjs`（新增 `快速查看抽屉与上下条`）

**Interfaces:**
- `Order`：`{ id: number; customer: string; amount: number; status: 'pending' | 'done'; address: string; createdAt: string; note: string }`，共 6 条。
- 状态：`show = ref(false)`、`activeIndex = ref(-1)`、`triggerEl = ref<HTMLElement | null>(null)`。
- 计算：`activeOrder`、`prevDisabled`、`nextDisabled`。
- 动作：`open(index, event: MouseEvent)`、`close()`、`prev()`、`next()`、`restoreFocus()`、`reset()`。
- `data-stat`：`active-id`、`drawer-open`、`active-index`、`prev-disabled`、`next-disabled`。
- 选择器：`.qvd-demo`、`[data-open="<id>"]`、`.qvd-drawer`、`[data-action="prev"]`、`[data-action="next"]`、`[data-action="close"]`、`[data-action="reset"]`。

- [ ] **Step 1: 写失败场景**

场景 `快速查看抽屉与上下条`。断言：
- 初始：抽屉关闭。
- 点第 3 行「查看」：抽屉打开、当前 id 3、上一条 / 下一条都可用。
- 点「下一条」两次：id 5；点「上一条」：id 4。
- 点关闭：抽屉消失，焦点回到第 3 行的「查看」按钮。
- 点第 6 行「查看」：下一条禁用、上一条可用。
- 按 Escape：抽屉消失，焦点回到第 6 行按钮。
- 点「重置」：抽屉关闭。

- [ ] **Step 2: 运行确认失败**

Run: `npm run check:ui -- --base http://localhost:5174 --only 快速查看`
Expected: 路由不存在。

- [ ] **Step 3: 实现 Demo**

表格每行「查看」按钮打开右侧 `n-drawer`（`placement="right"`、`width=360`、`content-class="qvd-drawer"`、`:close-on-esc="true"`、`@after-leave="restoreFocus"`）。抽屉只读展示客户、金额、状态、地址、创建时间、备注；底部「上一条 / 下一条」在首尾禁用。打开时记录 `event.currentTarget` 作为焦点归还目标；关闭后 `after-leave` 把焦点还给该按钮。重置关闭抽屉并清空当前索引。

- [ ] **Step 4: 补齐 meta / notes / code**

标题「QuickViewDrawer：看详情别离开列表」；sell「行内打开只读抽屉，上下条连续查看」；summary「抽屉只读展示行详情，首尾禁用上下条，关闭归还焦点」。
notes 第 3 段标 3 处：`triggerEl` 记录与焦点归还、首尾边界、只读数据来源。第 4 段用场景实测 id 3→5→4、边界禁用、Escape 与焦点。

- [ ] **Step 5: 验证**

Run: `npx eslint src/examples/admin/quick-view-drawer scripts/check-ui.mjs --max-warnings 0 && npm run type-check && npm run check:ui -- --base http://localhost:5174 --only 快速查看`
Expected: 场景通过。

---

### Task 6: 统一收口与交付

**Files:**
- Modify: `CASES.md`（`npm run gen:cases` 生成）
- Modify: `AGENTS.md`（113 案例 / 10 分类、进度、决策、dev 地址）
- Modify: `docs/screenshots/README.md`（108 → 113）
- Create: `docs/screenshots/admin/<5 个案例>/*.png`

- [ ] **Step 1: 生成清单**

Run: `npm run gen:cases && npm run gen:cases -- --check`
Expected: 113 个案例 / 10 个分类，一致。

- [ ] **Step 2: 跑内容与静态门禁**

Run: `npx vitest run && npm run audit:cases && npm run lint && npm run build && npm run check:bundle`
Expected: vitest 60/60、audit 0 P0/P1/P2、lint/build/bundle 通过。

- [ ] **Step 3: 跑浏览器验收**

Run: `npm run check:ui -- --base http://localhost:5174 --only 跨页选择 && ...`（5 个新场景逐个跑）
Run: `npm run check:ui -- --base http://localhost:5174 --sweep`
Expected: 5 个新场景通过、113/113 案例巡检通过。

- [ ] **Step 4: 生成 375px 截图**

每个案例跑浅色与 `--dark` 两次：
`npm run check:ui -- --base http://localhost:5174 --shot admin/<案例> --width 375 --out docs/screenshots/admin/<案例>`

- [ ] **Step 5: 更新文档并提交**

更新 `AGENTS.md` 当前进度与决策记录、`docs/screenshots/README.md` 存量数；提交 `feat(admin): 新增第五批 5 个后台组件案例`，push、开 PR、等 CI、rebase merge、同步 main、删除远程分支。
