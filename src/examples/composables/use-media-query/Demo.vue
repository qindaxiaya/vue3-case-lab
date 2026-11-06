// ============================================================
// 案例：useMediaQuery —— 断点判断交给浏览器（use-media-query）
// - 左边（旧）：window.resize + innerWidth，窗口每动一次就重读宽度、重比两档断点
// - 右边（推荐）：matchMedia，浏览器只在「匹配结果翻转」时回调一次
// - 同屏并排对照，计数全部来自真实事件（「模拟拖窗」按钮也是真派发 resize 事件）
// - 顺带暴露口径差异：innerWidth 含滚动条，媒体查询按不含滚动条的宽度算
// ============================================================
<script setup lang="ts">
import { computed, onMounted, onScopeDispose, onUnmounted, reactive, ref } from 'vue'
import type { Ref } from 'vue'

// ============================================================
// 断点定义
// ============================================================

/** 平板起点：≥ 768 视为不再是手机 */
const BP_TABLET = 768
/** 桌面起点：≥ 1024 视为桌面 */
const BP_DESKTOP = 1024

/** 三档断点：移动 / 平板 / 桌面 */
type Bp = 'mobile' | 'tablet' | 'desktop'

/** 断点顺序与展示文案（模板里遍历，避免三处硬编码） */
const BP_ITEMS: Array<{ key: Bp; label: string; range: string }> = [
  { key: 'mobile', label: '移动', range: '< 768' },
  { key: 'tablet', label: '平板', range: '768 ~ 1023' },
  { key: 'desktop', label: '桌面', range: '≥ 1024' },
]

/** 断点 key → 中文标签 */
function labelOf(bp: Bp): string {
  return BP_ITEMS.find((item) => item.key === bp)?.label ?? bp
}

// ============================================================
// 组合式函数：把一条媒体查询封装成响应式布尔值
// ============================================================

/**
 * 订阅一条媒体查询，结果变化时自动更新
 * @param query  媒体查询串，例如 '(min-width: 768px)'
 * @param onFlip 可选：结果翻转时通知调用方（本案例用来计数）
 * @returns 响应式布尔值：当前是否匹配
 */
function useMediaQuery(query: string, onFlip?: (matches: boolean) => void): Ref<boolean> {
  const matches = ref(false)

  //! 构建期 / 服务端渲染没有 window：直接返回恒 false，别让整个模块在导入时就崩
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return matches
  }

  const mql = window.matchMedia(query)
  // 初始值同步给出：否则首帧会先按 false 渲染一次，出现「明明是桌面却先闪一下移动」
  matches.value = mql.matches

  /**
   * 只在「匹配 / 不匹配」真正翻转时被调用
   * 窗口拖动过程中浏览器可能发几十次 resize，但这里只会收到跨越断点的那一两次
   */
  const handleChange = (event: MediaQueryListEvent): void => {
    matches.value = event.matches
    onFlip?.(event.matches)
  }
  mql.addEventListener('change', handleChange)

  //! 用 onScopeDispose 而不是 onUnmounted：组件卸载、effectScope.stop() 都会走到这里，
  //! 调用方永远不用记得「我注册过一条查询」
  onScopeDispose(() => {
    mql.removeEventListener('change', handleChange)
  })

  return matches
}

// ============================================================
// 两套写法的实时状态
// ============================================================

/** 视口宽度：inner 含经典滚动条，client 不含（媒体查询按后者判定） */
const viewport = reactive({ inner: 0, client: 0 })

// ---------- 左边：手写 resize ----------

/** 手写版：resize 回调次数 */
const manualCalls = ref(0)
/** 手写版：断点比较次数（每回调一次比两档） */
const manualChecks = ref(0)
/** 手写版判出的断点（按 innerWidth） */
const manualBp = ref<Bp>('desktop')

// ---------- 右边：useMediaQuery ----------

/** 封装版：change 回调次数 */
const queryCalls = ref(0)

//! 两条查询互不依赖，各自只在翻转时通知：这是「少量、精确」的来源
const mdUp = useMediaQuery(`(min-width: ${BP_TABLET}px)`, () => {
  queryCalls.value++
})
const lgUp = useMediaQuery(`(min-width: ${BP_DESKTOP}px)`, () => {
  queryCalls.value++
})

/** 封装版判出的断点：由两条查询拼出来，不需要自己读任何宽度 */
const queryBp = computed<Bp>(() => {
  if (!mdUp.value) return 'mobile'
  return lgUp.value ? 'desktop' : 'tablet'
})

/** 活跃监听器：手写 1 个 resize + 封装 2 个 change（离开页面自动解绑） */
const listenerCount = ref(0)

/**
 * 两种口径判出的断点不一致
 * 一般只发生在断点边界：手写版读的 innerWidth 把滚动条算进去了，媒体查询不算
 */
const bpMismatch = computed(() => manualBp.value !== queryBp.value)

// ============================================================
// 行为
// ============================================================

/** 读一次视口宽度并按 innerWidth 推断点（挂载与 resize 共用） */
function readViewport(): void {
  viewport.inner = window.innerWidth
  // documentElement.clientWidth 不含经典滚动条，与 @media 的判定口径一致
  viewport.client = document.documentElement.clientWidth
  manualBp.value =
    viewport.inner < BP_TABLET ? 'mobile' : viewport.inner < BP_DESKTOP ? 'tablet' : 'desktop'
}

/** 手写版：每次 resize 都重读宽度、重比两档断点 */
function onResize(): void {
  manualCalls.value++
  manualChecks.value += 2
  readViewport()
}

/**
 * 模拟一次窗口拖动：连发 30 个真实的 resize 事件（窗口宽度其实没变）
 * 手写版会老老实实重算 30 次；封装版因为没跨断点，一次回调都收不到
 */
function simulateDrag(): void {
  for (let i = 0; i < 30; i++) {
    window.dispatchEvent(new Event('resize'))
  }
}

/** 重置计数（断点状态不重置，它反映的是当前真实视口） */
function resetCounters(): void {
  manualCalls.value = 0
  manualChecks.value = 0
  queryCalls.value = 0
}

// ============================================================
// 生命周期
// ============================================================

onMounted(() => {
  // 首屏读一次：这是初始化，不计入「resize 回调次数」
  readViewport()
  window.addEventListener('resize', onResize, { passive: true })
  // 手写版 1 个 resize + 封装版 2 条媒体查询
  listenerCount.value = 3
})

onUnmounted(() => {
  // resize 需要手动解绑；两条媒体查询由 useMediaQuery 里的 onScopeDispose 负责
  window.removeEventListener('resize', onResize)
  listenerCount.value = 0
})
</script>

<template>
  <div class="umq-demo">
    <p class="hint">
      把浏览器窗口拖窄 / 拖宽，跨过 <b>768</b> 和 <b>1024</b> 两条线：左边每动一下就重算一遍，
      右边只在真正跨断点时收到一次回调。
    </p>

    <!-- 当前断点：三段指示，跟着媒体查询结果走 -->
    <div
      class="bp-bar"
      role="group"
      aria-label="当前断点（按媒体查询判定）"
    >
      <span
        v-for="item in BP_ITEMS"
        :key="item.key"
        class="bp-seg"
        :class="{ on: queryBp === item.key }"
      >
        {{ item.label }}
        <b>{{ item.range }}</b>
      </span>
    </div>

    <div class="stats">
      <span>当前断点 <b data-stat="bp">{{ labelOf(queryBp) }}</b></span>
      <span>
        视口 <b data-stat="inner">{{ viewport.inner }}</b> /
        内容 <b data-stat="client">{{ viewport.client }}</b> px
      </span>
      <span>活跃监听器 <b data-stat="listeners">{{ listenerCount }}</b> 个</span>
    </div>

    <div class="cols">
      <!-- 左边：手写版 -->
      <section class="col">
        <h3 class="col-title">
          手写 resize + innerWidth
        </h3>
        <p class="col-sub">
          每次缩放都自己读宽度、比两档
        </p>
        <dl class="nums">
          <div class="num">
            <dt>resize 回调</dt>
            <dd data-stat="manual-calls">
              {{ manualCalls }}
            </dd>
          </div>
          <div class="num">
            <dt>断点比较</dt>
            <dd data-stat="manual-checks">
              {{ manualChecks }}
            </dd>
          </div>
        </dl>
        <p class="verdict">
          判定 <b>{{ labelOf(manualBp) }}</b>（读 innerWidth {{ viewport.inner }}）
        </p>
      </section>

      <!-- 右边：封装版 -->
      <section class="col col--ok">
        <h3 class="col-title">
          useMediaQuery（matchMedia）
        </h3>
        <p class="col-sub">
          浏览器只在匹配结果翻转时通知
        </p>
        <dl class="nums">
          <div class="num">
            <dt>change 回调</dt>
            <dd data-stat="query-calls">
              {{ queryCalls }}
            </dd>
          </div>
          <div class="num">
            <dt>断点比较</dt>
            <dd data-stat="query-checks">
              0
            </dd>
          </div>
        </dl>
        <p class="verdict">
          判定 <b>{{ labelOf(queryBp) }}</b>（两条查询拼出来）
        </p>
        <p class="query-list">
          ≥768 {{ mdUp ? '匹配' : '不匹配' }} · ≥1024 {{ lgUp ? '匹配' : '不匹配' }}
        </p>
      </section>
    </div>

    <!-- 只在两种口径真的打架时出现：差的就是滚动条那十几像素 -->
    <p
      v-if="bpMismatch"
      class="warn"
      data-stat="mismatch"
    >
      两种口径判得不一样：手写版读 innerWidth（含滚动条）判「{{ labelOf(manualBp) }}」，
      媒体查询按不含滚动条的宽度判「{{ labelOf(queryBp) }}」。断点边界上就会差这一档。
    </p>

    <div class="actions">
      <n-button
        type="primary"
        @click="simulateDrag"
      >
        模拟拖窗 30 次
      </n-button>
      <n-button @click="resetCounters">
        重置计数
      </n-button>
    </div>

    <p class="footnote">
      「模拟拖窗」不改变窗口宽度、只连发 30 个真实 resize 事件：手写版会白算 30 次，
      封装版一次都不会被叫醒——这就是「只在跨断点时通知」的意思。
    </p>
  </div>
</template>

<style scoped>
.umq-demo {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.hint {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--text);
  }
}

/* ---------- 断点三段指示 ---------- */

.bp-bar {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.4rem;
}

.bp-seg {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: var(--demo-block-pad);
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);
  background-color: var(--bg);
  transition: border-color var(--transition), background-color var(--transition);

  b {
    font-family: var(--font-mono);
    font-size: var(--demo-text-xs);
    font-weight: 500;
    opacity: 0.8;
  }

  &.on {
    border-color: var(--primary);
    background-color: var(--primary-soft);
    color: var(--primary-soft-text);
    font-weight: 600;
  }
}

/* ---------- 指标行 ---------- */

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 1.1rem;
  font-size: var(--demo-text-md);
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

/* ---------- 两栏对照 ---------- */

.cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
}

.col {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: var(--demo-block-pad);
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg);
}

.col--ok {
  border-color: color-mix(in srgb, var(--primary) 45%, var(--border));
  background-color: color-mix(in srgb, var(--primary-soft) 55%, var(--bg));
}

.col-title {
  margin: 0;
  font-size: var(--demo-text-md);
  font-weight: 600;
  color: var(--text);
}

.col-sub {
  margin: 0;
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.nums {
  display: flex;
  gap: 1.4rem;
  margin: 0.15rem 0 0;
}

.num {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;

  dt {
    font-size: var(--demo-text-xs);
    color: var(--text-secondary);
  }

  dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.2;
    color: var(--text);
  }
}

/* 手写版的计数会飙得很快，用警告色提示「白算的」 */
.col:not(.col--ok) .num dd {
  color: var(--warning);
}

.col--ok .num dd {
  color: var(--success);
}

.verdict {
  margin: 0;
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);

  b {
    color: var(--text);
  }
}

.query-list {
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

/* ---------- 口径不一致提示 ---------- */

.warn {
  margin: 0;
  padding: var(--demo-block-pad);
  border: 1px solid color-mix(in srgb, var(--warning) 45%, var(--border));
  border-radius: var(--demo-radius);
  background-color: var(--warning-soft);
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text);
}

/* ---------- 操作与说明 ---------- */

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.footnote {
  margin: 0;
  font-size: var(--demo-text-xs);
  line-height: 1.7;
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .cols {
    grid-template-columns: 1fr;
  }

  .num dd {
    font-size: 1.25rem;
  }
}
</style>
