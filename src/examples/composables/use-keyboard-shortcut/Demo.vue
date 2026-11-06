// ============================================================
// 案例：useKeyboardShortcuts —— 快捷键声明式注册（use-keyboard-shortcut）
// - 左边（手写）：每个快捷键各挂一个 window 监听器，自己写 if 判断
// - 右边（推荐）：一次注册整张快捷键表，一个监听器分发，输入框里自动让路
// - 对比点：输入框内是否误触发、修饰键是否精确、监听器个数
// ============================================================
<script setup lang="ts">
import { onBeforeUnmount, onMounted, onScopeDispose, reactive, ref } from 'vue'
import type { InputInst } from 'naive-ui'

// ============================================================
// 快捷键封装
// ============================================================

/** 键位声明：'alt+k' / '/' / 'escape'，修饰键用 ctrl / meta / alt / shift */
type ShortcutMap = Record<string, (event: KeyboardEvent) => void>

type ShortcutOptions = {
  /** 允许在输入框里触发（默认：没有修饰键的组合在输入框里让路） */
  enableOnInput?: boolean
  /** 命中时回调（演示里写日志用） */
  onHit?: (binding: string) => void
  /** 在输入框里被跳过时回调 */
  onIgnored?: (binding: string) => void
}

/** 解析后的一份键位：'alt+k' → { key: 'k', alt: true, … } */
type ParsedBinding = {
  key: string
  ctrl: boolean
  meta: boolean
  alt: boolean
  shift: boolean
}

/** 'alt+k' → { key: 'k', alt: true, ctrl: false, … } */
function parseBinding(binding: string): ParsedBinding {
  const parts = binding.toLowerCase().split('+')
  const rawKey = parts.pop() ?? ''
  return {
    // Escape 兼容 'esc' 简写
    key: rawKey === 'esc' ? 'escape' : rawKey,
    ctrl: parts.includes('ctrl'),
    meta: parts.includes('meta'),
    alt: parts.includes('alt'),
    shift: parts.includes('shift'),
  }
}

/** 焦点是否在可编辑元素里：输入框 / 多行文本 / 下拉 / 富文本 */
function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'
}

/**
 * 快捷键注册
 * @param map     键位 → 回调（一次注册全部）
 * @param options 输入框策略与命中回调
 */
function useKeyboardShortcuts(map: ShortcutMap, options: ShortcutOptions = {}) {
  /** 键位与解析结果先算好，按键时只做比对，不再解析字符串 */
  const entries = Object.entries(map).map(([binding, handler]) => ({
    binding,
    parsed: parseBinding(binding),
    handler,
  }))

  /** 是否已经挂上 window 监听器 */
  const attached = ref(false)
  /** 命中次数 */
  const hits = ref(0)
  /** 在输入框里被跳过的次数 */
  const ignored = ref(0)

  function onKeydown(event: KeyboardEvent): void {
    const typing = isEditable(event.target)
    const pressed: ParsedBinding = {
      key: event.key.toLowerCase(),
      ctrl: event.ctrlKey,
      meta: event.metaKey,
      alt: event.altKey,
      shift: event.shiftKey,
    }

    for (const { binding, parsed, handler } of entries) {
      if (pressed.key !== parsed.key) continue
      //! 修饰键必须完全一致：只判 altKey 的话，Alt+Shift+K 也会被当成 Alt+K
      if (pressed.ctrl !== parsed.ctrl || pressed.meta !== parsed.meta) continue
      if (pressed.alt !== parsed.alt || pressed.shift !== parsed.shift) continue

      const hasModifier = parsed.ctrl || parsed.meta || parsed.alt
      //! 光按 / 在输入框里是「打字」，必须让路；
      //! Esc 不产生任何字符、是「退出」语义，所以照样生效，别把用户关在输入框里
      const bypassTyping = hasModifier || parsed.key === 'escape'
      //! 用 return 而不是 preventDefault：让路时字符要能正常打进输入框
      if (typing && !bypassTyping && !options.enableOnInput) {
        ignored.value++
        options.onIgnored?.(binding)
        return
      }

      event.preventDefault()
      hits.value++
      options.onHit?.(binding)
      handler(event)
      return
    }
  }

  /** 挂上监听器（重复调用无副作用） */
  function start(): void {
    if (attached.value) return
    window.addEventListener('keydown', onKeydown)
    attached.value = true
  }

  /** 摘掉监听器：组件卸载走这里，演示里切模式也走这里 */
  function stop(): void {
    if (!attached.value) return
    window.removeEventListener('keydown', onKeydown)
    attached.value = false
  }

  // 先挂上，调用方想延后绑定就自己 stop()；作用域结束一定会解绑
  start()
  onScopeDispose(stop)

  return { attached, hits, ignored, start, stop }
}

// ============================================================
// 演示状态
// ============================================================

type Mode = 'manual' | 'auto'

/** 当前对比的实现：默认停在「手写」这一侧，先看到问题 */
const mode = ref<Mode>('manual')

/** 手写版的计数（封装版用自己的 ref，见 auto） */
const manualStats = reactive({ listeners: 0, hits: 0, typingMisses: 0 })

/** 输入框内容：用来验证「在输入框里按 / 到底进没进去」 */
const text = ref('')
const searchRef = ref<InputInst | null>(null)
/** 快速跳转面板是否打开（Alt+K 开、Esc 关） */
const paletteOpen = ref(false)

type LogEntry = { id: number; mode: string; result: string; label: string }
const logs = ref<LogEntry[]>([])
let logId = 0

/** 键位 → 展示文案 */
const LABELS: Record<string, string> = { 'alt+k': 'Alt + K', '/': '/', escape: 'Esc' }

/** 写一条日志（最多留 6 条，新的在最上面） */
function pushLog(modeName: string, result: string, label: string): void {
  logId += 1
  logs.value = [{ id: logId, mode: modeName, result, label }, ...logs.value].slice(0, 6)
}

// ============================================================
// 两个实现共同的动作
// ============================================================

function openPalette(): void {
  paletteOpen.value = true
}

function focusSearch(): void {
  searchRef.value?.focus()
}

function closePalette(): void {
  paletteOpen.value = false
}

// ============================================================
// 手写版：三个快捷键各挂一个监听器
// ============================================================

function bindManual(): () => void {
  //! 真实项目里也常这样：不同功能各自加一个 keydown，
  //! 于是窗口上挂着好几个监听器，谁都想 preventDefault
  const onCommand = (event: KeyboardEvent): void => {
    //! 只判了 altKey：Alt+Shift+K 也会被当成 Alt+K
    if (event.altKey && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      manualStats.hits++
      pushLog('手写', '命中', LABELS['alt+k'] ?? 'Alt + K')
      openPalette()
    }
  }

  const onSlash = (event: KeyboardEvent): void => {
    //! 没判断焦点在哪：在输入框里打 / 会被吞掉，还顺手记成一次「命中」
    if (event.key === '/') {
      event.preventDefault()
      manualStats.hits++
      const fromInput = isEditable(event.target)
      if (fromInput) manualStats.typingMisses++
      pushLog('手写', fromInput ? '误触发（正在输入）' : '命中', '/')
      focusSearch()
    }
  }

  const onEscape = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      const fromInput = isEditable(event.target)
      manualStats.hits++
      if (fromInput) manualStats.typingMisses++
      pushLog('手写', fromInput ? '误触发（正在输入）' : '命中', 'Esc')
      closePalette()
    }
  }

  window.addEventListener('keydown', onCommand)
  window.addEventListener('keydown', onSlash)
  window.addEventListener('keydown', onEscape)
  manualStats.listeners = 3

  return () => {
    window.removeEventListener('keydown', onCommand)
    window.removeEventListener('keydown', onSlash)
    window.removeEventListener('keydown', onEscape)
    manualStats.listeners = 0
  }
}

// ============================================================
// 封装版：一次注册整张表
// ============================================================

const auto = useKeyboardShortcuts(
  {
    'alt+k': () => openPalette(),
    '/': () => focusSearch(),
    escape: () => closePalette(),
  },
  {
    onHit: (binding) => pushLog('封装', '命中', LABELS[binding] ?? binding),
    onIgnored: (binding) => pushLog('封装', '已忽略（正在输入）', LABELS[binding] ?? binding),
  },
)

// 默认演示手写版，封装版先摘下来（同步执行，不会漏事件）
auto.stop()

// ============================================================
// 模式切换：谁在用就挂谁，另一个彻底摘掉
// ============================================================

let detachManual: (() => void) | null = null

function applyMode(): void {
  detachManual?.()
  detachManual = null
  auto.stop()

  if (mode.value === 'manual') {
    detachManual = bindManual()
  } else {
    auto.start()
  }
}

function setMode(value: string | number | boolean | undefined): void {
  if (value !== 'manual' && value !== 'auto') return
  mode.value = value
  applyMode()
}

onMounted(applyMode)
onBeforeUnmount(() => {
  detachManual?.()
  detachManual = null
})

/** 重置计数与日志（不改模式） */
function resetAll(): void {
  manualStats.hits = 0
  manualStats.typingMisses = 0
  auto.hits.value = 0
  auto.ignored.value = 0
  logs.value = []
  paletteOpen.value = false
  text.value = ''
}
</script>

<template>
  <div class="uk-demo">
    <p class="hint">
      点一下输入框，试着打一个 <code>/</code>；再按 <code>Alt + K</code> 打开快速跳转、<code>Esc</code> 关闭。
      两套实现轮流生效：手写在窗口上挂 3 个监听器，封装版由 <code>useKeyboardShortcuts</code> 统一分发，面板里的计数都是真实按键。
    </p>

    <div class="bar">
      <n-radio-group
        :value="mode"
        size="small"
        @update:value="setMode"
      >
        <n-radio-button value="manual">
          手写监听（默认）
        </n-radio-button>
        <n-radio-button value="auto">
          封装版
        </n-radio-button>
      </n-radio-group>
      <n-button
        size="small"
        @click="resetAll"
      >
        重置计数
      </n-button>
    </div>

    <ul class="key-list">
      <li class="key-item">
        <span class="key-chip">Alt + K</span>
        <span class="key-desc">打开快速跳转（带修饰键，输入框里也生效）</span>
      </li>
      <li class="key-item">
        <span class="key-chip">/</span>
        <span class="key-desc">聚焦输入框（没修饰键，输入框里应让路）</span>
      </li>
      <li class="key-item">
        <span class="key-chip">Esc</span>
        <span class="key-desc">关闭快速跳转（不产生字符，输入框里也生效）</span>
      </li>
    </ul>

    <n-input
      ref="searchRef"
      v-model:value="text"
      data-stat="typing"
      placeholder="在这里输入文字：先打一个 /，再按 Alt + K"
    />

    <div
      v-if="paletteOpen"
      class="palette"
      data-stat="palette"
    >
      <span class="palette-title">快速跳转</span>
      <span class="palette-item">首页</span>
      <span class="palette-item">案例列表</span>
      <span class="palette-item">本页说明</span>
      <span class="palette-tip">按 Esc 关闭</span>
    </div>

    <table class="stats">
      <thead>
        <tr>
          <th>指标</th>
          <th>手写监听</th>
          <th>封装版</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>当前 window 监听器</td>
          <td data-stat="manual-listeners">
            {{ manualStats.listeners }}
          </td>
          <td data-stat="auto-listeners">
            {{ auto.attached.value ? 1 : 0 }}
          </td>
        </tr>
        <tr>
          <td>命中次数</td>
          <td data-stat="manual-hits">
            {{ manualStats.hits }}
          </td>
          <td data-stat="auto-hits">
            {{ auto.hits.value }}
          </td>
        </tr>
        <tr>
          <td>输入框内误触发</td>
          <td
            :class="{ bad: manualStats.typingMisses > 0 }"
            data-stat="manual-miss"
          >
            {{ manualStats.typingMisses }}
          </td>
          <td>0</td>
        </tr>
        <tr>
          <td>输入框内正确忽略</td>
          <td>0</td>
          <td
            :class="{ good: auto.ignored.value > 0 }"
            data-stat="auto-ignored"
          >
            {{ auto.ignored.value }}
          </td>
        </tr>
      </tbody>
    </table>

    <ul
      class="log"
      data-stat="logs"
    >
      <li
        v-for="entry in logs"
        :key="entry.id"
        class="log-item"
      >
        <span class="log-mode">{{ entry.mode }}</span>
        <span class="log-key">{{ entry.label }}</span>
        <span class="log-result">{{ entry.result }}</span>
      </li>
      <li
        v-if="!logs.length"
        class="log-empty"
      >
        按一下快捷键，这里会出现记录
      </li>
    </ul>
  </div>
</template>

<style scoped>
.uk-demo {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.hint {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}

.hint code {
  padding: 0.05rem 0.25rem;
  border-radius: var(--radius-sm);
  background-color: var(--bg-subtle);
  font-family: var(--font-mono);
  font-size: var(--demo-text-xs);
}

.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
}

/* 窄屏下两个模式标签放不下时换行，而不是顶出容器 */
.bar :deep(.n-radio-group) {
  flex-wrap: wrap;
}

.key-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.key-item {
  display: grid;
  grid-template-columns: 5rem 1fr;
  align-items: center;
  gap: 0.5rem;
}

.key-chip {
  justify-self: start;
  padding: 0.1rem 0.45rem;
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  border-radius: var(--radius-sm);
  background-color: var(--bg-subtle);
  font-family: var(--font-mono);
  font-size: var(--demo-text-xs);
  color: var(--text);
}

.key-desc {
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);
}

.palette {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  padding: var(--demo-block-pad);
  border: 1px solid color-mix(in srgb, var(--primary) 40%, var(--border));
  border-radius: var(--demo-radius);
  background-color: color-mix(in srgb, var(--primary-soft) 50%, var(--bg));
}

.palette-title {
  font-size: var(--demo-text-sm);
  font-weight: 600;
  color: var(--text);
}

.palette-item {
  padding: 0.1rem 0.4rem;
  border-radius: var(--radius-tag);
  background-color: var(--bg);
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.palette-tip {
  margin-left: auto;
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.stats {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--demo-text-sm);

  th,
  td {
    padding: 0.3rem 0.45rem;
    border-bottom: 1px solid var(--border);
    text-align: left;
  }

  th {
    font-weight: 500;
    color: var(--text-secondary);
  }

  th:first-child,
  td:first-child {
    width: 44%;
    color: var(--text-secondary);
  }

  td {
    font-family: var(--font-mono);
    color: var(--text);
  }
}

.bad {
  color: var(--danger) !important;
}

.good {
  color: var(--success) !important;
}

.log {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin: 0;
  padding: var(--demo-block-pad);
  list-style: none;
  border-radius: var(--demo-radius);
  background-color: var(--bg-subtle);
  min-height: 3.4rem;
}

.log-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: var(--demo-text-xs);
}

.log-mode {
  padding: 0.02rem 0.35rem;
  border-radius: var(--radius-tag);
  background-color: var(--bg);
  color: var(--text-secondary);
}

.log-key {
  font-family: var(--font-mono);
  color: var(--text);
}

.log-result {
  color: var(--text-secondary);
}

.log-empty {
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}
</style>
