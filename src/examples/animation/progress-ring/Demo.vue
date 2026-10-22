// ============================================================
// 案例：SVG 进度环（progress-ring）
// - 旧做法：每 16ms 用定时器改一次 stroke-dashoffset，自己补中间帧
// - 新做法：只写一次目标值，让 CSS 过渡补齐中间帧
// - 周长 = 2 × π × 半径，dasharray 写周长，dashoffset 表达剩余比例
// - 减少动态效果：过渡关闭，数值直接跳到目标
// ============================================================
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

/** 驱动方式：timer = 定时器逐帧改属性（旧）/ transition = 只改一次目标值（新） */
type RingMode = 'timer' | 'transition'

/** 圆环半径（与模板里的 r 保持一致） */
const RADIUS = 52
/** 圆周长：dasharray 的完整长度，也是计算偏移量的基准 */
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const mode = ref<RingMode>('timer')
/** 当前显示的进度（0~100） */
const progress = ref(0)
/** 目标进度：滑杆与快捷按钮改的是它 */
const target = ref(0)
/** 属性写入次数：两种驱动方式最直接的成本差 */
const writes = ref(0)
/** 旧做法的定时器是否在跑 */
const ticking = ref(false)
/** 重置时临时关闭过渡，让数值直接跳变 */
const instant = ref(false)
/** 系统是否开启减少动态效果 */
const reducedMotion = ref(false)

/** 逐帧定时器编号 */
let stepTimer = 0
/** 恢复过渡的短计时器（重置时用） */
let instantTimer = 0
/** 动态效果偏好的媒体查询对象 */
let motionQuery: MediaQueryList | null = null

/** 当前偏移量：进度 0 时等于周长（整圈留空），进度 100 时为 0（整圈填满） */
const dashOffset = computed(() => CIRCUMFERENCE * (1 - progress.value / 100))

/** 直接交给行内样式的两条属性：数值保留两位小数，避免过长的小数串 */
const ringStyle = computed(() => ({
  strokeDasharray: CIRCUMFERENCE.toFixed(2),
  strokeDashoffset: dashOffset.value.toFixed(2),
}))

// ---------- 定时器管理 ----------

/** 停掉旧做法的逐帧定时器（切模式、重置、卸载都要调用） */
function stopTimer(): void {
  if (stepTimer) window.clearInterval(stepTimer)
  stepTimer = 0
  ticking.value = false
}

// ---------- 驱动进度 ----------

/** 设置目标进度：按当前模式决定「逐帧写」还是「只写一次」 */
function setProgressTarget(next: number): void {
  const clamped = Math.min(100, Math.max(0, Math.round(next)))
  target.value = clamped
  stopTimer()

  if (clamped === progress.value) return

  //! 减少动态效果：不做过渡也不逐帧，直接跳到目标值
  if (reducedMotion.value) {
    progress.value = clamped
    writes.value++
    return
  }

  if (mode.value === 'transition') {
    //! 只写一次目标值：中间帧由样式过渡补齐，脚本不再参与
    progress.value = clamped
    writes.value++
    return
  }

  //! 旧做法：每个周期改一次属性值，写入次数与走过的百分点同量级
  ticking.value = true
  stepTimer = window.setInterval(() => {
    const diff = clamped - progress.value
    if (diff === 0) {
      stopTimer()
      return
    }
    progress.value += diff > 0 ? 1 : -1
    writes.value++
  }, 16)
}

/** 开始：走到 100% */
function startRing(): void {
  setProgressTarget(100)
}

/** 重置：立即回到 0，并把写入计数清零（对比两种方式前先点它） */
function resetRing(): void {
  stopTimer()
  window.clearTimeout(instantTimer)

  // 先关掉过渡再改数值：两条样式在同一帧生效，不会出现回卷动画
  instant.value = true
  progress.value = 0
  target.value = 0
  writes.value = 0

  instantTimer = window.setTimeout(() => {
    instant.value = false
    instantTimer = 0
  }, 60)
}

/** 滑杆输入：把读数交给统一的设置入口 */
function onSliderInput(event: Event): void {
  const input = event.target as HTMLInputElement
  setProgressTarget(Number(input.value))
}

/** 切换驱动方式：停掉定时器，把目标对齐当前进度，计数清零便于对比 */
function setMode(next: RingMode): void {
  if (mode.value === next) return
  stopTimer()
  mode.value = next
  target.value = progress.value
  writes.value = 0
}

/** 系统动态效果偏好变化时同步状态 */
function onMotionChange(event: MediaQueryListEvent): void {
  reducedMotion.value = event.matches
}

// ---------- 生命周期 ----------

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotion.value = motionQuery.matches
  motionQuery.addEventListener('change', onMotionChange)
})

onUnmounted(() => {
  stopTimer()
  window.clearTimeout(instantTimer)
  motionQuery?.removeEventListener('change', onMotionChange)
  motionQuery = null
})
</script>

<template>
  <div class="pr-demo">
    <div class="bar">
      <div
        class="modes"
        role="group"
        aria-label="进度驱动方式"
      >
        <button
          class="mode"
          :class="{ active: mode === 'timer' }"
          :aria-pressed="mode === 'timer'"
          @click="setMode('timer')"
        >
          定时器逐帧（旧）
        </button>
        <button
          class="mode"
          :class="{ active: mode === 'transition' }"
          :aria-pressed="mode === 'transition'"
          @click="setMode('transition')"
        >
          样式过渡（推荐）
        </button>
      </div>
      <button
        class="btn"
        @click="startRing"
      >
        开始
      </button>
      <button
        class="btn ghost"
        @click="resetRing"
      >
        重置
      </button>
    </div>

    <div class="stage">
      <div class="ring-wrap">
        <svg
          class="ring"
          viewBox="0 0 120 120"
          role="progressbar"
          aria-label="进度环"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="Math.round(progress)"
        >
          <circle
            class="track"
            cx="60"
            cy="60"
            :r="RADIUS"
          />
          <circle
            class="value"
            :class="{ tween: mode === 'transition' && !instant }"
            cx="60"
            cy="60"
            :r="RADIUS"
            :style="ringStyle"
          />
        </svg>
        <div class="ring-label">
          {{ Math.round(progress) }}<small>%</small>
        </div>
      </div>

      <div class="side">
        <div class="stats">
          <span>属性写入次数 <b>{{ writes }}</b></span>
          <span>定时器 <b>{{ ticking ? '运行中' : '无' }}</b></span>
          <span>驱动方式 <b>{{ mode === 'timer' ? '定时器逐个百分点写' : '只写一次目标值' }}</b></span>
        </div>

        <label class="slider">
          <span>目标进度 <b>{{ target }}%</b></span>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            :value="target"
            aria-label="目标进度"
            @input="onSliderInput"
          >
        </label>

        <div
          class="presets"
          role="group"
          aria-label="快捷进度"
        >
          <button
            v-for="value in [25, 60, 100]"
            :key="value"
            class="chip"
            @click="setProgressTarget(value)"
          >
            {{ value }}%
          </button>
        </div>
      </div>
    </div>

    <p class="hint">
      先点「重置」，保持「定时器逐帧（旧）」点「开始」：写入次数随着进度一路涨，中间帧全靠脚本一次一次改属性。
      切到「样式过渡（推荐）」再重置、再开始：脚本只写一次目标值，圆环由样式过渡补齐；中心数字会先到目标值，圆环随后追上。
      系统开启「减少动态效果」时不做过渡，直接跳到目标值。
    </p>
  </div>
</template>

<style scoped>
.pr-demo {
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

.btn {
  padding: var(--demo-control-py) var(--demo-control-px);
  border: 1px solid var(--primary);
  border-radius: var(--radius-btn);
  background-color: transparent;
  color: var(--primary);
  font-size: var(--demo-text-md);
  cursor: pointer;
  transition: background-color var(--transition), color var(--transition);

  &:hover {
    background-color: var(--primary);
    color: #fff;
  }
}

.btn.ghost {
  border-color: var(--border);
  color: var(--text-secondary);

  &:hover {
    background-color: var(--code-bg);
    color: var(--text);
  }
}

.stage {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  align-items: center;
  gap: 0.9rem;
  padding: 0.8rem;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--surface);
}

/* ---------- 圆环 ---------- */

.ring-wrap {
  position: relative;
  width: 190px;
  max-width: 100%;
  aspect-ratio: 1;
  margin: 0 auto;
}

/* 整个画布转 -90 度：圆的起点从三点钟方向挪到十二点钟方向 */
.ring {
  display: block;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.track {
  fill: none;
  stroke: color-mix(in srgb, var(--border) 75%, transparent);
  stroke-width: 10;
}

.value {
  fill: none;
  stroke: var(--primary);
  stroke-width: 10;
  stroke-linecap: round;
}

/* 只有过渡模式才声明过渡：逐帧模式每 16ms 改一次，不需要也不能有过渡 */
.value.tween {
  transition: stroke-dashoffset 0.8s var(--ease-out);
}

.ring-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 1.75rem;
  color: var(--text);
  pointer-events: none;

  small {
    margin-left: 0.1rem;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }
}

/* ---------- 右侧控制区 ---------- */

.side {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-width: 0;
}

.stats {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
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

.slider {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--text);
  }

  input {
    width: 100%;
    accent-color: var(--primary);
    cursor: pointer;
  }
}

.presets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.chip {
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background-color: transparent;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: var(--demo-text-sm);
  cursor: pointer;
  transition: border-color var(--transition), color var(--transition);

  &:hover {
    border-color: var(--primary);
    color: var(--primary);
  }
}

.hint {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}

/* 减少动态效果：不做过渡，直接跳变（脚本也会跳过逐帧） */
@media (prefers-reduced-motion: reduce) {
  .value.tween {
    transition: none;
  }
}

@media (max-width: 520px) {
  .stage {
    grid-template-columns: 1fr;
  }

  .ring-wrap {
    width: 170px;
  }

  .modes {
    flex: 1 1 100%;
  }

  .mode {
    flex: 1;
  }
}
</style>
