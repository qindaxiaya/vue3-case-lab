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
 *   npm run check:ui -- --only 抽屉           # 只验名字/路由命中的场景（改单个案例用这个，5~10 秒）
 *   npm run check:ui -- --case practice/vitest-gate   # 单案例通用巡检（任意案例都能验）
 *   npm run check:ui -- --sweep               # 全案例巡检：81 条路由 × 375px
 *   node scripts/check-ui.mjs --base http://localhost:5173   # 验 dev 服务器
 *
 * 退出码：全部通过 0，有失败 1（可直接进 CI 或本地门禁）
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import path from 'node:path'

/** 读取 --base 参数，默认验 preview（4173） */
function readBase() {
  const index = process.argv.indexOf('--base')
  if (index > -1 && process.argv[index + 1]) return process.argv[index + 1]
  return process.env.CHECK_BASE || 'http://localhost:4173'
}

/**
 * 读取 --only 参数：只跑名字或路由命中的场景
 * 为什么需要：改一个案例时跑全量 16 个场景要 60 秒以上，
 * 只跑目标场景能把回归时间压到 5~10 秒，日常修复才愿意每次都验
 */
function readOnly() {
  const index = process.argv.indexOf('--only')
  if (index > -1 && process.argv[index + 1]) return process.argv[index + 1]
  return process.env.CHECK_ONLY || ''
}

/** 场景过滤：名字（如「抽屉」）或路由（如 animation/drawer）命中即可 */
function pickScenarios(only) {
  if (!only) return SCENARIOS
  return SCENARIOS.filter(
    (scenario) => scenario.name.includes(only) || scenario.route.includes(only),
  )
}

/** 读取 --case 参数：任意案例的「分类/案例」路径 */
function readCase() {
  const index = process.argv.indexOf('--case')
  if (index > -1 && process.argv[index + 1]) return process.argv[index + 1]
  return process.env.CHECK_CASE || ''
}

/** 是否跑全案例巡检（81 条路由 × 375px） */
function readSweep() {
  return process.argv.includes('--sweep') || process.env.CHECK_SWEEP === '1'
}

/** 案例目录根：用来把「只给案例 id」补全成「分类/案例」 */
const EXAMPLES_DIR = path.resolve('src/examples')

/** 列出全部案例路径（分类/案例），供 --case 与 --sweep 共用 */
function listCasePaths() {
  const result = []
  for (const category of readdirSync(EXAMPLES_DIR)) {
    const categoryDir = path.join(EXAMPLES_DIR, category)
    if (!statSync(categoryDir).isDirectory()) continue
    for (const id of readdirSync(categoryDir)) {
      const caseDir = path.join(categoryDir, id)
      if (!statSync(caseDir).isDirectory()) continue
      if (existsSync(path.join(caseDir, 'meta.ts'))) result.push(`${category}/${id}`)
    }
  }
  return result.sort()
}

/** 把 --case 的输入规范化：允许 cases/xxx、分类/案例、只给案例 id */
function resolveCasePath(input) {
  const normalized = input.replace(/^\/?cases\//, '').replace(/\/+$/, '')
  if (normalized.includes('/')) {
    if (!existsSync(path.join(EXAMPLES_DIR, normalized, 'meta.ts'))) {
      throw new Error(`找不到案例：${normalized}`)
    }
    return normalized
  }
  const matched = listCasePaths().filter((item) => item.endsWith(`/${normalized}`))
  if (matched.length === 1) return matched[0]
  if (matched.length > 1) {
    throw new Error(`案例 id「${normalized}」不唯一：${matched.join(' / ')}`)
  }
  throw new Error(`找不到案例：${normalized}`)
}


const BASE = readBase().replace(/\/$/, '')
const ONLY = readOnly()
const CASE = readCase()
const SWEEP = readSweep()
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
    /**
     * console.error / console.warn 也要算失败：
     * Vue 的 [Vue warn]、组件库告警、资源加载失败都走这里，
     * 只看未捕获异常会漏掉一半「页面看起来正常但已经坏了」的情况
     */
    if (message.method === 'Runtime.consoleAPICalled') {
      const type = message.params.type
      if (type === 'error' || type === 'warning' || type === 'assert') {
        const text = message.params.args
          .map((arg) => arg.value ?? arg.description ?? '')
          .join(' ')
          .trim()
        if (text) errors.push(`${type === 'error' ? 'console.error' : 'console.warn'}：${text}`)
      }
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
    /** 滚到底 → 按钮浮现 → 点击回顶，验证列表页也有回到顶部 */
    after: async ({ evaluate }) => {
      await evaluate(
        `window.scrollTo(0, document.documentElement.scrollHeight)`,
      )
      await sleep(400)
      const shown = await evaluate(`Boolean(document.querySelector('.back-top'))`)
      const startY = await evaluate(`Math.round(window.scrollY)`)
      /** 系统是否开着「减少动态效果」：开着时最容易退化成瞬间跳转，这里一并记录 */
      const reduceMotion = await evaluate(
        `matchMedia('(prefers-reduced-motion: reduce)').matches`,
      )

      await evaluate(`document.querySelector('.back-top')?.click()`)
      await sleep(150)
      // 动画中应该还在半路；直接跳顶的话这里已经是 0
      const midY = await evaluate(`Math.round(window.scrollY)`)
      await sleep(750) // 缓动 460ms + 余量

      return {
        backTopShown: shown,
        reduceMotion,
        startY,
        midY,
        backTopScrollY: await evaluate(`Math.round(window.scrollY)`),
      }
    },
    assert: (result) => {
      const failures = []
      if (!(result.cards > 0)) failures.push('列表没有渲染出案例卡片')
      if (!result.backTopShown) failures.push('列表页滚到底没有出现回到顶部按钮')
      if (!(result.midY > 0) && result.startY > 0) {
        failures.push(`点击后 150ms 已经到顶（${result.startY} → 0），说明是瞬间跳转而不是平滑滚动`)
      }
      if (result.backTopScrollY > 4) {
        failures.push(`点击回到顶部后仍停在 ${result.backTopScrollY}px`)
      }
      return failures
    },
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

      // 详情页也滚到底，确认抽成组件后回到顶部仍然可用
      await evaluate(`window.scrollTo(0, document.documentElement.scrollHeight)`)
      await sleep(400)
      const backTopShown = await evaluate(`Boolean(document.querySelector('.back-top'))`)
      await evaluate(`document.querySelector('.back-top')?.click()`)
      await sleep(900)

      return {
        codeLines: await evaluate(
          `document.querySelectorAll('.code-workbench .line-code').length`,
        ),
        sourceFetchedAfterClick: IS_PREVIEW
          ? requests
              .slice(before)
              .some((url) => /\/assets\/js\/cases\/[^/]+\/[^/]+\/(?:Demo\.source|usage)/.test(url))
          : null,
        /** 相关案例用同标签或同分类补齐，任何案例都不该是空块 */
        relatedCards: await evaluate(`document.querySelectorAll('.related-card').length`),
        /** 上下篇导航：首尾案例只有一侧，这里只要求至少有一条 */
        caseNavLinks: await evaluate(`document.querySelectorAll('.case-nav-link').length`),
        backTopShown,
        backTopScrollY: await evaluate(`Math.round(window.scrollY)`),
      }
    },
    assert: (result) => {
      const failures = []
      if (result.demoTextLength < 20) failures.push('详情页演示没有渲染内容')
      // 源码 chunk 的按需断言只在 preview 有意义：dev 是源码直出，没有 hash chunk 可数，
      // 上面两个字段会是 null（不适用），不能当成失败
      if (result.sourceFetchedBeforeClick) failures.push('点开源码前就下载了源码 chunk')
      if (result.sourceFetchedAfterClick === false) failures.push('点开源码后没有加载源码 chunk')
      if (result.codeLines < 10) failures.push(`源码区只有 ${result.codeLines} 行`)
      if (result.relatedCards < 1) failures.push('相关案例区是空的')
      if (result.caseNavLinks < 1) failures.push('上下篇导航缺失')
      if (!result.backTopShown) failures.push('详情页滚到底没有出现回到顶部按钮')
      if (result.backTopScrollY > 4) {
        failures.push(`详情页点击回到顶部后仍停在 ${result.backTopScrollY}px`)
      }
      return failures
    },
  },
  {
    name: '抽屉退场动画',
    route: '/cases/animation/drawer-slide',
    facts: async ({ evaluate, send }) => {
      //! 强制模拟「减少动态效果」：这正是用户机器上的情况（系统关了动画），
      // 案例为了让对比可见会在演示区还原过渡时长，必须在这个条件下也能测出退场
      await send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
      })
      await sleep(200)

      /** 全部在页面内按真实时间轴跑：开 → 关 → 采样，避免宿主侧 sleep 与页面计时不同步 */
      const result = await evaluate(`(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
        const button = (text, root = document) =>
          [...root.querySelectorAll('button')].find((item) => item.textContent.includes(text))

        // 先切到「等动画结束」，再打开抽屉
        button('等动画结束')?.click()
        await wait(250)
        button('打开抽屉')?.click()
        await wait(500)
        const opened = document.querySelector('.dw-panel')
        const openedTransform = opened ? getComputedStyle(opened).transform : ''

        // 点关闭后 80ms 采样：节点是否还在、transform 是否在滑出途中
        document.querySelector('.dw-panel button[aria-label="关闭抽屉"]')?.click()
        await wait(80)
        const mid = document.querySelector('.dw-panel')
        const midTransform = mid ? getComputedStyle(mid).transform : null

        await wait(700)
        const removedAfter = !document.querySelector('.dw-panel')

        // 再切回「直接卸载」验证对比：关闭后应该立刻没有节点
        button('直接卸载')?.click()
        await wait(250)
        button('打开抽屉')?.click()
        await wait(400)
        document.querySelector('.dw-panel button[aria-label="关闭抽屉"]')?.click()
        await wait(80)
        const instantRemoved = !document.querySelector('.dw-panel')

        // 最后验证「模拟减少动态效果」：等动画结束 + 模拟开关打开，关闭也该立刻移除
        button('等动画结束')?.click()
        button('模拟减少动态效果')?.click()
        await wait(250)
        button('打开抽屉')?.click()
        await wait(400)
        document.querySelector('.dw-panel button[aria-label="关闭抽屉"]')?.click()
        await wait(80)
        const mockReduceRemoved = !document.querySelector('.dw-panel')

        return {
          openedTransform,
          midTransform,
          stillThereAt80ms: Boolean(mid),
          removedAfter,
          instantRemoved,
          mockReduceRemoved,
          reduceMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        }
      })()`)

      return result
    },
    assert: (result) => {
      const failures = []
      if (!result.stillThereAt80ms) failures.push('关闭后 80ms 节点就没了，没有等退场动画')
      if (result.midTransform === result.openedTransform) {
        failures.push(`关闭 80ms 后面板位置没变（${result.midTransform}），退场过渡没跑`)
      }
      if (!result.removedAfter) failures.push('过渡结束后抽屉没有卸载')
      if (!result.instantRemoved) failures.push('「直接卸载」模式下关闭后节点没有立刻移除')
      if (!result.mockReduceRemoved) {
        failures.push('「模拟减少动态效果」打开时关闭后节点没有立刻移除')
      }
      return failures
    },
  },
  {
    name: '折叠面板量高',
    route: '/cases/animation/accordion-slide',
    facts: async ({ evaluate }) => {
      /** 默认是「脚本量高」模式：点第一条，确认模板 ref 能拿到面板并读到 scrollHeight */
      const before = await evaluate(`document.querySelector('.stats')?.innerText ?? ''`)
      await evaluate(`document.querySelectorAll('.faq-trigger')[0]?.click()`)
      await sleep(400)
      return {
        before,
        after: await evaluate(`document.querySelector('.stats')?.innerText ?? ''`),
        panelHeight: await evaluate(
          `getComputedStyle(document.querySelector('#faq-panel-faq-1')).height`,
        ),
        expanded: await evaluate(
          `document.querySelectorAll('.faq-trigger')[0]?.getAttribute('aria-expanded')`,
        ),
      }
    },
    assert: (result) => {
      const failures = []
      if (!/读取 scrollHeight\s*0\s*次/.test(result.before)) {
        failures.push('初始「读取 scrollHeight」计数不是 0')
      }
      if (!/读取 scrollHeight\s*1\s*次/.test(result.after)) {
        failures.push('点击后没有读取 scrollHeight（模板 ref 可能没拿到面板）')
      }
      if (result.panelHeight === '0px') failures.push('面板高度没有展开')
      if (result.expanded !== 'true') failures.push('面板 aria-expanded 没有变成 true')
      return failures
    },
  },
  {
    name: '无限滚动预取',
    route: '/cases/observer/infinite-scroll',
    facts: async ({ evaluate }) => {
      // 等第一页（20 条）渲染完，再滚到容器底部触发哨兵
      for (let i = 0; i < 20; i++) {
        if (await evaluate(`document.querySelectorAll('.list-item').length >= 20`)) break
        await sleep(200)
      }
      const first = await evaluate(`document.querySelectorAll('.list-item').length`)
      await evaluate(`(() => {
        const el = document.querySelector('.list-area')
        if (el) el.scrollTop = el.scrollHeight
      })()`)
      await sleep(900)
      return {
        first,
        second: await evaluate(`document.querySelectorAll('.list-item').length`),
      }
    },
    assert: (result) => {
      const failures = []
      if (result.first < 20) failures.push(`第一页没有加载（${result.first} 条）`)
      if (!(result.second > result.first)) {
        failures.push(`滚到底后没有加载下一页（${result.first} → ${result.second}）`)
      }
      return failures
    },
  },
  {
    name: '懒加载容器滚动',
    route: '/cases/observer/lazy-image',
    facts: async ({ evaluate }) => {
      /** 从「已加载 X / 30」里取 X */
      const readLoaded = () =>
        evaluate(
          `Number(((document.querySelector('.stat')?.innerText ?? '').split('/')[0] ?? '').replace(/[^0-9]/g, ''))`,
        )
      const before = await readLoaded()
      await evaluate(`(() => {
        const el = document.querySelector('.scroll-area')
        if (el) el.scrollTop = el.scrollHeight
      })()`)
      await sleep(900)
      return { before, after: await readLoaded() }
    },
    assert: (result) => {
      const failures = []
      if (!(result.after > result.before)) {
        failures.push(`滚动容器后没有加载新图片（${result.before} → ${result.after}）`)
      }
      return failures
    },
  },
  {
    name: '布局偏移注入',
    route: '/cases/performance/perf-observer',
    facts: async ({ evaluate }) => {
      const clicked = await evaluate(`(() => {
        const btn = [...document.querySelectorAll('.demo-card button')].find((item) =>
          item.textContent.includes('制造布局偏移')
        )
        if (!btn) return false
        btn.click()
        return true
      })()`)
      await sleep(300)
      return {
        clicked,
        blockAdded: await evaluate(
          `document.querySelector('.demo-card')?.innerText.includes('布局偏移演示块（CLS +）') ?? false`,
        ),
      }
    },
    assert: (result) => {
      const failures = []
      if (!result.clicked) failures.push('没有找到「制造布局偏移」按钮')
      if (!result.blockAdded) {
        failures.push('点击后没有插入偏移块（模板 ref 可能没拿到挂载点）')
      }
      return failures
    },
  },
  {
    name: 'Intl 行数',
    route: '/cases/basics/intl-format',
    facts: async ({ evaluate }) => ({
      stats: await evaluate(`document.querySelector('.stats')?.innerText ?? ''`),
    }),
    assert: (result) => {
      const failures = []
      if (!/手写拼接代码\s*26\s*行/.test(result.stats)) {
        failures.push('手写代码行数不是 26（生产构建压行后可能失真）')
      }
      if (!/Intl 核心代码\s*4\s*行/.test(result.stats)) {
        failures.push('Intl 核心代码行数不是 4（生产构建压行后可能失真）')
      }
      return failures
    },
  },
  {
    name: 'Element Plus 案例样式',
    route: '/cases/practice/debounce-throttle',
    facts: async ({ evaluate }) => {
      // 首次访问 dev 服务器要现编译 EP 组件，3.2s 可能不够，这里最多再等 6s
      for (let i = 0; i < 20; i++) {
        if (await evaluate(`Boolean(document.querySelector('.demo-card .el-input'))`)) break
        await sleep(300)
      }

      return {
        epInput: await evaluate(`Boolean(document.querySelector('.demo-card .el-input'))`),
        /** 样式是否真的生效：读计算样式，dev（样式内联注入）与 preview（独立 CSS chunk）都适用 */
        epStyled: await evaluate(`(() => {
          const wrapper = document.querySelector('.demo-card .el-input__wrapper')
          if (!wrapper) return null
          const style = getComputedStyle(wrapper)
          return style.boxShadow !== 'none' && style.borderRadius !== '0px'
        })()`),
        /** 组件样式是否走了独立文件：只有 preview 才有 CSS chunk，dev 下为 null（不适用） */
        epCssLoaded: IS_PREVIEW
          ? await evaluate(`[...document.styleSheets].some(s => (s.href ?? '').includes('element-plus'))`)
          : null,
      }
    },
    assert: (result) => {
      const failures = []
      if (!result.epInput) failures.push('EP 输入框没有渲染')
      if (result.epStyled === false) failures.push('EP 输入框没有套上组件样式')
      if (result.epCssLoaded === false) failures.push('EP 组件样式没有加载')
      return failures
    },
  },
  {
    name: '列表难度筛选',
    route: '/cases',
    facts: async ({ evaluate }) => {
      const total = await evaluate(`document.querySelectorAll('.case-card').length`)
      await evaluate(
        `[...document.querySelectorAll('.filter-chips--secondary .filter-chip')]
          .find((chip) => chip.textContent.includes('入门'))?.click()`,
      )
      await sleep(600)
      return {
        total,
        filtered: await evaluate(`document.querySelectorAll('.case-card').length`),
        /** 过滤后每张卡片的难度标签都必须是「入门」，混进别的难度就算失败 */
        nonBeginnerCards: await evaluate(
          `[...document.querySelectorAll('.case-card .card-head .tag')]
            .filter((tag) => tag.textContent.trim() !== '入门').length`,
        ),
      }
    },
    assert: (result) => {
      const failures = []
      if (!(result.filtered > 0 && result.filtered < result.total)) {
        failures.push(`难度筛选没有生效（${result.total} → ${result.filtered}）`)
      }
      if (result.nonBeginnerCards > 0) failures.push('筛选结果里混进了其他难度')
      return failures
    },
  },
  {
    name: '无效路由兜底',
    route: '/nope/not-here',
    facts: async ({ evaluate }) => ({
      title: await evaluate(`document.title`),
      heading: await evaluate(
        `document.querySelector('.not-found-title')?.textContent?.trim() ?? ''`,
      ),
    }),
    assert: (result) => {
      const failures = []
      if (result.heading !== '页面不存在') failures.push('没有渲染 404 页面')
      if (!result.title.includes('页面不存在')) failures.push(`文档标题没更新：${result.title}`)
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

/**
 * 动画与交互分类抽检
 * 8 个入门动画案例各自差异很大，用「逐页打开 + 375px + 有内容 + 有按钮」做统一兜底：
 * 单页定制断言成本高，但渲染失败、横向溢出、控制台报错这三类问题必须先被拦住
 */
const ANIMATION_CASES = [
  'skeleton-shimmer',
  'accordion-slide',
  'drawer-slide',
  'progress-ring',
  'magnetic-button',
  'snap-carousel',
  'tooltip-pop',
  'focus-visible-ring',
]

/**
 * 等演示区真正加载完成：dev 首次编译案例 chunk 可能慢，最多等 10 秒
 * 只判断 .demo-card 是否存在不够：CasePage 在演示组件到达前就渲染了这张卡，
 * 里面是「演示加载中…」占位，过早采集会得到空内容
 */
async function waitForDemo(page, timeoutMs = 10000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const ready = await page.evaluate(`(() => {
      const card = document.querySelector('.demo-card')
      if (!card) return false
      // 占位符还在 = 演示组件还没到（或加载失败）
      return !card.querySelector('.async-placeholder')
    })()`)
    if (ready) return true
    await sleep(250)
  }
  return false
}

/** 采集当前视口下的页面事实（桌面与 375px 共用） */
async function collectPageFacts(page) {
  return page.evaluate(`({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    demoMounted: Boolean(document.querySelector('.demo-card')),
    demoTextLength: document.querySelector('.demo-card')?.innerText?.trim().length ?? 0,
    buttons: document.querySelectorAll('.demo-card button').length,
    /** 按钮 / 输入框 / 下拉 / 可聚焦元素都算「可操作控件」 */
    interactive: document.querySelectorAll(
      '.demo-card button, .demo-card input, .demo-card select, .demo-card textarea, .demo-card [tabindex]'
    ).length,
  })`)
}

/**
 * 单案例通用巡检：--case practice/vitest-gate
 * 不做案例定制断言，只兜住「打不开 / 没渲染 / 溢出 / 控制台报错」四类硬问题，
 * 让改任意一个案例都有 5~10 秒的机器验证可用
 */
async function checkCase(port, casePath) {
  const route = `/cases/${casePath}`
  const target = await openPage(port, BASE + route)
  const page = await connectPage(target)

  try {
    // 桌面先看：演示是否挂载、有没有控件、页面有没有横向溢出
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    })
    const ready = await waitForDemo(page)
    const desktop = await collectPageFacts(page)

    // 再切 375px：窄屏是最容易溢出的场景
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 720,
      deviceScaleFactor: 1,
      mobile: true,
    })
    await sleep(500)
    const mobile = await collectPageFacts(page)

    const failures = []
    if (!ready) failures.push('演示区 10 秒内没有加载完成')
    if (!desktop.demoMounted) failures.push('演示区没有挂载')
    if (desktop.demoTextLength < 10) failures.push('演示区没有渲染出内容')
    // interactive 只作为结果展示，不作为硬失败：无限滚动这类演示靠滚动触发，没有按钮
    if (desktop.scrollWidth > desktop.innerWidth) {
      failures.push(`桌面出现横向滚动（${desktop.scrollWidth} > ${desktop.innerWidth}）`)
    }
    if (mobile.scrollWidth > mobile.innerWidth) {
      failures.push(`375px 出现横向滚动（${mobile.scrollWidth} > ${mobile.innerWidth}）`)
    }
    failures.push(...page.errors)

    return {
      name: `单案例 ${casePath}`,
      route,
      result: {
        demoTextLength: desktop.demoTextLength,
        interactive: desktop.interactive,
        desktopScrollWidth: desktop.scrollWidth,
        mobileScrollWidth: mobile.scrollWidth,
      },
      failures,
    }
  } finally {
    page.close()
    await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {})
  }
}

/**
 * 全案例巡检：--sweep [--only 分类/关键字]
 * 81 条路由逐个在 375px 打开，只断言「挂载 + 无横向溢出 + 零控制台报错」。
 * 这是静态体检补不了的一层：真实渲染失败、响应式溢出只有跑浏览器才知道。
 */
async function sweepCases(port, filter) {
  const paths = listCasePaths().filter((item) => !filter || item.includes(filter))
  const results = []

  console.log(`[sweep] 开始巡检 ${paths.length} 个案例（375px）`)
  for (const [index, casePath] of paths.entries()) {
    const route = `/cases/${casePath}`
    const target = await openPage(port, BASE + route)
    const page = await connectPage(target)

    try {
      await page.send('Emulation.setDeviceMetricsOverride', {
        width: 375,
        height: 720,
        deviceScaleFactor: 1,
        mobile: true,
      })
      const mounted = await waitForDemo(page, 6000)
      await sleep(300)
      const facts = await collectPageFacts(page)

      const failures = []
      if (!mounted || !facts.demoMounted) failures.push('演示区 6 秒内没有加载完成')
      if (facts.scrollWidth > facts.innerWidth) {
        failures.push(`375px 出现横向滚动（${facts.scrollWidth} > ${facts.innerWidth}）`)
      }
      failures.push(...page.errors)

      results.push({ name: `案例 ${casePath}`, route, result: facts, failures })
    } finally {
      page.close()
      await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {})
    }

    // 进度点：81 个案例跑几分钟，没有进度会以为卡死
    process.stdout.write((index + 1) % 10 === 0 ? `${index + 1} ` : '.')
  }
  process.stdout.write('\n')

  return results
}

async function checkAnimationCases(port) {
  const results = []

  for (const caseId of ANIMATION_CASES) {
    const route = `/cases/animation/${caseId}`
    const target = await openPage(port, BASE + route)
    const page = await connectPage(target)

    try {
      // 每个动画案例都要在 375px 下站得住：窄屏是最容易溢出的一档
      await page.send('Emulation.setDeviceMetricsOverride', {
        width: 375,
        height: 720,
        deviceScaleFactor: 1,
        mobile: true,
      })
      await sleep(1500)

      const result = await page.evaluate(`({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        /** 演示区文字长度：比「组件挂载」更能说明真的渲染出来了 */
        demoTextLength: document.querySelector('.demo-card')?.innerText?.trim().length ?? 0,
        /** 每个动画案例都有对比开关与操作按钮，这里是「Demo 渲染完整」的粗粒度证据 */
        buttons: document.querySelectorAll('.demo-card button').length,
      })`)

      const failures = []
      if (result.scrollWidth > result.innerWidth) {
        failures.push(`375px 出现横向滚动（${result.scrollWidth} > ${result.innerWidth}）`)
      }
      if (result.demoTextLength < 20) failures.push('演示区没有渲染出内容')
      if (result.buttons < 1) failures.push('演示区没有可操作按钮')
      if (page.errors.length > 0) failures.push(...page.errors)

      results.push({ name: `动画案例 ${caseId}`, route, result, failures })
    } finally {
      page.close()
      await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {})
    }
  }

  return results
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
  if (CASE) {
    // 单案例模式：任意案例都能用，不依赖是否写了定制场景
    results.push(await checkCase(chrome.port, resolveCasePath(CASE)))
  } else if (SWEEP) {
    // 全案例巡检：--only 在这里是过滤器（分类 / 关键字），不是场景名
    results.push(...(await sweepCases(chrome.port, ONLY)))
  } else {
    const scenarios = pickScenarios(ONLY)
    if (scenarios.length === 0) {
      throw new Error(
        `--only「${ONLY}」没有命中任何场景，可用场景：${SCENARIOS.map((item) => item.name).join(' / ')}；` +
          `想验任意案例请用 --case <分类>/<案例>`,
      )
    }
    for (const scenario of scenarios) {
      results.push(await runScenario(chrome.port, scenario))
    }
    // 全量模式才补窄屏与动画分类抽检：--only 要的是「改一个案例只验这一个」
    if (!ONLY) {
      results.push(await checkMobile(chrome.port))
      results.push(...(await checkAnimationCases(chrome.port)))
    }
  }

  const mode = CASE
    ? `--case ${CASE}`
    : SWEEP
      ? `--sweep${ONLY ? ` --only ${ONLY}` : ''}`
      : ONLY
        ? `--only ${ONLY}`
        : ''
  console.log(`\n[check:ui] 目标：${BASE}${mode ? `（${mode}）` : ''}\n`)

  const failed = results.filter((item) => item.failures.length > 0)

  if (SWEEP) {
    // 81 条路由逐条打印会刷屏，只列失败项，通过数看汇总
    for (const item of failed) {
      console.log(`✗ ${item.name}`)
      for (const failure of item.failures) console.log(`    ↳ ${failure}`)
    }
    console.log(
      `\n[check:ui] 全案例巡检：${results.length - failed.length}/${results.length} 通过` +
        `${failed.length > 0 ? `，${failed.length} 个失败` : ' ✓'}`,
    )
  } else {
    for (const item of results) {
      const facts = Object.entries(item.result)
        .map(([key, value]) => `${key}=${value}`)
        .join('  ')
      console.log(`${item.failures.length === 0 ? '✓' : '✗'} ${item.name}  ${facts}`)
      for (const failure of item.failures) console.log(`    ↳ ${failure}`)
    }
  }

  if (failed.length > 0) {
    console.error(
      `\n[check:ui] ${failed.length} 个${SWEEP ? '案例' : '场景'}未通过`,
    )
    exitCode = 1
  } else {
    console.log(`\n[check:ui] ${results.length} 个${SWEEP ? '案例' : '场景'}全部通过 ✓`)
  }
} finally {
  shutdown(chrome)
}

process.exit(exitCode)
