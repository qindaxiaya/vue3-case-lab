// ============================================================
// 案例：防抖节流波形对比（debounce-throttle）
// - 用 VueUse 现成 API：useDebounceFn / useThrottleFn（真实项目直接用，不手写闭包）
// - 输入框打字：debounce 500ms——停手 500ms 后才触发「搜索」
// - 滚动容器：throttle 100ms——高频滚动中每 100ms 最多放行一次
// - 脉冲条可视化：灰条=原始事件，彩条=实际执行——频率差异一目了然
// ============================================================
<script setup lang="ts">
import { useDebounceFn, useThrottleFn } from '@vueuse/core'
import { onUnmounted, ref } from 'vue'

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

function pushPulse(kind: Pulse['kind'], label: string): void {
  // 只留最近 36 条，形成滚动波形
  pulses.value.push({ id: pulseId++, kind, label })
  if (pulses.value.length > 36) pulses.value.shift()
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
  debouncedSearch.cancel()
  throttledScroll.cancel()
}

// ---------- 卸载清理：cancel 计时器（组合式封装时放 onUnmounted） ----------
onUnmounted(() => {
  debouncedSearch.cancel()
  throttledScroll.cancel()
})
</script>

<template>
  <div class="dt-demo">
    <!-- 脉冲波形条 -->
    <div class="wave">
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
        <input
          v-model="keyword"
          class="input"
          placeholder="快速连续打字试试…"
          @input="onInput"
        >
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
  font-size: 0.75rem;
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
  border-radius: var(--radius-btn);
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
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text);
  }
}

.ratio {
  font-size: 0.72rem;
  font-family: var(--font-mono);
  color: var(--primary);
}

.input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.45rem 0.7rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background-color: var(--bg);
  color: var(--text);
  font-size: 0.82rem;

  &:focus {
    outline: none;
    border-color: var(--primary);
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
  font-size: 0.76rem;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border);
}

.scene-note {
  margin: 0;
  font-size: 0.74rem;
  line-height: 1.6;
  color: var(--text-secondary);

  b {
    color: var(--text);
    font-family: var(--font-mono);
  }
}

.btn-reset {
  align-self: flex-start;
  padding: 0.3rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 0.78rem;
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
