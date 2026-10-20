// ============================================================
// defineModel 写法：一行声明，编译出 props + emit + 本地 ref
// ============================================================
<script setup lang="ts">
/**
 * //! defineModel() 自动完成三件事：
 * 1. 声明 modelValue prop
 * 2. 声明 update:modelValue 事件
 * 3. 返回一个可读写的 ref（写入自动 emit）
 */
const model = defineModel<string>({ default: '' })

defineProps<{ label?: string }>()
</script>

<template>
  <label class="demo-input">
    <span class="demo-input__label">{{ label ?? 'defineModel' }}</span>
    <input
      v-model="model"
      class="demo-input__control"
    >
  </label>
</template>

<style scoped>
.demo-input {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.demo-input__label {
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.demo-input__control {
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background-color: var(--bg);
  color: var(--text);
  font-size: 0.82rem;

  &:focus {
    outline: none;
    border-color: var(--primary);
  }
}
</style>
