# DateRangePresets：快捷日期别各算各的

## 1. 现象 / 场景

筛选栏里「今天」「近 7 天」「近 30 天」各写一段日期计算，结束日一个包含当天、一个不包含；自定义范围输反了也直接查，结果和快捷项对不上。

复现步骤：

1. 初始选中「近 7 天」，结果 6 条，范围是 2026-11-02 到 2026-11-08。
2. 点「今天」，结果 2 条，范围缩成同一天。
3. 点「近 30 天」，结果 10 条，范围从 2026-10-10 开始。
4. 自定义开始 2026-10-31、结束 2026-11-06，点「应用自定义」，结果 5 条。
5. 把开始和结束输反，再点应用，只出现错误提示，结果仍是 5 条。
6. 点「重置」，回到「近 7 天」和 6 条结果。

## 2. 原理

快捷项和自定义不该各查各的，它们只是「生成起止日期」的不同入口。真正参与筛选的只有一组已生效的起止值。

结束日统一用小于等于比较，才能包含当天。用小于比较会把 2026-11-08 当天的 2 条漏掉，用户看到「近 7 天只有 4 条」会觉得算错了。

日期格式化要用本地年月日。直接对 Date 调 toISOString 会按 UTC 截断，东八区凌晨会少一天，快捷范围和自定义范围就会差一天。

## 3. 方案：关键代码

```ts
/**! 本地格式化：toISOString 会按 UTC 截断，东八区凌晨会少一天 */
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** 快捷项只负责算起止，真正筛选统一读 appliedStart / appliedEnd */
function presetRange(value: Preset): { start: string; end: string } | null {
  if (value === 'today') return { start: BASE_DATE, end: BASE_DATE }
  if (value === '7d') return { start: formatDate(addDays(BASE, -6)), end: BASE_DATE }
  if (value === '30d') return { start: formatDate(addDays(BASE, -29)), end: BASE_DATE }
  return null
}

/**! 自定义只改草稿，点应用才校验并替换已生效范围 */
function applyCustom(): void {
  const start = parseDate(draftStart.value)
  const end = parseDate(draftEnd.value)
  if (!start || !end) {
    error.value = '日期格式应为 YYYY-MM-DD'
    return
  }
  if (draftEnd.value < draftStart.value) {
    error.value = '结束日期不能早于开始日期'
    return
  }
  error.value = ''
  preset.value = 'custom'
  appliedStart.value = draftStart.value
  appliedEnd.value = draftEnd.value
}

/** 字符串比较即可：YYYY-MM-DD 的字典序和日期序一致，结束日 <= 才包含当天 */
const resultRows = computed(() =>
  records
    .filter((item) => item.date >= appliedStart.value && item.date <= appliedEnd.value)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
)
```

三处关键选择：

1. 快捷项与自定义共用 appliedStart / appliedEnd：筛选只读一处，不会各算各的。
2. 自定义先写草稿：输到一半不应该立刻改变结果，点应用才生效。
3. 结束日包含当天：比较用小于等于，范围和结果才对得上。

## 4. 数据对比

| 操作 | 预设 | 结果 | 范围 | 测量方式 |
| --- | --- | --- | --- | --- |
| 初始 | 近 7 天 | 6 | 2026-11-02 ~ 2026-11-08 | 页面 data-stat 读数 |
| 点今天 | 今天 | 2 | 2026-11-08 ~ 2026-11-08 | 同上 |
| 点近 30 天 | 近 30 天 | 10 | 2026-10-10 ~ 2026-11-08 | 同上 |
| 自定义 10-31 到 11-06 | 自定义 | 5 | 2026-10-31 ~ 2026-11-06 | 应用后读 |
| 自定义 11-06 到 11-01 | 自定义 | 5 | 保持上一组 | 错误提示，结果不变 |
| 重置 | 近 7 天 | 6 | 2026-11-02 ~ 2026-11-08 | 同上 |

测量说明：

- 环境：本机 Chrome，案例页 `/cases/admin/date-range-presets`。
- 取样：npm run check:ui -- --base http://localhost:5174 --only 日期范围 的常驻场景。
- 固定基准日 2026-11-08，结果不随真实日期变化。

## 5. 追问与边界（面试高频）

- Q: 为什么不用两个 Date 对象存范围？ → A: 输入框给的是字符串，接口也常传字符串；统一用 YYYY-MM-DD 比较，省掉时区转换，显示和提交都是同一份值。
- Q: 近 7 天包含今天吗？ → A: 包含。起始日是基准日往前 6 天，结束日就是基准日，一共 7 天；如果往前 7 天再包含今天会变成 8 天。
- Q: 自定义输错时要不要清空结果？ → A: 不清。清空会让用户以为之前的结果也没了；保留上一次结果并提示错误，改完再应用。

踩坑（≤3 条）：

1. 用 toISOString 取日期：东八区凌晨会得到前一天 → 用本地年月日拼字符串。
2. 结束日用小于比较：当天记录被漏掉 → 改成小于等于。
3. 自定义输入时立刻筛选：用户输到一半结果乱跳 → 草稿和应用分开。

边界：时区切换、跨年范围、日期选择器组件、服务端按 UTC 存储都不在本例范围；真实项目要和后端确认日期字段按哪一天算。
