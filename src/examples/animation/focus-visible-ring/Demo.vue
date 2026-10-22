// ============================================================
// 案例：键盘焦点环（focus-visible-ring）
// - 旧做法：outline: none 裸奔，Tab 到按钮完全看不出焦点在哪
// - 新做法：:focus-visible 只在键盘操作时给 outline，
//   鼠标点击不出现，键盘 Tab 出现
// - 指标：计算后的轮廓样式（none vs 2px solid）、是否键盘触发、
//   焦点进入次数与其中出现焦点环的次数
// ============================================================
<script setup lang="ts">
import { nextTick, onUnmounted, ref } from 'vue'

/** 焦点样式：none = 裸奔（旧）/ ring = 自建焦点环（新） */
type RingMode = 'none' | 'ring'

const mode = ref<RingMode>('none')
/** 当前聚焦控件的名字，来自元素上的 data-name */
const focusedName = ref('—')
/** 本次焦点是否由键盘触发：:focus-visible 无法直接读，只能用 matches 查 */
const keyboardTriggered = ref(false)
/** 浏览器计算后的轮廓样式：这是「焦点环到底有没有出现」的直接证据 */
const outlineText = ref('—')
/** 焦点进入四个控件的累计次数 */
const focusCount = ref(0)
/** 每次焦点进入，计算到的轮廓不是 none 的次数 */
const ringCount = ref(0)

const stageRef = ref<HTMLElement | null>(null)

/** 上一次聚焦的元素：模式切换后要重新量它 */
let activeEl: HTMLElement | null = null
/** 等浏览器结算焦点样式的那一帧 */
let measureFrame = 0

/** 取消待执行的测量帧 */
function cancelMeasure(): void {
  if (measureFrame) window.cancelAnimationFrame(measureFrame)
  measureFrame = 0
}

/**
 * 读元素计算后的轮廓
 * @param el 正在聚焦的元素
 * @param count 是否计入「焦点环出现次数」（切换模式时不计）
 */
function readOutline(el: HTMLElement, count: boolean): void {
  const style = window.getComputedStyle(el)
  const width = Number.parseFloat(style.outlineWidth) || 0
  const visible = style.outlineStyle !== 'none' && width > 0

  //! 轮廓是浏览器计算出来的，不是我们「以为」的：读计算样式才可信
  outlineText.value = visible ? `${style.outlineStyle} ${width}px` : 'none'
  if (visible && count) ringCount.value++
}

/** 聚焦后等一帧再量：焦点样式可能在同一帧的样式结算里才生效 */
function scheduleRead(el: HTMLElement, count: boolean): void {
  cancelMeasure()
  measureFrame = window.requestAnimationFrame(() => {
    measureFrame = 0
    // 焦点已经又移走了就不再量，避免把旧元素的样式写进面板
    if (document.activeElement !== el) return
    readOutline(el, count)
  })
}

// ---------- 焦点事件 ----------

/** 焦点进入任一控件：记录名字、判断是否键盘触发、量轮廓 */
function onFocusIn(event: FocusEvent): void {
  const target = event.target
  if (!(target instanceof HTMLElement)) return
  if (!(stageRef.value?.contains(target) ?? false)) return

  activeEl = target
  focusedName.value = target.dataset.name ?? target.tagName.toLowerCase()
  focusCount.value++

  //! 键盘还是鼠标，用 matches(':focus-visible') 现场判断
  keyboardTriggered.value = target.matches(':focus-visible')
  scheduleRead(target, true)
}

/** 焦点离开演示区：清空读数；在控件之间移动时不清 */
function onFocusOut(event: FocusEvent): void {
  const next = event.relatedTarget
  if (next instanceof Node && stageRef.value?.contains(next)) return

  activeEl = null
  cancelMeasure()
  focusedName.value = '—'
  keyboardTriggered.value = false
  outlineText.value = '—'
}

// ---------- 模式切换与重置 ----------

/** 切换焦点样式：如果当前有焦点，重新量一次（切换本身不计入出现次数） */
async function setMode(next: RingMode): Promise<void> {
  if (mode.value === next) return
  mode.value = next

  await nextTick()
  if (activeEl && document.activeElement === activeEl) {
    scheduleRead(activeEl, false)
  }
}

/** 重置：先移走焦点（避免旧焦点干扰），再回到初始模式并清空计数 */
function resetAll(): void {
  const active = document.activeElement
  if (active instanceof HTMLElement) active.blur()
  cancelMeasure()

  mode.value = 'none'
  activeEl = null
  focusedName.value = '—'
  keyboardTriggered.value = false
  outlineText.value = '—'
  focusCount.value = 0
  ringCount.value = 0
}

onUnmounted(() => {
  //! 待执行的测量帧要取消：卸载后再读节点没有意义
  cancelMeasure()
  activeEl = null
})
</script>

<template>
  <div class="fv-demo">
    <div class="bar">
      <div
        class="modes"
        role="group"
        aria-label="焦点样式"
      >
        <button
          class="mode"
          :class="{ active: mode === 'none' }"
          :aria-pressed="mode === 'none'"
          @click="setMode('none')"
        >
          无焦点样式（旧）
        </button>
        <button
          class="mode"
          :class="{ active: mode === 'ring' }"
          :aria-pressed="mode === 'ring'"
          @click="setMode('ring')"
        >
          自建焦点环（推荐）
        </button>
      </div>
      <button
        class="btn ghost"
        @click="resetAll"
      >
        重置
      </button>
    </div>

    <div
      class="stats"
      aria-live="polite"
    >
      <span>当前聚焦 <b>{{ focusedName }}</b></span>
      <span>键盘触发 <b>{{ keyboardTriggered ? '是' : '否' }}</b></span>
      <span>计算后的轮廓 <b>{{ outlineText }}</b></span>
      <span>焦点进入 <b>{{ focusCount }}</b> 次</span>
      <span>出现焦点环 <b>{{ ringCount }}</b> 次</span>
    </div>

    <!--
      四个不同控件放在同一个演示区里，focusin / focusout 挂在区域上，
      这样不用给每个控件各写一套逻辑。Tab 键会在它们之间依次移动。
    -->
    <div
      ref="stageRef"
      class="stage"
      :class="mode === 'ring' ? 'with-ring' : 'no-ring'"
      @focusin="onFocusIn"
      @focusout="onFocusOut"
    >
      <div class="grid">
        <button
          class="item item-btn"
          type="button"
          data-name="按钮"
        >
          保存设置
        </button>

        <a
          class="item item-link"
          href="#focus-demo"
          data-name="链接"
          @click.prevent
        >
          查看文档
        </a>

        <input
          class="item item-input"
          type="text"
          placeholder="输入内容"
          aria-label="示例输入框"
          data-name="输入框"
        >

        <button
          class="item item-card"
          type="button"
          data-name="卡片按钮"
        >
          <span class="card-title">卡片按钮</span>
          <span class="card-desc">整块都可以点</span>
        </button>
      </div>
    </div>

    <p class="hint">
      先在「无焦点样式」下按 Tab 键走一遍：焦点已经移动，但看不出停在哪。
      切到「自建焦点环」再按 Tab：每个控件外圈都会出现一圈轮廓，面板的「计算后的轮廓」显示具体宽度。
      用鼠标点击按钮或链接时「键盘触发」显示「否」，轮廓保持 none；输入框在多数浏览器里点一下也会出现焦点环，
      因为它随时准备接收键盘输入——这正是 :focus-visible 按「意图」判断的结果。
    </p>
  </div>
</template>

<style scoped>
.fv-demo {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.bar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.modes {
  display: inline-flex;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--code-bg);
}

.mode {
  padding: 0.4rem 0.65rem;
  border: none;
  border-radius: calc(var(--demo-radius) - 2px);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: var(--demo-text-sm);
  cursor: pointer;
  transition: background-color var(--transition), color var(--transition);

  &.active {
    background-color: var(--surface);
    color: var(--primary);
    box-shadow: var(--shadow-soft);
  }
}

.btn.ghost {
  padding: var(--demo-control-py) var(--demo-control-px);
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: var(--demo-text-md);
  cursor: pointer;
  transition: background-color var(--transition), color var(--transition);

  &:hover {
    background-color: var(--code-bg);
    color: var(--text);
  }
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--code-bg);
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

/* ---------- 演示区：两种焦点策略的唯一差别 ---------- */

.stage {
  padding: 0.9rem;
  border: 1px dashed var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--code-bg);

  /* 旧做法：把默认轮廓关掉，键盘用户彻底失去位置提示 */
  &.no-ring :focus {
    outline: none;
  }

  /*! 新做法：只在键盘操作匹配 :focus-visible 时出现轮廓 */
  &.with-ring :focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}

/* 四个控件的公共外观：差异只在内容与背景，不影响焦点环表现 */
.item {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  width: 100%;
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--surface);
  color: var(--text);
  font-size: var(--demo-text-md);
  text-align: center;
  cursor: pointer;
  transition: border-color var(--transition), background-color var(--transition),
    color var(--transition);

  &:hover {
    border-color: var(--primary);
  }
}

.item-btn {
  border-color: transparent;
  background-color: var(--primary);
  color: #fff;
  font-weight: 600;

  /* 按钮类上 hover 必须显式覆盖全局链接样式与按钮底色 */
  &:hover {
    border-color: transparent;
    background-color: var(--primary-hover);
    color: #fff;
  }
}

.item-link {
  border-color: transparent;
  background-color: transparent;
  color: var(--primary);
  /* 链接被当成按钮用时，显式去掉下划线，hover 再出现 */
  text-decoration: none;

  &:hover {
    border-color: transparent;
    color: var(--primary-hover);
    text-decoration: underline;
  }
}

.item-input {
  cursor: text;
  font-family: inherit;

  &::placeholder {
    color: var(--text-secondary);
  }
}

.item-card {
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
  background-color: var(--code-bg);
  text-align: left;
}

.card-title {
  font-size: var(--demo-text-md);
  font-weight: 600;
  color: var(--text);
}

.card-desc {
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.hint {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}

@media (max-width: 520px) {
  .modes {
    flex: 1 1 100%;
  }

  .mode {
    flex: 1;
  }

  .grid {
    grid-template-columns: 1fr;
  }

  .hint {
    font-size: var(--demo-text-xs);
  }
}
</style>
