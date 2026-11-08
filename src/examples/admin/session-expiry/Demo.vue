// ============================================================
// 案例：session-expiry 会话过期提醒
// 空闲倒计时 → 提前警告 → 续期 / 退出 → 过期重新登录
// ============================================================
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

type Phase = 'active' | 'warning' | 'expired'

const SESSION_SECONDS = 6
const WARN_SECONDS = 2
const TICK_MS = 1000

const remaining = ref(SESSION_SECONDS)
const phase = ref<Phase>('active')
const activityCount = ref(0)

let timer: ReturnType<typeof setInterval> | null = null

const warningVisible = computed(() => phase.value === 'warning')
const progress = computed(() => `${(remaining.value / SESSION_SECONDS) * 100}%`)
const phaseText = computed(() => {
  if (phase.value === 'warning') return '即将过期'
  if (phase.value === 'expired') return '已过期'
  return '活跃'
})

function stopTimer(): void {
  if (timer !== null) {
    window.clearInterval(timer)
    timer = null
  }
}

/**! 倒计时状态机：active → warning → expired，到 0 立刻停表 */
function startTimer(): void {
  stopTimer()
  timer = window.setInterval(() => {
    if (phase.value === 'expired') {
      stopTimer()
      return
    }
    remaining.value = Math.max(0, remaining.value - 1)
    if (remaining.value === 0) {
      phase.value = 'expired'
      stopTimer()
    } else if (remaining.value <= WARN_SECONDS) {
      phase.value = 'warning'
    }
  }, TICK_MS)
}

/**! 活动只在 active 生效：警告态已经进入续期确认，不能靠活动偷偷续命 */
function touch(): void {
  if (phase.value !== 'active') return
  remaining.value = SESSION_SECONDS
  activityCount.value++
  startTimer()
}

function extend(): void {
  if (phase.value !== 'warning') return
  phase.value = 'active'
  remaining.value = SESSION_SECONDS
  startTimer()
}

function logout(): void {
  phase.value = 'expired'
  remaining.value = 0
  stopTimer()
}

function relogin(): void {
  phase.value = 'active'
  remaining.value = SESSION_SECONDS
  startTimer()
}

function reset(): void {
  phase.value = 'active'
  remaining.value = SESSION_SECONDS
  activityCount.value = 0
  startTimer()
}

onMounted(startTimer)
onUnmounted(stopTimer)
</script>

<template>
  <div
    class="se-demo"
    :data-phase="phase"
  >
    <p class="hint">
      真实会话通常 15~30 分钟，这里压成 6 秒方便观察。
      剩 2 秒时提前提醒，别等用户点提交才发现已经掉线。
    </p>

    <section class="panel">
      <div class="status-row">
        <div class="count">
          <span
            class="count-number"
            data-stat="remaining"
          >{{ remaining }}</span>
          <span class="count-unit">秒</span>
        </div>
        <span
          class="phase-badge"
          :class="`phase-badge--${phase}`"
          data-stat="phase"
        >
          {{ phaseText }}
        </span>
        <span class="activity">
          活动
          <strong data-stat="activity-count">{{ activityCount }}</strong>
          次
        </span>
        <span
          class="probe"
          data-stat="warning-visible"
        >{{ warningVisible ? 'true' : 'false' }}</span>
      </div>

      <div class="progress">
        <span
          class="progress-bar"
          :class="`progress-bar--${phase}`"
          :style="{ width: progress }"
        />
      </div>

      <div
        v-if="warningVisible"
        class="warning-banner"
      >
        会话将在 {{ remaining }} 秒后过期，继续操作前先确认一下。
      </div>
      <div
        v-else-if="phase === 'expired'"
        class="expired-banner"
      >
        会话已过期，请重新登录后继续。
      </div>

      <div class="actions">
        <n-button
          size="small"
          :disabled="phase !== 'active'"
          data-action="activity"
          @click="touch"
        >
          模拟活动
        </n-button>
        <n-button
          size="small"
          type="warning"
          :disabled="phase !== 'warning'"
          data-action="extend"
          @click="extend"
        >
          继续使用
        </n-button>
        <n-button
          v-if="phase !== 'expired'"
          size="small"
          type="error"
          quaternary
          data-action="logout"
          @click="logout"
        >
          退出登录
        </n-button>
        <n-button
          v-else
          size="small"
          type="primary"
          data-action="relogin"
          @click="relogin"
        >
          重新登录
        </n-button>
        <n-button
          size="small"
          quaternary
          data-action="reset"
          @click="reset"
        >
          重置
        </n-button>
      </div>
    </section>

    <p class="footnote">
      过期后不要只把倒计时停在 0：要明确切到「已过期」，收起普通操作，只留重新登录。
      警告态再给一个「继续使用」按钮，用户才知道现在续期还来得及。
    </p>
  </div>
</template>

<style scoped>
.se-demo {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.hint {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}

.panel {
  padding: var(--demo-block-pad);
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg);
}

.status-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.5rem 0.9rem;
  margin-bottom: 0.5rem;
}

.count {
  display: flex;
  align-items: baseline;
  gap: 0.15rem;
}

.count-number {
  font-family: var(--font-mono);
  font-size: 1.6rem;
  font-weight: 600;
  line-height: 1;
  color: var(--primary);
}

.count-unit {
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.phase-badge {
  padding: 0.1rem 0.45rem;
  border-radius: var(--radius-tag);
  font-size: var(--demo-text-xs);
}

.phase-badge--active {
  color: var(--success);
  background-color: color-mix(in srgb, var(--success) 12%, transparent);
}

.phase-badge--warning {
  color: var(--warning);
  background-color: color-mix(in srgb, var(--warning) 14%, transparent);
}

.phase-badge--expired {
  color: var(--danger);
  background-color: color-mix(in srgb, var(--danger) 12%, transparent);
}

.activity {
  margin-left: auto;
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);

  strong {
    font-family: var(--font-mono);
    color: var(--text);
  }
}

.probe {
  display: none;
}

.progress {
  height: 0.35rem;
  margin-bottom: 0.55rem;
  overflow: hidden;
  border-radius: var(--radius-tag);
  background-color: var(--bg-subtle);
}

.progress-bar {
  display: block;
  height: 100%;
  border-radius: inherit;
  background-color: var(--success);
  transition: width 0.3s var(--ease-out);
}

.progress-bar--warning {
  background-color: var(--warning);
}

.progress-bar--expired {
  background-color: var(--danger);
}

.warning-banner,
.expired-banner {
  margin-bottom: 0.55rem;
  padding: 0.45rem 0.6rem;
  border-radius: var(--demo-radius);
  font-size: var(--demo-text-sm);
}

.warning-banner {
  border: 1px solid color-mix(in srgb, var(--warning) 35%, var(--border));
  background-color: color-mix(in srgb, var(--warning) 8%, var(--bg));
  color: var(--warning);
}

.expired-banner {
  border: 1px solid color-mix(in srgb, var(--danger) 35%, var(--border));
  background-color: color-mix(in srgb, var(--danger) 8%, var(--bg));
  color: var(--danger);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.footnote {
  margin: 0;
  font-size: var(--demo-text-xs);
  line-height: 1.7;
  color: var(--text-secondary);
}
</style>
