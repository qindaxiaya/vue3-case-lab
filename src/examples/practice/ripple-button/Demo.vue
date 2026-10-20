// ============================================================
// 案例：水波纹按钮（ripple-button）
// - 点击位置为圆心扩散波纹（Web Animations API 驱动，无 CSS keyframes 堆积）
// - 多种按钮变体 + 开关对比（关闭后点击无波纹）
// - animation.onfinish 自动移除节点，连续点击不会堆积 DOM
// ============================================================
<script setup lang="ts">
import { ref } from 'vue'

/** 波纹开关（对比用） */
const rippleEnabled = ref(true)
/** 点击次数（验证事件与波纹解耦） */
const clickCount = ref(0)
/** 每次波纹的时长 ms */
const rippleDuration = ref(600)

// ============================================================
// 波纹核心
// ============================================================

/**
 * 在点击位置创建一枚扩散波纹
 * @param e 点击事件（取相对按钮的坐标）
 */
function spawnRipple(e: MouseEvent): void {
  clickCount.value++
  if (!rippleEnabled.value) return

  const btn = e.currentTarget as HTMLElement
  const rect = btn.getBoundingClientRect()

  // 圆心 = 点击点相对按钮的坐标
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  // 半径取「到按钮最远角」的距离——保证波纹能覆盖整个按钮
  const radius = Math.max(
    Math.hypot(x, y),
    Math.hypot(rect.width - x, y),
    Math.hypot(x, rect.height - y),
    Math.hypot(rect.width - x, rect.height - y),
  )

  // 波纹元素：绝对定位圆形，初始缩到 0
  const ripple = document.createElement('span')
  ripple.className = 'ripple-ink'
  ripple.style.width = `${radius * 2}px`
  ripple.style.height = `${radius * 2}px`
  ripple.style.left = `${x - radius}px`
  ripple.style.top = `${y - radius}px`
  btn.appendChild(ripple)

  //! Web Animations API：从 scale(0) 扩散到 scale(1) 并淡出
  const anim = ripple.animate(
    [
      { transform: 'scale(0)', opacity: 0.45 },
      { transform: 'scale(1)', opacity: 0 },
    ],
    {
      duration: rippleDuration.value,
      easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)', // ease-out 感
      fill: 'forwards',
    },
  )

  //! 动画结束即移除节点——连续狂点也不会有 DOM 残留
  anim.onfinish = () => ripple.remove()
}
</script>

<template>
  <div class="rb-demo">
    <!-- 控制行 -->
    <div class="controls">
      <label class="switch">
        <input
          v-model="rippleEnabled"
          type="checkbox"
        >
        开启波纹
      </label>
      <label class="ctl">
        时长
        <input
          v-model.number="rippleDuration"
          type="range"
          min="200"
          max="1200"
          step="100"
        >
        <span class="ctl-val">{{ rippleDuration }}ms</span>
      </label>
      <span class="stat">点击次数 <b>{{ clickCount }}</b></span>
    </div>

    <!-- 按钮变体 -->
    <div class="button-grid">
      <button
        class="rb rb--primary"
        @click="spawnRipple"
      >
        主要按钮
      </button>
      <button
        class="rb rb--success"
        @click="spawnRipple"
      >
        成功按钮
      </button>
      <button
        class="rb rb--danger"
        @click="spawnRipple"
      >
        危险按钮
      </button>
      <button
        class="rb rb--ghost"
        @click="spawnRipple"
      >
        幽灵按钮
      </button>
      <button
        class="rb rb--outline"
        @click="spawnRipple"
      >
        描边按钮
      </button>
      <button
        class="rb rb--dark"
        @click="spawnRipple"
      >
        深色按钮
      </button>
    </div>

    <p class="footnote">
      点任意按钮的任意位置——波纹从点击点扩散（不是从中心）。关闭开关后点击不再有波纹，但点击次数照增（证明波纹与业务事件解耦）。
    </p>
  </div>
</template>

<style scoped>
.rb-demo {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

/* ---------- 控制 ---------- */

.controls {
  display: flex;
  align-items: center;
  gap: 1.1rem;
  flex-wrap: wrap;
}

.switch,
.ctl {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.875rem;
  color: var(--text);
  cursor: pointer;

  input[type='checkbox'] {
    accent-color: var(--primary);
  }

  input[type='range'] {
    accent-color: var(--primary);
    width: 110px;
  }
}

.ctl-val {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--primary);
  min-width: 4em;
}

.stat {
  font-size: 0.875rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

/* ---------- 按钮变体 ---------- */

.button-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
  padding: 1.1rem;
  border: 1px dashed var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
}

.rb {
  position: relative; /* 波纹定位基准 */
  overflow: hidden; /* 裁掉溢出的波纹圆 */
  isolation: isolate; /* 波纹不与文字混层 */
  padding: 0.6rem 1.5rem;
  border-radius: var(--radius-btn);
  border: 1px solid transparent;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: filter 0.15s, transform 0.1s;

  /* 按压反馈：轻微下沉 */
  &:active {
    transform: translateY(1px);
  }
}

.rb--primary {
  background-color: var(--primary);
  color: #fff;
}

.rb--success {
  background-color: var(--success);
  color: #fff;
}

.rb--danger {
  background-color: var(--danger);
  color: #fff;
}

.rb--ghost {
  background-color: transparent;
  color: var(--primary);
  border-color: var(--primary);

  &:hover {
    background-color: color-mix(in srgb, var(--primary) 8%, transparent);
  }
}

.rb--outline {
  background-color: transparent;
  color: var(--text);
  border-color: var(--border);

  &:hover {
    border-color: var(--text-secondary);
  }
}

.rb--dark {
  background-color: #27272a;
  color: #fafafa;
}

/* ---------- 波纹墨点 ---------- */
/* JS 创建的节点无 scoped 属性，用 :deep 从按钮/根容器穿透命中 */
.rb-demo :deep(.ripple-ink) {
  position: absolute;
  border-radius: 50%;
  /* 跟随按钮文字色：白字按钮白波纹、主色字按钮主色波纹 */
  background-color: currentcolor;
  opacity: 0;
  pointer-events: none;
  z-index: -1; /* 文字在上 */
  will-change: transform, opacity;
}

.footnote {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.7;
  color: var(--text-secondary);
}
</style>
