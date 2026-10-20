// ============================================================
// 案例：主题切换（CSS 变量 + 系统偏好 + 无闪烁）
// - 三态：亮 / 暗 / 跟随系统
// - 局部预览面板演示 CSS 变量切换（不影响全站主题）
// - 演示 matchMedia 监听系统偏好变化
// - 说明刷新不闪白屏的内联脚本方案
// ============================================================
<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

type Mode = 'light' | 'dark' | 'auto'

const STORAGE_KEY = 'moyu-theme-demo'

// ============================================================
// 状态
// ============================================================

/** 读取上次选择（auto 为默认） */
function loadMode(): Mode {
  const saved = window.localStorage.getItem(STORAGE_KEY)
  return saved === 'light' || saved === 'dark' || saved === 'auto' ? saved : 'auto'
}

const mode = ref<Mode>(loadMode())

/** 系统是否偏好暗色 */
const systemDark = ref(window.matchMedia('(prefers-color-scheme: dark)').matches)

/** 最终生效的主题 */
const resolved = computed<'light' | 'dark'>(() =>
  mode.value === 'auto' ? (systemDark.value ? 'dark' : 'light') : mode.value,
)

/** 切换次数（演示持久化） */
const switchCount = ref(0)

// ============================================================
// 系统偏好监听
// ============================================================

const mql = window.matchMedia('(prefers-color-scheme: dark)')

/** //! 系统偏好变化时同步（auto 模式下界面会跟着变） */
function onSystemChange(e: MediaQueryListEvent): void {
  systemDark.value = e.matches
}

mql.addEventListener('change', onSystemChange)

onBeforeUnmount(() => {
  mql.removeEventListener('change', onSystemChange)
})

// ============================================================
// 模式切换
// ============================================================

function setMode(next: Mode): void {
  mode.value = next
  switchCount.value++
  //! 持久化：刷新后读取（真实项目键名与站点主题共用）
  window.localStorage.setItem(STORAGE_KEY, next)
}

function resetAll(): void {
  window.localStorage.removeItem(STORAGE_KEY)
  mode.value = 'auto'
  switchCount.value = 0
}

/** 预览面板上的文字（展示变量消费） */
const previewText = computed(() =>
  resolved.value === 'dark' ? '暗色预览：文字与背景都来自 CSS 变量' : '亮色预览：文字与背景都来自 CSS 变量',
)

/** 模式选项（模板 v-for 用，避免在模板里做类型断言） */
const modeOptions: { key: Mode; label: string }[] = [
  { key: 'light', label: '亮色' },
  { key: 'dark', label: '暗色' },
  { key: 'auto', label: '跟随系统' },
]
</script>

<template>
  <div class="theme-demo">
    <!-- 模式切换 -->
    <section class="theme-controls">
      <div class="seg">
        <button
          v-for="m in modeOptions"
          :key="m.key"
          class="seg-btn"
          :class="{ active: mode === m.key }"
          @click="setMode(m.key)"
        >
          {{ m.label }}
        </button>
      </div>

      <p class="theme-meta">
        系统偏好：<b>{{ systemDark ? '暗色' : '亮色' }}</b>
        · 当前生效：<b>{{ resolved }}</b>
        · 切换 <b>{{ switchCount }}</b> 次
      </p>

      <button
        class="btn-reset"
        @click="resetAll"
      >
        重置（清除持久化）
      </button>
    </section>

    <!-- 局部预览：通过 data-theme + CSS 变量切换 -->
    <section
      class="theme-preview"
      :data-theme="resolved"
    >
      <div class="tp-header">
        <span class="tp-dot" />
        <span class="tp-title">{{ previewText }}</span>
      </div>
      <p class="tp-content">
        这块面板的配色全部由 <code>--preview-bg</code> / <code>--preview-text</code>
        等局部变量控制；切换 <code>[data-theme]</code> 时变量整体换一套，页面无需重排结构。
      </p>
      <button class="tp-btn">
        示例按钮
      </button>
    </section>

    <!-- 无闪烁方案说明 -->
    <section class="theme-note">
      <h3>刷新为什么不闪白？</h3>
      <p>
        在 <code>index.html</code> 的 <code>&lt;head&gt;</code> 里、CSS 之前内联一小段脚本：
        先读 <code>localStorage</code>（没有就查 <code>matchMedia</code>），第一时间给
        <code>&lt;html&gt;</code> 加 <code>class="dark"</code>——首帧就是正确颜色。
      </p>
      <pre class="theme-code">&lt;script&gt;
  const saved = localStorage.getItem('theme')
  const dark = saved
    ? saved === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.classList.toggle('dark', dark)
&lt;/script&gt;</pre>
      <p class="theme-warn">
        ⚠️ 不要把这段放到 Vue 应用挂载后执行——那时首帧已经画完，必然闪一下。
      </p>
    </section>
  </div>
</template>

<style scoped>
.theme-demo {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

/* ---------- 控制 ---------- */

.theme-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.seg {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.seg-btn {
  padding: 0.24rem 0.6rem;
  border: none;
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  cursor: pointer;

  &.active {
    background-color: var(--primary);
    color: #fff;
  }
}

.theme-meta {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

.btn-reset {
  padding: 0.22rem 0.55rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  cursor: pointer;

  &:hover {
    color: var(--text);
  }
}

/* ---------- 局部主题变量 ---------- */

.theme-preview {
  --preview-bg: #ffffff;
  --preview-panel: #f6f7fb;
  --preview-text: #1f2430;
  --preview-muted: #5b6472;
  --preview-border: #dfe3ec;
  --preview-primary: #4f46e5;

  border: 1px solid var(--preview-border);
  border-radius: var(--radius-btn);
  background-color: var(--preview-bg);
  color: var(--preview-text);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  transition: background-color 0.2s ease, color 0.2s ease;
}

/*! 暗色只需要换变量，不用写第二套结构样式 */
.theme-preview[data-theme='dark'] {
  --preview-bg: #14161c;
  --preview-panel: #1b1f27;
  --preview-text: #eef1f7;
  --preview-muted: #9aa4b5;
  --preview-border: #2a2f3a;
  --preview-primary: #8b93ff;
}

.tp-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.tp-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background-color: var(--preview-primary);
}

.tp-title {
  font-size: 0.875rem;
  font-weight: 600;
}

.tp-content {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.7;
  color: var(--preview-muted);

  code {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    padding: 0.02rem 0.25rem;
    border-radius: var(--radius-sm);
    background-color: var(--preview-panel);
    color: var(--preview-text);
  }
}

.tp-btn {
  align-self: flex-start;
  padding: 0.26rem 0.7rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--preview-primary);
  background-color: var(--preview-primary);
  color: #fff;
  font-size: 0.8125rem;
  cursor: pointer;
}

/* ---------- 说明 ---------- */

.theme-note {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  padding: 0.7rem;

  h3 {
    margin: 0 0 0.3rem;
    font-size: 0.875rem;
    color: var(--text);
  }

  p {
    margin: 0 0 0.35rem;
    font-size: 0.8125rem;
    line-height: 1.7;
    color: var(--text-secondary);
  }

  code {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    padding: 0.02rem 0.24rem;
    background-color: var(--code-bg);
    border-radius: var(--radius-sm);
  }
}

.theme-code {
  margin: 0 0 0.35rem;
  padding: 0.45rem 0.55rem;
  background-color: var(--code-bg);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  line-height: 1.65;
  color: var(--text-secondary);
  overflow-x: auto;
}

.theme-warn {
  color: var(--warning) !important;
}
</style>
