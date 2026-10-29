// ============================================================
// 案例：磁性按钮：指针跟随微交互（magnetic-button）
// - 旧做法：只在 hover 时换背景，指针怎么移动都没有空间反馈
// - 新做法：pointermove 算出指针相对按钮中心的偏移，按强度写 CSS 变量，
//   按钮用 transform: translate() 轻微跟随；离开磁力范围缓动回弹
// - 指标：指针移动时的实际位移（旧恒为 0px）、几何读取次数、跟随次数
// - 触摸设备（指针类型不是鼠标）不跟随
// - 减少动态效果：真实项目应直接不跟随；本案例为了让跟随看得见仍然跟随，
//   可用开关查看降级行为
// ============================================================
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

/** 跟随开关：off = 只换背景（旧）/ on = 指针跟随（新） */
type FollowMode = 'off' | 'on'

/** 跟随强度：factor 是位移系数，max 是最大位移（px），两者一起限制手感 */
type StrengthKey = 'weak' | 'medium' | 'strong'

interface StrengthOption {
  key: StrengthKey
  label: string
  /** 指针偏离按钮中心多少，按钮跟多少（0.12 = 跟 12%） */
  factor: number
  /** 单轴最大位移，避免指针离得很远时按钮被甩出磁力范围 */
  max: number
}

/** 三档强度：弱适合大面积卡片，强适合小图标按钮 */
const STRENGTHS: StrengthOption[] = [
  { key: 'weak', label: '弱', factor: 0.12, max: 4 },
  { key: 'medium', label: '中', factor: 0.24, max: 8 },
  { key: 'strong', label: '强', factor: 0.4, max: 14 },
]

const mode = ref<FollowMode>('off')
const strength = ref<StrengthKey>('medium')

/** 当前实际位移：单位 px，保留 1 位小数，直接写进 CSS 变量 */
const offset = ref({ x: 0, y: 0 })
/** 这一轮指针移动产生的跟随次数：旧模式永远是 0 */
const followCount = ref(0)
/** 读取按钮矩形的次数：每次 pointermove 读一次 getBoundingClientRect */
const geoReads = ref(0)
/** 本轮出现过的最大单轴位移，用来验证强度上限确实生效 */
const maxSeen = ref(0)
/** 非鼠标指针（手指、触控笔）被跳过的次数 */
const touchSkipped = ref(0)

/** 是否处于回弹阶段：只有回弹才给 transform 加过渡，跟随时要跟手 */
const returning = ref(false)
/**
 * 是否模拟「系统开启了减少动态效果」
 * 为什么不用系统设置直接决定演示行为：跟随位移就是本案例的全部内容，
 * 系统关掉动画后指针怎么移按钮都不动，案例就没什么可演示的了
 */
const mockReduce = ref(false)
/** 系统当前是否真的开启了减少动态效果：只用来提示，不夺走演示 */
const systemReduce = ref(false)

const buttonRef = ref<HTMLButtonElement | null>(null)

/** 动态效果偏好的媒体查询对象（只用于提示，卸载时移除监听） */
let motionQuery: MediaQueryList | null = null

/** 当前强度配置：find 找不到时回退到「中」，保证一定拿到完整对象 */
const currentStrength = computed<StrengthOption>(() => {
  return STRENGTHS.find((item) => item.key === strength.value) ?? STRENGTHS[1]!
})

/** 位移读数文案：旧模式位移恒为 0，读数也就没有变化 */
const offsetText = computed(() => `${offset.value.x}px / ${offset.value.y}px`)

/** 把数值夹到 ±max 之间：指针可能跑到按钮外很远，不夹会甩飞 */
function clamp(value: number, max: number): number {
  return Math.min(max, Math.max(-max, value))
}

/** 保留 1 位小数：读数别出现一长串浮点尾数 */
function round1(value: number): number {
  return Math.round(value * 10) / 10
}

// ---------- 指针跟随 ----------

/**
 * 指针在磁力范围内移动：算偏移 → 夹取 → 写 CSS 变量
 * 位移交给 transform，只改变合成层，不触发布局
 */
function onPointerMove(event: PointerEvent): void {
  // 旧模式不做任何计算：指针怎么动，按钮都停在原地
  if (mode.value !== 'on') return

  // 模拟降级：不做跟随，直接返回（真实项目在系统开启该设置时也应如此）
  if (mockReduce.value) return

  //! 触摸设备不跟随：手指按住时按钮乱动会让人以为点错了地方
  if (event.pointerType !== 'mouse') {
    touchSkipped.value++
    return
  }

  const button = buttonRef.value
  if (!button) return

  //! 几何读取放在 pointermove 里：位置每次移动都会变，缓存反而会错
  geoReads.value++
  const rect = button.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2

  // 指针相对按钮中心的偏移，乘以强度系数后再夹取上限
  const { factor, max } = currentStrength.value
  const nextX = round1(clamp((event.clientX - centerX) * factor, max))
  const nextY = round1(clamp((event.clientY - centerY) * factor, max))

  // 跟随时必须先关掉回弹过渡，否则按钮会追着指针「慢半拍」
  returning.value = false
  offset.value = { x: nextX, y: nextY }
  followCount.value++
  maxSeen.value = Math.max(
    maxSeen.value,
    round1(Math.abs(nextX)),
    round1(Math.abs(nextY)),
  )
}

/** 指针离开磁力范围：打开回弹过渡，把位移归零让按钮自己滑回中心 */
function onPointerLeave(): void {
  if (mode.value !== 'on') return

  // 模拟降级下没有位移可回弹，保持原位、也不打开过渡
  if (mockReduce.value) {
    returning.value = false
    offset.value = { x: 0, y: 0 }
    return
  }

  //! 回弹靠过渡完成：脚本只写 0，中间帧交给浏览器
  returning.value = true
  offset.value = { x: 0, y: 0 }
}

// ---------- 模式切换与重置 ----------

/** 切换模式：换模式时先把位移与回弹状态复位，避免上一种模式的残留 */
/** 切换跟随开关（n-radio-group 发出的是原始值，收窄后再用）：先归零，避免残留位移 */
function setMode(next: string | number | boolean | undefined): void {
  if (next !== 'off' && next !== 'on') return
  if (mode.value === next) return
  mode.value = next
  returning.value = false
  offset.value = { x: 0, y: 0 }
}

/** 切换强度（n-radio-group 发出的是原始值，收窄后再用）：同样先归零，避免从「强」切到「弱」时位移还停在上限 */
function setStrength(next: string | number | boolean | undefined): void {
  if (next !== 'weak' && next !== 'medium' && next !== 'strong') return
  strength.value = next
  offset.value = { x: 0, y: 0 }
  returning.value = false
  maxSeen.value = 0
}

/** 重置：回到初始的「只换背景 + 中强度」，所有计数清零 */
function resetAll(): void {
  mode.value = 'off'
  strength.value = 'medium'
  offset.value = { x: 0, y: 0 }
  followCount.value = 0
  geoReads.value = 0
  maxSeen.value = 0
  touchSkipped.value = 0
  returning.value = false
}

/** 切换「模拟减少动态效果」：位移与回弹状态复位，计数清零便于重新对比 */
function toggleMockReduce(): void {
  mockReduce.value = !mockReduce.value
  returning.value = false
  offset.value = { x: 0, y: 0 }
  followCount.value = 0
  geoReads.value = 0
  maxSeen.value = 0
  touchSkipped.value = 0
}

/** 系统「减少动态效果」变化：只更新提示，演示行为仍由手动开关决定 */
function onMotionChange(event: MediaQueryListEvent): void {
  systemReduce.value = event.matches
}

// ---------- 生命周期 ----------

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  systemReduce.value = motionQuery.matches
  motionQuery.addEventListener('change', onMotionChange)
})

onUnmounted(() => {
  // 模板上的指针监听会随组件卸载自动移除；这里只需要摘掉媒体查询监听
  motionQuery?.removeEventListener('change', onMotionChange)
  motionQuery = null
})
</script>

<template>
  <div class="mag-demo">
    <div class="bar">
      <!-- 互斥模式组：Naive 单选按钮组自带选中态与键盘操作 -->
      <n-radio-group
        class="modes"
        :value="mode"
        aria-label="跟随开关"
        @update:value="setMode"
      >
        <n-radio-button value="off">
          只换背景（旧）
        </n-radio-button>
        <n-radio-button value="on">
          指针跟随（推荐）
        </n-radio-button>
      </n-radio-group>

      <n-radio-group
        class="strengths"
        size="small"
        :value="strength"
        aria-label="跟随强度"
        @update:value="setStrength"
      >
        <n-radio-button
          v-for="item in STRENGTHS"
          :key="item.key"
          :value="item.key"
        >
          {{ item.label }}
        </n-radio-button>
      </n-radio-group>

      <n-button
        :type="mockReduce ? 'warning' : 'default'"
        :ghost="mockReduce"
        :aria-pressed="mockReduce"
        @click="toggleMockReduce"
      >
        {{ mockReduce ? '模拟中：已降级' : '模拟减少动态效果' }}
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
      系统当前开启了「减少动态效果」。真实项目应当据此不做跟随；本案例为了让跟随看得见，仍然播放，点开关可查看降级行为。
    </p>

    <div
      class="stats"
      aria-live="polite"
    >
      <span>当前位移 <b>{{ offsetText }}</b></span>
      <span>跟随次数 <b>{{ followCount }}</b> 次</span>
      <span>几何读取 <b>{{ geoReads }}</b> 次</span>
      <span>本轮最大位移 <b>{{ maxSeen }}px</b></span>
      <span>位移上限 <b>{{ currentStrength.max }}px</b></span>
      <span>触摸跳过 <b>{{ touchSkipped }}</b> 次</span>
      <span>动画 <b>{{ mockReduce ? '跳过' : '播放' }}</b></span>
    </div>

    <!--
      磁力范围：指针进入这块虚线区域才跟随。
      事件挂在范围而不是按钮上，所以指针在按钮旁边也能带动按钮。
    -->
    <div
      class="stage"
      @pointermove="onPointerMove"
      @pointerleave="onPointerLeave"
    >
      <button
        ref="buttonRef"
        class="mag-btn"
        :class="{
          'is-following': mode === 'on',
          'is-returning': returning,
          'is-static': mockReduce,
        }"
        type="button"
        :style="{ '--mx': `${offset.x}px`, '--my': `${offset.y}px` }"
      >
        <span
          class="mag-dot"
          aria-hidden="true"
        />
        保存草稿
      </button>

      <p class="stage-caption">
        指针在这块区域里移动，按钮会朝指针方向轻微偏移
      </p>
    </div>

    <p class="hint">
      旧做法只监听背景色：指针在按钮上怎么移动，位移读数都停在 0px / 0px。
      切到「指针跟随」后，移动指针能看到读数变化，几何读取次数随移动次数上涨；
      离开虚线范围，按钮会缓动回弹到中心。把强度从「弱」调到「强」，最大位移会停在上限，不会跟着指针无限跑。
      本案例为了让跟随看得见，系统开启「减少动态效果」时仍然播放，点开关可以看系统开启减少动态效果时应该怎么降级。
    </p>
  </div>
</template>

<style scoped>
.mag-demo {
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

.strengths {
  display: inline-flex;
  padding-left: 0.2rem;
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
  gap: 0.4rem 1rem;
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

/* ---------- 磁力范围 ---------- */

.stage {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.6rem;
  min-height: 12rem;
  padding: 2.2rem 1rem;
  border: 1px dashed var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--code-bg);
  /* 按钮最大位移受上限约束，这里再裁一次只是防止意外内容撑破布局 */
  overflow: hidden;
}

.stage-caption {
  margin: 0;
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
  text-align: center;
}

.mag-btn {
  /* 位移走 CSS 变量：脚本只改两个变量，transform 由样式统一消费 */
  --mx: 0px;
  --my: 0px;

  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: calc(var(--demo-control-py) + 0.15rem)
    calc(var(--demo-control-px) + 0.5rem);
  border: none;
  border-radius: var(--radius-btn);
  background-color: var(--primary);
  color: #fff;
  font-size: var(--demo-text-md);
  font-weight: 600;
  cursor: pointer;
  box-shadow: var(--shadow-soft);
  /*! 只平移，不改宽高与内外边距：位移不会触发重新布局 */
  transform: translate3d(var(--mx), var(--my), 0);
  transition: background-color var(--transition), box-shadow var(--transition);

  &:hover {
    background-color: var(--primary-hover);
    box-shadow: var(--shadow-soft-lg);
  }

  /*! 只有回弹阶段才给 transform 过渡：跟随时加过渡会明显慢半拍 */
  &.is-returning {
    transition: transform 0.3s var(--ease-out),
      background-color var(--transition), box-shadow var(--transition);
  }

  /* 跟随开启时加一圈浅色光晕，提示这是可交互的磁力范围 */
  &.is-following {
    box-shadow: 0 0 0 4px var(--primary-soft), var(--shadow-soft);
  }

  /* 模拟降级：位移不再参与，回弹也不需要过渡 */
  &.is-static {
    transition: background-color var(--transition), box-shadow var(--transition);
  }
}

.mag-dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background-color: #fff;
  opacity: 0.75;
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

  .stage {
    padding: 1.6rem 0.8rem;
    min-height: 10rem;
  }

  .hint {
    font-size: var(--demo-text-xs);
  }
}

/*! 演示优先：系统开启「减少动态效果」时，站点全局规则会把回弹过渡压到 0.01ms，
    而本案例正是要展示缓动回弹，所以这里把时长还原。真实项目不要照抄这一段，
    应当像「模拟减少动态效果」打开时那样，直接不跟随。 */
@media (prefers-reduced-motion: reduce) {
  .mag-btn.is-returning {
    transition-duration: 0.3s !important;
  }
}
</style>
