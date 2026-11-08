// ============================================================
// 案例：step-form 分步表单
// 步骤校验、上一步 / 下一步、提交、重新填写
// ============================================================
<script setup lang="ts">
import { computed, onUnmounted, reactive, ref } from 'vue'

// ============================================================
// 类型与数据
// ============================================================

type Plan = 'basic' | 'pro' | 'enterprise'

interface FormState {
  name: string
  email: string
  plan: Plan
  seats: string
}

interface Errors {
  name?: string
  email?: string
}

const steps = ['基本信息', '套餐配置', '确认提交']

const form = reactive<FormState>({
  name: '',
  email: '',
  plan: 'basic',
  seats: '5',
})

const step = ref(1)
const errors = ref<Errors>({})
const loading = ref(false)
const submitted = ref(false)
const submitCount = ref(0)

let submitTimer: number | null = null

const planOptions = [
  { label: '基础版', value: 'basic', desc: '适合小团队试用' },
  { label: '专业版', value: 'pro', desc: '含高级报表与权限' },
  { label: '旗舰版', value: 'enterprise', desc: '专属支持与审计' },
]

const seatOptions = [
  { label: '5 人', value: '5' },
  { label: '10 人', value: '10' },
  { label: '20 人', value: '20' },
]

// ============================================================
// 派生状态
// ============================================================

const errorCount = computed(() => Object.keys(errors.value).length)
const planLabel = computed(
  () => planOptions.find((option) => option.value === form.plan)?.label ?? '未选择',
)
const summary = computed(() => `${form.name || '未填写'} · ${planLabel.value} · ${form.seats} 人`)

// ============================================================
// 校验与步骤
// ============================================================

/** 只校验当前步骤，不提前暴露后面步骤的错误 */
function validateStep1(): boolean {
  const next: Errors = {}
  if (form.name.trim().length < 2) next.name = '姓名至少 2 个字'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = '邮箱格式不对'
  errors.value = next
  return Object.keys(next).length === 0
}

function next(): void {
  if (submitted.value) return
  if (step.value === 1 && !validateStep1()) return
  if (step.value < steps.length) step.value++
}

function back(): void {
  if (submitted.value) return
  if (step.value > 1) step.value--
}

/** 提交前再校验一次第一步，防止用户用脚本或浏览器后退绕过 */
function submit(): void {
  if (loading.value || submitted.value) return
  if (!validateStep1()) {
    step.value = 1
    return
  }
  loading.value = true
  submitTimer = window.setTimeout(() => {
    loading.value = false
    submitted.value = true
    submitCount.value++
    submitTimer = null
  }, 500)
}

function reset(): void {
  if (submitTimer !== null) {
    window.clearTimeout(submitTimer)
    submitTimer = null
  }
  form.name = ''
  form.email = ''
  form.plan = 'basic'
  form.seats = '5'
  step.value = 1
  errors.value = {}
  loading.value = false
  submitted.value = false
  submitCount.value = 0
}

onUnmounted(() => {
  if (submitTimer !== null) window.clearTimeout(submitTimer)
})
</script>

<template>
  <div class="sf-demo">
    <p class="hint">
      分步表单把长表单拆成几步：每一步只校验当前字段，下一步通过后才允许前进；
      提交前再校验一次，防止用户绕过按钮状态。
    </p>

    <ol class="steps">
      <li
        v-for="(label, index) in steps"
        :key="label"
        class="step"
        :class="{ 'step--active': step === index + 1, 'step--done': step > index + 1 }"
      >
        <span class="step-index">{{ index + 1 }}</span>
        <span class="step-label">{{ label }}</span>
      </li>
    </ol>

    <section class="panel">
      <div
        v-if="step === 1"
        class="fields"
      >
        <label class="field">
          <span>姓名</span>
          <n-input
            class="sf-name"
            :value="form.name"
            :status="errors.name ? 'error' : undefined"
            placeholder="至少 2 个字"
            @update:value="(value: string) => (form.name = value)"
          />
          <small
            v-if="errors.name"
            class="error"
          >{{ errors.name }}</small>
        </label>

        <label class="field">
          <span>邮箱</span>
          <n-input
            class="sf-email"
            :value="form.email"
            :status="errors.email ? 'error' : undefined"
            placeholder="name@example.com"
            @update:value="(value: string) => (form.email = value)"
          />
          <small
            v-if="errors.email"
            class="error"
          >{{ errors.email }}</small>
        </label>
      </div>

      <div
        v-else-if="step === 2"
        class="fields"
      >
        <div class="field">
          <span>套餐</span>
          <n-radio-group
            v-model:value="form.plan"
            class="sf-plan"
          >
            <n-radio-button
              v-for="option in planOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </n-radio-button>
          </n-radio-group>
          <small class="tip">
            {{ planOptions.find((option) => option.value === form.plan)?.desc }}
          </small>
        </div>

        <label class="field">
          <span>席位数</span>
          <n-select
            v-model:value="form.seats"
            class="sf-seats"
            :options="seatOptions"
          />
        </label>
      </div>

      <div
        v-else
        class="review"
      >
        <h3>确认信息</h3>
        <dl class="review-list">
          <div>
            <dt>姓名</dt>
            <dd>{{ form.name }}</dd>
          </div>
          <div>
            <dt>邮箱</dt>
            <dd>{{ form.email }}</dd>
          </div>
          <div>
            <dt>套餐</dt>
            <dd>{{ planLabel }}</dd>
          </div>
          <div>
            <dt>席位数</dt>
            <dd>{{ form.seats }} 人</dd>
          </div>
        </dl>
        <p
          v-if="submitted"
          class="success"
        >
          已提交，共 {{ submitCount }} 次
        </p>
      </div>
    </section>

    <div class="actions">
      <n-button
        :disabled="step === 1 || loading || submitted"
        @click="back"
      >
        上一步
      </n-button>
      <n-button
        v-if="step < 3"
        type="primary"
        @click="next"
      >
        下一步
      </n-button>
      <n-button
        v-else
        type="primary"
        :loading="loading"
        :disabled="loading || submitted"
        @click="submit"
      >
        提交
      </n-button>
      <n-button
        v-if="submitted"
        @click="reset"
      >
        再填一份
      </n-button>
      <span
        class="status"
        data-stat="summary"
      >{{ summary }}</span>
    </div>

    <dl class="metrics">
      <div class="metric">
        <dt>当前步骤</dt>
        <dd data-stat="step">
          {{ step }} / {{ steps.length }}
        </dd>
      </div>
      <div class="metric">
        <dt>校验错误</dt>
        <dd data-stat="error-count">
          {{ errorCount }}
        </dd>
      </div>
      <div class="metric">
        <dt>提交次数</dt>
        <dd data-stat="submit-count">
          {{ submitCount }}
        </dd>
      </div>
      <div class="metric">
        <dt>提交状态</dt>
        <dd data-stat="done">
          {{ submitted ? '已提交' : '未提交' }}
        </dd>
      </div>
    </dl>

    <p class="footnote">
      真实项目里把 <code>submit</code> 换成接口请求；步骤切换时把草稿写进 sessionStorage，
      刷新后还能回到原来的步骤。
    </p>
  </div>
</template>

<style scoped>
.sf-demo {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.hint,
.footnote {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}

.footnote {
  font-size: var(--demo-text-xs);
}

.steps {
  display: flex;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.step {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg-subtle);
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.step-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 50%;
  background-color: var(--bg);
  font-family: var(--font-mono);
  font-size: var(--demo-text-xs);
}

.step--active {
  border-color: var(--primary);
  color: var(--primary);
}

.step--active .step-index {
  background-color: var(--primary);
  color: #fff;
}

.step--done {
  color: var(--success);
}

.step--done .step-index {
  background-color: var(--success);
  color: #fff;
}

.panel {
  min-height: 9.5rem;
  padding: var(--demo-block-pad);
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg);
}

.fields {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.error {
  color: var(--danger);
}

.tip {
  color: var(--text-secondary);
}

.review h3 {
  margin: 0 0 0.4rem;
  font-size: var(--demo-text-md);
  color: var(--text);
}

.review-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.35rem 0.8rem;
  margin: 0;

  div {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    padding-bottom: 0.3rem;
    border-bottom: 1px dashed var(--border);
  }

  dt {
    font-size: var(--demo-text-xs);
    color: var(--text-secondary);
  }

  dd {
    margin: 0;
    font-size: var(--demo-text-sm);
    color: var(--text);
  }
}

.success {
  margin: 0.6rem 0 0;
  color: var(--success);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
}

.status {
  margin-left: auto;
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.45rem 0.8rem;
  margin: 0;
}

.metric {
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
    font-size: var(--demo-text-sm);
    font-weight: 600;
    color: var(--text);
  }
}

@media (max-width: 768px) {
  .steps {
    flex-direction: column;
  }

  .review-list,
  .metrics {
    grid-template-columns: 1fr;
  }

  .status {
    width: 100%;
    margin-left: 0;
  }
}
</style>
