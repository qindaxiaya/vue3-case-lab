# 遗留任务计划（2026-11-06）

> **状态：** 待执行。本文件是「盘点后剩下的活」，按 Task 1 → Task 6 顺序做，每个 Task 单独分支 + PR。
> **盘点基线：** `main` = `c878318`，84 案例 / 9 分类，`npx vitest run` 53 项、`check:ui` 44 个场景 + `--sweep` 84/84 全绿，`audit:cases` 0 P0/P1/P2。
> **盘点范围：** `AGENTS.md` 进度与决策、`docs/`（计划 / 设计 / DoD / 技能手册）、原始 spec（`E:\MyProject\myProject\vue3-case-library-spec.md`）、GitHub issue / PR、远端分支、worktree、工作区、`TODO|FIXME` 扫描。
> **结论：** 没有 open issue / open PR，远端已合并分支已 prune，实施计划 59 项全部勾选，工作区干净。剩下的是「原始 spec 规划过、但从未做也从未记录放弃」的 4 项，加上 2 项需要拍板的收尾。

---

## 一、任务总览

| # | 任务 | 来源 | 级别 | 依赖 | 预估 | 收益 |
|---|------|------|------|------|------|------|
| 1 | `CASES.md` 案例清单 + CI 一致性校验 | 原始 spec §目录结构 / §质量保障 | L1 | 无 | 1~2h | 对外索引；新增案例忘登记会红灯 |
| 2 | `scripts/new-case.mjs` 脚手架 | 原始 spec §4.2 | L1 | 建议在 Task 1 之后（脚本要读分类表） | 1~2h | 新增案例不用再手抄目录 |
| 3 | notes ↔ Demo 同源校验 | 原始 spec §6「解读与代码同源」 | L1 | 无 | 2~3h（大头是存量扫描与白名单） | 防「文档写着函数 A，代码早改名」 |
| 4 | 源码重点行点击 → 演示区高亮 | 原始 spec §5（P2 增强联动） | L2 | 无 | 3~4h | 教学联动，锦上添花 |
| 5 | 375px 截图留档 | DoD §6「每个案例至少一张 375px 截图」 | L0/L1 | 无 | 1h | 验收证据可追溯 |
| 6 | `v0.2` tag + Release 说明 | 里程碑 | L0 | Task 1~5 收口 | 0.5h | 阶段归档 |

**建议顺序：1 → 2 → 3 →（停下问）4 / 5 → 6。**
Task 4 会动框架（`CasePage` / `CodeWorkbench`）与代码片段标记约定，影响面大，动手前必须先确认；Task 5 的存储成本需要拍板。

---

## 二、明确不做 / 已被后续决策替代（避免误读为待办）

| 项 | 现状 | 结论 |
|----|------|------|
| `docs/design-tokens.md` | 不存在 | **替代完成**：token 表在设计文档 §7，实际值在 `src/styles/_tokens.scss` |
| `@vue/repl` 在线代码编辑 | 未安装 | **设计文档「非目标 N1」明确排除** |
| Tailwind / SSR / 移动端优先 | 未做 | 设计文档「非目标 N2~N4」 |
| `CaseMeta.priority`（原 spec 必填） | 类型里没有 | 2026-10-19 元数据精简时移除，本计划**不恢复**；`CASES.md` 的「状态」列统一写「已实现」，不编造优先级 |
| `practice/file-upload` 的 2MB 边界 / 99.5% 进度窗口 | 保留现状 | 2026-11-05 拍板：理论上有偏、实际看不见（1 字节 / 180ms），不打补丁 |
| `performance/perf-observer` 的 CLS 常驻场景 | 未加 | 2026-11-05 拍板：0.0995~0.1 边界造不稳定，只在 notes 写口径 |
| 演示区剩余控件迁移 Naive | 81 案例已迁完 | 2026-11-03 批 8 收口，豁免项都在各自 `notes.md` 第 5 段 |

---

## 三、任务详情

### Task 1：`CASES.md` 案例清单 + CI 一致性校验

**现状证据**

- 仓库根目录没有 `CASES.md`；案例清单只存在于运行时（`src/examples/registry.ts` 用 `import.meta.glob` 生成），列表页展示但不可离线引用。
- 原始 spec 要求：`CASES.md`「38 案例清单（对外索引用，含优先级与状态）」，且「`CASES.md` 与 `registry` 保持一致，CI 校验清单数量与目录数量相符」。
- 现有 CI（`.github/workflows/ci.yml`）只跑 `type-check` / `lint` / `vitest` / `build` / `check:bundle`，没有清单校验。

**设计**

- `CASES.md` 由脚本生成，禁止手写全表：84 条手写必然过期。
- 生成器 `scripts/gen-cases.mjs`：用 Vite 的 `createServer({ server: { middlewareMode: true } })` + `ssrLoadModule('/src/examples/registry.ts')` 读取**真实 registry**（`allCases`）与 `categories.ts`，输出 Markdown 并写文件。
  - 不用正则解析 `meta.ts`：多行字符串一改就错；registry 是唯一真相。
  - 不引新依赖：`vite` 已是 devDependency。
- 校验放 vitest（CI 自动覆盖，无需改 `ci.yml`）：`tests/cases-doc.spec.ts`
  1. 解析 `CASES.md` 里的 `(/cases/<分类>/<案例>)` 链接，集合必须等于 `allCases` 的 `(categoryId, meta.id)` 集合（多、少、重复都报错，报错里列出名字）；
  2. 每行标题必须等于对应 `meta.title`（防止只改数量不改内容）；
  3. 文首「共 N 个案例 / M 个分类」的数字与真实数量一致；
  4. 分类顺序与 `categories.ts` 一致。

**步骤**

- [x] 新增 `scripts/gen-cases.mjs`（中文注释：为什么用 Vite SSR 读 registry、为什么不用正则）
- [x] `package.json` 增加 `"gen:cases": "node scripts/gen-cases.mjs"`（默认写文件；`--check` 只比对不写，退出码 1 表示过期）
- [x] 生成首版 `CASES.md`：标题 + 更新说明 + 分类分组表格（分类 / 案例链接 / 标题 / 难度 / 标签 / 一句话摘要）+ 总数
- [x] 新增 `tests/cases-doc.spec.ts` 四条断言（见上）
- [x] 更新 `AGENTS.md`：约定段加「新增案例要跑 `npm run gen:cases`」，进度段记一条

**验收**

- `node scripts/gen-cases.mjs --check` 在干净仓库返回 0；手动改坏一行后返回 1 并指出差异。
- `npx vitest run` 通过（新增 spec 计入）；`npm run type-check`；`npx eslint scripts/gen-cases.mjs tests/cases-doc.spec.ts --max-warnings 0`。
- 故意删掉 `CASES.md` 里一条 → CI 本地复跑红灯，报错信息含「缺少 css/xxx」。

**涉及文件：** `CASES.md`（新增）、`scripts/gen-cases.mjs`（新增）、`tests/cases-doc.spec.ts`（新增）、`package.json`、`AGENTS.md`

**风险：** `ssrLoadModule` 会走 Vite 的模块图，若某天 `registry.ts` 顶层 import 了 `.vue`，脚本会失败——注意保持 `registry.ts` 只同步导入 `meta.ts` / `categories.ts`（现状如此，别破坏）。

---

### Task 2：`scripts/new-case.mjs` 案例脚手架

**现状证据**

- 原始 spec 目录规划里有 `scripts/new-case.mjs`「脚手架：生成 meta/Demo/notes 模板」，至今不存在。
- 当前新增案例流程：复制一个同类案例目录 → 改 id / 标题 → 手写 notes（`AGENTS.md` 只写「新增案例零注册成本」，不含脚手架）。

**设计**

- 用法：`npm run new:case -- <分类> <案例id>`，可选 `--dry-run` 只打印将创建的文件。
- 校验：分类必须在 `src/examples/categories.ts` 里（正则扫 `{ id: '...', name: '...' }`，不引 TS 运行时）；案例 id 必须匹配 `^[a-z0-9]+(-[a-z0-9]+)*$`；目录已存在直接拒绝。
- 产出四件套 + 下一步提示：
  - `Demo.vue`：`<script setup lang="ts">` 骨架、根节点 `.xx-demo`、`data-stat` 约定示例、对比模式 `n-radio-group` 片段、`//! ` 重点行示例、卸载清理注释
  - `meta.ts`：`satisfies CaseMeta`，`id` 写对、`sell` / `summary` 留 TODO 文案并附字数限制注释
  - `notes.md`：按 `docs/templates/notes.md` 五段骨架（含「第 4 段必须有实测，禁止编数字」提醒）
  - `code/usage.ts.txt`：带逐行中文注释的示例，标注 `//!` 重点行
- 打印收尾清单：跑 `npm run gen:cases`、`npx vitest run`、`npm run check:ui -- --case <分类>/<id>`、更新 `AGENTS.md`。

**步骤**

- [x] 新增 `scripts/new-case.mjs`（模板用模板字符串，中文注释；`--dry-run` 输出文件树）
- [x] `package.json` 增加 `"new:case": "node scripts/new-case.mjs"`
- [x] 用 `--dry-run` 走一遍分类校验 / id 校验 / 重复目录三条错误分支
- [x] 真实生成一个 `css/scaffold-smoke`，跑 `npx vitest run` 与 `npm run type-check` 确认模板零报错，然后删掉（不入库）
- [x] `AGENTS.md` 补「新增案例用 `npm run new:case`」一行

**验收**

- 真实生成后：registry 自动收录、`type-check` / `lint` / `vitest` 通过、页面可打开（`check:ui -- --case`）。
- 模板里没有残留 `TODO` 之外的占位符（`sell` / `summary` 允许显式 TODO，但必须在打印里提示替换）。

**涉及文件：** `scripts/new-case.mjs`（新增）、`package.json`、`AGENTS.md`

**风险：** 模板与 DoD 漂移（改了约定忘改模板）。缓解：模板顶部注释指向 `docs/case-definition-of-done.md`；Task 1 完成后顺手确认模板产出的 `meta.ts` 能被 `CASES.md` 生成器收录。

---

### Task 3：notes ↔ Demo 同源校验（函数名 / 行号不越界）

**现状证据**

- `tests/content-quality.spec.ts` 现有 5 项：SBAC 四段、`sell` ≤30 / `summary` ≤40、禁未解释缩写、标题可被搜索命中、`notes.md` 五段齐全。
- 没有「`notes.md` 引用的函数名能在 `Demo.vue` 找到」的校验；原始 spec §6 明确要求过这条。
- DoD §4 已规定「第 3 段以函数名/变量名为主定位，行号只作辅助」，但只是文字约定。

**设计**

- 新增 `tests/notes-source.spec.ts`：
  1. **标识符**：从 `notes.md` 正文反引号里的内容提取「自造名」——满足 `^[a-z][A-Za-z0-9]{5,}$`（驼峰，长度 ≥6）或 `^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$`（kebab，长度 ≥6），排除通用词白名单后，断言「`Demo.vue` + `code/*.txt`」源码里 `includes` 该名字（实施时补充：只查 Demo 会把引用教学代码的名字误报）；
  2. **行号**：`第 N 行` / `L12` 形式里的 N 必须 ≤ `Demo.vue` 行数（防越界），越界给「引用行号超出文件长度」；
  3. 失败信息统一格式：`案例 分类/案例 · 标识符 xxx 在 Demo.vue / code/*.txt 中不存在（notes.md 第 K 行引用）`。
- 白名单单独放 `tests/notes-source.allow.ts`（示意名、库 API、通用词），**每条必须写一行原因**，禁止无理由堆词。
- 先做「扫描模式」：把 84 篇现状列出来，人工过一遍再决定白名单，避免一上线就红灯。

**步骤**

- [x] 写提取 + 校验逻辑，先只输出报告（不 fail），本地跑一遍拿存量清单
- [x] 逐条判断：真实漂移（改 notes）vs 合理引用（进白名单并写原因）
- [x] 打开断言，确保 84 篇全绿
- [x] 故意把一个函数改名（临时分支）验证红灯与报错文案
- [x] `AGENTS.md` 进度 + 决策各记一条（为什么只查「自造名」、为什么不查 CamelCase 库 API）

**验收**

- `npx vitest run` 全绿；故意改坏 → 红灯且信息可定位；`npx eslint tests/notes-source.spec.ts --max-warnings 0`。

**涉及文件：** `tests/notes-source.spec.ts`（新增）、`tests/notes-source.allow.ts`（新增）、若干 `notes.md`（如发现真实漂移）、`AGENTS.md`

**风险：** 误报（notes 里讲原理时引用示意名、库函数名、Vue API 名）。缓解：只查「至少 6 个字符 + 非通用词」；白名单逐条写原因；报错只报名字不阻断其他案例（聚合后一次列出）。

---

### Task 4：源码重点行点击 → 演示区对应元素高亮（需先确认）

**现状证据**

- `src/components/CodeWorkbench.vue` 已支持 `//! ` 重点行（渲染时去标记 + 主色底 + 左侧色条），行号也渲染了，但点击行号没有联动。
- Demo 与代码区之间没有通信通道；`CasePage` 只负责加载 Demo 与 source。

**设计（低侵入、可选约定）**

- 代码片段里允许写 `//! @demo <CSS 选择器>`（例：`//! @demo [data-stat="typing"]`）；
- `CodeWorkbench` 渲染时把带 `@demo` 的行渲染成原生 `<button>`（`role` / `tabindex` / Enter 由浏览器免费提供），点击 `emit('locate', selector)`；该行不参与复制，避免把标记粘进真实代码；
- `CasePage` 收到后：在 Demo 根节点内 `querySelector(selector)` → `scrollIntoView({ block: 'center' })` + 加 `.locate-flash` 类（1.6s 主色描边脉冲，之后移除）；找不到（选择器写错 / 元素依赖未打开的面板）时用 Naive message 提示。CasePage 不在 `DemoNaive` 的 provider 内，message 通过 `createDiscreteApi` 取得；
- 只给 2~3 个案例加 `@demo` 标记作为试点（如 `composables/use-keyboard-shortcut` 的输入框与快速跳转面板、`performance/pull-refresh` 的列表区），其余案例不动。

**步骤**

- [x] **先问**：是否值得为「点击代码行 → 高亮元素」改框架（影响 `CodeWorkbench` / `CasePage` / 案例代码片段三处）
- [x] 加 `@demo` 解析 + emit + `locate-flash` 样式（遵守 `--ease-out`、不跟随系统 reduce 的全站约定）
- [x] 试点 2 个案例的 `code/*.txt` 加标记
- [x] `check:ui` 新增场景：点击带标记的行 → 演示区元素出现 `.locate-flash` 且已滚入视口；无标记的行点击无反应
- [x] 375px 下可点、不溢出；教学代码与 Demo 一致

**验收（L2）：** DoD 全条 + `npx vitest run`、`type-check`、`npm run lint`、`npm run build`、`check:bundle`、`check:ui` 全量 + `--sweep`、新场景通过、1280/375 零 console 错误。

**涉及文件：** `src/components/CodeWorkbench.vue`、`src/components/CasePage.vue`、`src/components/CodeWorkbench.vue` 的样式、试点案例 `code/*.txt`、`scripts/check-ui.mjs`、`AGENTS.md`

**风险：** 只对「当前演示状态」存在的元素有效（例如面板未打开时选择器找不到）。必须给出失败提示，否则用户以为坏了；且不能把框架写成「为某个案例特化」。

---

### Task 5：375px 截图留档（已选方案 B：只给新案例留档）

**现状证据**

- DoD §6 要求「每个案例至少一张 375px 截图」作为证据。
- `check:ui --shot` 已能截图（只截 `.demo-card`，1280 + 375，可 `--dark`），但输出在 `node_modules/.tmp/shots`，不入库、随时被清。

**选项**

| 方案 | 成本 | 说明 |
|------|------|------|
| A. 不做（现状） | 0 | 证据只在开发机临时目录，PR 里靠文字记录 |
| B. 只给新案例留档 | 每案例 2 张（浅/暗）≈ 200 KB | 建 `docs/screenshots/<分类>/<案例>/`，提交时附上，跑 `--shot --out` 指定目录 |
| C. 全量归档 | 84 × 2~4 张，压缩后 ≈ 8~15 MB | 体积明显膨胀，仓库不再轻量 |

**步骤（方案 B，已执行）**

- [x] `check:ui --shot` 增加 `--out <dir>`（默认仍是 `node_modules/.tmp/shots`）与 `--width 375`（只出窄屏，避免多存 1280）
- [x] 修 `--shot --dark`：先写 `moyu-theme` 再刷新页面，让 Naive UI 的 JS 主题跟着切换（只加 `.dark` 类时 Naive 仍是浅色）
- [x] 新案例 PR 模板 / AGENTS 约定：新增案例提交 2 张（浅色 375 + 暗色 375）
- [x] 在 `AGENTS.md` 与 `docs/screenshots/README.md` 写清「截图库不入 CI，只在新增案例时附」
- [x] 实跑留档示例：`composables/use-keyboard-shortcut` 浅 / 暗两张 375px 图

**验收（L1）：** `--out` / `--width` 生效、路径创建、文件名可读；暗色图里 Naive 控件也是深色；`check:ui` 其余场景不受影响。

**涉及文件：** `scripts/check-ui.mjs`、`AGENTS.md`、`docs/screenshots/README.md`、`docs/screenshots/composables/use-keyboard-shortcut/`

---

### Task 6：`v0.2` tag + Release 说明

**现状证据**

- 只有 `v0.1`（56 案例时打的）；现在 84 案例 / 9 分类，期间经历 Naive UI 换挡、composables 分类扩充、打包优化、动效策略变更。
- 用户 2026-11-06 明确「这轮不打」，所以列在这里等拍板。

**步骤**

- [ ] 确认 Task 1~5 收口，`main` 全绿（`vitest` / `type-check` / `lint` / `build` / `check:bundle` / `check:ui` / `--sweep`）
- [ ] 从 `AGENTS.md`「当前进度」提炼 Release 说明（分组：新分类 / 新案例 / 体验 / 工程）
- [ ] `git tag -a v0.2 -m "..."` + `git push origin v0.2`；GitHub Release 用同一份说明
- [ ] `AGENTS.md` 记一条

**验收：** tag 指向 `main` 提交；Release 页面可访问；CI 在 tag 上不重复跑（`on.push.branches` 只匹配 main，tag 不会触发，符合预期）。

---

## 四、执行约定

1. **分支 + PR**：`main` 有 ruleset 硬门禁（必需检查 `Type check, lint, test, build`），每个 Task 单独分支（`chore/cases-doc`、`feat/new-case-script`、`chore/notes-source-check`…），PR 合并后 `git reset --hard origin/main` 收尾。
2. **停等**：每个 Task 做完停下报告（改动、验收输出、需要人工看的地方），确认后再进下一个；Task 4 / 5 动手前先问。
3. **提交**：Conventional Commits + 中文描述；一个 Task 一个 commit（超过 1 个逻辑单元可拆，但别攒大提交）。
4. **文档**：每个 Task 收尾更新 `AGENTS.md`「当前进度」，重大取舍写进「决策记录」表；不要在文档里留「待补」。
5. **验证分级**（`docs/skills-and-subagents.md`）：

| Task | 收尾必跑 |
|------|----------|
| 1 / 2 / 3 | `npx eslint <改动文件> --max-warnings 0`、`npm run type-check`、`npx vitest run`；Task 2 额外做一次真实生成冒烟 |
| 4 | L2 全量：`npx vitest run`、`type-check`、`lint`、`build`、`check:bundle`、`check:ui`（全量）+ `--sweep` + 新场景 + 1280/375 走查 |
| 5 | `npx eslint scripts/check-ui.mjs`、`type-check`、一次 `--shot --out` 实跑 |
| 6 | 不跑代码检查（只打 tag），但打之前确认 `main` 全绿 |

6. **回归红线**：任何 Task 都不许放宽现有门禁（首屏 gzip ≤180 KB、`audit:cases` 0 P0/P1/P2、`check:ui` 44 个场景、`--sweep` 84/84）。

---

## 五、开工前自检（给下一次会话）

```powershell
git checkout main; git pull           # 确认基线
npm run dev                            # http://localhost:5173/
npx vitest run                         # 53 项全绿
npm run audit:cases                    # 84 案例 0 P0/P1/P2
npm run check:ui -- --base http://localhost:5173 --only 列表   # 冒烟
```

先做 Task 1（成本最低、收益最直接），做完停下等确认。
