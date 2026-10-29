// ============================================================
// 案例：抽屉侧滑与退出动画（drawer-slide）
// - 旧做法：点关闭直接移除节点，遮罩和面板「啪」地消失
// - 新做法：transform 滑出 + 遮罩透明度过渡，等 transitionend 再卸载
// - 指标：关闭后节点仍在文档中的帧数、面板过渡结束事件次数
// - 附带：Esc 关闭、点遮罩关闭、打开锁页面滚动、关闭归还焦点
// ============================================================
<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

/** 关闭方式：unmount = 直接移除（旧）/ transition = 等动画结束再移除（新） */
type DrawerMode = 'unmount' | 'transition'

interface MessageItem {
  title: string
  time: string
}

/** 抽屉里的示例消息 */
const MESSAGES: MessageItem[] = [
  { title: '周报已生成，等待你确认', time: '2 分钟前' },
  { title: '你关注的案例更新了代码注释', time: '18 分钟前' },
  { title: '本周新增 4 个动画案例', time: '1 小时前' },
  { title: '构建体积检查通过', time: '今天 09:20' },
  { title: '有一位同事回复了你的讨论', time: '昨天' },
]

const mode = ref<DrawerMode>('unmount')
/** 节点是否在文档中：决定抽屉与遮罩是否渲染 */
const visible = ref(false)
/** 是否处于打开位置：控制滑入 / 滑出与遮罩透明度 */
const shown = ref(false)
/** 是否正在关闭：防止重复触发、区分过渡结束的用途 */
const closing = ref(false)
/**
 * 是否模拟「系统开启了减少动态效果」
 * 为什么不用系统设置直接决定演示行为：演示本身就是动画教学，
 * 系统关掉动画后两种关闭方式会长得一模一样，案例就失去意义了
 */
const mockReduce = ref(false)
/** 系统当前是否真的开启了减少动态效果：只用来提示，不夺走演示 */
const systemReduce = ref(false)

/** 是否跳过过渡：旧做法 或 手动模拟减少动态效果 */
const instant = computed(() => mode.value === 'unmount' || mockReduce.value)

/** 本次关闭后，面板仍在文档中的帧数 */
const frames = ref(0)
/** 面板 transform 过渡结束事件累计次数（打开、关闭都算） */
const transitionEnds = ref(0)

/** 「打开抽屉」按钮实例：Naive 组件的真实 DOM 在 $el 上，焦点回归要用它 */
const triggerRef = ref<{ $el?: HTMLElement } | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const closeBtnRef = ref<HTMLButtonElement | null>(null)

/** 焦点回到触发按钮（Naive 按钮把原生 button 放在 $el 上） */
function focusTrigger(): void {
  triggerRef.value?.$el?.focus()
}

/** 打开前的 body overflow 原值：关闭时按原值还原 */
let prevOverflow = ''
/** 是否已经锁了页面滚动（避免重复还原别人的值） */
let locked = false

/** 帧计数循环的编号 */
let frameId = 0
/** 过渡结束事件的兜底计时器 */
let fallbackTimer = 0
/** 打开时等待两帧的两个编号（关闭时可取消） */
let openFrame1 = 0
let openFrame2 = 0
/** 系统「减少动态效果」的媒体查询对象：用来提示，不直接决定行为 */
let motionQuery: MediaQueryList | null = null

/** 面板节点状态文案 */
const nodeText = computed(() => (visible.value ? '在文档中' : '已移除'))

// ---------- 工具 ----------

/** 系统「减少动态效果」变化：只更新提示，演示行为仍由手动开关决定 */
function onMotionChange(event: MediaQueryListEvent): void {
  systemReduce.value = event.matches
}

/** 还原页面滚动：只在确实锁过的时候还原，避免覆盖页面原有值 */
function unlockScroll(): void {
  if (!locked) return
  document.body.style.overflow = prevOverflow
  locked = false
}

/** 取消打开时等待的两帧，防止关闭后又被旧回调打开 */
function cancelOpenFrames(): void {
  if (openFrame1) window.cancelAnimationFrame(openFrame1)
  if (openFrame2) window.cancelAnimationFrame(openFrame2)
  openFrame1 = 0
  openFrame2 = 0
}

/** 停止帧计数 */
function stopFrameWatch(): void {
  if (frameId) window.cancelAnimationFrame(frameId)
  frameId = 0
}

/**
 * 从关闭开始逐帧计数，直到面板节点离开文档
 * 这是「有没有等动画结束」最直接的证据：旧模式计数不动，新模式逐帧上涨
 */
function startFrameWatch(): void {
  stopFrameWatch()
  frames.value = 0

  const tick = (): void => {
    const stillInDocument = panelRef.value?.isConnected ?? false
    if (!stillInDocument) {
      frameId = 0
      return
    }
    frames.value++
    frameId = window.requestAnimationFrame(tick)
  }

  frameId = window.requestAnimationFrame(tick)
}

// ---------- 打开 / 关闭 ----------

/** 打开抽屉：先渲染节点，再在下一帧加上打开类，让过渡从屏外开始 */
async function openDrawer(): Promise<void> {
  if (visible.value) return
  closing.value = false
  visible.value = true
  shown.value = false

  //! 记录原值再锁滚动：关闭时必须还原成原值，而不是写死空字符串
  prevOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  locked = true
  document.addEventListener('keydown', onKeydown)

  await nextTick()
  closeBtnRef.value?.focus()

  // 旧模式与模拟减少动态效果：直接到位，不跑过渡
  if (instant.value) {
    shown.value = true
    return
  }

  // 先让初始位移（100%）生效一帧，再加打开类，过渡才会从屏外滑入
  openFrame1 = window.requestAnimationFrame(() => {
    openFrame1 = 0
    openFrame2 = window.requestAnimationFrame(() => {
      openFrame2 = 0
      shown.value = true
    })
  })
}

/** 请求关闭：旧模式立即卸载；新模式先滑出，等过渡结束再卸载 */
function requestClose(): void {
  if (!visible.value || closing.value) return
  closing.value = true
  cancelOpenFrames()

  if (instant.value) {
    startFrameWatch()
    void nextTick(() => {
      finalizeClose()
    })
    return
  }

  // 先记录面板是否真的处于打开位置：还在打开途中就没有退场可等
  const wasShown = shown.value
  //! 先移除打开类：面板滑出、遮罩变透明，节点暂时留在文档里
  shown.value = false

  if (!wasShown) {
    startFrameWatch()
    void nextTick(() => {
      finalizeClose()
    })
    return
  }

  startFrameWatch()

  // 兜底：万一过渡结束事件没送达（后台标签页被节流等），也要卸载
  fallbackTimer = window.setTimeout(() => {
    fallbackTimer = 0
    finalizeClose()
  }, 600)
}

/** 真正卸载：清计时器、解锁滚动、焦点还给触发按钮 */
function finalizeClose(): void {
  if (!visible.value) return
  window.clearTimeout(fallbackTimer)
  fallbackTimer = 0
  stopFrameWatch()

  visible.value = false
  shown.value = false
  closing.value = false

  document.removeEventListener('keydown', onKeydown)
  unlockScroll()
  focusTrigger()
}

/** 面板的过渡结束：只认面板自身的 transform，子元素冒泡上来的不算 */
function onPanelTransitionEnd(event: TransitionEvent): void {
  if (event.target !== event.currentTarget) return
  if (event.propertyName !== 'transform') return
  transitionEnds.value++
  // 打开结束时只计数；关闭结束才卸载
  if (closing.value) finalizeClose()
}

/** Esc 关闭：只在打开期间挂在文档上，关闭就移除 */
function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  event.preventDefault()
  requestClose()
}

// ---------- 模式切换与重置 ----------

/** 切换关闭方式：如果抽屉开着，先立即收起，避免状态残留 */
/** 切换关闭方式（n-radio-group 发出的是原始值，收窄后再用） */
function setMode(next: string | number | boolean | undefined): void {
  if (next !== 'unmount' && next !== 'transition') return
  if (mode.value === next) return
  if (visible.value) finalizeClose()
  mode.value = next
  frames.value = 0
  transitionEnds.value = 0
}

/** 切换「模拟减少动态效果」：抽屉开着就先收起，避免状态错位 */
function toggleMockReduce(): void {
  if (visible.value) finalizeClose()
  mockReduce.value = !mockReduce.value
  frames.value = 0
  transitionEnds.value = 0
}

/** 重置：立即卸载、清空全部计时器与计数 */
function resetAll(): void {
  const wasOpen = visible.value
  window.clearTimeout(fallbackTimer)
  fallbackTimer = 0
  cancelOpenFrames()
  stopFrameWatch()
  document.removeEventListener('keydown', onKeydown)

  visible.value = false
  shown.value = false
  closing.value = false
  unlockScroll()
  frames.value = 0
  transitionEnds.value = 0

  if (wasOpen) focusTrigger()
}

// ---------- 生命周期 ----------

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  systemReduce.value = motionQuery.matches
  motionQuery.addEventListener('change', onMotionChange)
})

onUnmounted(() => {
  window.clearTimeout(fallbackTimer)
  cancelOpenFrames()
  stopFrameWatch()
  document.removeEventListener('keydown', onKeydown)
  motionQuery?.removeEventListener('change', onMotionChange)
  motionQuery = null
  unlockScroll()
})
</script>

<template>
  <div class="dw-demo">
    <div class="bar">
      <!-- 互斥模式组：Naive 单选按钮组自带选中态与键盘操作 -->
      <n-radio-group
        class="modes"
        :value="mode"
        aria-label="关闭方式"
        @update:value="setMode"
      >
        <n-radio-button value="unmount">
          直接卸载（旧）
        </n-radio-button>
        <n-radio-button value="transition">
          等动画结束（推荐）
        </n-radio-button>
      </n-radio-group>
      <n-button
        ref="triggerRef"
        type="primary"
        ghost
        @click="openDrawer"
      >
        打开抽屉
      </n-button>
      <n-button
        :type="mockReduce ? 'warning' : 'default'"
        :ghost="mockReduce"
        :aria-pressed="mockReduce"
        @click="toggleMockReduce"
      >
        {{ mockReduce ? '模拟中：跳过动画' : '模拟减少动态效果' }}
      </n-button>
      <n-button @click="resetAll">
        重置
      </n-button>
    </div>

    <p
      v-if="systemReduce"
      class="system-note"
      role="status"
    >
      系统当前开启了「减少动态效果」。真实项目应当据此直接跳过动画；本案例为了让两种关闭方式的差别看得见，默认仍然播放，点「模拟减少动态效果」可以看跳过时的行为。
    </p>

    <div
      class="stats"
      aria-live="polite"
    >
      <span>关闭后仍在文档中的帧数 <b>{{ frames }}</b></span>
      <span>面板过渡结束事件 <b>{{ transitionEnds }}</b> 次</span>
      <span>面板节点 <b>{{ nodeText }}</b></span>
      <span>本次动画 <b>{{ instant ? '跳过' : '播放' }}</b></span>
    </div>

    <div class="page-card">
      <p>抽屉打开后，背景页面的滚动会被锁住；关闭后恢复原状，焦点也会回到「打开抽屉」。</p>
      <p class="page-tip">
        旧模式：点关闭后节点马上消失，帧数不动。新模式：面板滑出、遮罩淡出，过渡结束事件到达后才卸载。
      </p>
    </div>

    <!-- 抽屉挂到 body：避免被详情页容器的层叠上下文裁切；scoped 样式仍会生效 -->
    <Teleport to="body">
      <div
        v-if="visible"
        class="dw-mask"
        :class="{ shown, instant }"
        @click.self="requestClose"
      >
        <aside
          ref="panelRef"
          class="dw-panel"
          :class="{ shown, instant }"
          role="dialog"
          aria-modal="true"
          aria-labelledby="drawer-title"
          @transitionend="onPanelTransitionEnd"
        >
          <header class="dw-head">
            <h2 id="drawer-title">
              消息
            </h2>
            <button
              ref="closeBtnRef"
              class="dw-close"
              aria-label="关闭抽屉"
              @click="requestClose"
            >
              ✕
            </button>
          </header>

          <div class="dw-body">
            <p class="dw-tip">
              按 Esc、点遮罩、点右上角都能关闭。
            </p>
            <ul class="dw-list">
              <li
                v-for="item in MESSAGES"
                :key="item.title"
                class="dw-item"
              >
                <span class="dw-dot" />
                <div class="dw-item-text">
                  <p class="dw-item-title">
                    {{ item.title }}
                  </p>
                  <p class="dw-item-time">
                    {{ item.time }}
                  </p>
                </div>
              </li>
            </ul>
          </div>

          <footer class="dw-foot">
            <n-button @click="requestClose">
              关闭
            </n-button>
          </footer>
        </aside>
      </div>
    </Teleport>

    <p class="hint">
      先保持「直接卸载」点开再关闭：面板瞬间消失，帧数停在起点，遮罩也没有退场。
      切到「等动画结束」重复一次：面板向右滑出、遮罩淡出，帧数持续累加，过渡结束事件到达后才移除节点。
      点「模拟减少动态效果」会跳过过渡直接卸载，这也是真实项目在系统开启该设置时应该做的事。
    </p>
  </div>
</template>

<style scoped>
.dw-demo {
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
}

/* 系统设置提示：只有检测到「减少动态效果」时才出现 */
.system-note {
  margin: 0;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--warning);
  border-left-width: 3px;
  border-radius: var(--demo-radius);
  background-color: var(--code-bg);
  font-size: var(--demo-text-sm);
  line-height: 1.65;
  color: var(--text);
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

.page-card {
  padding: 0.65rem 0.8rem;
  border: 1px dashed var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--surface);

  p {
    margin: 0;
    font-size: var(--demo-text-sm);
    line-height: 1.7;
    color: var(--text);
  }
}

.page-card .page-tip {
  margin-top: 0.35rem;
  color: var(--text-secondary);
}

.hint {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}

/* ---------- 抽屉本体（Teleport 到 body，scoped 属性仍会带过去） ---------- */

.dw-mask {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  justify-content: flex-end;
  overflow: hidden;
  background-color: rgb(15 23 42 / 0.45);
  opacity: 0;
  transition: opacity 0.22s var(--ease-out);

  &.shown {
    opacity: 1;
  }

  /* 旧模式：没有过渡，点关闭直接消失 */
  &.instant {
    transition: none;
  }
}

.dw-panel {
  display: flex;
  flex-direction: column;
  width: min(320px, 86vw);
  height: 100%;
  border-left: 1px solid var(--border);
  background-color: var(--surface);
  box-shadow: -12px 0 30px rgb(0 0 0 / 0.18);
  transform: translateX(100%);
  transition: transform 0.24s var(--ease-out);

  &.shown {
    transform: translateX(0);
  }

  &.instant {
    transition: none;
  }
}

.dw-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 0.85rem;
  border-bottom: 1px solid var(--border);

  h2 {
    margin: 0;
    font-size: var(--demo-text-lg);
    color: var(--text);
  }
}

.dw-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: 50%;
  background: none;
  color: var(--text-secondary);
  font-size: var(--demo-text-md);
  cursor: pointer;

  &:hover {
    background-color: var(--code-bg);
    color: var(--text);
  }
}

.dw-body {
  flex: 1;
  overflow-y: auto;
  padding: 0.8rem;
}

.dw-tip {
  margin: 0 0 0.6rem;
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);
}

.dw-list {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dw-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg);
}

.dw-dot {
  width: 0.5rem;
  height: 0.5rem;
  margin-top: 0.35rem;
  flex-shrink: 0;
  border-radius: 50%;
  background-color: var(--primary);
}

.dw-item-text {
  min-width: 0;
}

.dw-item-title {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.5;
  color: var(--text);
}

.dw-item-time {
  margin: 0.15rem 0 0;
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.dw-foot {
  display: flex;
  justify-content: flex-end;
  padding: 0.7rem 0.85rem;
  border-top: 1px solid var(--border);
}

/*! 演示优先：系统开启「减少动态效果」时，站点全局规则会把过渡压到 0.01ms，
    而本案例正是要展示退场过渡，所以这里把时长还原。真实项目不要照抄这一段，
    应当像「模拟减少动态效果」打开时那样，直接跳过动画。 */
@media (prefers-reduced-motion: reduce) {
  .dw-mask {
    transition-duration: 0.22s !important;
  }

  .dw-panel {
    transition-duration: 0.24s !important;
  }
}

@media (max-width: 520px) {
  .modes {
    flex: 1 1 100%;
  }

  .mode {
    flex: 1;
  }
}
</style>
