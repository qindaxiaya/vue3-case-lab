// ============================================================
// 案例：PDF 预览（pdf-preview）
// 现场生成一份 3 页 PDF，用 pdf.js 在 Web Worker 里解析，
// 逐页渲染到 canvas；翻页、缩放、销毁全部自己控制，不使用 iframe。
// ============================================================
<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
} from 'vue'
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  RenderTask,
} from 'pdfjs-dist'
// worker 单独打包成资源：解析在后台线程，主线程只负责画 canvas
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { createSamplePdf } from './pdf'

/** 按需加载 pdf.js 运行时：首页 / 其他案例不背这 ~380KB */
type PdfjsModule = typeof import('pdfjs-dist')
let pdfjsModule: PdfjsModule | null = null

async function ensurePdfjs(): Promise<PdfjsModule> {
  if (!pdfjsModule) {
    const mod = await import('pdfjs-dist')
    // worker 地址必须在 getDocument 之前配置
    mod.GlobalWorkerOptions.workerSrc = workerUrl
    pdfjsModule = mod
  }
  return pdfjsModule
}

const MIN_ZOOM = 50
const MAX_ZOOM = 200
const ZOOM_STEP = 25
/** 100% 时预览区的最大高度（px）；超出后在预览区内滚动 */
const BASE_MAX_HEIGHT = 480
/** 预览区左右内边距（12px × 2），计算可用宽度时扣掉 */
const FRAME_PADDING = 24

const pdfDoc = shallowRef<PDFDocumentProxy | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const frameEl = ref<HTMLElement | null>(null)

const page = ref(1)
const pageCount = ref(0)
const zoom = ref(100)
const size = ref(0)
const genMs = ref(0)
const renderMs = ref(0)
const loading = ref(false)
const rendering = ref(false)
const error = ref('')

/** 当前渲染任务：翻页/缩放前先取消，避免「同一 canvas 重复渲染」报错 */
let renderTask: RenderTask | null = null
/** 当前文档的加载任务：pdf.js 6 里关闭文档要 destroy 它（proxy 自身没有 destroy） */
let loadingTask: PDFDocumentLoadingTask | null = null
/** 加载序号：快速重新生成时丢弃上一次的解析结果 */
let loadSeq = 0
/** 渲染序号：取消后旧渲染的 finally 不能改新状态 */
let renderSeq = 0
/** 预览区上一次宽度：ResizeObserver 只在宽度变化时重渲染（高度变化会自触发） */
let lastFrameWidth = 0
let resizeObserver: ResizeObserver | null = null

const canPrev = computed(() => page.value > 1)
const canNext = computed(() => page.value < pageCount.value)

/** 取消正在进行的渲染（pdf.js 的 RenderTask 支持中途取消） */
function cancelRender(): void {
  renderSeq += 1
  if (renderTask) {
    renderTask.cancel()
    renderTask = null
  }
}

/**
 * 渲染当前页到 canvas
 * - 以预览区宽度为 100%，同时限制 100% 时的最大高度
 * - 按设备像素比放大画布，CSS 再缩回去，保证高分屏不糊
 */
async function renderPage(): Promise<void> {
  const doc = pdfDoc.value
  const canvas = canvasEl.value
  const frame = frameEl.value
  if (!doc || !canvas || !frame) return

  cancelRender()
  const seq = renderSeq
  rendering.value = true
  error.value = ''

  try {
    const pdfPage = await doc.getPage(page.value)
    if (seq !== renderSeq) return

    const base = pdfPage.getViewport({ scale: 1 })
    const aspect = base.width / base.height
    const available = Math.max(180, frame.clientWidth - FRAME_PADDING)
    // 宽度约束 + 高度约束同时满足；放大后超出部分在预览区内滚动
    const byWidth = available * (zoom.value / 100)
    const byHeight = BASE_MAX_HEIGHT * (zoom.value / 100) * aspect
    const cssWidth = Math.max(120, Math.min(byWidth, byHeight))
    const cssHeight = cssWidth / aspect

    // 高分屏最多按 2 倍渲染，再高收益小、内存翻倍
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const viewport = pdfPage.getViewport({
      scale: (cssWidth / base.width) * dpr,
    })

    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    canvas.style.width = `${Math.round(cssWidth)}px`
    canvas.style.height = `${Math.round(cssHeight)}px`

    const t0 = performance.now()
    const task = pdfPage.render({ canvas, viewport })
    renderTask = task
    await task.promise

    // 期间用户又翻页/缩放：本次结果作废
    if (seq !== renderSeq) return
    renderMs.value = performance.now() - t0
  } catch (cause) {
    if (seq !== renderSeq) return
    error.value = cause instanceof Error ? cause.message : 'PDF 渲染失败'
  } finally {
    if (seq === renderSeq) {
      rendering.value = false
      renderTask = null
    }
  }
}

/** 解析 PDF 并渲染第一页 */
async function loadPdf(blob: Blob): Promise<void> {
  const seq = ++loadSeq
  cancelRender()

  // 先关掉上一份文档的加载任务（会终止它对应的 worker 数据）
  const previous = loadingTask
  loadingTask = null
  pdfDoc.value = null
  if (previous) void previous.destroy()

  pageCount.value = 0
  page.value = 1
  loading.value = true
  error.value = ''

  try {
    // 直接把字节交给 pdf.js，不创建 Blob URL / iframe
    const data = new Uint8Array(await blob.arrayBuffer())
    const pdfjs = await ensurePdfjs()
    if (seq !== loadSeq) return
    const task = pdfjs.getDocument({ data })
    loadingTask = task
    const doc = await task.promise
    if (seq !== loadSeq) {
      void task.destroy()
      return
    }

    pdfDoc.value = doc
    pageCount.value = doc.numPages
    await nextTick()
    await renderPage()
  } catch (cause) {
    if (seq !== loadSeq) return
    error.value = cause instanceof Error ? cause.message : 'PDF 解析失败'
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

/** 现场生成 PDF：几毫秒，纯前端 */
function regenerate(): void {
  const t0 = performance.now()
  const blob = createSamplePdf()
  genMs.value = performance.now() - t0
  size.value = blob.size
  void loadPdf(blob)
}

/** 翻页：页码越界直接忽略 */
function goPage(next: number): void {
  if (!pdfDoc.value || next < 1 || next > pageCount.value) return
  page.value = next
  void renderPage()
}

/** 缩放：限制在 50%~200%，每次 25% */
function changeZoom(delta: number): void {
  const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom.value + delta))
  if (next === zoom.value) return
  zoom.value = next
  void renderPage()
}

/** 卸载：销毁加载任务，释放 worker 里缓存的页面与字体 */
function unload(): void {
  loadSeq += 1
  cancelRender()
  void loadingTask?.destroy()
  loadingTask = null
  pdfDoc.value = null
  pageCount.value = 0
  page.value = 1
  zoom.value = 100
  size.value = 0
  genMs.value = 0
  renderMs.value = 0
  loading.value = false
  rendering.value = false
  error.value = ''
}

/** 预览区宽度变化时重渲染（缩放窗口、切换 375px 视口） */
function handleResize(): void {
  const width = frameEl.value?.clientWidth ?? 0
  if (!width || Math.abs(width - lastFrameWidth) < 1) return
  lastFrameWidth = width
  if (pdfDoc.value && !loading.value) void renderPage()
}

onMounted(() => {
  lastFrameWidth = frameEl.value?.clientWidth ?? 0
  if (frameEl.value) {
    resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(frameEl.value)
  }
  // 等 DOM 就绪再生成并加载，确保 canvas / 预览区都拿得到
  regenerate()
})

onBeforeUnmount(() => {
  loadSeq += 1
  cancelRender()
  resizeObserver?.disconnect()
  resizeObserver = null
  void loadingTask?.destroy()
  loadingTask = null
  pdfDoc.value = null
})
</script>

<template>
  <div class="pdf-demo">
    <!-- 第一行：生成、卸载、体积与耗时 -->
    <div class="pdf-bar">
      <button
        class="btn-act"
        type="button"
        @click="regenerate"
      >
        重新生成 PDF
      </button>
      <button
        class="btn-ghost"
        type="button"
        :disabled="!pdfDoc"
        @click="unload"
      >
        卸载
      </button>
      <span class="pdf-stat">
        大小 <b>{{ size ? (size / 1024).toFixed(1) + ' KB' : '—' }}</b>
      </span>
      <span class="pdf-stat">
        生成 <b>{{ genMs ? genMs.toFixed(1) + ' ms' : '—' }}</b>
      </span>
      <span class="pdf-stat">
        渲染 <b>{{ renderMs ? renderMs.toFixed(1) + ' ms' : '—' }}</b>
      </span>
    </div>

    <!-- 第二行：翻页与缩放 -->
    <div class="pdf-bar">
      <div class="pdf-group">
        <button
          class="btn-ghost"
          type="button"
          :disabled="!canPrev"
          aria-label="上一页"
          @click="goPage(page - 1)"
        >
          ‹
        </button>
        <span class="pdf-page">{{ pageCount ? `${page} / ${pageCount}` : '— / —' }}</span>
        <button
          class="btn-ghost"
          type="button"
          :disabled="!canNext"
          aria-label="下一页"
          @click="goPage(page + 1)"
        >
          ›
        </button>
      </div>

      <div class="pdf-group">
        <button
          class="btn-ghost"
          type="button"
          :disabled="zoom <= MIN_ZOOM || !pdfDoc"
          aria-label="缩小"
          @click="changeZoom(-ZOOM_STEP)"
        >
          −
        </button>
        <span class="pdf-page">{{ zoom }}%</span>
        <button
          class="btn-ghost"
          type="button"
          :disabled="zoom >= MAX_ZOOM || !pdfDoc"
          aria-label="放大"
          @click="changeZoom(ZOOM_STEP)"
        >
          +
        </button>
        <button
          class="btn-ghost"
          type="button"
          :disabled="!pdfDoc"
          @click="changeZoom(100 - zoom)"
        >
          重置缩放
        </button>
      </div>

      <span class="pdf-src">canvas 渲染 · 无 iframe</span>
    </div>

    <!-- 预览区：只有 canvas，没有 iframe / object / embed -->
    <div
      ref="frameEl"
      class="pdf-frame"
    >
      <canvas
        v-show="pdfDoc"
        ref="canvasEl"
        class="pdf-canvas"
        role="img"
        :aria-label="`PDF 第 ${page} 页预览，共 ${pageCount} 页，当前缩放 ${zoom}%`"
      />

      <!-- 解析/渲染中：细进度条 + 文案，不遮挡工具栏 -->
      <div
        v-if="loading || rendering"
        class="pdf-overlay"
        aria-live="polite"
      >
        <span
          class="pdf-progress"
          aria-hidden="true"
        />
        <span>{{ loading ? '正在解析 PDF…' : `正在渲染第 ${page} 页…` }}</span>
      </div>

      <div
        v-else-if="error"
        class="pdf-empty"
        role="alert"
      >
        <p>{{ error }}</p>
        <button
          class="btn-act"
          type="button"
          @click="regenerate"
        >
          重试
        </button>
      </div>

      <p
        v-else-if="!pdfDoc"
        class="pdf-empty"
      >
        已卸载，点「重新生成 PDF」。
      </p>
    </div>

    <!-- 说明表 -->
    <table class="pdf-table">
      <thead>
        <tr>
          <th scope="col">
            能力
          </th>
          <th scope="col">
            pdf.js + canvas
          </th>
          <th scope="col">
            浏览器内置查看器
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>工具栏 / UI</td>
          <td>完全自己写，可加水印、批注</td>
          <td>样式固定，难以定制</td>
        </tr>
        <tr>
          <td>翻页与缩放</td>
          <td>页码、缩放、适配宽度都能控制</td>
          <td>受查看器行为限制</td>
        </tr>
        <tr>
          <td>移动端一致性</td>
          <td>同一套代码各端表现一致</td>
          <td>可能只显示一页或直接下载</td>
        </tr>
        <tr>
          <td>成本</td>
          <td>多一个运行时依赖，需要写渲染逻辑</td>
          <td>零依赖，但只能「能看」</td>
        </tr>
      </tbody>
    </table>

    <p class="pdf-hint">
      这份 PDF 仍是纯字符串拼出来的（<code>%PDF-1.4</code> + 对象 + xref 偏移表），
      pdf.js 只负责解析和绘制。解析在 Web Worker 里进行，翻页前会取消上一次渲染任务，
      卸载时调用 <code>loadingTask.destroy()</code>。
    </p>
  </div>
</template>

<style scoped>
.pdf-demo {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.pdf-bar {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.pdf-group {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.btn-act,
.btn-ghost {
  padding: 0.22rem 0.55rem;
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  cursor: pointer;
  border: 1px solid var(--primary);
  background-color: transparent;
  color: var(--primary);

  &:hover:not(:disabled) {
    background-color: var(--primary);
    color: #fff;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.btn-ghost {
  border-color: var(--border);
  color: var(--text-secondary);

  &:hover:not(:disabled) {
    background-color: var(--code-bg);
    color: var(--text);
  }
}

.pdf-page {
  min-width: 3.2rem;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.pdf-stat {
  font-size: 0.8125rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

.pdf-src {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  padding: 0.1rem 0.35rem;
  border-radius: var(--radius-sm);
  background-color: var(--code-bg);
  color: var(--text-secondary);
}

.pdf-frame {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  min-height: 320px;
  max-height: 560px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  overflow: auto;
  background-color: var(--code-bg);
}

.pdf-canvas {
  display: block;
  flex: none;
  border-radius: 2px;
  background-color: #fff;
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.18);
}

.pdf-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  background-color: color-mix(in srgb, var(--code-bg) 82%, transparent);
  color: var(--text-secondary);
  font-size: 0.8125rem;
}

.pdf-progress {
  width: 42%;
  max-width: 180px;
  height: 3px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    var(--border) 25%,
    var(--primary) 50%,
    var(--border) 75%
  );
  background-size: 200% 100%;
  animation: pdf-progress 1.1s linear infinite;
}

@keyframes pdf-progress {
  from {
    background-position: 100% 0;
  }

  to {
    background-position: -100% 0;
  }
}

.pdf-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.7rem;
  margin: auto;
  padding: 2rem 1rem;
  text-align: center;
  font-size: 0.8125rem;
  color: var(--text-secondary);

  p {
    margin: 0;
  }
}

.pdf-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;

  th,
  td {
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--border);
    text-align: left;
    vertical-align: top;
    line-height: 1.6;
  }

  th {
    background-color: var(--code-bg);
    color: var(--text-secondary);
    font-weight: 600;
    white-space: nowrap;
  }

  td {
    color: var(--text-secondary);
  }
}

.pdf-hint {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.6;

  code {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    padding: 0.02rem 0.24rem;
    background-color: var(--code-bg);
    border-radius: var(--radius-sm);
  }
}

/* 375px：工具栏换行后收紧间距，表格允许内部横向滚动 */
@media (max-width: 560px) {
  .pdf-stat,
  .pdf-src {
    font-size: 0.8125rem;
  }

  .pdf-table {
    display: block;
    overflow-x: auto;
    white-space: nowrap;
  }
}
</style>
