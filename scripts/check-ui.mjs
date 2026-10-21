#!/usr/bin/env node
/**
 * 浏览器端验收脚本（Chrome CDP + headless）
 *
 * 为什么要有这个脚本：
 * 构建通过、单测通过，都不代表页面能用。产物路径、按需加载、样式覆盖
 * 这类问题只有真实跑一遍浏览器才暴露。之前每个会话各写一版临时脚本，
 * 结果：有的忘了加 --headless（桌面上一堆窗口）、只 kill 父进程
 * （Chrome 的子进程和窗口留下来）、每轮换一个临时配置目录（攒了 2 GB）。
 *
 * 这个脚本把三件事固定下来：
 * 1. 只开无界面实例（--headless=new），不会弹窗口
 * 2. 退出时整棵进程树杀掉（Windows 用 taskkill /T /F），并清理配置目录
 * 3. 固定复用 node_modules/.tmp/chrome-check，不再到处生成临时 profile
 *
 * 用法：
 *   npm run check:ui                          # 默认验 preview（需要先 build + preview）
 *   node scripts/check-ui.mjs --base http://localhost:5173   # 验 dev 服务器
 *
 * 退出码：全部通过 0，有失败 1（可直接进 CI 或本地门禁）
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'

/** 读取 --base 参数，默认验 preview（4173） */
function readBase() {
  const index = process.argv.indexOf('--base')
  if (index > -1 && process.argv[index + 1]) return process.argv[index + 1]
  return process.env.CHECK_BASE || 'http://localhost:4173'
}

const BASE = readBase().replace(/\/$/, '')
/** 内置产物路径断言只在 preview 有意义，dev 是源码直出 */
const IS_PREVIEW = !/:(5173|5174)$/.test(BASE)

/** 固定配置目录：放在 node_modules/.tmp 下，随依赖一起被清理，不会再堆到系统临时目录 */
const PROFILE_DIR = path.join(process.cwd(), 'node_modules/.tmp/chrome-check')

/** 按平台找 Chrome；可用 CHROME_PATH 覆盖 */
function resolveChromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  const candidates =
    process.platform === 'win32'
      ? [
          'C:/Program Files/Google/Chrome/Application/chrome.exe',
          'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
        ]
      : process.platform === 'darwin'
        ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
        : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  const found = candidates.find((file) => existsSync(file))
  if (!found) {
    throw new Error(`找不到 Chrome，可用 CHROME_PATH 指定：${candidates.join(', ')}`)
  }
  return found
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 启动 Chrome 并返回进程与调试端口
 * --remote-debugging-port=0：让系统分配空闲端口，避免和别的会话抢 9222，
 * 端口写到配置目录下的 DevToolsActivePort 文件里
 */
async function launchChrome() {
  // 上一轮异常退出可能留下残缺配置，先尽量清掉（删不掉也继续，Chrome 能复用）
  try {
    rmSync(PROFILE_DIR, { recursive: true, force: true })
  } catch {
    /* 文件被占用时忽略，直接复用 */
  }

  const child = spawn(
    resolveChromePath(),
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-dev-shm-usage',
      '--hide-scrollbars',
      '--remote-debugging-port=0',
      `--user-data-dir=${PROFILE_DIR}`,
      'about:blank',
    ],
    { stdio: 'ignore', detached: process.platform !== 'win32' },
  )

  const portFile = path.join(PROFILE_DIR, 'DevToolsActivePort')
  for (let i = 0; i < 80; i++) {
    if (child.exitCode !== null) throw new Error('Chrome 启动后立即退出，检查 CHROME_PATH')
    if (existsSync(portFile)) {
      const [port] = readFileSync(portFile, 'utf8').split('\n')
      if (port) return { child, port: Number(port) }
    }
    await sleep(200)
  }
  throw new Error('等待 Chrome 调试端口超时（15s）')
}

/**
 * 杀掉整棵进程树并清理配置目录
 * 为什么不能只 child.kill()：Chrome 是多进程结构，父进程退了，
 * 渲染/GPU 子进程和窗口还会留着，这就是之前「浏览器自己冒出来」的原因
 */
function shutdown(chrome) {
  if (!chrome) return
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(chrome.child.pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    try {
      process.kill(-chrome.child.pid, 'SIGKILL')
    } catch {
      try {
        chrome.child.kill('SIGKILL')
      } catch {
        /* 已退出 */
      }
    }
  }
  // 等文件句柄释放后再删配置，避免残留目录锁住导致下轮无法清理
  const wait = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
  for (let i = 0; i < 10; i++) {
    try {
      rmSync(PROFILE_DIR, { recursive: true, force: true })
      return
    } catch {
      wait(200)
    }
  }
}

/** 用 DevTools 的 HTTP 接口新开标签页 */
async function openPage(port, url) {
  const response = await fetch(
    `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`,
    { method: 'PUT' },
  )
  if (!response.ok) throw new Error(`新开标签页失败：HTTP ${response.status}`)
  return response.json()
}

/** 单个标签页的 CDP 会话：收集异常、console 错误与网络请求 */
async function connectPage(target) {
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

  const pending = new Map()
  const errors = []
  const requests = []
  let sequence = 0

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) reject(new Error(message.error.message))
      else resolve(message.result)
      return
    }
    if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params.exceptionDetails
      errors.push(`异常：${details.exception?.description ?? details.text}`)
    }
    if (message.method === 'Network.requestWillBeSent') {
      requests.push(message.params.request.url)
    }
  })

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++sequence
      pending.set(id, { resolve, reject })
      socket.send(JSON.stringify({ id, method, params }))
    })

  await send('Runtime.enable')
  await send('Network.enable')
  await send('Page.enable')

  /** 在页面里执行表达式并取值 */
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
    return result.result.value
  }

  return { send, evaluate, errors, requests, close: () => socket.close() }
}

/**
 * 场景定义：每个场景 = 一条路由 + 进入后要断言的东西
 * 断言失败只记录不抛错，最后统一汇总，一次跑完所有场景
 */
const SCENARIOS = [
  {
    name: '首页',
    route: '/',
    facts: async ({ evaluate }) => ({
      /** 首屏标题：渲染成功的最直接证据 */
      h1: await evaluate(`document.querySelector('h1')?.innerText?.trim() ?? ''`),
    }),
    assert: (result) => (result.h1 ? [] : ['首页没有渲染出 h1']),
  },
  {
    name: '案例列表',
    route: '/cases',
    facts: async ({ evaluate }) => ({
      cards: await evaluate(`document.querySelectorAll('a[href^="/cases/"]').length`),
    }),
    assert: (result) => (result.cards > 0 ? [] : ['列表没有渲染出案例卡片']),
  },
  {
    name: '详情页（演示 + 源码按需加载）',
    route: '/cases/performance/perf-observer',
    facts: async ({ evaluate, requests }) => {
      const beforeClick = IS_PREVIEW
        ? requests.some((url) => /\/assets\/js\/cases\/[^/]+\/[^/]+\/(?:Demo\.source|usage)/.test(url))
        : null
      return {
        /** 演示是否真的挂载（文字长度比「元素存在」更能说明渲染完成） */
        demoTextLength: await evaluate(
          `document.querySelector('.demo-card')?.innerText?.trim().length ?? 0`,
        ),
        /** 点开源码前，源码文本不应该被下载 */
        sourceFetchedBeforeClick: beforeClick,
      }
    },
    after: async ({ evaluate, requests }) => {
      const before = requests.length
      await evaluate(`document.querySelector('#tab-code')?.click()`)
      await sleep(1500)
      return {
        codeLines: await evaluate(
          `document.querySelectorAll('.code-workbench .line-code').length`,
        ),
        sourceFetchedAfterClick: IS_PREVIEW
          ? requests
              .slice(before)
              .some((url) => /\/assets\/js\/cases\/[^/]+\/[^/]+\/(?:Demo\.source|usage)/.test(url))
          : null,
      }
    },
    assert: (result) => {
      const failures = []
      if (result.demoTextLength < 20) failures.push('详情页演示没有渲染内容')
      if (result.sourceFetchedBeforeClick) failures.push('点开源码前就下载了源码 chunk')
      if (!result.sourceFetchedAfterClick) failures.push('点开源码后没有加载源码 chunk')
      if (result.codeLines < 10) failures.push(`源码区只有 ${result.codeLines} 行`)
      return failures
    },
  },
  {
    name: 'Element Plus 案例样式',
    route: '/cases/practice/debounce-throttle',
    facts: async ({ evaluate }) => ({
      epInput: await evaluate(`Boolean(document.querySelector('.demo-card .el-input'))`),
      /** 样式按需加载的关键：组件 CSS 必须真的挂上（暗色变量覆盖不走这里） */
      epCssLoaded: await evaluate(
        `[...document.styleSheets].some(s => (s.href ?? '').includes('element-plus'))`,
      ),
    }),
    assert: (result) => {
      const failures = []
      if (!result.epInput) failures.push('EP 输入框没有渲染')
      if (!result.epCssLoaded) failures.push('EP 组件样式没有加载')
      return failures
    },
  },
]

/** 逐个场景跑：开页 → 采集 → 可选二次操作 → 断言 → 关页 */
async function runScenario(port, scenario) {
  const target = await openPage(port, BASE + scenario.route)
  const page = await connectPage(target)

  try {
    await sleep(3200) // 等动态 import 与首屏渲染稳定
    const result = { ...(await scenario.facts(page)) }
    if (scenario.after) Object.assign(result, await scenario.after(page))
    const failures = scenario.assert(result)
    if (page.errors.length > 0) failures.push(...page.errors)
    return { name: scenario.name, route: scenario.route, result, failures }
  } finally {
    page.close()
    await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {})
  }
}

/** 窄屏检查：375px 下不能出现横向滚动（站点 DoD 硬要求） */
async function checkMobile(port) {
  const target = await openPage(port, `${BASE}/cases/performance/perf-observer`)
  const page = await connectPage(target)
  try {
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 720,
      deviceScaleFactor: 1,
      mobile: true,
    })
    await sleep(1800)
    const result = await page.evaluate(`({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    })`)
    const failures = result.scrollWidth > result.innerWidth ? ['375px 出现横向滚动'] : []
    return { name: '375px 窄屏', route: '详情页', result, failures }
  } finally {
    page.close()
    await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {})
  }
}

const chrome = await launchChrome()
// 兜底：Ctrl+C 或异常退出时也要清干净，不能把进程留给用户
process.on('exit', () => shutdown(chrome))
process.on('SIGINT', () => {
  shutdown(chrome)
  process.exit(130)
})

let exitCode = 0
try {
  /** 先确认目标服务活着，避免把「服务没起」误报成页面问题 */
  const probe = await fetch(BASE).catch(() => null)
  if (!probe?.ok) {
    throw new Error(`无法访问 ${BASE}，请先启动 dev 或 preview`)
  }

  const results = []
  for (const scenario of SCENARIOS) {
    results.push(await runScenario(chrome.port, scenario))
  }
  results.push(await checkMobile(chrome.port))

  console.log(`\n[check:ui] 目标：${BASE}\n`)
  for (const item of results) {
    const facts = Object.entries(item.result)
      .map(([key, value]) => `${key}=${value}`)
      .join('  ')
    console.log(`${item.failures.length === 0 ? '✓' : '✗'} ${item.name}  ${facts}`)
    for (const failure of item.failures) console.log(`    ↳ ${failure}`)
  }

  const failed = results.filter((item) => item.failures.length > 0)
  if (failed.length > 0) {
    console.error(`\n[check:ui] ${failed.length} 个场景未通过`)
    exitCode = 1
  } else {
    console.log(`\n[check:ui] ${results.length} 个场景全部通过 ✓`)
  }
} finally {
  shutdown(chrome)
}

process.exit(exitCode)
