// ============================================================
// 案例：多格式文件预览（file-preview）
// 按 MIME 分流：图片 / 文本 / PDF / 音频 / 视频 / 其他；
// 支持选择 + 拖拽 + 内置示例文件（文本/图片/PDF/音频，全部本地生成）。
// ============================================================
<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { createSamplePdf } from './pdf'

type Kind = 'image' | 'text' | 'pdf' | 'audio' | 'video' | 'other'

interface PreviewFile {
  name: string
  size: number
  type: string
  kind: Kind
  /** 对象 URL（非文本类型） */
  url: string | null
  /** 文本内容（截断） */
  text: string | null
}

const MAX_SIZE = 10 * 1024 * 1024
const TEXT_LIMIT = 6000

const current = ref<PreviewFile | null>(null)
const error = ref('')
const dragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

/** 按 MIME 判断预览方式 */
function kindOf(file: File): Kind {
  const type = file.type.toLowerCase()
  if (type.startsWith('image/')) return 'image'
  if (type.startsWith('audio/')) return 'audio'
  if (type.startsWith('video/')) return 'video'
  if (type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return 'pdf'
  if (
    type.startsWith('text/') ||
    /json|xml|csv|javascript|typescript|markdown|x-yaml/.test(type) ||
    /\.(txt|md|json|csv|log|yml|yaml|ts|js|css|html|xml)$/i.test(file.name)
  ) {
    return 'text'
  }
  return 'other'
}

const kindLabel: Record<Kind, string> = {
  image: '图片',
  text: '文本',
  pdf: 'PDF',
  audio: '音频',
  video: '视频',
  other: '其他',
}

/** 释放上一个对象 URL，避免内存泄漏 */
function release(): void {
  if (current.value?.url) URL.revokeObjectURL(current.value.url)
}

async function open(file: File): Promise<void> {
  error.value = ''

  if (file.size > MAX_SIZE) {
    error.value = `文件超过 10MB（当前 ${formatSize(file.size)}）`
    return
  }

  release()
  const kind = kindOf(file)
  const isText = kind === 'text'

  let text: string | null = null
  if (isText) {
    try {
      text = (await file.text()).slice(0, TEXT_LIMIT)
    } catch {
      error.value = '文本读取失败（可能是编码问题）'
      return
    }
  }

  current.value = {
    name: file.name,
    size: file.size,
    type: file.type || '未知',
    kind,
    //! 非文本类型统一用 Blob URL：浏览器原生组件直接能吃
    url: isText ? null : URL.createObjectURL(file),
    text,
  }
}

function onPick(e: Event): void {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) void open(file)
  input.value = ''
}

function onDrop(e: DragEvent): void {
  dragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) void open(file)
}

// ============================================================
// 内置示例：全部本地生成，不请求网络
// ============================================================

async function sampleText(): Promise<void> {
  const content = [
    'Vue 3 多格式文件预览示例',
    '',
    '这一份文本是在浏览器里用 Blob 现场生成的：',
    '  const blob = new Blob([text], { type: "text/plain" })',
    '',
    '预览逻辑：',
    '  文本 → file.text() → <pre>',
    '  图片 → URL.createObjectURL → <img>',
    '  PDF  → URL.createObjectURL → <iframe>',
    '  音视频 → URL.createObjectURL → <audio>/<video>',
    '',
    '未知类型 → 只显示元信息 + 下载按钮。',
  ].join('\n')
  await open(new File([content], 'preview-demo.txt', { type: 'text/plain' }))
}

async function sampleImage(): Promise<void> {
  const canvas = document.createElement('canvas')
  canvas.width = 480
  canvas.height = 270
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const grad = ctx.createLinearGradient(0, 0, 480, 270)
  grad.addColorStop(0, '#4f46e5')
  grad.addColorStop(1, '#06b6d4')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 480, 270)

  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.font = 'bold 34px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Generated Image', 240, 130)
  ctx.font = '16px system-ui, sans-serif'
  ctx.fillText('canvas.toBlob() → File → ObjectURL', 240, 170)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (blob) await open(new File([blob], 'preview-demo.png', { type: 'image/png' }))
}

async function samplePdf(): Promise<void> {
  const blob = createSamplePdf()
  await open(new File([blob], 'preview-demo.pdf', { type: 'application/pdf' }))
}

/** 生成 0.6 秒 440Hz 正弦波 WAV（44 字节头 + PCM） */
function makeWav(freq = 440, seconds = 0.6): Blob {
  const sampleRate = 44100
  const count = Math.floor(sampleRate * seconds)
  const buffer = new ArrayBuffer(44 + count * 2)
  const view = new DataView(buffer)

  const writeAscii = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }

  writeAscii(0, 'RIFF')
  view.setUint32(4, 36 + count * 2, true)
  writeAscii(8, 'WAVE')
  writeAscii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(36, 'data')
  view.setUint32(40, count * 2, true)

  for (let i = 0; i < count; i++) {
    // 20ms 淡入淡出，避免开头结尾的爆音
    const fade = Math.min(1, i / (sampleRate * 0.02), (count - i) / (sampleRate * 0.02))
    const sample = Math.sin((2 * Math.PI * freq * i) / sampleRate) * 0.28 * fade
    view.setInt16(44 + i * 2, Math.round(sample * 32767), true)
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

async function sampleAudio(): Promise<void> {
  await open(new File([makeWav()], 'preview-demo.wav', { type: 'audio/wav' }))
}

// ============================================================
// 展示辅助
// ============================================================

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

const kindText = computed(() => (current.value ? kindLabel[current.value.kind] : ''))

onBeforeUnmount(release)
</script>

<template>
  <div class="fp-demo">
    <!-- 选择区 -->
    <div
      class="fp-drop"
      :class="{ dragging }"
      role="button"
      tabindex="0"
      @click="fileInput?.click()"
      @keydown.enter="fileInput?.click()"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <span class="fp-drop-icon">⇩</span>
      <span class="fp-drop-text">
        点击选择文件，或拖拽到此处（≤ 10MB）
      </span>
      <input
        ref="fileInput"
        type="file"
        class="fp-input"
        @change="onPick"
      >
    </div>

    <!-- 示例 -->
    <div class="fp-samples">
      <span class="fp-samples-label">本地生成示例：</span>
      <n-button
        size="small"
        @click="sampleText"
      >
        文本
      </n-button>
      <n-button
        size="small"
        @click="sampleImage"
      >
        图片
      </n-button>
      <n-button
        size="small"
        @click="samplePdf"
      >
        PDF
      </n-button>
      <n-button
        size="small"
        @click="sampleAudio"
      >
        音频
      </n-button>
    </div>

    <p
      v-if="error"
      class="fp-error"
    >
      {{ error }}
    </p>

    <!-- 元信息 -->
    <div
      v-if="current"
      class="fp-meta"
    >
      <span class="fp-tag">{{ kindText }}</span>
      <span class="fp-name">{{ current.name }}</span>
      <span class="fp-info">{{ formatSize(current.size) }}</span>
      <span class="fp-info">{{ current.type || '未知 MIME' }}</span>
      <a
        v-if="current.url"
        class="fp-download"
        :href="current.url"
        :download="current.name"
      >
        下载
      </a>
    </div>

    <!-- 预览 -->
    <div
      v-if="current"
      class="fp-preview"
    >
      <img
        v-if="current.kind === 'image' && current.url"
        :src="current.url"
        :alt="current.name"
        class="fp-image"
      >

      <pre
        v-else-if="current.kind === 'text'"
        class="fp-text"
      >{{ current.text }}</pre>

      <iframe
        v-else-if="current.kind === 'pdf' && current.url"
        :src="current.url"
        :title="current.name"
        class="fp-pdf"
      />

      <audio
        v-else-if="current.kind === 'audio' && current.url"
        :src="current.url"
        controls
        class="fp-audio"
      />

      <video
        v-else-if="current.kind === 'video' && current.url"
        :src="current.url"
        controls
        class="fp-video"
      />

      <div
        v-else
        class="fp-unknown"
      >
        <p>浏览器无法直接预览该类型。</p>
        <p class="fp-unknown-sub">
          MIME：{{ current.type || '未知' }}
        </p>
      </div>
    </div>

    <p
      v-else
      class="fp-empty"
    >
      还没有选择文件。点上方按钮或选择示例，看不同类型如何分流预览。
    </p>

    <p class="fp-hint">
      核心就一句：<code>URL.createObjectURL(file)</code> 交给浏览器原生组件。
      文本用 <code>file.text()</code>；未知类型只给下载。
      切换文件时记得 <code>revokeObjectURL</code>，否则内存不释放。
    </p>
  </div>
</template>

<style scoped>
.fp-demo {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

/* ---------- 选择区 ---------- */

.fp-drop {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.1rem 0.8rem;
  border: 1.5px dashed var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  cursor: pointer;
  transition: border-color 0.16s, background-color 0.16s;

  &.dragging,
  &:hover {
    border-color: var(--primary);
    background-color: var(--primary-soft);
  }
}

.fp-drop-icon {
  font-size: 1.1rem;
  color: var(--primary);
}

.fp-drop-text {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.fp-input {
  display: none;
}

/* ---------- 示例 ---------- */

.fp-samples {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.fp-samples-label {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.fp-error {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--danger);
}

/* ---------- 元信息 ---------- */

.fp-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background-color: var(--code-bg);
}

.fp-tag {
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
  font-size: 0.8125rem;
  background-color: var(--primary);
  color: #fff;
}

.fp-name {
  font-size: 0.8125rem;
  color: var(--text);
  word-break: break-all;
}

.fp-info {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.fp-download {
  margin-left: auto;
  font-size: 0.8125rem;
  color: var(--primary);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

/* ---------- 预览 ---------- */

.fp-preview {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  overflow: hidden;
}

.fp-image {
  display: block;
  width: 100%;
  max-height: 260px;
  object-fit: contain;
  background-color: var(--code-bg);
}

.fp-text {
  margin: 0;
  padding: 0.6rem;
  max-height: 260px;
  overflow: auto;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  line-height: 1.7;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}

.fp-pdf {
  display: block;
  width: 100%;
  height: 300px;
  border: none;
}

.fp-audio {
  display: block;
  width: 100%;
  padding: 0.6rem;
}

.fp-video {
  display: block;
  width: 100%;
  max-height: 260px;
  background-color: #000;
}

.fp-unknown {
  padding: 1.4rem;
  text-align: center;
  font-size: 0.8125rem;
  color: var(--text-secondary);

  p {
    margin: 0;
  }
}

.fp-unknown-sub {
  margin-top: 0.3rem !important;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
}

.fp-empty {
  margin: 0;
  padding: 1.2rem;
  text-align: center;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  border: 1px dashed var(--border);
  border-radius: var(--radius-btn);
}

.fp-hint {
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
</style>
