// ============================================================
// 案例：clamp 流体字号（fluid-clamp）
// - 标题与正文放进一个可拖宽的预览容器（container-type: inline-size）
// - 旧做法：断点表控制字号，跨档瞬间跳变
// - 新做法：clamp(1rem, 8cqi, 2.5rem)，字号随容器宽度连续渐变
// - getComputedStyle 实时读渲染字号（px），不靠样式声明想当然
// ============================================================
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

/** 字号策略：breakpoint = 断点表硬档位 / clamp = 流体连续缩放 */
type FontMode = 'breakpoint' | 'clamp'

// ---------- 断点表（模拟媒体查询对预览容器求值） ----------

interface FontRule {
  min: number
  px: number
}

const BREAKS: FontRule[] = [
  { min: 760, px: 40 },
  { min: 620, px: 34 },
  { min: 480, px: 28 },
  { min: 360, px: 23 },
  { min: 0, px: 16 },
]

/** 静态统计：断点方案需要维护的断点条数；clamp 为 0 条 */
const BREAK_COUNT = BREAKS.length

/** 按断点表求字号（与手写媒体查询的求值结果一致） */
function fontSizeForBreak(width: number): number {
  for (const rule of BREAKS) {
    if (width >= rule.min) return rule.px
  }
  return 16
}

// ---------- 当前策略与指标 ----------

const mode = ref<FontMode>('clamp')
/** 预览容器宽度（拖拽把手实时改变） */
const width = ref(0)
/** 标题当前渲染字号（px），一律来自计算样式实测 */
const fontSize = ref(16)

/** 断点模式下通过输向根节点的行内字号（模拟断点规则的应用结果） */
const bpFontSize = computed(() => fontSizeForBreak(width.value))

// ---------- 可拖宽预览容器 ----------

const stageRef = ref<HTMLElement | null>(null)
const previewRef = ref<HTMLDivElement | null>(null)
const titleRef = ref<HTMLHeadingElement | null>(null)
/** 预览宽度（px），挂载时按可用宽度初始化 */
const previewWidth = ref(320)
let dragStartX = 0
let dragStartWidth = 0
/** 默认宽度（重置时恢复） */
let defaultWidth = 320

/** 容器行内样式：宽度由拖拽控制 */
const previewStyle = computed(() => ({
  width: `${previewWidth.value}px`,
  maxWidth: '100%',
}))

// ---------- 字号实测：读计算样式 ----------

/** 从标题节点读出当前真正渲染的字号（px） */
function measureFontSize(): number {
  const el = titleRef.value
  if (!el) return 16
  return parseFloat(getComputedStyle(el).fontSize) || 16
}

let ro: ResizeObserver | null = null

function setupObserver(): void {
  ro?.disconnect()
  const el = previewRef.value
  if (!el) return
  ro = new ResizeObserver(() => {
    // 容器宽度真变了才回调：此刻布局已结算，读取字号最可靠
    width.value = Math.round(el.getBoundingClientRect().width)
    fontSize.value = measureFontSize()
  })
  ro.observe(el)
}

// ---------- 拖拽调宽（真实 resize；拖浏览器窗口同样生效） ----------

function onHandleDown(event: PointerEvent): void {
  if (!stageRef.value) return
  dragStartX = event.clientX
  dragStartWidth = previewWidth.value
  // currentTarget 类型是 EventTarget | null，收窄成元素后才能调用指针捕获
  const handle = event.currentTarget
  if (handle instanceof HTMLElement) handle.setPointerCapture(event.pointerId)
}

function onHandleMove(event: PointerEvent): void {
  if (event.buttons !== 1) return
  const max = stageRef.value?.clientWidth ?? previewWidth.value
  const next = dragStartWidth + (event.clientX - dragStartX)
  previewWidth.value = Math.max(220, Math.min(next, max))
}

// ---------- 策略切换与重置 ----------

/** 切换策略（n-radio-group 发出的是原始值，收窄后再用） */
function setMode(next: string | number | boolean | undefined): void {
  if (next !== 'breakpoint' && next !== 'clamp') return
  if (mode.value === next) return
  mode.value = next
  // 切换不改变容器宽度，RO 不回调：主动等两帧后重读渲染字号
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      fontSize.value = measureFontSize()
    }),
  )
}

function resetAll(): void {
  previewWidth.value = defaultWidth
}

// ---------- 生命周期 ----------

onMounted(() => {
  const stage = stageRef.value
  if (stage && stage.clientWidth > 0) {
    defaultWidth = stage.clientWidth
    previewWidth.value = defaultWidth
  }
  setupObserver()
})

onUnmounted(() => {
  ro?.disconnect()
  ro = null
})
</script>

<template>
  <div
    class="fluid-demo"
    :class="`mode-${mode}`"
  >
    <div class="bar">
      <!-- 互斥模式组：Naive 单选按钮组自带选中态与键盘操作 -->
      <n-radio-group
        class="modes"
        :value="mode"
        aria-label="字号策略"
        @update:value="setMode"
      >
        <n-radio-button value="breakpoint">
          断点式（旧）
        </n-radio-button>
        <n-radio-button value="clamp">
          clamp（推荐）
        </n-radio-button>
      </n-radio-group>
      <n-button @click="resetAll">
        重置
      </n-button>
    </div>

    <div class="stats">
      <span>容器宽度 <b>{{ width }}</b> px</span>
      <span>标题字号（实测）<b>{{ fontSize.toFixed(1) }}</b> px</span>
      <span>断点条数 <b>{{ mode === 'breakpoint' ? BREAK_COUNT : 0 }}</b> 条</span>
    </div>

    <div
      ref="stageRef"
      class="stage"
    >
      <div
        ref="previewRef"
        class="preview"
        :class="mode === 'clamp' ? 'preview--clamp' : ''"
        :style="[
          previewStyle,
          mode === 'breakpoint' ? { fontSize: `${bpFontSize}px` } : {},
        ]"
      >
        <h3
          ref="titleRef"
          class="hero"
        >
          流体排版 Fluid Type
        </h3>
        <p class="hero-body">
          松弛的字号会随容器宽度连续呼吸：宽容器展大气，窄容器保可读，
          中间没有一档一档的硬台阶。
        </p>
      </div>
      <div
        class="handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="左右拖动调整容器宽度"
        @pointerdown="onHandleDown"
        @pointermove="onHandleMove"
      />
    </div>

    <p class="hint">
      clamp(下限 1rem，相对值 8cqi，上限 2.5rem)：只要容器在宽窄之间滑动，
      标题就在 16px 与 40px 之间连续渐变，永远不需要「跨档跳一下」。
    </p>
  </div>
</template>

<style scoped>
.fluid-demo {
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

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.1rem;
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

/* ---------- 可拖宽舞台 ---------- */

.stage {
  position: relative;
  padding-right: 14px;
}

.preview {
  border: 1px dashed var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg);
  padding: 0.8rem 0.9rem;
  min-height: 150px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.5rem;

  /* 断点式按行内字号渲染（style 绑定）；clamp 式用下面这条声明 */
  transition: none;
}

/* clamp：下限 1rem(16px)，相对值取容器宽的 8%，上限 2.5rem(40px) */
.preview--clamp {
  font-size: clamp(1rem, 8cqi, 2.5rem);
}

.hero {
  margin: 0;
  /* 标题直接用容器根字号；其计算值即实测读数 */
  font-size: 1em;
  font-weight: 700;
  line-height: 1.25;
  color: var(--text);
  overflow-wrap: anywhere;
}

.hero-body {
  margin: 0;
  font-size: 0.55em;
  line-height: 1.6;
  color: var(--text-secondary);
  overflow-wrap: anywhere;
}

.handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 14px;
  height: 100%;
  border-radius: var(--radius-sm);
  background-color: var(--border);
  cursor: ew-resize;
  touch-action: none;

  &:hover {
    background-color: var(--primary);
  }
}

.hint {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}
</style>
