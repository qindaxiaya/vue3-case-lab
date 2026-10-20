<!-- ============================================================
     旧写法：props + emit('update:modelValue')
     ============================================================ -->
<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  label?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function onInput(e: Event): void {
  //! 手动取值 + 手动 emit（每个 v-model 组件都要重复这段）
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
</script>

<template>
  <label class="demo-input">
    <span class="demo-input__label">{{ label ?? '旧写法' }}</span>
    <input
      :value="props.modelValue"
      class="demo-input__control"
      @input="onInput"
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
