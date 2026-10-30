// ============================================================
// 案例：骨架屏微光加载（skeleton-shimmer）
// - 旧做法：转圈加载，内容就绪时整块替换，内容区高度跳一下
// - 新做法：按最终排版铺同尺寸灰块，一道渐变高光横扫，内容到位淡出
// - 指标：替换前后内容区高度差超过 2px 记一次布局跳动
// - 减少动态效果：真实项目应降级（高光静止、骨架直接移除）；
//   本案例为了让动效看得见仍然播放，可用开关查看降级行为
// ============================================================
<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

/** 加载态呈现方式：spinner = 转圈（旧）/ skeleton = 骨架屏（新） */
type LoadMode = 'spinner' | 'skeleton'

/** 本轮加载阶段：loading 加载中 / ready 内容就绪（初始就绪，先看到成品） */
type LoadPhase = 'loading' | 'ready'

const mode = ref<LoadMode>('spinner')
const phase = ref<LoadPhase>('ready')

/** 骨架淡出置位：内容已就绪、骨架还在做透明度过渡 */
const skeletonFading = ref(false)

/** 骨架节点是否渲染：加载中一直显示；就绪后只在淡出期间保留 */
const skeletonVisible = computed(
  () => mode.value === 'skeleton' && (phase.value === 'loading' || skeletonFading.value),
)

/** 内容节点是否渲染：就绪即渲染，骨架盖在上面淡出 */
const contentVisible = computed(() => phase.value === 'ready')

// ---------- 指标状态 ----------

/** 替换前后内容区高度（保留 1 位小数，单位 px） */
const beforeHeight = ref(0)
const afterHeight = ref(0)
/** 高度差（保留 1 位小数） */
const heightDelta = ref(0)
/** 布局跳动次数：高度差超过 2px 记 1 次 */
const jumpCount = ref(0)

/**
 * 是否模拟「系统开启了减少动态效果」
 * 为什么不用系统设置直接决定演示行为：本案例要展示的正是高光横扫，
 * 系统关掉动画后骨架屏只剩几块灰条，案例就没有内容可看了
 */
const mockReduce = ref(false)
/** 系统当前是否真的开启了减少动态效果：只用来提示，不夺走演示 */
const systemReduce = ref(false)

const stageRef = ref<HTMLElement | null>(null)

/** 加载计时器：1.2 秒后内容就绪 */
let loadTimer = 0
/** 骨架淡出的兜底计时器（过渡结束事件没送达时也要移除节点） */
let fadeTimer = 0
/** 系统「减少动态效果」的媒体查询对象（只用于提示，卸载时移除监听） */
let motionQuery: MediaQueryList | null = null

// ---------- 测量 ----------

/** 读内容区当前高度：getBoundingClientRect 会强制结算布局，拿到真实渲染高度 */
function measureStage(): number {
  const el = stageRef.value
  if (!el) return 0
  return Math.round(el.getBoundingClientRect().height * 10) / 10
}

/** 清掉所有计时器（重跑、切模式、卸载都要调用） */
function clearTimers(): void {
  window.clearTimeout(loadTimer)
  window.clearTimeout(fadeTimer)
  loadTimer = 0
  fadeTimer = 0
}

/** 把指标清零（不动页面内容） */
function resetMetrics(): void {
  beforeHeight.value = 0
  afterHeight.value = 0
  heightDelta.value = 0
  jumpCount.value = 0
}

// ---------- 一轮加载 ----------

/** 开始一轮 1.2 秒的模拟加载：先量加载态高度，作为替换前的基准 */
async function startLoad(): Promise<void> {
  clearTimers()
  resetMetrics()
  skeletonFading.value = false
  phase.value = 'loading'

  // 等加载态真正挂到页面上，再量「替换前」的高度
  await nextTick()
  beforeHeight.value = measureStage()

  loadTimer = window.setTimeout(() => {
    void finishLoad()
  }, 1200)
}

/** 内容就绪：量替换后的高度，算跳动次数；骨架屏再淡出 */
async function finishLoad(): Promise<void> {
  loadTimer = 0
  // 替换前再量一次，防止计时期间布局有别的变化
  beforeHeight.value = measureStage()

  // 骨架屏模式先标记淡出：节点改成绝对定位盖在内容上，高度由内容接管
  if (mode.value === 'skeleton') skeletonFading.value = true
  phase.value = 'ready'

  await nextTick()
  afterHeight.value = measureStage()

  // 高度差超过 2px 才算一次布局跳动：字体亚像素差异、边框取整不算
  heightDelta.value = Math.round(Math.abs(afterHeight.value - beforeHeight.value) * 10) / 10
  jumpCount.value = heightDelta.value > 2 ? 1 : 0

  if (!skeletonFading.value) return
  // 模拟降级：不做淡出，直接移除骨架节点
  if (mockReduce.value) {
    skeletonFading.value = false
    return
  }
  // 兜底：即使过渡结束事件没来（后台标签页被节流等），也要把节点收掉
  fadeTimer = window.setTimeout(() => {
    skeletonFading.value = false
    fadeTimer = 0
  }, 400)
}

/** 骨架透明度过渡结束：立刻移除节点，并把兜底计时器清掉 */
function onSkeletonFaded(event: TransitionEvent): void {
  if (event.target !== event.currentTarget) return
  if (event.propertyName !== 'opacity') return
  window.clearTimeout(fadeTimer)
  fadeTimer = 0
  skeletonFading.value = false
}

// ---------- 模式切换与重置 ----------

/** 切换加载态样式：立即回到「已就绪」，避免两种模式的残留状态混在一起 */
/** 切换加载态样式（n-radio-group 发出的是原始值，收窄后再用） */
function setMode(next: string | number | boolean | undefined): void {
  if (next !== 'spinner' && next !== 'skeleton') return
  if (mode.value === next) return
  clearTimers()
  mode.value = next
  phase.value = 'ready'
  skeletonFading.value = false
  resetMetrics()
}

/** 重置 / 重跑：清计时器、收起骨架、指标归零 */
function resetAll(): void {
  clearTimers()
  phase.value = 'ready'
  skeletonFading.value = false
  resetMetrics()
}

/**
 * 切换「模拟减少动态效果」：停掉在跑的计时器、收起骨架，计数归零
 * 避免上一轮的淡出兜底计时器在新状态里把节点收掉
 */
function toggleMockReduce(): void {
  clearTimers()
  phase.value = 'ready'
  skeletonFading.value = false
  mockReduce.value = !mockReduce.value
  resetMetrics()
}

/** 系统「减少动态效果」变化：只更新提示，演示行为仍由手动开关决定 */
function onMotionChange(event: MediaQueryListEvent): void {
  systemReduce.value = event.matches
}

// ---------- 生命周期 ----------

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  systemReduce.value = motionQuery.matches
  motionQuery.addEventListener('change', onMotionChange)
})

onUnmounted(() => {
  clearTimers()
  motionQuery?.removeEventListener('change', onMotionChange)
  motionQuery = null
})
</script>

<template>
  <div
    class="sk-demo"
    :class="{ 'is-static': mockReduce }"
  >
    <div class="bar">
      <!-- 互斥模式组：Naive 单选按钮组自带选中态与键盘操作 -->
      <n-radio-group
        class="modes"
        :value="mode"
        aria-label="加载态样式"
        @update:value="setMode"
      >
        <n-radio-button value="spinner">
          转圈（旧）
        </n-radio-button>
        <n-radio-button value="skeleton">
          骨架屏（推荐）
        </n-radio-button>
      </n-radio-group>
      <n-button
        type="primary"
        ghost
        @click="startLoad"
      >
        模拟加载（1.2s）
      </n-button>
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
      系统当前开启了「减少动态效果」。真实项目应当据此降级：高光静止、骨架直接移除；本案例为了让动效看得见，仍然播放，点开关可查看降级行为。
    </p>

    <div
      class="stats"
      aria-live="polite"
    >
      <span>布局跳动次数 <b>{{ jumpCount }}</b> 次</span>
      <span>
        替换前 <b>{{ beforeHeight ? `${beforeHeight}px` : '—' }}</b>
        → 替换后 <b>{{ afterHeight ? `${afterHeight}px` : '—' }}</b>
        （高度差 {{ heightDelta }}px）
      </span>
      <span>骨架高光 <b>{{ mockReduce ? '静止（模拟降级）' : skeletonVisible ? '横扫中' : '待机' }}</b></span>
      <span>动画 <b>{{ mockReduce ? '跳过' : '播放' }}</b></span>
    </div>

    <!-- 内容区：转圈、骨架屏、成品三选一，高度变化都发生在这里 -->
    <div
      ref="stageRef"
      class="stage"
    >
      <article
        v-if="contentVisible"
        class="panel content"
      >
        <div class="head">
          <div class="avatar">
            李
          </div>
          <div class="head-text">
            <p class="title-row">
              周报已生成，请查收
            </p>
            <p class="meta-row">
              产品组 · 2 分钟前
            </p>
          </div>
        </div>
        <div class="body">
          <p class="row">
            本周完成：动画与加载体验优化、搜索正文索引、构建产物分目录。
          </p>
          <p class="row">
            下周计划：补齐案例资料、复核移动端触控尺寸与键盘操作。
          </p>
          <p class="row">
            需要你确认：抽屉退场时机与进度环的驱动方式。
          </p>
        </div>
        <div class="foot">
          <span class="chip">查看详情</span>
          <span class="chip ghost">稍后提醒</span>
        </div>
      </article>

      <!-- 骨架屏：行高、间距、边框与成品完全一致，所以替换时高度不变 -->
      <div
        v-if="skeletonVisible"
        class="panel skeleton"
        :class="{ 'is-overlay': phase === 'ready' }"
        aria-hidden="true"
        @transitionend="onSkeletonFaded"
      >
        <div class="head">
          <div class="avatar sk" />
          <div class="head-text">
            <div class="title-row sk" />
            <div class="meta-row sk" />
          </div>
        </div>
        <div class="body">
          <div class="row sk" />
          <div class="row sk" />
          <div class="row sk" />
        </div>
        <div class="foot">
          <div class="chip sk" />
          <div class="chip ghost sk" />
        </div>
      </div>

      <!-- 转圈：只有很矮的一块，内容到位后整块被替换 -->
      <div
        v-if="phase === 'loading' && mode === 'spinner'"
        class="panel spinner-panel"
        aria-hidden="true"
      >
        <div class="spinner" />
        <p>正在加载内容…</p>
      </div>
    </div>

    <!-- 下方内容：加载态高度一变，它就是被顶来顶去的见证者 -->
    <div class="below">
      <span>下方内容区</span>
      <div class="below-line" />
    </div>

    <p class="hint">
      先保持「转圈」点一次模拟加载：加载态比成品矮一大截，内容到位时整块撑高，布局跳动记 1 次。
      切到「骨架屏」再跑一次：灰块一开始就按成品排版占好位置，替换前后高度一致，记 0 次。
      高度差在 ±2px 以内视为没有跳动；本案例为了让高光看得见，系统开启「减少动态效果」时仍然播放，点开关可以看系统开启减少动态效果时应该怎么降级。
    </p>
  </div>
</template>

<style scoped>
.sk-demo {
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

/* ---------- 内容区与三种状态 ---------- */

.stage {
  position: relative;
}

.panel {
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--surface);
  min-width: 0;
}

/* 头部固定 2.5rem：骨架与成品用同一套盒子，高度从结构上就对齐 */
.head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  height: 2.5rem;
}

.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
  border-radius: 50%;
  background-color: var(--primary-soft);
  color: var(--primary-soft-text);
  font-size: var(--demo-text-md);
}

.head-text {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  flex: 1;
  min-width: 0;
}

.title-row {
  height: 1.1rem;
  margin: 0;
  font-size: var(--demo-text-lg);
  line-height: 1.1rem;
  color: var(--text);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.meta-row {
  height: 0.95rem;
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 0.95rem;
  color: var(--text-secondary);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.body {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: 0.75rem;
}

.row {
  height: 1rem;
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1rem;
  color: var(--text-secondary);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.foot {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 2rem;
  margin-top: 0.75rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  width: 4.5rem;
  height: 1.5rem;
  padding: 0 0.6rem;
  border-radius: 999px;
  background-color: var(--primary-soft);
  color: var(--primary-soft-text);
  font-size: var(--demo-text-xs);
  white-space: nowrap;
}

.chip.ghost {
  width: 4.5rem;
  border: 1px solid var(--border);
  background-color: transparent;
  color: var(--text-secondary);
}

/* ---------- 骨架屏：灰块 + 一道横扫的高光 ---------- */

.sk {
  border-radius: var(--radius-sm);
  background-color: color-mix(in srgb, var(--border) 62%, transparent);
  background-image: linear-gradient(
    100deg,
    transparent 20%,
    color-mix(in srgb, var(--primary) 22%, transparent) 50%,
    transparent 80%
  );
  background-size: 220% 100%;
  background-repeat: no-repeat;
  animation: shimmer 1.15s linear infinite;
}

/* 头像与 chip 保持圆形/胶囊，只换底色与高光 */
.avatar.sk {
  border-radius: 50%;
}

.chip.sk {
  border-radius: 999px;
}

/* 高光从左往右扫：改 background-position 不触发布局，只重绘 */
@keyframes shimmer {
  from {
    background-position: 160% 0;
  }

  to {
    background-position: -60% 0;
  }
}

/* 内容就绪后骨架变成覆盖层：脱离文档流，高度交给成品 */
.skeleton.is-overlay {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.22s var(--ease-out);
}

/* 模拟降级：高光静止、骨架不做淡出（脚本也会直接移除节点）
   用 !important 压住下面「演示优先」的还原规则，保证开关打开时确实没有动画 */
.is-static .sk,
.is-static .spinner {
  animation: none !important;
}

/* 高光渐变也去掉：只剩纯灰块，和真实降级后的样子一致 */
.is-static .sk {
  background-image: none;
}

.is-static .skeleton.is-overlay {
  transition: none !important;
}

/* ---------- 转圈：高度固定且远低于成品 ---------- */

.spinner-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 6rem;

  p {
    margin: 0;
    font-size: var(--demo-text-sm);
    color: var(--text-secondary);
  }
}

.spinner {
  width: 1.75rem;
  height: 1.75rem;
  border: 3px solid color-mix(in srgb, var(--primary) 22%, transparent);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ---------- 下方内容与提示 ---------- */

.below {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0.7rem;
  border: 1px dashed var(--border);
  border-radius: var(--demo-radius);
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);
}

.below-line {
  flex: 1;
  height: 8px;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--warning) 28%, transparent);
}

.hint {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}

@media (max-width: 520px) {
  .bar {
    align-items: stretch;
  }

  .modes {
    flex: 1 1 100%;
  }

  .mode {
    flex: 1;
  }
}
</style>
