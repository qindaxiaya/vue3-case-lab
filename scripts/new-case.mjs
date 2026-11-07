#!/usr/bin/env node
// ============================================================
// 案例脚手架（new:case）
//
// 为什么要有这个脚本：
// 新增案例要手抄四件套（Demo / meta / notes / code），复制同类案例再逐个改名，
// 既容易漏改 id，也容易忘掉 notes 的五段与「禁止编数字」这些约定。
// 这里一次生成可运行、可被 registry 自动收录的骨架，并把收尾检查清单打印出来。
//
// 用法：
//   npm run new:case -- <分类> <案例id>            # 生成四件套
//   npm run new:case -- <分类> <案例id> --dry-run  # 只打印将创建的文件
//
// 校验：
// - 分类必须在 src/examples/categories.ts 里（正则扫描，不引 TS 运行时）
// - 案例 id 只允许小写 kebab-case：^[a-z0-9]+(-[a-z0-9]+)*$
// - 目标目录已存在直接拒绝，避免覆盖已有案例
// ============================================================
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/** 仓库根目录 = 运行命令的目录（package.json scripts 都在根目录执行） */
const ROOT = process.cwd()
/** 案例根目录 */
const EXAMPLES_DIR = path.join(ROOT, 'src/examples')
/** 分类定义文件（唯一真相） */
const CATEGORIES_FILE = path.join(EXAMPLES_DIR, 'categories.ts')

/** 命令行参数：去掉 -- 开头的开关，剩下按位置取分类与案例 id */
const rawArgs = process.argv.slice(2)
const DRY_RUN = rawArgs.includes('--dry-run')
const [categoryId, caseId] = rawArgs.filter((arg) => !arg.startsWith('--'))

/** 统一报错并退出（校验失败都走这里，保证退出码为 1） */
function fail(message) {
  console.error(`[new:case] ${message}`)
  process.exit(1)
}

if (!categoryId || !caseId) {
  fail('用法：npm run new:case -- <分类> <案例id> [--dry-run]')
}

// ---------- 读取分类表 ----------
// 只做正则扫描、不执行 TS：脚本要足够轻，不依赖 Vite / ts-node。
const categoriesSource = readFileSync(CATEGORIES_FILE, 'utf8')
const categories = [...categoriesSource.matchAll(
  /id:\s*['"]([^'"]+)['"]\s*,\s*name:\s*['"]([^'"]+)['"]/g,
)].map((match) => ({ id: match[1], name: match[2] }))

if (categories.length === 0) {
  fail(`没能从 ${path.relative(ROOT, CATEGORIES_FILE)} 读到分类，请检查文件格式`)
}

const category = categories.find((item) => item.id === categoryId)
if (!category) {
  fail(
    `分类「${categoryId}」不存在；可用分类：${categories
      .map((item) => `${item.id}（${item.name}）`)
      .join('、')}`,
  )
}

// ---------- 校验案例 id 与目录 ----------
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(caseId)) {
  fail(`案例 id「${caseId}」不合法：只允许小写字母 / 数字，用连字符分隔（如 my-case）`)
}

const caseDir = path.join(EXAMPLES_DIR, category.id, caseId)
if (existsSync(caseDir)) {
  fail(`目录已存在：${path.relative(ROOT, caseDir)}（请换一个案例 id，或手动编辑已有案例）`)
}

// ---------- 模板生成 ----------
// 短前缀用于类名（use-storage → us），与现有案例的命名习惯一致。
const prefix = caseId
  .split('-')
  .map((part) => part[0])
  .join('')

/** Demo.vue 骨架：可运行、默认停在「旧做法」侧、带卸载清理提醒 */
function demoSource() {
  return `// ============================================================
// 案例：${caseId}（TODO 一句话说明这个演示在讲什么）
// 约定：
// - 默认停在「旧做法 / 问题侧」，切到另一侧才能看到正确做法
// - 面板上的数字必须来自运行时，禁止写死
// - 有定时器 / 监听器 / 观察器时，在 onUnmounted 里统一清理
// ============================================================
<script setup lang="ts">
import { onUnmounted, ref } from 'vue'

type Mode = 'bad' | 'good'

/** 当前对比模式：默认从「旧做法」开始，先看到问题 */
const mode = ref<Mode>('bad')
/** 示例计数：TODO 换成真实演示数据 */
const runs = ref(0)

/** 单选组回调的值类型收窄（Naive 传给回调的是 string | number | boolean | undefined） */
function onModeChange(value: string | number | boolean | undefined): void {
  mode.value = value === 'good' ? 'good' : 'bad'
}

/** 示例操作：TODO 换成真实逻辑 */
function run(): void {
  runs.value += 1
}

/** 重置演示状态，保证结果可复现 */
function reset(): void {
  runs.value = 0
}

// 卸载清理示例：真实案例有 setInterval / addEventListener / Observer 时在这里释放
onUnmounted(() => {
  // clearInterval(timerId)
  // target.removeEventListener('click', handler)
})
</script>

<template>
  <div class="${prefix}-demo">
    <div class="toolbar">
      <n-radio-group
        :value="mode"
        size="small"
        @update:value="onModeChange"
      >
        <n-radio-button value="bad">
          旧做法
        </n-radio-button>
        <n-radio-button value="good">
          正确做法
        </n-radio-button>
      </n-radio-group>
      <n-button
        size="small"
        @click="run"
      >
        执行一次
      </n-button>
      <n-button
        size="small"
        @click="reset"
      >
        重置
      </n-button>
    </div>

    <div
      class="panel"
      data-stat="runs"
    >
      当前模式：{{ mode === 'bad' ? '旧做法' : '正确做法' }} · 执行次数：{{ runs }}
    </div>

    <!-- TODO: 换成真实演示；两侧必须能直接看到行为或性能差异，而不是只换文案 -->
    <p class="hint">
      默认停在「旧做法」；切换后应能直接看到差异。面板数字要来自运行时测量。
    </p>
  </div>
</template>

<style scoped>
.${prefix}-demo {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.panel {
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  padding: var(--demo-block-pad);
  background-color: var(--bg);
  font-size: var(--demo-text-md);
  color: var(--text-secondary);
}

.hint {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}
</style>
`
}

/** meta.ts 骨架：四段说明与卖点先留 TODO，长度限制写在注释里 */
function metaSource() {
  return `// ============================================================
// 案例元数据：TODO 一句话说清主题
// 完成标准见 docs/case-definition-of-done.md
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: '${caseId}',
  title: 'TODO：${caseId} 案例标题',
  difficulty: 'beginner',
  // tags 3~5 个，中英文写法与同类案例保持一致
  tags: ['TODO', 'TODO', 'TODO'],
  // summary ≤40 字：一句话说清场景与做法
  summary: 'TODO：一句话说清场景与做法（不超过 40 字）',
  // sell ≤30 字：解决什么问题 + 为什么选它
  sell: 'TODO：解决什么问题 + 为什么选它（不超过 30 字）',
  explain: {
    situation: 'TODO：新手真实会遇到的场景，1~3 句，先让人有共鸣。',
    background: 'TODO：为什么会这样，把原理讲成大白话，少术语多类比。',
    action: 'TODO：这个案例具体怎么做，可以分 1/2/3 步说明。',
    conclusion: '记住一句话：TODO。什么时候该用它：TODO。',
  },
} satisfies CaseMeta
`
}

/** notes.md 骨架：严格按五段模板，第 4 段留表格与测量方法提醒 */
function notesSource() {
  return `# TODO：${caseId} 案例标题

> 本文件按 docs/templates/notes.md 五段式补全；第 4 段必须有实测数据，禁止编数字。

## 1. 现象 / 场景

TODO：一句话说清「不做会怎样」（卡顿 / 错乱 / 内存涨 / 体积大）。

复现步骤：

1. TODO
2. TODO

## 2. 原理

TODO：2~4 段，讲机制而不是结论。

- Vue 侧：依赖收集 → 调度队列 → 编译优化（按案例取相关部分）
- 浏览器侧：样式计算 → 布局 → 绘制 → 事件循环（按案例取相关部分）

每段回答「为什么」，不写「应该这样做」。

## 3. 方案：关键代码

TODO：只贴 10~30 行，与 Demo.vue 保持一致，以函数名 / 变量名定位，行号仅作辅助。

\`\`\`ts
// TODO：与 Demo.vue 一致的关键代码
\`\`\`

标注 3 处「为什么写在这里」：生命周期 / API 选型 / 清理边界。

## 4. 数据对比

| 指标 | 错误 / 全量 | 正确 / 优化 | 测量方式 |
| --- | --- | --- | --- |
| TODO | 待实测 | 待实测 | TODO：说明用 performance.now / Blob.size / DOM 计数等哪种方式 |

测量说明：

- 环境：浏览器版本 / 设备 / 数据规模
- 取样：同一操作 3 次取中位数
- 禁止编数字；数字必须来自本机 Demo 实测

非性能类案例可换成行为指标（DOM 数 / 事件次数 / 请求数 / 包体积），并在第 5 段注明「无性能差异」。

## 5. 追问与边界（面试高频）

- Q: TODO 为什么会这样？ → A: TODO
- Q: TODO 有没有替代方案？ → A: TODO
- Q: TODO 什么时候不该用？ → A: TODO

踩坑（≤3 条）：

1. TODO：触发条件 → 现象 → 修法

边界：TODO：什么情况下这套方案不适用；错误 / 正确对比开关不适用时也要写在这里。
`
}

/** code/usage.ts.txt 骨架：逐行中文注释 + //! 重点行标记 */
function codeSource() {
  return `// ============================================================
// ${caseId} 教学代码片段
// 重点行用 //! 标记：展示时高亮，复制时自动去掉标记
// ============================================================

import { onUnmounted, ref } from 'vue'

type Mode = 'bad' | 'good'

/**
 * TODO：一句话说明这个组合式函数 / 工具函数解决什么问题
 */
export function useDemo() {
  const mode = ref<Mode>('bad')
  const runs = ref(0)

  //! 关键点：把「做什么」写在函数名上，调用方不用读实现
  function setMode(value: string | number | boolean | undefined): void {
    mode.value = value === 'good' ? 'good' : 'bad'
  }

  // TODO：换成真实逻辑；数字必须来自运行时
  function run(): void {
    runs.value += 1
  }

  // 重置保证结果可复现
  function reset(): void {
    runs.value = 0
  }

  //! 清理与创建成对出现，卸载后不留定时器 / 监听器
  onUnmounted(() => {
    // clearInterval(timerId)
  })

  return { mode, runs, setMode, run, reset }
}
`
}

/** 需要写入的文件：相对案例目录的路径 → 内容 */
const files = {
  'Demo.vue': demoSource(),
  'meta.ts': metaSource(),
  'notes.md': notesSource(),
  'code/usage.ts.txt': codeSource(),
}

// ---------- 输出 ----------
if (DRY_RUN) {
  console.log(`[new:case] --dry-run：将在 ${path.relative(ROOT, caseDir)} 创建：`)
  for (const relativePath of Object.keys(files)) {
    console.log(`  ${relativePath}`)
  }
  console.log('[new:case] 未写入任何文件')
  process.exit(0)
}

for (const [relativePath, content] of Object.entries(files)) {
  const target = path.join(caseDir, relativePath)
  mkdirSync(path.dirname(target), { recursive: true })
  writeFileSync(target, content, 'utf8')
  console.log(`  创建 ${path.relative(ROOT, target)}`)
}

// 收尾清单：契约都写在这里，避免「生成完就以为做完了」
console.log(`
[new:case] 已生成 ${category.id}/${caseId}（${category.name}）

下一步：
  1. 替换四件套里的 TODO：Demo 演示、meta 卖点/摘要、notes 五段、教学代码
  2. 跑 npm run gen:cases 更新 CASES.md
  3. 跑 npx vitest run && npm run type-check
  4. 跑 npm run check:ui -- --case ${category.id}/${caseId}
  5. 更新 AGENTS.md「当前进度」
`)
