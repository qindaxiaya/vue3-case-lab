// ============================================================
// 案例：图片压缩前后对比（image-compress）
// - 原生 canvas.toBlob(quality) 压缩（浏览器能力，非手写算法）
// - 质量滑块 + 最大边长限制，实时重压
// - 拖动分割线对比前后（pointer events 拖拽）
// - 显示原始/压缩体积、压缩率、输出分辨率
// - 无图时自动生成测试图（渐变 + 噪声，压缩差异明显）
// ============================================================
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

// ============================================================
// 源图与压缩结果
// ============================================================

/** 原图 objectURL */
const originUrl = ref('')
/** 原图字节数 */
const originSize = ref(0)
/** 原图分辨率 */
const originDim = ref('')
/** 原图文件名 */
const originName = ref('测试图（自动生成）')

/** 压缩后 objectURL */
const compressedUrl = ref('')
/** 压缩后字节数 */
const compressedSize = ref(0)
/** 压缩后分辨率 */
const compressedDim = ref('')

/** JPEG 质量（0.1 ~ 1） */
const quality = ref(0.6)
/** 最大边长（超出等比缩放） */
const maxEdge = ref(1200)
/** 是否正在压缩 */
const compressing = ref(false)

/** 对比分割线位置（百分比 0~100） */
const splitPos = ref(50)

// ============================================================
// 工具：格式化体积
// ============================================================

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

/** 压缩率（正数=变小） */
const ratio = computed(() => {
  if (!originSize.value || !compressedSize.value) return 0
  return Math.round((1 - compressedSize.value / originSize.value) * 100)
})

// ============================================================
// 生成测试图（一打开就能玩）
// ============================================================

/** 在 canvas 上画一张有渐变与噪点的测试图（尺寸大、细节多 → 压缩效果明显） */
function makeTestImage(): string {
  const c = document.createElement('canvas')
  c.width = 1600
  c.height = 1000
  const ctx = c.getContext('2d')!

  // 底色渐变
  const grad = ctx.createLinearGradient(0, 0, c.width, c.height)
  grad.addColorStop(0, '#4f46e5')
  grad.addColorStop(0.5, '#06b6d4')
  grad.addColorStop(1, '#f59e0b')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, c.width, c.height)

  // 随机彩色圆（制造高频细节——JPEG 压缩后差异肉眼可见）
  for (let i = 0; i < 140; i++) {
    ctx.beginPath()
    ctx.arc(
      Math.random() * c.width,
      Math.random() * c.height,
      8 + Math.random() * 70,
      0,
      Math.PI * 2,
    )
    ctx.fillStyle = `hsl(${Math.random() * 360} 80% 60% / 0.55)`
    ctx.fill()
  }

  // 细网格线（增加高频噪声）
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 1
  for (let x = 0; x < c.width; x += 18) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, c.height)
    ctx.stroke()
  }

  // 转 PNG blob URL（无损源图，保证体积基准）
  return c.toDataURL('image/png')
}

// ============================================================
// 压缩核心：canvas 重绘 + toBlob(quality)
// ============================================================

/** 当前原图的 Image 对象（压缩时复用） */
let originImg: HTMLImageElement | null = null

/** toBlob 的 Promise 包装 */
function toBlobAsync(canvas: HTMLCanvasElement, type: string, q: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, q))
}

/** 执行压缩：等比缩放到 maxEdge 内 + JPEG 质量 */
async function compress(): Promise<void> {
  if (!originImg || originImg.naturalWidth === 0) return
  compressing.value = true

  // 等比缩放：长边不超过 maxEdge
  const scale = Math.min(1, maxEdge.value / Math.max(originImg.naturalWidth, originImg.naturalHeight))
  const w = Math.round(originImg.naturalWidth * scale)
  const h = Math.round(originImg.naturalHeight * scale)

  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  // 缩放时开启平滑（质量更好）
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(originImg, 0, 0, w, h)

  //! 关键一步：toBlob 的第三个参数就是 JPEG 质量（0~1）——浏览器原生编码
  const blob = await toBlobAsync(c, 'image/jpeg', quality.value)
  if (!blob) {
    compressing.value = false
    return
  }

  // 回收上一张压缩图 URL（防内存累积）
  if (compressedUrl.value) URL.revokeObjectURL(compressedUrl.value)
  compressedUrl.value = URL.createObjectURL(blob)
  compressedSize.value = blob.size
  compressedDim.value = `${w} × ${h}`
  compressing.value = false
}

/** 载入源图（URL → Image 对象 → 记录元信息 → 压缩） */
function loadOrigin(url: string, name: string): void {
  const img = new Image()
  img.onload = () => {
    originImg = img
    originDim.value = `${img.naturalWidth} × ${img.naturalHeight}`
    originName.value = name
    void compress()
  }
  img.src = url

  // 记录原始体积（从 blob 估算：用 fetch 读大小，这里简化用 base64 长度）
  void fetch(url)
    .then((r) => r.blob())
    .then((b) => (originSize.value = b.size))
}

// ============================================================
// 上传与拖放
// ============================================================

const fileInput = ref<HTMLInputElement | null>(null)

function onFileChange(e: Event): void {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (originUrl.value) URL.revokeObjectURL(originUrl.value)
  originUrl.value = URL.createObjectURL(file)
  loadOrigin(originUrl.value, file.name)
}

/** 拖入文件 */
function onDrop(e: DragEvent): void {
  e.preventDefault()
  const file = e.dataTransfer?.files?.[0]
  if (file?.type.startsWith('image/')) {
    if (originUrl.value) URL.revokeObjectURL(originUrl.value)
    originUrl.value = URL.createObjectURL(file)
    loadOrigin(originUrl.value, file.name)
  }
}

// ============================================================
// 分割线拖拽（pointer events：鼠标/触摸统一）
// ============================================================

const stage = ref<HTMLElement | null>(null)
let dragging = false

function updateSplit(e: PointerEvent): void {
  const rect = stage.value?.getBoundingClientRect()
  if (!rect) return
  const pct = ((e.clientX - rect.left) / rect.width) * 100
  splitPos.value = Math.min(100, Math.max(0, pct))
}

function onPointerDown(e: PointerEvent): void {
  dragging = true
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  updateSplit(e)
}

function onPointerMove(e: PointerEvent): void {
  if (dragging) updateSplit(e)
}

function onPointerUp(): void {
  dragging = false
}

// ============================================================
// 生命周期
// ============================================================

onMounted(() => {
  // 默认载入自动生成的测试图（dataURL 与 objectURL 行为一致）
  originUrl.value = makeTestImage()
  loadOrigin(originUrl.value, '测试图（自动生成）')
})

// 质量/边长变化时重新压缩（防抖：canvas 压缩是同步重绘 + 异步编码）
let compressTimer = 0
watch([quality, maxEdge], () => {
  window.clearTimeout(compressTimer)
  compressTimer = window.setTimeout(() => void compress(), 120)
})

onUnmounted(() => {
  window.clearTimeout(compressTimer)
  // 回收全部 objectURL（dataURL 无需回收）
  if (originUrl.value.startsWith('blob:')) URL.revokeObjectURL(originUrl.value)
  if (compressedUrl.value) URL.revokeObjectURL(compressedUrl.value)
})
</script>

<template>
  <div class="ic-demo">
    <!-- 控制区 -->
    <div class="controls">
      <label class="ctl">
        JPEG 质量
        <input
          v-model.number="quality"
          type="range"
          min="0.1"
          max="1"
          step="0.05"
        >
        <span class="ctl-val">{{ quality.toFixed(2) }}</span>
      </label>
      <label class="ctl">
        最大边长
        <input
          v-model.number="maxEdge"
          type="range"
          min="400"
          max="1600"
          step="100"
        >
        <span class="ctl-val">{{ maxEdge }}px</span>
      </label>
      <button
        class="btn-act"
        @click="fileInput?.click()"
      >
        选择图片
      </button>
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        class="file-hidden"
        @change="onFileChange"
      >
      <span class="hint">或直接把图片拖到下方对比区</span>
    </div>

    <!-- 数据条 -->
    <div class="stats">
      <span>原图 <b>{{ formatBytes(originSize) }}</b> · {{ originDim }}</span>
      <span>压缩后 <b>{{ formatBytes(compressedSize) }}</b> · {{ compressedDim }}</span>
      <span
        class="ratio"
        :class="{ 'ratio--good': ratio > 0 }"
      >{{ ratio > 0 ? `↓ ${ratio}%` : '—' }}</span>
      <span
        v-if="compressing"
        class="busy"
      >压缩中…</span>
    </div>

    <!-- 对比舞台：拖动中间分割线 -->
    <div
      ref="stage"
      class="stage"
      @dragover.prevent
      @drop="onDrop"
    >
      <!-- 底层：压缩后 -->
      <img
        v-if="compressedUrl"
        :src="compressedUrl"
        class="layer"
        alt="压缩后"
      >
      <!-- 上层：原图（用 clip-path 裁到分割线左侧） -->
      <img
        v-if="originUrl"
        :src="originUrl"
        class="layer layer--origin"
        :style="{ clipPath: `inset(0 ${100 - splitPos}% 0 0)` }"
        alt="原图"
      >
      <!-- 分割线与把手 -->
      <div
        class="splitter"
        :style="{ left: `${splitPos}%` }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
      >
        <span
          class="handle"
          aria-hidden="true"
        >⇔</span>
      </div>

      <!-- 左右角标 -->
      <span class="corner corner--left">原图 {{ originDim }}</span>
      <span class="corner corner--right">压缩后</span>
    </div>

    <p class="footnote">
      原理：canvas 重绘（等比缩放）+ <code>toBlob(type, quality)</code> 浏览器原生编码。
      质量 0.6 + 限制边长通常能砍掉 70%+ 体积，肉眼几乎无损。
    </p>
  </div>
</template>

<style scoped>
.ic-demo {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

/* ---------- 控制区 ---------- */

.controls {
  display: flex;
  align-items: center;
  gap: 1.1rem;
  flex-wrap: wrap;
}

.ctl {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.78rem;
  color: var(--text);

  input[type='range'] {
    accent-color: var(--primary);
    width: 120px;
  }
}

.ctl-val {
  font-family: var(--font-mono);
  font-size: 0.74rem;
  color: var(--primary);
  min-width: 3.4em;
}

.btn-act {
  padding: 0.3rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--primary);
  background-color: transparent;
  color: var(--primary);
  font-size: 0.78rem;
  cursor: pointer;

  &:hover {
    background-color: var(--primary);
    color: #fff;
  }
}

.file-hidden {
  display: none;
}

.hint {
  font-size: 0.72rem;
  color: var(--text-secondary);
}

/* ---------- 数据条 ---------- */

.stats {
  display: flex;
  align-items: center;
  gap: 1.2rem;
  flex-wrap: wrap;
  font-size: 0.78rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--text);
  }
}

.ratio {
  font-family: var(--font-mono);
  color: var(--text-secondary);
}

.ratio--good {
  color: var(--success);
  font-weight: 600;
}

.busy {
  color: var(--primary);
}

/* ---------- 对比舞台 ---------- */

.stage {
  position: relative;
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  overflow: hidden;
  background-color: var(--code-bg);
  /* 固定宽高比容器，避免布局跳动 */
  aspect-ratio: 16 / 10;
  user-select: none;
  touch-action: none;
}

.layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.layer--origin {
  /* clip-path 由内联样式控制分割位置 */
  z-index: 1;
}

/* 分割线 */
.splitter {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  margin-left: -1px;
  background-color: #fff;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 0.35);
  z-index: 2;
  cursor: ew-resize;
}

.handle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: #fff;
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.3);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  color: #374151;
}

/* 角标 */
.corner {
  position: absolute;
  bottom: 0.6rem;
  z-index: 3;
  font-size: 0.68rem;
  font-family: var(--font-mono);
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background-color: rgb(0 0 0 / 0.55);
  color: #fff;
}

.corner--left {
  left: 0.6rem;
}

.corner--right {
  right: 0.6rem;
}

.footnote {
  margin: 0;
  font-size: 0.74rem;
  line-height: 1.7;
  color: var(--text-secondary);

  code {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    padding: 0.05rem 0.3rem;
    background-color: var(--code-bg);
    border-radius: var(--radius-sm);
  }
}
</style>
