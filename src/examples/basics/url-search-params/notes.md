# URLSearchParams 筛选状态进地址栏

## 1. 现象 / 场景

一句话：筛选条件、关键词、页码只存在内存里，一刷新全丢；想分享一条「和当前结果一模一样」的链接也做不到。

复现：

1. 勾选两个分类、输入含空格的关键词、翻到第 2 页。
2. 点「模拟刷新」：内存模式下状态全部回到默认值（坑）。
3. 切到 URL 同步模式重复同样操作：刷新、浏览器后退都能原样还原。

## 2. 原理

地址栏查询串是浏览器自带的免费存档：写入后，刷新（重新加载这条地址）、后退/前进（历史记录）、分享链接（把整条地址发给别人），任何路径都会把查询串一并带回来。

两条浏览器机制配合了它：`history.replaceState` 只替换当前历史条目的地址、不新增记录（后退列表不会被筛选操作灌满）；`popstate` 在真实的历史栈穿越时被触发（reload、back、forward），案例在这里把查询串解析回组件状态。`URLSearchParams` 则解决「怎么安全地拼」：空格、中文、`=` `&` `+` 这些字符会被统一转义，手写拼接需要在每一点上都自己记得 encodeURIComponent，错一处就翻车。

## 3. 方案：关键代码

```ts
function buildQuery(): string {
  const params = new URLSearchParams()
  // 1. 多选分类用 append 生成重复键 cat=组件&cat=工具（set 会覆盖）
  for (const cat of selectedCats.value) params.append('cat', cat)
  if (keyword.value.trim()) params.append('kw', keyword.value.trim())
  if (page.value > 1) params.append('page', String(page.value))
  return params.toString()
}

// 2. replaceState：同步地址但不加历史记录，讲筛选前先把后退列表保住
function syncUrl(): void {
  if (mode.value !== 'url') return
  history.replaceState(null, '', `${location.pathname}?${buildQuery()}`)
}

// 3. 还原口收敛到一处：刷新 / popstate 后退 / 打开分享链接全都调它
function parseFromUrl(search: string): void {
  const params = new URLSearchParams(search)
  selectedCats.value = params.getAll('cat')
  keyword.value = params.get('kw') ?? ''
  page.value = Math.max(1, Number(params.get('page') ?? '1'))
}
```

## 4. 数据对比

| 指标 | 手写拼接 | URLSearchParams | 数量来源 |
|------|----------|-----------------|----------|
| 出错点 | 7 处（清单见 Demo 面板） | 自动兜住 7 处（0 处需要手写） | Demo 内静态清单统计 |
| 关键词「前端 案例库」进查询串 | `kw=前端 案例库`（空格裸露，链接易被截断） | `kw=前端+%E6%A1%88%E4%BE%8B%E5%BA%93` 编码后原样读回 | Demo 编码对照区实时显示 |
| 刷新还原 | 内存模式：状态丢失 | URL 模式：筛选/页码原样回来 | 面板提示与状态回显 |
| popstate 还原次数 | 0（没机会还原） | 每次浏览器后退 +1 | 面板计数 |

测量说明：

- 出错点数与自动处理数取自 Demo 内静态清单（`PITFALLS`），数得出来、可复核。
- 查询串长度与编码结果由浏览器实时计算，无网络请求。
- 无性能差异：行为指标替代性能指标（还原次数、状态丢失与否）。

## 5. 追问与边界

**Q：replaceState 疯狂调用会不会拖慢页面？**
地址同步很轻，但输入关键词时每敲一键都调一次没必要——按 200ms 去抖更稳。

**Q：和 vue-router 的 query 参数什么关系？**
vue-router 内部就是帮你做了「解析 + replaceState/pushState + 响应化」；理解本案例后，router.query 只是同一机制的封装。

**Q：状态里塞了很多内容怎么办？**
查询串建议保持在几十个字符量级；复杂对象放内存或缓存，只把「还原所需的最小键集」写进地址。

踩坑：

1. set 与 append 用混：多选分类只剩最后一个 → 遍历用 append。
2. 数字没转字符串直接进查询串 → 出现 `page=12undefined3` 这类拼接事故 → 显式 `String()` 或交给 URLSearchParams。
3. URL 模式下直接摘掉全部参数做「重置」 → 后退一步回到旧筛选 → 重置后 replaceState 成无参地址即可。

边界：需要鉴权防篡改的状态（用户身份、价格）不要写进查询串；本案例不经过真实构建的 sessionStorage，仅演示地址栏与历史栈这两条通道；「刷新」是模拟按钮，直接按 F5 的效果与之一致。

