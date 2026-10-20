// ============================================================
// 案例：Toast 通知队列（toast-queue）
// - 最多同时显示 3 条，超出排队等补位（队列管理是核心）
// - 4 种类型 + 进度条：消失由 CSS animationend 驱动——hover 时进度与倒计时一起真暂停
// - 手动关闭即从队列补位
// - 教学案例：刻意手写（理解「队列 + 计时 + 补位」），真实项目直接用 vue-toastification
// ============================================================
<script setup lang="ts">
import { ref } from 'vue'

// ============================================================
// 类型定义
// ============================================================

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: number
  type: ToastType
  message: string
  /** 存活时长 ms（同时决定进度条动画时长） */
  duration: number
}

/** 同时在屏上限（超出进排队区） */
const MAX_VISIBLE = 3

// ============================================================
// 队列状态
// ============================================================

/** 屏上显示中 */
const visible = ref<Toast[]>([])
/** 排队等待中 */
const queued = ref<Toast[]>([])

let nextId = 1

/** 类型文案与图标 */
const TYPE_META: Record<ToastType, { label: string; icon: string }> = {
  success: { label: '成功', icon: '✓' },
  error: { label: '错误', icon: '✕' },
  info: { label: '提示', icon: 'i' },
  warning: { label: '警告', icon: '!' },
}

// ============================================================
// 入队 / 补位 / 关闭
// ============================================================

/** 推入一条通知：屏未满直接显示，否则排队 */
function push(type: ToastType, message: string, duration = 3200): void {
  const t: Toast = { id: nextId++, type, message, duration }
  if (visible.value.length < MAX_VISIBLE) {
    visible.value.push(t)
  } else {
    queued.value.push(t)
  }
}

/** 关闭一条：腾出位置后从队列头部补位 */
function dismiss(id: number): void {
  visible.value = visible.value.filter((t) => t.id !== id)
  const next = queued.value.shift()
  if (next) visible.value.push(next)
}

/** 进度条动画结束 = 该条寿终（hover 暂停时 animation 一并暂停，不会提前消失） */
function onProgressEnd(id: number): void {
  dismiss(id)
}

// ============================================================
// 演示按钮
// ============================================================

function demoSuccess(): void {
  push('success', '保存成功，已同步到云端')
}

function demoError(): void {
  push('error', '请求失败：网络超时，请重试')
}

function demoInfo(): void {
  push('info', '新版本 v0.2 已可用')
}

function demoWarning(): void {
  push('warning', '存储空间即将用尽（剩余 8%）')
}

/** 批量轰炸：一次推 8 条，直观看到 3 条上屏 + 5 条排队补位 */
function demoBatch(): void {
  const types: ToastType[] = ['success', 'info', 'warning', 'error']
  const messages = [
    '批量任务 1 完成',
    '批量任务 2 完成',
    '批量任务 3 完成',
    '批量任务 4 完成',
    '批量任务 5 完成',
    '批量任务 6 完成',
    '批量任务 7 完成',
    '批量任务 8 完成',
  ]
  messages.forEach((m, i) => {
    push(types[i % types.length], m)
  })
}

/** 清空全部（含排队） */
function clearAll(): void {
  visible.value = []
  queued.value = []
}
</script>

<template>
  <div class="tq-demo">
    <!-- 触发区 -->
    <div class="controls">
      <button
        class="btn btn--success"
        @click="demoSuccess"
      >
        success
      </button>
      <button
        class="btn btn--error"
        @click="demoError"
      >
        error
      </button>
      <button
        class="btn btn--info"
        @click="demoInfo"
      >
        info
      </button>
      <button
        class="btn btn--warning"
        @click="demoWarning"
      >
        warning
      </button>
      <button
        class="btn btn--batch"
        @click="demoBatch"
      >
        批量推 8 条（看排队补位）
      </button>
      <button
        class="btn btn--ghost"
        @click="clearAll"
      >
        清空
      </button>
    </div>

    <!-- 状态条：显示中 / 排队中 -->
    <div class="status">
      <span>屏上 <b>{{ visible.length }}</b> / {{ MAX_VISIBLE }}</span>
      <span>排队 <b>{{ queued.length }}</b></span>
      <span class="status-hint">hover 通知可暂停倒计时；关闭即补位</span>
    </div>

    <!-- 通知容器（右上角固定区） -->
    <div
      class="toast-stack"
      aria-live="polite"
    >
      <div
        v-for="t in visible"
        :key="t.id"
        class="toast"
        :class="`toast--${t.type}`"
      >
        <!-- 图标 + 文案 -->
        <span
          class="toast-icon"
          aria-hidden="true"
        >{{ TYPE_META[t.type].icon }}</span>
        <div class="toast-body">
          <p class="toast-title">
            {{ TYPE_META[t.type].label }}
            <span class="toast-id">#{{ t.id }}</span>
          </p>
          <p class="toast-msg">
            {{ t.message }}
          </p>
        </div>
        <!-- 关闭按钮 -->
        <button
          class="toast-close"
          aria-label="关闭通知"
          @click="dismiss(t.id)"
        >
          ✕
        </button>

        <!-- 进度条：动画结束即寿终；hover 暂停 -->
        <div
          class="toast-progress"
          :style="{ animationDuration: `${t.duration}ms` }"
          @animationend="onProgressEnd(t.id)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.tq-demo {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  min-height: 380px;
}

/* ---------- 触发按钮 ---------- */

.controls {
  display: flex;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.btn {
  padding: 0.32rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background-color: transparent;
  color: var(--text);
  font-size: 0.78rem;
  cursor: pointer;

  &:hover {
    border-color: var(--text-secondary);
  }
}

.btn--success {
  border-color: var(--success);
  color: var(--success);
}

.btn--error {
  border-color: var(--danger);
  color: var(--danger);
}

.btn--info {
  border-color: var(--primary);
  color: var(--primary);
}

.btn--warning {
  border-color: var(--warning);
  color: var(--warning);
}

.btn--batch,
.btn--ghost {
  color: var(--text-secondary);
}

/* ---------- 状态条 ---------- */

.status {
  display: flex;
  align-items: center;
  gap: 1.1rem;
  font-size: 0.78rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

.status-hint {
  font-size: 0.72rem;
}

/* ---------- 通知栈（右上角） ---------- */

.toast-stack {
  position: fixed;
  top: 5.2rem;
  right: 1.4rem;
  z-index: 50;
  width: 320px;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  pointer-events: none; /* 容器穿透，通知本体可点 */
}

.toast {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.65rem 0.75rem;
  border-radius: var(--radius-btn);
  border: 1px solid var(--border);
  border-left-width: 3px;
  background-color: var(--bg);
  box-shadow: 0 10px 26px rgb(0 0 0 / 0.14);
  overflow: hidden;
  pointer-events: auto;
  animation: toast-in 0.22s ease-out;
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateX(16px);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* 类型色：左侧竖条 + 图标颜色 */
.toast--success {
  border-left-color: var(--success);
}

.toast--error {
  border-left-color: var(--danger);
}

.toast--info {
  border-left-color: var(--primary);
}

.toast--warning {
  border-left-color: var(--warning);
}

.toast-icon {
  flex-shrink: 0;
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  color: #fff;
}

.toast--success .toast-icon {
  background-color: var(--success);
}

.toast--error .toast-icon {
  background-color: var(--danger);
}

.toast--info .toast-icon {
  background-color: var(--primary);
}

.toast--warning .toast-icon {
  background-color: var(--warning);
}

.toast-body {
  flex: 1;
  min-width: 0;
}

.toast-title {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text);
}

.toast-id {
  font-family: var(--font-mono);
  font-size: 0.66rem;
  font-weight: 400;
  color: var(--text-secondary);
}

.toast-msg {
  margin: 0.15rem 0 0;
  font-size: 0.76rem;
  line-height: 1.5;
  color: var(--text-secondary);
  word-break: break-word;
}

.toast-close {
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0.1rem;

  &:hover {
    color: var(--text);
  }
}

/* ---------- 进度条：animationend 驱动消失，hover 真暂停 ---------- */

.toast-progress {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 3px;
  width: 100%;
  transform-origin: left;
  background-color: currentcolor; /* 颜色跟随各类型的 color 设置 */
  opacity: 0.55;
  animation-name: toast-countdown;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

.toast--success .toast-progress {
  color: var(--success);
}

.toast--error .toast-progress {
  color: var(--danger);
}

.toast--info .toast-progress {
  color: var(--primary);
}

.toast--warning .toast-progress {
  color: var(--warning);
}

/* hover 暂停倒计时（进度条停止 = 消失延后，二者天然一致） */
.toast:hover .toast-progress {
  animation-play-state: paused;
}

@keyframes toast-countdown {
  from {
    transform: scaleX(1);
  }

  to {
    transform: scaleX(0);
  }
}
</style>
