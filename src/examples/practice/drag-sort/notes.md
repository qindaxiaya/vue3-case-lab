# 指针拖拽排序

## 1. 现象与场景

用 HTML5 拖拽做排序，移动端完全拖不动；快速拖动时鼠标一甩出元素，行就卡在半路，`pointerup` 收不到。

复现：按住任意行上下拖动，拖过半行高才换位；松手后其余行用 220ms 动画让位。

## 2. 原理

Pointer 事件统一鼠标、触屏、触控笔。按下时 `setPointerCapture` 把后续 move/up 都锁定到当前元素，即使指针移出元素也能收到，避免「丢 up」。

换位判断用「位移 / 行高」四舍五入：不足半行不动，过半行才交换，防止在边界来回抖。松手后用 FLIP 动画：先记录所有行的旧位置，改数据并等 `nextTick`，再反向位移并用 WAAPI 动画回 0，视觉上平滑过渡。

## 3. 关键代码

```ts
function onPointerDown(e: PointerEvent, index: number): void {
  if (e.button !== 0) return
  dragIndex.value = index
  startY = e.clientY
  // 1. 捕获指针，移出元素也能继续收到 move/up
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent): void {
  dragY.value = e.clientY - startY
  // 2. 过半行才换位，避免边界抖动
  const target = dragIndex.value + Math.round(dragY.value / ROW_HEIGHT)
  overIndex.value = clamp(target, 0, items.length - 1)
}

async function onPointerUp(): Promise<void> {
  const prev = new Map<number, DOMRect>()
  rows().forEach((el) => prev.set(Number(el.dataset.id), el.getBoundingClientRect()))
  const [item] = items.splice(from, 1)
  items.splice(to, 0, item)
  // 3. 必须等 DOM 更新后再测量新位置
  await nextTick()
  rows().forEach((el) => {
    const before = prev.get(Number(el.dataset.id))
    if (!before) return
    const after = el.getBoundingClientRect()
    const dx = before.left - after.left
    const dy = before.top - after.top
    if (dx || dy) el.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
      { duration: 220, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
    )
  })
}
```

## 4. 数据对比

| 指标 | 数值 |
|---|---|
| 行高 | 固定（位移换算基准） |
| 换位阈值 | 半行 |
| FLIP 动画时长 | 220 ms |
| 丢 pointerup | 0（指针捕获） |

测量方式：Chrome headless 1200×900 拖动行，观察目标行高亮与松手后的让位动画；阈值与时长来自 Demo 配置。移动端需实际设备验证触摸手感。

## 5. 追问与边界

**Q：为什么不用 HTML5 `draggable`？**
移动端基本不支持，拖拽影像无法自定义，还要大量 `dragover preventDefault`；Pointer 事件更可控。

**Q：`v-for` 的 key 能用 index 吗？**
不能。拖拽中列表重排，index 变化会导致 Vue 复用错节点，动画和输入状态都会错乱，必须用稳定 id。

**Q：长列表拖到边缘怎么办？**
容器顶部/底部要自动滚动；自己实现较麻烦，真实项目优先用 `useSortable`（SortableJS）或 vuedraggable。

坑：容器忘记 `touch-action: none`，移动端拖动会变成页面滚动。边界：跨列表拖拽、网格布局、无障碍键盘排序都建议用成熟库。
