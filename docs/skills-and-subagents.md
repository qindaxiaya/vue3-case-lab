# Skills 与 SubAgent 使用指南

> 本项目的 agent 操作手册：有哪些技能、什么时候该触发、任务怎么分级、子代理怎么用。
> 最后更新：2026-10-21 · 实测环境 opencode v2.1.1 · 20 个技能 · 2 个项目级子代理
> 配套文件：`AGENTS.md`（项目约定与进度）、`docs/case-definition-of-done.md`（案例验收）、
> `~/.config/opencode/docs/opencode-guide.md`（本机 opencode 全局手册）

## 0. 一句话原则

技能和子代理是**加速器**，不是**流程税**：改一个颜色走 L0 快路径（5~7 次工具调用），
只有新案例、跨模块、合并前才走完整链。判断错档位是本项目最大的时间浪费来源。

---

## 1. 当前技能快照（实测）

| 项 | 值 |
| --- | --- |
| 总数 | **20 个** |
| 内置 | 2 个：`opencode`、`report`（`/builtin/*.md`，随版本走） |
| superpowers | 17 个，实体在 `~/.agents/skills/<name>/`：其中 15 个来自 `obra/superpowers` 官方完整安装（`SKILL.md` + prompts/scripts/references），`find-skills`、`grilling` 是本地自写单文件 |
| 设计 | 1 个：`frontend-design`（`~/.claude/skills/frontend-design`，唯一实体） |
| 加载方式 | 启动时扫描，靠 `description` 自动触发，或用技能名显式点名 |

验证命令（v2.1.1 已移除 `opencode debug skill`，官方 `debug` 只剩 `agents` / `config` / `paths`）：

```bash
opencode api get /api/skill      # 返回 20 条，含 id / description / path / 正文
opencode debug agents            # 列出全部 agent（含自建子代理）
```

> 版本差异：v1.19.3 时代内置技能是 `customize-opencode`，本机当时实测 19 个；
> v2.1.1 换成 `opencode` + `report` 两个内置技能，总数变 20。历史上 16 / 19 / 20 三种口径并存，现统一按 **20** 记录。

### 1.1 完整清单与触发时机

**会话与流程（process skills，优先级最高）**

| 技能 | 什么时候用 | 本项目注意 |
| --- | --- | --- |
| `using-superpowers` | 会话开始、动手前的自检 | 「1% 规则」很激进，**L0/L1 不必套**（见 2.2） |
| `brainstorming` | 有新功能/新案例的想法，需求还没定型 | 会先反问一轮，改样式时别触发 |
| `grilling` | 想被追问、压力测试某个方案 | 用户明确说「拷问我 / grill」才用 |

**计划与执行**

| 技能 | 什么时候用 | 本项目注意 |
| --- | --- | --- |
| `writing-plans` | 需求清楚但要做多步，先写计划 | 计划落 `docs/superpowers/plans/` |
| `executing-plans` | 已有计划，在本会话里自己逐任务实现 | 本项目默认执行方式 |
| `subagent-driven-development` | 计划里任务彼此独立，想每个任务换新上下文 | 已补齐 prompts/scripts，可在 L2 多任务计划上用（成本高，见 3.4） |
| `dispatching-parallel-agents` | 2 个以上互不依赖的任务可并发 | 只读调研最适合，写文件慎用 |

**质量与验证**

| 技能 | 什么时候用 | 本项目注意 |
| --- | --- | --- |
| `test-driven-development` | 写/改有逻辑的代码之前 | 纯样式、纯文案不适用 |
| `requesting-code-review` | 完成任务、功能做完、合并前 | 可配合 `case-reviewer` 子代理 |
| `receiving-code-review` | 收到审查意见、准备照着改时 | 要求先验证意见是否成立，别盲从 |
| `verification-before-completion` | 准备说「完成 / 通过」之前 | 项目强制清单的技术底座，**任何级别都要** |
| `finishing-a-development-branch` | 实现完成、测试通过，决定怎么合并 | 本项目走 PR + CI 门禁 |

**排查**

| 技能 | 什么时候用 | 本项目注意 |
| --- | --- | --- |
| `systematic-debugging` | 遇到 bug、测试失败、行为异常 | 先复现再改，禁止直接猜修复 |
| `diagnosing-superpowers` | 本轮 agent 表现失常，想复盘原因 | 需要会话 id，可用 `opencode session list` 找 |

**元技能与其他**

| 技能 | 什么时候用 | 本项目注意 |
| --- | --- | --- |
| `writing-skills` | 新建/修改技能本身 | 改技能要像改代码一样先测（红绿） |
| `find-skills` | 想找现成技能装一个 | 装完检查是否产生双份（见第 5 节） |
| `using-git-worktrees` | 需要隔离工作区，不污染当前分支 | 本项目单 main + 任务制，一般不需要 |
| `frontend-design` | 新页面、改版、要摆脱「模板感」 | 视觉方向没定或用户明确要求设计感时用 |
| `opencode` | 问 opencode 自身（配置/插件/CLI/API） | 内置，查文档以 V2 文档为准 |
| `report` | 要报 opencode 的 bug | 内置，自动收集诊断信息 |

### 1.2 2026-10-21：superpowers 已重装为「完整安装」

之前 17 个目录**每个只有 1 个 `SKILL.md`**，官方配套的 prompts / scripts / references 全部缺失，
`subagent-driven-development` 这类「脚本驱动」技能按原样跑不起来。现已用 CLI 重装（`--copy`，不用 symlink）：

```bash
npx skills add obra/superpowers -g -a opencode -s "*" --copy -y
```

装了仓库当前的 15 个技能（`obra/superpowers` 不含本地自写的 `find-skills`、`grilling`），
每个目录的文件数：

| 技能 | 文件数 | 关键配套 |
| --- | --- | --- |
| `diagnosing-superpowers` | 20 | references / templates / prompts 整套 |
| `systematic-debugging` | 11 | `root-cause-tracing.md`、`defense-in-depth.md`、`condition-based-waiting.md` |
| `brainstorming` | 8 | `builder-check-prompt.md`、`visual-companion.md` |
| `using-superpowers` | 8 | `references/*.md`（各平台适配） |
| `writing-skills` | 7 | 测试方法论与模板 |
| `subagent-driven-development` | 7 | `implementer-prompt.md`、`task-reviewer-prompt.md`、`re-review-prompt.md`、`scripts/{sdd-workspace,task-brief,review-package}` |
| `writing-skills` 之外的单文件技能 | 1~3 | 无需外部文件 |

**唯一的落地位置是 `~/.agents/skills`**。opencode 同时扫描多处，同名技能**按固定优先级覆盖**（V2 文档「Precedence」）：
内置 → `~/.claude/skills` → `~/.agents/skills` → `~/.config/opencode/skills` → 项目 `.opencode/skills` → 显式 `skills` 配置，后者压前者。
所以旧副本只要还留在 `~/.config/opencode/skills`，就会**盖住** `~/.agents/skills` 里的新版；
日志有时会报 `duplicate skill name`（`frontend-design` 那次报了），这次 `.config` 与 `.agents` 重名却完全没报，只能靠 `api get /api/skill` 看 `path` 才知道用的是哪份。
本次已把 `~/.config/opencode/skills` 清空，`frontend-design` 保持 `~/.claude/skills` 真实目录。

升级技能用 `npx skills update -g`（更新的是 `~/.agents/skills`）。升级后复查两点：
`opencode api get /api/skill` 仍是 20 条、`path` 都指向 `.agents`（`frontend-design` 除外），且日志无新的 `duplicate skill name`。

---

## 2. 任务分级（决定用多少流程）

| 级别 | 判定 | 必做 | 明确不做 |
| --- | --- | --- | --- |
| **L0 微调** | 单文件样式 / 文案 / 间距 / 颜色，无逻辑 | 读目标片段 → 改 → `npx eslint <改动文件> --max-warnings 0` → dev 目视（有页面变化给地址） | brainstorming、写计划、TDD、子代理、DoD 全量、build、全量 vitest |
| **L1 小功能** | 单组件 / 单案例内交互，≤3 文件 | 读上下文 → 有逻辑的部分先写测试 → `npx vitest run` 相关用例 + `npm run type-check` + `npx eslint <改动文件> --max-warnings 0` → dev 走查 + 375px | 全量 build、无关案例测试、子代理 |
| **L2 新案例 / 跨模块** | 新案例、registry / router / 构建配置改动、≥4 个**逻辑**文件（纯样式批量微调不算），或改动触及共享模块 | 完整 DoD + 全量四项（`type-check` / `lint` / `vitest` / `build`）+ 人工走查，可用 `verifier` + `case-reviewer` | — |

### 2.1 验证按影响面

| 改动内容 | 跑什么 | 说明 |
| --- | --- | --- |
| `.scss` / `<style>` / 文案 | `npx eslint <改动文件> --max-warnings 0` | 十几秒，够用 |
| Vue / TS 逻辑 | `npm run type-check` + `npx eslint <改动文件> --max-warnings 0` | 类型是硬门槛；warning 也要当失败看 |
| `src/examples/**` 的 meta / notes / code | `npx vitest run` | 内容质量门禁（SBAC、字数、notes 五段）在这里 |
| registry / router / 构建配置 / 跨模块 | 全量四项 | 影响面不可控，别省 |
| 合并前 / 用户明确要求 | 全量四项 | CI 也会跑一遍 |

机器验证永远不替代人工走查：有页面变化就给 `http://localhost:5173/`，让用户看一眼再往下走。

### 2.2 技能按级别触发

- **L0**：不主动加载 `brainstorming` / `writing-plans` / `subagent-driven-development` / TDD。
- **L1**：逻辑部分按 TDD；不写正式计划文档；不派子代理。
- **L2**：完整链（可先 `brainstorming` 定型需求 → `writing-plans` → `executing-plans` → `verification-before-completion`），
  收尾可派 `case-reviewer` 审内容、`verifier` 跑验收。
- 例外：用户明确说「走完整流程 / 用 xxx 技能 / 写个计划」时，级别让位于用户指令。

### 2.3 停等与提交

- 每个 L0/L1 任务改完**停下等确认**，给出 dev 地址；连续同类微调可以合并成一次确认。
- L2 一个任务一个 commit；微调允许合并提交，但提交信息仍要 Conventional Commits + 中文。
- 提交前跑完该级别对应的验证，不跑不许说「完成」。

---

## 3. 子代理（SubAgent）

子代理是**新起一个子会话、带全新上下文**干活，父会话只看它的最终报告。
好处是省父会话上下文、可以做独立审查；代价是它不知道你刚才聊过什么，指令必须自包含。

### 3.1 本项目已配置的两个

文件在 `.opencode/agents/`（随仓库同步，换设备自动生效）：

| 子代理 | 用途 | 权限 | 什么时候派 |
| --- | --- | --- | --- |
| `case-reviewer` | 按 DoD + 项目约定审查改动，只报告不修 | 禁 `edit`、禁派子代理；shell 只允许 `git diff/status/log/show`，并额外 deny `--output` 与重定向（防止借只读命令写文件） | L2 新案例收尾、合并前自审 |
| `verifier` | 按影响面跑命令、给证据、判通过/不通过 | 禁 `edit`、禁派子代理；shell 开放但**只用于跑验证**（靠 prompt 约束，不是硬隔离） | 需要「fresh 证据」时、合并前 |

两者的输出都是**只读报告**：`case-reviewer` 给 P0/P1/P2 清单，`verifier` 给命令原文 + 输出摘要 + DoD 对照。
它们都不会替你改代码——发现的问题回到主会话改，改完再验一次。

### 3.2 怎么调用

在对话里点名即可（工具名是 `subagent`）：

```text
用 case-reviewer 审一下刚新增的 practice/xxx 案例
用 verifier 跑一遍这次改动的验收，按影响面选命令
```

也可以并行派两个（审查和验证互不依赖）：

```text
同时派 case-reviewer 审内容、verifier 跑验收，最后汇总给我
```

### 3.3 怎么再加一个

配置位置（两处都合法，本项目用项目级）：

- 项目级：`.opencode/agents/<name>.md` → agent ID 为 `<name>`，子目录会变成 `team/<name>`
- 全局级：`~/.config/opencode/agents/<name>.md`
- 也可以写在任意配置文件的 `agents` 字段里（JSONC）

Markdown 格式（frontmatter 与 JSON 配置字段一致，正文即 system prompt）：

```md
---
description: 一句话说明用途（会被主 agent 用来挑人，必须写）
mode: subagent          # primary / subagent / all；自定义 agent 不写默认 primary
model: opencode/deepseek-v4.1-flash-free#high   # 可选，不写就继承父会话模型
color: "#0ea5e9"        # 可选，TUI 里的颜色
permissions:
  - action: edit
    resource: "*"
    effect: deny
  - action: shell
    resource: "*"
    effect: deny
  - action: shell
    resource: "git diff*"
    effect: allow
---

这里是 system prompt：职责、步骤、输出格式、禁止事项。
```

权限规则要点：

- `permissions` 是**有序列表，最后匹配的那条生效**，所以「先写宽泛的 deny，再写具体的 allow」。
- 常用 `action`：`shell`（命令）、`edit`（改文件）、`subagent`（派子代理）、`read` / `glob` / `grep`、`webfetch` / `websearch`、`skill`。
- `resource` 对 shell 是**原始命令文本**，通配符可用；`~` / `$HOME` 只在 `read` / `edit` / `external_directory` 里展开。
- V2 已废弃 `tools` / `permission`（单数）/ `disable` / `maxSteps` 等旧字段，别再写。

### 3.4 什么时候别用子代理

- L0 / L1：上下文就几百行，派子代理反而更慢更贵。
- 需要连续判断的改动（改一处看一处效果）：子代理看不到中间反馈。
- 需要用户逐步确认的交互式调试：子代理不能替用户拍板。
- 一句话能说清的事：直接自己做。

### 3.5 自检与排障

```bash
opencode debug agents    # 自建 agent 必须出现在列表里，mode=subagent
```

- 不出现：检查目录名是 `agents`（复数）、frontmatter 的 `description` 是否为空、YAML 是否缩进错误。
- 派不动：父 agent 可能被 `subagent` 权限挡住；或子代理 `mode` 写成了 `primary`。
- 明明说只读却在改文件：检查是否漏了 `action: edit / resource: "*" / effect: deny`。

---

## 4. 与 skills 的关系

| 场景 | 用什么 |
| --- | --- |
| 需求没定型 | `brainstorming` → 写计划 |
| 计划有了，任务独立 | `executing-plans`（本机推荐）或 `dispatching-parallel-agents` |
| 每个任务想要独立上下文 + 独立审查 | `subagent-driven-development`（已补齐 prompts/scripts，成本最高）或 `executing-plans` + `case-reviewer` |
| 收尾要证据 | `verification-before-completion` + `verifier` 子代理 |
| 合并前要人看 | `requesting-code-review` + `case-reviewer` |

---

## 5. 常见问题

**技能数量对不上 / 日志报 `duplicate skill name`**
同一技能在多个扫描路径各有一份（本项目踩过：`~/.config/opencode/skills` 的旧副本 + `~/.agents/skills` 的新副本；
或 `~/.claude/skills` 里放 junction 指回 `~/.agents`）。同名不是随机生效，而是按优先级覆盖：
`~/.config/opencode/skills` > `~/.agents/skills` > `~/.claude/skills` > 内置，所以旧副本会压过新版。
日志**不一定**报 `duplicate skill name`（这次 .config/.agents 重名就没报），别只看日志。
排查：`opencode api get /api/skill` 看每条技能的 `path`，把所有实体收敛到 `~/.agents/skills`。

**技能不触发**
先确认 `description` 里的触发词能覆盖你的说法（例如「改样式」不一定命中任何技能，这是正常的）；
再确认没有被 `deny` 隐藏、没有关掉自动调用（V2 写在技能 frontmatter 的 `metadata` 下：
```yaml
metadata:
  opencode/autoinvoke: false   # 也可用顶层 disable-model-invocation: true
```
写在顶层不会生效）。

**子代理不出现 / 派不动**
见 3.5。

**TUI 里手敲 `!` 命令中文乱码**
全局 UTF-8 插件已迁到 V2 的 `ctx.shell.hook("create.before")`（见 `AGENTS.md` 约定段），命令交给进程前自动加编码前缀；
若 `--pure` 启动或插件加载失败，AI 的 shell 输出仍会乱码，日志关键字是 `failed to load plugin`。

---

## 6. 维护清单

- 新增技能：放 `~/.agents/skills/<name>/SKILL.md`（CLI 管理的唯一位置），**不要**再放 `~/.config/opencode/skills`，两处同名会被判重复。
- 新增子代理：放 `.opencode/agents/<name>.md`（项目共用）或 `~/.config/opencode/agents/`（全局），
  必须写 `description`，必须显式 `deny` 掉不该有的权限。
- 改完本文件：同步更新 `AGENTS.md` 的「当前进度」与「决策记录」，并说明验证方式。
- 技能数量、内置技能名会随 opencode 版本变化：写死数字的地方（本文件第 1 节、`AGENTS.md`）升级后要复核。
