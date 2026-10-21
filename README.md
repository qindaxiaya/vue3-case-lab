# Vue 3 案例库

[![CI](https://github.com/qindaxiaya/vue3-case-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/qindaxiaya/vue3-case-lab/actions/workflows/ci.yml)

本地运行的 Vue 3 高级案例速查站：分类导航 + 全局搜索，每个案例包含可交互演示、带中文注释的核心代码、完整 demo 源码，以及不参与页面渲染的五段式原理笔记。

## 特性

- 56 个案例，覆盖性能监控、观察者、虚拟渲染、Vue 3 API、组合式函数、工程实践
- 案例目录自包含，新增案例零注册成本（自动 glob 收录）
- 说明统一 SBAC 四段：场景 / 背景 / 做法 / 结论
- 暗色模式、375px 移动端适配、键盘可操作、减少动态效果适配
- 源码默认收起，先看演示与说明
- CI 门禁：类型检查、Lint、测试、构建四道检查，PR 必过才能进 `main`

## 技术栈

Vite · Vue 3.5（`<script setup lang="ts">`）· TypeScript strict · Sass（CSS 变量主题）· Vue Router · highlight.js · marked · Vitest

## 快速开始

```bash
npm install
npm run dev
```

打开 `http://localhost:5173/`。

## 常用命令

| 命令 | 作用 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 类型检查 + 生产构建 |
| `npm run type-check` | vue-tsc 类型检查 |
| `npm run lint` | ESLint（禁止 `any`） |
| `npx vitest run` | 运行测试（含案例收录与内容质量门禁） |
| `npm run check:bundle` | 首屏体积门禁（build 后执行） |

## 打包策略

- **路由级懒加载**：首页 / 列表 / 详情各自成 chunk，首页不再下载案例页依赖
- **案例资源按需**：`registry.ts` 只把 `meta.ts` 留作同步数据；Demo、`Demo.vue?raw`、`code/*.txt` 在打开案例或源码 tab 时才加载，并在会话内缓存
- **第三方分包**：`vite.config.ts` 用 `output.codeSplitting.groups` 拆出 `vendor-vue` / `vendor-markdown` / `vendor-element-plus` / `vendor-utils`
- **Element Plus 样式按需**：只引入 `theme-chalk/base.css` 与暗色变量，组件样式随对应 Demo chunk 下发
- **体积门禁**：`npm run check:bundle` 检查首屏 gzip 上限、单 chunk 体积，并禁止教学代码标记出现在首屏包；CI 在 build 后执行

实测（2026-10-21）：首屏 gzip 从 521 KB 降到 91 KB；详情页按需追加约 40 KB（含语法高亮运行时），源码 tab 再加载该案例自己的文本。

## 目录结构

```
src/
├── components/        # 站点组件（搜索、代码工作台、主题切换等）
├── examples/
│   ├── <category>/<case-id>/
│   │   ├── Demo.vue   # 可交互演示
│   │   ├── meta.ts    # 标题 / 难度 / 标签 / 摘要 / SBAC 说明
│   │   ├── notes.md   # 五段式原理资料（不在页面展示）
│   │   └── code/      # 带逐行中文注释的教学代码
│   └── registry.ts    # 自动收录全部案例
├── pages/             # 首页 / 列表 / 详情
└── router.ts
```

## 新增案例

在 `src/examples/<category>/<case-id>/` 下新建 `Demo.vue`、`meta.ts`、`notes.md` 与 `code/*.txt` 即可，无需手动注册。验收标准见 [`docs/case-definition-of-done.md`](docs/case-definition-of-done.md)。

## 质量门禁

- `.github/workflows/ci.yml`：push `main` / PR / 手动触发，依次跑 `npm ci`、type-check、lint、vitest、build、check:bundle
- `main` 启用 ruleset：必须走 PR、必需检查通过、禁止强推/删除、只允许线性历史
- 案例内容由测试自动校验：SBAC 四段、摘要与卖点长度、notes 五段、标题可搜索
