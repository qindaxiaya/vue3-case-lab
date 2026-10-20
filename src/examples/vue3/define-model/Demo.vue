// ============================================================
// 案例：defineModel 组件双向绑定（define-model）
// 同一个输入组件两种写法并排对比：
// 旧写法 props + emit('update:modelValue') vs defineModel（3.4+）
// 父组件随时改写值，两个输入框都能同步；输入时父状态实时更新
// ============================================================
<script setup lang="ts">
import { ref } from 'vue'
import LegacyInput from './LegacyInput.vue'
import ModelInput from './ModelInput.vue'

/** 旧写法绑定的父状态 */
const legacyText = ref('旧写法的值')
/** defineModel 绑定的父状态 */
const modelText = ref('defineModel 的值')
/** 父组件改写次数（证明双向绑定另一个方向也通） */
const parentWrites = ref(0)

/** 父组件直接改写两个子组件的值 */
function writeFromParent(): void {
  parentWrites.value++
  legacyText.value = `父组件写入 #${parentWrites.value}`
  modelText.value = `父组件写入 #${parentWrites.value}`
}

function resetAll(): void {
  legacyText.value = '旧写法的值'
  modelText.value = 'defineModel 的值'
  parentWrites.value = 0
}
</script>

<template>
  <div class="dm-demo">
    <!-- 两个子组件 -->
    <div class="dm-grid">
      <section class="dm-card">
        <h3>旧写法</h3>
        <p class="dm-sub">
          <code>props + emit</code>：手动取值、手动派发
        </p>
        <LegacyInput
          v-model="legacyText"
          label="v-model 绑定"
        />
        <p class="dm-value">
          父级：<b>{{ legacyText }}</b>
        </p>
      </section>

      <section class="dm-card">
        <h3>defineModel（3.4+）</h3>
        <p class="dm-sub">
          <code>const model = defineModel()</code>：一行搞定
        </p>
        <ModelInput
          v-model="modelText"
          label="v-model 绑定"
        />
        <p class="dm-value">
          父级：<b>{{ modelText }}</b>
        </p>
      </section>
    </div>

    <!-- 操作 -->
    <div class="dm-actions">
      <button
        class="btn-act"
        @click="writeFromParent"
      >
        父组件改写两个值
      </button>
      <button
        class="btn-reset"
        @click="resetAll"
      >
        重置
      </button>
      <span class="dm-count">父组件写入 <b>{{ parentWrites }}</b> 次</span>
    </div>

    <p class="dm-hint">
      两个方向都试：在输入框里打字 → 父级实时变化；点「父组件改写」→ 输入框同步。
    </p>
  </div>
</template>

<style scoped>
.dm-demo {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.dm-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
}

.dm-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  padding: 0.7rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  h3 {
    margin: 0;
    font-size: 0.9375rem;
    color: var(--text);
  }
}

.dm-sub {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);

  code {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    padding: 0.02rem 0.25rem;
    background-color: var(--code-bg);
    border-radius: var(--radius-sm);
  }
}

.dm-value {
  margin: 0.2rem 0 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
    word-break: break-all;
  }
}

.dm-actions {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.btn-act {
  padding: 0.28rem 0.7rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--primary);
  background-color: transparent;
  color: var(--primary);
  font-size: 0.875rem;
  cursor: pointer;

  &:hover {
    background-color: var(--primary);
    color: #fff;
  }
}

.btn-reset {
  padding: 0.28rem 0.6rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  cursor: pointer;

  &:hover {
    color: var(--text);
  }
}

.dm-count {
  font-size: 0.8125rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

.dm-hint {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

@media (max-width: 760px) {
  .dm-grid {
    grid-template-columns: 1fr;
  }
}
</style>
