// ============================================================
// 案例：测试门禁（vitest-gate）
// 模拟 CI 依次执行：单元测试 → 类型检查 → Lint → 构建 → 覆盖率；
// 任一步失败立即中断（fail fast），可切换「注入失败」观察行为。
// ============================================================
<script setup lang="ts">
import { computed, ref } from 'vue'

type StepStatus = 'idle' | 'running' | 'pass' | 'fail'

interface Step {
  id: string
  label: string
  cmd: string
  ms: number
  status: StepStatus
}

const steps = ref<Step[]>([
  { id: 'unit', label: '单元测试', cmd: 'npx vitest run', ms: 700, status: 'idle' },
  { id: 'type', label: '类型检查', cmd: 'npm run type-check', ms: 1000, status: 'idle' },
  { id: 'lint', label: 'ESLint', cmd: 'npm run lint', ms: 600, status: 'idle' },
  { id: 'build', label: '生产构建', cmd: 'npm run build', ms: 1200, status: 'idle' },
  { id: 'cov', label: '覆盖率门禁', cmd: 'vitest run --coverage (≥80%)', ms: 500, status: 'idle' },
])

const running = ref(false)
const failOn = ref<'none' | string>('none')
const totalMs = ref<number | null>(null)
const current = ref('')

const sleep = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms))

async function run(): Promise<void> {
  if (running.value) return
  running.value = true
  totalMs.value = null
  current.value = ''
  steps.value.forEach((s) => (s.status = 'idle'))

  const t0 = performance.now()

  for (const step of steps.value) {
    step.status = 'running'
    current.value = step.cmd
    await sleep(step.ms)

    //! 门禁：任何一步失败立即中断，不继续跑后面的
    if (failOn.value === step.id) {
      step.status = 'fail'
      current.value = ''
      break
    }
    step.status = 'pass'
  }

  totalMs.value = Math.round(performance.now() - t0)
  current.value = ''
  running.value = false
}

function reset(): void {
  if (running.value) return
  steps.value.forEach((s) => (s.status = 'idle'))
  totalMs.value = null
  current.value = ''
}

const verdict = computed<'pass' | 'fail' | null>(() => {
  if (steps.value.some((s) => s.status === 'fail')) return 'fail'
  if (steps.value.length && steps.value.every((s) => s.status === 'pass')) return 'pass'
  return null
})

const statusIcon: Record<StepStatus, string> = {
  idle: '○',
  running: '◌',
  pass: '✓',
  fail: '✕',
}
</script>

<template>
  <div class="vg-demo">
    <!-- 控制 -->
    <div class="vg-bar">
      <button
        class="btn-act"
        :disabled="running"
        @click="run"
      >
        {{ running ? '执行中…' : '模拟 CI 运行' }}
      </button>
      <button
        class="btn-ghost"
        :disabled="running"
        @click="reset"
      >
        重置
      </button>
      <div class="vg-select">
        <span class="vg-select-label">注入失败</span>
        <el-select
          v-model="failOn"
          class="vg-select-control"
          size="large"
          aria-label="注入失败步骤"
        >
          <el-option
            label="不注入"
            value="none"
          />
          <el-option
            v-for="s in steps"
            :key="s.id"
            :label="s.label"
            :value="s.id"
          />
        </el-select>
      </div>
      <span
        v-if="totalMs !== null"
        class="vg-kv"
      >总耗时 <b>{{ totalMs }} ms</b></span>
    </div>

    <!-- 结果横幅 -->
    <div
      v-if="verdict"
      class="vg-verdict"
      :class="verdict"
    >
      {{ verdict === 'pass' ? '✓ 门禁通过，可以合并' : '✕ 门禁失败，禁止合并' }}
    </div>

    <!-- 步骤 -->
    <div class="vg-steps">
      <div
        v-for="step in steps"
        :key="step.id"
        class="vg-step"
        :class="step.status"
      >
        <span class="vg-icon">{{ statusIcon[step.status] }}</span>
        <span class="vg-step-main">
          <span class="vg-step-label">{{ step.label }}</span>
          <code class="vg-cmd">{{ step.cmd }}</code>
        </span>
        <span class="vg-status">
          {{
            step.status === 'idle'
              ? '等待'
              : step.status === 'running'
                ? '执行中'
                : step.status === 'pass'
                  ? '通过'
                  : '失败'
          }}
        </span>
      </div>
    </div>

    <p
      v-if="running && current"
      class="vg-current"
    >
      正在执行：<code>{{ current }}</code>
    </p>

    <!-- 配置示例 -->
    <pre class="vg-code"><code>// package.json
{
  "scripts": {
    "test": "vitest run",
    "type-check": "vue-tsc --noEmit",
    "lint": "eslint . --max-warnings 0",
    "build": "vue-tsc -b &amp;&amp; vite build"
  }
}

// .github/workflows/ci.yml
steps:
  - run: npm ci
  - run: npm run lint
  - run: npm run type-check
  - run: npx vitest run --coverage
  - run: npm run build</code></pre>

    <p class="vg-hint">
      门禁的意义不是「多跑几个命令」，而是<b>任何一项不过就不能合并</b>。
      本地能过、CI 不过，通常是 Node 版本、锁文件、环境变量或大小写敏感（Linux）差异——
      这台项目就踩过「测试用内联数据绕过真实 glob」的坑。
    </p>
  </div>
</template>

<style scoped>
.vg-demo {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* ---------- 控制 ---------- */

.vg-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn-act,
.btn-ghost {
  padding: 0.22rem 0.6rem;
  border-radius: var(--radius-sm);
  font-size: 0.72rem;
  cursor: pointer;
  border: 1px solid var(--primary);
  background-color: transparent;
  color: var(--primary);

  &:hover:not(:disabled) {
    background-color: var(--primary);
    color: #fff;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.btn-ghost {
  border-color: var(--border);
  color: var(--text-secondary);

  &:hover:not(:disabled) {
    background-color: var(--code-bg);
    color: var(--text);
  }
}

.vg-select {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.7rem;
  color: var(--text-secondary);
}

/* 大号下拉固定约 10.5rem，375px 下与按钮同排也不挤出卡片 */
.vg-select-control {
  width: 10.5rem;
}

.vg-select-label {
  flex-shrink: 0;
  white-space: nowrap;
}

.vg-kv {
  font-size: 0.72rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

/* ---------- 结果 ---------- */

.vg-verdict {
  padding: 0.45rem 0.6rem;
  border-radius: var(--radius-sm);
  font-size: 0.76rem;
  font-weight: 600;

  &.pass {
    background-color: color-mix(in srgb, var(--success) 14%, transparent);
    color: var(--success);
  }

  &.fail {
    background-color: color-mix(in srgb, var(--danger) 14%, transparent);
    color: var(--danger);
  }
}

/* ---------- 步骤 ---------- */

.vg-steps {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.vg-step {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background-color: var(--bg);
  transition: border-color 0.15s, background-color 0.15s;

  &.running {
    border-color: var(--primary);
    background-color: var(--primary-soft);
  }

  &.pass {
    border-color: color-mix(in srgb, var(--success) 45%, transparent);
  }

  &.fail {
    border-color: color-mix(in srgb, var(--danger) 55%, transparent);
    background-color: color-mix(in srgb, var(--danger) 8%, transparent);
  }
}

.vg-icon {
  width: 1rem;
  text-align: center;
  font-size: 0.8rem;
  color: var(--text-secondary);

  .running & {
    color: var(--primary);
    animation: vg-spin 1s linear infinite;
  }

  .pass & {
    color: var(--success);
  }

  .fail & {
    color: var(--danger);
  }
}

@keyframes vg-spin {
  to {
    transform: rotate(360deg);
  }
}

.vg-step-main {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
}

.vg-step-label {
  font-size: 0.76rem;
  color: var(--text);
}

.vg-cmd {
  font-family: var(--font-mono);
  font-size: 0.66rem;
  color: var(--text-secondary);
  background-color: var(--code-bg);
  padding: 0.02rem 0.28rem;
  border-radius: 3px;
}

.vg-status {
  font-size: 0.68rem;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.vg-current {
  margin: 0;
  font-size: 0.7rem;
  color: var(--text-secondary);

  code {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    color: var(--primary);
  }
}

/* ---------- 代码 ---------- */

.vg-code {
  margin: 0;
  padding: 0.6rem;
  max-height: 16rem;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--code-bg);
  font-family: var(--font-mono);
  font-size: 0.66rem;
  line-height: 1.7;
  color: var(--text-secondary);
  white-space: pre;
}

.vg-hint {
  margin: 0;
  font-size: 0.72rem;
  color: var(--text-secondary);
  line-height: 1.6;
}
</style>
