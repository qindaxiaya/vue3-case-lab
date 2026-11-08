// ============================================================
// 案例：notification-center 通知中心
// 全部 / 未读切换、单条已读、全部已读、重置
// ============================================================
<script setup lang="ts">
import { computed, ref } from 'vue'

// ============================================================
// 数据与状态
// ============================================================

type NoticeType = 'system' | 'todo' | 'alert'
type Tab = 'all' | 'unread'

interface Notice {
  id: number
  type: NoticeType
  title: string
  detail: string
  time: string
  read: boolean
}

const initialNotices: Notice[] = [
  { id: 1, type: 'todo', title: '有 3 条审批待处理', detail: '采购申请等待你确认', time: '10:24', read: false },
  { id: 2, type: 'system', title: '系统将于今晚维护', detail: '23:00 - 23:30 暂停写入', time: '09:50', read: false },
  { id: 3, type: 'alert', title: '库存低于安全线', detail: '机械键盘 Pro 剩余 8 件', time: '09:12', read: false },
  { id: 4, type: 'todo', title: '季度报表待提交', detail: '截止时间还有 2 天', time: '昨天', read: false },
  { id: 5, type: 'system', title: '新版权限已生效', detail: '你已获得财务看板访问权限', time: '昨天', read: true },
  { id: 6, type: 'alert', title: '接口错误率短时升高', detail: '已自动恢复，无需处理', time: '周一', read: true },
]

const notices = ref<Notice[]>(initialNotices.map((notice) => ({ ...notice })))
const tab = ref<Tab>('all')
const resetCount = ref(0)
const lastAction = ref('初始状态')

const unreadCount = computed(() => notices.value.filter((notice) => !notice.read).length)
const readCount = computed(() => notices.value.length - unreadCount.value)
const visibleNotices = computed(() =>
  tab.value === 'all' ? notices.value : notices.value.filter((notice) => !notice.read),
)

const typeText: Record<NoticeType, string> = {
  system: '系统',
  todo: '待办',
  alert: '告警',
}

const typeTag: Record<NoticeType, 'default' | 'info' | 'warning'> = {
  system: 'info',
  todo: 'default',
  alert: 'warning',
}

// ============================================================
// 操作
// ============================================================

/** 点单条通知：只改这一条，不碰其他未读 */
function markRead(notice: Notice): void {
  if (notice.read) return
  notice.read = true
  lastAction.value = `已读：${notice.title}`
}

/** 全部已读：一次改完，列表按当前 tab 自动刷新 */
function markAllRead(): void {
  if (unreadCount.value === 0) return
  for (const notice of notices.value) notice.read = true
  lastAction.value = '全部已读'
}

function setTab(value: string | number | boolean | undefined): void {
  tab.value = value === 'unread' ? 'unread' : 'all'
}

function reset(): void {
  notices.value = initialNotices.map((notice) => ({ ...notice }))
  tab.value = 'all'
  resetCount.value++
  lastAction.value = '已重置'
}
</script>

<template>
  <div class="nc-demo">
    <p class="hint">
      通知中心的红点只是入口：列表要能按全部 / 未读切换，单条点开即已读，
      全部已读后未读列表应该立刻空掉，而不是等刷新。
    </p>

    <section class="panel">
      <header class="panel-head">
        <div class="title-row">
          <h3>通知中心</h3>
          <span
            v-if="unreadCount"
            class="unread-badge"
            data-stat="unread-badge"
          >{{ unreadCount }}</span>
        </div>

        <n-radio-group
          :value="tab"
          size="small"
          @update:value="setTab"
        >
          <n-radio-button value="all">
            全部
          </n-radio-button>
          <n-radio-button value="unread">
            未读 {{ unreadCount }}
          </n-radio-button>
        </n-radio-group>
      </header>

      <div class="actions">
        <n-button
          size="small"
          :disabled="unreadCount === 0"
          @click="markAllRead"
        >
          全部已读
        </n-button>
        <n-button
          size="small"
          quaternary
          @click="reset"
        >
          重置
        </n-button>
        <span
          class="last-action"
          data-stat="last-action"
        >{{ lastAction }}</span>
      </div>

      <ul class="notice-list">
        <li
          v-for="notice in visibleNotices"
          :key="notice.id"
        >
          <n-button
            quaternary
            block
            class="notice"
            :class="{ 'notice--unread': !notice.read }"
            :data-notice="notice.id"
            :data-unread="!notice.read"
            @click="markRead(notice)"
          >
            <span class="notice-main">
              <span class="notice-title">
                <span
                  v-if="!notice.read"
                  class="dot"
                />
                {{ notice.title }}
              </span>
              <span class="notice-detail">{{ notice.detail }}</span>
            </span>
            <span class="notice-side">
              <n-tag
                size="small"
                :type="typeTag[notice.type]"
              >
                {{ typeText[notice.type] }}
              </n-tag>
              <span class="notice-time">{{ notice.time }}</span>
            </span>
          </n-button>
        </li>
      </ul>

      <p
        v-if="visibleNotices.length === 0"
        class="empty"
        data-stat="empty"
      >
        没有未读通知
      </p>
    </section>

    <dl class="metrics">
      <div class="metric">
        <dt>未读</dt>
        <dd data-stat="unread-count">
          {{ unreadCount }}
        </dd>
      </div>
      <div class="metric">
        <dt>已读</dt>
        <dd data-stat="read-count">
          {{ readCount }}
        </dd>
      </div>
      <div class="metric">
        <dt>当前列表</dt>
        <dd data-stat="visible-count">
          {{ visibleNotices.length }}
        </dd>
      </div>
      <div class="metric">
        <dt>标签页</dt>
        <dd data-stat="tab">
          {{ tab === 'all' ? '全部' : '未读' }}
        </dd>
      </div>
      <div class="metric">
        <dt>重置次数</dt>
        <dd data-stat="reset-count">
          {{ resetCount }}
        </dd>
      </div>
    </dl>

    <p class="footnote">
      真实项目里未读数通常由接口返回；点单条时先本地置读再发请求，失败要回滚，
      避免红点数字和列表状态对不上。
    </p>
  </div>
</template>

<style scoped>
.nc-demo {
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

.panel {
  padding: var(--demo-block-pad);
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg);
}

.panel-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.title-row {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.panel-head h3 {
  margin: 0;
  font-size: var(--demo-text-md);
  font-weight: 600;
  color: var(--text);
}

.unread-badge {
  min-width: 1.15rem;
  padding: 0 0.3rem;
  border-radius: var(--radius-tag);
  background-color: var(--danger);
  color: #fff;
  font-family: var(--font-mono);
  font-size: var(--demo-text-xs);
  line-height: 1.15rem;
  text-align: center;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.5rem;
}

.last-action {
  margin-left: auto;
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.notice-list {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin: 0.55rem 0 0;
  padding: 0;
  list-style: none;
}

.notice {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  text-align: left;
}

.notice--unread {
  background-color: var(--bg-subtle);
}

.notice-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.1rem;
}

.notice-title {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: var(--demo-text-sm);
  color: var(--text);
}

.notice-detail {
  overflow: hidden;
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dot {
  display: inline-block;
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background-color: var(--primary);
}

.notice-side {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.35rem;
}

.notice-time {
  font-family: var(--font-mono);
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.empty {
  margin: 0.6rem 0 0;
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.metrics {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
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
  .metrics {
    grid-template-columns: 1fr 1fr;
  }

  .last-action {
    width: 100%;
    margin-left: 0;
  }
}
</style>
