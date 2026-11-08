// ============================================================
// 案例：quick-view-drawer 行快速查看
// 行内打开只读抽屉，上下条连续查看，关闭归还焦点
// ============================================================
<script setup lang="ts">
import { computed, ref } from 'vue'

type Status = 'pending' | 'done'

interface Order {
  id: number
  customer: string
  amount: number
  status: Status
  address: string
  createdAt: string
  note: string
}

const orders: Order[] = [
  {
    id: 1,
    customer: '张三',
    amount: 1280,
    status: 'pending',
    address: '上海市浦东新区世纪大道 100 号',
    createdAt: '2026-11-01 09:12',
    note: '工作日送达，电话联系',
  },
  {
    id: 2,
    customer: '李四',
    amount: 460,
    status: 'done',
    address: '北京市朝阳区建国路 88 号',
    createdAt: '2026-11-02 14:30',
    note: '已签收',
  },
  {
    id: 3,
    customer: '王五',
    amount: 2199,
    status: 'pending',
    address: '杭州市西湖区文三路 18 号',
    createdAt: '2026-11-03 10:05',
    note: '需要发票',
  },
  {
    id: 4,
    customer: '赵六',
    amount: 320,
    status: 'done',
    address: '成都市高新区天府大道 666 号',
    createdAt: '2026-11-04 16:40',
    note: '放前台',
  },
  {
    id: 5,
    customer: '孙七',
    amount: 980,
    status: 'pending',
    address: '广州市天河区体育西路 20 号',
    createdAt: '2026-11-05 11:22',
    note: '周末不收货',
  },
  {
    id: 6,
    customer: '周八',
    amount: 1560,
    status: 'done',
    address: '深圳市南山区科技园 8 号',
    createdAt: '2026-11-06 08:55',
    note: '已开票',
  },
]

const show = ref(false)
const activeIndex = ref(-1)
const triggerEl = ref<HTMLElement | null>(null)
const rowButtons = new Map<number, HTMLElement>()

const activeOrder = computed(() => orders[activeIndex.value] ?? null)
const prevDisabled = computed(() => activeIndex.value <= 0)
const nextDisabled = computed(
  () => activeIndex.value < 0 || activeIndex.value >= orders.length - 1,
)

/** 收集每行按钮的真实 DOM，组件库的 click 事件不一定带 currentTarget */
function setRowButton(id: number, el: unknown): void {
  const component = el as { $el?: unknown } | null
  const node = component?.$el ?? el
  if (node instanceof HTMLElement) rowButtons.set(id, node)
  else rowButtons.delete(id)
}

/**! 打开时记住触发按钮，关闭后焦点要回到原处，键盘用户才不会迷路 */
function open(index: number): void {
  triggerEl.value = rowButtons.get(orders[index].id) ?? null
  activeIndex.value = index
  show.value = true
}

function close(): void {
  show.value = false
}

function prev(): void {
  if (!prevDisabled.value) activeIndex.value--
}

function next(): void {
  if (!nextDisabled.value) activeIndex.value++
}

function restoreFocus(): void {
  const target = triggerEl.value
  // 抽屉内部的焦点陷阱可能在退场后还会把焦点拉回去，等一拍再归还
  window.setTimeout(() => target?.focus(), 0)
}

function reset(): void {
  show.value = false
  activeIndex.value = -1
  triggerEl.value = null
}

const statusText = (status: Status): string => (status === 'pending' ? '待处理' : '已完成')
</script>

<template>
  <div class="qvd-demo">
    <p class="hint">
      看详情不必离开列表：行内「查看」打开只读抽屉，上下条连续翻。
      关闭或按 Escape 后，焦点要回到刚才那一行的按钮。
    </p>

    <span
      class="probe"
      data-stat="drawer-open"
    >{{ show ? 'true' : 'false' }}</span>
    <span
      class="probe"
      data-stat="active-id"
    >{{ activeOrder?.id ?? '—' }}</span>
    <span
      class="probe"
      data-stat="active-index"
    >{{ activeIndex }}</span>
    <span
      class="probe"
      data-stat="prev-disabled"
    >{{ prevDisabled ? 'true' : 'false' }}</span>
    <span
      class="probe"
      data-stat="next-disabled"
    >{{ nextDisabled ? 'true' : 'false' }}</span>
    <section class="panel">
      <table class="table">
        <thead>
          <tr>
            <th>订单</th>
            <th>客户</th>
            <th class="amount-col">
              金额
            </th>
            <th>状态</th>
            <th class="action-col">
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(order, index) in orders"
            :key="order.id"
          >
            <td class="mono">
              #{{ order.id }}
            </td>
            <td>{{ order.customer }}</td>
            <td class="amount-col mono">
              ¥{{ order.amount }}
            </td>
            <td>
              <span
                class="status"
                :class="`status--${order.status}`"
              >
                {{ statusText(order.status) }}
              </span>
            </td>
            <td class="action-col">
              <n-button
                :ref="(el) => setRowButton(order.id, el)"
                size="tiny"
                :data-open="order.id"
                @click="open(index)"
              >
                查看
              </n-button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <n-drawer
      v-model:show="show"
      placement="right"
      :width="360"
      content-class="qvd-drawer"
      :close-on-esc="true"
      @after-leave="restoreFocus"
    >
      <n-drawer-content title="订单详情">
        <div
          v-if="activeOrder"
          class="detail"
        >
          <div class="detail-head">
            <span class="detail-id">#{{ activeOrder.id }}</span>
            <span
              class="status"
              :class="`status--${activeOrder.status}`"
            >
              {{ statusText(activeOrder.status) }}
            </span>
          </div>
          <dl class="fields">
            <div>
              <dt>客户</dt>
              <dd>{{ activeOrder.customer }}</dd>
            </div>
            <div>
              <dt>金额</dt>
              <dd class="mono">
                ¥{{ activeOrder.amount }}
              </dd>
            </div>
            <div>
              <dt>创建时间</dt>
              <dd class="mono">
                {{ activeOrder.createdAt }}
              </dd>
            </div>
            <div>
              <dt>地址</dt>
              <dd>{{ activeOrder.address }}</dd>
            </div>
            <div>
              <dt>备注</dt>
              <dd>{{ activeOrder.note }}</dd>
            </div>
          </dl>
          <p class="readonly-note">
            抽屉里只读展示，避免用户以为改完会自动保存。
          </p>
        </div>

        <template #footer>
          <div class="drawer-actions">
            <n-button
              size="small"
              :disabled="prevDisabled"
              data-action="prev"
              @click="prev"
            >
              上一条
            </n-button>
            <n-button
              size="small"
              :disabled="nextDisabled"
              data-action="next"
              @click="next"
            >
              下一条
            </n-button>
            <n-button
              size="small"
              type="primary"
              data-action="close"
              @click="close"
            >
              关闭
            </n-button>
          </div>
        </template>
      </n-drawer-content>
    </n-drawer>

    <div class="toolbar">
      <n-button
        size="small"
        quaternary
        data-action="reset"
        @click="reset"
      >
        重置
      </n-button>
    </div>

    <p class="footnote">
      抽屉只读，所以不需要保存按钮；上下条直接切换当前索引，到首尾把按钮禁用。
      关闭后把焦点还给触发按钮，用户按键盘也能继续在原位置操作。
    </p>
  </div>
</template>

<style scoped>
.qvd-demo {
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

.probe {
  display: none;
}

.panel {
  padding: var(--demo-block-pad);
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg);
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--demo-text-sm);

  th,
  td {
    padding: 0.45rem 0.5rem;
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

.mono {
  font-family: var(--font-mono);
}

.amount-col {
  text-align: right;
}

.action-col {
  width: 4rem;
  text-align: right;
}

.status {
  display: inline-block;
  padding: 0.1rem 0.45rem;
  border-radius: var(--radius-tag);
  font-size: var(--demo-text-xs);
}

.status--pending {
  color: var(--warning);
  background-color: color-mix(in srgb, var(--warning) 12%, transparent);
}

.status--done {
  color: var(--success);
  background-color: color-mix(in srgb, var(--success) 12%, transparent);
}

.detail {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.detail-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.detail-id {
  font-family: var(--font-mono);
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--primary);
}

.fields {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin: 0;

  dt {
    font-size: var(--demo-text-xs);
    color: var(--text-secondary);
  }

  dd {
    margin: 0.1rem 0 0;
    font-size: var(--demo-text-sm);
    line-height: 1.6;
    color: var(--text);
    overflow-wrap: anywhere;
  }
}

.readonly-note {
  margin: 0;
  padding: 0.45rem 0.6rem;
  border-radius: var(--demo-radius);
  background-color: var(--bg-subtle);
  font-size: var(--demo-text-xs);
  line-height: 1.6;
  color: var(--text-secondary);
}

.drawer-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.4rem;
}

.toolbar {
  display: flex;
  justify-content: flex-end;
}

.footnote {
  margin: 0;
  font-size: var(--demo-text-xs);
  line-height: 1.7;
  color: var(--text-secondary);
}

@media (max-width: 640px) {
  .amount-col {
    display: none;
  }
}
</style>
