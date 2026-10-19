// ============================================================
// 案例说明（2026-10-19 重设计：重点化）
// - Callout 提示框：Markdown 中 `> [!TIP]` / `> [!NOTE]` / `> [!WARNING]`
//   渲染为带图标的彩色提示框（参照 GitHub Alerts / MDN callout）
// - 行内 code（API 名）用主色浅底突出（参照 Vue 官方文档）
// - 三段结构：适用场景 / 原理 / 注意点
// 内容仅来自本地 meta.ts（受信，无用户输入），v-html 安全约定见 eslint 配置
// ============================================================
<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import type { CaseNotes } from '../types/case'

const props = defineProps<{ notes: CaseNotes }>()

/**
 * 预处理 Markdown：把 GitHub Alerts 风格语法转为 callout HTML
 * 支持：> [!NOTE] / > [!TIP] / > [!WARNING]（可扩展）
 * 转换后交给 marked 正常渲染其余部分
 */
function preprocessAlerts(md: string): string {
  // 匹配 `> [!TYPE]` 行及其后续连续的 `> ` 引用行块
  return md.replace(
    /^>\s*\[!(NOTE|TIP|WARNING)\]\s*\n((?:^>.*\n?)*)/gm,
    (_match, type: string, body: string) => {
      // 去掉每行行首的 `> ` 前缀得到正文，交给 marked 渲染
      const inner = body
        .split('\n')
        .map((line) => line.replace(/^>\s?/, ''))
        .join('\n')
        .trim()
      const icon = { NOTE: '📘', TIP: '💡', WARNING: '⚠️' }[type] ?? '📘'
      // 整块以 HTML 形式注入（marked 默认允许 HTML 块）
      return `<div class="callout callout--${type.toLowerCase()}"><span class="callout-icon" aria-hidden="true">${icon}</span><div class="callout-body">${marked.parse(inner, { async: false })}</div></div>\n`
    },
  )
}

/** 渲染三段说明（预处理 alerts → marked 解析） */
const rendered = computed(() => ({
  usage: marked.parse(preprocessAlerts(props.notes.usage), { async: false }),
  principle: marked.parse(preprocessAlerts(props.notes.principle), {
    async: false,
  }),
  caveats: marked.parse(preprocessAlerts(props.notes.caveats), {
    async: false,
  }),
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
      <!-- v-html 仅渲染本地 meta 受信内容（eslint vue/no-v-html 已关，见配置） -->
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
  gap: 1.75rem;
}

/* 段标题：文档站小节规格 */
.note-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 0.6rem;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid var(--border);
}

/* ---------- 正文排版（prose 手工排） ---------- */

.note-body :deep(p) {
  margin: 0 0 0.75em;
  line-height: 1.8;
}

.note-body :deep(p:last-child) {
  margin-bottom: 0;
}

.note-body :deep(ul),
.note-body :deep(ol) {
  margin: 0 0 0.75em;
  padding-left: 1.4em;
}

.note-body :deep(li) {
  margin-bottom: 0.35em;
  line-height: 1.75;
}

/* 正文行内 code（API 名）：主色浅底突出（Vue 官方文档风格） */
.note-body :deep(code) {
  font-size: 0.85em;
  background-color: var(--primary-soft);
  color: var(--primary-soft-text);
  border: none;
  border-radius: 4px;
  padding: 0.12em 0.4em;
  font-weight: 500;
}

/* 代码块（非行内）：恢复中性底色 */
.note-body :deep(pre) {
  background-color: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 0.75rem 1rem;
  overflow-x: auto;
  margin: 0 0 0.85em;
}

.note-body :deep(pre code) {
  background: none;
  color: inherit;
  font-weight: 400;
  padding: 0;
}

/* ---------- Callout 提示框（GitHub Alerts 风格） ---------- */

.note-body :deep(.callout) {
  display: flex;
  gap: 0.65rem;
  padding: 0.8rem 1rem;
  border-radius: var(--radius-btn);
  border: 1px solid;
  margin: 0 0 1em;
  font-size: 0.9rem;
}

.note-body :deep(.callout-icon) {
  flex-shrink: 0;
  line-height: 1.6;
}

.note-body :deep(.callout-body) {
  flex: 1;
  min-width: 0;
}

.note-body :deep(.callout-body p) {
  margin-bottom: 0.4em;
}

.note-body :deep(.callout-body p:last-child) {
  margin-bottom: 0;
}

/* TIP：绿色系 */
.note-body :deep(.callout--tip) {
  background-color: var(--success-soft);
  border-color: color-mix(in srgb, var(--success) 30%, transparent);

  .callout-body strong {
    color: var(--success);
  }
}

/* NOTE：蓝色系（主色） */
.note-body :deep(.callout--note) {
  background-color: var(--primary-soft);
  border-color: color-mix(in srgb, var(--primary) 30%, transparent);
}

/* WARNING：黄色系 */
.note-body :deep(.callout--warning) {
  background-color: var(--warning-soft);
  border-color: color-mix(in srgb, var(--warning) 30%, transparent);

  .callout-body strong {
    color: var(--warning);
  }
}
</style>
