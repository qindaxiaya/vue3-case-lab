# 过渡组列表动画

## 1. 现象 / 场景

列表打乱顺序或插入一条后，整列「啪」地瞬间换位置，用户看不出哪一项去了哪里；给每项加 CSS 过渡也没用，因为元素没有触发进入/离开，只是内容顺序变了。

复现步骤：

1. 切到「过渡组（推荐）」，点「打乱顺序」，观察卡片平滑换位。
2. 切到「普通替换（无动画）」，再打乱一次，对比瞬间跳位。
3. 点「添加一条」「删除首条」，观察其余卡片如何自动让位。

## 2. 原理

普通 `v-for` 在数据顺序变化时会复用节点，只更新文本；元素的位置由文档流重新计算，浏览器直接画到新位置，中间没有可插手的帧。

过渡组在更新前先记录每个子元素的旧位置，更新后读取新位置，对需要移动的元素加 `*-move` 类并临时写 `transform` 把它们「拉回」旧位置，下一帧再移除 transform。CSS 的 `transition: transform` 负责补间，所以动画结束时间由 CSS 决定，Vue 只负责加类、删类。

进入和离开用另外两组类：`enter-from/enter-active/enter-to` 与 `leave-from/leave-active/leave-to`。删除时如果离场元素还占着文档流，剩下的元素要等它走完才能补位；给 `leave-active` 加 `position: absolute` 让它脱离文档流，补位动画才能立刻开始。

## 3. 方案：关键代码

```ts
// ① 更新前用 offsetTop 记位置：不受过渡时 transform 影响
function snapshot(): Map<number, number> {
  const positions = new Map<number, number>()
  const nodes = listWrap.value?.querySelectorAll<HTMLElement>('[data-id]') ?? []
  for (const node of nodes) positions.set(Number(node.dataset.id), node.offsetTop)
  return positions
}

items.value = next
await nextTick()

// ② 更新后重新读位置，偏移超过 1px 才算移动
const after = snapshot()
for (const [id, top] of after) {
  const old = before.get(id)
  if (old === undefined) continue
  if (Math.abs(old - top) > 1) movedCount++
}

// ③ 等最后一个 transform 过渡结束；700ms 超时兜底，事件丢失也不卡死
target.addEventListener('transitionend', onEnd)
timer = window.setTimeout(finish, 700)
```

模板里关键是稳定的 key：

```vue
<TransitionGroup tag="ul" name="list" :css="mode === 'animated'">
  <li v-for="item in items" :key="item.id" :data-id="item.id" class="item">
    {{ item.label }}
  </li>
</TransitionGroup>
```

```css
.list-move,
.list-enter-active,
.list-leave-active {
  transition: transform 0.35s var(--ease-out), opacity 0.35s var(--ease-out);
}

.list-leave-active {
  position: absolute;
  left: 0;
  right: 0;
}
```

## 4. 数据对比

| 指标 | 普通替换 | 过渡组 | 测量方式 |
|------|----------|--------|----------|
| 打乱后完成耗时 | 2 ms | 360 ms | 案例「完成耗时」中位数 |
| 动画元素数 | 0 | 5~6 个 | 案例「动画元素」计数 |
| 添加一条 | 立即出现 | 372 ms | 插入首条后等过渡结束 |
| 删除首条 | 立即消失 | 366 ms | 删除后等补位结束 |

测量说明：

- 环境：Chrome headless 155、1200×900、Vite dev；6 条固定数据，打乱用 Fisher-Yates。
- 取样：打乱、添加、删除各跑 3 次取中位数；打乱时移动项数因随机结果在 5~6 之间。
- 普通替换测的是「数据更新到两帧后」，没有过渡可等，所以只有 1~2ms；过渡组测到最后一个 `transitionend`，与 CSS 的 350ms 基本吻合。

## 5. 追问与边界（面试高频）

- Q: 为什么 key 不能用索引？ → A: 索引不变时 Vue 会复用错节点，文本、状态和动画身份都会错位。
- Q: 为什么用 `offsetTop` 而不是 `getBoundingClientRect`？ → A: 过渡组已经给移动元素加了 transform，读矩形拿到的是动画中的位置，会把移动误判为 0。
- Q: 删除时为什么要给离开元素绝对定位？ → A: 它继续占位会拖住后面的元素，补位动画要等离开结束才开始，看起来像卡了一下。

踩坑：

1. 只写 `enter/leave` 过渡 → 重排没有动画，必须写 `*-move`。
2. 离场元素没脱离文档流 → 其余项延迟补位，动画节奏断裂。
3. `transitionend` 只听一次或没有超时 → 事件丢失后按钮永远禁用。

边界：过渡组会为每个移动元素加 transform，长列表（几百项以上）同时移动时开销明显，虚拟列表场景不适合整组动画；真实项目在 `prefers-reduced-motion: reduce` 下应把时长降到接近 0（本演示区为了看清补位过程始终播放，可切「普通替换」看降级后的观感）。元素尺寸变化（宽高动画）不是 `move` 类负责的，需要额外的 FLIP 方案。
