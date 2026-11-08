# admin 第四批 5 个后台组件案例 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 在 `admin` 分类新增 5 个自包含后台案例：保存视图、审批流、穿梭框、表单联动、动态表单，并完成 DoD、截图、文档与 PR。

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
- 不新增依赖；不抽通用 DataTable / Form / 权限 / 穿梭框组件。

## Review Focus

- 保存视图：默认视图不能被删除；切换视图后查询、排序、列显隐必须同时恢复。
- 审批流：状态机不允许跳步；已通过 / 已驳回后不能继续操作；重置回到初始步骤。
- 穿梭框：禁用项不能被全选或移动；搜索只影响可见项，不能丢掉已选项。
- 表单联动：隐藏依赖字段时要清空旧值；重新显示时不能把旧值带回来。
- 动态表单：删行后 id 不串；提交时只统计当前行，错误行保留可修改。

---

### Task 1: 保存视图 `admin/saved-views`

**Files:**
- Create: `src/examples/admin/saved-views/Demo.vue`
- Create: `src/examples/admin/saved-views/meta.ts`
- Create: `src/examples/admin/saved-views/notes.md`
- Create: `src/examples/admin/saved-views/code/saved-views.ts.txt`
- Modify: `scripts/check-ui.mjs`（在 admin 场景区新增 `保存视图与默认视图恢复`）

**Interfaces:**
- `QueryState`：`{ keyword: string; status: 'all' | 'pending' | 'done'; sort: 'created-desc' | 'amount-desc'; columns: { owner: boolean; amount: boolean } }`
- `SavedView`：`{ id: string; name: string; query: QueryState; isDefault: boolean }`
- 订单：`{ id, name, status: 'pending' | 'done', amount, owner, createdAt }`，共 6 条。
- `data-stat`：`view-count`、`result-count`、`visible-columns`、`dirty`、`current-view`、`status-text`
- 选择器：`.sv-demo`、`[data-view]`、`[data-field="keyword"] input`、`.sv-status`、`.sv-sort`

- [x] **Step 1: 写 `check:ui` 失败场景**

场景 `保存视图与默认视图恢复`，路由 `/cases/admin/saved-views`。断言：
- 初始：视图 3 个、结果 6 条、可见列 4 个、脏标记 0、当前视图「全部订单」。
- 切状态「待处理」：结果 3 条、脏标记 1。
- 点「保存为新视图」：视图 4 个、脏标记 0、当前视图「待处理视图」。
- 切换排序为「金额从高到低」：脏标记 1；点「更新当前视图」：脏标记 0。
- 点「删除当前视图」：视图 3 个、当前视图回到「全部订单」、结果 6 条。
- 点默认视图「高金额」：结果 2 条、可见列 3 个；默认视图的删除按钮不可用。
- 点「恢复默认」：当前视图「全部订单」、结果 6 条、脏标记 0。

- [x] **Step 2: 运行场景确认失败**

Run: `npm run check:ui -- --base http://localhost:5174 --only 保存视图`
Expected: 路由不存在 / 演示区找不到 `.sv-demo`。

- [x] **Step 3: 实现 Demo**

三个默认视图：全部订单、待处理、高金额。顶部是关键词、状态、排序、列显隐控件；中间是订单结果表；右侧是视图列表，每项显示名称与默认标记，点击切换。保存为新视图用 `n-input` 弹层或内联输入，更新当前视图覆盖当前视图的 `query`，删除非默认视图后回到默认视图，恢复默认回到「全部订单」。用 `JSON.stringify` 比较当前状态与视图快照计算 `dirty`。订单状态用 `n-radio-group`，排序用 `n-radio-group` 或 `n-select`，列显隐用 `n-checkbox`。

- [x] **Step 4: 补齐 meta / notes / code**

标题「SavedViews：筛选条件别每次重新点」；sell「筛选、排序、列显隐存成视图，一键切回」；summary「视图保存查询、排序与列显隐，默认视图不可删」。
notes 第 3 段标 3 处：视图快照、脏标记比较、默认视图保护。第 4 段用场景实测 3/6/4、3/3、4/0、2/3 等。
`code` 与 Demo 同源，标 `//!` 重点行。

- [x] **Step 5: 验证**

Run: `npx eslint src/examples/admin/saved-views --max-warnings 0 && npm run type-check && npm run check:ui -- --base http://localhost:5174 --only 保存视图`
Expected: 场景通过。

---

### Task 2: 审批流 `admin/approval-flow`

**Files:**
- Create: `src/examples/admin/approval-flow/Demo.vue`
- Create: `src/examples/admin/approval-flow/meta.ts`
- Create: `src/examples/admin/approval-flow/notes.md`
- Create: `src/examples/admin/approval-flow/code/approval-flow.ts.txt`
- Modify: `scripts/check-ui.mjs`（新增 `审批流按角色推进`）

**Interfaces:**
- `Role`：`'manager' | 'finance' | 'applicant'`
- `Status`：`'pending' | 'approved' | 'rejected'`
- `Step`：`'manager' | 'finance' | 'done'`
- 申请：`{ id, title, amount, applicant, status, step, history: Array<{ actor, action, note }> }`
- `data-stat`：`status-text`、`step-text`、`history-count`、`current-role`、`action-count`
- 选择器：`.af-demo`、`.af-role`、`.af-history`、`[data-action]`

- [x] **Step 1: 写失败场景**

场景 `审批流按角色推进`。断言：
- 初始：状态「待审批」、步骤「主管审批」、历史 1 条（提交申请）。
- 主管点「通过」：步骤「财务审批」、历史 2 条；财务点「通过」：状态「已通过」、步骤「完成」、历史 3 条。
- 重置后：待审批 / 主管审批 / 历史 1 条。
- 主管点「驳回」：状态「已驳回」、历史 2 条；再点「通过」不改变状态。
- 重置后主管点「转交」：步骤「财务审批」、历史 2 条，且当前角色切到财务后才能继续。

- [x] **Step 2: 运行确认失败**

Run: `npm run check:ui -- --base http://localhost:5174 --only 审批流`
Expected: 路由不存在。

- [x] **Step 3: 实现 Demo**

一张申请卡片 + 角色单选组 + 操作按钮 + 审批时间线。状态机只允许：主管审批通过 -> 财务审批；财务审批通过 -> 已通过；主管 / 财务驳回 -> 已驳回；主管转交 -> 财务审批。已通过 / 已驳回后操作按钮全部禁用。角色没有权限时按钮禁用并提示。重置恢复初始申请。

- [x] **Step 4: 补齐 meta / notes / code**

标题「ApprovalFlow：审批流别只改一个状态」；sell「审批要按步骤走：角色、状态、时间线一致」；summary「角色驱动审批步骤，状态机防跳步，时间线留痕」。
notes 第 3 段标 3 处：状态迁移表、角色权限判断、历史追加。第 4 段用场景实测步骤与历史条数。

- [x] **Step 5: 验证**

Run: `npx eslint src/examples/admin/approval-flow --max-warnings 0 && npm run type-check && npm run check:ui -- --base http://localhost:5174 --only 审批流`
Expected: 场景通过。

---

### Task 3: 穿梭框 `admin/transfer-list`

**Files:**
- Create: `src/examples/admin/transfer-list/Demo.vue`
- Create: `src/examples/admin/transfer-list/meta.ts`
- Create: `src/examples/admin/transfer-list/notes.md`
- Create: `src/examples/admin/transfer-list/code/transfer-list.ts.txt`
- Modify: `scripts/check-ui.mjs`（新增 `穿梭框移动与禁用项`）

**Interfaces:**
- `TransferItem`：`{ id: number; label: string; disabled: boolean }`
- 初始源：用户管理、角色管理、报表查看、报表导出、审计日志、系统设置（禁用），共 6 项。
- 状态：`source`、`target`、`selectedSource: number[]`、`selectedTarget: number[]`、`keyword`
- `data-stat`：`source-count`、`target-count`、`selected-count`、`disabled-count`、`visible-count`
- 选择器：`.tl-demo`、`[data-side="source"]`、`[data-side="target"]`、`[data-item]`、`[data-field="keyword"] input`

- [x] **Step 1: 写失败场景**

场景 `穿梭框移动与禁用项`。断言：
- 初始：源 6、目标 0、已选 0、禁用 1。
- 点「全选可移」：已选 5（禁用项不算）。
- 点「移动选中」：源 1、目标 5、已选 0。
- 点「重置」：源 6、目标 0。
- 搜索「报表」：可见 2；点「全选可移」再移动：源 4、目标 2。
- 清空搜索，目标侧选中第一项并「移回」：源 5、目标 1。

- [x] **Step 2: 运行确认失败**

Run: `npm run check:ui -- --base http://localhost:5174 --only 穿梭框`
Expected: 路由不存在。

- [x] **Step 3: 实现 Demo**

左右两栏列表，顶部搜索框同时过滤两侧（搜索只影响显示，不改变已选）。源侧「全选可移」只选未禁用且可见项；「移动选中」把源侧选中项移到目标并清空选择；目标侧「移回」同理。每项用 `n-checkbox`，禁用项 `disabled`。底部显示源 / 目标 / 已选 / 禁用计数，重置恢复初始。

- [x] **Step 4: 补齐 meta / notes / code**

标题「TransferList：穿梭框别把禁用项也移走」；sell「搜索、禁用、已选计数：穿梭框的边界都在这」；summary「搜索过滤、禁用排除、批量移动与移回，计数同步」。
notes 第 3 段标 3 处：全选过滤禁用、搜索不丢已选、移动后清选择。第 4 段用场景实测 6/0、1/5、4/2、5/1。

- [x] **Step 5: 验证**

Run: `npx eslint src/examples/admin/transfer-list --max-warnings 0 && npm run type-check && npm run check:ui -- --base http://localhost:5174 --only 穿梭框`
Expected: 场景通过。

---

### Task 4: 表单联动 `admin/form-dependency`

**Files:**
- Create: `src/examples/admin/form-dependency/Demo.vue`
- Create: `src/examples/admin/form-dependency/meta.ts`
- Create: `src/examples/admin/form-dependency/notes.md`
- Create: `src/examples/admin/form-dependency/code/form-dependency.ts.txt`
- Modify: `scripts/check-ui.mjs`（新增 `表单联动显隐与清空`）

**Interfaces:**
- `InvoiceType`：`'personal' | 'company'`
- `DeliveryType`：`'express' | 'pickup'`
- 表单：`{ buyer: string; invoiceType; companyName: string; taxNo: string; deliveryType; address: string; pickupPoint: string }`
- `data-stat`：`visible-company`、`visible-address`、`visible-pickup`、`error-count`、`cleared-count`、`status-text`
- 选择器：`.fd-demo`、`.fd-invoice`、`.fd-delivery`、`[data-field="buyer"] input`、`[data-field="companyName"] input`、`[data-field="taxNo"] input`、`[data-field="address"] input`

- [x] **Step 1: 写失败场景**

场景 `表单联动显隐与清空`。断言：
- 初始个人 / 快递：企业字段 0、地址 1、自提点 0、清空计数 0。
- 切企业：企业字段 2；填企业名称与税号；切回个人：企业字段 0、清空计数 2。
- 切自提：地址 0、自提点 1、清空计数 3。
- 清空购买人后提交：错误 1、状态提示必填。
- 填购买人后提交：错误 0、状态「提交成功」。
- 重置：个人 / 快递、清空计数 0、状态「待填写」。

- [x] **Step 2: 运行确认失败**

Run: `npm run check:ui -- --base http://localhost:5174 --only 表单联动`
Expected: 路由不存在。

- [x] **Step 3: 实现 Demo**

发票类型与配送方式用 `n-radio-group`。类型切到个人时隐藏并清空企业名称 / 税号；切到企业时显示并标记必填。配送切到自提时隐藏并清空地址、显示自提点；切回快递反向处理。提交时只校验可见必填字段，错误数量与状态写入 `data-stat`。每次清空依赖字段累加 `cleared-count`。

- [x] **Step 4: 补齐 meta / notes / code**

标题「FormDependency：隐藏的字段也要清空」；sell「联动不是显隐：隐藏字段要清值、校验要跟着变」；summary「类型联动显隐与清空，提交只校验可见必填项」。
notes 第 3 段标 3 处：显隐派生、清空依赖、可见字段校验。第 4 段用场景实测可见字段与清空计数。

- [x] **Step 5: 验证**

Run: `npx eslint src/examples/admin/form-dependency --max-warnings 0 && npm run type-check && npm run check:ui -- --base http://localhost:5174 --only 表单联动`
Expected: 场景通过。

---

### Task 5: 动态表单 `admin/dynamic-form`

**Files:**
- Create: `src/examples/admin/dynamic-form/Demo.vue`
- Create: `src/examples/admin/dynamic-form/meta.ts`
- Create: `src/examples/admin/dynamic-form/notes.md`
- Create: `src/examples/admin/dynamic-form/code/dynamic-form.ts.txt`
- Modify: `scripts/check-ui.mjs`（新增 `动态表单增删行与校验`）

**Interfaces:**
- `FormRow`：`{ id: number; name: string; qty: string; price: string; error: string }`
- 初始 2 行；新增行 id 自增；删除行不影响其他行 id。
- `data-stat`：`row-count`、`valid-count`、`error-count`、`submit-count`、`status-text`
- 选择器：`.df-demo`、`[data-row]`、`[data-field="name"] input`、`[data-field="qty"] input`、`[data-field="price"] input`

- [x] **Step 1: 写失败场景**

场景 `动态表单增删行与校验`。断言：
- 初始：2 行、合法 2、错误 0。
- 点「添加一行」：3 行、合法 2；填新行名称 / 数量 / 单价后合法 3。
- 删除中间行：2 行、合法 2，剩余行 id 不重复。
- 清空第 1 行名称后提交：错误 1、提交次数 0，错误行保留。
- 填回名称后提交：错误 0、提交次数 1。
- 重置：2 行、提交次数 0、状态「待填写」。

- [x] **Step 2: 运行确认失败**

Run: `npm run check:ui -- --base http://localhost:5174 --only 动态表单`
Expected: 路由不存在。

- [x] **Step 3: 实现 Demo**

表格每行三个输入：名称、数量、单价，行尾删除按钮。底部「添加一行」「提交」「重置」。提交时逐行校验：名称非空、数量为正整数、单价为正数；错误行写 `error` 字段并保留，合法行清错。`valid-count` 与 `error-count` 从当前行实时计算。删除行用 id 定位，不用数组下标做 key。

- [x] **Step 4: 补齐 meta / notes / code**

标题「DynamicForm：动态行别用数组下标当 key」；sell「增删行、行内校验、提交过滤：动态表单的三个坑」；summary「动态增删行，逐行校验，错误行保留可修改」。
notes 第 3 段标 3 处：id 自增、按 id 删除、提交校验。第 4 段用场景实测 2/2、3/2、2/2、1 错、1 提交。

- [x] **Step 5: 验证**

Run: `npx eslint src/examples/admin/dynamic-form --max-warnings 0 && npm run type-check && npm run check:ui -- --base http://localhost:5174 --only 动态表单`
Expected: 场景通过。

---

### Task 6: 统一收口与交付

**Files:**
- Modify: `CASES.md`（`npm run gen:cases` 生成）
- Modify: `AGENTS.md`（108 案例 / 10 分类、进度、决策、dev 地址）
- Modify: `docs/screenshots/README.md`（103 → 108）
- Create: `docs/screenshots/admin/<5 个案例>/*.png`

- [x] **Step 1: 生成清单**

Run: `npm run gen:cases && npm run gen:cases -- --check`
Expected: 108 个案例 / 10 个分类，一致。

- [x] **Step 2: 跑内容与静态门禁**

Run: `npx vitest run && npm run audit:cases && npm run lint && npm run build && npm run check:bundle`
Expected: vitest 60/60、audit 0 P0/P1/P2、lint/build/bundle 通过。

- [x] **Step 3: 跑浏览器验收**

Run: `npm run check:ui -- --base http://localhost:5174 --only 保存视图 && ...`（5 个新场景逐个跑）
Run: `npm run check:ui -- --base http://localhost:5174 --sweep`
Expected: 5 个新场景通过、108/108 案例巡检通过。

- [x] **Step 4: 生成 375px 截图**

每个案例跑浅色与 `--dark` 两次：
`npm run check:ui -- --base http://localhost:5174 --shot admin/<案例> --width 375 --out docs/screenshots/admin/<案例>`

- [x] **Step 5: 更新文档并提交**

更新 `AGENTS.md` 当前进度与决策记录、`docs/screenshots/README.md` 存量数；提交 `feat(admin): 新增第四批 5 个后台组件案例`，push、开 PR、等 CI、rebase merge、同步 main、删除远程分支。
