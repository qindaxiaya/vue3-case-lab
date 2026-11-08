# admin 第三批 5 个后台组件案例 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 在 `admin` 分类新增 5 个自包含后台案例：权限菜单、审计日志、树形部门选择、导入进度、可编辑表格批量保存，并完成 DoD、截图、文档与 PR。

**Architecture:** 每个案例仍按四件套自包含：`Demo.vue` 演示交互、`meta.ts` 元数据与 SBAC、`notes.md` 五段资料、`code/*.txt` 教学代码。案例之间不抽公共业务组件；演示区控件继续使用 Naive UI，共享主题由 `CasePage` 的 `DemoNaive` 提供。`check:ui` 每个案例新增一个常驻场景，断言关键状态与失败路径。

**Tech Stack:** Vue 3.5 `<script setup lang="ts">`、TypeScript strict、Sass scoped、Naive UI（按需）、Vite、Vitest、`npm run check:ui`。

**Spec:** `AGENTS.md` 的「案例目录结构」「案例完成标准」「不造轮子」「框架与案例抽离」约定；案例质量细则见 `docs/case-definition-of-done.md`。

## Global Constraints

- 中文界面与中文注释；变量 / 函数 / 文件名英文。
- TS strict，禁止 `any`；ESLint `no-explicit-any` 为 error。
- Demo 不引用站点内部组件；演示控件用 Naive UI，按钮 / 单选组 / 输入框 / 树等按需自动导入。
- 一个案例一个演示；错误 / 旧做法与正确做法可在同一 Demo 内对照，但不拆多演示 tab。
- 每个案例必须有：默认停在「旧做法」侧、可重置、卸载清理定时器、375px 无横向溢出、`data-stat` 面板可核对。
- `meta.sell` ≤30 字，`meta.summary` ≤40 字，`explain` 四段齐全。
- `notes.md` 五段：现象 / 原理 / 关键代码（3 处为什么）/ 数据对比（实测口径）/ 追问与边界（踩坑 ≤3）。
- `CASES.md` 由 `npm run gen:cases` 生成，禁止手改。
- 375px 浅 + 暗截图放 `docs/screenshots/admin/<案例>/`，截图不入 CI。
- 不新增依赖；不抽通用 DataTable / Form / 权限组件。

## Review Focus

- 权限菜单：父级分组在子项全部不可见时必须一起消失，不能留下空分组。
- 审计日志：失败操作也必须留痕；敏感字段在列表和详情里都要脱敏。
- 部门树：父部门不可选；搜索命中叶子时要能看到它所在的完整路径。
- 导入进度：暂停后进度与已处理条数必须同时冻结；取消后不能继续增加。
- 批量保存：部分失败时成功行清脏、失败行保留脏标记，不能整表回滚。

---

### Task 1: 权限菜单 `admin/permission-menu`

**Files:**
- Create: `src/examples/admin/permission-menu/Demo.vue`
- Create: `src/examples/admin/permission-menu/meta.ts`
- Create: `src/examples/admin/permission-menu/notes.md`
- Create: `src/examples/admin/permission-menu/code/permission-menu.ts.txt`
- Modify: `scripts/check-ui.mjs`（在 admin 场景区新增 `权限菜单按角色裁剪`）

**Interfaces:**
- 角色：`admin | editor | viewer`
- 菜单节点：`{ key, label, permission, children? }`
- 权限映射：admin 全部、editor 内容管理 + 工作台、viewer 仅工作台
- `data-stat`：`visible-count`、`hidden-count`、`group-count`、`current-role`

- [x] **Step 1: 写 `check:ui` 失败场景**

场景 `权限菜单按角色裁剪`，路由 `/cases/admin/permission-menu`。断言：
- 初始 editor：可见 4 项、隐藏 3 项、分组 2 个。
- 切 viewer：可见 1 项、隐藏 6 项、分组 1 个（只留工作台）。
- 切 admin：可见 7 项、隐藏 0 项、分组 3 个。
- 左侧「写死菜单」始终 7 项，证明两套规则会漂移。

- [x] **Step 2: 运行场景确认失败**

Run: `npm run check:ui -- --base http://localhost:5174 --only 权限菜单`
Expected: 路由不存在 / 演示区找不到 `.pm-demo`。

- [x] **Step 3: 实现 Demo**

左侧「写死菜单」固定 7 项；右侧按 `role -> permissions` 递归过滤菜单树，父级只在有可见子项时保留。角色用 `n-radio-group` + `n-radio-button`。每项显示权限码标签；当前角色、可见 / 隐藏 / 分组数写入 `data-stat`。重置恢复 editor。

- [x] **Step 4: 补齐 meta / notes / code**

`meta`：标题「PermissionMenu：菜单别和权限各写一份」，sell「菜单和权限同源：没权限的入口别渲染」，summary「权限点驱动菜单树，父级自动收起，越权入口不渲染」。
`notes` 第 3 段标 3 处：递归过滤、父级剪枝、角色切换重算。第 4 段用场景实测 4/3/2、1/6/1、7/0/3。
`code` 与 Demo 同源，标 `//!` 重点行。

- [x] **Step 5: 验证**

Run: `npx eslint src/examples/admin/permission-menu --max-warnings 0 && npm run type-check && npm run check:ui -- --base http://localhost:5174 --only 权限菜单`
Expected: 场景通过。

---

### Task 2: 审计日志 `admin/audit-log`

**Files:**
- Create: `src/examples/admin/audit-log/Demo.vue`
- Create: `src/examples/admin/audit-log/meta.ts`
- Create: `src/examples/admin/audit-log/notes.md`
- Create: `src/examples/admin/audit-log/code/audit-log.ts.txt`
- Modify: `scripts/check-ui.mjs`（新增 `审计日志记录失败与脱敏`）

**Interfaces:**
- 日志条目：`{ id, actor, action, target, result, changes, ip, phone, time }`
- `result`：`success | failed`
- `data-stat`：`total-count`、`failed-count`、`visible-count`、`masked-count`
- 条目选择器：`[data-audit]`、`[data-result]`、`[data-detail]`

- [x] **Step 1: 写失败场景**

场景 `审计日志记录失败与脱敏`。断言：
- 点「新增订单」+「修改金额」+「删除订单（失败）」后：简易日志 2 条、审计日志 3 条、失败 1 条。
- 切「只看失败」：可见 1 条，详情含「删除订单」与失败原因。
- 展开详情：显示 before / after，手机号显示 `138****8000`，`masked-count` ≥1。
- 重置后 0 条。

- [x] **Step 2: 运行确认失败**

Run: `npm run check:ui -- --base http://localhost:5174 --only 审计日志`
Expected: 路由不存在。

- [x] **Step 3: 实现 Demo**

左右对照：左侧「简易日志」只追加成功操作、只记动作名；右侧「审计日志」成功失败都记，含操作者、对象、结果、变更前后、脱敏手机号。操作按钮三个；结果筛选 `n-radio-group`；点击条目展开详情。重置清空两边。

- [x] **Step 4: 补齐 meta / notes / code**

标题「AuditLog：审计日志要能还原现场」；sell「审计日志不是操作记录：失败也要留痕」；summary「失败也记录，敏感字段脱敏，按结果筛选并展开变更详情」。
notes 第 3 段标 3 处：追加写、失败分支、脱敏函数。第 4 段用场景实测 2/3/1 与脱敏结果。

- [x] **Step 5: 验证**

Run: `npx eslint src/examples/admin/audit-log --max-warnings 0 && npm run type-check && npm run check:ui -- --base http://localhost:5174 --only 审计日志`
Expected: 场景通过。

---

### Task 3: 树形部门选择 `admin/department-tree`

**Files:**
- Create: `src/examples/admin/department-tree/Demo.vue`
- Create: `src/examples/admin/department-tree/meta.ts`
- Create: `src/examples/admin/department-tree/notes.md`
- Create: `src/examples/admin/department-tree/code/department-tree.ts.txt`
- Modify: `scripts/check-ui.mjs`（新增 `部门树只允许选末级`）

**Interfaces:**
- 部门节点：`{ key, label, children? }`
- 选中值：叶子部门 key
- `data-stat`：`selected-path`、`reject-count`、`visible-count`
- 树容器：`.dt-tree`；搜索框：`.dt-search input`

- [x] **Step 1: 写失败场景**

场景 `部门树只允许选末级`。断言：
- 初始未选中；点击「技术部」父节点被拒绝，`reject-count` +1，选中路径仍为空。
- 搜索「杭州」后，可见节点包含「杭州研发组」，父级路径可见。
- 点击「杭州研发组」后，`selected-path` 为「总部 / 技术部 / 杭州研发组」。
- 重置后路径为空。

- [x] **Step 2: 运行确认失败**

Run: `npm run check:ui -- --base http://localhost:5174 --only 部门树`
Expected: 路由不存在。

- [x] **Step 3: 实现 Demo**

左侧「平铺下拉」把三级部门压成同名列表；右侧 `n-tree` + `n-input` 搜索。父节点带「含子部门」标记，点击父节点只提示不选中；叶子选中后显示完整路径。搜索用 `pattern`，重置清空搜索与选中。

- [x] **Step 4: 补齐 meta / notes / code**

标题「DepartmentTree：部门选择别只给平铺列表」；sell「部门有层级：只选末级，路径要看清」；summary「末级部门才可选，搜索自动展开，回显完整路径」。
notes 第 3 段标 3 处：父节点拦截、路径回溯、搜索展开。第 4 段用场景实测拒绝次数与路径。

- [x] **Step 5: 验证**

Run: `npx eslint src/examples/admin/department-tree --max-warnings 0 && npm run type-check && npm run check:ui -- --base http://localhost:5174 --only 部门树`
Expected: 场景通过。

---

### Task 4: 导入进度 `admin/import-progress`

**Files:**
- Create: `src/examples/admin/import-progress/Demo.vue`
- Create: `src/examples/admin/import-progress/meta.ts`
- Create: `src/examples/admin/import-progress/notes.md`
- Create: `src/examples/admin/import-progress/code/import-progress.ts.txt`
- Modify: `scripts/check-ui.mjs`（新增 `导入进度暂停继续与取消`）

**Interfaces:**
- 模式：`fake | batch`
- 状态：`idle | running | paused | cancelled | done`
- 总行数 120，每批 10 行，每批 120ms
- `data-stat`：`processed-count`、`failed-count`、`progress`、`batch-index`、`status-text`

- [x] **Step 1: 写失败场景**

场景 `导入进度暂停继续与取消`。断言：
- 初始 batch 模式，点开始后 320ms：已处理 ≥20 且 <120，进度同步。
- 暂停后等 300ms：已处理与进度都不变，状态「已暂停」。
- 继续后等 250ms：已处理增加。
- 取消后等 300ms：状态「已取消」，已处理不再增加，进度 <100。
- 切 fake 模式点开始：进度很快到 100，但已处理仍为 0（证明假进度）。

- [x] **Step 2: 运行确认失败**

Run: `npm run check:ui -- --base http://localhost:5174 --only 导入进度`
Expected: 路由不存在。

- [x] **Step 3: 实现 Demo**

模式单选组 `假进度 / 分批处理`。真实模式用 `setTimeout` 链按批推进，暂停只清下一个定时器、保留游标；继续从游标继续；取消清定时器并标记。假模式用 `setInterval` 把百分比推到 100，不碰已处理数。面板显示已处理 / 失败 / 进度 / 当前批次 / 状态；卸载清理所有定时器。

- [x] **Step 4: 补齐 meta / notes / code**

标题「ImportProgress：长任务进度要能暂停和取消」；sell「导入别假装进度：分批跑，能停能续」；summary「分批处理、真实进度、暂停继续、取消汇总」。
notes 第 3 段标 3 处：批处理链、暂停只停下一批、取消作废在途定时器。第 4 段用场景实测暂停前后条数。

- [x] **Step 5: 验证**

Run: `npx eslint src/examples/admin/import-progress --max-warnings 0 && npm run type-check && npm run check:ui -- --base http://localhost:5174 --only 导入进度`
Expected: 场景通过。

---

### Task 5: 可编辑表格批量保存 `admin/editable-batch-save`

**Files:**
- Create: `src/examples/admin/editable-batch-save/Demo.vue`
- Create: `src/examples/admin/editable-batch-save/meta.ts`
- Create: `src/examples/admin/editable-batch-save/notes.md`
- Create: `src/examples/admin/editable-batch-save/code/editable-batch-save.ts.txt`
- Modify: `scripts/check-ui.mjs`（新增 `可编辑表格批量保存失败行保留`）

**Interfaces:**
- 模式：`instant | batch`
- 行：`{ id, name, amount, dirty, failed }`
- 保存结果：id 3 固定失败，其余成功
- `data-stat`：`dirty-count`、`save-count`、`failed-count`、`status-text`

- [x] **Step 1: 写失败场景**

场景 `可编辑表格批量保存失败行保留`。断言：
- 初始 batch 模式，改第 1、3 行金额后：脏行 2，保存次数 0。
- 点保存：保存次数 1，失败 1，脏行仍 1（第 3 行），第 1 行变干净。
- 再点保存：保存次数 2，失败仍 1，脏行仍 1。
- 切 instant 模式改第 3 行金额：保存次数 +1，值回滚，失败 +1。
- 重置后脏行 0、失败 0。

- [x] **Step 2: 运行确认失败**

Run: `npm run check:ui -- --base http://localhost:5174 --only 批量保存`
Expected: 路由不存在。

- [x] **Step 3: 实现 Demo**

表格 5 行，名称 / 金额可编辑（`n-input size="small"`）。batch 模式：编辑只标脏，点「保存全部」一次提交，成功行清脏、失败行保留并标红。instant 模式：每次编辑立即保存，失败回滚原值。重置恢复初始数据。

- [x] **Step 4: 补齐 meta / notes / code**

标题「EditableBatchSave：可编辑表格别改一格存一次」；sell「表格批量保存：成功的清脏，失败的留着」；summary「脏行标记、批量保存、失败行保留可重试」。
notes 第 3 段标 3 处：脏标记、批量提交、失败行保留。第 4 段用场景实测 2→1、保存次数与回滚。

- [x] **Step 5: 验证**

Run: `npx eslint src/examples/admin/editable-batch-save --max-warnings 0 && npm run type-check && npm run check:ui -- --base http://localhost:5174 --only 批量保存`
Expected: 场景通过。

---

### Task 6: 统一收口与交付

**Files:**
- Modify: `CASES.md`（`npm run gen:cases` 生成）
- Modify: `AGENTS.md`（103 案例 / 10 分类、进度、决策、dev 地址）
- Modify: `docs/screenshots/README.md`（98 → 103）
- Create: `docs/screenshots/admin/<5 个案例>/*.png`

- [x] **Step 1: 生成清单**

Run: `npm run gen:cases && npm run gen:cases -- --check`
Expected: 103 个案例 / 10 个分类，一致。

- [x] **Step 2: 跑内容与静态门禁**

Run: `npx vitest run && npm run audit:cases && npm run lint && npm run build && npm run check:bundle`
Expected: vitest 60/60、audit 0 P0/P1/P2、lint/build/bundle 通过。

- [x] **Step 3: 跑浏览器验收**

Run: `npm run check:ui -- --base http://localhost:5174 && npm run check:ui -- --base http://localhost:5174 --sweep`
Expected: 65/65 场景通过、103/103 案例巡检通过。

- [x] **Step 4: 生成 375px 截图**

每个案例跑浅色与 `--dark` 两次：
`npm run check:ui -- --base http://localhost:5174 --shot admin/<案例> --width 375 --out docs/screenshots/admin/<案例>`

- [x] **Step 5: 更新文档并提交**

更新 `AGENTS.md` 当前进度与决策记录、`docs/screenshots/README.md` 存量数；从最新 `main` 建分支，提交 `feat(admin): 新增第三批 5 个后台组件案例`，push、开 PR、等 CI、rebase merge、同步 main、删除远程分支。
