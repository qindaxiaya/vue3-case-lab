// ============================================================
// 案例：grid auto-fit 自适应卡片网格
// - 同一批卡片放进一个可拖宽的容器，两种布局方案现场对比
// - 旧做法：flex + 手写断点表（模拟媒体查询效果，列数离散跳变）
// - 新做法：grid repeat(auto-fit, minmax(160px, 1fr))，零断点
// - ResizeObserver 实时读取容器宽度与列数，统计列数变化次数
// ============================================================
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

/** 布局方案：media = flex + 手写断点表 / autofit = grid auto-fit */
type LayoutMode = 'media' | 'autofit'

interface DemoCard {
  id: number
  title: string
  desc: string
}

/** 8 张演示卡片（固定数据，方便复现） */
const CARDS: DemoCard[] = Array.from({ length: 8 }, (_, i) => ({
  id: i,
  title: `卡片 ${i + 1}`,
  desc: i % 2 === 0 ? '自适应列宽的最小保障是 160px' : '容器变化时布局实时重排',
}))

// ---------- 手写断点表（模拟媒体查询的行为） ----------
// 真实媒体查询只能跟视口走；这里用同一张断点表对容器宽度求值，
// 演示手写方案的通病：每个断点都要人肉维护，漏一条就出错。
interface BreakRule {
  min: number
  cols: number
}

const MEDIA_BREAKS: BreakRule[] = [
  { min: 720, cols: 5 },
  { min: 600, cols: 4 },
  { min: 480, cols: 3 },
  { min: 360, cols: 2 },
  { min: 0, cols: 1 },
]

/** 静态统计：手写方案的媒体查询条数；auto-fit 方案为 0 条 */
const MEDIA_QUERIES = MEDIA_BREAKS.length

/** 按断点表算列数（media 模式的列数来源，与手写 CSS 等价） */
function colsForMedia(width: number): number {
  for (const rule of MEDIA_BREAKS) {
    if (width >= rule.min) return rule.cols
  }
  return 1
}

// ---------- 当前方案与指标状态 ----------

const mode = ref<LayoutMode>('autofit')
/** 容器宽度（拖拽把手实时改变） */
const width = ref(0)
/** 当前列数（media 用断点表求值 / autofit 读计算样式数段） */
const cols = ref(1)
/** 断点跳变次数：本次重置以来列数发生变化的累计次数 */
const jumps = ref(0)

interface ColLog {
  id: number
  text: string
}

/** 列数变化流水（最新在前，最多留 6 条） */
const colLogs = ref<ColLog[]>([])
let logSeq = 0
/** 上一次的列数（-1 表示尚未记录，首轮回调不计数） */
let lastCols = -1

// ---------- 可拖宽容器 ----------

const panelRef = ref<HTMLElement | null>(null)
const stageRef = ref<HTMLElement | null>(null)
/** 面板宽度（px），挂载时按可用宽度初始化 */
const panelWidth = ref(320)
/** 拖拽时记住的起始指针横坐标 */
let dragStartX = 0
/** 拖拽时记住的起始面板宽度 */
let dragStartWidth = 0
/** 默认宽度（重置时恢复） */
let defaultWidth = 320

/** 面板行内样式：宽度由拖拽控制，且不允许超出外层容器 */
const panelStyle = computed(() => ({
  width: `${panelWidth.value}px`,
  maxWidth: '100%',
}))

/** media 模式下单张卡片的 flex-basis：按列数减去间隙均分（8px = gap 0.5rem） */
const cardStyle = computed(() => ({
  flex: `0 0 calc((100% - ${(cols.value - 1) * 8}px) / ${cols.value})`,
}))

// ---------- ResizeObserver：宽度 + 列数 + 跳变统计 ----------

let ro: ResizeObserver | null = null

/** 读当前列数：autofit 读真实网格，media 用断点表（等价于手写查询的求值结果） */
function measureCols(): number {
  if (mode.value === 'media') return colsForMedia(panelWidth.value)
  const el = panelRef.value
  if (!el) return 1
  // 计算样式里的 gridTemplateColumns 是空格分隔的轨道列表，分段即列数
  const tracks = getComputedStyle(el).gridTemplateColumns.trim()
  return tracks ? tracks.split(/\s+/).length : 1
}

/** 记录一次列数变化（最新在前，保留 6 条） */
function pushLog(text: string): void {
  colLogs.value.unshift({ id: logSeq++, text })
  if (colLogs.value.length > 6) colLogs.value.pop()
}

function setupObserver(): void {
  ro?.disconnect()
  const el = panelRef.value
  if (!el) return
  ro = new ResizeObserver(() => {
    // 面板宽度是拖拽直改的行内样式，读回边框盒宽度保证与显示一致
    width.value = Math.round(el.getBoundingClientRect().width)
    const next = measureCols()
    // lastCols = -1 是首轮回调，只建立基线不记跳变
    if (lastCols >= 0 && next !== lastCols) {
      jumps.value++
      pushLog(`列数 ${lastCols} → ${next}（容器 ${width.value}px）`)
    }
    lastCols = next
    cols.value = next
  })
  ro.observe(el)
}

// ---------- 拖拽调宽（真实 resize，不是按钮假动作） ----------

/** 把手按下：记录起点并用指针捕获接管后续移动 */
function onHandleDown(event: PointerEvent): void {
  if (!stageRef.value) return
  dragStartX = event.clientX
  dragStartWidth = panelWidth.value
  // currentTarget 类型是 EventTarget | null，收窄成元素后才能调用指针捕获
  const handle = event.currentTarget
  if (handle instanceof HTMLElement) handle.setPointerCapture(event.pointerId)
}

/** 拖拽中：按横坐标增量改宽度，钳制在 200px ~ 外层可用宽度内 */
function onHandleMove(event: PointerEvent): void {
  if (event.buttons !== 1) return
  const max = stageRef.value?.clientWidth ?? panelWidth.value
  const next = dragStartWidth + (event.clientX - dragStartX)
  panelWidth.value = Math.max(200, Math.min(next, max))
}

// ---------- 方案切换与重置 ----------

/** 切换方案（n-radio-group 发出的是原始值，收窄后再用）：清空统计与流水，让两种方案在同等起点重新计数 */
function setMode(next: string | number | boolean | undefined): void {
  if (next !== 'media' && next !== 'autofit') return
  if (mode.value === next) return
  mode.value = next
  resetStats()
}

function resetStats(): void {
  jumps.value = 0
  colLogs.value = []
  // 下一轮 ResizeObserver 回调重建基线， restoration 不计入跳变
  lastCols = -1
  cols.value = measureCols()
}

/** 重置：恢复默认宽度并清空统计（宽度变化会触发 RO 自动回填指标） */
function resetAll(): void {
  panelWidth.value = defaultWidth
  resetStats()
}

// ---------- 生命周期 ----------

onMounted(() => {
  const stage = stageRef.value
  if (stage && stage.clientWidth > 0) {
    defaultWidth = stage.clientWidth
    panelWidth.value = defaultWidth
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
    class="grid-demo"
    :class="`mode-${mode}`"
  >
    <div class="bar">
      <!-- 互斥模式组：直接用 Naive 的单选按钮组，自带键盘与选中语义 -->
      <n-radio-group
        class="modes"
        :value="mode"
        aria-label="布局方案"
        @update:value="setMode"
      >
        <n-radio-button value="media">
          flex + 手写断点（旧）
        </n-radio-button>
        <n-radio-button value="autofit">
          auto-fit（推荐）
        </n-radio-button>
      </n-radio-group>
      <n-button @click="resetAll">
        重置
      </n-button>
    </div>

    <div class="stats">
      <span>容器宽度 <b>{{ width }}</b> px</span>
      <span>当前列数 <b>{{ cols }}</b> 列</span>
      <span>媒体查询条数 <b>{{ mode === 'media' ? MEDIA_QUERIES : 0 }}</b> 条</span>
      <span>断点跳变次数 <b>{{ jumps }}</b> 次</span>
    </div>

    <div
      ref="stageRef"
      class="stage"
    >
      <!-- 可拖宽容器：auto-fit 模式用纯 CSS 网格；media 模式用 flex + 行内分配 -->
      <div
        ref="panelRef"
        class="panel"
        :class="mode === 'autofit' ? 'panel--auto' : 'panel--media'"
        :style="panelStyle"
      >
        <article
          v-for="card in CARDS"
          :key="card.id"
          class="card"
          :style="mode === 'media' ? cardStyle : undefined"
        >
          <span class="index">{{ card.id + 1 }}</span>
          <h3>{{ card.title }}</h3>
          <p>{{ card.desc }}</p>
        </article>
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

    <div class="log-panel">
      <p class="log-title">
        列数变化流水
      </p>
      <p
        v-if="colLogs.length === 0"
        class="log-empty"
      >
        拖动右侧把手改变宽度，列数变化会按次记录
      </p>
      <ul
        v-else
        class="log-list"
      >
        <li
          v-for="item in colLogs"
          :key="item.id"
          class="log-item"
        >
          {{ item.text }}
        </li>
      </ul>
    </div>

    <p class="hint">
      auto-fit 模式没有一条断点：引擎按「最小 160px」自动增减列。手写断点版的每次列数变化，
      对应断点表里的一条规则——条数越多，要验证的屏宽组合越多。
    </p>
  </div>
</template>

<style scoped>
.grid-demo {
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

.panel {
  border: 1px dashed var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg);
  padding: 0.6rem;
  min-height: 180px;
}

/* auto-fit：一行声明代替整张断点表，零媒体查询 */
.panel--auto {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.5rem;
}

/* media 模拟：flex 换行 + 行内按列数分配间距 */
.panel--media {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.card {
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background-color: var(--surface);
  padding: 0.45rem 0.6rem;

  h3 {
    margin: 0.15rem 0 0.1rem;
    font-size: var(--demo-text-md);
    color: var(--text);
  }

  p {
    margin: 0;
    font-size: var(--demo-text-xs);
    line-height: 1.5;
    color: var(--text-secondary);
    overflow-wrap: anywhere;
  }
}

.index {
  display: inline-grid;
  place-items: center;
  min-width: 1.35rem;
  height: 1.35rem;
  padding: 0 0.2rem;
  border-radius: 50%;
  background-color: var(--primary-soft);
  color: var(--primary);
  font-family: var(--font-mono);
  font-size: var(--demo-text-xs);
}

/* 右缘拖拽把手：触屏抬到 40px 高度，保证可点 */
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

/* ---------- 变化流水 ---------- */

.log-panel {
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  padding: 0.6rem 0.8rem;
  background-color: var(--code-bg);
}

.log-title {
  margin: 0 0 0.35rem;
  font-size: var(--demo-text-sm);
  font-weight: 600;
  color: var(--text-secondary);
}

.log-empty {
  margin: 0;
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);
}

.log-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.log-item {
  font-family: var(--font-mono);
  font-size: var(--demo-text-xs);
  padding: 0.2rem 0.4rem;
  border-radius: var(--radius-sm);
  background-color: color-mix(in srgb, var(--primary) 10%, transparent);
  color: var(--text);
}

.hint {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}
</style>
