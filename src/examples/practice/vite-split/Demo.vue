// ============================================================
// 案例：Vite 代码分割（vite-split）
// 勾选优化项 → 实时估算首屏体积（示意值）；
// 重点是理解「懒加载 / vendor 拆分 / 按需引入 / CDN 外置」各自解决什么问题。
// ============================================================
<script setup lang="ts">
import { computed, ref } from 'vue'

interface Option {
  id: string
  label: string
  desc: string
  /** 预估减少的首屏体积（KB，示意值） */
  save: number
}

const options: Option[] = [
  {
    id: 'lazy',
    label: '路由 / 组件懒加载',
    desc: 'import() 拆出独立 chunk，首屏只加载当前路由',
    save: 320,
  },
  {
    id: 'vendor',
    label: 'vendor 分组（Vite 8）',
    desc: 'vue / router / 工具库分包，利用长期缓存，不重复下载',
    save: 180,
  },
  {
    id: 'ondemand',
    label: '按需引入语言包',
    desc: 'highlight.js 只注册用到的语言，别整包 1MB 全带上',
    save: 240,
  },
  {
    id: 'external',
    label: '大库 CDN 外置',
    desc: '把不常变的库放到 CDN，减小自身产物（可选）',
    save: 150,
  },
  {
    id: 'preload',
    label: 'preload 关键 chunk',
    desc: '不减小体积，但提前发起请求，减少瀑布等待',
    save: 0,
  },
]

const BASE_KB = 1180
const enabled = ref<Set<string>>(new Set(['lazy']))

function toggle(id: string): void {
  const next = new Set(enabled.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  enabled.value = next
}

const saved = computed(() =>
  options.filter((o) => enabled.value.has(o.id)).reduce((sum, o) => sum + o.save, 0),
)

/** 首屏 JS（示意值，下限 220KB） */
const firstScreen = computed(() => Math.max(220, BASE_KB - saved.value))
const ratio = computed(() => Math.round((firstScreen.value / BASE_KB) * 100))

function barWidth(kb: number): string {
  return `${Math.max(4, Math.round((kb / BASE_KB) * 100))}%`
}
</script>

<template>
  <div class="vs-demo">
    <!-- 体积对比 -->
    <div class="vs-meter">
      <div class="vs-meter-row">
        <span class="vs-label">优化前</span>
        <div class="vs-bar">
          <span
            class="vs-bar-fill before"
            :style="{ width: barWidth(BASE_KB) }"
          />
        </div>
        <span class="vs-num">{{ BASE_KB }} KB</span>
      </div>
      <div class="vs-meter-row">
        <span class="vs-label">优化后（首屏）</span>
        <div class="vs-bar">
          <span
            class="vs-bar-fill after"
            :style="{ width: barWidth(firstScreen) }"
          />
        </div>
        <span class="vs-num">{{ firstScreen }} KB · {{ ratio }}%</span>
      </div>
      <p class="vs-note">
        示意值：真实体积以 <code>vite build</code> 输出和 <code>rollup-plugin-visualizer</code> 为准。
      </p>
    </div>

    <!-- 优化项 -->
    <div class="vs-options">
      <label
        v-for="opt in options"
        :key="opt.id"
        class="vs-opt"
        :class="{ on: enabled.has(opt.id) }"
      >
        <input
          type="checkbox"
          :checked="enabled.has(opt.id)"
          @change="toggle(opt.id)"
        >
        <span class="vs-opt-main">
          <span class="vs-opt-label">{{ opt.label }}</span>
          <span class="vs-opt-desc">{{ opt.desc }}</span>
        </span>
        <span class="vs-save">{{ opt.save ? '−' + opt.save + ' KB' : '时序优化' }}</span>
      </label>
    </div>

    <!-- 关键代码 -->
    <pre class="vs-code"><code>// 1. 路由懒加载：静态 import 会进首屏主包
const routes = [
  { path: '/cases', component: () => import('./views/CasesView.vue') },
]

// 2. vendor 分组：不常变的库单独一个 chunk
// Vite 8（Rolldown）用 codeSplitting.groups + priority；
// Vite 7 及以前用 output.manualChunks
build: {
  rollupOptions: {
    output: {
      codeSplitting: {
        groups: [
          { name: 'vendor-vue', test: /node_modules[\\/]vue[\\/]/, priority: 100 },
          { name: 'vendor-markdown', test: /marked|highlight\.js/, priority: 50 },
        ],
      },
    },
  },
}

// 3. 按需注册语言，别 import 整个 highlight.js
import hljs from 'highlight.js/lib/core'
import ts from 'highlight.js/lib/languages/typescript'
hljs.registerLanguage('typescript', ts)</code></pre>

    <p class="vs-hint">
      判断顺序：先用分析器找最大的 chunk → 优先把「非首屏需要」的代码拆出去 →
      再考虑 vendor 缓存与按需引入。别盲目拆太碎，请求数也是成本。
      Vite 8 的 manualChunks 会被 Rolldown 递归收编依赖，实际项目请用
      codeSplitting.groups + priority。
    </p>
  </div>
</template>

<style scoped>
.vs-demo {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

/* ---------- 体积条 ---------- */

.vs-meter {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.6rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
}

.vs-meter-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.vs-label {
  width: 6.5rem;
  flex-shrink: 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.vs-bar {
  flex: 1;
  height: 14px;
  border-radius: 999px;
  background-color: var(--code-bg);
  overflow: hidden;
}

.vs-bar-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  transition: width 0.25s ease-out;

  &.before {
    background-color: color-mix(in srgb, var(--danger) 70%, transparent);
  }

  &.after {
    background: linear-gradient(90deg, var(--primary), #06b6d4);
  }
}

.vs-num {
  width: 7rem;
  text-align: right;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.vs-note {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);

  code {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    padding: 0.02rem 0.2rem;
    background-color: var(--code-bg);
    border-radius: 3px;
  }
}

/* ---------- 优化项 ---------- */

.vs-options {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.vs-opt {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background-color: var(--bg);
  cursor: pointer;
  transition: border-color 0.15s;

  &.on {
    border-color: var(--primary);
    background-color: var(--primary-soft);
  }

  input {
    margin-top: 0.18rem;
    accent-color: var(--primary);
  }
}

.vs-opt-main {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  flex: 1;
}

.vs-opt-label {
  font-size: 0.8125rem;
  color: var(--text);
}

.vs-opt-desc {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.vs-save {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--primary);
  flex-shrink: 0;
}

/* ---------- 代码 ---------- */

.vs-code {
  margin: 0;
  padding: 0.6rem;
  max-height: 15rem;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--code-bg);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  line-height: 1.7;
  color: var(--text-secondary);
  white-space: pre;
}

.vs-hint {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.6;
}
</style>
