# BatchImport：批量导入先把错误说清楚

## 1. 现象 / 场景

后台要批量导入客户、商品、员工。用户粘一大段文本点导入，接口只返回「导入失败」，不知道哪一行错、错在哪；改完再传，又可能撞上文件内重复或已存在的邮箱。

复现步骤：

1. 点「填入示例」，文本框出现 6 行数据。
2. 点「校验并预览」，总行数 6，可导入 3，错误行 3。
3. 错误行分别是：套餐 `vip` 不合法、文件内邮箱重复、邮箱已存在。
4. 点「导入合法行」，约 500ms 后已导入 3 条，按钮不再可点。

## 2. 原理

批量导入不是「把整段文本发过去」这么简单：要先按行解析，再逐行校验，把合法行和错误行分开。

错误要带行号和原因，用户才能定位；合法行可以继续导入，不必因为一条脏数据整批失败。除了单字段格式，还要检查跨行、跨数据的唯一性：文件内邮箱重复、邮箱已经存在，都应该在预览阶段拦下，而不是等写库时返回唯一键冲突。

导入按钮要有 loading / 已导入状态，防止用户连点导致重复写入。校验函数最好是纯函数，前端先校验一遍，后端再校验一遍；前端校验只是体验，不是安全边界。

## 3. 方案：关键代码

```ts
//! 逐行解析；错误按行收集，合法行和错误行都保留在预览里
function parseAndValidate(): void {
  if (importing.value) return
  const lines = source.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const seenEmails = new Set<string>()
  rows.value = lines.map((line, index) => {
    const [name = '', email = '', plan = ''] = line.split(',').map((cell) => cell.trim())
    const errors: string[] = []
    const lowerEmail = email.toLowerCase()

    if (name.length < 2) errors.push('姓名至少 2 个字')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('邮箱格式不对')
    if (!planKeys.includes(plan as Plan)) errors.push('套餐只能是 basic / pro / enterprise')
    //! 文件内重复和已存在邮箱都要拦，不能等写库时才报唯一键冲突
    if (lowerEmail && seenEmails.has(lowerEmail)) errors.push('文件内邮箱重复')
    if (lowerEmail && existingEmails.has(lowerEmail)) errors.push('邮箱已存在')
    if (lowerEmail) seenEmails.add(lowerEmail)

    return { line: index + 1, name, email, plan, errors, valid: errors.length === 0 }
  })
  parsed.value = true
}

//! 只导入合法行；导入中锁住按钮，避免重复提交
function importValid(): void {
  if (!parsed.value || validCount.value === 0 || importing.value) return
  importing.value = true
  importTimer = window.setTimeout(() => {
    importedCount.value = validCount.value
    importing.value = false
    importTimer = null
  }, 500)
}
```

三处关键选择：

1. 合法行和错误行都保留在 `rows` 里，预览表才能同时显示「可导入」和错误原因。
2. `seenEmails` 在遍历中边加边查，文件内重复能定位到后出现的那一行。
3. 导入只取 `validRows`，错误行不会进入提交数据；按钮同时受 `canImport` 和 `importing` 约束。

## 4. 数据对比

| 操作 | 总行数 | 可导入 | 错误行 | 已导入 | 测量方式 |
| --- | --- | --- | --- | --- | --- |
| 填入示例 | 0 | 0 | 0 | 0 | 页面 data-stat 读数 |
| 校验并预览 | 6 | 3 | 3 | 0 | 同上 |
| 导入合法行 | 6 | 3 | 3 | 3 | 同上 |

测量说明：

- 环境：本机 Chrome，案例页 `/cases/admin/batch-import`。
- 取样：`npm run check:ui -- --only 批量导入` 的常驻场景，同一页面顺序执行。
- 500ms 是 Demo 固定延迟，用来展示导入 loading；不是接口性能结论。

## 5. 追问与边界（面试高频）

- Q: 前端校验过了，后端还要校验吗？ → A: 要。前端校验只是体验，用户可以绕过；后端才是安全边界。
- Q: 一条错误要不要整批回滚？ → A: 看业务。本例只导入合法行；如果业务要求全有或全无，就要在提交前拦住整批。
- Q: 大文件怎么处理？ → A: 分片读取、流式解析、后台任务导入；不要在主线程一次性解析几十万行。

踩坑（≤3 条）：

1. 只校验格式不校验唯一性：预览全绿，写库时唯一键冲突 → 文件内重复和已存在数据都要提前查。
2. 错误行也提交：一条脏数据让整批失败 → 只提交合法行，错误行留在预览里。
3. 导入按钮不锁：用户连点两次，数据重复写入 → loading + 已导入标记。

边界：本例用逗号分隔文本演示解析与校验，不处理引号、换行、转义等完整 CSV 规则；真实项目建议用成熟解析库。
