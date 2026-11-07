// ============================================================
// 案例：form-drawer 后台新增 / 编辑抽屉
// 校验、提交 loading、未保存修改保护、失败不关闭
// ============================================================
<script setup lang="ts">
import { computed, nextTick, onUnmounted, reactive, ref } from 'vue'

type Status = 'enabled' | 'disabled'

interface User {
  id: number
  name: string
  owner: string
  status: Status
}

const users = ref<User[]>([
  { id: 1, name: '月度报表', owner: '张三', status: 'enabled' },
  { id: 2, name: '季度报表', owner: '李四', status: 'enabled' },
  { id: 3, name: '用户增长', owner: '王五', status: 'disabled' },
])

const ownerOptions = [
  { label: '张三', value: '张三' },
  { label: '李四', value: '李四' },
  { label: '王五', value: '王五' },
]

const statusOptions = [
  { label: '启用', value: 'enabled' },
  { label: '停用', value: 'disabled' },
]

const open = ref(false)
const editingId = ref<number | null>(null)
const form = reactive({ name: '', owner: '', status: 'enabled' as Status })
const original = ref({ name: '', owner: '', status: 'enabled' as Status })
const errors = reactive({ name: '', owner: '' })
const submitting = ref(false)
const submitError = ref('')
const showDiscard = ref(false)
const failNext = ref(false)
const saveCount = ref(0)
const discardCount = ref(0)
const failCount = ref(0)
const nameInput = ref<{ $el?: HTMLElement } | null>(null)

let alive = true
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const title = computed(() => (editingId.value === null ? '新增用户' : '编辑用户'))
const dirty = computed(
  () =>
    form.name !== original.value.name ||
    form.owner !== original.value.owner ||
    form.status !== original.value.status,
)

/** 打开新增：清空表单和错误 */
function openAdd(): void {
  editingId.value = null
  form.name = ''
  form.owner = ''
  form.status = 'enabled'
  original.value = { name: '', owner: '', status: 'enabled' }
  errors.name = ''
  errors.owner = ''
  submitError.value = ''
  showDiscard.value = false
  open.value = true
  void nextTick(() => focusName())
}

/** 打开编辑：把行数据复制进表单，原值留一份用于判断脏数据 */
function openEdit(user: User): void {
  editingId.value = user.id
  form.name = user.name
  form.owner = user.owner
  form.status = user.status
  original.value = { name: user.name, owner: user.owner, status: user.status }
  errors.name = ''
  errors.owner = ''
  submitError.value = ''
  showDiscard.value = false
  open.value = true
  void nextTick(() => focusName())
}

function focusName(): void {
  const input = nameInput.value?.$el?.querySelector('input')
  input?.focus()
}

function validate(): boolean {
  errors.name = form.name.trim() ? (form.name.trim().length < 2 ? '至少 2 个字' : '') : '请输入名称'
  errors.owner = form.owner ? '' : '请选择负责人'
  return !errors.name && !errors.owner
}

/** 请求关闭：有未保存修改时先显示保护条 */
function requestClose(): void {
  if (submitting.value) return
  if (dirty.value) {
    showDiscard.value = true
    return
  }
  closeDrawer()
}

/** 放弃修改：直接关闭，不保存 */
function discardAndClose(): void {
  discardCount.value++
  closeDrawer()
}

function closeDrawer(): void {
  open.value = false
  showDiscard.value = false
  submitting.value = false
  submitError.value = ''
}

/** 保存：先校验，成功才关；失败留在抽屉里 */
async function submit(): Promise<void> {
  if (submitting.value) return
  if (!validate()) return

  submitting.value = true
  submitError.value = ''
  await wait(500)
  if (!alive) return

  if (failNext.value) {
    failCount.value++
    submitError.value = '保存失败：网络超时'
    submitting.value = false
    return
  }

  if (editingId.value === null) {
    users.value.push({
      id: Math.max(0, ...users.value.map((user) => user.id)) + 1,
      name: form.name.trim(),
      owner: form.owner,
      status: form.status,
    })
  } else {
    users.value = users.value.map((user) =>
      user.id === editingId.value
        ? { ...user, name: form.name.trim(), owner: form.owner, status: form.status }
        : user,
    )
  }

  saveCount.value++
  submitting.value = false
  closeDrawer()
}

function onOwnerChange(value: string | number | boolean | undefined): void {
  form.owner = typeof value === 'string' ? value : ''
}

function onStatusChange(value: string | number | boolean | undefined): void {
  form.status = value === 'disabled' ? 'disabled' : 'enabled'
}

function onFailChange(value: boolean): void {
  failNext.value = value
}

onUnmounted(() => {
  alive = false
})
</script>

<template>
  <div class="fd-demo">
    <p class="hint">
      新增和编辑共用一个抽屉：保存前先校验，提交中锁住关闭，失败留在抽屉里显示原因；
      改了内容直接点关闭，会先出现「放弃修改」保护条。
    </p>

    <section class="panel">
      <div class="panel-head">
        <h3>用户列表</h3>
        <n-button
          type="primary"
          size="small"
          @click="openAdd"
        >
          新增用户
        </n-button>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>名称</th>
            <th>负责人</th>
            <th>状态</th>
            <th class="op-col">
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="user in users"
            :key="user.id"
          >
            <td>{{ user.name }}</td>
            <td>{{ user.owner }}</td>
            <td>
              <span
                class="status"
                :class="`status--${user.status}`"
              >
                {{ user.status === 'enabled' ? '启用' : '停用' }}
              </span>
            </td>
            <td class="op-col">
              <n-button
                class="fd-edit"
                :data-id="user.id"
                size="tiny"
                quaternary
                @click="openEdit(user)"
              >
                编辑
              </n-button>
            </td>
          </tr>
        </tbody>
      </table>

      <dl class="metrics">
        <div class="metric">
          <dt>用户数</dt>
          <dd data-stat="user-count">
            {{ users.length }}
          </dd>
        </div>
        <div class="metric">
          <dt>保存</dt>
          <dd data-stat="save-count">
            {{ saveCount }}
          </dd>
        </div>
        <div class="metric">
          <dt>放弃修改</dt>
          <dd data-stat="discard-count">
            {{ discardCount }}
          </dd>
        </div>
        <div class="metric">
          <dt>保存失败</dt>
          <dd data-stat="fail-count">
            {{ failCount }}
          </dd>
        </div>
      </dl>

      <label class="toggle fd-fail">
        <span>模拟保存失败</span>
        <n-switch
          size="small"
          :value="failNext"
          @update:value="onFailChange"
        />
      </label>
    </section>

    <Teleport to="body">
      <Transition name="fd-slide">
        <div
          v-if="open"
          class="fd-mask"
          @click.self="requestClose"
        >
          <aside
            class="fd-drawer"
            role="dialog"
            aria-modal="true"
            :aria-label="title"
            @keydown.esc="requestClose"
          >
            <header class="fd-head">
              <h3 class="fd-title">
                {{ title }}
              </h3>
              <n-button
                quaternary
                size="small"
                :disabled="submitting"
                @click="requestClose"
              >
                ✕
              </n-button>
            </header>

            <div class="fd-body">
              <label class="field">
                <span>名称</span>
                <n-input
                  ref="nameInput"
                  class="fd-name"
                  :value="form.name"
                  placeholder="2 个字以上"
                  :status="errors.name ? 'error' : undefined"
                  @update:value="form.name = $event"
                />
                <small
                  v-if="errors.name"
                  class="field-error fd-name-error"
                >{{ errors.name }}</small>
              </label>

              <label class="field">
                <span>负责人</span>
                <n-select
                  class="fd-owner"
                  :value="form.owner"
                  :options="ownerOptions"
                  :status="errors.owner ? 'error' : undefined"
                  @update:value="onOwnerChange"
                />
                <small
                  v-if="errors.owner"
                  class="field-error fd-owner-error"
                >{{ errors.owner }}</small>
              </label>

              <label class="field">
                <span>状态</span>
                <n-select
                  class="fd-status"
                  :value="form.status"
                  :options="statusOptions"
                  @update:value="onStatusChange"
                />
              </label>

              <p
                v-if="submitError"
                class="submit-error fd-submit-error"
                role="alert"
              >
                {{ submitError }}
              </p>
            </div>

            <footer class="fd-foot">
              <div
                v-if="showDiscard"
                class="guard fd-guard"
              >
                <span>有未保存修改</span>
                <n-button
                  size="tiny"
                  @click="showDiscard = false"
                >
                  继续编辑
                </n-button>
                <n-button
                  size="tiny"
                  type="error"
                  @click="discardAndClose"
                >
                  放弃并关闭
                </n-button>
              </div>
              <div
                v-else
                class="foot-actions"
              >
                <n-button
                  :disabled="submitting"
                  @click="requestClose"
                >
                  取消
                </n-button>
                <n-button
                  type="primary"
                  :loading="submitting"
                  :disabled="submitting"
                  @click="submit"
                >
                  {{ submitting ? '保存中…' : '保存' }}
                </n-button>
              </div>
            </footer>
          </aside>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.fd-demo {
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

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.5rem;

  h3 {
    margin: 0;
    font-size: var(--demo-text-md);
    color: var(--text);
  }
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--demo-text-sm);

  th,
  td {
    padding: 0.4rem 0.5rem;
    border-bottom: 1px solid var(--border);
    text-align: left;
  }

  th {
    font-size: var(--demo-text-xs);
    font-weight: 600;
    color: var(--text-secondary);
    background-color: var(--bg-subtle);
  }

  tbody tr:last-child td {
    border-bottom: none;
  }
}

.op-col {
  width: 4rem;
  text-align: right;
}

.status {
  display: inline-block;
  padding: 0.1rem 0.45rem;
  border-radius: var(--radius-tag);
  font-size: var(--demo-text-xs);
}

.status--enabled {
  color: var(--success);
  background-color: color-mix(in srgb, var(--success) 12%, transparent);
}

.status--disabled {
  color: var(--text-secondary);
  background-color: var(--bg-subtle);
}

.metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.45rem 0.8rem;
  margin: 0.6rem 0 0;
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
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--text);
  }
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.55rem;
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);
}

.fd-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
  background-color: rgb(0 0 0 / 45%);
}

.fd-drawer {
  display: flex;
  flex-direction: column;
  width: min(26rem, 92vw);
  height: 100%;
  background-color: var(--surface);
  box-shadow: var(--shadow-soft-lg);
}

.fd-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.9rem 1rem;
  border-bottom: 1px solid var(--border);
}

.fd-title {
  margin: 0;
  font-size: 1rem;
  color: var(--text);
}

.fd-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.8rem;
  padding: 1rem;
  overflow: auto;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.field-error {
  color: var(--danger);
}

.submit-error {
  margin: 0;
  padding: 0.45rem 0.55rem;
  border-radius: var(--radius-tag);
  background-color: var(--danger-soft);
  font-size: var(--demo-text-xs);
  line-height: 1.6;
  color: var(--danger);
}

.fd-foot {
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border);
}

.foot-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.45rem;
}

.guard {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  font-size: var(--demo-text-xs);
  color: var(--warning);
}

.fd-slide-enter-active,
.fd-slide-leave-active {
  transition: opacity 0.18s ease;
}

.fd-slide-enter-active .fd-drawer,
.fd-slide-leave-active .fd-drawer {
  transition: transform 0.18s var(--ease-out);
}

.fd-slide-enter-from,
.fd-slide-leave-to {
  opacity: 0;
}

.fd-slide-enter-from .fd-drawer,
.fd-slide-leave-to .fd-drawer {
  transform: translateX(100%);
}

@media (max-width: 768px) {
  .metrics {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
