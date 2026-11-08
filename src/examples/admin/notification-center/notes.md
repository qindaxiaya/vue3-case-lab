# NotificationCenter：通知中心别只做红点

## 1. 现象 / 场景

顶栏有个红点，点进去却是全部通知混在一起；用户点开一条，红点数字没变；点「全部已读」后未读列表还留着旧数据，得刷新才干净。

复现步骤：

1. 打开案例，6 条通知，未读 4、已读 2。
2. 点第一条未读「有 3 条审批待处理」，未读变成 3，已读变成 3。
3. 切到「未读」标签，列表只剩 3 条。
4. 点「全部已读」，未读变 0，当前未读列表变空。
5. 点「重置」，回到未读 4、已读 2、全部列表 6 条。

## 2. 原理

通知中心有三份互相关联的状态：通知列表、未读筛选、未读计数。很多实现只改其中一份，导致红点、列表、按钮状态对不上。

正确做法是让它们都从同一份 `notices` 派生：未读数用 `computed` 数 `read === false` 的条数，未读列表用 `computed` 过滤，切换标签只改筛选条件。不要额外维护一个未读数组，否则单条已读、全部已读、重置时都要记得同步两份数据。

单条已读要幂等：已经读过的通知再点一次不能重复减未读数。全部已读要一次改完，并让「全部已读」按钮在未读为 0 时禁用。

## 3. 方案：关键代码

```ts
//! 未读数和未读列表都从同一份 notices 派生，不维护第二份数组
const unreadCount = computed(() => notices.value.filter((notice) => !notice.read).length)
const visibleNotices = computed(() =>
  tab.value === 'all' ? notices.value : notices.value.filter((notice) => !notice.read),
)

//! 点单条只改这一条，不碰其他未读
function markRead(notice: Notice): void {
  if (notice.read) return
  notice.read = true
}

//! 全部已读：一次改完，列表按当前 tab 自动刷新
function markAllRead(): void {
  if (unreadCount.value === 0) return
  for (const notice of notices.value) notice.read = true
}

//! 重置要连筛选状态一起回初始，否则用户会停在「未读 0」的空列表
function reset(): void {
  notices.value = initialNotices.map((notice) => ({ ...notice }))
  tab.value = 'all'
}
```

三处关键选择：

1. `unreadCount` 和 `visibleNotices` 都从 `notices` 派生，任何一条 `read` 变化都会自动更新红点和列表。
2. `markRead` 先判断 `notice.read`，避免已读通知重复点击时重复计数。
3. `reset` 不只恢复数据，还把 `tab` 切回「全部」，否则用户会停在未读为 0 的空列表。

## 4. 数据对比

| 操作 | 未读 | 已读 | 当前列表 | 测量方式 |
| --- | --- | --- | --- | --- |
| 初始（全部） | 4 | 2 | 6 | 页面 data-stat 读数 |
| 点第一条未读 | 3 | 3 | 6 | 同上 |
| 切到未读 | 3 | 3 | 3 | 同上 |
| 全部已读 | 0 | 6 | 0 | 同上 |
| 重置 | 4 | 2 | 6 | 重置次数 +1 |

测量说明：

- 环境：本机 Chrome，案例页 `/cases/admin/notification-center`。
- 取样：`npm run check:ui -- --only 通知中心` 的常驻场景，同一页面顺序执行。
- 数据是 Demo 固定值；真实项目的未读数由接口返回，本地置读后要处理失败回滚。

## 5. 追问与边界（面试高频）

- Q: 为什么不在点击时直接 `unreadCount--`？ → A: 计数应该从数据派生，手动减容易和列表不同步；重复点击还会多减。
- Q: 未读数放接口还是前端算？ → A: 列表数据全量在前端时可以前端算；只拿分页数据时接口要给未读总数。
- Q: 点单条已读要不要等接口成功？ → A: 可以先本地置读（乐观更新），失败再回滚；否则每次点击都要等网络。

踩坑（≤3 条）：

1. 维护第二份未读数组：单条已读只改列表不改数组，红点数字对不上 → 全部从 `notices` 派生。
2. 全部已读只改当前页：切到全部还有未读 → 遍历整份数据，不是当前筛选结果。
3. 重置只恢复数据不恢复标签：用户停在「未读 0」的空列表，以为数据没回来 → 筛选状态一起重置。

边界：真实项目还要处理通知分组、已读回执、多端同步；本例只做单页列表与未读状态，不展开服务端推送。
