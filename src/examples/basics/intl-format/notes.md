# Intl 按语言格式化日期与数字

## 1. 现象 / 场景

一句话：把「2026年1月19日 上午9:05」「3 天前」这种中文写法焊死在模板字符串里，切到英文/日文用户面前就是别扭的半翻译文本。

复现：

1. 打开案例，默认中文（简体）：左右两列读起来一致。
2. 切到 English (US) 或 日本語：右列（Intl）输出对应语言的写法，左列（手写拼接）纹丝不动，被标「对该语言不合适」。

## 2. 原理

每种语言的日期写法、货币符号位置、相对时间说法、数字分组符号都有成文规范（CLDR 语言数据），浏览器把这套数据内置进了 Intl 接口：`DateTimeFormat` 管日期时间、`RelativeTimeFormat` 管「3 days ago」这类相对说法、`NumberFormat` 管千分位与货币。调用方只声明两件事——用哪种语言、展示哪种类型的数据。

手写拼接的问题不在「今天能写出输出」，而在于覆盖面：中文写法需要星期表、「凌晨/上午」分段、币种符号、千分位正则，每新增一种语言就要整套复制改写，分支数随语言数线性增长（这正是 Demo 源码统计的行数来源）。Intl 把这套规则交给浏览器维护，代码里只剩四个表达式。

## 3. 方案：关键代码

```ts
function fmtIntlAll(locale: string, d: Date, days: number, amount: number, n: number): string[] {
  // 1. 为什么每个接口只声明一次语言：语言环境统一收拢，四类输出同源
  const dateStr = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(d)
  const relStr = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(days, 'day')
  // 2. 为什么货币要传币种代码：符号「￥/$」由语言规则决定摆放位置
  const curStr = new Intl.NumberFormat(locale, { style: 'currency', currency: 'CNY' }).format(amount)
  // 3. 为什么不 new n 次格式化器：同 locale 复用实例，避免重复解析规则
  const numStr = new Intl.NumberFormat(locale).format(n)
  return [dateStr, relStr, curStr, numStr]
}
```

## 4. 数据对比

| 指标 | 手写拼接 | Intl | 数量来源 |
|------|----------|------|----------|
| 为此手写的代码行数 | 26 行（4 个函数源码统计，面板显示） | 4 行（4 个 `new Intl.` 表达式） | 静态统计 Demo 源码 24–55 行；Intl 侧数表达式 |
| 支持语言数 | 1（只会中文写法） | 浏览器内置的全部语言（CLDR） | Demo 切到 en-US / ja-JP 即见 |
| 输出新语言 | 需复制整套函数改文案 | 改一个 locale 字符串 | 面板两列实时对照 |
| 相对时间深度 | 只写了天级分支 | 天/时/分/秒全档位 | 切换输出对比 |

测量说明：

- 行数是静态统计：手写侧数 Demo 源码 24–55 行四个函数（含签名与右括号，不含空行与注释）共 26 行；Intl 侧数 4 个 `new Intl.` 表达式。**不能在生产构建里用 `Function.prototype.toString()` 数行**——压缩会把函数压成一行，面板会失真。
- 输出对照为浏览器实时计算；无性能差异，属行为指标对照，环境为现代 Chrome / Edge，Safari 的 RelativeTimeFormat 同样可用（iOS 13+）。

## 5. 追问与边界

**Q：Intl 每次都 new 一个格式化器会不会慢？**
构造器要做语言数据解析，热路径上应缓存实例（同 locale 复用）；日常几条数据的页面无所谓。

**Q：为什么不直接上 i18n 库（如 dayjs/date-fns 的 locale 包）？**
纯展示类的格式化 Intl 是零依赖原生能力（本案例未引入第三方库）；需要翻译文案、复数词条时才轮到 i18n 方案，两者互补。

**Q：服务端渲染（Node）里 Intl 输出和浏览器不一样怎么办？**
Node 的 ICU 数据版本可能不同，输出细节有差异——关键位置以服务端为准输出一次，或两端统一走带完整 ICU 的环境。

踩坑：

1. 相对时间想出现「昨天 / 明天」文案必须显式传 `numeric: 'auto'`，默认数字档不会这么做。
2. 币种代码与语言分离传：`currency: 'CNY'` 在 en-US 里输出「CN¥123,456.78」是对的（语言决定符号写法，币种决定用哪个币）。
3. 把后端返回的时间字符串直接切片展示 → 跨时区错乱 → 先转 Date 再交 Intl。

边界：面向确定单一语言的内部工具，手写拼接反而更直接，不必为 Intl 折腾；需要特殊自定义格式（如带品牌色的倒计时排版）时 Intl 只负责取数，布局仍由样式完成。「错误 / 正确」对照以左列「不该出现在其他语言里的输出」体现，语言切换即触发标注。

