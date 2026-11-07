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
 *   npm run check:ui -- --sweep               # 全案例巡检：84 条路由 × 375px
 *   npm run check:ui -- --shot composables/use-keyboard-shortcut --out docs/screenshots/composables/use-keyboard-shortcut --width 375
 *                                             # 只截演示区并写到指定目录（留档用，不断言）
 *   node scripts/check-ui.mjs --base http://localhost:5173   # 验 dev 服务器
 *
 * 退出码：全部通过 0，有失败 1（可直接进 CI 或本地门禁）
 */
import { spawn, spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
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

/** 截图输出目录：和 chrome profile 一样固定放 node_modules/.tmp，已被 git 忽略 */
const SHOT_DIR = path.resolve('node_modules/.tmp/shots')

/** 是否跑全案例巡检（81 条路由 × 375px） */
function readSweep() {
  return process.argv.includes('--sweep') || process.env.CHECK_SWEEP === '1'
}

/**
 * 读取 --shot 参数：给演示区拍截图（逗号分隔的「分类/案例」）
 * 为什么需要：间距、字号、配色漂移这类观感问题断言不出来，但可以每次截同一块区域，
 * 改完直接比对；截图不参与断言，所以跑完永远返回 0
 */
function readShots() {
  const index = process.argv.indexOf('--shot')
  if (index === -1) return []
  const raw = process.argv[index + 1] ?? ''
  if (!raw || raw.startsWith('--')) return []
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

/** 是否拍暗色（--dark）：一次性把浅/暗两套都截出来，省得手动切主题 */
function readDark() {
  return process.argv.includes('--dark')
}

/** 截图输出目录（--out，相对路径按当前工作目录解析）：默认仍是临时目录 */
function readOutDir() {
  const index = process.argv.indexOf('--out')
  if (index > -1 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--')) {
    return path.resolve(process.argv[index + 1])
  }
  return SHOT_DIR
}

/** 截图宽度（--width 375 / 1280 / both）：留档通常只要 375，避免多存一张 1280 */
function readWidths() {
  const index = process.argv.indexOf('--width')
  const raw = index > -1 ? process.argv[index + 1] : ''
  if (raw === '375' || raw === '1280') return [Number(raw)]
  return [1280, 375]
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
const SHOTS = readShots()
const DARK = readDark()
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
      // 按钮依赖 scroll 事件 + rAF 更新，dev 首次编译时 400ms 可能不够，最多等 2.4s
      let shown = false
      for (let i = 0; i < 12; i++) {
        shown = await evaluate(`Boolean(document.querySelector('.back-top'))`)
        if (shown) break
        await sleep(200)
      }
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
      let backTopShown = false
      for (let i = 0; i < 12; i++) {
        backTopShown = await evaluate(`Boolean(document.querySelector('.back-top'))`)
        if (backTopShown) break
        await sleep(200)
      }
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
    name: '轮播 rAF 补间',
    route: '/cases/animation/snap-carousel',
    facts: async ({ evaluate }) => {
      /** 全部在页面内按真实时间轴跑：点下一张 → 采样中途 → 采样终点 → 切降级再采样 */
      return evaluate(`(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
        const track = () => document.querySelector('.snap-demo .track')
        const next = () =>
          [...document.querySelectorAll('.snap-demo button')].find(
            (item) => item.getAttribute('aria-label') === '下一张'
          )

        const start = track().scrollLeft
        next().click()
        await wait(100)
        const mid = track().scrollLeft
        await wait(500)
        const final = track().scrollLeft

        // 打开「模拟减少动态效果」：下一次跳转应该直接到位，不再有中间帧
        const toggle = [...document.querySelectorAll('.snap-demo button')].find((item) =>
          item.textContent.includes('模拟减少动态效果')
        )
        toggle.click()
        await wait(100)
        next().click()
        await wait(100)
        const instant = track().scrollLeft
        await wait(500)
        const instantFinal = track().scrollLeft

        // 互斥模式按钮：两项、只有一项选中、原生 radio 只有一项 checked
        const modes = [...document.querySelectorAll('.snap-demo .modes .n-radio-button')]
        return {
          start,
          mid,
          final,
          instant,
          instantFinal,
          modes: modes.length,
          checked: modes.filter((item) => item.classList.contains('n-radio-button--checked')).length,
          inputChecked: document.querySelectorAll('.snap-demo .modes input[type="radio"]:checked').length,
          dotsCurrent: document.querySelectorAll('.snap-demo .dot[aria-current="true"]').length,
        }
      })()`)
    },
    assert: (result) => {
      const failures = []
      if (!(result.final > 0)) failures.push(`点下一张后没有滚动（${result.final}px）`)
      if (!(result.mid > 0 && result.mid < result.final - 1)) {
        failures.push(
          `点下一张后 100ms 位置是 ${result.mid}px，终点是 ${result.final}px，没有看到补间中间帧`,
        )
      }
      if (Math.abs(result.instant - result.instantFinal) > 2) {
        failures.push(
          `模拟降级后 100ms 还在动（${result.instant}px → ${result.instantFinal}px），没有直接到位`,
        )
      }
      if (result.modes !== 2) failures.push(`模式按钮不是 2 个单选按钮（${result.modes} 个）`)
      if (result.checked !== 1) failures.push(`模式按钮选中样式数量不是 1（${result.checked} 个）`)
      if (result.inputChecked !== 1) failures.push(`模式按钮 checked 数量不是 1（${result.inputChecked} 个）`)
      if (result.dotsCurrent !== 1) failures.push(`圆点 aria-current 数量不是 1（${result.dotsCurrent} 个）`)
      return failures
    },
  },
  {
    name: '抽屉退场动画',
    route: '/cases/animation/drawer-slide',
    facts: async ({ evaluate, send }) => {
      //! 强制模拟「减少动态效果」：这正是用户机器上的情况（系统关了动画）。
      // 站点不跟随这个设置降级，所以必须在这个条件下也能测出退场过渡
      await send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
      })
      await sleep(200)

      /** 全部在页面内按真实时间轴跑：开 → 关 → 采样，避免宿主侧 sleep 与页面计时不同步 */
      const result = await evaluate(`(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
        // 演示区控件可能有两种 DOM：普通按钮，或 Naive 单选组里的 label 标签
        const button = (text, root = document) =>
          [...root.querySelectorAll('button, .n-radio-button')].find((item) =>
            item.textContent.includes(text),
          )

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
    name: '减少动态效果下演示区仍播放动画',
    route: '/cases/vue3/transition-group',
    facts: async ({ evaluate, send }) => {
      //! 站点的取舍：系统上报 reduce 时也照常播放动效（教学站），这里锁住这个行为
      await send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
      })
      await sleep(200)

      return await evaluate(`(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
        const btn = [...document.querySelectorAll('.demo-card .bar button')]
          .find((item) => item.textContent.trim() === '打乱顺序')
        btn?.click()
        await wait(120)
        // 过渡进行中：Vue 给移动项加了 *-move 类并写 transform，计算值是插值矩阵
        const moving = [...document.querySelectorAll('.demo-card .list li')]
          .map((item) => getComputedStyle(item).transform)
          .filter((value) => value !== 'none' && value !== 'matrix(1, 0, 0, 1, 0, 0)').length
        const moveClass = document.querySelectorAll('.demo-card .list .list-move').length
        await wait(800)
        const shell = document.querySelector('.back-btn')
        return {
          reduceMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
          moving,
          moveClass,
          stats: document.querySelector('.demo-card .stats')?.innerText ?? '',
          shellDuration: shell ? parseFloat(getComputedStyle(shell).transitionDuration) : null,
        }
      })()`)
    },
    assert: (result) => {
      const failures = []
      if (!result.reduceMotion) failures.push('没有模拟出 reduce，场景前置条件不成立')
      if (!(result.moveClass > 0)) failures.push('打乱后没有元素拿到 list-move 类，过渡组没生效')
      if (!(result.moving > 0)) {
        failures.push('reduce 下打乱后 120ms 没有任何一项在移动（演示区动画被压掉了）')
      }
      const settle = result.stats.match(/完成耗时\s*(\d+)\s*ms/)
      if (!settle) failures.push('没读到完成耗时')
      else if (Number(settle[1]) < 100) {
        failures.push(`reduce 下完成耗时只有 ${settle[1]}ms，补位动画没有真的播放`)
      }
      if (result.shellDuration === null) failures.push('找不到站点外壳按钮，无法确认外壳动效')
      else if (!(result.shellDuration > 0.05)) {
        failures.push(`站点外壳的过渡时长是 ${result.shellDuration}s，系统上报 reduce 时被压掉了`)
      }
      return failures
    },
  },
  {
    name: '减少动态效果下页面切换仍播放过渡',
    route: '/cases/practice/route-transition',
    facts: async ({ evaluate, send }) => {
      //! 同上：系统上报 reduce 时，站点的路由转场也要照常播放
      await send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
      })
      await sleep(200)

      return await evaluate(`(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
        const tab = [...document.querySelectorAll('.rt-tabs .rt-tab')]
          .find((item) => item.textContent.trim() === '商品列表')
        tab?.click()
        await wait(120)
        const midPages = [...document.querySelectorAll('.rt-stage .rt-page')]
        return {
          reduceMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
          clicked: Boolean(tab),
          midCount: midPages.length,
          midTransition: midPages.map((item) => getComputedStyle(item).transform).join(' | '),
          finalTitle: await (async () => {
            await wait(900)
            return document.querySelector('.rt-stage .rt-page h3')?.textContent?.trim() ?? ''
          })(),
          stackDepth: document.querySelectorAll('.rt-stack .rt-chip').length,
        }
      })()`)
    },
    assert: (result) => {
      const failures = []
      if (!result.reduceMotion) failures.push('没有模拟出 reduce，场景前置条件不成立')
      if (!result.clicked) failures.push('没找到「商品列表」标签')
      if (result.midCount !== 1) failures.push(`out-in 过渡中应只有 1 页在动（现在 ${result.midCount} 页）`)
      if (/^none$|^none \| none$/.test(result.midTransition)) {
        failures.push(`reduce 下切页 120ms 后没有位移（${result.midTransition}），转场被压掉了`)
      }
      if (result.finalTitle !== '商品列表') failures.push(`过渡结束后页面是「${result.finalTitle}」`)
      if (result.stackDepth !== 2) failures.push(`历史栈应该是 2 项（现在 ${result.stackDepth}）`)
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
    name: '懒加载滚动、重置与持续观察',
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
      const after = await readLoaded()

      // 重置列表：加载数应回到初始值，日志清空后重新出现新的加载记录
      const resetClicked = await evaluate(`(() => {
        const btn = [...document.querySelectorAll('.demo-card button')].find((item) =>
          item.textContent.includes('重置列表')
        )
        if (!btn) return false
        btn.click()
        return true
      })()`)
      await sleep(900)
      const afterReset = await readLoaded()

      // 打开持续观察后滚到底：已加载图片滚出应出现「（已加载）」记录
      // （n-switch 是 div role=switch，没有原生 input，点它再读 aria-checked）
      const keepChecked = await evaluate(`(async () => {
        const row = [...document.querySelectorAll('.demo-card .switch')].find((item) =>
          item.textContent.includes('持续观察')
        )
        const sw = row?.querySelector('[role="switch"]')
        if (!sw) return false
        sw.click()
        // 等 Vue 把新的 checked 渲染到 aria-checked 上再读
        await new Promise((resolve) => setTimeout(resolve, 150))
        return sw.getAttribute('aria-checked') === 'true'
      })()`)
      await evaluate(`(() => {
        const el = document.querySelector('.scroll-area')
        if (el) el.scrollTop = el.scrollHeight
      })()`)
      await sleep(900)

      return {
        before,
        after,
        resetClicked,
        afterReset,
        keepChecked,
        logHasLoadedEvent: await evaluate(
          `document.querySelector('.log-panel')?.innerText.includes('（已加载）') ?? false`,
        ),
      }
    },
    assert: (result) => {
      const failures = []
      if (!(result.after > result.before)) {
        failures.push(`滚动容器后没有加载新图片（${result.before} → ${result.after}）`)
      }
      if (!result.resetClicked) failures.push('没有找到「重置列表」按钮')
      if (result.afterReset !== result.before) {
        failures.push(`重置后加载数没有回到初始值（${result.afterReset} ≠ ${result.before}）`)
      }
      if (!result.keepChecked) failures.push('「持续观察已加载图片」开关没有打开')
      if (!result.logHasLoadedEvent) {
        failures.push('持续观察后没有出现已加载图片的滚入/滚出记录')
      }
      return failures
    },
  },
  {
    name: '布局偏移注入与重置',
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
      const blockAdded = await evaluate(
        `document.querySelector('.demo-card')?.innerText.includes('布局偏移演示块（CLS +）') ?? false`,
      )
      const shiftCountBefore = await evaluate(
        `document.querySelector('.shift-count')?.innerText ?? ''`,
      )

      // 重置实验：偏移块、计数、日志都要回到初始态；加载期指标不受影响
      const resetClicked = await evaluate(`(() => {
        const btn = [...document.querySelectorAll('.demo-card button')].find((item) =>
          item.textContent.includes('重置实验')
        )
        if (!btn) return false
        btn.click()
        return true
      })()`)
      await sleep(300)

      return {
        clicked,
        blockAdded,
        shiftCountBefore,
        resetClicked,
        blocksAfterReset: await evaluate(`document.querySelectorAll('.shift-block').length`),
        shiftCountAfter: await evaluate(
          `document.querySelector('.shift-count')?.innerText ?? ''`,
        ),
        logAfterReset: await evaluate(
          `document.querySelector('.log-panel')?.innerText ?? ''`,
        ),
      }
    },
    assert: (result) => {
      const failures = []
      if (!result.clicked) failures.push('没有找到「制造布局偏移」按钮')
      if (!result.blockAdded) {
        failures.push('点击后没有插入偏移块（模板 ref 可能没拿到挂载点）')
      }
      if (!/偏移块\s*1\s*\/\s*5/.test(result.shiftCountBefore)) {
        failures.push(`注入后偏移块计数不对：${result.shiftCountBefore}`)
      }
      if (!result.resetClicked) failures.push('没有找到「重置实验」按钮')
      if (result.blocksAfterReset !== 0) {
        failures.push(`重置后仍残留 ${result.blocksAfterReset} 个偏移块`)
      }
      if (!/偏移块\s*0\s*\/\s*5/.test(result.shiftCountAfter)) {
        failures.push(`重置后偏移块计数没有归零：${result.shiftCountAfter}`)
      }
      if (!result.logAfterReset.includes('已重置实验数据')) {
        failures.push('重置后日志里没有重置记录')
      }
      return failures
    },
  },
  {
    name: '事件循环任务开关',
    route: '/cases/basics/event-loop',
    facts: async ({ evaluate }) => {
      /** 预设/任务开关都走真实点击，验证「直觉顺序」会随勾选变化 */
      return evaluate(`(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
        const names = () =>
          [...document.querySelectorAll('.el-demo .lines .line .name')].map((item) =>
            item.textContent.trim()
          )
        const run = () => document.querySelector('.el-demo [data-action="run"]').click()

        // 默认勾选 timer0 + Promise.then + queueMicrotask
        document.querySelector('[data-mode="expect"]').click()
        await wait(50)
        const expectBasic = names()

        document.querySelector('[data-mode="real"]').click()
        run()
        await wait(150)
        const realBasic = names()

        // 只留 Promise.then：验证任务开关真的会改变排入队列的任务
        // （n-checkbox 是 div role=checkbox，没有原生 input，直接点勾选行根节点）
        document.querySelector('[data-task="timer0"]').click()
        document.querySelector('[data-task="micro"]').click()
        await wait(50)
        run()
        await wait(150)
        const realThenOnly = names()

        // 慢任务预设：点击 → 忙 200ms → 微任务 → 定时器
        document.querySelector('[data-preset="slow"]').click()
        await wait(50)
        run()
        await wait(500)
        const realSlow = names()

        const modes = [...document.querySelectorAll('.el-demo .modes .n-radio-button')]
        const runButton = document.querySelector('.el-demo [data-action="run"]')
        const activeModeInner = document.querySelector(
          '.el-demo .modes .n-radio-button--checked',
        )
        return {
          expectBasic,
          realBasic,
          realThenOnly,
          realSlow,
          modeCount: modes.length,
          modeChecked: modes.filter((item) => item.classList.contains('n-radio-button--checked')).length,
          modeInputChecked: document.querySelectorAll('.el-demo .modes input[type="radio"]:checked').length,
          nfmButton: runButton?.classList.contains('n-button') ?? false,
          nfmRadio: Boolean(document.querySelector('.el-demo .modes.n-radio-group')),
          runHeight: runButton ? Math.round(runButton.getBoundingClientRect().height) : 0,
          modeHeight: activeModeInner ? Math.round(activeModeInner.getBoundingClientRect().height) : 0,
          taskCount: document.querySelectorAll('.el-demo .task-toggle').length,
        }
      })()`)
    },
    assert: (result) => {
      const failures = []
      const has = (list, index, text) => (list[index] ?? '').includes(text)

      if (!has(result.expectBasic, 0, '用户点击')) {
        failures.push(`直觉顺序第 1 行不是点击回调：${result.expectBasic[0] ?? '空'}`)
      }
      if (!has(result.expectBasic, 1, 'setTimeout 0ms')) {
        failures.push(`直觉顺序没有把定时器排在微任务前：${result.expectBasic[1] ?? '空'}`)
      }
      if (!has(result.expectBasic, 2, 'Promise.then')) {
        failures.push(`直觉顺序第 3 行不是 Promise.then：${result.expectBasic[2] ?? '空'}`)
      }
      if (!has(result.realBasic, 0, '用户点击')) {
        failures.push(`真实输出第 1 行不是点击回调：${result.realBasic[0] ?? '空'}`)
      }
      if (!has(result.realBasic, 1, 'Promise.then')) {
        failures.push(`真实输出没有把 Promise.then 排在第 2 位：${result.realBasic[1] ?? '空'}`)
      }
      if (!has(result.realBasic, 2, 'queueMicrotask')) {
        failures.push(`真实输出没有把 queueMicrotask 排在第 3 位：${result.realBasic[2] ?? '空'}`)
      }
      if (!has(result.realBasic, 3, 'setTimeout 0ms')) {
        failures.push(`真实输出没有把定时器排在微任务后：${result.realBasic[3] ?? '空'}`)
      }
      if (result.realThenOnly.length !== 2 || !has(result.realThenOnly, 1, 'Promise.then')) {
        failures.push(`关掉定时器与 queueMicrotask 后应只剩点击 + Promise.then：${result.realThenOnly.join(' / ')}`)
      }
      if (!has(result.realSlow, 1, '主线程忙')) {
        failures.push(`慢任务没有紧跟在点击回调后：${result.realSlow[1] ?? '空'}`)
      }
      const slowPromise = result.realSlow.findIndex((item) => item.includes('Promise.then'))
      const slowTimer = result.realSlow.findIndex((item) => item.includes('setTimeout 0ms'))
      if (!(slowPromise > 1 && slowTimer > slowPromise)) {
        failures.push(`慢任务后微任务没有排在定时器前：${result.realSlow.join(' / ')}`)
      }
      if (result.modeCount !== 2) failures.push(`输出对照不是 2 个单选按钮（${result.modeCount} 个）`)
      if (result.modeChecked !== 1) failures.push(`输出对照选中样式数量不是 1（${result.modeChecked} 个）`)
      if (result.modeInputChecked !== 1) failures.push(`输出对照 checked 数量不是 1（${result.modeInputChecked} 个）`)
      if (!result.nfmButton) failures.push('运行按钮没有使用 Naive UI 的 n-button')
      if (!result.nfmRadio) failures.push('输出对照没有使用 Naive UI 的 n-radio-group')
      if (result.runHeight < 34 || result.runHeight > 40) {
        failures.push(`n-button 高度不在 34~40px（${result.runHeight}px）`)
      }
      if (result.modeHeight < 34 || result.modeHeight > 40) {
        failures.push(`n-radio-button 高度不在 34~40px（${result.modeHeight}px）`)
      }
      if (result.taskCount !== 6) failures.push(`任务开关不是 6 个（${result.taskCount} 个）`)
      return failures
    },
  },
  {
    name: '进度滑杆驱动进度环',
    route: '/cases/animation/progress-ring',
    /** n-slider 是自绘控件：先聚焦手柄，再用键盘右移确认目标值真的被推上去 */
    facts: async ({ evaluate }) =>
      evaluate(`(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
        const targetText = () =>
          document.querySelector('.pr-demo .slider > span')?.innerText?.trim() ?? ''
        const handle = document.querySelector('.pr-demo .slider [role="slider"]')
        const before = targetText()
        handle?.focus()
        handle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
        await wait(120)
        const after = targetText()
        handle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
        await wait(120)
        const afterAgain = targetText()
        return {
          hasHandle: Boolean(handle),
          before,
          after,
          afterAgain,
          ariaNow: handle?.getAttribute('aria-valuenow') ?? '',
        }
      })()`),
    assert: (result) => {
      const failures = []
      if (!result.hasHandle) {
        failures.push('没找到 Naive 滑杆的 role="slider" 手柄')
        return failures
      }
      const num = (text) => Number(/(\d+)/.exec(text ?? '')?.[1] ?? NaN)
      if (!(num(result.after) > num(result.before))) {
        failures.push(`键盘右移没有推高目标值（${result.before} → ${result.after}）`)
      }
      if (!(num(result.afterAgain) > num(result.after))) {
        failures.push(`第二次右移没有继续加（${result.after} → ${result.afterAgain}）`)
      }
      return failures
    },
  },
  {
    name: '时间切片规模与测量',
    route: '/cases/performance/time-slicing',
    facts: async ({ evaluate }) => {
      /** 用 1 万条 / 每批 1000 跑一轮全量与切片，读取对比表里的真实测量值 */
      return evaluate(`(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
        const text = (selector) =>
          document.querySelector(selector)?.textContent?.trim() ?? ''
        /* Naive 下拉不是原生 select：点开面板（.n-base-selection 才是可点区域），
           再按选项文字点选；选项列表会被 teleport 到 body，所以全局找一遍 */
        const pickSelect = async (selector, optionText) => {
          const root = document.querySelector(selector)
          const trigger = root?.querySelector('.n-base-selection') ?? root
          if (!trigger) return false
          trigger.click()
          for (let i = 0; i < 24; i++) {
            const option = [...document.querySelectorAll('.n-base-select-option')]
              .find((item) => (item.textContent ?? '').trim() === optionText)
            if (option) {
              option.click()
              await wait(150)
              return true
            }
            await wait(50)
          }
          return false
        }
        const waitResult = async (selector) => {
          for (let i = 0; i < 80; i++) {
            const value = text(selector)
            if (value && value !== '—' && value !== '未运行') return value
            await wait(50)
          }
          return text(selector)
        }

        const totalPicked = await pickSelect('.ts-total', '10,000 条')
        const batchPicked = await pickSelect('.ts-batch', '1000 条')

        document.querySelector('[data-mode="full"]').click()
        const fullFirstText = await waitResult('[data-result="full-first"]')
        const fullBlockText = text('[data-result="full-block"]')
        const fullDurationText = text('[data-result="full-duration"]')
        const fullTotalText = text('[data-result="full-total"]')
        const fullFramesText = text('[data-result="full-frames"]')

        document.querySelector('[data-mode="slice"]').click()
        // 切片渲染中手动点一次「测主线程响应」，验证 event.timeStamp 口径
        await wait(120)
        document.querySelector('.ts-demo .btn-act').click()
        await wait(120)
        const sliceFirstText = await waitResult('[data-result="slice-first"]')
        const sliceBlockText = text('[data-result="slice-block"]')
        const sliceDurationText = text('[data-result="slice-duration"]')
        const sliceTotalText = text('[data-result="slice-total"]')
        const sliceFramesText = text('[data-result="slice-frames"]')
        const sliceClickText = text('[data-result="slice-click"]')

        const modes = [...document.querySelectorAll('.ts-demo .seg .n-radio-button')]
        return {
          /** Naive 下拉的当前值读可见文字（原生 select 才有 .value） */
          totalSelect: document.querySelector('.ts-total')?.textContent?.trim() ?? '',
          batchSelect: document.querySelector('.ts-batch')?.textContent?.trim() ?? '',
          totalPicked,
          batchPicked,
          fullFirstText,
          fullBlockText,
          fullDurationText,
          fullTotalText,
          fullFramesText,
          sliceFirstText,
          sliceBlockText,
          sliceDurationText,
          sliceTotalText,
          sliceFramesText,
          sliceClickText,
          modeCount: modes.length,
          modeChecked: modes.filter((item) => item.classList.contains('n-radio-button--checked')).length,
          modeInputChecked: document.querySelectorAll('.ts-demo .seg input[type="radio"]:checked').length,
        }
      })()`)
    },
    assert: (result) => {
      const failures = []
      const parseMs = (value) => {
        const parsed = Number.parseFloat(value.replace(/[^0-9.]/g, ''))
        return Number.isFinite(parsed) ? parsed : 0
      }
      const fullFirst = parseMs(result.fullFirstText)
      const fullBlock = parseMs(result.fullBlockText)
      const fullDuration = parseMs(result.fullDurationText)
      const sliceFirst = parseMs(result.sliceFirstText)
      const sliceBlock = parseMs(result.sliceBlockText)
      const sliceDuration = parseMs(result.sliceDurationText)
      const sliceFrames = Number.parseInt(result.sliceFramesText, 10)

      if (!result.totalPicked || !result.batchPicked) {
        failures.push(
          `Naive 下拉没点中选项（数据量 ${result.totalPicked} / 每批 ${result.batchPicked}）`,
        )
      }
      if (!result.totalSelect.includes('10,000')) {
        failures.push(`数据量没有切到 10,000（显示 ${result.totalSelect}）`)
      }
      if (!result.batchSelect.includes('1000')) {
        failures.push(`每批没有切到 1000（显示 ${result.batchSelect}）`)
      }
      if (!result.fullTotalText.includes('10,000') || !result.sliceTotalText.includes('10,000')) {
        failures.push(
          `对比表数据量不是 10,000：${result.fullTotalText} / ${result.sliceTotalText}`,
        )
      }
      if (!(fullFirst > 0 && fullBlock > 0 && fullDuration > 0)) {
        failures.push(
          `全量测量值缺失：首帧 ${result.fullFirstText}、阻塞 ${result.fullBlockText}、总耗时 ${result.fullDurationText}`,
        )
      }
      if (!(sliceFirst > 0 && sliceBlock > 0 && sliceDuration > 0)) {
        failures.push(
          `切片测量值缺失：首帧 ${result.sliceFirstText}、阻塞 ${result.sliceBlockText}、总耗时 ${result.sliceDurationText}`,
        )
      }
      if (!(fullFirst + 1 >= fullBlock)) {
        failures.push(
          `全量首帧早于主线程阻塞：首帧 ${result.fullFirstText} / 阻塞 ${result.fullBlockText}`,
        )
      }
      if (!(sliceFirst < sliceDuration)) {
        failures.push(
          `切片首帧没有早于总耗时：首帧 ${result.sliceFirstText} / 总耗时 ${result.sliceDurationText}`,
        )
      }
      if (!(sliceFrames >= 10)) {
        failures.push(`切片批次数不足 10（${result.sliceFramesText}）`)
      }
      if (!result.fullFramesText.includes('1 次全量')) {
        failures.push(`全量批次数显示异常：${result.fullFramesText}`)
      }
      if (!result.sliceClickText.includes('ms')) {
        failures.push(`切片渲染中点击响应没有测到：${result.sliceClickText}`)
      }
      if (result.modeCount !== 2) failures.push(`渲染方式不是 2 个单选按钮（${result.modeCount} 个）`)
      if (result.modeChecked !== 1) failures.push(`渲染方式选中样式数量不是 1（${result.modeChecked} 个）`)
      if (result.modeInputChecked !== 1) failures.push(`渲染方式 checked 数量不是 1（${result.modeInputChecked} 个）`)
      return failures
    },
  },
  {
    name: '乐观更新提示不挤布局',
    route: '/cases/practice/optimistic-update',
    facts: async ({ evaluate }) => {
      /** 切到乐观模式 → 点赞 → 成功提示 → 打开失败开关再点赞 → 失败回滚 */
      return evaluate(`(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
        const panelsTop = () =>
          Math.round(document.querySelector('.ou-demo .panels').getBoundingClientRect().top)
        // Naive message 的正文节点（容器由 provider Teleport 到 body）
        const msgTexts = () =>
          [...document.querySelectorAll('.n-message__content')].map((item) =>
            (item.textContent ?? '').trim()
          )

        const mode = [...document.querySelectorAll('.ou-demo .modes .n-radio-button')].find((item) =>
          item.textContent.includes('乐观更新')
        )
        mode.click()
        await wait(80)
        const before = panelsTop()
        const modes = [...document.querySelectorAll('.ou-demo .modes .n-radio-button')]

        const first = document.querySelectorAll('.ou-demo .like')[0]
        first.click()
        await wait(60)
        const pressedAt60 = first.getAttribute('aria-pressed')
        const during = panelsTop()

        await wait(400)
        const afterSuccess = panelsTop()
        const successTexts = msgTexts()
        const successTyped = Boolean(document.querySelector('.n-message.n-message--success-type'))

        const container = document.querySelector('.n-message-container')
        const containerRect = container?.getBoundingClientRect()
        const containerTop = containerRect ? Math.round(containerRect.top) : -1
        // 顶部居中：容器铺满整行（left 0 / right 0），靠 align-items 居中，所以量第一条消息本身
        const firstMessageRect = document.querySelector('.n-message')?.getBoundingClientRect()
        const messageCenterDelta = firstMessageRect
          ? Math.round(Math.abs((firstMessageRect.left + firstMessageRect.right) / 2 - window.innerWidth / 2))
          : -1
        const placedTop = container
          ? (container.className ?? '').split(' ').includes('n-message-container--top')
          : false
        const containerInBody = container ? container.closest('.ou-demo') === null : false

        const failBtn = [...document.querySelectorAll('.ou-demo button')].find((item) =>
          item.textContent.includes('模拟接口失败')
        )
        failBtn.click()
        await wait(50)
        const second = document.querySelectorAll('.ou-demo .like')[1]
        second.click()
        await wait(60)
        const secondPressedAt60 = second.getAttribute('aria-pressed')
        await wait(450)
        const secondPressedAfter = second.getAttribute('aria-pressed')
        const afterFail = panelsTop()
        const failTexts = msgTexts()
        const errorTyped = Boolean(document.querySelector('.n-message.n-message--error-type'))

        return {
          before,
          during,
          afterSuccess,
          afterFail,
          pressedAt60,
          secondPressedAt60,
          secondPressedAfter,
          messageCount: successTexts.length,
          successTyped,
          errorTyped,
          placedTop,
          containerInBody,
          containerTop,
          messageCenterDelta,
          successText: successTexts.join(' / '),
          failText: failTexts.join(' / '),
          modeCount: modes.length,
          modeChecked: modes.filter((item) => item.classList.contains('n-radio-button--checked')).length,
          modeInputChecked: document.querySelectorAll('.ou-demo .modes input[type="radio"]:checked').length,
        }
      })()`)
    },
    assert: (result) => {
      const failures = []
      if (result.pressedAt60 !== 'true') {
        failures.push(`乐观更新 60ms 后按钮仍未点亮（aria-pressed=${result.pressedAt60}）`)
      }
      if (result.secondPressedAt60 !== 'false') {
        failures.push(`第二张卡片乐观更新 60ms 后没有立即取消点赞（${result.secondPressedAt60}）`)
      }
      if (result.secondPressedAfter !== 'true') {
        failures.push(`失败后第二张卡片没有回滚（${result.secondPressedAfter}）`)
      }
      if (result.messageCount < 1) failures.push('操作后没有出现 Naive message 提示')
      if (!result.successTyped) failures.push('成功提示不是 message.success（缺 n-message--success-type）')
      if (!result.errorTyped) failures.push('回滚提示不是 message.error（缺 n-message--error-type）')
      if (!result.placedTop) failures.push('message 容器不是顶部居中（缺 n-message-container--top 位置类）')
      if (!result.containerInBody) failures.push('message 容器没有 Teleport 到 body（仍在演示区内部）')
      if (result.containerTop < 0 || result.containerTop > 120) {
        failures.push(`message 容器没有贴近顶部（top=${result.containerTop}px）`)
      }
      if (result.messageCenterDelta < 0 || result.messageCenterDelta > 2) {
        failures.push(`message 没有水平居中（中心偏移 ${result.messageCenterDelta}px）`)
      }
      if (!result.successText.includes('点赞成功')) failures.push('成功提示文案缺失')
      if (!result.failText.includes('已撤回')) failures.push('失败回滚提示文案缺失')
      if (result.modeCount !== 2) failures.push(`更新策略不是 2 个单选按钮（${result.modeCount} 个）`)
      if (result.modeChecked !== 1) failures.push(`更新策略选中样式数量不是 1（${result.modeChecked} 个）`)
      if (result.modeInputChecked !== 1) failures.push(`更新策略 checked 数量不是 1（${result.modeInputChecked} 个）`)
      const tops = [result.before, result.during, result.afterSuccess, result.afterFail]
      if (Math.max(...tops) - Math.min(...tops) > 1) {
        failures.push(`提示出现后列表面板被推挤（top: ${tops.join(' / ')}）`)
      }
      return failures
    },
  },
  {
    name: '响应式丢失模式切换',
    route: '/cases/vue3/reactive-loss',
    facts: async ({ evaluate }) =>
      evaluate(`(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
        const card = document.querySelector('.loss-card')
        const metric = () =>
          [...card.querySelectorAll('.loss-metric b')].map((item) => item.textContent.trim())
        const button = (text) =>
          [...card.querySelectorAll('button')].find((item) => item.textContent.includes(text))

        // 默认「丢失写法」：连点两次源数据，界面应停在 0，真实值到 2
        button('源数据 +1').click()
        button('源数据 +1').click()
        await wait(80)
        const [wrongShown, wrongTruth] = metric()

        // 切到「toRef 修法」：界面要立刻补上真实值，再点一次两边一起涨
        const radios = [...card.querySelectorAll('.n-radio-button')]
        radios.find((item) => item.textContent.includes('toRef 修法')).click()
        await wait(80)
        const [afterSwitchShown, afterSwitchTruth] = metric()
        button('源数据 +1').click()
        await wait(80)
        const [rightShown, rightTruth] = metric()

        // 重置：回到 0/0，模式回落到「丢失写法」
        button('重置').click()
        await wait(80)
        const [resetShown, resetTruth] = metric()
        const checkedLabel = radios
          .filter((item) => item.classList.contains('n-radio-button--checked'))
          .map((item) => item.textContent.trim())
          .join(' / ')

        return {
          wrongShown,
          wrongTruth,
          afterSwitchShown,
          afterSwitchTruth,
          rightShown,
          rightTruth,
          resetShown,
          resetTruth,
          radioCount: radios.length,
          checkedCount: radios.filter((item) => item.classList.contains('n-radio-button--checked')).length,
          checkedLabel,
        }
      })()`),
    assert: (result) => {
      const failures = []
      if (result.radioCount !== 2) failures.push(`模式组不是 2 个单选按钮（${result.radioCount} 个）`)
      if (result.checkedCount !== 1) failures.push(`单选组选中数量不是 1（${result.checkedCount} 个）`)
      if (result.wrongShown !== '0' || result.wrongTruth !== '2') {
        failures.push(`丢失写法没有「界面停住、真实值上涨」（${result.wrongShown} / ${result.wrongTruth}）`)
      }
      if (result.afterSwitchShown !== '2' || result.afterSwitchTruth !== '2') {
        failures.push(`切到 toRef 后界面没有补上真实值（${result.afterSwitchShown} / ${result.afterSwitchTruth}）`)
      }
      if (result.rightShown !== '3' || result.rightTruth !== '3') {
        failures.push(`toRef 写法下界面没有跟着涨（${result.rightShown} / ${result.rightTruth}）`)
      }
      if (result.resetShown !== '0' || result.resetTruth !== '0') {
        failures.push(`重置后数值没有归零（${result.resetShown} / ${result.resetTruth}）`)
      }
      if (!result.checkedLabel.includes('丢失写法')) {
        failures.push(`重置后模式没有回落到「丢失写法」（当前：${result.checkedLabel}）`)
      }
      return failures
    },
  },
  {
    name: '请求模式切换与竞态',
    route: '/cases/practice/request-race',
    facts: async ({ evaluate }) =>
      evaluate(`(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
        const root = document.querySelector('.rr-demo')
        const radios = () => [...root.querySelectorAll('.n-radio-button')]
        // 注意：「不取消旧请求」也包含「取消旧请求」子串，必须按完整文案匹配
        const radio = (text) => radios().find((item) => item.textContent.trim() === text)
        const action = (text) => [...root.querySelectorAll('.n-button')].find((item) => item.textContent.trim().includes(text))
        const statsText = () => root.querySelector('.stats')?.innerText.replace(/\\s+/g, ' ').trim() ?? ''
        const staleCount = () => Number(statsText().match(/旧响应覆盖\\s*(\\d+)/)?.[1] ?? -1)
        const finalText = () => root.querySelector('.final')?.innerText.trim() ?? ''
        // 等这一轮「模拟快速输入」跑完（按钮文字恢复 + 请求数到位）
        const settle = async () => {
          for (let i = 0; i < 60; i++) {
            const btn = action('模拟快速输入')
            if (btn && staleCount() >= 0 && /请求\\s*3/.test(statsText())) return true
            await wait(120)
          }
          return false
        }

        // 先测「取消旧请求」：旧响应不该覆盖新结果
        radio('取消旧请求（推荐）').click()
        await wait(120)
        action('模拟快速输入').click()
        const abortSettled = await settle()
        const abortStale = staleCount()
        const abortFinal = finalText()
        const abortChecked = radios().filter((item) => item.classList.contains('n-radio-button--checked')).map((item) => item.textContent.trim()).join(' / ')

        // 再测「不取消旧请求」：最后回来的旧请求会把结果冲掉
        radio('不取消旧请求').click()
        await wait(120)
        action('模拟快速输入').click()
        const naiveSettled = await settle()
        const naiveStale = staleCount()
        const naiveFinal = finalText()

        return {
          radioCount: radios().length,
          abortChecked,
          abortSettled,
          abortStale,
          abortFinal,
          naiveSettled,
          naiveStale,
          naiveFinal,
        }      })()`),
    assert: (result) => {
      const failures = []
      if (result.radioCount !== 2) failures.push(`模式组不是 2 个单选按钮（${result.radioCount} 个）`)
      if (!result.abortChecked.includes('取消旧请求（推荐）')) {
        failures.push(`取消模式下选中项不对（${result.abortChecked}）`)
      }
      if (!result.abortChecked.includes('取消旧请求（推荐）') || result.abortChecked.includes('不取消')) {
        failures.push(`单选组选中项重复或错误（${result.abortChecked}）`)
      }
      if (!result.abortSettled) failures.push('「取消旧请求」模式下这一轮没有跑完')
      if (result.abortStale !== 0) failures.push(`取消模式下仍有旧响应覆盖（${result.abortStale} 次）`)
      if (result.abortFinal !== '最终结果 正确') failures.push(`取消模式下最终结果不是「正确」（${result.abortFinal}）`)
      if (!result.naiveSettled) failures.push('「不取消旧请求」模式下这一轮没有跑完')
      if (result.naiveStale < 1) failures.push(`不取消模式下没有出现旧响应覆盖（${result.naiveStale} 次）`)
      if (result.naiveFinal !== '最终结果 串台') failures.push(`不取消模式下最终结果不是「串台」（${result.naiveFinal}）`)
      return failures
    },
  },
  {
    name: '请求输入框实时触发搜索',
    route: '/cases/practice/request-race',
    /** 输入框迁 Naive 后：往内层 input 派发 input 事件，仍要能触发请求并正确收尾 */
    facts: async ({ evaluate }) =>
      evaluate(`(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
        const text = (selector) =>
          document.querySelector(selector)?.innerText?.replace(/\\s+/g, ' ').trim() ?? ''
        const input = document.querySelector('.rr-demo .input input')
        if (!input) return { hasInput: false }

        input.focus()
        input.value = 'vue'
        input.dispatchEvent(new Event('input', { bubbles: true }))
        await wait(600)
        const typedStat = text('.rr-demo .stats')
        const typedSource = text('.rr-demo section[aria-label="搜索结果"] .panel-head b')
        const typedFinal = text('.rr-demo .final')
        const typedItems = document.querySelectorAll('.rr-demo .result li').length

        // 清空输入：应当取消在途请求并把结果清掉
        input.value = ''
        input.dispatchEvent(new Event('input', { bubbles: true }))
        await wait(400)
        return {
          hasInput: true,
          typedStat,
          typedSource,
          typedFinal,
          typedItems,
          clearedSource: text('.rr-demo section[aria-label="搜索结果"] .panel-head b'),
          clearedItems: document.querySelectorAll('.rr-demo .result li').length,
          clearedFinal: text('.rr-demo .final'),
        }
      })()`),
    assert: (result) => {
      const failures = []
      if (!result.hasInput) {
        failures.push('没找到 Naive 输入框的内层 input（迁移后 DOM 结构变了？）')
        return failures
      }
      if (!/请求\s*1/.test(result.typedStat)) {
        failures.push(`输入后没有发起请求（${result.typedStat}）`)
      }
      if (!(result.typedItems > 0)) {
        failures.push(`输入后没有渲染出搜索结果（${result.typedItems} 条）`)
      }
      if (!result.typedSource.includes('vue')) {
        failures.push(`结果没有来自「vue」（${result.typedSource || '空'}）`)
      }
      if (!result.typedFinal.includes('正确')) {
        failures.push(`输入后的最终结果不正确（${result.typedFinal}）`)
      }
      if (result.clearedSource || result.clearedItems !== 0) {
        failures.push(
          `清空输入后结果没有清掉（${result.clearedSource || '无标题'} / ${result.clearedItems} 条）`,
        )
      }
      if (!result.clearedFinal.includes('—')) {
        failures.push(`清空输入后最终结果标记没有复位（${result.clearedFinal}）`)
      }
      return failures
    },
  },
  {
    name: '表格行内编辑聚焦与提交',
    route: '/cases/vue3/editable-table',
    /** 行内输入框迁 Naive 后：v-focus 要落到内层 input，Enter 仍能提交 */
    facts: async ({ evaluate }) =>
      evaluate(`(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
        const text = (selector) => document.querySelector(selector)?.innerText?.trim() ?? ''
        const cell = document.querySelectorAll('.et-table tbody tr')[0]?.querySelectorAll('td')[0]
        cell?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
        await wait(200)

        const wrapper = cell?.querySelector('.et-input')
        const input = wrapper?.querySelector('input')
        const focused = Boolean(input) && document.activeElement === input

        if (input) {
          input.value = '机械键盘 Pro'
          input.dispatchEvent(new Event('input', { bubbles: true }))
          await wait(80)
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
        }
        await wait(200)
        return {
          editing: Boolean(wrapper),
          focused,
          cellText: cell?.innerText?.trim() ?? '',
          stat: text('.et-stat'),
          stillEditing: Boolean(cell?.querySelector('.et-input')),
        }
      })()`),
    assert: (result) => {
      const failures = []
      if (!result.editing) failures.push('双击后没有出现编辑框')
      if (!result.focused) failures.push('编辑框没有自动聚焦（v-focus 没落到内层 input）')
      if (!result.cellText.includes('机械键盘 Pro')) {
        failures.push(`Enter 没有提交新值（${result.cellText}）`)
      }
      if (!/保存\s*1/.test(result.stat)) failures.push(`保存计数没有增加（${result.stat}）`)
      if (result.stillEditing) failures.push('提交后编辑框没有退出')
      return failures
    },
  },
  {
    name: '命令面板打开即聚焦',
    route: '/cases/practice/command-palette',
    /** 搜索框迁 Naive 后，openPanel 里的 focus() 要落到内层 input 上 */
    facts: async ({ evaluate }) =>
      evaluate(`(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
        document.querySelector('.cp-demo .open-btn')?.click()
        await wait(250)
        const input = document.querySelector('.cp-demo .search-input input')
        const focused = Boolean(input) && document.activeElement === input
        const before = document.querySelectorAll('.cp-demo .result-list li').length

        if (input) {
          input.value = '复制'
          input.dispatchEvent(new Event('input', { bubbles: true }))
          await wait(200)
        }
        const firstResult = document.querySelector('.cp-demo .result-list li')?.innerText?.trim() ?? ''
        return {
          hasInput: Boolean(input),
          focused,
          before,
          after: document.querySelectorAll('.cp-demo .result-list li').length,
          firstResult,
          emptyState: firstResult.includes('没有匹配'),
        }
      })()`),
    assert: (result) => {
      const failures = []
      if (!result.hasInput) {
        failures.push('打开面板后找不到 Naive 搜索框的内层 input')
        return failures
      }
      if (!result.focused) failures.push('打开面板后搜索框没有自动聚焦（focus() 没落到内层 input）')
      if (!(result.before > 0)) failures.push('打开面板后没有列出命令')
      if (result.emptyState) failures.push('输入关键词后匹配成了空结果，过滤链路没走通')
      if (!(result.after > 0 && result.after < result.before)) {
        failures.push(`输入关键词后结果没有被过滤（${result.before} → ${result.after}）`)
      }
      return failures
    },
  },
  {
    name: '分包模式切换',
    route: '/cases/practice/dynamic-chunk',
    facts: async ({ evaluate }) =>
      evaluate(`(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
        const root = document.querySelector('.dc-demo')
        const radios = () => [...root.querySelectorAll('.n-radio-button')]
        const radio = (text) => radios().find((item) => item.textContent.includes(text))
        const hint = () => root.querySelector('.mode-hint')?.innerText.replace(/\\s+/g, ' ').trim() ?? ''
        const checked = () =>
          radios().filter((item) => item.classList.contains('n-radio-button--checked')).map((item) => item.textContent.trim())

        const lazyHint = hint()
        radio('全量预载').click()
        await wait(120)
        const fullHint = hint()
        const fullChecked = checked()
        radio('按需加载').click()
        await wait(120)
        const backHint = hint()
        const backChecked = checked()

        return {
          radioCount: radios().length,
          lazyHint,
          fullHint,
          fullChecked: fullChecked.join(' / '),
          backHint,
          backChecked: backChecked.join(' / '),
        }
      })()`),
    assert: (result) => {
      const failures = []
      if (result.radioCount !== 2) failures.push(`模式组不是 2 个单选按钮（${result.radioCount} 个）`)
      if (!result.lazyHint.includes('点哪个模块才下载哪个')) {
        failures.push(`默认提示不是按需加载（${result.lazyHint}）`)
      }
      if (!result.fullHint.includes('一起下载')) failures.push(`切到全量后提示没有跟着变（${result.fullHint}）`)
      if (!result.fullChecked.includes('全量预载')) failures.push(`切到全量后选中项不对（${result.fullChecked}）`)
      if (!result.backHint.includes('点哪个模块才下载哪个')) {
        failures.push(`切回按需后提示没有还原（${result.backHint}）`)
      }
      if (!result.backChecked.includes('按需加载')) failures.push(`切回按需后选中项不对（${result.backChecked}）`)
      return failures
    },
  },
  {
    name: '分包优化项勾选',
    route: '/cases/practice/vite-split',
    /** 优化项换成 n-checkbox 后：点整张卡片仍要能切换，并让首屏估算跟着变 */
    facts: async ({ evaluate }) =>
      evaluate(`(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
        const cards = () => [...document.querySelectorAll('.vs-demo .vs-options .vs-opt')]
        const firstScreen = () => {
          const rows = [...document.querySelectorAll('.vs-demo .vs-num')]
          return rows[1]?.innerText?.trim() ?? ''
        }
        const onCount = () => cards().filter((el) => el.classList.contains('on')).length
        // 挑一张当前没勾的卡片并记住它，来回点同一张，避免第二次点到别的卡
        const target = cards().find((el) => !el.classList.contains('on'))
        const beforeScreen = firstScreen()
        const beforeOn = onCount()
        target?.click()
        await wait(120)
        const pickedScreen = firstScreen()
        const pickedOn = onCount()
        target?.click()
        await wait(120)
        return {
          optionCount: cards().length,
          beforeScreen,
          beforeOn,
          pickedScreen,
          pickedOn,
          backScreen: firstScreen(),
          backOn: onCount(),
        }
      })()`),
    assert: (result) => {
      const failures = []
      if (result.optionCount < 3) {
        failures.push(`优化项卡片数量不对（${result.optionCount} 个）`)
      }
      if (result.pickedOn !== result.beforeOn + 1) {
        failures.push(`点卡片没有勾上（${result.beforeOn} → ${result.pickedOn}）`)
      }
      if (result.pickedScreen === result.beforeScreen) {
        failures.push(`勾上优化项后首屏估算没变（${result.pickedScreen}）`)
      }
      if (result.backOn !== result.beforeOn || result.backScreen !== result.beforeScreen) {
        failures.push(
          `再点一次没有还原（勾选 ${result.backOn} / 估算 ${result.backScreen}）`,
        )
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
    name: 'Naive UI 案例样式',
    route: '/cases/practice/debounce-throttle',
    facts: async ({ evaluate }) => {
      // 首次访问 dev 服务器要现编译 Naive 组件，3.2s 可能不够，这里最多再等 6s
      for (let i = 0; i < 20; i++) {
        if (await evaluate(`Boolean(document.querySelector('.demo-card .n-input'))`)) break
        await sleep(300)
      }

      return {
        nfInput: await evaluate(`Boolean(document.querySelector('.demo-card .n-input'))`),
        /** 样式是否真的生效：n-input 的圆角来自组件主题（6px），原生默认是 0 */
        nfStyled: await evaluate(`(() => {
          const input = document.querySelector('.demo-card .n-input')
          if (!input) return null
          const style = getComputedStyle(input)
          return style.borderRadius !== '0px' && style.fontFamily.includes('system-ui')
        })()`),
        /** Naive 样式随 JS 走，不应再出现 element-plus 的独立 CSS 文件（两者都没有时为 true） */
        noEpCss: IS_PREVIEW
          ? await evaluate(`![...document.styleSheets].some(s => (s.href ?? '').includes('element-plus'))`)
          : null,
      }
    },
    assert: (result) => {
      const failures = []
      if (!result.nfInput) failures.push('Naive 输入框没有渲染')
      if (result.nfStyled === false) failures.push('Naive 输入框没有套上组件样式')
      if (result.noEpCss === false) failures.push('还残留着 element-plus 的独立 CSS 文件')
      return failures
    },
  },
  {
    name: '防抖波形先铺满再滚动',
    route: '/cases/practice/debounce-throttle',
    facts: async ({ evaluate }) => {
      // 等演示挂载（dev 首次编译要时间）
      for (let i = 0; i < 20; i++) {
        if (await evaluate(`Boolean(document.querySelector('.dt-demo .wave'))`)) break
        await sleep(300)
      }

      /** 连续输入「容器容量 + 3」次：柱子数应停在容量上，且最右一根贴着右内边距 */
      return evaluate(`(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
        const wave = document.querySelector('.dt-demo .wave')
        const input = document.querySelector('.dt-demo .n-input__input-el')
        if (!wave || !input) return { error: 'no-demo' }

        // 与 Demo 里 measureWave 的口径一致：内容宽 / (柱宽 6 + 间距 3)，最后一根后面没有间距
        const cs = getComputedStyle(wave)
        const inner = wave.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
        const capacity = Math.max(8, Math.floor((inner + 3) / 9))
        const times = capacity + 3
        for (let i = 0; i < times; i++) {
          input.value = 'x'.repeat(i + 1)
          input.dispatchEvent(new Event('input', { bubbles: true }))
          await wait(8)
        }
        // 等 Vue 渲染完最后一根，但别等到 500ms（否则防抖会再追加一条执行柱）
        await wait(120)

        const bars = [...wave.querySelectorAll('.pulse')]
        const waveRect = wave.getBoundingClientRect()
        const last = bars.length ? bars[bars.length - 1].getBoundingClientRect() : null
        return {
          typed: times,
          capacity,
          count: bars.length,
          rightGap: last ? Math.round(waveRect.right - last.right) : -1,
          overflow: wave.scrollWidth - wave.clientWidth,
        }
      })()`)
    },
    assert: (result) => {
      const failures = []
      if (result.error) failures.push(`演示没挂载（${result.error}）`)
      if (result.count === 0) failures.push('输入后没有画出脉冲柱子')
      // 输入次数超过容量，柱子数应正好等于容量（写死 36 根这类回归会在这里露头）
      if (result.count !== result.capacity) {
        failures.push(`柱子数 ${result.count} ≠ 容器容量 ${result.capacity}（波形应先铺满再丢旧柱子）`)
      }
      // 右内边距 9.6px + 边框 1px + 不足一整格的余量（<9px），超过 19px 就是有明显空白
      if (result.rightGap > 19) {
        failures.push(`最右一根离容器右边 ${result.rightGap}px，波形没铺满`)
      }
      if (result.overflow > 1) failures.push(`波形横向溢出 ${result.overflow}px`)
      return failures
    },
  },
  {
    name: '流体字号随容器宽度变化',
    route: '/cases/css/fluid-clamp',
    facts: async ({ evaluate, send }) => {
      // 桌面视口 + 把演示区滚进视野：指针事件按屏幕坐标派发，元素在视口外就点不到
      await send('Emulation.setDeviceMetricsOverride', {
        width: 1280,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      })
      await evaluate(
        `document.querySelector('.demo-card')?.scrollIntoView({ block: 'center' })`,
      )
      await sleep(400)

      /**
       * 一次采样：容器（宿主框）宽度与右边缘、把手左边缘、标题实测字号
       * 三个数足够区分两类回归：把手没跟着框走 / 字号其实按视口算
       */
      const read = () => evaluate(`(() => {
        const box = document.querySelector('.demo-card .frame')
          ?? document.querySelector('.demo-card .preview')
        const handle = document.querySelector('.demo-card .resize-bar')
        const hero = document.querySelector('.demo-card .hero')
        if (!box || !handle || !hero) return null
        const boxRect = box.getBoundingClientRect()
        const handleRect = handle.getBoundingClientRect()
        return {
          width: Math.round(boxRect.width),
          boxRight: Math.round(boxRect.right),
          handleLeft: Math.round(handleRect.left),
          font: Number(parseFloat(getComputedStyle(hero).fontSize).toFixed(1)),
          containerType: getComputedStyle(box).containerType,
        }
      })()`)

      /**
       * 真实指针拖动：Demo 靠 pointerdown/move 的 buttons === 1 与指针捕获，
       * 页面内合成事件拿不到 pointer capture，必须走 CDP 的鼠标输入
       */
      async function dragTo(targetWidth) {
        const before = await read()
        const point = await evaluate(`(() => {
          const r = document.querySelector('.demo-card .resize-bar').getBoundingClientRect()
          return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
        })()`)
        const delta = targetWidth - before.width

        await send('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          x: point.x,
          y: point.y,
          button: 'left',
          buttons: 1,
          clickCount: 1,
        })

        // 分成几步移动，贴近真实拖动（一次跳到终点只有一条 pointermove）
        for (let step = 1; step <= 6; step++) {
          await send('Input.dispatchMouseEvent', {
            type: 'mouseMoved',
            x: point.x + Math.round((delta * step) / 6),
            y: point.y,
            button: 'left',
            buttons: 1,
          })
          await sleep(30)
        }

        await send('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          x: point.x + delta,
          y: point.y,
          button: 'left',
          buttons: 0,
          clickCount: 1,
        })

        // 等 ResizeObserver 回调把宽度与字号写回面板
        await sleep(250)
        return read()
      }

      const initial = await read()
      if (!initial) return { error: 'no-demo' }

      // 300px：8cqi ≈ 24px；500px：正好顶到 40px 上限
      const narrow = await dragTo(300)
      const wide = await dragTo(500)

      // 键盘也要能调宽：role=separator 可聚焦，方向键每次 16px
      await evaluate(`document.querySelector('.demo-card .resize-bar').focus()`)
      for (let i = 0; i < 2; i++) {
        await send('Input.dispatchKeyEvent', {
          type: 'keyDown',
          key: 'ArrowRight',
          code: 'ArrowRight',
          windowsVirtualKeyCode: 39,
        })
        await send('Input.dispatchKeyEvent', {
          type: 'keyUp',
          key: 'ArrowRight',
          code: 'ArrowRight',
          windowsVirtualKeyCode: 39,
        })
        await sleep(60)
      }
      await sleep(250)
      const afterKey = await read()

      // 断点式（旧做法）：行内字号写在宿主框上，必须能被子元素继承
      await evaluate(
        `[...document.querySelectorAll('.demo-card .n-radio-button')]
          .find((el) => el.textContent.includes('断点式'))?.click()`,
      )
      await sleep(300)
      const breakpointMode = await read()

      // 切回 clamp：同一宽度下字号应回到 8cqi 曲线
      await evaluate(
        `[...document.querySelectorAll('.demo-card .n-radio-button')]
          .find((el) => el.textContent.includes('clamp'))?.click()`,
      )
      await sleep(300)
      const clampMode = await read()

      /** 把手左边缘与框右边缘的距离（理想 0：把手贴着自己的框） */
      const gapOf = (state) => Math.abs(state.handleLeft - state.boxRight)

      // 摊平成基本类型：失败时报数看得见（对象会打成 [object Object]）
      return {
        containerType: initial.containerType,
        initialWidth: initial.width,
        initialFont: initial.font,
        initialGap: gapOf(initial),
        narrowWidth: narrow.width,
        narrowFont: narrow.font,
        narrowGap: gapOf(narrow),
        wideWidth: wide.width,
        wideFont: wide.font,
        wideGap: gapOf(wide),
        keyWidth: afterKey.width,
        breakpointFont: breakpointMode.font,
        clampFontAtKeyWidth: clampMode.font,
      }
    },
    assert: (result) => {
      if (result.error) return [`演示没挂载（${result.error}）`]

      const failures = []
      if (result.containerType === 'normal') {
        failures.push('宿主框没有声明 container-type: inline-size，8cqi 会退回按视口算')
      }

      // 1) 把手是「这条框」的把手：必须贴着自己的右边缘，不能钉在舞台最右边
      const gaps = [
        ['初始', result.initialGap],
        ['拖到 300px', result.narrowGap],
        ['拖到 500px', result.wideGap],
      ]
      for (const [label, gap] of gaps) {
        if (gap > 2) failures.push(`${label}时把手离框右边缘 ${gap}px（没跟着容器走）`)
      }

      // 2) 字号必须由容器宽度驱动（8cqi），不能退化成按视口算而恒定顶格
      if (!(result.narrowWidth <= 320)) {
        failures.push(`拖动没生效：目标 300px，实测 ${result.narrowWidth}px`)
      }
      if (!(result.narrowFont >= 22 && result.narrowFont <= 26)) {
        failures.push(`容器 ${result.narrowWidth}px 时标题 ${result.narrowFont}px，应在 24px 附近`)
      }
      if (result.wideFont < 39) {
        failures.push(`容器 ${result.wideWidth}px 时标题 ${result.wideFont}px，应顶到上限 40px`)
      }
      if (result.wideFont - result.narrowFont < 8) {
        failures.push(
          `字号没随容器变化（${result.narrowWidth}px → ${result.narrowFont}px，${result.wideWidth}px → ${result.wideFont}px）`,
        )
      }
      // 3) 把手可聚焦，方向键每次 ±16px（两次右移应至少 +24）
      if (result.keyWidth - result.wideWidth < 24) {
        failures.push(`方向键没调宽（${result.wideWidth}px → ${result.keyWidth}px）`)
      }
      // 4) 断点式仍然生效：532px 落在 480~620 档，应为 28px；切回 clamp 回到 8cqi 曲线
      if (Math.abs(result.breakpointFont - 28) > 1) {
        failures.push(`断点式在 ${result.keyWidth}px 时字号 ${result.breakpointFont}px，应为 28px`)
      }
      if (!(result.clampFontAtKeyWidth >= 38)) {
        failures.push(
          `切回 clamp 后字号 ${result.clampFontAtKeyWidth}px，应回到 8cqi 曲线（顶到 40px）`,
        )
      }
      return failures
    },
  },
  {
    name: '拖宽把手跟随容器（grid-auto-fit）',
    route: '/cases/css/grid-auto-fit',
    facts: async ({ evaluate, send }) => {
      // 桌面视口 + 滚进视野：指针事件按屏幕坐标派发，元素在视口外就点不到
      await send('Emulation.setDeviceMetricsOverride', {
        width: 1280,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      })
      await evaluate(`document.querySelector('.demo-card')?.scrollIntoView({ block: 'center' })`)
      await sleep(400)

      /** 采样：框宽与右缘、把手左缘、真实网格列数 */
      const read = () => evaluate(`(() => {
        const box = document.querySelector('.demo-card .panel')
        const bar = document.querySelector('.demo-card .resize-bar')
        if (!box || !bar) return null
        const boxRect = box.getBoundingClientRect()
        const barRect = bar.getBoundingClientRect()
        const tracks = getComputedStyle(box).gridTemplateColumns.trim()
        return {
          width: Math.round(boxRect.width),
          boxRight: Math.round(boxRect.right),
          barLeft: Math.round(barRect.left),
          cols: tracks ? tracks.split(/\\s+/).length : 0,
        }
      })()`)

      /** 真实指针拖动：Demo 靠 buttons === 1 与指针捕获判断 */
      async function dragTo(targetWidth) {
        const before = await read()
        const point = await evaluate(`(() => {
          const r = document.querySelector('.demo-card .resize-bar').getBoundingClientRect()
          return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
        })()`)
        const delta = targetWidth - before.width

        await send('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          x: point.x,
          y: point.y,
          button: 'left',
          buttons: 1,
          clickCount: 1,
        })
        for (let step = 1; step <= 6; step++) {
          await send('Input.dispatchMouseEvent', {
            type: 'mouseMoved',
            x: point.x + Math.round((delta * step) / 6),
            y: point.y,
            button: 'left',
            buttons: 1,
          })
          await sleep(30)
        }
        await send('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          x: point.x + delta,
          y: point.y,
          button: 'left',
          buttons: 0,
          clickCount: 1,
        })

        // 等 ResizeObserver 回调把宽度与列数写回面板
        await sleep(280)
        return read()
      }

      const initial = await read()
      if (!initial) return { error: 'no-demo' }

      // 300px 只有 1 列；700px 至少 4 列（auto-fit 的最小列宽 160px）
      const narrow = await dragTo(300)
      const wide = await dragTo(700)

      // 键盘：把手可聚焦，← 每次 16px
      await evaluate(`document.querySelector('.demo-card .resize-bar').focus()`)
      for (let i = 0; i < 2; i++) {
        await send('Input.dispatchKeyEvent', {
          type: 'keyDown',
          key: 'ArrowLeft',
          code: 'ArrowLeft',
          windowsVirtualKeyCode: 37,
        })
        await send('Input.dispatchKeyEvent', {
          type: 'keyUp',
          key: 'ArrowLeft',
          code: 'ArrowLeft',
          windowsVirtualKeyCode: 37,
        })
        await sleep(60)
      }
      await sleep(280)
      const afterKey = await read()

      const gapOf = (state) => Math.abs(state.barLeft - state.boxRight)

      return {
        initialWidth: initial.width,
        initialCols: initial.cols,
        initialGap: gapOf(initial),
        narrowWidth: narrow.width,
        narrowCols: narrow.cols,
        narrowGap: gapOf(narrow),
        wideWidth: wide.width,
        wideCols: wide.cols,
        wideGap: gapOf(wide),
        keyWidth: afterKey.width,
      }
    },
    assert: (result) => {
      if (result.error) return [`演示没挂载（${result.error}）`]

      const failures = []
      // 1) 把手是「这条框」的把手：任何宽度下都得贴着自己的右边缘
      for (const [label, gap] of [
        ['初始', result.initialGap],
        ['拖到 300px', result.narrowGap],
        ['拖到 700px', result.wideGap],
      ]) {
        if (gap > 2) failures.push(`${label}时把手离框右边缘 ${gap}px（没跟着容器走）`)
      }
      // 2) 拖动要精确落到目标宽度（上限含内边距时会有 14px 死区）
      if (Math.abs(result.narrowWidth - 300) > 4) {
        failures.push(`拖到 300px 实测 ${result.narrowWidth}px`)
      }
      if (Math.abs(result.wideWidth - 700) > 4) {
        failures.push(`拖到 700px 实测 ${result.wideWidth}px`)
      }
      // 3) 列数必须随宽度变化：300px 1~2 列，700px 4 列以上
      if (!(result.narrowCols < result.wideCols)) {
        failures.push(
          `列数没随宽度变化（300px → ${result.narrowCols} 列，700px → ${result.wideCols} 列）`,
        )
      }
      if (result.wideCols < 4) failures.push(`700px 只有 ${result.wideCols} 列，auto-fit 应能排 4 列`)
      // 4) 键盘 ← 每次 16px：两次应至少窄 24px
      if (result.wideWidth - result.keyWidth < 24) {
        failures.push(`方向键没调宽（${result.wideWidth}px → ${result.keyWidth}px）`)
      }
      return failures
    },
  },
  {
    name: '分栏把手拖动改两列占比',
    route: '/cases/css/container-query',
    facts: async ({ evaluate, send }) => {
      await send('Emulation.setDeviceMetricsOverride', {
        width: 1280,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      })
      await evaluate(`document.querySelector('.demo-card')?.scrollIntoView({ block: 'center' })`)
      await sleep(400)

      /** 采样：两列宽度、把手位置与 aria-valuenow（百分比） */
      const read = () => evaluate(`(() => {
        const cols = [...document.querySelectorAll('.demo-card .duo-col')]
        const bar = document.querySelector('.demo-card .resize-bar--split')
        if (cols.length < 2 || !bar) return null
        const a = cols[0].getBoundingClientRect()
        const b = cols[1].getBoundingClientRect()
        const barRect = bar.getBoundingClientRect()
        return {
          aWidth: Math.round(a.width),
          bWidth: Math.round(b.width),
          aRight: Math.round(a.right),
          bLeft: Math.round(b.left),
          barLeft: Math.round(barRect.left),
          barWidth: Math.round(barRect.width),
          ratio: Number(bar.getAttribute('aria-valuenow')),
        }
      })()`)

      /** 横向拖动把手 dx 像素 */
      async function dragBy(dx) {
        const point = await evaluate(`(() => {
          const r = document.querySelector('.demo-card .resize-bar--split').getBoundingClientRect()
          return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
        })()`)

        await send('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          x: point.x,
          y: point.y,
          button: 'left',
          buttons: 1,
          clickCount: 1,
        })
        for (let step = 1; step <= 6; step++) {
          await send('Input.dispatchMouseEvent', {
            type: 'mouseMoved',
            x: point.x + Math.round((dx * step) / 6),
            y: point.y,
            button: 'left',
            buttons: 1,
          })
          await sleep(30)
        }
        await send('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          x: point.x + dx,
          y: point.y,
          button: 'left',
          buttons: 0,
          clickCount: 1,
        })

        // 等容器查询重算 + 面板回填
        await sleep(400)
        return read()
      }

      const initial = await read()
      if (!initial) return { error: 'no-demo' }

      const right = await dragBy(120)
      // 一路拖到左极限：验证 22% 下限真的夹住了
      const left = await dragBy(-900)

      // 键盘：焦点在把手上，→ 每次 2%
      await evaluate(`document.querySelector('.demo-card .resize-bar--split').focus()`)
      await send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: 'ArrowRight',
        code: 'ArrowRight',
        windowsVirtualKeyCode: 39,
      })
      await send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: 'ArrowRight',
        code: 'ArrowRight',
        windowsVirtualKeyCode: 39,
      })
      await sleep(400)
      const afterKey = await read()

      return {
        initialRatio: initial.ratio,
        initialAWidth: initial.aWidth,
        initialAbarGap: initial.barLeft - initial.aRight,
        rightRatio: right.ratio,
        rightAWidth: right.aWidth,
        rightBarShift: right.barLeft - initial.barLeft,
        leftRatio: left.ratio,
        leftAWidth: left.aWidth,
        keyRatio: afterKey.ratio,
        // 把手必须始终夹在两列之间
        betweenOk:
          initial.barLeft >= initial.aRight - 1 &&
          initial.barLeft + initial.barWidth <= initial.bLeft + 1,
      }
    },
    assert: (result) => {
      if (result.error) return [`演示没挂载（${result.error}）`]

      const failures = []
      if (!result.betweenOk) failures.push('把手没夹在两列之间（布局被撑坏）')
      // 1) 拖 +120px：把手跟着走，左列变宽，占比跟着涨
      if (Math.abs(result.rightBarShift - 120) > 8) {
        failures.push(`拖 120px 后把手只移动了 ${result.rightBarShift}px`)
      }
      if (!(result.rightAWidth - result.initialAWidth >= 100)) {
        failures.push(
          `左列没跟着变宽（${result.initialAWidth}px → ${result.rightAWidth}px）`,
        )
      }
      if (!(result.rightRatio > result.initialRatio + 6)) {
        failures.push(`aria-valuenow 没跟着涨（${result.initialRatio} → ${result.rightRatio}）`)
      }
      // 2) 拖到左极限：占比夹在 22%，左列明显变窄
      if (Math.abs(result.leftRatio - 22) > 1) {
        failures.push(`拖到左极限占比 ${result.leftRatio}%，应该夹在 22%`)
      }
      if (!(result.leftAWidth < result.initialAWidth)) {
        failures.push(`拖到左极限左列没变窄（${result.leftAWidth}px）`)
      }
      // 3) 键盘 → 每次 2%
      if (result.keyRatio - result.leftRatio !== 2) {
        failures.push(`方向键没按 2% 调整（${result.leftRatio}% → ${result.keyRatio}%）`)
      }
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
    /**
     * 下拉刷新：判定必须跟着面板上显示的那个数走
     * 回归点：显示用 Math.round、判定用未取整的 pull 时，会出现「写着 64 / 64 却还是『下拉刷新』」
     * 位移用真实鼠标事件：Demo 靠 pointerdown + 指针捕获判断，页面内合成事件拿不到指针捕获
     */
    name: '下拉刷新按显示值触发',
    route: '/cases/performance/pull-refresh',
    facts: async ({ evaluate, send }) => {
      await send('Emulation.setDeviceMetricsOverride', {
        width: 1280,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      })
      await evaluate(`document.querySelector('.demo-card')?.scrollIntoView({ block: 'center' })`)
      await sleep(400)

      /** 读面板：条数、下拉距离（显示值）、提示文案、状态 */
      const read = () => evaluate(`(() => {
        const stats = [...document.querySelectorAll('.demo-card .pr-stat')]
        return {
          count: Number(stats[0]?.querySelector('b')?.textContent?.trim() ?? 0),
          pull: Number.parseFloat(stats[1]?.querySelector('b')?.textContent?.trim() ?? '0'),
          label: document.querySelector('.demo-card .pr-indicator span')?.textContent?.trim() ?? '',
          state: document.querySelector('.demo-card .pr-state')?.textContent?.trim() ?? '',
        }
      })()`)

      /** 从内容区按住往下拖 dy 像素，返回松开前 / 松开后的读数 */
      async function dragDown(dy) {
        // 上一轮拖动可能选中了文字，第二轮的 mousemove 会被浏览器当成「拖拽选区」吞掉
        await evaluate(`window.getSelection()?.removeAllRanges()`)
        const point = await evaluate(`(() => {
          const content = document.querySelector('.demo-card .pr-content')
          const scroller = document.querySelector('.demo-card .pr-scroller')
          if (scroller) scroller.scrollTop = 0
          const r = content.getBoundingClientRect()
          return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + 24) }
        })()`)
        await send('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          x: point.x,
          y: point.y,
          button: 'left',
          buttons: 1,
          clickCount: 1,
        })
        // 分几步移动：一步到位时中间态会被合并，读不到拖动过程中的显示值
        for (let step = 1; step <= 6; step++) {
          await send('Input.dispatchMouseEvent', {
            type: 'mouseMoved',
            x: point.x,
            y: point.y + Math.round((dy * step) / 6),
            button: 'left',
            buttons: 1,
          })
          await sleep(25)
        }
        await sleep(80)
        const before = await read()
        await send('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          x: point.x,
          y: point.y + dy,
          button: 'left',
          buttons: 0,
          clickCount: 1,
        })
        await sleep(150)
        return { before, after: await read() }
      }

      const initial = await read()
      // 阻尼 0.45：142px × 0.45 = 63.9（显示 63.9，未到阈值）；143px × 0.45 = 64.35（显示 64.4，已到阈值）
      const below = await dragDown(142)
      await sleep(300)
      const belowSettled = await read()
      const above = await dragDown(143)
      await sleep(1100) // 模拟刷新 900ms
      const aboveSettled = await read()

      return {
        initialCount: initial.count,
        belowPull: below.before.pull,
        belowLabel: below.before.label,
        belowState: below.after.state,
        belowCount: belowSettled.count,
        abovePull: above.before.pull,
        aboveLabel: above.before.label,
        aboveState: above.after.state,
        aboveSettledState: aboveSettled.state,
      }
    },
    assert: (r) => {
      const failures = []
      if (!(r.belowPull > 0 && r.belowPull < 64)) {
        failures.push(`下拉 142px 的显示值应在 0~64 之间（实际 ${r.belowPull}）`)
      }
      if (r.belowLabel === '松手刷新') failures.push('显示值没到 64 却提示「松手刷新」')
      if (r.belowState === '刷新中…') failures.push('未到阈值松手却触发了刷新')
      if (r.belowCount !== r.initialCount) failures.push('未到阈值松手却把列表换掉了')
      if (!(r.abovePull >= 64)) {
        failures.push(`下拉 143px 的显示值应 ≥ 64（实际 ${r.abovePull}）`)
      }
      if (r.aboveLabel !== '松手刷新') {
        failures.push(`显示 ${r.abovePull}px 时应提示「松手刷新」（实际「${r.aboveLabel}」）`)
      }
      if (r.aboveState !== '刷新中…') failures.push('到了阈值松手却没触发刷新')
      if (r.aboveSettledState !== '就绪') failures.push(`刷新结束后状态没回到「就绪」（实际「${r.aboveSettledState}」）`)
      return failures
    },
  },
  {
    /**
     * 两套曝光口径必须一致
     * 回归点 1：手工测量原先用边框盒（含 1px 边框 + 0.6rem 内边距），观察器用内边距盒
     * 回归点 2：面板显示取整、判定用原始比例 → 49.6% 显示「50% 可见」却没算曝光
     * 做法：把第 5 张卡调到「可见略低于 50%」（面板显示 48%），两种模式各数一次
     */
    name: '两种曝光口径一致',
    route: '/cases/observer/intersection-observer',
    facts: async ({ evaluate }) => {
      await evaluate(`document.querySelector('.demo-card')?.scrollIntoView({ block: 'center' })`)
      await sleep(400)

      /** 读曝光数与每张卡显示的可见百分比 */
      const read = () => evaluate(`(() => {
        const stat = [...document.querySelectorAll('.io-demo .stats span')].find((el) =>
          el.textContent.includes('曝光')
        )
        const pcts = [...document.querySelectorAll('.io-demo .card small')]
          .map((el) => Number.parseInt(el.textContent ?? '', 10))
          .filter((n) => Number.isFinite(n))
        return {
          exposed: Number(stat?.querySelector('b')?.textContent?.trim() ?? -1),
          pcts,
          halfCount: pcts.filter((n) => n >= 50).length,
        }
      })()`)

      /** 按面板自己的判定盒算出「第 5 张卡只露出 65px」的滚动位置，避免写死像素 */
      const target = await evaluate(`(() => {
        const vp = document.querySelector('.io-demo .viewport')
        const card = document.querySelectorAll('.io-demo .card')[4]
        if (!vp || !card) return null
        const vpRect = vp.getBoundingClientRect()
        const clipTop = vpRect.top + vp.clientTop
        const clipBottom = clipTop + vp.clientHeight
        const cardRect = card.getBoundingClientRect()
        const visible = Math.min(cardRect.bottom, clipBottom) - Math.max(cardRect.top, clipTop)
        const need = cardRect.height * 0.5 - 1 - visible
        vp.scrollTop += need
        return { scrollTop: Math.round(vp.scrollTop), height: Math.round(cardRect.height) }
      })()`)
      if (!target) return { error: 'no-demo' }
      await sleep(350)

      /** 切到「滚动 + 位置计算」，停在同一个滚动位置 */
      await evaluate(`[...document.querySelectorAll('.io-demo .modes .n-radio-button')]
        .find((el) => el.textContent.includes('滚动 + 位置计算'))?.click()`)
      await sleep(400)
      // 先归零再回到目标位置：滚动方案只在 scroll 事件里测量，值没变化就不会重算
      await evaluate(`document.querySelector('.io-demo .viewport').scrollTop = 0`)
      await sleep(120)
      await evaluate(`document.querySelector('.io-demo .viewport').scrollTop = ${target.scrollTop}`)
      await sleep(350)
      const scrollMode = await read()

      /** 切回观察器：同一个位置，观察器会先给一轮初始回调 */
      await evaluate(`[...document.querySelectorAll('.io-demo .modes .n-radio-button')]
        .find((el) => el.textContent.includes('交叉观察器'))?.click()`)
      await sleep(500)
      await evaluate(`document.querySelector('.io-demo .viewport').scrollTop = ${target.scrollTop}`)
      await sleep(350)
      const observerMode = await read()

      return {
        scrollTop: target.scrollTop,
        cardHeight: target.height,
        scrollExposed: scrollMode.exposed,
        scrollHalf: scrollMode.halfCount,
        observerExposed: observerMode.exposed,
        observerHalf: observerMode.halfCount,
        pctCount: observerMode.pcts.length,
      }
    },
    assert: (r) => {
      const failures = []
      if (r.pctCount !== 12) failures.push(`卡片可见百分比没读全（${r.pctCount} / 12）`)
      if (r.scrollExposed !== r.scrollHalf) {
        failures.push(`滚动方案曝光 ${r.scrollExposed} 张，但面板显示 ≥50% 的只有 ${r.scrollHalf} 张`)
      }
      if (r.observerExposed !== r.observerHalf) {
        failures.push(`观察器曝光 ${r.observerExposed} 张，但面板显示 ≥50% 的只有 ${r.observerHalf} 张`)
      }
      if (r.scrollExposed !== r.observerExposed) {
        failures.push(
          `同一滚动位置两套方案曝光数不同（滚动 ${r.scrollExposed} / 观察器 ${r.observerExposed}）`,
        )
      }
      return failures
    },
  },
  {
    name: '媒体查询只在跨断点时回调',
    route: '/cases/composables/use-media-query',
    facts: async ({ evaluate, send }) => {
      // 固定起始宽度，避免默认窗口大小影响断点判定
      await send('Emulation.setDeviceMetricsOverride', {
        width: 1400,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      })
      await evaluate(`document.querySelector('.demo-card')?.scrollIntoView({ block: 'center' })`)
      await sleep(400)

      /** 读两边的计数与断点（都从面板 DOM 读，不碰内部状态） */
      const read = () => evaluate(`(() => {
        const num = (key) => Number(document.querySelector('[data-stat="' + key + '"]')?.textContent?.trim() ?? -1)
        return {
          manualCalls: num('manual-calls'),
          manualChecks: num('manual-checks'),
          queryCalls: num('query-calls'),
          bp: document.querySelector('[data-stat="bp"]')?.textContent?.trim() ?? '',
          inner: num('inner'),
          client: num('client'),
          mismatch: document.querySelector('[data-stat="mismatch"]')?.textContent?.trim() ?? '',
        }
      })()`)

      /** 按文案点按钮（Naive 按钮渲染成 <button class="n-button">） */
      const clickButton = (text) => evaluate(`[...document.querySelectorAll('.umq-demo .actions .n-button')]
        .find((el) => el.textContent.includes('${text}'))?.click()`)

      await clickButton('重置')
      await sleep(160)
      const base = await read()

      // 1) 模拟拖窗：连发 30 个真实 resize，宽度不变 → 手写版白算，封装版不该被叫醒
      await clickButton('模拟')
      await sleep(220)
      const afterDrag = await read()

      // 2) 真实缩到 700（同时跨过 1024 与 768）：两条查询各翻转一次
      await send('Emulation.setDeviceMetricsOverride', {
        width: 700,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      })
      await sleep(380)
      const narrow = await read()

      // 3) 回到 1400：再翻转回来
      await send('Emulation.setDeviceMetricsOverride', {
        width: 1400,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      })
      await sleep(380)
      const wide = await read()

      return {
        manualPerDrag: afterDrag.manualCalls - base.manualCalls,
        checksPerDrag: afterDrag.manualChecks - base.manualChecks,
        queryPerDrag: afterDrag.queryCalls - base.queryCalls,
        toNarrow: narrow.queryCalls - afterDrag.queryCalls,
        backToWide: wide.queryCalls - narrow.queryCalls,
        bpNarrow: narrow.bp,
        bpWide: wide.bp,
      }
    },
    assert: (r) => {
      const failures = []
      if (r.manualPerDrag !== 30) {
        failures.push(`模拟拖窗 30 次后手写版回调增加了 ${r.manualPerDrag}（应为 30）`)
      }
      if (r.checksPerDrag !== 60) {
        failures.push(`模拟拖窗 30 次后断点比较增加了 ${r.checksPerDrag}（应为 60）`)
      }
      if (r.queryPerDrag !== 0) {
        failures.push(`没跨断点却收到了 ${r.queryPerDrag} 次 change 回调`)
      }
      if (r.toNarrow < 1 || r.toNarrow > 2) {
        failures.push(`跨两档断点收到 ${r.toNarrow} 次 change 回调（应为 1~2）`)
      }
      if (r.bpNarrow !== '移动') failures.push(`700px 时断点显示「${r.bpNarrow}」`)
      if (r.bpWide !== '桌面') failures.push(`1400px 时断点显示「${r.bpWide}」`)
      if (r.backToWide < 1 || r.backToWide > 2) {
        failures.push(`回到 1400px 收到 ${r.backToWide} 次 change 回调（应为 1~2）`)
      }
      return failures
    },
  },
  {
    name: '存储脏数据下两种读法不同',
    route: '/cases/composables/use-storage',
    facts: async ({ evaluate }) => {
      await evaluate(`document.querySelector('.demo-card')?.scrollIntoView({ block: 'center' })`)
      await sleep(400)

      /** 从面板 DOM 读两边的存储原文、提示、输入框值与档位 */
      const read = () => evaluate(`(() => {
        const text = (key) => document.querySelector('[data-stat="' + key + '"]')?.textContent?.trim() ?? ''
        const input = (key) => document.querySelector('[data-stat="' + key + '"] input')?.value ?? ''
        return {
          manualRaw: text('manual-raw').replace('存储原文：', '').trim(),
          autoRaw: text('auto-raw').replace('存储原文：', '').trim(),
          manualMsg: text('manual-msg'),
          autoMsg: text('auto-msg'),
          manualSize: text('manual-size'),
          autoSize: text('auto-size'),
          manualName: input('manual-name'),
          autoName: input('auto-name'),
        }
      })()`)

      /** 按文案点按钮（Naive 按钮渲染成 <button class="n-button">） */
      const click = (label) => evaluate(`[...document.querySelectorAll('.us-demo .actions .n-button')]
        .find((el) => el.textContent.includes('${label}'))?.click()`)

      await click('清空存储')
      await sleep(220)
      const cleared = await read()

      /** 连续改三次昵称：两边每次改动都该落盘一次，差的是「谁负责调用写入」 */
      const type = (key, value) => evaluate(`(() => {
        const input = document.querySelector('[data-stat="${key}"] input')
        if (!input) return false
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
        setter.call(input, '${value}')
        input.dispatchEvent(new Event('input', { bubbles: true }))
        return true
      })()`)

      /** 读两边面板上的累计写入次数 */
      const writes = () => evaluate(`(() => ({
        manual: Number(document.querySelector('[data-stat="manual-writes"]')?.textContent?.trim() ?? -1),
        auto: Number(document.querySelector('[data-stat="auto-writes"]')?.textContent?.trim() ?? -1),
      }))()`)

      const writesBefore = await writes()
      for (const value of ['小', '小明', '小明好']) {
        await type('manual-name', value)
        await type('auto-name', value)
        await sleep(60)
      }
      await sleep(220)
      const writesAfter = await writes()

      await click('写入坏 JSON')
      await sleep(140)
      const dirty = await read()

      await click('重新读取')
      await sleep(280)
      const afterBadJson = await read()

      await click('写入错类型')
      await sleep(140)
      await click('重新读取')
      await sleep(280)
      const afterBadTypes = await read()

      /** 面板上的存储原文是不是合法 JSON */
      const parseable = (text) => {
        try {
          JSON.parse(text)
          return true
        } catch {
          return false
        }
      }

      return {
        clearedManualRaw: cleared.manualRaw,
        manualWriteDelta: writesAfter.manual - writesBefore.manual,
        autoWriteDelta: writesAfter.auto - writesBefore.auto,
        dirtyBothSame: dirty.manualRaw === '{oops' && dirty.autoRaw === '{oops',
        manualBadJsonMsg: afterBadJson.manualMsg,
        autoBadJsonMsg: afterBadJson.autoMsg,
        manualRawKeptBroken: afterBadJson.manualRaw === '{oops',
        autoRawValid: parseable(afterBadJson.autoRaw),
        manualName: afterBadTypes.manualName,
        manualSize: afterBadTypes.manualSize,
        autoName: afterBadTypes.autoName,
        autoSize: afterBadTypes.autoSize,
        autoRawClean:
          !afterBadTypes.autoRaw.includes('huge') &&
          !afterBadTypes.autoRaw.includes('theme') &&
          !afterBadTypes.autoRaw.includes('yes'),
        autoRawSize: (() => {
          try {
            return JSON.parse(afterBadTypes.autoRaw).size
          } catch {
            return '（不是合法 JSON）'
          }
        })(),
      }
    },
    assert: (r) => {
      const failures = []
      if (r.clearedManualRaw !== '（空）') {
        failures.push(`清空后手写版存储原文不是空：${r.clearedManualRaw}`)
      }
      if (r.manualWriteDelta !== 3) {
        failures.push(`手写版改 3 次昵称应写 3 次，实际 ${r.manualWriteDelta}`)
      }
      if (r.autoWriteDelta !== 3) {
        failures.push(`封装版改 3 次昵称应写 3 次，实际 ${r.autoWriteDelta}`)
      }
      if (!r.dirtyBothSame) failures.push('两边没有读到同一份坏 JSON')
      if (!r.manualBadJsonMsg.includes('读取失败')) {
        failures.push(`坏 JSON 下没有提示读取失败：${r.manualBadJsonMsg}`)
      }
      if (!r.autoBadJsonMsg.includes('不是合法 JSON')) {
        failures.push(`封装版没有识别出坏 JSON：${r.autoBadJsonMsg}`)
      }
      if (!r.manualRawKeptBroken) failures.push('手写版居然修好了存储（应原样保留坏数据）')
      if (!r.autoRawValid) failures.push(`封装版没有把存储改回合法 JSON：${r.autoRawValid}`)
      if (r.manualName !== '小明') failures.push(`手写版没有按存储原样填入昵称：${r.manualName}`)
      if (!r.manualSize.includes('不是合法选项')) {
        failures.push(`手写版没有暴露非法档位：${r.manualSize}`)
      }
      if (r.autoName !== '小明') failures.push(`封装版丢了合法字段：${r.autoName}`)
      if (!r.autoSize.includes('中')) failures.push(`封装版没有把非法档位回退「中」：${r.autoSize}`)
      if (!r.autoRawClean) failures.push('封装版存储里还留着非法 / 多余字段')
      if (r.autoRawSize !== 'medium') {
        failures.push(`封装版存储里的字号不是默认值：${r.autoRawSize}`)
      }
      return failures
    },
  },
  {
    name: '快捷键在输入框里让路',
    route: '/cases/composables/use-keyboard-shortcut',
    facts: async ({ evaluate, send }) => {
      await evaluate(`document.querySelector('.demo-card')?.scrollIntoView({ block: 'center' })`)
      await sleep(420)

      /**
       * 真实按键：rawKeyDown 负责 keydown 监听，char 负责把字符插进输入框
       * （页面内 new KeyboardEvent 不会产生文字，验证不出「/ 能不能打出来」）
       */
      const press = async (key, code, vk, modifiers = 0, text = '') => {
        await send('Input.dispatchKeyEvent', {
          type: 'rawKeyDown',
          key,
          code,
          windowsVirtualKeyCode: vk,
          modifiers,
        })
        if (text) {
          await send('Input.dispatchKeyEvent', {
            type: 'char',
            key,
            text,
            unmodifiedText: text,
            modifiers,
          })
        }
        await send('Input.dispatchKeyEvent', {
          type: 'keyUp',
          key,
          code,
          windowsVirtualKeyCode: vk,
          modifiers,
        })
        await sleep(110)
      }

      const read = () =>
        evaluate(`(() => {
          const num = (key) => Number(document.querySelector('[data-stat="' + key + '"]')?.textContent?.trim() ?? -1)
          return {
            manualListeners: num('manual-listeners'),
            autoListeners: num('auto-listeners'),
            manualHits: num('manual-hits'),
            autoHits: num('auto-hits'),
            manualMiss: num('manual-miss'),
            autoIgnored: num('auto-ignored'),
            typing: document.querySelector('[data-stat="typing"] input')?.value ?? '',
            palette: Boolean(document.querySelector('[data-stat="palette"]')),
            logText: document.querySelector('[data-stat="logs"]')?.innerText.replace(/\\s+/g, ' ').trim() ?? '',
          }
        })()`)

      const focusInput = () =>
        evaluate(`document.querySelector('[data-stat="typing"] input')?.focus()`)
      const clickMode = (label) =>
        evaluate(`[...document.querySelectorAll('.uk-demo .n-radio-button')]
          .find((el) => el.textContent.includes('${label}'))?.click()`)

      // ① 手写模式：Alt+K 命中，Alt+Shift+K 也被当成 Alt+K
      const manualStart = await read()
      await press('k', 'KeyK', 75, 1)
      const afterAltK = await read()
      await press('k', 'KeyK', 75, 9)
      const afterShiftK = await read()
      await press('Escape', 'Escape', 27)
      const afterEsc = await read()

      // ② 手写模式 + 输入框里打 /：字符被 preventDefault 吞掉
      await focusInput()
      await press('/', 'Slash', 191, 0, '/')
      const manualSlash = await read()

      // ③ 切到封装版：监听器只剩 1 个，手写那几个全部解绑
      await clickMode('封装版')
      await sleep(200)
      const autoStart = await read()

      await press('k', 'KeyK', 75, 1)
      const autoAltK = await read()
      await press('k', 'KeyK', 75, 9)
      const autoShiftK = await read()
      await press('Escape', 'Escape', 27)
      const autoEsc = await read()

      // ④ 封装版 + 输入框里打 /：快捷键让路，字符正常输入
      await focusInput()
      await press('/', 'Slash', 191, 0, '/')
      const autoSlash = await read()

      return {
        manualListeners: manualStart.manualListeners,
        autoListenersAtStart: manualStart.autoListeners,
        manualHitsAfterAltK: afterAltK.manualHits,
        manualPaletteAfterAltK: afterAltK.palette,
        manualHitsAfterShiftK: afterShiftK.manualHits,
        manualPaletteAfterEsc: afterEsc.palette,
        manualHitsAfterSlash: manualSlash.manualHits,
        manualMissAfterSlash: manualSlash.manualMiss,
        manualTypingAfterSlash: manualSlash.typing,
        autoListeners: autoStart.autoListeners,
        manualListenersInAuto: autoStart.manualListeners,
        autoHitsAfterAltK: autoAltK.autoHits,
        autoPaletteAfterAltK: autoAltK.palette,
        autoHitsAfterShiftK: autoShiftK.autoHits,
        autoPaletteAfterEsc: autoEsc.palette,
        autoHitsAfterSlash: autoSlash.autoHits,
        autoIgnoredAfterSlash: autoSlash.autoIgnored,
        autoTypingAfterSlash: autoSlash.typing,
        autoLog: autoSlash.logText,
      }
    },
    assert: (r) => {
      const failures = []
      if (r.manualListeners !== 3) {
        failures.push(`手写版应挂 3 个监听器，实际 ${r.manualListeners}`)
      }
      if (r.autoListenersAtStart !== 0) {
        failures.push(`手写模式下封装版不应挂监听器，实际 ${r.autoListenersAtStart}`)
      }
      if (r.manualHitsAfterAltK !== 1 || !r.manualPaletteAfterAltK) {
        failures.push(`手写版 Alt+K 没命中（命中 ${r.manualHitsAfterAltK}）`)
      }
      if (r.manualHitsAfterShiftK !== 2) {
        failures.push(`手写版没有把 Alt+Shift+K 误当成 Alt+K（命中 ${r.manualHitsAfterShiftK}）`)
      }
      if (r.manualPaletteAfterEsc) failures.push('手写版 Esc 没有关闭快速跳转')
      if (r.manualMissAfterSlash !== 1) {
        failures.push(`手写版在输入框里按 / 没有记成误触发（${r.manualMissAfterSlash}）`)
      }
      if (r.manualTypingAfterSlash !== '') {
        failures.push(`手写版把输入框里的 / 吞掉了，字符应为空：${r.manualTypingAfterSlash}`)
      }
      if (r.autoListeners !== 1) failures.push(`封装版应只挂 1 个监听器，实际 ${r.autoListeners}`)
      if (r.manualListenersInAuto !== 0) {
        failures.push(`切到封装版后手写版监听器没解绑，剩 ${r.manualListenersInAuto}`)
      }
      if (r.autoHitsAfterAltK !== 1 || !r.autoPaletteAfterAltK) {
        failures.push(`封装版 Alt+K 没命中（命中 ${r.autoHitsAfterAltK}）`)
      }
      if (r.autoHitsAfterShiftK !== 1) {
        failures.push(`封装版 Alt+Shift+K 仍然触发（命中 ${r.autoHitsAfterShiftK}）`)
      }
      if (r.autoPaletteAfterEsc) failures.push('封装版 Esc 没有关闭快速跳转')
      if (r.autoHitsAfterSlash !== 2) {
        failures.push(`封装版在输入框里按 / 仍算命中（命中 ${r.autoHitsAfterSlash}）`)
      }
      if (r.autoIgnoredAfterSlash !== 1) {
        failures.push(`封装版没有记录输入框里被忽略的 /（${r.autoIgnoredAfterSlash}）`)
      }
      if (r.autoTypingAfterSlash !== '/') {
        failures.push(`封装版让路后 / 应该能打进输入框：${r.autoTypingAfterSlash}`)
      }
      if (!r.autoLog.includes('已忽略')) {
        failures.push(`日志里没有「已忽略」记录：${r.autoLog}`)
      }
      return failures
    },
  },
  {
    name: '代码定位行闪烁演示元素',
    route: '/cases/composables/use-keyboard-shortcut',
    facts: async ({ evaluate, send }) => {
      await send('Emulation.setDeviceMetricsOverride', {
        width: 1280,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      })
      await sleep(300)

      /** 轮询一个布尔表达式，避免源码按需加载 / 动画时序造成假红灯 */
      const waitFor = async (expression, timeoutMs = 4000) => {
        const start = Date.now()
        while (Date.now() - start < timeoutMs) {
          if (await evaluate(`Boolean(${expression})`)) return true
          await sleep(150)
        }
        return false
      }

      // ① 打开「源码」tab，切到带 @demo 标记的 usage 片段
      await evaluate(`document.querySelector('#tab-code')?.click()`)
      await waitFor(`document.querySelectorAll('.locate-btn').length > 0`)
      await evaluate(
        `[...document.querySelectorAll('.tab-btn')]
          .find((el) => el.textContent.includes('usage'))?.click()`,
      )
      await waitFor(`document.querySelectorAll('.locate-btn').length > 0`)

      const info = await evaluate(`(() => {
        const buttons = [...document.querySelectorAll('.locate-btn')]
        return {
          count: buttons.length,
          labels: buttons.map((el) => el.textContent.replace(/\\s+/g, ' ').trim()),
        }
      })()`)

      const clickMarker = (selector) =>
        evaluate(
          `[...document.querySelectorAll('.locate-btn')]
            .find((el) => el.textContent.includes(${JSON.stringify(selector)}))?.click()`,
        )

      // ② 没有 @demo 标记的普通代码行：点击不应触发闪烁或提示
      await evaluate(`document.querySelector('.line-code:not(:has(.locate-btn))')?.click()`)
      await sleep(200)
      const unmarked = await evaluate(`({
        flashes: document.querySelectorAll('.locate-flash').length,
        messages: document.querySelectorAll('.n-message').length,
      })`)

      // ③ 快速跳转面板还没打开：点击对应标记应给出提示，而不是静默失败
      await clickMarker('[data-stat="palette"]')
      await sleep(300)
      const failure = await evaluate(`({
        messages: [...document.querySelectorAll('.n-message')].map((el) => el.textContent.trim()),
        palette: Boolean(document.querySelector('.demo-card [data-stat="palette"]')),
      })`)

      // ④ 用真实按键打开面板（Alt+K），再点同一个标记：应闪烁并滚进视口
      await send('Input.dispatchKeyEvent', {
        type: 'rawKeyDown',
        key: 'k',
        code: 'KeyK',
        windowsVirtualKeyCode: 75,
        modifiers: 1,
      })
      await send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: 'k',
        code: 'KeyK',
        windowsVirtualKeyCode: 75,
        modifiers: 1,
      })
      await sleep(200)
      await clickMarker('[data-stat="palette"]')
      await sleep(350)
      const palette = await evaluate(`(() => {
        const el = document.querySelector('.demo-card [data-stat="palette"]')
        const rect = el?.getBoundingClientRect()
        return {
          flashed: Boolean(el?.classList.contains('locate-flash')),
          top: rect ? Math.round(rect.top) : -9999,
          bottom: rect ? Math.round(rect.bottom) : -9999,
          viewport: window.innerHeight,
        }
      })()`)

      // ⑤ 1.6s 后闪烁类必须被移除，不能永久留在演示元素上
      await sleep(1700)
      const paletteFlashAfter = await evaluate(
        `document.querySelector('.demo-card [data-stat="palette"]')?.classList.contains('locate-flash') ?? false`,
      )

      // ⑥ 另一个一直存在的元素（输入框）同样能定位
      await clickMarker('[data-stat="typing"] input')
      await sleep(350)
      const input = await evaluate(`(() => {
        const el = document.querySelector('.demo-card [data-stat="typing"] input')
        const rect = el?.getBoundingClientRect()
        return {
          flashed: Boolean(el?.classList.contains('locate-flash')),
          top: rect ? Math.round(rect.top) : -9999,
          bottom: rect ? Math.round(rect.bottom) : -9999,
        }
      })()`)

      // ⑦ 375px：代码区按钮仍可点，页面不能出现横向溢出
      await send('Emulation.setDeviceMetricsOverride', {
        width: 375,
        height: 800,
        deviceScaleFactor: 1,
        mobile: true,
      })
      await sleep(300)
      const narrowBeforeClick = await evaluate(`({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        buttons: [...document.querySelectorAll('.locate-btn')].filter((el) => {
          const rect = el.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0
        }).length,
      })`)
      await clickMarker('[data-stat="palette"]')
      await sleep(350)
      const narrowFlashed = await evaluate(
        `document.querySelector('.demo-card [data-stat="palette"]')?.classList.contains('locate-flash') ?? false`,
      )

      return {
        locateCount: info.count,
        locateLabels: info.labels,
        unmarkedFlashes: unmarked.flashes,
        unmarkedMessages: unmarked.messages,
        failureMessages: failure.messages,
        paletteOpenAtFailure: failure.palette,
        paletteFlashed: palette.flashed,
        paletteTop: palette.top,
        paletteBottom: palette.bottom,
        viewportHeight: palette.viewport,
        paletteFlashAfter,
        inputFlashed: input.flashed,
        inputTop: input.top,
        inputBottom: input.bottom,
        narrowScrollWidth: narrowBeforeClick.scrollWidth,
        narrowInnerWidth: narrowBeforeClick.innerWidth,
        narrowButtons: narrowBeforeClick.buttons,
        narrowFlashed,
      }
    },
    assert: (r) => {
      const failures = []
      if (r.locateCount !== 2) {
        failures.push(`usage 片段应有 2 个定位按钮，实际 ${r.locateCount}：${r.locateLabels}`)
      }
      if (r.unmarkedFlashes !== 0 || r.unmarkedMessages !== 0) {
        failures.push(
          `点普通代码行不应有反应：闪烁 ${r.unmarkedFlashes} / 提示 ${r.unmarkedMessages}`,
        )
      }
      if (r.paletteOpenAtFailure) failures.push('未按 Alt+K 时不该出现快速跳转面板')
      if (!r.failureMessages.some((text) => text.includes('不在当前演示状态'))) {
        failures.push(`面板未打开时没有提示：${r.failureMessages.join(' / ')}`)
      }
      if (!r.paletteFlashed) failures.push('打开面板后点击标记没有闪烁')
      if (r.paletteTop < 0 || r.paletteBottom > r.viewportHeight) {
        failures.push(
          `快速跳转面板没有滚进视口：top ${r.paletteTop} / bottom ${r.paletteBottom} / ${r.viewportHeight}`,
        )
      }
      if (r.paletteFlashAfter) failures.push('闪烁类 1.6s 后没有移除')
      if (!r.inputFlashed) failures.push('点击输入框标记没有闪烁')
      if (r.inputTop < 0 || r.inputBottom > r.viewportHeight) {
        failures.push(
          `输入框没有滚进视口：top ${r.inputTop} / bottom ${r.inputBottom} / ${r.viewportHeight}`,
        )
      }
      if (r.narrowScrollWidth > r.narrowInnerWidth) {
        failures.push(
          `375px 页面横向溢出：scrollWidth ${r.narrowScrollWidth} > ${r.narrowInnerWidth}`,
        )
      }
      if (r.narrowButtons !== 2) {
        failures.push(`375px 下定位按钮不可见：${r.narrowButtons} / 2`)
      }
      if (!r.narrowFlashed) failures.push('375px 下点击定位按钮没有闪烁')
      return failures
    },
  },
  {
    name: '代码定位行定位下拉列表',
    route: '/cases/performance/pull-refresh',
    facts: async ({ evaluate, send }) => {
      await send('Emulation.setDeviceMetricsOverride', {
        width: 1280,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      })
      await sleep(300)

      const waitFor = async (expression, timeoutMs = 4000) => {
        const start = Date.now()
        while (Date.now() - start < timeoutMs) {
          if (await evaluate(`Boolean(${expression})`)) return true
          await sleep(150)
        }
        return false
      }

      await evaluate(`document.querySelector('#tab-code')?.click()`)
      await waitFor(`document.querySelectorAll('.locate-btn').length > 0`)

      const clicked = await evaluate(`(() => {
        const btn = [...document.querySelectorAll('.locate-btn')]
          .find((el) => el.textContent.includes('.pr-scroller'))
        if (!btn) return false
        btn.click()
        return true
      })()`)
      await sleep(350)

      const placed = await evaluate(`(() => {
        const el = document.querySelector('.demo-card .pr-scroller')
        const rect = el?.getBoundingClientRect()
        return {
          flashed: Boolean(el?.classList.contains('locate-flash')),
          top: rect ? Math.round(rect.top) : -9999,
          bottom: rect ? Math.round(rect.bottom) : -9999,
          viewport: window.innerHeight,
        }
      })()`)

      await sleep(1700)
      const flashAfter = await evaluate(
        `document.querySelector('.demo-card .pr-scroller')?.classList.contains('locate-flash') ?? false`,
      )

      return {
        clicked,
        flashed: placed.flashed,
        top: placed.top,
        bottom: placed.bottom,
        viewportHeight: placed.viewport,
        flashAfter,
      }
    },
    assert: (r) => {
      const failures = []
      if (!r.clicked) failures.push('下拉刷新片段里没有 .pr-scroller 定位按钮')
      if (!r.flashed) failures.push('点击标记后列表没有闪烁')
      if (r.top < 0 || r.bottom > r.viewportHeight) {
        failures.push(`列表没有滚进视口：top ${r.top} / bottom ${r.bottom} / ${r.viewportHeight}`)
      }
      if (r.flashAfter) failures.push('闪烁类 1.6s 后没有移除')
      return failures
    },
  },
  {
    name: '自动保存防抖与离开补存',
    route: '/cases/composables/use-autosave',
    facts: async ({ evaluate }) =>
      evaluate(`(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
        const root = document.querySelector('.as-demo')
        const stat = (name) =>
          root.querySelector('[data-stat="' + name + '"]')?.textContent.trim() ?? ''
        const num = (name) => Number(stat(name))
        const textarea = root.querySelector('textarea')
        const toggle = (text) =>
          [...root.querySelectorAll('.toggle')]
            .find((el) => el.textContent.includes(text))
            ?.querySelector('[role="switch"]')
        const button = (text) =>
          [...root.querySelectorAll('.n-button')].find((el) => el.textContent.trim() === text)
        const type = (value) => {
          textarea.value = value
          textarea.dispatchEvent(new Event('input', { bubbles: true }))
        }

        button('重置').click()
        await wait(250)

        for (let i = 1; i <= 8; i++) {
          type('a'.repeat(i))
          await wait(60)
        }
        const typed = {
          leftWrites: num('left-writes'),
          autoSaves: num('auto-saves'),
          autoStatus: stat('auto-status'),
        }

        await wait(1000)
        const debounced = {
          leftWrites: num('left-writes'),
          autoSaves: num('auto-saves'),
          autoStatus: stat('auto-status'),
          leftValue: stat('left-value'),
          autoValue: stat('auto-value'),
        }

        type('abcdefghi')
        await wait(50)
        window.dispatchEvent(new Event('pagehide'))
        await wait(400)
        const afterHide = {
          leftWrites: num('left-writes'),
          autoSaves: num('auto-saves'),
          autoStatus: stat('auto-status'),
        }

        toggle('模拟保存失败').click()
        await wait(100)
        type('abcdefghij')
        await wait(1000)
        const failed = {
          autoSaves: num('auto-saves'),
          autoStatus: stat('auto-status'),
        }

        toggle('模拟保存失败').click()
        await wait(100)
        button('立即保存').click()
        await wait(400)
        const retried = {
          autoSaves: num('auto-saves'),
          autoStatus: stat('auto-status'),
        }

        const stored = {
          left: localStorage.getItem('autosave-demo-naive'),
          right: localStorage.getItem('autosave-demo-auto'),
        }

        button('重置').click()
        await wait(250)
        const reset = {
          leftWrites: num('left-writes'),
          autoSaves: num('auto-saves'),
          autoStatus: stat('auto-status'),
          left: localStorage.getItem('autosave-demo-naive'),
          right: localStorage.getItem('autosave-demo-auto'),
        }

        return { typed, debounced, afterHide, failed, retried, stored, reset }
      })()`),
    assert: (result) => {
      const failures = []
      const { typed, debounced, afterHide, failed, retried, stored, reset } = result
      if (typed.leftWrites !== 8) {
        failures.push(`手写版没有每次输入都写（${typed.leftWrites}）`)
      }
      if (typed.autoSaves !== 0 || typed.autoStatus !== '有未保存修改') {
        failures.push(`防抖窗口内封装版不该保存（${typed.autoSaves} / ${typed.autoStatus}）`)
      }
      if (debounced.autoSaves !== 1 || debounced.autoStatus !== '已保存') {
        failures.push(`防抖结束后封装版没有合并成一次保存（${debounced.autoSaves} / ${debounced.autoStatus}）`)
      }
      if (debounced.leftValue !== 'aaaaaaaa' || debounced.autoValue !== 'aaaaaaaa') {
        failures.push(`两边内容不一致（手写：${debounced.leftValue} / 封装：${debounced.autoValue}）`)
      }
      if (afterHide.autoSaves !== 2) {
        failures.push(`pagehide 没有补保存（${afterHide.autoSaves}）`)
      }
      if (failed.autoStatus !== '保存失败' || failed.autoSaves !== 2) {
        failures.push(`保存失败状态不对（${failed.autoStatus} / ${failed.autoSaves}）`)
      }
      if (retried.autoStatus !== '已保存' || retried.autoSaves !== 3) {
        failures.push(`重试没有成功（${retried.autoStatus} / ${retried.autoSaves}）`)
      }
      if (stored.left !== 'abcdefghij' || stored.right !== 'abcdefghij') {
        failures.push(`落盘内容不对（手写：${stored.left} / 封装：${stored.right}）`)
      }
      if (
        reset.leftWrites !== 0 ||
        reset.autoSaves !== 0 ||
        reset.autoStatus !== '等待输入' ||
        reset.left !== null ||
        reset.right !== null
      ) {
        failures.push(
          `重置没有清干净（${reset.leftWrites} / ${reset.autoSaves} / ${reset.autoStatus}）`,
        )
      }
      return failures
    },
  },
  {
    name: '网络状态订阅范围',
    route: '/cases/composables/use-network-status',
    facts: async ({ evaluate }) =>
      evaluate(`(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
        const root = document.querySelector('.ns-demo')
        const stat = (name) =>
          root.querySelector('[data-stat="' + name + '"]')?.textContent.trim() ?? ''
        const toggle = (text) =>
          [...root.querySelectorAll('.toggle')]
            .find((el) => el.textContent.includes(text))
            ?.querySelector('[role="switch"]')
        const radio = (text) =>
          [...root.querySelectorAll('.n-radio-button')].find(
            (el) => el.textContent.trim() === text,
          )
        const button = (text) =>
          [...root.querySelectorAll('.n-button')].find((el) => el.textContent.trim() === text)

        const read = () => ({
          manualOnline: stat('manual-online'),
          manualType: stat('manual-type'),
          manualSave: stat('manual-save'),
          manualUpdates: Number(stat('manual-updates')),
          manualStale: stat('manual-stale'),
          autoOnline: stat('auto-online'),
          autoType: stat('auto-type'),
          autoSpeed: stat('auto-speed'),
          autoSave: stat('auto-save'),
          autoChanges: Number(stat('auto-changes')),
        })

        const initial = read()
        radio('3G').click()
        await wait(150)
        const afterType = read()

        toggle('在线').click()
        await wait(150)
        const afterOffline = read()

        toggle('省流模式').click()
        await wait(150)
        const afterSave = read()

        button('重置').click()
        await wait(200)
        const reset = read()

        return { initial, afterType, afterOffline, afterSave, reset }
      })()`),
    assert: (result) => {
      const failures = []
      const { initial, afterType, afterOffline, afterSave, reset } = result
      if (initial.manualType !== '4g' || initial.autoType !== '4g') {
        failures.push(`初始制式不是 4G（手写：${initial.manualType} / 封装：${initial.autoType}）`)
      }
      if (afterType.manualType !== '4g') {
        failures.push(`手写版连接信息不该更新（${afterType.manualType}）`)
      }
      if (afterType.autoType !== '3g') {
        failures.push(`封装版没有跟上制式变化（${afterType.autoType}）`)
      }
      if (!afterType.autoSpeed.includes('1.5 Mbps') || !afterType.autoSpeed.includes('300 ms')) {
        failures.push(`封装版下行 / 延迟没有更新（${afterType.autoSpeed}）`)
      }
      if (afterType.manualStale !== '连接信息已过期') {
        failures.push(`手写版没有标出连接信息过期（${afterType.manualStale}）`)
      }
      if (afterType.autoChanges < 1) {
        failures.push(`封装版没有记录状态同步（${afterType.autoChanges}）`)
      }
      if (afterOffline.manualOnline !== '离线' || afterOffline.autoOnline !== '离线') {
        failures.push(
          `离线事件没有同时更新两边（手写：${afterOffline.manualOnline} / 封装：${afterOffline.autoOnline}）`,
        )
      }
      if (afterOffline.manualUpdates !== 1) {
        failures.push(`手写版在线状态更新次数不对（${afterOffline.manualUpdates}）`)
      }
      if (afterSave.manualSave !== '关' || afterSave.autoSave !== '开') {
        failures.push(
          `省流模式没有只更新封装版（手写：${afterSave.manualSave} / 封装：${afterSave.autoSave}）`,
        )
      }
      if (reset.manualType !== '4g' || reset.autoType !== '4g') {
        failures.push(`重置后制式不是 4G（手写：${reset.manualType} / 封装：${reset.autoType}）`)
      }
      if (reset.manualOnline !== '在线' || reset.autoOnline !== '在线') {
        failures.push(`重置后没有回到在线（手写：${reset.manualOnline} / 封装：${reset.autoOnline}）`)
      }
      if (reset.manualSave !== '关' || reset.autoSave !== '关') {
        failures.push(`重置后省流模式没有关闭（手写：${reset.manualSave} / 封装：${reset.autoSave}）`)
      }
      if (reset.manualUpdates !== 0 || reset.autoChanges !== 0) {
        failures.push(
          `重置后计数没有归零（手写：${reset.manualUpdates} / 封装：${reset.autoChanges}）`,
        )
      }
      return failures
    },
  },
  {
    name: '轮询节奏与后台暂停',
    route: '/cases/composables/use-polling',
    facts: async ({ evaluate }) =>
      evaluate(`(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
        const root = document.querySelector('.up-demo')
        const button = (text) =>
          [...root.querySelectorAll('.n-button')].find((el) => el.textContent.trim().includes(text))
        const toggle = (text) =>
          [...root.querySelectorAll('.toggle')]
            .find((el) => el.textContent.includes(text))
            ?.querySelector('[role="switch"]')
        const stat = (name) =>
          Number(root.querySelector('[data-stat="' + name + '"]')?.textContent.trim() ?? -1)

        toggle('慢接口').click()
        await wait(100)
        button('开始轮询').click()
        await wait(2700)
        const running = {
          manualCount: stat('manual-count'),
          manualActive: stat('manual-active'),
          manualOverlaps: stat('manual-overlaps'),
          autoCount: stat('auto-count'),
          autoActive: stat('auto-active'),
          autoErrors: stat('auto-errors'),
        }

        toggle('模拟切到后台').click()
        await wait(200)
        const manualAtHide = stat('manual-count')
        const autoAtHide = stat('auto-count')
        await wait(1800)
        const hidden = {
          manualCount: stat('manual-count'),
          manualHidden: stat('manual-hidden'),
          autoCount: stat('auto-count'),
          autoHidden: stat('auto-hidden'),
        }

        button('停止').click()
        const manualAtStop = stat('manual-count')
        const autoAtStop = stat('auto-count')
        await wait(1000)
        const stopped = {
          manualCount: stat('manual-count'),
          autoCount: stat('auto-count'),
        }

        button('重置').click()
        await wait(150)
        return {
          running,
          manualAtHide,
          autoAtHide,
          hidden,
          manualAtStop,
          autoAtStop,
          stopped,
          reset: {
            manualCount: stat('manual-count'),
            manualOverlaps: stat('manual-overlaps'),
            autoCount: stat('auto-count'),
            autoHidden: stat('auto-hidden'),
          },
        }
      })()`),
    assert: (result) => {
      const failures = []
      if (result.running.manualOverlaps < 1) {
        failures.push(`手写版没有叠出并发（${result.running.manualOverlaps}）`)
      }
      if (result.running.manualActive < 2) {
        failures.push(`手写版并发数没有超过 1（${result.running.manualActive}）`)
      }
      if (result.running.autoErrors !== 0) {
        failures.push(`封装版把取消算成了错误（${result.running.autoErrors}）`)
      }
      if (result.running.autoActive > 1) {
        failures.push(`封装版出现了并发（${result.running.autoActive}）`)
      }
      if (result.hidden.manualCount <= result.manualAtHide) {
        failures.push('切到后台后手写版没有继续轮询')
      }
      if (result.hidden.manualHidden < 1) {
        failures.push(`手写版后台轮询计数没有增加（${result.hidden.manualHidden}）`)
      }
      if (result.hidden.autoCount !== result.autoAtHide) {
        failures.push(`切到后台后封装版仍在轮询（${result.autoAtHide} → ${result.hidden.autoCount}）`)
      }
      if (result.hidden.autoHidden !== 0) {
        failures.push(`封装版后台轮询计数不是 0（${result.hidden.autoHidden}）`)
      }
      if (result.stopped.manualCount !== result.manualAtStop) {
        failures.push(`停止后手写版仍在计数（${result.manualAtStop} → ${result.stopped.manualCount}）`)
      }
      if (result.stopped.autoCount !== result.autoAtStop) {
        failures.push(`停止后封装版仍在计数（${result.autoAtStop} → ${result.stopped.autoCount}）`)
      }
      if (result.reset.manualCount !== 0 || result.reset.autoCount !== 0) {
        failures.push(
          `重置后计数没有归零（手写：${result.reset.manualCount} / 封装：${result.reset.autoCount}）`,
        )
      }
      return failures
    },
  },
  {
    name: '异步请求状态机',
    route: '/cases/composables/use-async-task',
    facts: async ({ evaluate }) =>
      evaluate(`(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
        const root = document.querySelector('.at-demo')
        const button = (text) =>
          [...root.querySelectorAll('.n-button')].find((el) => el.textContent.trim().includes(text))
        const stat = (name) =>
          Number(root.querySelector('[data-stat="' + name + '"]')?.textContent.trim() ?? -1)
        const badge = (index) =>
          root.querySelectorAll('.col .status .badge')[index]?.textContent.trim() ?? ''

        button('慢请求后立刻再发').click()
        await wait(1800)
        const afterRace = {
          manualRuns: stat('manual-runs'),
          manualStale: stat('manual-stale'),
          autoRuns: stat('auto-runs'),
          autoAborts: stat('auto-aborts'),
        }

        button('慢请求（1600ms）').click()
        await wait(250)
        button('取消').click()
        await wait(300)
        const afterCancel = {
          manualBadge: badge(0),
          manualActive: stat('manual-active'),
          autoBadge: badge(1),
          autoAborts: stat('auto-aborts'),
        }

        button('失败请求').click()
        await wait(700)
        return {
          afterRace,
          afterCancel,
          afterFail: { manualBadge: badge(0), autoBadge: badge(1) },
        }
      })()`),
    assert: (result) => {
      const failures = []
      if (result.afterRace.manualRuns !== 2) {
        failures.push(`手写版请求次数不对（${result.afterRace.manualRuns}）`)
      }
      if (result.afterRace.manualStale !== 1) {
        failures.push(`手写版没有丢掉过期响应（${result.afterRace.manualStale}）`)
      }
      if (result.afterRace.autoRuns !== 2) {
        failures.push(`封装版请求次数不对（${result.afterRace.autoRuns}）`)
      }
      if (result.afterRace.autoAborts !== 1) {
        failures.push(`封装版没有取消旧请求（${result.afterRace.autoAborts}）`)
      }
      if (result.afterCancel.manualBadge !== '已取消') {
        failures.push(`手写版取消后状态不对（${result.afterCancel.manualBadge}）`)
      }
      if (result.afterCancel.manualActive !== 1) {
        failures.push(`手写版取消后定时器没有继续跑（${result.afterCancel.manualActive}）`)
      }
      if (result.afterCancel.autoBadge !== '已取消') {
        failures.push(`封装版取消后状态不对（${result.afterCancel.autoBadge}）`)
      }
      if (result.afterCancel.autoAborts !== 2) {
        failures.push(`封装版取消次数不对（${result.afterCancel.autoAborts}）`)
      }
      if (result.afterFail.manualBadge !== '失败' || result.afterFail.autoBadge !== '失败') {
        failures.push(
          `失败请求状态不对（手写：${result.afterFail.manualBadge} / 封装：${result.afterFail.autoBadge}）`,
        )
      }
      return failures
    },
  },
  {
    name: '分页边界与每页条数切换',
    route: '/cases/admin/pagination',
    facts: async ({ evaluate }) =>
      evaluate(`(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
        const root = document.querySelector('.pg-demo')
        const stat = (name) =>
          root.querySelector('[data-stat="' + name + '"]')?.textContent.trim() ?? ''
        const num = (name) => Number(/[0-9]+/.exec(stat(name))?.[0] ?? NaN)
        const button = (text) =>
          [...root.querySelectorAll('.n-button')].find((el) => el.textContent.trim() === text)
        const pageItem = (text) =>
          [...root.querySelectorAll('.n-pagination-item')].find(
            (el) => el.textContent.trim() === text,
          )
        const pickSelect = async (selector, optionText) => {
          const trigger = root.querySelector(selector + ' .n-base-selection')
          if (!trigger) return false
          trigger.click()
          for (let i = 0; i < 24; i++) {
            const option = [...document.querySelectorAll('.n-base-select-option')]
              .find((item) => (item.textContent ?? '').trim() === optionText)
            if (option) {
              option.click()
              await wait(150)
              return true
            }
            await wait(50)
          }
          return false
        }
        const read = () => ({
          total: num('total'),
          page: num('page'),
          pageCount: num('page-count'),
          rowCount: num('row-count'),
          deleteCount: num('delete-count'),
          range: stat('range'),
          firstLast: stat('first-last'),
        })

        const initial = read()
        pageItem('3').click()
        await wait(150)
        const third = read()

        const sizePicked = await pickSelect('.pg-size', '20 条/页')
        await wait(200)
        const resized = read()

        pageItem('3').click()
        await wait(150)
        const lastPage = read()

        for (let i = 0; i < 7; i++) {
          button('删除当前页最后一条').click()
          await wait(60)
        }
        const deleted = read()

        button('重置数据').click()
        await wait(200)
        const reset = read()

        return { initial, third, sizePicked, resized, lastPage, deleted, reset }
      })()`),
    assert: (result) => {
      const failures = []
      const { initial, third, resized, lastPage, deleted, reset } = result
      if (initial.total !== 47 || initial.page !== 1 || initial.pageCount !== 5 || initial.rowCount !== 10) {
        failures.push(
          `初始分页不对（${initial.total} 条 / 第 ${initial.page} 页 / ${initial.pageCount} 页 / ${initial.rowCount} 行）`,
        )
      }
      if (third.page !== 3 || third.rowCount !== 10 || !third.range.includes('21-30')) {
        failures.push(`第 3 页不对（${third.page} / ${third.rowCount} / ${third.range}）`)
      }
      if (!result.sizePicked) failures.push('每页条数下拉没有选中')
      if (resized.page !== 1 || resized.pageCount !== 3 || resized.rowCount !== 20) {
        failures.push(
          `切到 20 条/页后没有回第 1 页（${resized.page} / ${resized.pageCount} 页 / ${resized.rowCount} 行）`,
        )
      }
      if (lastPage.page !== 3 || lastPage.rowCount !== 7 || !lastPage.range.includes('41-47')) {
        failures.push(`最后一页不对（${lastPage.page} / ${lastPage.rowCount} / ${lastPage.range}）`)
      }
      if (deleted.total !== 40 || deleted.page !== 2 || deleted.pageCount !== 2 || deleted.rowCount !== 20) {
        failures.push(
          `删到空页后没有回退（${deleted.total} 条 / 第 ${deleted.page} 页 / ${deleted.pageCount} 页 / ${deleted.rowCount} 行）`,
        )
      }
      if (!deleted.range.includes('21-40')) {
        failures.push(`回退后的区间不对（${deleted.range}）`)
      }
      if (reset.total !== 47 || reset.page !== 1 || reset.pageCount !== 5 || reset.rowCount !== 10) {
        failures.push(
          `重置没有恢复（${reset.total} 条 / 第 ${reset.page} 页 / ${reset.pageCount} 页 / ${reset.rowCount} 行）`,
        )
      }
      return failures
    },
  },
  {
    name: '表单抽屉校验与脏数据保护',
    route: '/cases/admin/form-drawer',
    facts: async ({ evaluate }) =>
      evaluate(`(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
        const root = document.querySelector('.fd-demo')
        const stat = (name) =>
          root.querySelector('[data-stat="' + name + '"]')?.textContent.trim() ?? ''
        const num = (name) => Number(/[0-9]+/.exec(stat(name))?.[0] ?? NaN)
        const button = (text) =>
          [...document.querySelectorAll('.n-button')].find((el) => el.textContent.trim() === text)
        const drawer = () => document.querySelector('.fd-drawer')
        const title = () => drawer()?.querySelector('.fd-title')?.textContent.trim() ?? ''
        const errorText = (selector) =>
          document.querySelector(selector)?.textContent.trim() ?? ''
        const pickSelect = async (selector, optionText) => {
          const trigger = document.querySelector(selector + ' .n-base-selection')
          if (!trigger) return false
          trigger.click()
          for (let i = 0; i < 24; i++) {
            const option = [...document.querySelectorAll('.n-base-select-option')]
              .find((item) => (item.textContent ?? '').trim() === optionText)
            if (option) {
              option.click()
              await wait(150)
              return true
            }
            await wait(50)
          }
          return false
        }
        const setInput = (selector, value) => {
          const input = document.querySelector(selector + ' input')
          input.value = value
          input.dispatchEvent(new Event('input', { bubbles: true }))
        }
        const read = () => ({
          drawer: Boolean(drawer()),
          title: title(),
          userCount: num('user-count'),
          saveCount: num('save-count'),
          discardCount: num('discard-count'),
          failCount: num('fail-count'),
          guard: Boolean(document.querySelector('.fd-guard')),
          nameError: errorText('.fd-name-error'),
          ownerError: errorText('.fd-owner-error'),
          submitError: errorText('.fd-submit-error'),
          firstRow: root.querySelector('tbody tr')?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
        })

        const initial = read()
        button('新增用户').click()
        await wait(200)
        const opened = read()

        button('保存').click()
        await wait(120)
        const invalid = read()

        setInput('.fd-name', '测试用户')
        await pickSelect('.fd-owner', '张三')
        await pickSelect('.fd-status', '停用')
        button('保存').click()
        await wait(1000)
        const added = read()

        document.querySelector('.fd-edit[data-id="1"]').click()
        await wait(200)
        setInput('.fd-name', '月度报表-改')
        button('取消').click()
        await wait(120)
        const guarded = read()
        button('继续编辑').click()
        await wait(100)
        const continued = read()
        button('取消').click()
        await wait(100)
        button('放弃并关闭').click()
        await wait(300)
        const discarded = read()

        root.querySelector('.fd-fail [role="switch"]').click()
        await wait(100)
        document.querySelector('.fd-edit[data-id="1"]').click()
        await wait(200)
        setInput('.fd-name', '月度报表-改')
        button('保存').click()
        await wait(700)
        const failed = read()

        root.querySelector('.fd-fail [role="switch"]').click()
        await wait(100)
        button('保存').click()
        await wait(1000)
        const retried = read()

        return { initial, opened, invalid, added, guarded, continued, discarded, failed, retried }
      })()`),
    assert: (result) => {
      const failures = []
      const { initial, opened, invalid, added, guarded, continued, discarded, failed, retried } = result
      if (initial.drawer || initial.userCount !== 3) {
        failures.push(`初始状态不对（抽屉 ${initial.drawer} / 用户 ${initial.userCount}）`)
      }
      if (!opened.drawer || opened.title !== '新增用户') {
        failures.push(`新增抽屉没有打开（${opened.drawer} / ${opened.title}）`)
      }
      if (
        !invalid.drawer ||
        invalid.nameError !== '请输入名称' ||
        invalid.ownerError !== '请选择负责人' ||
        invalid.saveCount !== 0
      ) {
        failures.push(
          `空表单校验不对（${invalid.nameError} / ${invalid.ownerError} / 保存 ${invalid.saveCount}）`,
        )
      }
      if (added.drawer || added.userCount !== 4 || added.saveCount !== 1) {
        failures.push(`新增没有成功（抽屉 ${added.drawer} / 用户 ${added.userCount} / 保存 ${added.saveCount}）`)
      }
      if (!guarded.drawer || !guarded.guard || guarded.discardCount !== 0) {
        failures.push(`脏数据保护条没有出现（${guarded.guard} / 放弃 ${guarded.discardCount}）`)
      }
      if (continued.guard || !continued.drawer) {
        failures.push(`继续编辑后保护条没收起或抽屉关了（${continued.drawer} / ${continued.guard}）`)
      }
      if (discarded.drawer || discarded.discardCount !== 1 || !discarded.firstRow.includes('月度报表')) {
        failures.push(
          `放弃修改结果不对（抽屉 ${discarded.drawer} / 放弃 ${discarded.discardCount} / 首行 ${discarded.firstRow}）`,
        )
      }
      if (!failed.drawer || failed.submitError !== '保存失败：网络超时' || failed.failCount !== 1) {
        failures.push(
          `保存失败后抽屉关闭或没有错误（${failed.drawer} / ${failed.submitError} / 失败 ${failed.failCount}）`,
        )
      }
      if (retried.drawer || retried.saveCount !== 2 || !retried.firstRow.includes('月度报表-改')) {
        failures.push(
          `重试保存没有成功（抽屉 ${retried.drawer} / 保存 ${retried.saveCount} / 首行 ${retried.firstRow}）`,
        )
      }
      return failures
    },
  },
  {
    name: '确认框异步失败不关闭',
    route: '/cases/admin/confirm-action',
    facts: async ({ evaluate }) =>
      evaluate(`(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
        const root = document.querySelector('.ca-demo')
        const stat = (name) =>
          root.querySelector('[data-stat="' + name + '"]')?.textContent.trim() ?? ''
        const num = (name) => Number(/[0-9]+/.exec(stat(name))?.[0] ?? NaN)
        const button = (text) =>
          [...document.querySelectorAll('.n-button')].find((el) => el.textContent.trim() === text)
        const dialog = () => document.querySelector('.ca-dialog')
        const errorText = () =>
          document.querySelector('[data-stat="dialog-error"]')?.textContent.trim() ?? ''
        const read = () => ({
          open: Boolean(dialog()),
          confirmCount: num('confirm-count'),
          cancelCount: num('cancel-count'),
          successCount: num('success-count'),
          failCount: num('fail-count'),
          ignoredCount: num('ignored-count'),
          lastResult: stat('last-result'),
        })

        const initial = read()
        button('删除草稿').click()
        await wait(120)
        const opened = { ...read(), title: dialog()?.querySelector('.ca-title')?.textContent.trim() ?? '' }
        button('取消').click()
        await wait(120)
        const cancelled = read()

        button('删除草稿').click()
        await wait(120)
        button('删除').click()
        await wait(150)
        const submitting = { ...read(), okText: button('提交中…')?.textContent.trim() ?? '' }
        await wait(600)
        const succeeded = read()

        root.querySelector('.ca-fail [role="switch"]').click()
        await wait(100)
        button('发布文章').click()
        await wait(120)
        button('发布').click()
        await wait(750)
        const failed = { ...read(), error: errorText() }

        root.querySelector('.ca-fail [role="switch"]').click()
        await wait(100)
        button('发布').click()
        await wait(750)
        const retried = read()

        return { initial, opened, cancelled, submitting, succeeded, failed, retried }
      })()`),
    assert: (result) => {
      const failures = []
      const { initial, opened, cancelled, submitting, succeeded, failed, retried } = result
      if (initial.open || initial.confirmCount !== 0) {
        failures.push(`初始状态不对（打开 ${initial.open} / 计数 ${initial.confirmCount}）`)
      }
      if (!opened.open || opened.title !== '删除草稿' || opened.confirmCount !== 1) {
        failures.push(`确认框没有打开（${opened.open} / ${opened.title} / ${opened.confirmCount}）`)
      }
      if (cancelled.open || cancelled.cancelCount !== 1 || cancelled.lastResult !== '取消') {
        failures.push(`取消没有关闭（${cancelled.open} / ${cancelled.cancelCount} / ${cancelled.lastResult}）`)
      }
      if (!submitting.open || submitting.okText !== '提交中…') {
        failures.push(`提交中没有保持打开或按钮没有 loading（${submitting.open} / ${submitting.okText}）`)
      }
      if (succeeded.open || succeeded.successCount !== 1 || succeeded.lastResult !== '成功') {
        failures.push(`成功后没有关闭（${succeeded.open} / ${succeeded.successCount} / ${succeeded.lastResult}）`)
      }
      if (!failed.open || failed.error !== '发布失败：网络超时') {
        failures.push(`失败后确认框关闭或没有错误信息（${failed.open} / ${failed.error}）`)
      }
      if (failed.failCount !== 1 || failed.successCount !== 1 || failed.lastResult !== '失败') {
        failures.push(
          `失败计数不对（成功 ${failed.successCount} / 失败 ${failed.failCount} / ${failed.lastResult}）`,
        )
      }
      if (retried.open || retried.successCount !== 2 || retried.failCount !== 1) {
        failures.push(
          `重试没有成功（${retried.open} / 成功 ${retried.successCount} / 失败 ${retried.failCount}）`,
        )
      }
      if (retried.lastResult !== '成功') {
        failures.push(`重试后最近结果不对（${retried.lastResult}）`)
      }
      return failures
    },
  },
  {
    name: '表格批量操作三态与执行锁',
    route: '/cases/admin/batch-actions',
    facts: async ({ evaluate }) =>
      evaluate(`(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
        const root = document.querySelector('.ba-demo')
        const stat = (name) =>
          root.querySelector('[data-stat="' + name + '"]')?.textContent.trim() ?? ''
        const num = (name) => Number(/[0-9]+/.exec(stat(name))?.[0] ?? NaN)
        const button = (text) =>
          [...root.querySelectorAll('.n-button')].find((el) => el.textContent.trim() === text)
        const rowCheck = (id) => root.querySelector('.row-check[data-row="' + id + '"]')
        const allCheck = root.querySelector('.all-check')
        const read = () => ({
          selected: num('selected-count'),
          enabled: num('enabled-count'),
          disabled: num('disabled-count'),
          batch: num('batch-count'),
          lastAction: stat('last-action'),
          header: allCheck?.getAttribute('aria-checked') ?? '',
        })

        const initial = read()
        rowCheck(1).click()
        rowCheck(2).click()
        await wait(120)
        const partial = read()

        allCheck.click()
        await wait(120)
        const all = read()

        button('批量停用').click()
        await wait(650)
        const afterDisable = read()

        allCheck.click()
        await wait(120)
        const reSelected = read()
        button('清空选择').click()
        await wait(120)
        const cleared = read()

        rowCheck(1).click()
        rowCheck(2).click()
        rowCheck(3).click()
        await wait(120)
        button('批量启用').click()
        await wait(650)
        const afterEnable = read()

        return { initial, partial, all, afterDisable, reSelected, cleared, afterEnable }
      })()`),
    assert: (result) => {
      const failures = []
      const { initial, partial, all, afterDisable, reSelected, cleared, afterEnable } = result
      if (initial.selected !== 0 || initial.enabled !== 4 || initial.disabled !== 4) {
        failures.push(`初始状态不对（${initial.selected} 选中 / ${initial.enabled} 启用 / ${initial.disabled} 停用）`)
      }
      if (partial.selected !== 2 || partial.header !== 'mixed') {
        failures.push(`半选状态不对（${partial.selected} 选中 / 表头 ${partial.header}）`)
      }
      if (all.selected !== 8 || all.header !== 'true') {
        failures.push(`全选状态不对（${all.selected} 选中 / 表头 ${all.header}）`)
      }
      if (afterDisable.selected !== 0 || afterDisable.enabled !== 0 || afterDisable.disabled !== 8) {
        failures.push(
          `批量停用结果不对（${afterDisable.selected} 选中 / ${afterDisable.enabled} 启用 / ${afterDisable.disabled} 停用）`,
        )
      }
      if (afterDisable.batch !== 1 || afterDisable.lastAction !== '批量停用 8 项') {
        failures.push(`批量停用没有记录（${afterDisable.batch} / ${afterDisable.lastAction}）`)
      }
      if (reSelected.selected !== 8 || cleared.selected !== 0) {
        failures.push(`清空选择没有生效（全选 ${reSelected.selected} / 清空后 ${cleared.selected}）`)
      }
      if (afterEnable.enabled !== 3 || afterEnable.disabled !== 5 || afterEnable.selected !== 0) {
        failures.push(
          `批量启用结果不对（${afterEnable.enabled} 启用 / ${afterEnable.disabled} 停用 / ${afterEnable.selected} 选中）`,
        )
      }
      if (afterEnable.batch !== 2 || afterEnable.lastAction !== '批量启用 3 项') {
        failures.push(`批量启用没有记录（${afterEnable.batch} / ${afterEnable.lastAction}）`)
      }
      return failures
    },
  },
  {
    name: '查询栏条件回显与防重复提交',
    route: '/cases/admin/query-bar',
    facts: async ({ evaluate }) =>
      evaluate(`(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
        const root = document.querySelector('.qb-demo')
        const stat = (name) =>
          root.querySelector('[data-stat="' + name + '"]')?.textContent.trim() ?? ''
        const num = (name) => Number(/[0-9]+/.exec(stat(name))?.[0] ?? NaN)
        const button = (text) =>
          [...root.querySelectorAll('.n-button')].find((el) => el.textContent.trim() === text)
        const pickSelect = async (selector, optionText) => {
          const trigger = root.querySelector(selector + ' .n-base-selection')
          if (!trigger) return false
          trigger.click()
          for (let i = 0; i < 24; i++) {
            const option = [...document.querySelectorAll('.n-base-select-option')]
              .find((item) => (item.textContent ?? '').trim() === optionText)
            if (option) {
              option.click()
              await wait(150)
              return true
            }
            await wait(50)
          }
          return false
        }
        const read = () => ({
          resultCount: num('result-count'),
          queryCount: num('query-count'),
          resetCount: num('reset-count'),
          activeCount: num('active-count'),
          statusText: stat('status-text'),
          resultNames: stat('result-names'),
          expanded: stat('expanded'),
        })

        const initial = read()
        const input = root.querySelector('.qb-keyword input')
        input.value = '报表'
        input.dispatchEvent(new Event('input', { bubbles: true }))
        await wait(80)
        const beforeQuery = read()

        const statusPicked = await pickSelect('.qb-status', '启用')
        const ownerPicked = await pickSelect('.qb-owner', '张三')
        button('查询').click()
        button('查询').click()
        await wait(700)
        const queried = read()

        const ownerChip = [...root.querySelectorAll('.n-tag')]
          .find((el) => (el.textContent ?? '').includes('负责人'))
        ownerChip?.querySelector('.n-tag__close')?.click()
        await wait(150)
        const afterRemoveChip = read()

        button('收起').click()
        await wait(80)
        const collapsed = { ...read(), fieldsVisible: root.querySelector('.fields')?.offsetParent !== null }
        button('展开').click()
        await wait(80)
        const expanded = { ...read(), fieldsVisible: root.querySelector('.fields')?.offsetParent !== null }

        button('重置').click()
        await wait(150)
        const reset = read()

        return {
          initial,
          beforeQuery,
          statusPicked,
          ownerPicked,
          queried,
          afterRemoveChip,
          collapsed,
          expanded,
          reset,
        }
      })()`),
    assert: (result) => {
      const failures = []
      const { initial, beforeQuery, queried, afterRemoveChip, collapsed, expanded, reset } = result
      if (initial.resultCount !== 12 || initial.activeCount !== 0) {
        failures.push(`初始结果不对（${initial.resultCount} 条 / ${initial.activeCount} 项条件）`)
      }
      if (beforeQuery.resultCount !== 12 || beforeQuery.activeCount !== 0) {
        failures.push(`只改输入框就过滤了（${beforeQuery.resultCount} 条 / ${beforeQuery.activeCount} 项条件）`)
      }
      if (beforeQuery.statusText !== '条件已修改，点查询生效') {
        failures.push(`没有提示条件未生效（${beforeQuery.statusText}）`)
      }
      if (!result.statusPicked || !result.ownerPicked) {
        failures.push('状态或负责人下拉没有选中')
      }
      if (queried.resultCount !== 1 || queried.resultNames !== '月度报表') {
        failures.push(`组合条件结果不对（${queried.resultCount} / ${queried.resultNames}）`)
      }
      if (queried.queryCount !== 1) {
        failures.push(`连点查询产生了重复请求（${queried.queryCount}）`)
      }
      if (queried.activeCount !== 3) {
        failures.push(`条件标签数量不对（${queried.activeCount}）`)
      }
      if (queried.statusText !== '已生效') {
        failures.push(`查询完成后状态文案不对（${queried.statusText}）`)
      }
      if (afterRemoveChip.resultCount !== 2 || afterRemoveChip.activeCount !== 2) {
        failures.push(`点标签 × 没有移除条件（${afterRemoveChip.resultCount} 条 / ${afterRemoveChip.activeCount} 项）`)
      }
      if (collapsed.expanded !== '收起' || collapsed.fieldsVisible) {
        failures.push(`收起后字段仍可见（${collapsed.expanded} / ${collapsed.fieldsVisible}）`)
      }
      if (expanded.expanded !== '展开' || !expanded.fieldsVisible) {
        failures.push(`展开后字段没有回来（${expanded.expanded} / ${expanded.fieldsVisible}）`)
      }
      if (reset.resultCount !== 12 || reset.activeCount !== 0 || reset.resetCount !== 1) {
        failures.push(
          `重置没有清干净（${reset.resultCount} 条 / ${reset.activeCount} 项 / 重置 ${reset.resetCount} 次）`,
        )
      }
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
    // 首屏稳定后仍可能卡在「演示加载中…」（dev 首次编译案例 chunk 较慢），再兜一层
    await waitForDemo(page)
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
    const state = await page.evaluate(`(() => {
      const card = document.querySelector('.demo-card')
      if (!card) return 'missing'
      // 占位符还在 = 演示组件还没到（或加载失败）
      return card.querySelector('.async-placeholder') ? 'loading' : 'ready'
    })()`)
    if (state === 'ready') return true
    // 列表 / 404 这类页面本来就没有演示区：给 2.5s 等 CasePage 挂载，之后放行
    if (state === 'missing' && Date.now() - started > 2500) return true
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
      // 演示组件是懒加载的：先等占位符消失，再留一点时间让入口动画落位。
      // 早期这里写死 sleep(1500)，dev 下案例 chunk 稍慢就会采到「演示加载中…」
      await waitForDemo(page)
      await sleep(300)

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

/**
 * 给一个案例的演示区拍截图（1280 / 375 各一张，可选暗色）
 * 只截 .demo-card，避免每次都被顶栏和说明区占掉大半个图
 */
async function shootCase(port, casePath, dark, outDir, widths) {
  const route = `/cases/${casePath}`
  const target = await openPage(port, BASE + route)
  const page = await connectPage(target)
  const files = []

  try {
    // 等初始导航落地（about:blank 上访问 localStorage 会抛 SecurityError）
    for (let i = 0; i < 50; i++) {
      const origin = await page.evaluate('location.origin').catch(() => '')
      if (origin && origin !== 'null') break
      await sleep(100)
    }

    // 主题：先写 localStorage 再刷新，让 useTheme 初始化时读到目标主题。
    // 只加 .dark 类不够——Naive UI 用的是 JS 主题对象，不会跟着 class 变。
    await page.evaluate(
      `(() => {
        localStorage.setItem('moyu-theme', ${dark ? "'dark'" : "'light'"})
        return true
      })()`,
    )
    await page.send('Page.navigate', { url: BASE + route })
    await sleep(500)

    for (const width of widths) {
      await page.send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 900,
        deviceScaleFactor: 1,
        mobile: width < 500,
      })
      await waitForDemo(page)
      await sleep(500) // 等响应式重排与入场过渡结束，否则会截到半透明状态

      const box = await page.evaluate(`(() => {
        const card = document.querySelector('.demo-card')
        if (!card) return null
        const rect = card.getBoundingClientRect()
        // 演示很长时截前 2600px 足够看清观感，避免生成超大图
        return {
          x: Math.max(0, rect.x + window.scrollX),
          y: Math.max(0, rect.y + window.scrollY),
          width: Math.min(rect.width, ${width}),
          height: Math.min(rect.height, 2600),
        }
      })()`)
      if (!box || box.height < 20) continue

      const shot = await page.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
        clip: { ...box, scale: 1 },
      })
      const file = path.join(
        outDir,
        `${casePath.replace(/\//g, '-')}-${width}${dark ? '-dark' : ''}.png`,
      )
      writeFileSync(file, Buffer.from(shot.data, 'base64'))
      files.push(file)
    }
  } finally {
    page.close()
    await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {})
  }

  return files
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
  if (SHOTS.length > 0) {
    // 截图模式：只出图不断言，路径打印出来方便直接打开
    const outDir = readOutDir()
    const widths = readWidths()
    mkdirSync(outDir, { recursive: true })
    for (const casePath of SHOTS) {
      const files = await shootCase(chrome.port, resolveCasePath(casePath), DARK, outDir, widths)
      for (const file of files) results.push({ name: `截图 ${path.basename(file)}`, route: casePath, result: { file }, failures: [] })
    }
  } else if (CASE) {
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
      : SHOTS.length > 0
        ? `--shot ${SHOTS.join(',')}${DARK ? '（暗色）' : ''}`
        : ONLY
          ? `--only ${ONLY}`
          : ''
  console.log(`\n[check:ui] 目标：${BASE}${mode ? `（${mode}）` : ''}\n`)

  const failed = results.filter((item) => item.failures.length > 0)

  if (SHOTS.length > 0) {
    // 截图不是断言，不统计通过率
    for (const item of results) console.log(`✓ ${item.name}`)
    console.log(`\n[check:ui] 截图完成：${results.length} 张 → ${readOutDir()}`)
  } else if (SWEEP) {
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
  } else if (SHOTS.length === 0) {
    console.log(`\n[check:ui] ${results.length} 个${SWEEP ? '案例' : '场景'}全部通过 ✓`)
  }
} finally {
  shutdown(chrome)
}

process.exit(exitCode)
