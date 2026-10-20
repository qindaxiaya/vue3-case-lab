// ============================================================
// 案例：取色器（color-picker）
// - 饱和度/亮度二维面板 + 色相条（拖动取色，纯 CSS 渐变绘制，零 canvas 重绘）
// - HEX / RGB / HSL 三格式展示，点击一键复制
// - 原生 EyeDropper 吸管（浏览器支持时出现，屏幕任意位置吸色）
// - 最近使用色板（自动去重保留 8 个）
// ============================================================
<script setup lang="ts">
import { computed, ref } from 'vue'

// ============================================================
// 颜色状态（HSV 模型：与 UI 面板一一对应）
// ============================================================

/** 色相 0~360 */
const h = ref(238)
/** 饱和度 0~100 */
const s = ref(72)
/** 亮度 0~100 */
const v = ref(88)

// ============================================================
// 颜色转换工具
// ============================================================

/** HSV → RGB（h:0~360, s/v:0~100 → r/g/b:0~255） */
function hsvToRgb(hh: number, ss: number, vv: number): { r: number; g: number; b: number } {
  const s1 = ss / 100
  const v1 = vv / 100
  const c = v1 * s1
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1))
  const m = v1 - c
  let r = 0
  let g = 0
  let b = 0
  if (hh < 60) [r, g] = [c, x]
  else if (hh < 120) [r, g] = [x, c]
  else if (hh < 180) [g, b] = [c, x]
  else if (hh < 240) [g, b] = [x, c]
  else if (hh < 300) [r, b] = [x, c]
  else [r, b] = [c, x]
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  }
}

/** RGB → HEX（#rrggbb） */
function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => n.toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

/** RGB → HSL（用于展示） */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const r1 = r / 255
  const g1 = g / 255
  const b1 = b / 255
  const max = Math.max(r1, g1, b1)
  const min = Math.min(r1, g1, b1)
  const l = (max + min) / 2
  const d = max - min
  let hh = 0
  let ss = 0
  if (d !== 0) {
    ss = d / (1 - Math.abs(2 * l - 1))
    if (max === r1) hh = ((g1 - b1) / d) % 6
    else if (max === g1) hh = (b1 - r1) / d + 2
    else hh = (r1 - g1) / d + 4
    hh = Math.round(hh * 60)
    if (hh < 0) hh += 360
  }
  return { h: hh, s: Math.round(ss * 100), l: Math.round(l * 100) }
}

// ============================================================
// 派生颜色文本
// ============================================================

const rgb = computed(() => hsvToRgb(h.value, s.value, v.value))
const hex = computed(() => rgbToHex(rgb.value.r, rgb.value.g, rgb.value.b))
const rgbText = computed(() => `rgb(${rgb.value.r}, ${rgb.value.g}, ${rgb.value.b})`)
const hsl = computed(() => {
  const o = rgbToHsl(rgb.value.r, rgb.value.g, rgb.value.b)
  return `hsl(${o.h}, ${o.s}%, ${o.l}%)`
})

/** 当前色相纯色（面板底色） */
const hueColor = computed(() => `hsl(${h.value}, 100%, 50%)`)

// ============================================================
// 二维面板拖动（饱和度 x 轴 / 亮度 y 轴）
// ============================================================

const panel = ref<HTMLElement | null>(null)
let panelDragging = false

/** 依据点击/拖动位置换算 s/v */
function updateFromPanel(e: PointerEvent): void {
  const rect = panel.value?.getBoundingClientRect()
  if (!rect) return
  const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width)
  const y = Math.min(Math.max(e.clientY - rect.top, 0), rect.height)
  s.value = Math.round((x / rect.width) * 100)
  v.value = Math.round((1 - y / rect.height) * 100)
}

function onPanelDown(e: PointerEvent): void {
  panelDragging = true
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  updateFromPanel(e)
}

function onPanelMove(e: PointerEvent): void {
  if (panelDragging) updateFromPanel(e)
}

function onPanelUp(): void {
  panelDragging = false
  pushRecent()
}

/** 游标位置（百分比） */
const cursorStyle = computed(() => ({
  left: `${s.value}%`,
  top: `${100 - v.value}%`,
}))

// ============================================================
// 色相条拖动
// ============================================================

const hueBar = ref<HTMLElement | null>(null)
let hueDragging = false

function updateHue(e: PointerEvent): void {
  const rect = hueBar.value?.getBoundingClientRect()
  if (!rect) return
  const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width)
  h.value = Math.round((x / rect.width) * 360)
}

function onHueDown(e: PointerEvent): void {
  hueDragging = true
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  updateHue(e)
}

function onHueMove(e: PointerEvent): void {
  if (hueDragging) updateHue(e)
}

function onHueUp(): void {
  hueDragging = false
  pushRecent()
}

// ============================================================
// 复制与最近色板
// ============================================================

/** 最近使用（去重，最新在左，最多 8 个） */
const recent = ref<string[]>([])

function pushRecent(): void {
  const c = hex.value
  recent.value = [c, ...recent.value.filter((x) => x !== c)].slice(0, 8)
}

/** 复制反馈 */
const copiedLabel = ref('')

function copy(value: string, label: string): void {
  void navigator.clipboard
    .writeText(value)
    .then(() => {
      copiedLabel.value = label
      window.setTimeout(() => {
        if (copiedLabel.value === label) copiedLabel.value = ''
      }, 1400)
    })
    .catch(() => {
      copiedLabel.value = '复制失败'
    })
}

// ============================================================
// 原生吸管（EyeDropper API，支持的浏览器才显示）
// ============================================================

/** EyeDropper 的最小类型声明（lib.dom 尚未内置） */
interface EyeDropperResult {
  sRGBHex: string
}
interface EyeDropperCtor {
  new (): { open: () => Promise<EyeDropperResult> }
}

const hasEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window

async function pickWithEyeDropper(): Promise<void> {
  const ctor = (window as unknown as { EyeDropper: EyeDropperCtor }).EyeDropper
  try {
    const result = await new ctor().open()
    // 吸到的是 HEX：转回 HSV 驱动面板
    applyHex(result.sRGBHex)
    pushRecent()
  } catch {
    // 用户按 Esc 取消：静默忽略
  }
}

/** HEX → HSV（面板回填用） */
function applyHex(hexStr: string): void {
  const m = /^#?([0-9a-f]{6})$/i.exec(hexStr)
  if (!m) return
  const num = parseInt(m[1], 16)
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255

  const r1 = r / 255
  const g1 = g / 255
  const b1 = b / 255
  const max = Math.max(r1, g1, b1)
  const min = Math.min(r1, g1, b1)
  const d = max - min
  const vv = max
  const ss = max === 0 ? 0 : d / max

  let hh = 0
  if (d !== 0) {
    if (max === r1) hh = ((g1 - b1) / d) % 6
    else if (max === g1) hh = (b1 - r1) / d + 2
    else hh = (r1 - g1) / d + 4
    hh *= 60
    if (hh < 0) hh += 360
  }
  h.value = Math.round(hh)
  s.value = Math.round(ss * 100)
  v.value = Math.round(vv * 100)
}
</script>

<template>
  <div class="cpk-demo">
    <!-- 预览大色块 -->
    <div
      class="preview"
      :style="{ backgroundColor: hex }"
    >
      <span
        class="preview-hex"
        :style="{ color: v > 55 ? '#111' : '#fff' }"
      >{{ hex }}</span>
    </div>

    <div class="body">
      <!-- 取色面板 -->
      <div class="picker-col">
        <!-- 饱和度/亮度二维面板：CSS 三层渐变叠加 -->
        <div
          ref="panel"
          class="sv-panel"
          :style="{ backgroundColor: hueColor }"
          @pointerdown="onPanelDown"
          @pointermove="onPanelMove"
          @pointerup="onPanelUp"
        >
          <span
            class="sv-cursor"
            :style="cursorStyle"
            aria-hidden="true"
          />
        </div>

        <!-- 色相条 -->
        <div
          ref="hueBar"
          class="hue-bar"
          @pointerdown="onHueDown"
          @pointermove="onHueMove"
          @pointerup="onHueUp"
        >
          <span
            class="hue-cursor"
            :style="{ left: `${(h / 360) * 100}%` }"
            aria-hidden="true"
          />
        </div>

        <!-- 操作行 -->
        <div class="actions">
          <button
            v-if="hasEyeDropper"
            class="btn-act"
            @click="pickWithEyeDropper"
          >
            屏幕吸管取色
          </button>
          <button
            class="btn-act"
            @click="copy(hex, 'HEX')"
          >
            复制 HEX
          </button>
        </div>
        <p
          v-if="!hasEyeDropper"
          class="eye-note"
        >
          当前浏览器不支持 EyeDropper（Chrome/Edge 可用），吸管按钮已隐藏。
        </p>
      </div>

      <!-- 数值面板 -->
      <div class="values">
        <button
          class="value-row"
          type="button"
          @click="copy(hex, 'HEX')"
        >
          <span class="value-label">HEX</span>
          <code class="value-text">{{ hex }}</code>
        </button>
        <button
          class="value-row"
          type="button"
          @click="copy(rgbText, 'RGB')"
        >
          <span class="value-label">RGB</span>
          <code class="value-text">{{ rgbText }}</code>
        </button>
        <button
          class="value-row"
          type="button"
          @click="copy(hsl, 'HSL')"
        >
          <span class="value-label">HSL</span>
          <code class="value-text">{{ hsl }}</code>
        </button>
        <p class="value-hint">
          点击任意一行复制
        </p>
        <p
          class="copied"
          aria-live="polite"
        >
          {{ copiedLabel ? `已复制 ${copiedLabel}` : '' }}
        </p>

        <!-- 最近使用 -->
        <div class="recent">
          <p class="recent-title">
            最近使用
          </p>
          <div class="recent-swatches">
            <button
              v-for="c in recent"
              :key="c"
              class="swatch"
              :style="{ backgroundColor: c }"
              :title="c"
              :aria-label="`使用颜色 ${c}`"
              @click="applyHex(c)"
            />
            <span
              v-if="recent.length === 0"
              class="recent-empty"
            >拖动面板或吸管取色后记录</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpk-demo {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

/* ---------- 预览 ---------- */

.preview {
  height: 72px;
  border-radius: var(--radius-btn);
  border: 1px solid var(--border);
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 0.55rem 0.8rem;
  transition: background-color 0.12s linear;
}

.preview-hex {
  font-family: var(--font-mono);
  font-size: 0.9375rem;
  font-weight: 600;
}

/* ---------- 布局 ---------- */

.body {
  display: grid;
  grid-template-columns: 1fr 260px;
  gap: 0.75rem;
}

.picker-col {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

/* ---------- 二维面板（三层渐变叠加出 HSV 空间） ---------- */

.sv-panel {
  position: relative;
  height: 220px;
  border-radius: var(--radius-btn);
  cursor: crosshair;
  overflow: hidden;
  touch-action: none;
  user-select: none;
  /* 第一层：白→透明（饱和度）；第二层：透明→黑（亮度） */
  background-image:
    linear-gradient(to top, #000, transparent),
    linear-gradient(to right, #fff, transparent);

  /* 底色来自内联 style 的 hueColor */
}

.sv-cursor {
  position: absolute;
  width: 14px;
  height: 14px;
  margin: -7px 0 0 -7px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 0.5);
  pointer-events: none;
}

/* ---------- 色相条 ---------- */

.hue-bar {
  position: relative;
  height: 16px;
  border-radius: 999px;
  cursor: ew-resize;
  touch-action: none;
  background: linear-gradient(
    to right,
    #f00 0%,
    #ff0 17%,
    #0f0 33%,
    #0ff 50%,
    #00f 67%,
    #f0f 83%,
    #f00 100%
  );
}

.hue-cursor {
  position: absolute;
  top: 50%;
  width: 14px;
  height: 14px;
  margin-left: -7px;
  transform: translateY(-50%);
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 0.5);
  pointer-events: none;
}

/* ---------- 操作 ---------- */

.actions {
  display: flex;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.btn-act {
  padding: 0.3rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--primary);
  background-color: transparent;
  color: var(--primary);
  font-size: 0.875rem;
  cursor: pointer;

  &:hover {
    background-color: var(--primary);
    color: #fff;
  }
}

.eye-note {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

/* ---------- 数值面板 ---------- */

.values {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  padding: 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.value-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 0.4rem 0.55rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background-color: var(--code-bg);
  cursor: pointer;
  text-align: left;

  &:hover {
    border-color: var(--primary);
  }
}

.value-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.value-text {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--text);
}

.value-hint {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.copied {
  margin: 0;
  min-height: 1.2em;
  font-size: 0.8125rem;
  color: var(--success);
}

/* ---------- 最近使用 ---------- */

.recent {
  margin-top: 0.3rem;
  border-top: 1px solid var(--border);
  padding-top: 0.5rem;
}

.recent-title {
  margin: 0 0 0.35rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.recent-swatches {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
}

.swatch {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  border: 1px solid rgb(0 0 0 / 0.15);
  cursor: pointer;
  padding: 0;

  &:hover {
    transform: scale(1.08);
  }
}

.recent-empty {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .body {
    grid-template-columns: 1fr;
  }
}
</style>
