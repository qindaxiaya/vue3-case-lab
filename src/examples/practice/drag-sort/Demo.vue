// ============================================================
// 案例：指针拖拽排序（drag-sort）
// Pointer 拖拽 + 目标位高亮 + 松手后 splice 移动 + FLIP 动画：
// 移动前记录所有行位置，移动后用 WAAPI 从旧位置滑到新位置。
// ============================================================
<script setup lang="ts">
import { nextTick, ref } from 'vue'

interface Item {
  id: number
  label: string
  tone: string
}

const TONES = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed']

const items = ref<Item[]>(
  Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    label: `任务 #${i + 1}：拖拽我调整优先级`,
    tone: TONES[i % TONES.length],
  })),
)

const listEl = ref<HTMLElement | null>(null)

/** 正在拖的行下标 / 目标下标 */
const dragIndex = ref(-1)
const overIndex = ref(-1)
/** 拖拽位移 */
const dragY = ref(0)
/** 行高（含 gap），用于计算目标位置 */
const ROW = 50

let startY = 0
let moved = false

// ============================================================
// 拖拽
// ============================================================

function onPointerDown(e: PointerEvent, index: number): void {
  // 只响应主键
  if (e.button !== 0) return
  dragIndex.value = index
  overIndex.value = index
  dragY.value = 0
  startY = e.clientY
  moved = false
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent): void {
  if (dragIndex.value < 0) return
  dragY.value = e.clientY - startY

  //! 按「位移 / 行高」四舍五入得到应该插入的位置
  const target = dragIndex.value + Math.round(dragY.value / ROW)
  overIndex.value = Math.max(0, Math.min(items.value.length - 1, target))

  if (Math.abs(dragY.value) > 4) moved = true
}

async function onPointerUp(): Promise<void> {
  if (dragIndex.value < 0) return
  const from = dragIndex.value
  const to = overIndex.value

  dragIndex.value = -1
  overIndex.value = -1
  dragY.value = 0

  if (!moved || to < 0 || to === from) return

  //! FLIP 第一步：记录移动前每一行的位置
  const prevTop = new Map<number, DOMRect>()
  listEl.value?.querySelectorAll<HTMLElement>('[data-id]').forEach((el) => {
    prevTop.set(Number(el.dataset.id), el.getBoundingClientRect())
  })

  //! 第二步：真正移动数据
  const [movedItem] = items.value.splice(from, 1)
  items.value.splice(to, 0, movedItem)
  await nextTick()

  //! 第三步：计算新旧位置差，用反向位移做动画（Invert + Play）
  listEl.value?.querySelectorAll<HTMLElement>('[data-id]').forEach((el) => {
    const id = Number(el.dataset.id)
    const prev = prevTop.get(id)
    if (!prev) return

    const dx = prev.left - el.getBoundingClientRect().left
    const dy = prev.top - el.getBoundingClientRect().top
    if (!dx && !dy) return

    el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: 'translate(0, 0)' },
      ],
      { duration: 220, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
    )
  })
}

function shuffle(): void {
  const copy = [...items.value]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  items.value = copy
}

function reset(): void {
  items.value = Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    label: `任务 #${i + 1}：拖拽我调整优先级`,
    tone: TONES[i % TONES.length],
  }))
}

const orderText = (): string => items.value.map((item) => item.id).join(' → ')
</script>

<template>
  <div class="ds-demo">
    <div class="ds-bar">
      <span class="ds-stat">顺序：<b>{{ orderText() }}</b></span>
      <n-button
        @click="shuffle"
      >
        打乱
      </n-button>
      <n-button
        @click="reset"
      >
        重置
      </n-button>
    </div>

    <div
      ref="listEl"
      class="ds-list"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <div
        v-for="(item, index) in items"
        :key="item.id"
        :data-id="item.id"
        class="ds-item"
        :class="{
          dragging: dragIndex === index,
          target: overIndex === index && dragIndex >= 0 && dragIndex !== index,
        }"
        :style="{
          transform: dragIndex === index ? `translateY(${dragY}px)` : undefined,
          zIndex: dragIndex === index ? 2 : 1,
        }"
        @pointerdown="onPointerDown($event, index)"
      >
        <span
          class="ds-handle"
          aria-hidden="true"
        >⋮⋮</span>
        <span
          class="ds-dot"
          :style="{ backgroundColor: item.tone }"
        />
        <span class="ds-label">{{ item.label }}</span>
        <span class="ds-index">{{ index + 1 }}</span>
      </div>
    </div>

    <p class="ds-hint">
      按住任意行上下拖动（鼠标 / 触屏均可），松手后落到目标位置。
      松手时用 FLIP 让其他行从旧位置滑到新位置：记录 rect → 改数据 → 反向 transform → 播放。
    </p>
  </div>
</template>

<style scoped>
.ds-demo {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ds-bar {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.ds-stat {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--text-secondary);
  flex: 1;
  min-width: 10rem;

  b {
    color: var(--primary);
  }
}

/* ---------- 列表 ---------- */

.ds-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  touch-action: none;
  user-select: none;
}

.ds-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 44px;
  padding: 0 0.6rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background-color: var(--bg);
  cursor: grab;
  transition: border-color 0.15s, box-shadow 0.15s;

  &.dragging {
    cursor: grabbing;
    border-color: var(--primary);
    box-shadow: 0 8px 20px rgb(0 0 0 / 0.16);
    transition: none;
  }

  &.target {
    border-color: var(--primary);
    border-style: dashed;
  }
}

.ds-handle {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  letter-spacing: -2px;
}

.ds-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ds-label {
  font-size: 0.8125rem;
  color: var(--text);
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.ds-index {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.ds-hint {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.6;
}
</style>
