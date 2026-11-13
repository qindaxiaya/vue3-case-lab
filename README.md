# Vue 3 案例库

[![CI](https://github.com/qindaxiaya/vue3-case-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/qindaxiaya/vue3-case-lab/actions/workflows/ci.yml)

本地运行的 Vue 3 高级案例速查站：分类导航 + 全局搜索，每个案例包含可交互演示、带中文注释的核心代码、完整 demo 源码，以及不参与页面渲染的五段式原理笔记。

## 特性

- 113 个案例 / 10 个分类：CSS 技巧、浏览器基础、动画与交互、性能监控、观察者、虚拟渲染、Vue 3 API、组合式函数、工程实践、后台组件
- 案例目录自包含，新增案例零注册成本（自动 glob 收录）；根目录 `CASES.md` 由脚本生成，测试校验与注册表一致
- 说明统一 SBAC 四段：场景 / 背景 / 做法 / 结论
- 暗色模式、375px 移动端适配、键盘可操作；演示区优先保证动画可见（不跟随系统「减少动态效果」）
- 源码默认收起，先看演示与说明；源码里的重点行可点击定位到演示元素
- CI 门禁：类型检查、Lint、测试、构建与体积检查，PR 必过才能进 `main`

## 技术栈

Vite · Vue 3.5（`<script setup lang="ts">`）· TypeScript strict · Sass（CSS 变量主题）· Vue Router · Naive UI（演示区按需引入）· highlight.js · marked · Vitest

## 快速开始

```bash
npm install
npm run dev
```

打开 `http://localhost:5173/`（端口被占用时 Vite 会自动换一个，以终端输出为准）。

## 常用命令

| 命令 | 作用 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 类型检查 + 生产构建 |
| `npm run type-check` | vue-tsc 类型检查 |
| `npm run lint` | ESLint（禁止 `any`） |
| `npx vitest run` | 运行测试（含案例收录与内容质量门禁） |
| `npm run check:bundle` | 首屏体积门禁（build 后执行） |
| `npm run check:ui` | 浏览器端验收（headless，需先 build + preview） |
| `npm run check:ui -- --only <关键字>` | 只跑命中的浏览器场景（5~10 秒） |
| `npm run gen:cases` | 从 registry 重新生成 `CASES.md`（`-- --check` 只校验不写） |
| `npm run new:case -- <分类> <案例id>` | 生成案例四件套骨架（`--dry-run` 先看文件） |
| `npm run audit:cases` | 静态体检（结构 / meta / notes / 清理函数 / aria） |

## 打包策略

- **路由级懒加载**：首页 / 列表 / 详情各自成 chunk，首页不再下载案例页依赖
- **案例资源按需**：`registry.ts` 只把 `meta.ts` 留作同步数据；Demo、`Demo.vue?raw`、`code/*.txt` 在打开案例或源码 tab 时才加载，并在会话内缓存
- **第三方分包**：`vite.config.ts` 用 `output.codeSplitting.groups` 拆出 `vendor-vue` / `vendor-markdown` / `vendor-naive-ui` / `vendor-utils`
- **Naive UI 按需引入**：`NaiveUiResolver` 自动按需 import；样式是 CSS-in-JS 随组件 JS 走，无独立 CSS 文件；`vendor-naive-ui` 组开启递归收编，依赖（css-render/vooks/lodash 等）全部跟着进懒加载 chunk，不进首屏
- **体积门禁**：`npm run check:bundle` 检查首屏 gzip 上限、单 chunk 体积，并禁止教学代码标记出现在首屏包；CI 在 build 后执行

实测（2026-11-13）：首屏 gzip 125 KB（门禁上限 180 KB）；详情页只按需加载当前案例的 Demo、教学代码与 notes，源码 tab 再加载该案例的文本。

### 产物结构

产物按「类型 → 用途 → 案例」分目录，不再把几百个 chunk 平铺在 `assets/` 一层。规则写在 `vite.config.ts` 的 `chunkFileName` / `assetFileName` 里，新增资源类型时按同样思路扩展即可。

```
dist/
├── index.html
├── favicon.svg
└── assets/
    ├── js/
    │   ├── index-<hash>.js           # 应用入口
    │   ├── vendor/                   # vue / markdown / naive-ui / utils
    │   ├── pages/                    # HomePage / CaseListPage / CasePage
    │   ├── cases/<分类>/<案例>/       # Demo、Demo.source、教学代码、notes
    │   ├── lib/                      # pdf.js 运行时
    │   └── workers/                  # pdf.worker
    └── css/
        ├── index-<hash>.css          # 站点样式（Naive UI 为 CSS-in-JS，无独立组件样式文件）
        ├── pages/                    # 路由页样式
        ├── cases/<分类>/<案例>/       # 案例 scoped 样式
        ├── themes/                   # highlight.js 亮/暗主题
        └── chunks/                   # 其它共享样式
```

图片、字体、其它二进制资源分别落到 `assets/media/`、`assets/fonts/`、`assets/misc/`（当前项目还没用到）。

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

```bash
npm run new:case -- <分类> <案例id>   # 生成 Demo / meta / notes / code 四件套骨架
```

生成后按 DoD 补全 TODO，再跑 `npm run gen:cases` 更新 [`CASES.md`](CASES.md)（由 `registry.ts` 生成，禁止手改）。新增案例或明显改动演示区视觉时，按 [`docs/screenshots/README.md`](docs/screenshots/README.md) 留 375px 浅 / 暗截图。验收标准见 [`docs/case-definition-of-done.md`](docs/case-definition-of-done.md)。

## 质量门禁

- `.github/workflows/ci.yml`：push `main` / PR / 手动触发，依次跑 `npm ci`、type-check、lint、vitest、build、check:bundle
- 页面验收统一用 `npm run check:ui`：headless 跑 75 个场景（页面骨架、筛选、搜索、详情、375px、动画逐页、后台交互等），退出时整棵杀进程并清理临时配置；支持 `--only` 单场景、`--case` 单案例、`--sweep` 全案例巡检、`--shot` 截图
- `npm run gen:cases -- --check`：校验 `CASES.md` 与注册表一致（脚本内已归一化 Windows 的 CRLF）
- `main` 启用 ruleset：必须走 PR、必需检查通过、禁止强推/删除、只允许线性历史
- 案例内容由测试自动校验：SBAC 四段、摘要与卖点长度、notes 五段、标题可搜索、notes 引用标识符与案例代码同源
