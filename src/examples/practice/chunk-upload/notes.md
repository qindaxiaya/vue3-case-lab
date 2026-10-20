# 大文件分片上传

## 1. 现象与场景

传 500MB 视频，进度条卡在 99% 十分钟；网络一断，整文件从头再来；同一个文件第二次上传还要再传一遍。

复现：生成 5MB 测试文件，观察切片、并发上传、合并三个阶段；断网/暂停后重新开始，只补未完成分片。

## 2. 原理

分片上传把大文件按固定大小 `slice` 成 Blob 引用（不复制内容），每片单独请求，服务端按 `index` 落盘，最后合并。好处是失败只重传单片、可并发、可断点续传。

秒传靠文件指纹（SHA-256）：先问服务端「这个 hash 存在吗」，存在就直接完成。断点续传靠状态接口返回「已收到哪些分片」，前端只传缺的。并发用固定数量的 worker 循环取任务，天然限流，不需要信号量。

## 3. 关键代码

```ts
const CHUNK_SIZE = 1024 * 1024
const CONCURRENCY = 3

function sliceFile(file: File): Blob[] {
  const list: Blob[] = []
  for (let start = 0; start < file.size; start += CHUNK_SIZE) {
    // 1. slice 返回引用，不会把整个文件读进内存
    list.push(file.slice(start, start + CHUNK_SIZE))
  }
  return list
}

async function uploadWithLimit(parts: Blob[], hash: string) {
  let cursor = 0
  const worker = async () => {
    while (cursor < parts.length) {
      // 2. 每个 worker 串行取任务，天然限制并发数
      const index = cursor++
      const form = new FormData()
      form.append('hash', hash)
      form.append('index', String(index))
      form.append('chunk', parts[index])
      await fetch('/api/upload/chunk', { method: 'POST', body: form })
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
}
// 3. 全部分片确认后再 merge，不能每片都合并
await fetch('/api/upload/merge', { method: 'POST', body: JSON.stringify({ hash, total: parts.length }) })
```

## 4. 数据对比

| 指标 | 数值 |
|---|---|
| 测试文件 | 5.00 MB |
| 分片大小 | 1 MB |
| 分片数 | 5 |
| 并发数 | 3 |
| 生成/准备耗时 | 37 ms |

测量方式：Chrome headless 1200×900 点「生成 5MB 测试文件」，读取面板的大小与耗时；分片数 = 文件大小 / 分片大小，并发数来自 Demo 配置。真实上传耗时取决于网络与服务端，案例用模拟请求演示流程。

## 5. 追问与边界

**Q：分片越小越好吗？**
不是。64KB 会产生大量请求与合并开销；100MB 单片失败代价高。1~5MB 是常见折中。

**Q：hash 怎么算不卡主线程？**
大文件用 `crypto.subtle.digest` 前先放 Worker，或按分片增量计算；计算过程要显示进度。

**Q：暂停后刷新页面还能续吗？**
把已完成分片与 hash 存 localStorage/IndexedDB；仅靠内存刷新即丢。

坑：服务端合并必须按 index 排序，不能按到达顺序。边界：小文件（<1MB）直接整传更简单；对象存储通常提供现成的分片上传 SDK，优先用。
