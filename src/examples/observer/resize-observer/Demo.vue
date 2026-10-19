// ============================================================
// 案例：ResizeObserver 容器尺寸监听（resize-observer）
// - 拖拽把手改变容器宽高，实时观察 contentBox / borderBox 尺寸
// - box: 'content-box' vs 'border-box' 两种测量模式对比
// - 容器尺寸变化时日志实时打印（含变化 delta）
// - onUnmounted disconnect() 释放观察器
// ============================================================
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

// ---------- 尺寸状态 ----------

/** 容器内容区尺寸（content-box 测量） */
const contentW = ref(0)
const contentH = ref(0)
/** 容器边框盒尺寸（border-box 测量） */
const borderW = ref(0)
const borderH = ref(0)
/** 观察器触发次数 */
const triggerCount = ref(0)

/** 日志（最新在前，最多 5 条） */
const logs = ref<string[]>([])

function log(msg: string): void {
  logs.value.unshift(msg)
  if (logs.value.length > 5) logs.value.pop()
}

// ---------- 观察器 ----------

let observer: ResizeObserver | null = null
/** 被观察容器（模板 ref） */
const box = ref<HTMLElement | null>(null)

/** 上次记录的尺寸（算 delta 用） */
let prevContent = { w: 0, h: 0 }

onMounted(() => {
  // 一个观察器同时拿两种 box 尺寸：entry.contentRect / entry.borderBoxSize
  observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      triggerCount.value++

      // contentRect = 内容区（不含 padding/border）
      contentW.value = Math.round(entry.contentRect.width)
      contentH.value = Math.round(entry.contentRect.height)

      // borderBoxSize = 边框盒（含 padding/border）；旧浏览器降级 content + 估算
      const bb = entry.borderBoxSize?.[0]
      if (bb) {
        borderW.value = Math.round(bb.inlineSize)
        borderH.value = Math.round(bb.blockSize)
      }

      // delta 日志：让用户看见「变化量」而不只是当前值
      const dw = contentW.value - prevContent.w
      const dh = contentH.value - prevContent.h
      if (dw !== 0 || dh !== 0) {
        log(`尺寸变化 Δ${dw >= 0 ? '+' : ''}${dw}px × ${dh >= 0 ? '+' : ''}${dh}px → ${contentW.value}×${contentH.value}`)
        prevContent = { w: contentW.value, h: contentH.value }
      }
    }
  })

  // box: 'content-box' —— 观察器额外配置（默认就是 content-box）
  if (box.value) {
    observer.observe(box.value, { box: 'content-box' })
  }
})

onUnmounted(() => {
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <div class="ro-demo">
    <!-- 统计条 -->
    <div class="stats">
      <span>内容区 <b>{{ contentW }}×{{ contentH }}</b></span>
      <span>边框盒 <b>{{ borderW }}×{{ borderH }}</b></span>
      <span>触发 <b>{{ triggerCount }}</b> 次</span>
    </div>

    <div class="body">
      <!-- 被观察容器：拖右下角把手改变尺寸 -->
      <div class="stage">
        <div
          ref="box"
          class="box"
        >
          <span class="box-label">拖右下角 ↘</span>
        </div>
      </div>

      <!-- 日志 -->
      <div class="log-panel">
        <p class="log-title">
          尺寸变化日志
        </p>
        <p
          v-if="logs.length === 0"
          class="log-empty"
        >
          拖动左侧容器右下角，每次变化都会记录
        </p>
        <ul
          v-else
          class="log-list"
        >
          <li
            v-for="(l, i) in logs"
            :key="i"
          >
            {{ l }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ro-demo {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.stats {
  display: flex;
  gap: 1.1rem;
  font-size: 0.82rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

.body {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 0.75rem;
}

/* ---------- 拖拽舞台 ---------- */

.stage {
  height: 300px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-btn);
  padding: 0.8rem;
  background-color: var(--bg);
}

/* 被观察容器：resize:both + 手柄（原生 CSS 拖拽，零 JS） */
.box {
  width: 260px;
  height: 160px;
  resize: both;
  overflow: hidden;
  border: 2px solid var(--primary);
  border-radius: var(--radius-sm);
  background-color: color-mix(in srgb, var(--primary) 8%, var(--bg));
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 0.4rem;
}

.box-label {
  font-size: 0.72rem;
  color: var(--text-secondary);
}

/* ---------- 日志 ---------- */

.log-panel {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  padding: 0.6rem 0.8rem;
  background-color: var(--code-bg);
  max-height: 300px;
  overflow-y: auto;
}

.log-title {
  margin: 0 0 0.4rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.log-empty {
  margin: 0;
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.log-list {
  list-style: none;
  padding: 0;
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  line-height: 1.9;
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .body {
    grid-template-columns: 1fr;
  }
}
</style>
