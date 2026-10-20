// ============================================================
// 案例深入资料面板（notes.md 五段）
// - 只在「深入」tab 激活时加载（懒加载 + 缓存，见 examples/notes.ts）
// - marked 渲染 markdown，渲染完成后用 highlight.js 给代码块上色
// - v-html 内容全部来自仓库内的 notes.md（受控内容），不接受用户输入
// ============================================================
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { marked } from 'marked'
import { loadCaseNotes, stripNotesTitle } from '../examples/notes'
import { highlightCodeBlocks } from '../utils/code-highlight'

const props = defineProps<{
  /** 分类 id（定位 notes.md） */
  categoryId: string
  /** 案例 id（定位 notes.md） */
  caseId: string
  /** 当前 tab 是否激活：未激活不加载，避免进详情页就下载资料 */
  active: boolean
}>()

/** notes.md 原文 */
const markdown = ref('')
/** 加载中（首次打开或重试） */
const loading = ref(false)
/** 加载失败（显示重试） */
const failed = ref(false)
/** 渲染容器：v-html 生成代码块后在这里统一高亮 */
const bodyEl = ref<HTMLElement | null>(null)

/** 请求序号：快速切案例时丢弃旧请求结果 */
let requestSeq = 0

/** 去掉 H1 后按 GFM 渲染（表格、代码围栏、粗体等） */
const html = computed(() => {
  if (!markdown.value) return ''
  try {
    return marked.parse(stripNotesTitle(markdown.value), {
      gfm: true,
      async: false,
    }) as string
  } catch {
    // 解析异常按空内容处理，避免整页白屏
    return ''
  }
})

/** 加载当前案例的 notes.md */
async function load(): Promise<void> {
  const seq = ++requestSeq
  loading.value = true
  failed.value = false

  try {
    const text = await loadCaseNotes(props.categoryId, props.caseId)
    // 期间切换了案例/重复点击：旧结果直接丢弃
    if (seq !== requestSeq) return
    markdown.value = text
  } catch {
    if (seq !== requestSeq) return
    markdown.value = ''
    failed.value = true
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

/**
 * 监听案例与激活状态
 * - 换案例：清掉旧内容（即使当前在「说明」tab）
 * - 首次打开「深入」：发起加载；已加载过则直接复用
 */
watch(
  () => [props.categoryId, props.caseId, props.active] as const,
  (next, prev) => {
    const caseChanged =
      !prev || prev[0] !== next[0] || prev[1] !== next[1]

    if (caseChanged) {
      requestSeq++
      markdown.value = ''
      failed.value = false
      loading.value = false
    }

    if (!next[2]) return
    // 已有内容不重复加载；失败或为空时允许再次尝试
    if (!failed.value && markdown.value) return
    void load()
  },
  { immediate: true },
)

/**
 * 渲染完成后高亮代码块
 * marked 生成的 DOM 没有 Vue 绑定，只能拿到元素后用 highlight.js 处理
 */
watch(
  html,
  async () => {
    await nextTick()
    if (bodyEl.value) highlightCodeBlocks(bodyEl.value)
  },
  { immediate: true },
)

/** 骨架屏各行的宽度（百分比），模拟自然段落 */
const SKELETON_WIDTHS = [88, 100, 94, 76, 96, 64]
</script>

<template>
  <article
    class="card notes-card"
    aria-label="深入资料"
  >
    <!-- 加载中：骨架条（不使用 spinner） -->
    <div
      v-if="loading"
      class="notes-skeleton"
      aria-busy="true"
      aria-live="polite"
    >
      <span class="sr-only">正在加载深入资料</span>
      <span
        v-for="(width, index) in SKELETON_WIDTHS"
        :key="index"
        class="notes-skeleton-line"
        :style="{ width: `${width}%` }"
      />
    </div>

    <!-- 加载失败：给出重试入口 -->
    <div
      v-else-if="failed"
      class="notes-status"
      role="alert"
    >
      <p>深入资料加载失败，请稍后重试。</p>
      <button
        class="btn-ghost"
        type="button"
        @click="load"
      >
        重试
      </button>
    </div>

    <!-- 空状态：目录里没有 notes.md 或内容为空 -->
    <p
      v-else-if="!html"
      class="notes-status"
    >
      本案例暂无深入资料。
    </p>

    <!-- 正文：五段 markdown -->
    <div
      v-else
      ref="bodyEl"
      class="notes-body"
      v-html="html"
    />
  </article>
</template>

<style scoped>
.notes-card {
  padding: 1.35rem 1.6rem;
}

/* ---------- 加载骨架 ---------- */

.notes-skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  padding: 0.4rem 0;
}

.notes-skeleton-line {
  height: 0.82rem;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    var(--bg) 25%,
    var(--border) 37%,
    var(--bg) 63%
  );
  background-size: 400% 100%;
  animation: notes-shimmer 1.4s ease infinite;
}

@keyframes notes-shimmer {
  from {
    background-position: 100% 0;
  }

  to {
    background-position: 0 0;
  }
}

/* ---------- 状态提示 ---------- */

.notes-status {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  flex-wrap: wrap;
  margin: 0;
  padding: 0.6rem 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

/* ---------- Markdown 正文 ---------- */

.notes-body {
  font-size: 0.93rem;
  line-height: 1.75;
  color: var(--text);
  overflow-wrap: break-word;
}

.notes-body :deep(h2) {
  font-size: 1.06rem;
  font-weight: 600;
  line-height: 1.5;
  color: var(--text);
  padding-bottom: 0.42rem;
  border-bottom: 1px solid var(--border);
  margin: 1.8rem 0 0.8rem;
}

.notes-body :deep(h2:first-child) {
  margin-top: 0;
}

.notes-body :deep(h3) {
  font-size: 0.96rem;
  font-weight: 600;
  margin: 1.2rem 0 0.5rem;
}

.notes-body :deep(p) {
  margin: 0.7rem 0;
}

.notes-body :deep(strong) {
  color: var(--primary);
  font-weight: 600;
}

.notes-body :deep(ul),
.notes-body :deep(ol) {
  margin: 0.6rem 0;
  padding-left: 1.4em;
}

.notes-body :deep(li) {
  margin: 0.25rem 0;
}

.notes-body :deep(blockquote) {
  margin: 0.8rem 0;
  padding: 0.1rem 0 0.1rem 0.9rem;
  border-left: 3px solid var(--primary-soft-text);
  color: var(--text-secondary);
}

.notes-body :deep(hr) {
  border: none;
  border-top: 1px solid var(--border);
  margin: 1.4rem 0;
}

.notes-body :deep(a) {
  color: var(--primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* 行内代码：沿用全局 code 样式，仅微调字号 */
.notes-body :deep(p code),
.notes-body :deep(li code) {
  font-size: 0.86em;
}

/* 代码块：站点底色 + 横向滚动；hljs 主题只保留 token 颜色 */
.notes-body :deep(pre) {
  margin: 0.9rem 0;
  padding: 0.9rem 1rem;
  background-color: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  overflow-x: auto;
}

.notes-body :deep(pre code),
.notes-body :deep(pre code.hljs) {
  display: block;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 0;
  font-size: 0.85rem;
  line-height: 1.65;
}

/* 表格：小屏横向滚动，不撑破页面 */
.notes-body :deep(table) {
  display: block;
  max-width: 100%;
  margin: 0.9rem 0;
  overflow-x: auto;
  border-collapse: collapse;
  font-size: 0.86rem;
}

.notes-body :deep(th),
.notes-body :deep(td) {
  padding: 0.42rem 0.72rem;
  border: 1px solid var(--border);
  text-align: left;
  white-space: nowrap;
}

.notes-body :deep(th) {
  background-color: var(--bg);
  font-weight: 600;
}

.notes-body :deep(img) {
  max-width: 100%;
}

/* ---------- 小屏 ---------- */

@media (max-width: 560px) {
  .notes-card {
    padding: 1.1rem 1.15rem;
  }

  .notes-body {
    font-size: 0.9rem;
  }

  .notes-body :deep(h2) {
    font-size: 1rem;
  }

  .notes-body :deep(pre) {
    padding: 0.75rem 0.8rem;
  }
}
</style>
