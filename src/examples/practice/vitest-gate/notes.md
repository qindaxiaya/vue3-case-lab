# 测试门禁（CI）

## 1. 现象与场景

本地测试全绿，合并到主干却挂了；类型错误、首屏包体悄悄变大，都没人发现。

复现：点「模拟 CI 运行」，依次跑类型检查 → 代码检查 → 单元测试 → 构建 → 体积门禁；注入一个失败后，门禁变红并阻止合并。

## 2. 原理

门禁的核心是「本地和 CI 跑同一套命令」：`type-check`、`lint`、`test`、`build`、`check:bundle` 一条不能少。任何一步失败就中断，后面的步骤不再执行——红灯必须挡住合并。

为什么体积也要进门禁：类型和测试都发现不了「懒加载被改回全量打包」。首屏 gzip 从 90 KB 涨到 500 KB，页面还是能打开，但用户要多等几秒。体积门禁把这条线画死，回归时直接失败。

CI 跑绿还不够，仓库要把它设为 required check，否则红灯也能 merge。pre-commit 只跑改动文件的 lint/format，全量检查放 CI；否则开发者会用 `--no-verify` 绕过。

## 3. 关键代码

```json
{
  "scripts": {
    "type-check": "vue-tsc -b",
    "lint": "eslint . --max-warnings 0",
    "test": "vitest run",
    "build": "vue-tsc -b && vite build",
    "check:bundle": "node scripts/check-bundle.mjs"
  }
}
```

```yaml
# CI 与本地同命令；npm ci 严格按锁文件
- run: npm ci
- run: npm run type-check
- run: npm run lint
- run: npm test
- run: npm run build
- run: npm run check:bundle
```

```js
// scripts/check-bundle.mjs
const ENTRY_GZIP_BUDGET = 180 * 1024

// 1. 首屏资源 gzip 总和超预算 → 失败
// 2. 单个 JS chunk 原始体积超过 600 KB → 失败
// 3. 首屏 JS 里出现教学代码标记「//! 中文」→ 失败（源码被内联）
```

三处判断分别对应三种回归：首屏整体变胖、某个懒加载 chunk 变成巨无霸、按需加载被改回同步导入。

## 4. 数据对比

| 检查项 | 本地 | CI |
|---|---|---|
| 类型检查 | 0 error（`vue-tsc -b`） | 0 error |
| 代码检查 | 0 warning（`--max-warnings 0`） | 0 warning |
| 单元测试 | 53 / 53 通过 | 53 / 53 通过 |
| 生产构建 | 通过 | 通过 |
| 体积门禁 | 通过（首屏 gzip 108.9 KB，预算 180 KB） | 通过 |

测量方式：2026-10-27 在本机运行 `npx vitest run`（53 个测试通过）、`npm run type-check`、`npm run lint`、`npm run build`、`npm run check:bundle`；首屏 gzip 取自体积门禁输出，随代码变化会浮动。

## 5. 追问与边界

**Q：为什么测试全绿页面却没案例？**
单测用内联假数据，绕过了真实 glob 收录逻辑。要用真实 registry 做集成测试，断言每个案例的 meta/Demo/code 都存在。

**Q：为什么体积也要门禁？**
类型和测试都发现不了包体回归。首屏多 400 KB 不会让任何断言变红，但用户会多等几秒；体积门禁是唯一能自动拦住它的检查。

**Q：pre-commit 跑全量测试行不行？**
不行，太慢会让人绕过。pre-commit 只做改动文件的 lint/format，全量放 CI。

坑：Windows 本地与 Linux CI 文件名大小写不一致会挂；锁文件必须提交；Node 版本不一致会让构建产物或测试行为漂移。

边界：体积门禁只拦首屏与单 chunk，不衡量运行时性能；CI 还要处理环境变量与快照换行符差异。
