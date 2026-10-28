// ============================================================
// 案例演示区通用提示栈
// - Teleport 到 body + 固定定位，不参与文档流、不推挤演示内容
// - 全站统一放右上角（顶栏下方），移动端保留安全边距
// ============================================================
<script setup lang="ts">
import type { DemoToastMessage } from './types'

withDefaults(
  defineProps<{
    /** 当前要显示的提示，最多由调用方控制条数 */
    messages: readonly DemoToastMessage[]
    /** 无障碍名称 */
    label?: string
  }>(),
  { label: '操作提示' },
)
</script>

<template>
  <Teleport to="body">
    <TransitionGroup
      name="demo-toast"
      tag="div"
      class="demo-toasts"
      role="status"
      aria-live="polite"
      aria-atomic="false"
      :aria-label="label"
    >
      <p
        v-for="message in messages"
        :key="message.id"
        class="demo-toast"
        :class="`demo-toast--${message.tone ?? 'info'}`"
      >
        {{ message.text }}
      </p>
    </TransitionGroup>
  </Teleport>
</template>

<style scoped>
.demo-toasts {
  position: fixed;
  top: 5rem;
  right: 1rem;
  z-index: 1200;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
  max-width: min(22rem, calc(100vw - 2rem));
  pointer-events: none;
}

.demo-toast {
  margin: 0;
  padding: 0.55rem 0.8rem;
  border: 1px solid var(--border);
  border-left-width: 3px;
  border-radius: var(--demo-radius);
  background-color: var(--surface);
  box-shadow: var(--shadow-soft);
  font-size: var(--demo-text-sm);
  line-height: 1.5;
  color: var(--text);
}

.demo-toast--ok {
  border-left-color: var(--success);
  background-color: var(--success-soft);
  color: var(--success);
}

.demo-toast--bad {
  border-left-color: var(--danger);
  background-color: var(--danger-soft);
  color: var(--danger);
}

.demo-toast--warning {
  border-left-color: var(--warning);
  background-color: var(--warning-soft);
  color: var(--warning);
}

.demo-toast--info {
  border-left-color: var(--primary);
  background-color: var(--primary-soft);
  color: var(--primary);
}

.demo-toast-enter-active,
.demo-toast-leave-active {
  transition:
    opacity 0.2s var(--ease-out),
    transform 0.2s var(--ease-out);
}

.demo-toast-enter-from,
.demo-toast-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (max-width: 560px) {
  .demo-toasts {
    top: 4.5rem;
    right: 0.75rem;
    left: 0.75rem;
    max-width: none;
  }
}
</style>
