// ============================================================
// 案例：滑块验证（slider-captcha）
// canvas 现场画背景 + 随机缺口 → 拖动拼图对齐 → 误差 ≤ 5px 通过；
// 同时记录耗时、轨迹点数、方向变化次数（人类轨迹的简单特征）。
// ============================================================
<script setup lang="ts">
import { onMounted, ref } from 'vue'

const CANVAS_W = 320
const CANVAS_H = 160
const PIECE = 46
const TRACK_MAX = CANVAS_W - PIECE
const TOLERANCE = 5

const mainRef = ref<HTMLCanvasElement | null>(null)
const pieceRef = ref<HTMLCanvasElement | null>(null)

const targetX = ref(200)
const pieceY = ref(50)
const offset = ref(0)
const dragging = ref(false)
const result = ref<'idle' | 'pass' | 'fail'>('idle')

const deviation = ref<number | null>(null)
const elapsed = ref<number | null>(null)
const pointCount = ref(0)
const directionChanges = ref(0)

let startClientX = 0
let startOffset = 0
let startTime = 0
let lastDx = 0
let lastDir = 0

// ============================================================
// 绘制
// ============================================================

function drawScene(ctx: CanvasRenderingContext2D): void {
  const grad = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H)
  grad.addColorStop(0, '#1e293b')
  grad.addColorStop(0.55, '#334155')
  grad.addColorStop(1, '#0f172a')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // 随机色块：让缺口位置更难被机器「猜」
  for (let i = 0; i < 14; i++) {
    ctx.beginPath()
    ctx.arc(
      Math.random() * CANVAS_W,
      Math.random() * CANVAS_H,
      10 + Math.random() * 42,
      0,
      Math.PI * 2,
    )
    ctx.fillStyle = `hsla(${Math.random() * 360}, 70%, 62%, 0.16)`
    ctx.fill()
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.07)'
  for (let x = 0; x < CANVAS_W; x += 24) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, CANVAS_H)
    ctx.stroke()
  }
}

function generate(): void {
  offset.value = 0
  result.value = 'idle'
  deviation.value = null
  elapsed.value = null
  pointCount.value = 0
  directionChanges.value = 0
  lastDx = 0
  lastDir = 0

  // 缺口位置随机
  targetX.value = 100 + Math.floor(Math.random() * (TRACK_MAX - 120))
  pieceY.value = 14 + Math.floor(Math.random() * (CANVAS_H - PIECE - 28))

  const main = mainRef.value
  const piece = pieceRef.value
  if (!main || !piece) return

  //! 按 DPR 放大 canvas，CSS 尺寸不变，避免高分屏发虚
  const dpr = window.devicePixelRatio || 1
  main.width = CANVAS_W * dpr
  main.height = CANVAS_H * dpr
  piece.width = PIECE * dpr
  piece.height = PIECE * dpr

  const m = main.getContext('2d')
  const p = piece.getContext('2d')
  if (!m || !p) return
  m.setTransform(dpr, 0, 0, dpr, 0, 0)
  p.setTransform(dpr, 0, 0, dpr, 0, 0)

  // 先在离屏画完整背景，再从它上面「抠」出拼图块
  const off = document.createElement('canvas')
  off.width = CANVAS_W
  off.height = CANVAS_H
  const o = off.getContext('2d')
  if (!o) return
  drawScene(o)

  m.clearRect(0, 0, CANVAS_W, CANVAS_H)
  m.drawImage(off, 0, 0)

  // 缺口：压暗 + 白边
  m.fillStyle = 'rgba(2, 6, 23, 0.55)'
  m.fillRect(targetX.value, pieceY.value, PIECE, PIECE)
  m.strokeStyle = 'rgba(255,255,255,0.85)'
  m.lineWidth = 1.5
  m.strokeRect(targetX.value + 0.75, pieceY.value + 0.75, PIECE - 1.5, PIECE - 1.5)

  // 拼图块：从离屏背景裁剪同一区域
  p.clearRect(0, 0, PIECE, PIECE)
  p.drawImage(off, targetX.value, pieceY.value, PIECE, PIECE, 0, 0, PIECE, PIECE)
  p.strokeStyle = 'rgba(255,255,255,0.85)'
  p.strokeRect(0.75, 0.75, PIECE - 1.5, PIECE - 1.5)
}

onMounted(generate)

// ============================================================
// 拖动
// ============================================================

function onPointerDown(e: PointerEvent): void {
  if (result.value === 'pass') return
  if (result.value === 'fail') {
    // 失败后重新出题
    generate()
    return
  }

  dragging.value = true
  startClientX = e.clientX
  startOffset = offset.value
  startTime = performance.now()
  pointCount.value = 0
  directionChanges.value = 0
  lastDx = 0
  lastDir = 0
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent): void {
  if (!dragging.value) return

  const dx = e.clientX - startClientX
  const next = Math.max(0, Math.min(TRACK_MAX, startOffset + dx))
  offset.value = next
  pointCount.value++

  //! 方向变化次数：人类会来回微调，脚本往往是直线匀速
  const dir = Math.sign(dx - lastDx)
  if (dir !== 0 && lastDir !== 0 && dir !== lastDir) directionChanges.value++
  if (dir !== 0) lastDir = dir
  lastDx = dx
}

function onPointerUp(): void {
  if (!dragging.value) return
  dragging.value = false

  const dev = Math.abs(offset.value - targetX.value)
  deviation.value = Math.round(dev)
  elapsed.value = Math.round(performance.now() - startTime)
  result.value = dev <= TOLERANCE ? 'pass' : 'fail'
}

const resultText = (): string => {
  if (result.value === 'pass') return '✓ 验证通过'
  if (result.value === 'fail') return `✕ 偏差 ${deviation.value}px，点击重新验证`
  return dragging.value ? '正在拖动…' : '按住滑块向右拖动'
}
</script>

<template>
  <div class="sc-demo">
    <!-- 画布 -->
    <div
      class="sc-stage"
      :style="{ width: `${CANVAS_W}px`, height: `${CANVAS_H}px` }"
    >
      <canvas
        ref="mainRef"
        class="sc-main"
        :style="{ width: `${CANVAS_W}px`, height: `${CANVAS_H}px` }"
      />
      <canvas
        ref="pieceRef"
        class="sc-piece"
        :style="{
          width: `${PIECE}px`,
          height: `${PIECE}px`,
          left: `${offset}px`,
          top: `${pieceY}px`,
        }"
      />
    </div>

    <!-- 滑块轨道 -->
    <div
      class="sc-track"
      :style="{ width: `${CANVAS_W}px` }"
    >
      <span
        class="sc-fill"
        :style="{ width: `${offset + PIECE / 2}px` }"
      />
      <span class="sc-track-text">{{ resultText() }}</span>
      <button
        class="sc-thumb"
        :class="result"
        :style="{ left: `${offset}px` }"
        aria-label="拖动滑块完成验证"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        →
      </button>
    </div>

    <!-- 指标 -->
    <div class="sc-metrics">
      <span>偏差 <b>{{ deviation === null ? '—' : deviation + ' px' }}</b></span>
      <span>耗时 <b>{{ elapsed === null ? '—' : elapsed + ' ms' }}</b></span>
      <span>轨迹点 <b>{{ pointCount }}</b></span>
      <span>方向变化 <b>{{ directionChanges }}</b></span>
      <button
        class="btn-ghost"
        @click="generate"
      >
        换一张
      </button>
    </div>

    <p class="sc-hint">
      前端校验只是「提高脚本成本」，<b>真正的判定必须在服务端</b>：把轨迹、耗时、设备指纹一起提交，
      由风控判断。仅靠 <code>Math.abs(x - target) &lt; 5</code> 的验证码，几行脚本就能破解。
    </p>
  </div>
</template>

<style scoped>
.sc-demo {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-start;
}

/* ---------- 画布 ---------- */

.sc-stage {
  position: relative;
  border-radius: var(--radius-btn);
  overflow: hidden;
  border: 1px solid var(--border);
  max-width: 100%;
}

.sc-main {
  display: block;
}

.sc-piece {
  position: absolute;
  border-radius: 2px;
  box-shadow: 0 2px 10px rgb(0 0 0 / 0.35);
  pointer-events: none;
  transition: none;
}

/* ---------- 滑块 ---------- */

.sc-track {
  position: relative;
  height: 40px;
  border-radius: var(--radius-sm);
  background-color: var(--code-bg);
  border: 1px solid var(--border);
  overflow: hidden;
  max-width: 100%;
  touch-action: none;
  user-select: none;
}

.sc-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background-color: var(--primary-soft);
}

.sc-track-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.72rem;
  color: var(--text-secondary);
  pointer-events: none;
}

.sc-thumb {
  position: absolute;
  top: 0;
  width: 46px;
  height: 100%;
  border: 1px solid var(--primary);
  border-radius: var(--radius-sm);
  background-color: var(--bg);
  color: var(--primary);
  font-size: 0.95rem;
  cursor: grab;
  touch-action: none;

  &:active {
    cursor: grabbing;
  }

  &.pass {
    border-color: var(--success);
    color: var(--success);
  }

  &.fail {
    border-color: var(--danger);
    color: var(--danger);
  }
}

/* ---------- 指标 ---------- */

.sc-metrics {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  flex-wrap: wrap;
  font-size: 0.72rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

.btn-ghost {
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.7rem;
  cursor: pointer;
  border: 1px solid var(--border);
  background-color: transparent;
  color: var(--text-secondary);

  &:hover {
    background-color: var(--code-bg);
    color: var(--text);
  }
}

.sc-hint {
  margin: 0;
  font-size: 0.72rem;
  color: var(--text-secondary);
  line-height: 1.6;
  max-width: 40rem;

  code {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    padding: 0.02rem 0.24rem;
    background-color: var(--code-bg);
    border-radius: var(--radius-sm);
  }
}
</style>
