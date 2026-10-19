# AGENTS.md — Vue 3 案例库项目记忆

> 本文件是跨设备、跨会话的记忆载体。每次会话自动加载；每完成一个任务、每做一个重要决策，必须顺手更新「当前进度」与「决策记录」。

## 项目速览

- **定位**：本地运行的 Vue 3 高级案例速查站——分类导航 + 搜索，每个案例含可交互演示、带中文注释的核心代码、可下钻完整源码、中文原理说明（私人收藏查阅用）
- **技术栈**：Vite + Vue 3.5（`<script setup lang="ts">`）+ TypeScript strict + Sass（SCSS，CSS 变量主题）+ Vue Router + highlight.js + marked + vitest；包管理 npm
- **常用命令**：
  - `npm run dev` — 启动开发服务器
  - `npm run type-check` — vue-tsc 类型检查
  - `npm run lint` — ESLint 检查
  - `npx vitest run` — 运行测试
- **远程仓库**：https://github.com/qindaxiaya/vue3-case-lab（私有），单 `main` 分支线性提交

## 约定

- 全程中文界面、中文说明文案；变量/函数/文件名英文
- **站点自身全部代码写中文注释**（组件/composable/工具/路由），关键逻辑逐行注释「做什么、为什么」，与案例代码同等标准
- TS strict，禁止 `any`（确需时用 `unknown` + 收窄）；ESLint `no-explicit-any` 为 error
- 组件 `<script setup lang="ts">`，组件 PascalCase，文件 kebab-case
- 禁止第三方 UI 组件库、禁止 Pinia；样式用 Sass（SCSS）+ CSS 变量主题，自建全局类 `btn-primary`/`btn-ghost`/`card`/`tag`，案例 Demo 用自身 scoped SCSS
- 暗色模式：`.dark` class 策略（`<html class="dark">`，index.html 内联脚本防闪白）+ `localStorage` 键 `moyu-theme` 持久化
- 案例目录结构（新增案例零注册成本）：
  ```
  src/examples/<category>/<case-id>/
  ├── Demo.vue        # 可交互演示（scoped SCSS、内部关键逻辑中文注释、不引用站点内部组件）
  ├── meta.ts         # default export 满足 CaseMeta（notes 三段 Markdown）
  └── code/*.txt      # 带逐行中文注释的教学代码，>60 行按步骤分段
  ```
- 案例分类：`performance`（性能监控）、`observer`（观察者）、`virtual`（虚拟渲染）、`vue3`（Vue 3 API）
- Commit：Conventional Commits + 中文描述；每任务收尾必 commit
- **工作节奏（2026-10-19 用户拍板）**：
  1. 做完一个任务/一个案例必须停下，等用户检查确认后才继续下一步
  2. 有页面变化时必须给出 dev 地址（`http://localhost:5173/`）供用户查看
  3. git 分步提交：一个任务/一个逻辑单元一个 commit，不攒大提交
- 每任务收尾必更新本文件「当前进度」段；重大取舍记入「决策记录」

## 当前进度

- **阶段**：Task 6 完成（第一个案例已可看）；Task 5（首页）未做
- 计划：`docs/superpowers/plans/2026-10-16-vue3-case-library.md`（14 个任务）
- 设计文档：`docs/superpowers/specs/2026-10-16-vue3-case-library-design.md`
- 已完成：
  - ✅ 设计文档 + 实施计划
  - ✅ GitHub 私有仓库（qindaxiaya/vue3-case-lab 私有）
  - ✅ Task 1 脚手架（Vite+Vue3+TS+Sass 样式系统+ESLint+AGENTS.md）
  - ✅ Task 2 案例注册表（import.meta.glob 自动发现 + filterCases 搜索，vitest 11/11）
  - ✅ Task 3 站点壳（路由/侧边栏/搜索/useTheme 暗色切换）
  - ✅ Task 4 案例页三件套（CodeWorkbench 高亮+复制+双组tab / CaseNotes marked 渲染 / CasePage 组装）
  - ✅ Task 6 perf-observer 案例（PerformanceObserver 面板：FP/FCP/LCP/TTFB/CLS + 制造偏移/长任务）
- 待做：Task 5（首页）→ Task 7 raf-loop → Task 8 idle-schedule → Task 9 lazy-image → Task 10 virtual-list → Task 11 watch-traps → Task 12 async-suspense → Task 13 reactive-inject → Task 14 收尾走查（tag v0.1）
- dev 地址：`http://localhost:5173/`，案例页 `/c/performance/perf-observer`

## 决策记录

| 日期 | 决策 | 说明 |
|------|------|------|
| 2026-10-16 | 视觉走大众文档站风格 | 参照 VueUse / Element Plus 文档站观感，遵循 Token 表 |
| 2026-10-16 | 单 main + 多设备 git 同步 | 不建 feature 分支；里程碑 tag v0.1 / v0.2 |
| 2026-10-16 | 代码高亮 highlight.js（github / github-dark 主题） | 零构建配置、体积小、离线可用 |
| 2026-10-19 | **样式弃 Tailwind，改用 Sass + CSS 变量** | 用户拍板；Sass 组织嵌套/mixin，CSS 变量承载主题（`.dark` 切换），案例不依赖构建插件 |
| 2026-10-19 | **站点自身代码必须写中文注释** | 用户要求；与案例代码同等标准（关键逻辑逐行注释） |
| 2026-10-19 | GitHub 仓库用 gh CLI 方式接入 | 仓库 qindaxiaya/vue3-case-lab（私有），中途修复过 token scope 问题（重新 gh auth login） |
| 2026-10-19 | **工作节奏：每任务一停、给 dev 地址、分步 commit** | 用户拍板；做完等检查确认再继续，页面变化必须给地址，一个任务一个 commit |
