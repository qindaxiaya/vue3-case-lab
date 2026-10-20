# 合并门禁（分支保护 / Ruleset）

## 1. 现象与场景

流水线明明红了，PR 的合并按钮却还是亮的；本地赶时间直接 `git push origin main`，也照样能进主干。团队把「合并前要跑检查」写进文档，但文档不会拦人。

复现：打开案例，保持「规则集开启」，先点「直接 push main」，再创建 PR 并把检查切成失败，最后点「合并 PR」；然后关闭规则集，重复同样的操作，观察结果差异。

## 2. 原理

自动检查（CI）只负责跑命令并报告结果；**门禁是仓库在服务端加的写入条件**，在 `git push` / 合并请求合并时检查，不依赖本地钩子。

一套最小可用的 main 门禁包含：

- **必须走 PR**：直接推 main 会被拒绝，改动必须先落到分支。
- **必需检查**：PR 上必须出现指定名称的检查，且结果为成功；检查名是 Actions 里 **job 的 `name`**，不是 workflow 名。
- **禁止强推 / 删除**：保护历史，避免 `push --force` 覆盖别人的提交。
- **线性历史**：只允许 squash / rebase，不允许产生 merge commit。
- **审批数**：单人仓库必须写 0，因为 GitHub 不允许给自己的 PR 点通过；写 1 会把自己的 PR 永久卡住。

GitHub 有两套等价能力：经典的 Branch protection 和较新的 Repository ruleset。规则集把条件、规则、绕过名单放在一个对象里，新仓库优先用它；经典分支保护在单人小仓库也够用。

## 3. 关键代码

```yaml
# .github/workflows/ci.yml（节选）
on:
  push:
    branches: [main]
  pull_request:        # 必须有：PR 上才会报告检查
jobs:
  verify:
    name: Type check, lint, test, build   # 规则集里填的就是这个
    runs-on: ubuntu-24.04
    steps:
      - run: npm ci
      - run: npm run type-check
      - run: npm run lint
      - run: npx vitest run
      - run: npm run build
```

```json
{
  "name": "main-merge-gate",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "required_linear_history" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "allowed_merge_methods": ["squash", "rebase"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "Type check, lint, test, build" }
        ]
      }
    }
  ]
}
```

```bash
# 创建 / 查看规则
gh api -X POST repos/$OWNER/$REPO/rulesets --input ruleset.json
gh api repos/$OWNER/$REPO/rules/branches/main

# 验证直推被拒（应出现 GH013）
git push origin main

# 走 PR：红灯合并会失败，绿灯后才能进 main
gh pr checks --watch
gh pr merge --squash --delete-branch
```

三个「为什么」：

- 规则集里 `required_status_checks` 写 job 名，因为 GitHub 用这个字符串匹配检查运行结果；写 workflow 名永远等不到。
- `required_approving_review_count: 0` 不是「不要 PR」，而是「要 PR、但不需要别人批准」；否则单人仓库无法合并自己的 PR。
- 不配置 `bypass_actors` 时管理员也绕不过；这才能防止「紧急情况直接推」。

## 4. 数据对比

| 验证项 | 规则集关闭 | 规则集开启（本仓库实测） |
|---|---|---|
| 直接 `git push origin main` | 成功，main 立即更新 | 拒绝：`GH013`，提示必须走 PR，且必需检查未报告 |
| 红灯 PR 合并 | 允许（检查只是建议） | 拒绝：必需检查未通过（待补实测输出） |
| 绿灯 PR 合并 | 允许 | squash 合并成功（待补实测耗时） |
| 单次 Actions 耗时 | — | 25s / 31s / 38s（三次实际运行） |
| 私有免费仓库创建规则集 | — | API 403：需转公开或升级付费计划 |

测量方式：2026-10-20 在本仓库实际执行 `git push origin main`、`gh pr merge`、`gh run watch`，记录退出码与输出；Actions 耗时取 GitHub 运行页面的整数秒。

## 5. 追问与边界

**Q：CI 都绿了，为什么还要规则集？**
绿灯只说明这次检查通过，不说明代码一定从 PR 来、也不阻止有人直接推 main。规则集负责「怎么进」，CI 负责「进去前检查什么」。

**Q：为什么审批数不能设 1？**
GitHub 不允许作者给自己的 PR 点通过。单人仓库设 1 后，自己的 PR 永远差一个审批，门禁会变成死锁；团队仓库再按人数开。

**Q：检查一直显示 Expected / Waiting 怎么办？**
先核对规则集里的 `context` 和 job 的 `name` 是否逐字一致；再看 workflow 是否监听 `pull_request`，以及有没有用 `paths-ignore` 把该 job 跳过。被跳过的 job 不会报告成功。

**Q：规则集和经典分支保护选哪个？**
新项目用规则集，条件和绕过名单更集中；存量项目继续用分支保护也没问题。两者不要重复配置同一分支，排错时容易互相干扰。

**Q：管理员能绕过去吗？**
能，但必须显式配置 `bypass_actors`。本仓库没有配，所以管理员直推也会被 GH013 拒绝。绕过名单应该只给自动化账号，并记录原因。

**Q：私有仓库能开吗？**
GitHub Free 的私有仓库不支持分支保护 / 规则集，API 返回 403；要么把仓库转公开，要么升级到 Pro。这个限制不是配置问题，是账户计划问题。

**Q：门禁能保证没有 bug 吗？**
不能。它只保证「配置里的检查通过」。检查本身是否覆盖真实链路（例如案例是否被真实 glob 收录）、是否有浏览器端到端测试，仍然要单独设计。
