// ============================================================
// 代码工作台：tab 切换 + highlight.js 高亮 + 复制按钮
// tab 分两组：
//   「核心代码」= code/*.txt 教学片段
//   「完整源码」= Demo.vue 全文（只读下钻）
// ============================================================
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import hljs from 'highlight.js/lib/core'
import typescript from 'highlight.js/lib/languages/typescript'
import javascript from 'highlight.js/lib/languages/javascript'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import json from 'highlight.js/lib/languages/json'
// 浅色主题默认加载；暗色主题按需动态注入（watch isDark 控制 link 启停）
import 'highlight.js/styles/github.css'
import { useTheme } from '../composables/useTheme'
import type { CodeTab } from '../examples/registry'

// 注册需要的语言（按需，避免全量语言包体积）
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('xml', xml) // html/vue 走 xml 规则
hljs.registerLanguage('css', css)
hljs.registerLanguage('json', json)

const props = defineProps<{
  /** 核心代码片段 tabs */
  tabs: CodeTab[]
  /** Demo.vue 完整源码文本 */
  demoSource: string
}>()

const { isDark } = useTheme()

// ---------- 暗色代码主题 ----------
// github-dark.css 与 github.css 的选择器同为 .hljs，静态双导入会互相覆盖；
// 因此浅色用静态导入，暗色用动态 <link> 按需注入并启停
let darkLink: HTMLLinkElement | null = null

// 首次导入暗色主题 CSS（?url 拿到静态资源地址，Vite 构建期处理）
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
        // 创建并缓存 link 节点（仅创建一次）
        darkLink = document.createElement('link')
        darkLink.rel = 'stylesheet'
        darkLink.href = darkHref
        document.head.appendChild(darkLink)
      }
      // 启用暗色主题（后加载的样式表覆盖浅色）
      darkLink.disabled = false
    } else if (darkLink) {
      // 浅色时禁用暗色样式表（disabled 后浅色 github.css 重新生效）
      darkLink.disabled = true
    }
  },
  { immediate: true },
)

// ---------- tab 状态 ----------
// 当前选中的 tab key：'core:<name>' 或 'source:Demo.vue'
const activeKey = ref('')

// 全部 tab 合并列表：核心代码在前，完整源码殿后
const allTabs = computed(() => [
  ...props.tabs.map((t) => ({
    key: `core:${t.name}`,
    label: t.name,
    lang: t.lang,
    content: t.content,
    isSource: false,
  })),
  {
    key: 'source:Demo.vue',
    label: 'Demo.vue（完整源码）',
    lang: 'vue', // vue 走 xml/html 高亮规则
    content: props.demoSource,
    isSource: true,
  },
])

// 当前激活 tab 的数据
const activeTab = computed(
  () => allTabs.value.find((t) => t.key === activeKey.value) ?? allTabs.value[0],
)

// tabs 变化（路由切换案例）时重置到第一个 tab
watch(
  allTabs,
  (tabs) => {
    if (tabs.length > 0 && !tabs.some((t) => t.key === activeKey.value)) {
      activeKey.value = tabs[0].key
    }
  },
  { immediate: true },
)

// ---------- 高亮 ----------
// 每次切换 tab 后对 <pre><code> 重新执行高亮
const codeEl = ref<HTMLElement | null>(null)

watch(activeKey, async () => {
  // 等 DOM 更新完成后再高亮（否则拿到的是旧节点）
  await nextTick()
  if (codeEl.value) {
    // 清掉旧高亮 class 后重新应用（highlight.js 幂等）
    codeEl.value.removeAttribute('data-highlighted')
    hljs.highlightElement(codeEl.value)
  }
})

// vue 语言映射到 xml 注册名
function hlLang(lang: string): string {
  return lang === 'vue' || lang === 'html' ? 'xml' : lang
}

// ---------- 复制 ----------
/** 复制按钮反馈状态（null=默认文案，'done'=已复制） */
const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

/** 复制当前 tab 代码到剪贴板，按钮短暂显示「已复制」 */
async function copyCode(): Promise<void> {
  if (!activeTab.value) return
  await navigator.clipboard.writeText(activeTab.value.content)
  copied.value = true
  // 1.5s 后恢复默认文案（防定时器叠加）
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

    <!-- 代码展示区（横向可滚动） -->
    <pre class="code-block"><code
      ref="codeEl"
      :class="`language-${hlLang(activeTab?.lang ?? 'plaintext')}`"
    >{{ activeTab?.content }}</code></pre>
  </section>
</template>

<style scoped>
.code-workbench {
  overflow: hidden; /* 让内部代码区裁剪圆角 */
}

.workbench-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--border);
}

.tab-list {
  display: flex;
  gap: 0.25rem;
  overflow-x: auto; /* tab 多时横向滚动 */
}

.tab-btn {
  padding: 0.3rem 0.8rem;
  font-size: 0.8rem;
  font-family: var(--font-mono);
  color: var(--text-secondary);
  background: none;
  border: 1px solid transparent;
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
  color: var(--primary-soft-text);
  background-color: var(--primary-soft);
  font-weight: 500;
}

.copy-btn {
  font-size: 0.8rem;
  padding: 0.3rem 0.8rem;
  flex-shrink: 0;
}

.code-block {
  margin: 0;
  padding: 1rem 1.25rem;
  /* 代码块底色随主题（highlight.js 主题类作用于 code 内部 token，
     块底色用我们自己的变量，浅色 github / 暗色 github-dark 对应） */
  background-color: var(--code-bg) !important;
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  line-height: 1.6;
}

.code-block code {
  /* 重置全局行内 code 样式（此处是块级代码展示） */
  background: none;
  border: none;
  padding: 0;
  font-size: inherit;
}

/* 暗色下 GitHub Dark 主题需要覆盖 hljs 默认背景 */
:global(.dark) .code-block :deep(.hljs) {
  background: transparent;
}
</style>
