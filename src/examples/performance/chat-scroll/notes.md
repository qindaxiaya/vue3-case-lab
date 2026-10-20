# 聊天流吸底

## 1. 现象 / 场景

用户正在上翻看历史消息，新消息一来列表被强行拽到底部；或者自己发消息后反而停在上面，看不到刚发的内容。

复现步骤：

1. 打开案例，关掉「自动来消息」，把列表滚到顶部。
2. 点两次「模拟对方来消息」，观察是否自动滚动、未读提示是否出现。
3. 输入内容点「发送」，观察是否强制回到底部。

## 2. 原理

判底不能用 `scrollTop === scrollHeight - clientHeight`：像素有小数、滚动惯性、缩放都会差几像素。用「距底距离 < 阈值」判断，阈值一般 60~100px。

Vue 更新 DOM 是异步的：`messages.push()` 之后立刻读 `scrollHeight` 还是旧值，必须 `await nextTick()` 再滚。吸底时直接改 `scrollTop`，不要用 `scrollIntoView({ behavior: 'smooth' })`，连续来消息时平滑滚动会互相打断。

上翻时绝不能改 `scrollTop`，只累计未读数；用户自己发消息是例外，必须 `force` 回底。前插历史消息会改变 `scrollHeight`，要在 `nextTick` 后补上新增高度，视觉位置才不会跳到顶部。

## 3. 方案：关键代码

```ts
async function append(msg: Msg, force = false): Promise<void> {
  messages.value.push(msg)
  // ① 等 DOM 高度更新后再读 scrollHeight，否则拿到的是旧值
  await nextTick()

  if (force || stickToBottom.value) {
    stickToBottom.value = true
    scroller.value!.scrollTop = scroller.value!.scrollHeight
    unread.value = 0
  } else {
    // ② 上翻时只累计未读，绝不改 scrollTop，避免把用户正在看的内容拽走
    unread.value++
  }
}

async function loadHistory(): Promise<void> {
  const el = scroller.value!
  const prevHeight = el.scrollHeight

  messages.value.unshift(...olderMessages)
  await nextTick()

  // ③ 前插后补差：新增多少高度就补多少 scrollTop，视线停在原处
  el.scrollTop += el.scrollHeight - prevHeight
}
```

## 4. 数据对比

| 指标 | 上翻时来 2 条 | 自己发送 1 条 | 测量方式 |
|------|--------------|--------------|----------|
| 距底距离 | 272 px | 0 px | `scrollHeight - scrollTop - clientHeight` |
| 未读提示 | 「2 条新消息 ↓」 | 无 | 页面 `.chat-new` 文本 |
| 吸底状态 | 已上翻（不打扰） | 吸底中 | 页面状态标识 |
| 消息数 | 17 → 19 | 19 → 20 | Demo 面板计数 |

测量说明：

- 环境：Chrome headless 1200×900、Vite dev；同一操作 3 次结果一致。
- 数据规模：初始 12 条，滚到顶部触发加载 5 条历史，关闭自动消息避免干扰。
- 本案例是行为指标，无性能差异；阈值 80px，滚动位置由 Demo 实时计算。

## 5. 追问与边界（面试高频）

- Q: 为什么不用 `scrollIntoView`？ → A: 它会滚动所有可滚动祖先，且 `smooth` 连续调用会互相打断；直接设 `scrollTop` 更可控。
- Q: 图片加载后高度变了还吸底吗？ → A: 用 `ResizeObserver` 观察内容容器，在吸底状态下重新贴底；只监听消息数组不够。
- Q: 上翻加载历史为什么要补 `scrollTop`？ → A: 前插内容会顶高 `scrollHeight`，不补差会瞬间跳到顶部，用户丢失阅读位置。

踩坑：

1. 忘记 `nextTick` → 滚动到的是旧高度，差最后一条消息。
2. 在 `deactivated`/卸载后仍追加消息 → 定时器没清，后台一直涨；案例在 `onBeforeUnmount` 清 interval。
3. iOS 键盘弹出改变可视高度 → 用 `visualViewport` 监听并重新吸底，输入时不要强制滚动。

边界：本案例是交互行为约束，不存在「错误实现」的二态开关；对比项是「上翻时是否拽底」，通过反复操作演示，故未设切换控件。消息很少、没有历史分页时不需要这套逻辑；复杂 IM（虚拟列表 + 图片 + 表情 + 多端同步）建议用成熟聊天组件，吸底与虚拟滚动锚点要一起处理。
