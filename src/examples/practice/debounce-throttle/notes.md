# 防抖节流波形对比

## 1. 现象与场景

搜索框每敲一个字就发一次请求，后端被打满；滚动监听每秒触发上百次，埋点上报把主线程堵住。

复现：在输入框连续输入，观察防抖波形只在停手 500ms 后出现一次；滚动时节流波形每 100ms 最多一次。

## 2. 原理

防抖（debounce）：每次触发都清掉上一个定时器，重新计时，只有「停手」达到设定时间才执行。适合搜索、窗口 resize 结束后计算。

节流（throttle）：固定时间窗口内最多执行一次，窗口内的后续触发被丢弃或延后。适合滚动、拖拽、鼠标移动等持续高频事件。

两者都有 leading/trailing、cancel、maxWait 等边界，手写容易漏；真实项目直接用 VueUse 的 `useDebounceFn` / `useThrottleFn`，它们会跟随组件生命周期清理。

## 3. 关键代码

```ts
import { useDebounceFn, useThrottleFn, watchDebounced } from '@vueuse/core'

// 1. 搜索：停手 500ms 才真正发请求
const onSearch = useDebounceFn((v: string) => {
  console.log('真正发起搜索：', v)
}, 500)

// 2. 滚动埋点：100ms 窗口内最多上报一次
const onScroll = useThrottleFn(() => {
  report(scrollY.value)
}, 100)

// 3. 侦听器版本：连事件绑定都省了，卸载自动清理
watchDebounced(keyword, (v) => search(v), { debounce: 500 })
```

## 4. 数据对比

| 指标 | 防抖 | 节流 |
|---|---|---|
| 连续输入 10 次（间隔 100ms） | 执行 1 次（停手后） | 每 100ms 1 次（节流间隔） |
| 首次响应 | 延迟 500ms | 可 leading 立即一次 |
| 适用 | 搜索、校验、resize 结束 | 滚动、拖拽、曝光上报 |
| 计时器清理 | 组件卸载自动 | 组件卸载自动 |

测量方式：Chrome headless 1200×900，观察 Demo 波形与执行计数；参数 500ms / 100ms 来自页面配置。计数随输入节奏变化，结论是「防抖合并到最后一次，节流均匀放行」。

## 5. 追问与边界

**Q：防抖会不会让用户觉得慢？**
会。搜索可配 `maxWait` 或 leading，让长时间连续输入也定期出结果；输入联想常用 300ms 左右。

**Q：节流用时间戳还是定时器？**
时间戳实现 leading，定时器实现 trailing；完整实现两者都要，VueUse 已处理。

**Q：什么时候不该用？**
需要每一次事件都精确处理的场景（如绘图轨迹、表单逐字校验）不能丢事件，应改用 rAF 合并或直接处理。

坑：在 `watch` 里包防抖但依赖数组写错，仍会频繁触发。边界：防抖节流只是降低频率，不能替代请求取消；搜索还要配 `AbortController` 处理竞态。
