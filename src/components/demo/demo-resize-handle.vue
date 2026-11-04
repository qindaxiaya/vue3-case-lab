// ============================================================
// 演示区共享：可拖拽把手（demo-resize-handle）
// - width 模式：组件自己就是「被拖宽的框」，默认插槽放内容，把手贴在框右缘外
// - split 模式：组件只是「中间那根分隔条」，拖动改变父容器里的占比（0~1）
// 两种模式共用同一套指针捕获、上下限夹取、键盘操作与 ARIA 语义
// ============================================================
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * 为什么抽成共享组件：
 * 三个 CSS 案例都要「拖一下看布局反应」，但拖动本身是测量装置，不是教学内容
 * （pointer capture 在 drag-sort / slider-captcha / pull-refresh 里专门讲）。
 * 抽出来以后：把手层级、14px 死区、键盘与 ARIA 只需修一次，三处同时生效。
 */
type Mode = 'width' | 'split'

const props = defineProps<{
  /** width：组件自身就是被拖宽的框；split：组件只是中间那根分隔条 */
  mode?: Mode
  /** width 模式为像素宽度；split 模式为 0~1 的占比 */
  modelValue: number
  /** 下限：width 为 px（默认 200），split 为占比（默认 0.22） */
  min?: number
  /** 上限：只对 split 生效（默认 0.78）；width 的上限自动取父容器可用宽度 */
  max?: number
  /** 无障碍名称（读屏播报） */
  label?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
  /** width 模式：框的实测渲染宽度（受 max-width 兜底影响，可能小于 modelValue） */
  resize: [width: number]
}>()

// class / style 等透传属性由模板里的 v-bind="$attrs" 显式落到根节点，
// 关掉自动继承避免挂两次（split 模式还要和 ARIA 属性合并成一个对象）
defineOptions({ inheritAttrs: false })

const mode = computed<Mode>(() => props.mode ?? 'width')
/** 下限：两种模式单位不同，默认值也不同 */
const lower = computed(() => props.min ?? (mode.value === 'split' ? 0.22 : 200))
/** 分栏模式上限；改宽模式的上限是动态的（父容器可用宽度），不从这里取 */
const upper = computed(() => props.max ?? 0.78)

const rootRef = ref<HTMLElement | null>(null)
/** 父容器可用宽度（扣掉左右内边距），改宽模式的上限就是它 */
const maxPx = ref(0)
/** 用户是否亲手调过宽度：没调过就一直跟随「铺满父容器」 */
let userSized = false
let startX = 0
let startValue = 0

/**
 * 读父容器的可用宽度：
 * clientWidth 含左右内边距，减掉后才等于「框最宽能到多少」。
 * 早期版本直接拿 clientWidth 当上限，状态会比实际渲染宽 14px，
 * 拖回来时先有一小段「拖了没反应」的死区。
 */
function parentInnerWidth(): number {
  const el = rootRef.value?.parentElement
  if (!el) return 0
  const style = getComputedStyle(el)
  const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)
  return Math.max(0, el.clientWidth - padding)
}

/** 把目标值夹进合法范围再发出去（改宽取整像素，分栏保留 4 位小数防抖动） */
function commit(next: number): void {
  const isSplit = mode.value === 'split'
  const max = isSplit ? upper.value : maxPx.value || props.modelValue
  const clamped = Math.max(lower.value, Math.min(next, max))
  emit('update:modelValue', isSplit ? Math.round(clamped * 10000) / 10000 : Math.round(clamped))
}

/** 按下：记住起点，并用指针捕获接管后续移动（拖出把手范围也能继续收到事件） */
function onPointerDown(event: PointerEvent): void {
  startX = event.clientX
  startValue = props.modelValue
  const el = event.currentTarget
  if (el instanceof HTMLElement) el.setPointerCapture(event.pointerId)
}

/** 拖动：改宽模式是像素增量，分栏模式先除以父容器宽度换成占比 */
function onPointerMove(event: PointerEvent): void {
  if (event.buttons !== 1) return
  const dx = event.clientX - startX
  userSized = true
  if (mode.value === 'split') commit(startValue + dx / (parentInnerWidth() || 1))
  else commit(startValue + dx)
}

/**
 * 键盘：role="separator" 拿到焦点后本来就该能用方向键调
 * 改宽：±16px（Shift ±64px）；分栏：±2%（Shift ±10%）；Home / End 到两端
 */
function onKeydown(event: KeyboardEvent): void {
  const isSplit = mode.value === 'split'
  const step = isSplit ? (event.shiftKey ? 0.1 : 0.02) : event.shiftKey ? 64 : 16
  let next: number | null = null
  if (event.key === 'ArrowLeft') next = props.modelValue - step
  else if (event.key === 'ArrowRight') next = props.modelValue + step
  else if (event.key === 'Home') next = lower.value
  else if (event.key === 'End') next = isSplit ? upper.value : maxPx.value
  if (next === null) return

  // 拦掉方向键的默认滚动：调宽时页面不该跟着上下跑
  event.preventDefault()
  userSized = true
  commit(next)
}

let ro: ResizeObserver | null = null

/** 同步上限，返回当前可用宽度（0 表示布局还没就绪） */
function syncMax(): number {
  const max = parentInnerWidth()
  if (max > 0) maxPx.value = max
  return max
}

function onObserved(): void {
  const max = syncMax()
  // 父容器还没量出宽度（演示区刚挂载 / 页面切换中）：这一帧的数都不能用。
  // 既不回填实测宽度（会记出「容器 26px」这种假跳变），也不拿它改状态
  // （否则会把「还没布局」的 0 当成用户宽度存下来，框再也回不去）
  if (max <= 0 || mode.value !== 'width') return

  // 挂载后第一次回调：宽度还是案例给的占位值 → 先铺满，这次测量不回填。
  // 否则案例的统计里会凭空多出一次「占位宽度 → 铺满」的假变化
  if (!userSized && props.modelValue !== max) {
    commit(max)
    return
  }

  const el = rootRef.value
  if (el) {
    // 实测渲染宽度交给案例（统计面板、字号测量都用它）
    const measured = Math.round(el.getBoundingClientRect().width)
    if (measured > 0) emit('resize', measured)
  }

  // 用户亲手调过宽：窗口变窄时把状态收回到可用范围
  if (userSized && props.modelValue > max) commit(max)
}

onMounted(() => {
  const box = rootRef.value
  const parent = box?.parentElement
  if (!box || !parent) return
  // 同时观察「自己」和「父容器」：自己变了要上报实测宽度，父容器变了要补正上限
  ro = new ResizeObserver(onObserved)
  ro.observe(box)
  ro.observe(parent)
  onObserved()
})

onBeforeUnmount(() => {
  ro?.disconnect()
  ro = null
})

/** width 模式：回到「铺满父容器」（案例的重置按钮用） */
function reset(): void {
  userSized = false
  const max = syncMax()
  if (max > 0) commit(max)
}

// 把手自己声明 ARIA 与事件，两种模式共用一份（split 模式挂在根节点上）
// 显式标成 Record<string, unknown>：aria-orientation 是联合字面量，直接推断会过窄
const barBindings = computed<Record<string, unknown>>(() => {
  const isSplit = mode.value === 'split'
  return {
    role: 'separator',
    'aria-orientation': 'vertical',
    'aria-label': props.label ?? (isSplit ? '左右拖动调整两列占比' : '左右拖动调整宽度'),
    tabindex: 0,
    // 改宽模式报像素，分栏模式报百分比（0~100，符合 ARIA 的数值语义）
    'aria-valuenow': isSplit ? Math.round(props.modelValue * 100) : Math.round(props.modelValue),
    'aria-valuemin': isSplit ? Math.round(lower.value * 100) : Math.round(lower.value),
    'aria-valuemax': isSplit ? Math.round(upper.value * 100) : Math.round(maxPx.value),
    onPointerdown: onPointerDown,
    onPointermove: onPointerMove,
    onKeydown: onKeydown,
  }
})

defineExpose({
  /** 根节点（案例读列数、量宽度时用） */
  boxEl: rootRef,
  reset,
})
</script>

<template>
  <!-- 改宽模式：组件就是那个「被拖宽的框」，插槽放内容，把手贴在右缘外 14px -->
  <div
    v-if="mode === 'width'"
    ref="rootRef"
    class="resize-box"
    :style="{ width: `${modelValue}px`, maxWidth: '100%' }"
    v-bind="$attrs"
  >
    <slot />
    <div
      class="resize-bar"
      v-bind="barBindings"
    />
  </div>

  <!-- 分栏模式：组件只是中间那根条，自己是父级 flex 里的一项 -->
  <div
    v-else
    ref="rootRef"
    class="resize-bar resize-bar--split"
    v-bind="{ ...$attrs, ...barBindings }"
  />
</template>

<style scoped lang="scss">
/* 改宽模式的框：宽度由脚本绑行内样式，这里只负责「装得下把手」 */
.resize-box {
  position: relative;
}

/*
 * 把手：绝对定位在框右缘之外（父容器留出同样的内边距接住，不会撑出横向滚动）
 * 外观都能被案例覆盖：--rh-width / --rh-bg / --rh-bg-active
 */
.resize-bar {
  position: absolute;
  top: 0;
  right: calc(var(--rh-width, 14px) * -1);
  width: var(--rh-width, 14px);
  height: 100%;
  border-radius: var(--radius-sm);
  background-color: var(--rh-bg, var(--border));
  cursor: ew-resize;
  touch-action: none;

  &:hover,
  &:focus-visible {
    background-color: var(--rh-bg-active, var(--primary));
  }

  &:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }
}

/* 分栏模式：不再绝对定位，改成父级 flex 里的一根竖条 */
.resize-bar--split {
  position: static;
  right: auto;
  width: var(--rh-width, 10px);
  height: auto;
  align-self: stretch;
}
</style>
