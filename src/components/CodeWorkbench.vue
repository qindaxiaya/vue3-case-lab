// ============================================================
// 代码工作台（2026-10-19 重设计：重点行高亮 + 行号）
// - 重点行标记：code/*.txt 中行首 `//! ` 前缀的行会被高亮展示
//   （渲染时去掉前缀，整行加主色浅背景 + 左侧色条——参照 VitePress line highlighting）
// - 行号列固定显示（说明中提「第 N 行」可对照）
// - tab 分组：「核心代码」（code/*.txt）+「完整源码」（Demo.vue 全文）
// ============================================================
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import hljs from 'highlight.js/lib/core'
import typescript from 'highlight.js/lib/languages/typescript'
import javascript from 'highlight.js/lib/languages/javascript'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import json from 'highlight.js/lib/languages/json'
import 'highlight.js/styles/github.css'
import { useTheme } from '../composables/useTheme'
import type { CodeTab } from '../examples/registry'

// 按需注册语言（控制体积）
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('json', json)

const props = defineProps<{
  /** 核心代码片段 tabs */
  tabs: CodeTab[]
  /** Demo.vue 完整源码（「完整源码」tab） */
  demoSource: string
}>()

const { isDark } = useTheme()

// ---------- 暗色代码主题（动态 link 启停，避免双主题样式表互相覆盖） ----------
let darkLink: HTMLLinkElement | null = null
const darkCssUrl = import.meta.glob(
  '../../../node_modules/highlight.js/styles/github-dark.css',
  { query: '?url', import: 'default', eager: true },
)
const darkHref = Object.values(darkCssUrl)[0] as string | undefined

watch(
  isDark,
  (dark) => {
    if (dark && darkHref) {
      if (!darkLink) {
        darkLink = document.createElement('link')
        darkLink.rel = 'stylesheet'
        darkLink.href = darkHref
        document.head.appendChild(darkLink)
      }
      darkLink.disabled = false
    } else if (darkLink) {
      darkLink.disabled = true
    }
  },
  { immediate: true },
)

// ---------- tab 状态 ----------
const activeKey = ref('')

/** 全部 tab：核心代码 + 完整源码 */
const allTabs = computed(() => [
  ...props.tabs.map((t) => ({
    key: `core:${t.name}`,
    label: t.name,
    lang: t.lang,
    content: t.content,
  })),
  {
    key: 'source:Demo.vue',
    label: 'Demo.vue（完整源码）',
    lang: 'vue',
    content: props.demoSource,
  },
])

const activeTab = computed(
  () => allTabs.value.find((t) => t.key === activeKey.value) ?? allTabs.value[0],
)

watch(
  allTabs,
  (tabs) => {
    if (tabs.length > 0 && !tabs.some((t) => t.key === activeKey.value)) {
      activeKey.value = tabs[0].key
    }
  },
  { immediate: true },
)

// ---------- 行级渲染（行号 + 重点行标记 + 逐行高亮） ----------

/** 渲染后的行结构 */
interface CodeLine {
  /** 行号（1 起） */
  no: number
  /** 高亮后的 HTML（已转义） */
  html: string
  /** 是否重点行（//! 标记） */
  highlight: boolean
}

/**
 * 把原始代码文本渲染为行数组：
 * 1. 行首 `//! ` 前缀 → 去掉前缀并标记为重点行
 * 2. 逐行 hljs 高亮（教学代码行短，逐行高亮足够；避免跨行 token 拆分问题）
 */
const renderedLines = computed<CodeLine[]>(() => {
  const tab = activeTab.value
  if (!tab) return []
  const lang = tab.lang === 'vue' || tab.lang === 'html' ? 'xml' : tab.lang

  return tab.content.split('\n').map((rawLine, i) => {
    // 重点行标记：行首 //! + 空格（渲染时去掉标记符号，保留注释文字）
    const isHighlight = /^\s*\/\/!\s?/.test(rawLine)
    const line = isHighlight ? rawLine.replace(/^(\s*)\/\/!\s?/, '$1') : rawLine

    let html: string
    try {
      // 逐行高亮；空行跳过（hljs 对空串无意义）
      html = line
        ? hljs.highlight(line, { language: lang, ignoreIllegals: true }).value
        : ''
    } catch {
      // 语言解析失败时降级为纯文本（已转义）
      html = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    }

    return { no: i + 1, html, highlight: isHighlight }
  })
})

/** 当前 tab 是否有重点行（tab 标签旁的 ★ 提示） */
function tabHasHighlight(tab: { content: string }): boolean {
  return tab.content.split('\n').some((l) => /^\s*\/\/!\s?/.test(l))
}

// ---------- 复制（复制原始文本，含 //! 标记——方便对照源文件） ----------
const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

async function copyCode(): Promise<void> {
  if (!activeTab.value) return
  // 复制时去掉 //! 前缀（给用户的应该是可直接使用的代码）
  const cleaned = activeTab.value.content
    .split('\n')
    .map((l) => l.replace(/^(\s*)\/\/!\s?/, '$1'))
    .join('\n')
  await navigator.clipboard.writeText(cleaned)
  copied.value = true
  if (copiedTimer) clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => {
    copied.value = false
  }, 1500)
}
</script>

<template>
  <section
    class="code-workbench card"
    aria-label="代码区"
  >
    <!-- tab 栏 + 复制按钮 -->
    <div class="workbench-bar">
      <div
        class="tab-list"
        role="tablist"
      >
        <button
          v-for="tab in allTabs"
          :key="tab.key"
          class="tab-btn"
          :class="{ 'tab-btn--active': tab.key === activeKey }"
          type="button"
          role="tab"
          :aria-selected="tab.key === activeKey"
          @click="activeKey = tab.key"
        >
          <!-- 含重点行的 tab 加 ★ 提示 -->
          <span
            v-if="tabHasHighlight(tab)"
            class="tab-star"
            aria-hidden="true"
          >★</span>
          {{ tab.label }}
        </button>
      </div>

      <button
        class="btn-ghost copy-btn"
        type="button"
        @click="copyCode"
      >
        {{ copied ? '已复制 ✓' : '复制' }}
      </button>
    </div>

    <!-- 代码区：行号 + 逐行渲染 -->
    <div class="code-scroll">
      <table class="code-table">
        <tbody>
          <tr
            v-for="line in renderedLines"
            :key="line.no"
            :class="{ 'line--highlight': line.highlight }"
          >
            <!-- 行号列（固定宽度，不可选中） -->
            <td
              class="line-no"
              aria-hidden="true"
            >
              {{ line.no }}
            </td>
            <!-- 代码列（逐行高亮 HTML） -->
            <td class="line-code">
              <!-- eslint-disable-next-line vue/no-v-html —— hljs 输出为转义后的安全 HTML -->
              <code v-html="line.html || '&nbsp;'" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.code-workbench {
  overflow: hidden;
}

.workbench-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.4rem 0.6rem;
  border-bottom: 1px solid var(--border);
}

.tab-list {
  display: flex;
  gap: 0.15rem;
  overflow-x: auto;
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.7rem;
  font-size: 0.8rem;
  font-family: var(--font-mono);
  color: var(--text-secondary);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  white-space: nowrap;
  transition:
    color var(--transition),
    background-color var(--transition);
}

.tab-btn:hover {
  color: var(--text);
  background-color: var(--bg);
}

.tab-btn--active {
  color: var(--primary);
  font-weight: 500;
}

/* 含重点行的 tab 星标 */
.tab-star {
  color: var(--warning);
  font-size: 0.7rem;
}

.copy-btn {
  font-size: 0.8rem;
  padding: 0.3rem 0.8rem;
  flex-shrink: 0;
}

.code-scroll {
  overflow-x: auto;
  background-color: var(--code-bg);
}

.code-table {
  /* 表格布局：行号列 + 代码列，宽度随内容 */
  border-collapse: collapse;
  font-family: var(--font-mono);
  font-size: 0.825rem;
  line-height: 1.7;
  min-width: 100%;
}

.line-no {
  /* 行号列：固定宽度、右对齐、不可选中、弱化颜色 */
  width: 2.5rem;
  padding: 0 0.75rem 0 1rem;
  text-align: right;
  color: var(--text-secondary);
  opacity: 0.55;
  user-select: none;
  vertical-align: top;
}

.line-code {
  padding: 0 1.5rem 0 0.25rem;
  white-space: pre; /* 保留缩进与换行语义 */
  vertical-align: top;
}

.line-code code {
  /* 重置全局行内 code 样式 */
  background: none;
  border: none;
  padding: 0;
  font-size: inherit;
}

/* 重点行：主色浅背景 + 左侧色条（VitePress line highlighting 惯例） */
.line--highlight {
  background-color: var(--primary-soft);

  .line-no {
    opacity: 1;
    color: var(--primary-soft-text);
    font-weight: 600;
    /* 左侧色条（用行号列左边框表现） */
    box-shadow: inset 3px 0 0 var(--primary);
  }
}
</style>
