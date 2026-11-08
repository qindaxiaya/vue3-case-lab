# QuickViewDrawer：看详情别离开列表

## 1. 现象 / 场景

表格里点「查看」跳到详情页，回来筛选和页码全丢了；用弹窗看详情又挡住列表，上下条切换还要反复关闭再点下一行。

复现步骤：

1. 点第 3 行「查看」，右侧抽屉打开，当前 id 3。
2. 点两次「下一条」，当前 id 变成 5；点「上一条」回到 4。
3. 点「关闭」，抽屉消失，焦点回到第 3 行的「查看」按钮。
4. 点第 6 行「查看」，下一条禁用、上一条可用。
5. 按 Escape，抽屉关闭，焦点回到第 6 行按钮。
6. 点「重置」，抽屉保持关闭，当前 id 清空。

## 2. 原理

快速查看的目标是「不离开列表」：抽屉从右侧滑出，列表还在；只读展示，不需要保存；上下条直接切换当前索引，到首尾禁用。

抽屉关闭后焦点要回到触发按钮。不还焦点，键盘用户会掉到页面顶部，得重新 Tab 回表格。

上下条不是两个独立按钮，它们只改 activeIndex，详情内容从当前索引派生。这样切换时不用重新请求列表，也不会出现「抽屉内容和列表行对不上」。

## 3. 方案：关键代码

```ts
const show = ref(false)
const activeIndex = ref(-1)
const triggerEl = ref<HTMLElement | null>(null)

const activeOrder = computed(() => orders[activeIndex.value] ?? null)
const prevDisabled = computed(() => activeIndex.value <= 0)
const nextDisabled = computed(
  () => activeIndex.value < 0 || activeIndex.value >= orders.length - 1,
)

/**! 打开时记住触发按钮，关闭后焦点要回到原处，键盘用户才不会迷路 */
function open(index: number, event: MouseEvent): void {
  triggerEl.value = event.currentTarget as HTMLElement
  activeIndex.value = index
  show.value = true
}

function restoreFocus(): void {
  triggerEl.value?.focus()
}
```

三处关键选择：

1. 用 activeIndex 而不是复制一份订单对象：上下条只改索引，详情永远和列表同一份数据。
2. 首尾禁用由索引边界派生：`prevDisabled` 和 `nextDisabled` 不会各写一套判断。
3. after-leave 再归还焦点：抽屉还在退场时抢焦点会被它自己的焦点陷阱拉回去。

## 4. 数据对比

| 操作 | 当前 id | 索引 | 上一条 | 下一条 | 焦点 | 测量方式 |
| --- | --- | --- | --- | --- | --- | --- |
| 初始 | 无 | -1 | 禁用 | 禁用 | 页面 | 页面 data-stat 读数 |
| 打开第 3 行 | 3 | 2 | 可用 | 可用 | 抽屉 | 同上 |
| 下一条两次 | 5 | 4 | 可用 | 可用 | 抽屉 | 同上 |
| 上一条 | 4 | 3 | 可用 | 可用 | 抽屉 | 同上 |
| 关闭 | 4 | 3 | 可用 | 可用 | 第 3 行按钮 | 读 activeElement |
| 打开第 6 行 | 6 | 5 | 可用 | 禁用 | 抽屉 | 同上 |
| Escape | 6 | 5 | 可用 | 禁用 | 第 6 行按钮 | 读 activeElement |
| 重置 | 无 | -1 | 禁用 | 禁用 | 页面 | 同上 |

测量说明：

- 环境：本机 Chrome，案例页 `/cases/admin/quick-view-drawer`。
- 取样：npm run check:ui -- --base http://localhost:5174 --only 快速查看 的常驻场景。
- Escape 由页面派发键盘事件触发，焦点用 document.activeElement 读取。

## 5. 追问与边界（面试高频）

- Q: 为什么用抽屉而不是弹窗？ → A: 抽屉从侧边出现，列表仍可见，适合「边看边对照」；弹窗居中会遮住列表，连续查看时更打断。
- Q: 上下条要不要重新请求详情？ → A: 列表已有摘要时直接切换；如果详情字段多，可以按 id 懒加载并缓存，但当前索引和禁用边界不变。
- Q: 只读抽屉需要保存按钮吗？ → A: 不需要。放了保存按钮用户会以为能改，反而增加误操作；要编辑就单独提供「编辑」入口。

踩坑（≤3 条）：

1. 关闭后不还焦点：键盘用户回到页面顶部 → 记录触发元素，在 after-leave 里等一拍再 focus，避免被抽屉的焦点陷阱拉回。
2. 上下条各自判断边界：一个用小于、一个用小于等于，首尾总有一个按钮状态不对 → 统一从 activeIndex 派生。
3. 抽屉打开时复制一份行数据：上下条切换后详情还是旧行 → 详情只读当前索引对应的订单。

边界：抽屉内编辑、详情懒加载、列表滚动位置恢复不在本例范围；真实项目还要考虑抽屉宽度在窄屏上的适配。
