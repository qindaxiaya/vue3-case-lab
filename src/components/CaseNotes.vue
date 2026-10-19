// ============================================================
// 案例说明：三段 Markdown 渲染（适用场景 / 原理 / 注意点）
// 内容来自 meta.ts 的 notes 字段（本地可信内容，无用户输入，
// 因此 v-html 直接渲染 marked 输出，不引入 sanitize 库）
// ============================================================
<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import type { CaseNotes } from '../types/case'

const props = defineProps<{ notes: CaseNotes }>()

/** 三段说明渲染为 HTML（marked 解析 Markdown） */
const rendered = computed(() => ({
  // 渲染结果为受信本地内容，允许 v-html
  usage: marked.parse(props.notes.usage, { async: false }),
  principle: marked.parse(props.notes.principle, { async: false }),
  caveats: marked.parse(props.notes.caveats, { async: false }),
}))
</script>

<template>
  <section
    class="case-notes"
    aria-label="案例说明"
  >
    <article class="note-block">
      <h3 class="note-title">
        适用场景
      </h3>
      <!-- v-html 仅渲染 meta.ts 本地受信内容（eslint 已关 vue/no-v-html，见配置注释） -->
      <div
        class="note-body"
        v-html="rendered.usage"
      />
    </article>

    <article class="note-block">
      <h3 class="note-title">
        原理
      </h3>
      <div
        class="note-body"
        v-html="rendered.principle"
      />
    </article>

    <article class="note-block">
      <h3 class="note-title">
        注意点
      </h3>
      <div
        class="note-body"
        v-html="rendered.caveats"
      />
    </article>
  </section>
</template>

<style scoped>
.case-notes {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.note-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--primary);
  margin-bottom: 0.5rem;
}

/* 说明正文排版（prose 风格手工排） */
.note-body :deep(p) {
  margin: 0 0 0.75em;
  color: var(--text);
}

.note-body :deep(p:last-child) {
  margin-bottom: 0;
}

.note-body :deep(ul),
.note-body :deep(ol) {
  margin: 0 0 0.75em;
  color: var(--text);
}

.note-body :deep(li) {
  margin-bottom: 0.3em;
}

.note-body :deep(h2),
.note-body :deep(h3) {
  font-size: 0.95rem;
  margin: 1em 0 0.4em;
  color: var(--text);
}

.note-body :deep(code) {
  /* 行内代码沿用全局样式（base.scss），此处仅调小字号 */
  font-size: 0.85em;
}

.note-body :deep(pre) {
  /* 说明中的代码块 */
  background-color: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 0.75rem 1rem;
  overflow-x: auto;
  margin: 0 0 0.75em;
}

.note-body :deep(pre code) {
  background: none;
  border: none;
  padding: 0;
}
</style>
