# 测试门禁（CI）

## 1. 现象与场景

本地测试全绿，合并后线上白屏；CI 只跑测试不跑类型检查，`vue-tsc` 的错误漏到构建；覆盖率没人看，测试越写越少。

复现：点「模拟 CI 运行」，依次跑 lint → 类型 → 测试 → 构建；注入一个失败后，门禁变红并阻止合并。

## 2. 原理

门禁的核心是「本地和 CI 跑同一套命令」：`lint`、`type-check`、`vitest run`、`build` 一条不能少。覆盖率阈值写进配置，低于阈值直接失败，避免测试形同虚设。

CI 跑绿还不够，仓库要把它设为 required check，否则红灯也能 merge。pre-commit 只跑改动文件的 lint/format，全量检查放 CI；否则开发者会用 `--no-verify` 绕过。

## 3. 关键代码

```json
{
  "scripts": {
    "test": "vitest run",
    "type-check": "vue-tsc --noEmit",
    "lint": "eslint . --max-warnings 0",
    "build": "vue-tsc -b && vite build"
  }
}
```

```ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      // 1. 低于阈值直接失败，覆盖率才有约束力
      thresholds: { lines: 80, functions: 80, branches: 70 },
      include: ['src/**/*.{ts,vue}'],
      // 2. 排除类型与案例演示代码，只统计业务逻辑
      exclude: ['src/**/*.d.ts', 'src/examples/**'],
    },
  },
})
```

```yaml
# 3. CI 与本地同命令；npm ci 严格按锁文件
- run: npm ci
- run: npm run lint
- run: npm run type-check
- run: npx vitest run --coverage
- run: npm run build
```

## 4. 数据对比

| 检查项 | 本地 | CI |
|---|---|---|
| lint | 0 warning | 0 warning（`--max-warnings 0`） |
| type-check | 0 error | 0 error |
| 测试 | 18 / 18 通过 | 18 / 18 通过 |
| 覆盖率阈值 | lines 80 / functions 80 / branches 70 | 同左 |
| 构建 | 通过 | 通过 |

测量方式：本项目实际运行 `npx vitest run`（18 个测试通过）、`npm run type-check`、`npm run lint`、`npm run build`；覆盖率阈值为配置目标值，不是当前覆盖率。

## 5. 追问与边界

**Q：为什么测试全绿页面却没案例？**
单测用内联假数据，绕过了真实 glob 收录逻辑。要用真实 registry 做集成测试，断言每个案例的 meta/Demo/code 都存在。

**Q：覆盖率越高越好吗？**
不是。80% 是常见基线，盲目追 100% 会写大量无意义断言；关键路径覆盖比数字重要。

**Q：pre-commit 跑全量测试行不行？**
不行，太慢会让人绕过。pre-commit 只做改动文件的 lint/format，全量放 CI。

坑：Windows 本地与 Linux CI 文件名大小写不一致会挂；锁文件必须提交。边界：CI 还要处理环境变量与快照换行符差异。
