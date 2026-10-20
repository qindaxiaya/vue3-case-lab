// ============================================================
// 案例：命令面板 Command Palette（command-palette）
// - Ctrl/Cmd+K 打开、Esc 关闭（keydown 捕获 + preventDefault，压过浏览器默认行为）
// - fuse.js 模糊搜索：支持子序列/拼写容错，匹配字符高亮
// - 键盘 ↑↓ 选择、Enter 执行；命令动作真实可见（滚动/复制/跳转/反馈）
// ============================================================
<script setup lang="ts">
import Fuse from 'fuse.js'
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'

// ============================================================
// 命令定义
// ============================================================

interface Command {
  /** 稳定标识 */
  id: string
  /** 显示名（搜索主键） */
  label: string
  /** 分组名 */
  group: string
  /** 右侧操作提示 */
  hint: string
  /** 执行动作 */
  run: () => void
}

/** 执行反馈（面板底部提示条） */
const feedback = ref('')

/** 演示区配色开关（执行命令后可见变化） */
const accentOn = ref(false)

/** 命令清单：都是真实可执行动作 */
const commands: Command[] = [
  {
    id: 'top',
    label: '滚动到页面顶部',
    group: '导航',
    hint: 'window.scrollTo',
    run: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
  },
  {
    id: 'perf',
    label: '前往性能监控面板案例',
    group: '导航',
    hint: '跳转',
    run: () => window.location.assign('/cases/performance/perf-observer'),
  },
  {
    id: 'copy',
    label: '复制当前页面地址',
    group: '操作',
    hint: 'Clipboard',
    run: () => {
      void navigator.clipboard
        .writeText(window.location.href)
        .then(() => (feedback.value = '已复制：' + window.location.href))
        .catch(() => (feedback.value = '复制失败（需要 HTTPS 或 localhost 权限）'))
    },
  },
  {
    id: 'accent',
    label: '切换演示区高亮配色',
    group: '操作',
    hint: '视觉开关',
    run: () => {
      accentOn.value = !accentOn.value
      feedback.value = `演示区配色：${accentOn.value ? '已开启' : '已关闭'}`
    },
  },
  {
    id: 'reset',
    label: '重置搜索与反馈',
    group: '操作',
    hint: '重置',
    run: () => {
      keyword.value = ''
      feedback.value = '已重置'
    },
  },
]

// ============================================================
// fuse.js 模糊搜索
// ============================================================

/** 搜索索引：label 权重最高，group/hint 兜底召回 */
const fuse = new Fuse(commands, {
  keys: [
    { name: 'label', weight: 0.7 },
    { name: 'group', weight: 0.2 },
    { name: 'hint', weight: 0.1 },
  ],
  // 0 = 完全匹配，1 = 什么都算匹配；0.4 兼顾容错与噪声
  threshold: 0.4,
  includeMatches: true,
  ignoreLocation: true,
})

/** 一条结果：命令 + label 中的匹配区间（用于高亮） */
interface ResultItem {
  cmd: Command
  /** 匹配区间 [start, end]（含端点），空 = 无关键词 */
  ranges: readonly (readonly [number, number])[]
}

const keyword = ref('')

const results = computed<ResultItem[]>(() => {
  if (!keyword.value.trim()) {
    return commands.map((cmd) => ({ cmd, ranges: [] }))
  }
  return fuse.search(keyword.value).map((r) => {
    const match = r.matches?.find((m) => m.key === 'label')
    return { cmd: r.item, ranges: match?.indices ?? [] }
  })
})

/** 把 label 按匹配区间切成「命中 / 普通」片段 */
function segments(label: string, ranges: ResultItem['ranges']): { text: string; hit: boolean }[] {
  if (ranges.length === 0) return [{ text: label, hit: false }]
  const out: { text: string; hit: boolean }[] = []
  let cursor = 0
  for (const [start, end] of ranges) {
    if (start > cursor) out.push({ text: label.slice(cursor, start), hit: false })
    out.push({ text: label.slice(start, end + 1), hit: true })
    cursor = end + 1
  }
  if (cursor < label.length) out.push({ text: label.slice(cursor), hit: false })
  return out
}

// ============================================================
// 面板开关与键盘导航
// ============================================================

const open = ref(false)
/** 当前选中索引 */
const selected = ref(0)
/** 搜索输入框（打开后自动聚焦） */
const inputEl = ref<HTMLInputElement | null>(null)

/** 打开面板 */
function openPanel(): void {
  open.value = true
  selected.value = 0
  void nextTick(() => inputEl.value?.focus())
}

/** 关闭面板 */
function closePanel(): void {
  open.value = false
  keyword.value = ''
}

/** 执行当前选中项 */
function runSelected(): void {
  const item = results.value[selected.value]
  if (!item) return
  item.cmd.run()
  // 跳转型命令自己会离开页面；其余执行后关闭面板
  closePanel()
}

/** 上下移动选中（循环） */
function move(delta: number): void {
  const len = results.value.length
  if (len === 0) return
  selected.value = (selected.value + delta + len) % len
}

// 关键词变化后选中态回到第一项（避免索引越界）
watch(keyword, () => {
  selected.value = 0
})

/**
 * 全局快捷键：Ctrl/Cmd+K 开关面板
 * 注意：必须用捕获阶段 + preventDefault——Chrome 的 Ctrl+K 默认聚焦地址栏
 */
function onKeydown(e: KeyboardEvent): void {
  // Ctrl/Cmd + K：开关
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    if (open.value) closePanel()
    else openPanel()
    return
  }

  if (!open.value) return

  // 面板内键盘导航
  if (e.key === 'Escape') {
    e.preventDefault()
    closePanel()
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    move(1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    move(-1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    runSelected()
  }
}

window.addEventListener('keydown', onKeydown, true)

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown, true)
})
</script>

<template>
  <div
    class="cp-demo"
    :class="{ 'cp-demo--accent': accentOn }"
  >
    <!-- 触发入口 -->
    <div class="trigger-row">
      <button
        class="open-btn"
        @click="openPanel"
      >
        <span class="open-label">搜索命令</span>
        <span class="kbd-group">
          <kbd>Ctrl</kbd><kbd>K</kbd>
        </span>
      </button>
      <span class="trigger-hint">或随时按 Ctrl/Cmd + K</span>
    </div>

    <!-- 面板（遮罩 + 居中） -->
    <div
      v-if="open"
      class="mask"
      @click.self="closePanel"
    >
      <div
        class="palette"
        role="dialog"
        aria-modal="true"
        aria-label="命令面板"
      >
        <!-- 搜索行 -->
        <div class="search-row">
          <span
            class="search-icon"
            aria-hidden="true"
          >⌕</span>
          <input
            ref="inputEl"
            v-model="keyword"
            class="search-input"
            placeholder="输入命令，支持模糊匹配…"
            aria-label="搜索命令"
          >
          <kbd class="esc-hint">Esc</kbd>
        </div>

        <!-- 结果列表 -->
        <ul
          class="result-list"
          role="listbox"
          aria-label="命令结果"
        >
          <li
            v-for="(item, i) in results"
            :key="item.cmd.id"
            class="result-item"
            :class="{ 'result-item--active': i === selected }"
            role="option"
            :aria-selected="i === selected"
            @mouseenter="selected = i"
            @click="selected = i; runSelected()"
          >
            <span class="result-label">
              <template
                v-for="(seg, si) in segments(item.cmd.label, item.ranges)"
                :key="si"
              ><mark v-if="seg.hit">{{ seg.text }}</mark><template v-else>{{ seg.text }}</template></template>
            </span>
            <span class="result-meta">
              <span class="result-group">{{ item.cmd.group }}</span>
              <span class="result-hint">{{ item.cmd.hint }}</span>
            </span>
          </li>

          <!-- 空状态 -->
          <li
            v-if="results.length === 0"
            class="result-empty"
          >
            没有匹配的命令
          </li>
        </ul>

        <!-- 底部：键盘提示 + 执行反馈 -->
        <div class="palette-foot">
          <span class="foot-keys">
            <kbd>↑</kbd><kbd>↓</kbd> 选择 · <kbd>Enter</kbd> 执行
          </span>
          <span
            class="foot-feedback"
            aria-live="polite"
          >{{ feedback }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cp-demo {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

/* 命令执行后的可见变化：演示区高亮 */
.cp-demo--accent {
  .open-btn {
    border-color: var(--success);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 22%, transparent);
  }
}

/* ---------- 触发入口 ---------- */

.trigger-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.open-btn {
  display: inline-flex;
  align-items: center;
  gap: 2.6rem;
  padding: 0.5rem 0.85rem;
  border-radius: var(--radius-btn);
  border: 1px solid var(--border);
  background-color: var(--bg);
  color: var(--text-secondary);
  font-size: 0.82rem;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;

  &:hover {
    border-color: var(--primary);
  }
}

.kbd-group {
  display: inline-flex;
  gap: 0.25rem;
}

kbd {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  padding: 0.1rem 0.35rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background-color: var(--bg-subtle);
  color: var(--text-secondary);
}

.trigger-hint {
  font-size: 0.76rem;
  color: var(--text-secondary);
}

/* ---------- 遮罩与面板 ---------- */

.mask {
  position: fixed;
  inset: 0;
  z-index: 60;
  background-color: rgb(0 0 0 / 0.42);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
}

.palette {
  width: min(560px, 90vw);
  border-radius: var(--radius-card, 1rem);
  border: 1px solid var(--border);
  background-color: var(--bg);
  box-shadow: 0 24px 60px rgb(0 0 0 / 0.28);
  overflow: hidden;
  animation: palette-in 0.16s ease-out;
}

@keyframes palette-in {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.985);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* ---------- 搜索行 ---------- */

.search-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 0.9rem;
  border-bottom: 1px solid var(--border);
}

.search-icon {
  font-size: 1rem;
  color: var(--text-secondary);
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 0.88rem;

  &:focus {
    outline: none;
  }

  &::placeholder {
    color: var(--text-secondary);
  }
}

.esc-hint {
  flex-shrink: 0;
}

/* ---------- 结果列表 ---------- */

.result-list {
  list-style: none;
  margin: 0;
  padding: 0.3rem;
  max-height: 320px;
  overflow-y: auto;
}

.result-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  padding: 0.5rem 0.65rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.82rem;
  color: var(--text);
}

.result-item--active {
  background-color: color-mix(in srgb, var(--primary) 12%, transparent);
}

.result-label {
  flex: 1;
  min-width: 0;

  /* 模糊匹配命中字符高亮 */
  mark {
    background-color: transparent;
    color: var(--primary);
    font-weight: 700;
  }
}

.result-meta {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}

.result-group {
  font-size: 0.68rem;
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.result-hint {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--text-secondary);
}

.result-empty {
  padding: 1.2rem;
  text-align: center;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

/* ---------- 底部 ---------- */

.palette-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 0.5rem 0.9rem;
  border-top: 1px solid var(--border);
  font-size: 0.72rem;
  color: var(--text-secondary);
}

.foot-keys {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
}

.foot-feedback {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 60%;
}
</style>
