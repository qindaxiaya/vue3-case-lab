// ============================================================
// 案例：防抖节流波形对比（debounce-throttle）
// - 用 VueUse 现成 API：useDebounceFn / useThrottleFn（真实项目直接用，不手写闭包）
// - 输入框打字：debounce 500ms——停手 500ms 后才触发「搜索」
// - 滚动容器：throttle 100ms——高频滚动中每 100ms 最多放行一次
// - 脉冲条可视化：灰条=原始事件，彩条=实际执行——频率差异一目了然
// ============================================================
<script setup lang="ts">
import { useDebounceFn, useThrottleFn } from '@vueuse/core'
import { onMounted, onUnmounted, ref } from 'vue'

// ============================================================
// 可视化数据：脉冲条
// ============================================================

/** 脉冲条目：raw=原始事件 exec=实际执行 */
interface Pulse {
  id: number
  kind: 'raw' | 'exec'
  /** 显示文本（原始/执行计数） */
  label: string
}

let pulseId = 0
const pulses = ref<Pulse[]>([])

// ---------- 波形容量：跟着容器宽度走 ----------

/** 波形容器（用来按实际宽度算能放几根柱子） */
const waveRef = ref<HTMLElement | null>(null)
/** 当前最多能放几根柱子；容器变宽/变窄时重算 */
const maxPulses = ref(36)

/** 单根柱子宽度 + 柱间距（与 scoped 样式里的 .pulse / .wave 保持一致） */
const PULSE_STRIDE = 6 + 3
/** 容器左右内边距 0.6rem×2 + 边框 1px×2 的近似值（像素） */
const WAVE_INSET = 22
/** 兜底最少柱子数：375px 也不至于只剩两三根 */
const MIN_PULSES = 8

/**
 * 按容器宽度重算容量
 * 不这么算的话，柱子数写死成 36 根时，宽屏下只占三分之一宽度，
 * 旧柱子就开始被丢掉——看起来像「没铺满就横向移动」。
 */
function measureWave(): void {
  const el = waveRef.value
  if (!el) return
  const usable = el.clientWidth - WAVE_INSET
  maxPulses.value = Math.max(MIN_PULSES, Math.floor(usable / PULSE_STRIDE))
  // 容器变窄时立刻把多出来的柱子丢掉，避免溢出到不可见区域
  if (pulses.value.length > maxPulses.value) {
    pulses.value = pulses.value.slice(-maxPulses.value)
  }
}

// 容器宽度会随窗口/布局变化（两栏 → 单栏），用 ResizeObserver 跟随
let waveObserver: ResizeObserver | null = null

onMounted(() => {
  measureWave()
  const el = waveRef.value
  if (!el) return
  waveObserver = new ResizeObserver(measureWave)
  waveObserver.observe(el)
})

onUnmounted(() => {
  waveObserver?.disconnect()
  waveObserver = null
})

function pushPulse(kind: Pulse['kind'], label: string): void {
  // 满了才丢最旧的一条：波形先铺满容器，之后才开始横向滚动
  pulses.value.push({ id: pulseId++, kind, label })
  if (pulses.value.length > maxPulses.value) pulses.value.shift()
}

// ============================================================
// 场景一：输入防抖（模拟搜索）
// ============================================================

const keyword = ref('')
/** 原始输入次数 */
const inputRaw = ref(0)
/** 防抖后真正「发起搜索」次数 */
const searchExec = ref(0)
/** 最近一次搜索词 */
const lastSearch = ref('（还没触发过）')

//! VueUse 现成 API：停手 500ms 后执行最后一次（真实项目一行接入）
const debouncedSearch = useDebounceFn((v: string) => {
  searchExec.value++
  lastSearch.value = v || '（空）'
  pushPulse('exec', `搜索:${v.slice(0, 6)}`)
}, 500)

function onInput(): void {
  inputRaw.value++
  pushPulse('raw', '键入')
  debouncedSearch(keyword.value)
}

// ============================================================
// 场景二：滚动节流（模拟埋点上报）
// ============================================================

/** 原始滚动事件次数 */
const scrollRaw = ref(0)
/** 节流后上报次数 */
const scrollExec = ref(0)

//! VueUse 现成 API：100ms 窗口内最多放行一次（滚动埋点/拖拽标配）
const throttledScroll = useThrottleFn(() => {
  scrollExec.value++
  pushPulse('exec', '上报')
}, 100)

function onScroll(): void {
  scrollRaw.value++
  // 原始脉冲太密，每 3 次记一条（可视化降噪，计数仍精确）
  if (scrollRaw.value % 3 === 0) pushPulse('raw', '滚动')
  throttledScroll()
}

/** 重置全部计数 */
function resetAll(): void {
  inputRaw.value = 0
  searchExec.value = 0
  scrollRaw.value = 0
  scrollExec.value = 0
  keyword.value = ''
  lastSearch.value = '（还没触发过）'
  pulses.value = []
}

// ---------- 卸载清理 ----------
// 无需手动 cancel：VueUse 在组件作用域销毁时自动清理内部计时器。
</script>

<template>
  <!-- 演示区共享主题上下文：Naive 控件的浅暗主题与 token 映射从这儿来 -->
  <DemoNaive>
    <div class="dt-demo">
      <!-- 脉冲波形条 -->
      <div
        ref="waveRef"
        class="wave"
      >
        <div
          v-for="p in pulses"
          :key="p.id"
          class="pulse"
          :class="p.kind === 'raw' ? 'pulse--raw' : 'pulse--exec'"
          :title="p.label"
        />
        <p
          v-if="pulses.length === 0"
          class="wave-empty"
        >
          在下方输入或滚动——灰条=原始事件，彩条=实际执行
        </p>
      </div>

      <div class="body">
        <!-- 防抖场景 -->
        <section
          class="scene"
          aria-label="防抖演示"
        >
          <header class="scene-head">
            <h3>防抖 debounce（500ms）</h3>
            <span class="ratio">原始 {{ inputRaw }} → 执行 {{ searchExec }}</span>
          </header>
          <!-- Naive 输入框：v-model:value 与 @update:value 同用（v-model 只管值，事件另走测量） -->
          <n-input
            v-model:value="keyword"
            class="input"
            size="large"
            placeholder="快速连续打字试试…"
            aria-label="防抖搜索输入"
            @update:value="onInput"
          />
          <p class="scene-note">
            最近搜索：<b>{{ lastSearch }}</b>
            ——连续打字只触发最后一次（搜索框/窗口 resize 的标准解法）。
          </p>
        </section>

        <!-- 节流场景 -->
        <section
          class="scene"
          aria-label="节流演示"
        >
          <header class="scene-head">
            <h3>节流 throttle（100ms）</h3>
            <span class="ratio">原始 {{ scrollRaw }} → 执行 {{ scrollExec }}</span>
          </header>
          <div
            class="scroll-box"
            @scroll.passive="onScroll"
          >
            <div
              v-for="i in 60"
              :key="i"
              class="scroll-item"
            >
              滚动行 {{ i }}
            </div>
          </div>
          <p class="scene-note">
            在此区域快速滚动——原始事件每秒数百次，节流后每 100ms 最多一次（滚动埋点/拖拽的标配）。
          </p>
        </section>
      </div>

      <button
        class="btn-reset"
        @click="resetAll"
      >
        重置计数与波形
      </button>
    </div>
  </DemoNaive>
</template>

<style scoped>
.dt-demo {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

/* ---------- 脉冲波形 ---------- */

.wave {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 52px;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--code-bg);
  overflow: hidden;
}

.wave-empty {
  margin: auto;
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.pulse {
  flex-shrink: 0;
  width: 6px;
  border-radius: 2px 2px 0 0;
  animation: pulse-in 0.3s ease-out;
}

.pulse--raw {
  height: 14px;
  background-color: var(--border);
}

.pulse--exec {
  height: 36px;
  background-color: var(--primary);
}

@keyframes pulse-in {
  from {
    transform: scaleY(0);
    transform-origin: bottom;
  }

  to {
    transform: scaleY(1);
  }
}

/* ---------- 两个场景 ---------- */

.body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.scene {
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  padding: 0.75rem;
  background-color: var(--bg);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.scene-head {
  display: flex;
  align-items: center;
  justify-content: space-between;

  h3 {
    margin: 0;
    font-size: var(--demo-text-lg);
    font-weight: 600;
    color: var(--text);
  }
}

.ratio {
  font-size: var(--demo-text-xs);
  font-family: var(--font-mono);
  color: var(--primary);
}

/* Naive 输入框：铺满宽度，内层字号跟随站点 demo token（高度已由组件主题统一成 36px） */
.input {
  width: 100%;

  :deep(.n-input__input-el) {
    font-size: var(--demo-text-md);
  }
}

.scroll-box {
  height: 150px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background-color: var(--bg);
}

.scroll-item {
  padding: 0.4rem 0.7rem;
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border);
}

.scene-note {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.6;
  color: var(--text-secondary);

  b {
    color: var(--text);
    font-family: var(--font-mono);
  }
}

.btn-reset {
  align-self: flex-start;
  padding: var(--demo-control-py) var(--demo-control-px);
  border-radius: var(--demo-radius);
  border: 1px solid var(--border);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: var(--demo-text-md);
  cursor: pointer;

  &:hover {
    color: var(--text);
    border-color: var(--text-secondary);
  }
}

@media (max-width: 768px) {
  .body {
    grid-template-columns: 1fr;
  }
}
</style>
