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
/** 可拖宽的宿主框：宽度绑在它身上，同时它就是 cqi 的查询容器 */
const frameRef = ref<HTMLDivElement | null>(null)
const titleRef = ref<HTMLHeadingElement | null>(null)
/** 宿主框宽度（px），挂载时按可用宽度初始化 */
const previewWidth = ref(320)
/** 把手宽度：舞台右侧留出同样的内边距，把手贴框走时正好落脚在这条缝里 */
const HANDLE_WIDTH = 14
let dragStartX = 0
let dragStartWidth = 0
/** 用户是否亲手调过宽度：没调过就一直跟随「铺满舞台」 */
let userSized = false

/** 宿主框行内样式：宽度由拖拽控制（maxWidth 兜住窄屏） */
const frameStyle = computed(() => ({
  width: `${previewWidth.value}px`,
  maxWidth: '100%',
}))

/**
 * 可拖宽的上限 = 舞台内容宽度（减去给把手预留的 14px）
 * 为什么不用 clientWidth 原值：它含右内边距，会让状态比实际渲染宽 14px，
 * 拖回来时先有一小段「拖了没反应」的死区
 * 布局还没就绪（clientWidth 为 0）时返回 null：此刻的宽度不能拿来改状态
 */
function stageMaxWidth(): number | null {
  const stage = stageRef.value
  if (!stage || stage.clientWidth <= 0) return null
  return Math.max(220, stage.clientWidth - HANDLE_WIDTH)
}

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
  const el = frameRef.value
  if (!el) return
  ro = new ResizeObserver(() => {
    // 容器宽度真变了才回调：此刻布局已结算，读取字号最可靠
    width.value = Math.round(el.getBoundingClientRect().width)
    fontSize.value = measureFontSize()

    const max = stageMaxWidth()
    // 舞台还没量出宽度（演示区刚挂载 / 页面切换中）：不能拿这个数改状态，
    // 否则会把「还没布局」的 0 当成用户宽度存下来，框再也回不去
    if (max === null) return
    if (!userSized) previewWidth.value = max
    // 用户亲手调过宽：只在窗口变窄、可用宽度不够时收回，不主动撑回去
    else if (previewWidth.value > max) previewWidth.value = max
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
  const next = dragStartWidth + (event.clientX - dragStartX)
  const max = stageMaxWidth() ?? previewWidth.value
  previewWidth.value = Math.max(220, Math.min(next, max))
  userSized = true
}

/**
 * 键盘调宽：role=separator 的焦点元素本来就该能用方向键操作
 * Shift 加大步长；Home / End 到两端
 */
function onHandleKey(event: KeyboardEvent): void {
  const max = stageMaxWidth() ?? previewWidth.value
  const step = event.shiftKey ? 64 : 16
  let next: number
  if (event.key === 'ArrowLeft') next = previewWidth.value - step
  else if (event.key === 'ArrowRight') next = previewWidth.value + step
  else if (event.key === 'Home') next = 220
  else if (event.key === 'End') next = max
  else return

  previewWidth.value = Math.max(220, Math.min(next, max))
  userSized = true
  // 拦掉方向键的默认滚动，调宽时页面不该跟着上下跑
  event.preventDefault()
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
  // 回到「铺满舞台」：重新跟随可用宽度，窗口变过也能回到当前能到的最宽
  userSized = false
  previewWidth.value = stageMaxWidth() ?? 320
}

// ---------- 生命周期 ----------

onMounted(() => {
  // 舞台此刻可能还没量出宽度（演示区刚挂载）：先留 320，RO 回调补正
  previewWidth.value = stageMaxWidth() ?? 320
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
      <!-- 可拖宽宿主框：宽度绑在它身上，同时由它承担容器查询（cqi 的参照物） -->
      <div
        ref="frameRef"
        class="frame"
        :style="[
          frameStyle,
          mode === 'breakpoint' ? { fontSize: `${bpFontSize}px` } : {},
        ]"
      >
        <div
          class="preview"
          :class="mode === 'clamp' ? 'preview--clamp' : ''"
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
        <!-- 把手挂在宿主框里：框缩到哪，把手就跟到哪 -->
        <div
          class="handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="左右拖动调整容器宽度，也可用方向键"
          tabindex="0"
          @pointerdown="onHandleDown"
          @pointermove="onHandleMove"
          @keydown="onHandleKey"
        />
      </div>
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
  /* 把手宽度（脚本里的 HANDLE_WIDTH 与它同值） */
  --handle-w: 14px;
  /* 右侧留出把手宽度：把手始终贴着自己的框走，不会溢出舞台 */
  padding-right: var(--handle-w);
}

/*
 * 宿主框：宽度由拖拽控制，同时把自己注册成「可按行内尺寸查询」的容器
 * 为什么容器在这一层：元素不能查询自己，8cqi 必须由祖先容器提供参照物，
 * 所以字号（.preview--clamp）写在它的子元素上
 */
.frame {
  position: relative;
  container-type: inline-size;
  /* 断点式按行内字号渲染（style 绑定）；clamp 式由 .preview--clamp 生效 */
  transition: none;
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
  /* 贴着宿主框的右边缘（往右借 14px，正好落在舞台的预留缝里） */
  right: calc(var(--handle-w) * -1);
  width: var(--handle-w);
  height: 100%;
  border-radius: var(--radius-sm);
  background-color: var(--border);
  cursor: ew-resize;
  touch-action: none;

  &:hover,
  &:focus-visible {
    background-color: var(--primary);
  }

  &:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }
}

.hint {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}
</style>
