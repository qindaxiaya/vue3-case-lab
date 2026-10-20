# 路由转场动画（方向）

## 1. 现象与场景

页面切换想要「前进从左滑入、后退从右滑入」，结果两个页面同时存在、重叠闪烁；返回时动画方向还是前进。

复现：在首页 → 列表 → 详情 → 评价之间切换，前进/后退方向不同；点「← 返回」观察反向动画。

## 2. 原理

方向由路由深度决定：首页 0、列表 1、详情 2，`to.depth >= from.depth` 视为前进，否则后退。深度可以在路由 `meta` 手动标注，也可以用 `history.state.position` 比较。

`<Transition>` 的 `name` 按方向切换，两套 CSS 的进出方向相反。必须加 `mode="out-in"`，否则新旧页面同时存在会重叠；动画期间要禁止重复导航，避免状态错乱。

## 3. 关键代码

```ts
router.afterEach((to, from) => {
  // 1. 用路由深度判断方向（也可比较 history.state.position）
  const toDepth = to.meta.depth ?? 0
  const fromDepth = from.meta.depth ?? 0
  direction.value = toDepth >= fromDepth ? 'forward' : 'back'
})
```

```vue
<RouterView v-slot="{ Component }">
  <!-- 2. 按方向切 name；out-in 防止两页重叠 -->
  <Transition :name="direction === 'forward' ? 'slide-left' : 'slide-right'" mode="out-in">
    <!-- 3. 唯一 key，保证组件真正切换并触发动画 -->
    <component :is="Component" :key="$route.fullPath" />
  </Transition>
</RouterView>
```

## 4. 数据对比

| 指标 | 无方向 | 有方向 |
|---|---|---|
| 前进动画 | 固定/无 | 从右滑入 |
| 后退动画 | 固定/无 | 从左滑入 |
| 页面重叠 | 可能 | 0（out-in） |
| 动画时长 | — | 0.28s |
| 滚动位置 | 丢失 | `scrollBehavior` 恢复 |

测量方式：Chrome headless 1200×900 依次切换四个页面并返回，观察方向与是否有重叠；时长来自 Demo CSS。滚动恢复按 `savedPosition` 逻辑验证。

## 5. 追问与边界

**Q：为什么必须 `mode="out-in"`？**
默认模式新旧页面同时渲染，绝对定位下会重叠闪烁；`out-in` 等旧页离场再进新页。

**Q：快速连点导航会怎样？**
动画未结束就再次切换，可能出现半截状态；用 `transitioning` 标记或路由守卫阻止重复点击。

**Q：滚动位置怎么恢复？**
`scrollBehavior(to, from, savedPosition) { return savedPosition || { top: 0 } }`；前进到新页回顶，后退回原位置。

坑：`component` 没唯一 `key`，同组件不同参数会复用实例，动画不触发。边界：移动端优先 `transform`，别用 `left/top` 触发布局；首屏不要播放入场动画。
