// ============================================================
// 案例：折叠面板平滑展开（accordion-slide）
// - 旧做法：打开前读一次 scrollHeight，写成行内 height 再过渡
// - 新做法：grid-template-rows 从 0fr 过渡到 1fr，完全不读内容高度
// - 指标：累计读取 scrollHeight 的次数（旧每次打开加 1，新恒为 0）
// ============================================================
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

/** 展开方式：js = 读内容高度写行内高度（旧）/ grid = 0fr 到 1fr 过渡（新） */
type PanelMode = 'js' | 'grid'

interface FaqItem {
  id: string
  question: string
  /** 答案按段落存，方便展示长短不一的内容 */
  answer: string[]
}

/** 三条问答：第一条短、第二条长、第三条中等，用来暴露「按内容高度算动画」的问题 */
const FAQS: FaqItem[] = [
  {
    id: 'faq-1',
    question: '为什么 height: auto 不能做过渡？',
    answer: [
      '过渡需要两个明确的数值才能插值。auto 表示「由内容决定」，浏览器在过渡开始前拿不到终点数值，所以只能在开始帧与结束帧之间直接切换。',
      '结果就是没有中间过程：面板要么瞬间出现，要么瞬间消失，看起来像页面闪了一下。',
    ],
  },
  {
    id: 'faq-2',
    question: '不用脚本量高度，怎么知道内容有多高？',
    answer: [
      '旧写法每次展开都要读一次 scrollHeight：先把面板高度设成内容真实高度，下一帧再改成 0 或相反，才能让过渡有起点和终点。',
      '读 scrollHeight 会强制浏览器先结算布局，展开一条就要多一次布局计算；如果面板里有图片、字体还在加载，量到的值还会偏小，事后需要重新量。',
      '更麻烦的是内容会变：用户展开后又点了「查看更多」、窗口宽度变化导致换行，之前写死的行内高度就过期了，必须再量一次。',
      'grid 方案不关心内容有多高：0fr 到 1fr 的终点由网格自己算，内容变长也不会失效。',
    ],
  },
  {
    id: 'faq-3',
    question: 'grid 过渡在哪些场景不适用？',
    answer: [
      '需要兼容很老的浏览器时，grid-template-rows 的过渡可能不生效，此时要退回「量高度 + 行内样式」的方案。',
      '如果面板展开的同时还要做别的布局变化（比如把旁边的卡片挤开），仍然要关注整体布局成本，不能只看单块面板。',
    ],
  },
]

const mode = ref<PanelMode>('js')
/** 当前展开的条目：null 表示全部收起（同时只开一条） */
const openId = ref<string | null>(null)
/** 旧写法的行内高度表：单位 px，由脚本写入 */
const heights = reactive<Record<string, number>>({})
/** 累计读取 scrollHeight 的次数：这是两种方案最直接的成本差 */
const measureReads = ref(0)
/** 最近一次写入的行内高度，方便在面板上看到脚本确实动了手 */
const lastWrite = ref('—')

/** 当前方案每次展开需要几行「量高度」脚本：旧 1 行，新 0 行 */
const needMeasureLines = computed(() => (mode.value === 'js' ? 1 : 0))

/** 按 id 找面板节点：面板一直挂载，收起时高度为 0，仍可读 scrollHeight */
function getPanel(id: string): HTMLElement | null {
  return document.getElementById(`faq-panel-${id}`)
}

/** 开关一条问答：旧方案先量高度，新方案只改展开状态 */
function toggle(id: string): void {
  const isOpen = openId.value === id

  if (mode.value === 'grid') {
    // 新方案：状态一变，grid-template-rows 的过渡自己完成中间帧
    openId.value = isOpen ? null : id
    lastWrite.value = '无需写行内高度'
    return
  }

  // 旧方案：先把上一条收起（高度归零），再处理本条
  if (openId.value) heights[openId.value] = 0

  if (isOpen) {
    heights[id] = 0
    openId.value = null
    lastWrite.value = 'height: 0px（收起）'
    return
  }

  const panel = getPanel(id)
  //! 每打开一条都要读一次 scrollHeight：这一步会强制结算布局
  measureReads.value++
  const contentHeight = panel?.scrollHeight ?? 0

  //! 行内高度必须写成像素：height: auto 不参与过渡
  heights[id] = contentHeight
  openId.value = id
  lastWrite.value = `height: ${contentHeight}px`
}

/** 切换方案：先全部收起，清掉旧方案留下的行内高度与计数 */
function setMode(next: PanelMode): void {
  if (mode.value === next) return
  mode.value = next
  openId.value = null
  for (const key of Object.keys(heights)) delete heights[key]
  measureReads.value = 0
  lastWrite.value = '—'
}

/** 重置：全部收起并清零指标 */
function resetAll(): void {
  openId.value = null
  for (const key of Object.keys(heights)) delete heights[key]
  measureReads.value = 0
  lastWrite.value = '—'
}
</script>

<template>
  <div class="ac-demo">
    <div class="bar">
      <div
        class="modes"
        role="group"
        aria-label="展开方式"
      >
        <button
          class="mode"
          :class="{ active: mode === 'js' }"
          :aria-pressed="mode === 'js'"
          @click="setMode('js')"
        >
          脚本量高（旧）
        </button>
        <button
          class="mode"
          :class="{ active: mode === 'grid' }"
          :aria-pressed="mode === 'grid'"
          @click="setMode('grid')"
        >
          grid 过渡（推荐）
        </button>
      </div>
      <button
        class="btn ghost"
        @click="resetAll"
      >
        重置（全部收起）
      </button>
    </div>

    <div
      class="stats"
      aria-live="polite"
    >
      <span>读取 scrollHeight <b>{{ measureReads }}</b> 次</span>
      <span>每次展开需要的量高行数 <b>{{ needMeasureLines }}</b> 行</span>
      <span>最近写入 <b>{{ lastWrite }}</b></span>
    </div>

    <div class="faq">
      <section
        v-for="(item, index) in FAQS"
        :key="item.id"
        class="faq-item"
      >
        <h3 class="faq-title">
          <button
            :id="`faq-trigger-${item.id}`"
            class="faq-trigger"
            :aria-expanded="openId === item.id"
            :aria-controls="`faq-panel-${item.id}`"
            @click="toggle(item.id)"
          >
            <span class="faq-index">{{ index + 1 }}</span>
            <span class="faq-question">{{ item.question }}</span>
            <span
              class="faq-icon"
              :class="{ open: openId === item.id }"
              aria-hidden="true"
            >+</span>
          </button>
        </h3>

        <!--
          旧方案：行内 height 由脚本写入，overflow: hidden 负责裁切
          新方案：grid-template-rows 在 0fr 与 1fr 之间过渡，内层 overflow: hidden
        -->
        <div
          :id="`faq-panel-${item.id}`"
          class="faq-panel"
          :class="{
            'js-panel': mode === 'js',
            'grid-panel': mode === 'grid',
            open: mode === 'grid' && openId === item.id,
          }"
          :style="mode === 'js' ? { height: `${heights[item.id] ?? 0}px` } : undefined"
          role="region"
          :aria-labelledby="`faq-trigger-${item.id}`"
          :aria-hidden="openId !== item.id"
        >
          <div class="answer-wrap">
            <div class="faq-answer">
              <p
                v-for="(line, lineIndex) in item.answer"
                :key="lineIndex"
              >
                {{ line }}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>

    <p class="hint">
      旧方案展开任意一条，都会看到「读取 scrollHeight」加 1，最近写入里出现一个像素值；
      新方案把面板排成网格，行高从 0fr 过渡到 1fr，脚本一次高度都不用读。
      两条答案长度差很多，但新方案的展开时长完全一样；旧方案每次都要脚本先量出终点。
    </p>
  </div>
</template>

<style scoped>
.ac-demo {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.bar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.modes {
  display: inline-flex;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--code-bg);
}

.mode {
  padding: 0.4rem 0.65rem;
  border: none;
  border-radius: calc(var(--demo-radius) - 2px);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: var(--demo-text-sm);
  cursor: pointer;
  transition: background-color var(--transition), color var(--transition);

  &.active {
    background-color: var(--surface);
    color: var(--primary);
    box-shadow: var(--shadow-soft);
  }
}

.btn.ghost {
  padding: var(--demo-control-py) var(--demo-control-px);
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: var(--demo-text-md);
  cursor: pointer;
  transition: background-color var(--transition), color var(--transition);

  &:hover {
    background-color: var(--code-bg);
    color: var(--text);
  }
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.1rem;
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

/* ---------- 手风琴 ---------- */

.faq {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.faq-item {
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--surface);
  overflow: hidden;
}

.faq-title {
  margin: 0;
}

.faq-trigger {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.7rem 0.85rem;
  border: none;
  background-color: transparent;
  color: var(--text);
  font-size: var(--demo-text-md);
  text-align: left;
  cursor: pointer;

  &:hover {
    background-color: var(--code-bg);
  }
}

.faq-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  flex-shrink: 0;
  border-radius: 50%;
  background-color: var(--primary-soft);
  color: var(--primary-soft-text);
  font-family: var(--font-mono);
  font-size: var(--demo-text-xs);
}

.faq-question {
  flex: 1;
  min-width: 0;
}

.faq-icon {
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: 1.1rem;
  color: var(--text-secondary);
  transition: transform var(--transition), color var(--transition);

  &.open {
    color: var(--primary);
    transform: rotate(45deg);
  }
}

/* 面板本体：两种方案共用裁切，只是高度驱动方式不同 */
.faq-panel {
  overflow: hidden;
}

/* 旧方案：脚本写行内 height，过渡的终点是一个明确的像素值 */
.js-panel {
  transition: height 0.32s var(--ease-out);
}

/* 新方案：行从 0fr 长到 1fr，浏览器自己算内容高度 */
.grid-panel {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.32s var(--ease-out);

  &.open {
    grid-template-rows: 1fr;
  }

  /* 内层必须允许收缩，否则内容会把 0fr 的行撑开 */
  > .answer-wrap {
    min-height: 0;
    overflow: hidden;
  }
}

.faq-answer {
  padding: 0 0.9rem 0.85rem 2.95rem;

  p {
    margin: 0 0 0.45rem;
    font-size: var(--demo-text-sm);
    line-height: 1.7;
    color: var(--text-secondary);

    &:last-child {
      margin-bottom: 0;
    }
  }
}

.hint {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}

@media (max-width: 520px) {
  .modes {
    flex: 1 1 100%;
  }

  .mode {
    flex: 1;
  }

  .faq-answer {
    padding-left: 0.9rem;
  }
}
</style>
