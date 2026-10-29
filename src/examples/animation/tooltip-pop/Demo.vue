// ============================================================
// 案例：提示气泡：延迟出现与定位（tooltip-pop）
// - 旧做法：直接依赖原生 title 属性，延迟、样式、换行都由浏览器决定
// - 新做法：自建气泡，绝对定位到触发器上方居中，移入延迟 180ms 出现，
//   移出立刻消失；键盘聚焦同样触发，并带 tooltip 语义
// - 指标：出现延迟是否可控、触发来源、本次出现用时、触摸跳过次数
// - 窄屏把气泡改到下方，避免超出视口
// ============================================================
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

/** 提示实现方式：native = 原生 title（旧）/ custom = 自建气泡（新） */
type TipMode = 'native' | 'custom'

/** 触发来源：用来区分鼠标悬停与键盘聚焦 */
type TipSource = '—' | '鼠标' | '键盘'

/** 鼠标悬停多久后出现（毫秒）：原生 title 这个值不可控，这里是写死的配置 */
const SHOW_DELAY = 180

/** 自建气泡的正文：顺便解释为什么不用原生 title */
const TIP_TEXT =
  '原生 title 的延迟、换行和样式都由浏览器决定；自建气泡可以自己控制延迟、位置与配色。'

/** 原生 title 的文案：短一些，避免浏览器提示条过长 */
const NATIVE_HINT = '原生 title：延迟与样式由浏览器决定'

const mode = ref<TipMode>('native')
/** 气泡是否显示：原生模式下页面读不到它的状态 */
const shown = ref(false)
/** 最近一次触发来源 */
const source = ref<TipSource>('—')
/** 是否在等延迟结束：定时器在跑时显示「等待中」 */
const pending = ref(false)
/** 本次从触发到显示的实际用时（运行时量出来，不是写死的文案） */
const elapsedText = ref('—')
/** 触摸指针被跳过的次数：手指没有悬停，不该弹气泡 */
const touchSkipped = ref(0)

/** 系统当前是否真的开启了减少动态效果：只用来提示，不夺走演示 */
const systemReduce = ref(false)
/**
 * 是否模拟「系统开启了减少动态效果」
 * 为什么不让系统设置直接决定演示行为：本案例要展示气泡的淡入与位移，
 * 系统关掉动画后看起来和「直接出现」一模一样，案例就失去意义了
 */
const mockReduce = ref(false)

/** 系统「减少动态效果」的媒体查询对象（卸载时移除监听） */
let motionQuery: MediaQueryList | null = null

/** 延迟计时器编号 */
let showTimer = 0
/** 开始计时的时刻：用于算「本次出现用时」 */
let armedAt = 0
/** 指针是否停在触发器上（悬停与聚焦可能同时成立） */
let hovered = false
/** 触发器是否持有键盘焦点 */
let focused = false

/** 当前状态文案：三种模式分开说，避免把原生提示的状态混进来 */
const stateText = computed(() => {
  if (mode.value === 'native') return '由浏览器绘制（页面读不到）'
  if (shown.value) return '气泡显示中'
  if (pending.value) return '等待延迟结束'
  return '未显示'
})

/** 定时器状态文案 */
const timerText = computed(() => {
  if (mode.value === 'native') return '不适用'
  if (pending.value) return '等待中'
  return '—'
})

/** 清掉延迟计时器，并把等待状态复位 */
function clearShowTimer(): void {
  if (showTimer) window.clearTimeout(showTimer)
  showTimer = 0
  pending.value = false
}

/** 真正显示气泡：先算用时，再改状态 */
function showNow(from: Exclude<TipSource, '—'>): void {
  //! 用时用 performance.now() 量：延迟是配置值，实际晚了多少要现场看
  const elapsed = armedAt > 0 ? Math.round(performance.now() - armedAt) : 0
  armedAt = 0
  shown.value = true
  source.value = from
  elapsedText.value = `${elapsed}ms`
}

/**
 * 安排一次显示
 * @param from 鼠标 = 延迟后出现；键盘 = 立即出现（焦点反馈不该等）
 */
function scheduleShow(from: '鼠标' | '键盘'): void {
  clearShowTimer()

  // 原生模式不接管任何显示逻辑，交给浏览器
  if (mode.value !== 'custom') return

  source.value = from

  if (from === '键盘') {
    armedAt = 0
    //! 键盘聚焦立即出现：Tab 到按钮时马上要有反馈
    showNow('键盘')
    return
  }

  armedAt = performance.now()
  pending.value = true
  //! 延迟出现：指针只是路过时不弹，减少打扰
  showTimer = window.setTimeout(() => {
    showTimer = 0
    pending.value = false
    showNow('鼠标')
  }, SHOW_DELAY)
}

/** 隐藏气泡：指针移出或失焦后立即消失，不保留「渐隐期」 */
function hideTip(): void {
  clearShowTimer()
  armedAt = 0
  shown.value = false
}

// ---------- 指针与键盘 ----------

/** 指针进入触发器：只认鼠标，触摸与手写笔没有悬停概念 */
function onPointerEnter(event: PointerEvent): void {
  if (mode.value !== 'custom') return

  if (event.pointerType !== 'mouse') {
    touchSkipped.value++
    return
  }

  hovered = true
  scheduleShow('鼠标')
}

/** 指针离开触发器：立刻收起；如果键盘焦点还在这里，就继续显示 */
function onPointerLeave(): void {
  if (mode.value !== 'custom') return
  hovered = false
  if (focused) return
  hideTip()
}

/** 键盘聚焦：focusin 在捕获阶段也会冒泡到按钮，这里直接绑在按钮上 */
function onFocusIn(): void {
  if (mode.value !== 'custom') return
  focused = true
  scheduleShow('键盘')
}

/** 失焦：与指针离开一致立即收起；指针还停在按钮上时保持显示 */
function onFocusOut(): void {
  if (mode.value !== 'custom') return
  focused = false
  if (hovered) return
  hideTip()
}

// ---------- 模式切换与重置 ----------

/** 切换实现方式（n-radio-group 发出的是原始值，收窄后再用）：先把上一种模式的计时器与显示状态清干净 */
function setMode(next: string | number | boolean | undefined): void {
  if (next !== 'native' && next !== 'custom') return
  if (mode.value === next) return
  clearShowTimer()
  shown.value = false
  armedAt = 0
  hovered = false
  focused = false
  elapsedText.value = '—'
  source.value = '—'
  mode.value = next
}

/** 重置：回到原生模式，所有计数清零 */
function resetAll(): void {
  clearShowTimer()
  mode.value = 'native'
  shown.value = false
  source.value = '—'
  elapsedText.value = '—'
  touchSkipped.value = 0
  armedAt = 0
  hovered = false
  focused = false
}

/** 切换「模拟减少动态效果」：先清掉延迟计时器与读数，再从同一起点观察 */
function toggleMockReduce(): void {
  clearShowTimer()
  shown.value = false
  armedAt = 0
  elapsedText.value = '—'
  source.value = '—'
  touchSkipped.value = 0
  mockReduce.value = !mockReduce.value
}

/** 系统「减少动态效果」变化：只更新提示，演示行为仍由手动开关决定 */
function onMotionChange(event: MediaQueryListEvent): void {
  systemReduce.value = event.matches
}

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  systemReduce.value = motionQuery.matches
  motionQuery.addEventListener('change', onMotionChange)
})

onUnmounted(() => {
  //! 延迟计时器必须清：组件卸载后回调仍会改已经销毁的状态
  clearShowTimer()
  armedAt = 0
  //! 媒体查询监听同样要移除，避免回调去改已经销毁的状态
  motionQuery?.removeEventListener('change', onMotionChange)
  motionQuery = null
})
</script>

<template>
  <div class="tip-demo">
    <div class="bar">
      <!-- 互斥模式组：Naive 单选按钮组自带选中态与键盘操作 -->
      <n-radio-group
        class="modes"
        :value="mode"
        aria-label="提示实现方式"
        @update:value="setMode"
      >
        <n-radio-button value="native">
          原生 title（旧）
        </n-radio-button>
        <n-radio-button value="custom">
          自建气泡（推荐）
        </n-radio-button>
      </n-radio-group>
      <n-button
        :type="mockReduce ? 'warning' : 'default'"
        :ghost="mockReduce"
        :aria-pressed="mockReduce"
        @click="toggleMockReduce"
      >
        {{ mockReduce ? '模拟中：已降级' : '模拟减少动态效果' }}
      </n-button>
      <n-button @click="resetAll">
        重置
      </n-button>
    </div>

    <p
      v-if="systemReduce"
      class="system-note"
      role="status"
    >
      系统当前开启了「减少动态效果」。真实项目应当据此降级；本案例为了让动效看得见，仍然播放，点开关可查看降级行为。
    </p>

    <div
      class="stats"
      aria-live="polite"
    >
      <span>状态 <b>{{ stateText }}</b></span>
      <span>配置延迟 <b>{{ mode === 'custom' ? `${SHOW_DELAY}ms` : '浏览器决定' }}</b></span>
      <span>本次用时 <b>{{ elapsedText }}</b></span>
      <span>触发来源 <b>{{ source }}</b></span>
      <span>延迟计时器 <b>{{ timerText }}</b></span>
      <span>触摸跳过 <b>{{ touchSkipped }}</b> 次</span>
      <span>动画 <b>{{ mockReduce ? '跳过' : '播放' }}</b></span>
    </div>

    <!--
      演示区显式允许溢出：气泡定位在触发器上方，
      父容器一旦写 overflow: hidden 就会被裁掉。
    -->
    <div class="stage">
      <div class="tip-wrap">
        <button
          class="tip-trigger"
          type="button"
          :title="mode === 'native' ? NATIVE_HINT : undefined"
          :aria-describedby="mode === 'custom' ? 'tip-bubble' : undefined"
          @pointerenter="onPointerEnter"
          @pointerleave="onPointerLeave"
          @focusin="onFocusIn"
          @focusout="onFocusOut"
        >
          把鼠标移上来，或用 Tab 聚焦
        </button>

        <!-- 自建气泡：用样式控制显隐，保留 aria-hidden 让读屏与视觉状态一致 -->
        <div
          v-if="mode === 'custom'"
          id="tip-bubble"
          class="tip-bubble"
          :class="{ show: shown, 'no-motion': mockReduce }"
          role="tooltip"
          :aria-hidden="!shown"
        >
          {{ TIP_TEXT }}
          <span
            class="tip-arrow"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>

    <p class="hint">
      原生 title：鼠标停多久才出现由浏览器决定，样式与换行改不了，触摸设备基本看不到。
      切到自建气泡后，鼠标停留 {{ SHOW_DELAY }}ms 才出现、移出立即消失，键盘聚焦马上出现；
      面板会显示实际用时与触发来源。窄屏下气泡自动改到按钮下方，不会顶出视口。
      点「模拟减少动态效果」可查看降级行为：气泡直接出现，延迟时机仍然保留。
    </p>
  </div>
</template>

<style scoped>
.tip-demo {
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
}

/* 系统设置提示：只有检测到「减少动态效果」时才出现 */
.system-note {
  margin: 0;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--warning);
  border-left-width: 3px;
  border-radius: var(--demo-radius);
  background-color: var(--code-bg);
  font-size: var(--demo-text-sm);
  line-height: 1.65;
  color: var(--text);
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

/* ---------- 演示区 ---------- */

.stage {
  display: flex;
  align-items: center;
  justify-content: center;
  /* 上下留出气泡的高度：上方居中的气泡不会压到统计条 */
  min-height: 15rem;
  /*! 气泡要能越过演示区上边界，这里绝不能写 overflow: hidden */
  overflow: visible;
  padding: 6rem 1rem;
  border: 1px dashed var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--code-bg);
}

.tip-wrap {
  position: relative;
  display: inline-flex;
  max-width: 100%;
}

.tip-trigger {
  padding: calc(var(--demo-control-py) + 0.2rem)
    calc(var(--demo-control-px) + 0.55rem);
  border: none;
  border-radius: var(--radius-btn);
  background-color: var(--primary);
  color: #fff;
  font-size: var(--demo-text-md);
  font-weight: 600;
  cursor: pointer;
  box-shadow: var(--shadow-soft);
  transition: background-color var(--transition);

  &:hover {
    background-color: var(--primary-hover);
  }
}

/* ---------- 气泡 ---------- */

.tip-bubble {
  position: absolute;
  bottom: calc(100% + 12px);
  left: 50%;
  z-index: 2;
  width: max-content;
  max-width: min(18rem, 78vw);
  padding: 0.55rem 0.7rem;
  border-radius: var(--demo-radius);
  background-color: var(--text);
  color: var(--surface);
  font-size: var(--demo-text-sm);
  line-height: 1.65;
  text-align: left;
  box-shadow: var(--shadow-soft-lg);
  /* 隐藏时不占位、不挡点击；显隐用透明度过渡，读屏状态由 aria-hidden 同步 */
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translate(-50%, 4px);
  transition: opacity var(--transition), transform var(--transition),
    visibility var(--transition);

  &.show {
    opacity: 1;
    visibility: visible;
    transform: translate(-50%, 0);
  }
}

/* 模拟降级：系统关掉动画时气泡直接出现，不做淡入与位移 */
.tip-bubble.no-motion {
  transition: none;
}

.tip-arrow {
  position: absolute;
  bottom: -4px;
  left: 50%;
  width: 8px;
  height: 8px;
  background-color: inherit;
  transform: translateX(-50%) rotate(45deg);
}

.hint {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}

/* 窄屏：气泡改到按钮下方，避免顶部超出视口 */
@media (max-width: 480px) {
  .tip-bubble {
    top: calc(100% + 12px);
    bottom: auto;
    transform: translate(-50%, -4px);

    &.show {
      transform: translate(-50%, 0);
    }
  }

  .tip-arrow {
    top: -4px;
    bottom: auto;
  }
}

@media (max-width: 520px) {
  .modes {
    flex: 1 1 100%;
  }

  .mode {
    flex: 1;
  }

  .stage {
    /* 窄屏气泡在按钮下方，下方留够空间，上方只留一点 */
    min-height: 13rem;
    padding: 2rem 0.8rem 6.2rem;
  }

  .hint {
    font-size: var(--demo-text-xs);
  }
}

/*! 演示优先：系统开启「减少动态效果」时，站点全局规则会把过渡压到 0.01ms，
    而本案例正是要展示气泡的淡入与位移，所以这里把时长还原。
    真实项目不要照抄这一段，应当像「模拟减少动态效果」打开时那样直接出现。 */
@media (prefers-reduced-motion: reduce) {
  .tip-bubble {
    transition-duration: var(--transition) !important;
  }

  /* 降级状态的优先级更高：开关打开时不做淡入位移 */
  .tip-bubble.no-motion {
    transition: none !important;
  }
}
</style>
