// ============================================================
// 案例：过渡组列表动画（transition-group）
// - 普通替换 vs 过渡组：同样打乱/增删，观察补位动画
// - 过渡组会记录旧位置、读取新位置，再给移动元素加 transform 过渡
// - 统计每次操作移动了几项、动画真正结束耗时
// ============================================================
<script setup lang="ts">
import { nextTick, ref } from 'vue'

interface Item {
  id: number
  label: string
  tone: number
}

/** 可见性模式：带动画 / 直接替换 */
type Mode = 'animated' | 'plain'

let nextId = 1
/** 初始 6 条任务，tone 控制左侧色条 */
function makeItem(): Item {
  const id = nextId++
  return { id, label: `任务 ${String(id).padStart(2, '0')}`, tone: id % 4 }
}

const initialItems: Item[] = Array.from({ length: 6 }, makeItem)
const items = ref<Item[]>(initialItems.map((item) => ({ ...item })))
const mode = ref<Mode>('animated')

/** 切换列表动画模式（n-radio-group 发出的是原始值，收窄成 Mode） */
function setMode(next: string | number | boolean | undefined): void {
  if (next !== 'plain' && next !== 'animated') return
  mode.value = next
}

const listWrap = ref<HTMLElement | null>(null)
const busy = ref(false)
const moved = ref(0)
const animations = ref(0)
const settleMs = ref<number | null>(null)

/** 记录当前列表每项的排版位置（offsetTop 不受过渡时的 transform 影响） */
function snapshot(): Map<number, number> {
  const positions = new Map<number, number>()
  // 排除离场中的元素：它们已脱离文档流，offsetTop 不再代表真实位置
  const nodes = listWrap.value?.querySelectorAll<HTMLElement>('[data-id]:not(.list-leave-active)') ?? []
  for (const node of nodes) {
    positions.set(Number(node.dataset.id), node.offsetTop)
  }
  return positions
}

/** 等最后一个移动元素的 transform 过渡结束（超时兜底，避免事件丢失卡死） */
function waitForMoves(count: number, startedAt: number): Promise<number> {
  return new Promise((resolve) => {
    const target = listWrap.value
    if (!target || count === 0) {
      resolve(performance.now() - startedAt)
      return
    }

    const finished = new Set<Element>()
    let timer = 0

    const cleanup = (): void => {
      target.removeEventListener('transitionend', onEnd)
      clearTimeout(timer)
    }
    const finish = (): void => {
      cleanup()
      resolve(performance.now() - startedAt)
    }
    const onEnd = (event: TransitionEvent): void => {
      // 只统计位移过渡；透明度等过渡不参与
      if (event.propertyName !== 'transform') return
      if (event.target instanceof Element) finished.add(event.target)
      if (finished.size >= count) finish()
    }

    target.addEventListener('transitionend', onEnd)
    timer = window.setTimeout(finish, 700)
  })
}

/** 执行一次列表变更，并统计移动项与动画耗时 */
async function apply(action: 'add' | 'shuffle' | 'remove'): Promise<void> {
  if (busy.value) return
  busy.value = true

  const before = snapshot()
  const startedAt = performance.now()

  if (action === 'add') {
    // 插到最前面，原有每一项都要让位，才能看到完整的位移动画
    items.value.unshift(makeItem())
  } else if (action === 'remove') {
    if (items.value.length > 1) items.value.shift()
  } else {
    const next = [...items.value]
    // Fisher-Yates 洗牌，保证每次打乱分布均匀
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = next[i]
      next[i] = next[j]
      next[j] = tmp
    }
    // 极小概率洗回原顺序，主动轮换一位，保证能看出变化
    if (next.every((item, index) => item.id === items.value[index]?.id)) {
      const first = next.shift()
      if (first) next.push(first)
    }
    items.value = next
  }

  await nextTick()

  const after = snapshot()
  let movedCount = 0
  for (const [id, top] of after) {
    const old = before.get(id)
    if (old === undefined) continue
    if (Math.abs(old - top) > 1) movedCount++
  }
  moved.value = movedCount

  if (mode.value === 'animated') {
    animations.value = movedCount
    settleMs.value = Math.round(await waitForMoves(movedCount, startedAt))
  } else {
    // 关闭动画时浏览器直接替换，没有过渡可等
    animations.value = 0
    settleMs.value = Math.round(performance.now() - startedAt)
  }

  busy.value = false
}

/** 恢复初始 6 条并清空统计 */
function reset(): void {
  nextId = 1
  items.value = initialItems.map((item) => ({ ...item }))
  moved.value = 0
  animations.value = 0
  settleMs.value = null
}
</script>

<template>
  <div class="tg-demo">
    <div class="bar">
      <!-- 互斥模式组：Naive 单选按钮组自带选中态与键盘操作 -->
      <n-radio-group
        class="modes"
        :value="mode"
        aria-label="列表动画模式"
        :disabled="busy"
        @update:value="setMode"
      >
        <n-radio-button value="plain">
          普通替换（无动画）
        </n-radio-button>
        <n-radio-button value="animated">
          过渡组（推荐）
        </n-radio-button>
      </n-radio-group>
      <n-button
        type="primary"
        :disabled="busy"
        @click="apply('shuffle')"
      >
        打乱顺序
      </n-button>
      <n-button
        type="primary"
        :disabled="busy"
        @click="apply('add')"
      >
        添加一条
      </n-button>
      <n-button
        :disabled="busy"
        @click="apply('remove')"
      >
        删除首条
      </n-button>
      <n-button
        :disabled="busy"
        @click="reset"
      >
        重置
      </n-button>
    </div>

    <div class="stats">
      <span>任务 <b>{{ items.length }}</b> 条</span>
      <span>本次移动 <b>{{ moved }}</b> 项</span>
      <span>动画元素 <b>{{ animations }}</b></span>
      <span>完成耗时 <b>{{ settleMs ?? '—' }}</b> ms</span>
      <span class="mode-tag">{{ mode === 'animated' ? '过渡组' : '普通替换' }}</span>
    </div>

    <div
      ref="listWrap"
      class="list-wrap"
    >
      <TransitionGroup
        tag="ul"
        name="list"
        class="list"
        :css="mode === 'animated'"
      >
        <li
          v-for="item in items"
          :key="item.id"
          :data-id="item.id"
          class="item"
          :class="`tone-${item.tone}`"
        >
          <span class="dot" />
          <span class="label">{{ item.label }}</span>
          <span class="tip">{{ mode === 'animated' ? '平滑补位' : '直接替换' }}</span>
        </li>
      </TransitionGroup>
    </div>

    <p class="hint">
      连续点「打乱顺序」对比：普通替换时整列瞬间跳位；过渡组会给每个移动的元素补
      350ms 位移动画，其他项自动让位。完成耗时是运行时真正等到的过渡结束时间。
    </p>
  </div>
</template>

<style scoped>
.tg-demo {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.bar {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
}

/* 模式组只留排列方式，其余观感交给 Naive 单选按钮 */
.modes {
  display: inline-flex;
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.1rem;
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

.mode-tag {
  margin-left: auto;
  padding: 0.05rem 0.45rem;
  border-radius: var(--radius-tag);
  background-color: var(--primary-soft);
  color: var(--primary);
  font-size: var(--demo-text-xs);
}

.list-wrap {
  min-height: 380px;
  padding: 0.8rem;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg);
}

.list {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0.8rem;
  border: 1px solid var(--border);
  border-left: 4px solid var(--item-color);
  border-radius: var(--demo-radius);
  background-color: var(--surface);
  font-size: var(--demo-text-md);
  color: var(--text);
  will-change: transform;
}

.tone-0 {
  --item-color: var(--primary);
}

.tone-1 {
  --item-color: var(--success);
}

.tone-2 {
  --item-color: var(--warning);
}

.tone-3 {
  --item-color: var(--danger);
}

.dot {
  width: 0.55rem;
  height: 0.55rem;
  flex-shrink: 0;
  border-radius: 50%;
  background-color: var(--item-color);
}

.label {
  font-family: var(--font-mono);
}

.tip {
  margin-left: auto;
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

/* 位移过渡：Vue 只负责在正确时机加/删类，补间交给 CSS */
.list-move,
.list-enter-active,
.list-leave-active {
  transition: transform 0.35s var(--ease-out), opacity 0.35s var(--ease-out);
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(24px);
}

/* 离场元素脱离文档流，剩下的项才能立刻开始补位 */
.list-leave-active {
  position: absolute;
  left: 0;
  right: 0;
}

.hint {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}

@media (max-width: 640px) {
  .bar {
    gap: 0.45rem;
  }

  .mode {
    padding: 0.35rem 0.5rem;
  }

  .tip {
    display: none;
  }

  .mode-tag {
    margin-left: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .list-move,
  .list-enter-active,
  .list-leave-active {
    transition-duration: 0.01ms;
  }
}
</style>
