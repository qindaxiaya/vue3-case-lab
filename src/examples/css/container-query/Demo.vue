// ============================================================
// 案例：容器查询 @container（container-query）
// - 同一张卡片放进 4 个不同摆位：宽容器 / 窄容器 / 并排两列（可拖分隔条）
// - 旧做法：媒体查询跟视口走，卡片摆错了位置布局就跟着错
// - 新做法：容器查询跟容器宽度走，同一份样式适配全部摆位
// - ResizeObserver 读各容器宽度，读计算样式核对「期望排向 vs 实际排向」
// - 容器宽度变化只靠真实拖拽 / 窗口缩放，不做假按钮
// ============================================================
<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
import type { ComponentPublicInstance } from 'vue'

/** 对比方案：media = 媒体查询（跟视口） / cq = 容器查询（跟容器） */
type PackMode = 'media' | 'cq'

/** 四个摆位的 key：宽容器 / 窄容器 / 并排左列 / 并排右列 */
type SlotKey = 'wide' | 'narrow' | 'duoA' | 'duoB'

/** 卡片排向：row 横排 / column 纵排 */
type Dir = 'row' | 'column'

/** 容器断点：宽度达到 520px 时卡片由纵排切横排 */
const CQ_BREAK = 520

// ---------- 四个摆位的状态（宽度 + 实际排向） ----------

const widths = reactive<Record<SlotKey, number>>({ wide: 0, narrow: 0, duoA: 0, duoB: 0 })
const dirs = reactive<Record<SlotKey, Dir>>({ wide: 'column', narrow: 'column', duoA: 'column', duoB: 'column' })

const mode = ref<PackMode>('cq')

/** 并排两列的分隔位置（0.25~0.75），拖动中间把手改变 */
const splitPct = ref(0.5)

/** 各摆位挂载后的元素引用（观察容器 / 读卡片排向都要用）
 *  用普通对象而不是 reactive：DOM 节点被响应式代理包一层后，
 *  读计算样式会拿到不稳定结果；这里只在 JS 里用，模板不需要它 */
const hostEls: Partial<Record<SlotKey, HTMLElement>> = {}

/**
 * 函数 ref：登记摆位容器，卸载时移除
 * 模板里的 ref 回调可能是元素，也可能（理论上）是组件实例，这里只收真实元素
 */
function setHostRef(el: Element | ComponentPublicInstance | null, key: SlotKey): void {
  if (el instanceof HTMLElement) hostEls[key] = el
  else delete hostEls[key]
}

/** 该摆位「按容器宽度应该是什么排向」 */
function expectedDir(key: SlotKey): Dir {
  return widths[key] >= CQ_BREAK ? 'row' : 'column'
}

/** 实际读到的排向 → 中文标签 */
function dirLabel(key: SlotKey): string {
  return dirs[key] === 'row' ? '横排' : '纵排'
}

/** 期望与实际是否一致（✓ / ✗，由实时读数算出，不是写死的结论） */
function fitMark(key: SlotKey): string {
  return dirs[key] === expectedDir(key) ? '✓ 已适配' : '✗ 未适配'
}

/** 适配场景数：4 个摆位里实际排向与期望一致的个数 */
const fitCount = computed(() =>
  (['wide', 'narrow', 'duoA', 'duoB'] as SlotKey[]).filter((k) => dirs[k] === expectedDir(k)).length,
)

/** 视口宽度（媒体查询的判定依据，窗口缩放时更新） */
const viewportW = ref(0)
function syncViewport(): void {
  viewportW.value = window.innerWidth
}

// ---------- 读实际排向：一切以计算样式为准 ----------

/** 读某摆位卡片的真实 flex-direction（computed 样式包含容器查询运算结果） */
function readDir(key: SlotKey): Dir | null {
  const card = hostEls[key]?.querySelector('.cq-card')
  if (!card) return null
  return getComputedStyle(card).flexDirection === 'row' ? 'row' : 'column'
}

/** 读四个摆位的实际排向（必须先结算布局，容器查询结果才在计算样式里） */
function measureDirs(): void {
  for (const key of ['wide', 'narrow', 'duoA', 'duoB'] as SlotKey[]) {
    const host = hostEls[key]
    if (!host) continue
    // 读一次 offsetWidth 强制布局：容器查询的规则这时才算真正结算完
    void host.offsetWidth
    const dir = readDir(key)
    if (dir) dirs[key] = dir
  }
}

/**
 * 统一复查四个摆位
 * - 页面可见时双 raf 足够
 * - 标签页在后台时 raf 会被浏览器节流甚至暂停，补一个定时器兜底，
 *   否则面板可能一直停在「未适配」，用户切回来还以为功能坏了
 */
function scheduleRemasure(): void {
  void nextTick(() => {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        measureDirs()
      }),
    )
    window.setTimeout(measureDirs, 120)
  })
}

// ---------- ResizeObserver：四个容器各自上报宽度 ----------

let ro: ResizeObserver | null = null

function setupObserver(): void {
  ro?.disconnect()
  ro = new ResizeObserver(() => {
    // 回调触发说明有容器宽度真的变了：先回填宽度，再延迟复查排向
    syncSlots()
    scheduleRemasure()
  })
  for (const el of Object.values(hostEls)) ro?.observe(el)
}

/** 从节点读回四个摆位的当前宽度 */
function syncSlots(): void {
  for (const key of ['wide', 'narrow', 'duoA', 'duoB'] as SlotKey[]) {
    const el = hostEls[key]
    if (el) widths[key] = Math.round(el.getBoundingClientRect().width)
  }
}

// ---------- 并排分隔条拖拽（真实改布局，不是假按钮） ----------

const duoRef = ref<HTMLElement | null>(null)
let dragStartX = 0
let dragStartPct = 0.5

function onHandleDown(event: PointerEvent): void {
  if (!duoRef.value) return
  dragStartX = event.clientX
  dragStartPct = splitPct.value
  // currentTarget 在事件回调里一定是绑定元素，但类型上是 EventTarget | null，收窄后再用
  const handle = event.currentTarget
  if (handle instanceof HTMLElement) handle.setPointerCapture(event.pointerId)
}

function onHandleMove(event: PointerEvent): void {
  if (event.buttons !== 1 || !duoRef.value) return
  // 增量换算成百分比；钳制在 22%~78%，保留两侧最小可读宽度
  const total = duoRef.value.clientWidth || 1
  const next = dragStartPct + (event.clientX - dragStartX) / total
  splitPct.value = Math.max(0.22, Math.min(next, 0.78))
}

// ---------- 方案切换与重置 ----------

function setMode(next: PackMode): void {
  if (mode.value === next) return
  mode.value = next
  scheduleRemasure()
}

/** 重置：分隔条回到中间，复查一遍排向 */
function resetAll(): void {
  splitPct.value = 0.5
  scheduleRemasure()
}

// ---------- 生命周期 ----------

function onWindowResize(): void {
  syncViewport()
  scheduleRemasure()
}

onMounted(async () => {
  syncViewport()
  syncSlots()
  setupObserver()
  window.addEventListener('resize', onWindowResize, { passive: true })
  // 等两帧再首测：给函数 ref 与首轮容器查询结算留出时间
  await nextTick()
  scheduleRemasure()
  // 首屏样式/字体可能比首测更晚结算（开发环境样式异步注入），
  // 补一次延迟复查，避免面板一直显示「未适配」直到用户点按钮
  window.setTimeout(() => scheduleRemasure(), 150)
  void document.fonts?.ready.then(() => scheduleRemasure())
})

onUnmounted(() => {
  ro?.disconnect()
  ro = null
  window.removeEventListener('resize', onWindowResize)
})

/** 卡片文案（四个摆位共用同一份数据，「同一张卡片」的卖点就在这） */
const CARD = {
  title: '早春旅行指南',
  desc: '一张卡片放进不同宽度的容器：宽处横排省高度，窄处纵排保可读。',
}
</script>

<template>
  <div
    class="cq-demo"
    :class="mode === 'cq' ? 'mode-cq' : 'mode-media'"
  >
    <div class="bar">
      <div
        class="modes"
        role="group"
        aria-label="适配方案"
      >
        <button
          class="mode"
          :class="{ active: mode === 'media' }"
          :aria-pressed="mode === 'media'"
          @click="setMode('media')"
        >
          媒体查询（跟视口）
        </button>
        <button
          class="mode"
          :class="{ active: mode === 'cq' }"
          :aria-pressed="mode === 'cq'"
          @click="setMode('cq')"
        >
          容器查询（推荐）
        </button>
      </div>
      <button
        class="btn ghost"
        @click="resetAll"
      >
        重置
      </button>
    </div>

    <div class="stats">
      <span>适配场景 <b>{{ fitCount }}</b> / 4</span>
      <span>视口宽度 <b>{{ viewportW }}</b> px</span>
      <span>媒体断点 <b>1</b> 条（只跟视口）</span>
      <span>容器断点 <b>1</b> 条（覆盖全部摆位）</span>
    </div>

    <!-- 摆位一：宽容器（整行） -->
    <section
      :ref="(el) => setHostRef(el, 'wide')"
      class="host"
    >
      <header class="host-head">
        宽容器 <b>{{ widths.wide }}</b> px · 期望<b>横排</b> ·
        <span :class="dirs.wide === expectedDir('wide') ? 'ok' : 'bad'">{{ fitMark('wide') }}（实际{{ dirLabel('wide') }}）</span>
      </header>
      <article class="cq-card">
        <div
          class="thumb"
          aria-hidden="true"
        >
          缩略图
        </div>
        <div class="card-text">
          <h3>{{ CARD.title }}</h3>
          <p>{{ CARD.desc }}</p>
        </div>
      </article>
    </section>

    <!-- 摆位二：窄容器（固定窄宽度） -->
    <section
      :ref="(el) => setHostRef(el, 'narrow')"
      class="host host-narrow"
    >
      <header class="host-head">
        窄容器 <b>{{ widths.narrow }}</b> px · 期望<b>纵排</b> ·
        <span :class="dirs.narrow === expectedDir('narrow') ? 'ok' : 'bad'">{{ fitMark('narrow') }}（实际{{ dirLabel('narrow') }}）</span>
      </header>
      <article class="cq-card">
        <div
          class="thumb"
          aria-hidden="true"
        >
          缩略图
        </div>
        <div class="card-text">
          <h3>{{ CARD.title }}</h3>
          <p>{{ CARD.desc }}</p>
        </div>
      </article>
    </section>

    <!-- 摆位三 / 四：并排两列，中间分隔条可拖 -->
    <section
      ref="duoRef"
      class="duo"
    >
      <div
        class="duo-col"
        :style="{ width: `calc((100% - 0.4rem) * ${splitPct})` }"
      >
        <section
          :ref="(el) => setHostRef(el, 'duoA')"
          class="host"
        >
          <header class="host-head">
            并排·左 <b>{{ widths.duoA }}</b> px ·
            <span :class="dirs.duoA === expectedDir('duoA') ? 'ok' : 'bad'">{{ fitMark('duoA') }}（实际{{ dirLabel('duoA') }}）</span>
          </header>
          <article class="cq-card">
            <div
              class="thumb"
              aria-hidden="true"
            >
              缩略图
            </div>
            <div class="card-text">
              <h3>{{ CARD.title }}</h3>
              <p>{{ CARD.desc }}</p>
            </div>
          </article>
        </section>
      </div>

      <div
        class="duo-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="左右拖动调整两列占比"
        @pointerdown="onHandleDown"
        @pointermove="onHandleMove"
      />

      <div class="duo-col">
        <section
          :ref="(el) => setHostRef(el, 'duoB')"
          class="host"
        >
          <header class="host-head">
            并排·右 <b>{{ widths.duoB }}</b> px ·
            <span :class="dirs.duoB === expectedDir('duoB') ? 'ok' : 'bad'">{{ fitMark('duoB') }}（实际{{ dirLabel('duoB') }}）</span>
          </header>
          <article class="cq-card">
            <div
              class="thumb"
              aria-hidden="true"
            >
              缩略图
            </div>
            <div class="card-text">
              <h3>{{ CARD.title }}</h3>
              <p>{{ CARD.desc }}</p>
            </div>
          </article>
        </section>
      </div>
    </section>

    <p class="hint">
      同一份卡片样式放进四个摆位。容器查询版只要一条「不低于 520px 横排」的规则，
      每个容器各自判定；媒体查询版只跟视口走——桌面视口里窄容器也硬塞横排，摆错位置就失效。
    </p>
  </div>
</template>

<style scoped>
.cq-demo {
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
  background-color: var(--bg-subtle);
}

.mode {
  padding: 0.4rem 0.65rem;
  border: none;
  border-radius: calc(var(--demo-radius) - 2px);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: var(--demo-text-sm);
  cursor: pointer;
  transition: background-color 0.2s var(--ease-out), color 0.2s var(--ease-out);

  &.active {
    background-color: var(--surface);
    color: var(--primary);
    box-shadow: var(--shadow-soft);
  }
}

.btn {
  padding: var(--demo-control-py) var(--demo-control-px);
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: var(--demo-text-md);
  cursor: pointer;

  &:hover {
    background-color: var(--code-bg);
    color: var(--text);
  }
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

/* ---------- 摆位容器：每个都注册为自己的查询容器 ---------- */

.host {
  /* 关键准备：容器类型 inline-size，让它成为 @container 的判定对象 */
  container-type: inline-size;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg);
  padding: 0.55rem;
  min-width: 0;
}

.host-narrow {
  width: 250px;
  max-width: 100%;
}

.host-head {
  display: flex;
  flex-wrap: wrap;
  gap: 0.15rem 0.4rem;
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
  margin-bottom: 0.45rem;

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

.ok {
  color: var(--success);
}

.bad {
  color: var(--danger);
}

/* ---------- 卡片：默认纵排（窄容器基线） ---------- */

.cq-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.thumb {
  width: 100%;
  height: 64px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: var(--radius-sm);
  background-color: color-mix(in srgb, var(--primary) 16%, var(--bg-subtle));
  color: var(--primary);
  font-size: var(--demo-text-xs);
}

.card-text {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;

  h3 {
    margin: 0;
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

/* ---------- 容器查询版：一条规则适配所有摆位 ---------- */

/* 为什么这样写：@container 按「最近祖先容器」各自求值，
   宽容器 / 窄容器 / 两列各自独立过判定，同一份规则零复制 */
@container (min-width: 520px) {
  .mode-cq .cq-card {
    flex-direction: row;
    align-items: center;
  }

  .mode-cq .cq-card .thumb {
    width: 96px;
  }
}

/* ---------- 媒体查询版：只跟视口走（对照组，故意保留旧写法） ---------- */

@media (min-width: 900px) {
  .mode-media .cq-card {
    flex-direction: row;
    align-items: center;
  }

  .mode-media .cq-card .thumb {
    width: 96px;
  }
}

/* ---------- 并排两列 + 中央分隔条 ---------- */

.duo {
  display: flex;
  align-items: stretch;
  gap: 0.4rem;
  min-width: 0;
}

.duo-col {
  min-width: 0;
}

.duo-col:last-child {
  flex: 1;
  min-width: 0;
}

.duo-handle {
  width: 10px;
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
