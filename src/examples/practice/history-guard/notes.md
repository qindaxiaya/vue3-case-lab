# History 拦截返回

## 1. 现象与场景

表单填了一半，用户点浏览器返回，内容直接没了；用 `beforeunload` 只能管关闭/刷新，管不了 SPA 内部返回。

复现：修改表单让页面变「未保存」，点「模拟浏览器返回」，弹出确认；取消后仍留在当前页。

## 2. 原理

SPA 的返回分两类：路由内部跳转用 `onBeforeRouteLeave` 守卫，能直接 `next(false)` 取消；浏览器前进/后退触发 `popstate`，此时导航已经发生，无法「阻止」，只能取消后再 `pushState` 把历史栈顶回去。

`beforeunload` 负责关闭标签/刷新，现代浏览器忽略自定义文案，只显示默认提示。`popstate` 拦截要加「放行标记」，否则用户确认离开后 `history.back()` 会再次触发并弹第二次。

## 3. 关键代码

```ts
onBeforeRouteLeave((_to, _from, next) => {
  if (!dirty.value) return next()
  // 1. 路由守卫可以真正取消导航
  if (window.confirm('有未保存的修改，确定离开？')) next()
})

history.pushState({ guard: true }, '', location.href)
let allowed = false

window.addEventListener('popstate', () => {
  // 2. 已确认离开就放行，避免二次弹窗
  if (allowed) return
  if (!dirty.value) return
  if (window.confirm('有未保存的修改，确定离开？')) {
    allowed = true
    history.back()
  } else {
    // 3. 取消：补一条记录，抵消刚才的返回
    history.pushState({ guard: true }, '', location.href)
  }
})
```

## 4. 数据对比

| 指标 | 不拦截 | 拦截 |
|---|---|---|
| 浏览器返回 | 直接离开 | 弹确认 |
| 取消后 | 数据丢失 | 留在原页（补 1 条历史） |
| 确认后 | — | 放行 1 次，不重复弹窗 |
| 关闭/刷新 | 直接丢 | `beforeunload` 提示 |

测量方式：Chrome headless 1200×900，修改表单后点「模拟浏览器返回」，记录弹窗次数与最终页面；取消/确认各走一次。真实浏览器手势返回行为需真机验证。

## 5. 追问与边界

**Q：`popstate` 能阻止返回吗？**
不能。只能「返回后补记录顶回去」，URL 会闪一下；要真正阻止只能用路由守卫。

**Q：为什么确认后还会再弹一次？**
没加 `allowed` 放行标记，`history.back()` 再次触发 `popstate` 又进入拦截逻辑。

**Q：什么时候该拦截？**
只在「真正会丢数据」时；滥用会让用户无法离开页面。

坑：重复 `addEventListener` 会叠加，卸载时要移除同一个 handler。边界：`beforeunload` 需要用户有交互才生效；iOS 手势返回体验差异大，需单独测试。
